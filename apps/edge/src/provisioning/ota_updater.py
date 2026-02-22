"""
OTA (Over-The-Air) Updater with Dual-Partition and Automatic Rollback

Architecture:
    /partition-a/  ← Active partition (running now)
    /partition-b/  ← Standby partition (previous version or new candidate)

Update flow:
    1. Cloud publishes new version to lifo4/{siteId}/ota/update
       Payload: { "version": "1.1.0", "url": "https://...", "checksum": "sha256:..." }
    2. Edge receives notification
    3. Check maintenance window (default: 02:00–05:00 local time)
       If not in window: schedule for next window
    4. Download new image in background (no interruption to operation)
    5. Verify SHA-256 checksum
    6. Verify digital signature (code signing)
    7. Install into inactive partition (B)
    8. Reboot to partition B
    9. Healthcheck (5 min window):
       a. Control loop running?
       b. Modbus responding?
       c. MQTT connected?
       d. Safety manager operational?
    10. All checks pass → mark B as active, report success
        Any check fails → reboot to A (rollback), report failure

NEVER update during:
    - Active charge/discharge operation
    - Critical alarm active
    - Blackout (island mode)
    - SOC < 20%
"""

import hashlib
import json
import logging
import os
import shutil
import signal
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Optional
from urllib.request import urlopen, Request

import paho.mqtt.client as mqtt

logger = logging.getLogger("ota_updater")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

PARTITION_A = Path(os.getenv("PARTITION_A", "/partition-a"))
PARTITION_B = Path(os.getenv("PARTITION_B", "/partition-b"))
ACTIVE_MARKER = Path(os.getenv("ACTIVE_MARKER", "/data/config/active_partition.txt"))
OTA_STAGING = Path(os.getenv("OTA_STAGING", "/data/ota/staging"))
SIGNING_PUBLIC_KEY = Path(os.getenv("SIGNING_PUBLIC_KEY", "/certs/device/code-signing.pub"))

MAINTENANCE_WINDOW_START_H = int(os.getenv("MAINTENANCE_WINDOW_START_H", "2"))
MAINTENANCE_WINDOW_END_H = int(os.getenv("MAINTENANCE_WINDOW_END_H", "5"))

HEALTHCHECK_TIMEOUT_S = int(os.getenv("HEALTHCHECK_TIMEOUT_S", "300"))  # 5 min
DOWNLOAD_CHUNK_SIZE = 8192  # bytes

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "mqtt.lifo4.com.br")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))

# Loaded from device config at runtime
SYSTEM_ID = os.getenv("SYSTEM_ID", "unknown")


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


class OtaState(Enum):
    IDLE = "IDLE"
    CHECKING = "CHECKING"
    DOWNLOADING = "DOWNLOADING"
    VERIFYING = "VERIFYING"
    INSTALLING = "INSTALLING"
    REBOOTING = "REBOOTING"
    HEALTHCHECK = "HEALTHCHECK"
    COMMITTED = "COMMITTED"
    ROLLED_BACK = "ROLLED_BACK"
    FAILED = "FAILED"


@dataclass
class UpdatePackage:
    version: str
    url: str
    checksum: str  # "sha256:<hex>"
    signature: Optional[str] = None  # base64 signature
    release_notes: str = ""


@dataclass
class HealthStatus:
    control_loop_ok: bool
    modbus_ok: bool
    mqtt_ok: bool
    safety_manager_ok: bool

    @property
    def all_ok(self) -> bool:
        return all([self.control_loop_ok, self.modbus_ok, self.mqtt_ok, self.safety_manager_ok])


# ---------------------------------------------------------------------------
# Operational state checks
# ---------------------------------------------------------------------------


def is_safe_to_update() -> tuple[bool, str]:
    """
    Return (safe, reason). Update is blocked if any condition is unsafe.
    """
    state_file = Path("/data/runtime/operational_state.json")
    if not state_file.exists():
        # Cannot confirm safety → block update
        return False, "operational state file not found"

    try:
        state = json.loads(state_file.read_text())
    except Exception as exc:
        return False, f"state file parse error: {exc}"

    if state.get("active_alarm_critical", False):
        return False, "critical alarm active"

    if state.get("island_mode", False):
        return False, "island mode (blackout) active"

    soc = state.get("soc_percent", 100)
    if soc < 20:
        return False, f"SOC too low ({soc}%) — need ≥20% for reboot"

    power_kw = state.get("power_kw", 0.0)
    if abs(power_kw) > 1.0:
        return False, f"active charge/discharge operation ({power_kw} kW)"

    return True, "ok"


def is_in_maintenance_window() -> bool:
    current_hour = time.localtime().tm_hour
    start = MAINTENANCE_WINDOW_START_H
    end = MAINTENANCE_WINDOW_END_H

    if start <= end:
        return start <= current_hour < end
    # Handles wrap-around (e.g., 22:00–02:00)
    return current_hour >= start or current_hour < end


def seconds_until_maintenance_window() -> int:
    """Return seconds until the next maintenance window opens."""
    now = time.localtime()
    current_minutes = now.tm_hour * 60 + now.tm_min
    target_minutes = MAINTENANCE_WINDOW_START_H * 60

    diff = target_minutes - current_minutes
    if diff <= 0:
        diff += 24 * 60  # next day
    return diff * 60


# ---------------------------------------------------------------------------
# Download & verification
# ---------------------------------------------------------------------------


def _validate_ota_url(url: str) -> bool:
    """
    Validate that the OTA download URL points to an allowed host.
    Prevents SSRF attacks via malicious MQTT payloads.
    """
    from urllib.parse import urlparse

    allowed_hosts_raw = os.getenv("OTA_ALLOWED_HOSTS", "storage.lifo4.com.br")
    allowed_hosts = [h.strip() for h in allowed_hosts_raw.split(",") if h.strip()]

    try:
        parsed = urlparse(url)
        if parsed.scheme not in ("https", "http"):
            logger.error("OTA URL rejected: scheme '%s' not allowed (use https)", parsed.scheme)
            return False
        if parsed.hostname not in allowed_hosts:
            logger.error(
                "OTA URL rejected: host '%s' not in allowed hosts %s",
                parsed.hostname,
                allowed_hosts,
            )
            return False
        return True
    except Exception as exc:
        logger.error("OTA URL validation error: %s", exc)
        return False


def download_update(url: str, dest: Path) -> Path:
    """Stream download new image to staging area."""
    if not _validate_ota_url(url):
        raise ValueError(f"OTA URL rejected by security policy: {url}")

    OTA_STAGING.mkdir(parents=True, exist_ok=True)
    image_path = OTA_STAGING / "update.img"

    logger.info("Downloading update from %s", url)
    req = Request(url, headers={"User-Agent": f"LIFO4-Edge/{os.getenv('SOFTWARE_VERSION','1.0.0')}"})
    total = 0
    with urlopen(req, timeout=120) as resp, open(image_path, "wb") as fp:
        while chunk := resp.read(DOWNLOAD_CHUNK_SIZE):
            fp.write(chunk)
            total += len(chunk)

    logger.info("Download complete: %.1f MB", total / 1_048_576)
    return image_path


def verify_checksum(image_path: Path, expected: str) -> bool:
    """Verify SHA-256 checksum. expected format: 'sha256:<hex>'"""
    if not expected.startswith("sha256:"):
        logger.error("Unsupported checksum algorithm: %s", expected)
        return False

    expected_hex = expected[len("sha256:"):]
    sha256 = hashlib.sha256()

    with open(image_path, "rb") as fp:
        while chunk := fp.read(65536):
            sha256.update(chunk)

    actual_hex = sha256.hexdigest()
    if actual_hex == expected_hex:
        logger.info("Checksum OK: %s", actual_hex)
        return True
    logger.error("Checksum MISMATCH: expected=%s actual=%s", expected_hex, actual_hex)
    return False


def verify_signature(image_path: Path, signature_b64: Optional[str]) -> bool:
    """Verify digital signature using Ed25519 public key.

    Security policy:
    - In production (OTA_ALLOW_UNSIGNED not set): missing signature or missing key = REJECT.
    - In development (OTA_ALLOW_UNSIGNED=true): unsigned packages are accepted with a warning.
    """
    allow_unsigned = os.getenv("OTA_ALLOW_UNSIGNED", "false").lower() == "true"

    if not signature_b64:
        if allow_unsigned:
            logger.warning(
                "INSECURE: OTA package has no signature but OTA_ALLOW_UNSIGNED=true is set. "
                "Never use this in production."
            )
            return True
        logger.error(
            "OTA rejected: package has no digital signature. "
            "Set OTA_ALLOW_UNSIGNED=true only in development environments."
        )
        return False

    if not SIGNING_PUBLIC_KEY.exists():
        if allow_unsigned:
            logger.warning(
                "INSECURE: Signing public key not found at %s but OTA_ALLOW_UNSIGNED=true. "
                "Skipping verification — development only.",
                SIGNING_PUBLIC_KEY,
            )
            return True
        logger.error(
            "OTA rejected: signing public key not found at %s. "
            "Deploy the key or set OTA_ALLOW_UNSIGNED=true for development.",
            SIGNING_PUBLIC_KEY,
        )
        return False

    try:
        import base64
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey  # type: ignore
        from cryptography.hazmat.primitives.serialization import load_pem_public_key  # type: ignore

        pub_key_pem = SIGNING_PUBLIC_KEY.read_bytes()
        public_key: Ed25519PublicKey = load_pem_public_key(pub_key_pem)  # type: ignore
        signature = base64.b64decode(signature_b64)
        image_data = image_path.read_bytes()
        public_key.verify(signature, image_data)
        logger.info("Digital signature verified OK")
        return True
    except Exception as exc:
        logger.error("Signature verification FAILED: %s", exc)
        return False


# ---------------------------------------------------------------------------
# Partition management
# ---------------------------------------------------------------------------


def get_active_partition() -> Path:
    if ACTIVE_MARKER.exists():
        name = ACTIVE_MARKER.read_text().strip()
        return PARTITION_A if name == "a" else PARTITION_B
    return PARTITION_A  # default


def get_inactive_partition() -> Path:
    active = get_active_partition()
    return PARTITION_B if active == PARTITION_A else PARTITION_A


def install_to_partition(image_path: Path, target: Path) -> None:
    """Extract/install update image into the target partition."""
    logger.info("Installing image into %s", target)
    target.mkdir(parents=True, exist_ok=True)

    # For tarball images, extract directly
    if str(image_path).endswith((".tar.gz", ".tgz")):
        subprocess.run(
            ["tar", "-xzf", str(image_path), "-C", str(target)],
            check=True,
            timeout=120,
        )
    elif str(image_path).endswith(".img"):
        # Raw image: copy as-is for dd-style deployment
        shutil.copy2(str(image_path), str(target / "update.img"))
    else:
        # Zip or directory
        shutil.copy2(str(image_path), str(target / "update.img"))

    logger.info("Installation to %s complete", target)


def switch_active_partition(target: Path) -> None:
    """Update active marker to point at the target partition."""
    name = "a" if target == PARTITION_A else "b"
    ACTIVE_MARKER.parent.mkdir(parents=True, exist_ok=True)
    ACTIVE_MARKER.write_text(name)
    logger.info("Active partition set to: %s", name.upper())


# ---------------------------------------------------------------------------
# Healthcheck after reboot
# ---------------------------------------------------------------------------


def run_healthcheck(mqtt_client: mqtt.Client) -> HealthStatus:
    """
    Verify all critical subsystems are operational after update.
    """
    logger.info("Running post-update healthchecks")

    control_loop_ok = _check_control_loop()
    modbus_ok = _check_modbus()
    mqtt_ok = mqtt_client.is_connected()
    safety_ok = _check_safety_manager()

    status = HealthStatus(
        control_loop_ok=control_loop_ok,
        modbus_ok=modbus_ok,
        mqtt_ok=mqtt_ok,
        safety_manager_ok=safety_ok,
    )

    logger.info(
        "Healthcheck — control_loop=%s modbus=%s mqtt=%s safety=%s → all_ok=%s",
        control_loop_ok,
        modbus_ok,
        mqtt_ok,
        safety_ok,
        status.all_ok,
    )
    return status


def _check_control_loop() -> bool:
    """Verify control loop process is running."""
    pid_file = Path("/data/runtime/control_loop.pid")
    if not pid_file.exists():
        return False
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 0)  # Signal 0 = check existence only
        return True
    except (ValueError, OSError):
        return False


def _check_modbus() -> bool:
    """Quick Modbus TCP connectivity check."""
    modbus_host_file = Path("/data/config/device.json")
    if not modbus_host_file.exists():
        return False
    try:
        config = json.loads(modbus_host_file.read_text())
        modbus_cfg = config.get("modbus_config", {})
        host = modbus_cfg.get("host", "192.168.1.10")
        port = modbus_cfg.get("port", 502)

        import socket as _socket
        with _socket.create_connection((host, port), timeout=3):
            pass
        return True
    except Exception:
        return False


def _check_safety_manager() -> bool:
    """Verify safety manager process is running."""
    pid_file = Path("/data/runtime/safety_manager.pid")
    if not pid_file.exists():
        return False
    try:
        pid = int(pid_file.read_text().strip())
        os.kill(pid, 0)
        return True
    except (ValueError, OSError):
        return False


# ---------------------------------------------------------------------------
# Main OTA updater
# ---------------------------------------------------------------------------


class OtaUpdater:
    def __init__(self, mqtt_client: mqtt.Client) -> None:
        self.mqtt = mqtt_client
        self.state = OtaState.IDLE
        self._pending_package: Optional[UpdatePackage] = None
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def handle_update_notification(self, payload: dict) -> None:
        """Called when cloud publishes an OTA update notification."""
        try:
            pkg = UpdatePackage(
                version=payload["version"],
                url=payload["url"],
                checksum=payload["checksum"],
                signature=payload.get("signature"),
                release_notes=payload.get("release_notes", ""),
            )
            logger.info("Update available: v%s", pkg.version)
            self._schedule_update(pkg)
        except KeyError as exc:
            logger.error("Invalid OTA payload — missing field: %s", exc)

    def apply_staged_update(self) -> None:
        """
        Called after reboot into new partition to complete the OTA process.
        Runs healthcheck; commits or rolls back.
        """
        logger.info("Post-reboot: running healthcheck for OTA commit/rollback")
        self.state = OtaState.HEALTHCHECK

        deadline = time.time() + HEALTHCHECK_TIMEOUT_S
        while time.time() < deadline:
            health = run_healthcheck(self.mqtt)
            if health.all_ok:
                self._commit_update()
                return
            logger.warning("Healthcheck not yet passing — retrying in 15s")
            time.sleep(15)

        logger.error("Healthcheck timeout — rolling back")
        self._rollback()

    # ------------------------------------------------------------------
    # Internal steps
    # ------------------------------------------------------------------

    def _schedule_update(self, pkg: UpdatePackage) -> None:
        """Schedule update for next maintenance window."""
        if is_in_maintenance_window():
            logger.info("In maintenance window — starting update immediately")
            threading.Thread(target=self._execute_update, args=(pkg,), daemon=True).start()
        else:
            wait_s = seconds_until_maintenance_window()
            logger.info("Not in maintenance window — update scheduled in %dm", wait_s // 60)
            timer = threading.Timer(wait_s, self._execute_update, args=(pkg,))
            timer.daemon = True
            timer.start()

    def _execute_update(self, pkg: UpdatePackage) -> None:
        with self._lock:
            # Safety gate
            safe, reason = is_safe_to_update()
            if not safe:
                logger.warning("Update blocked — %s — rescheduling in 15min", reason)
                timer = threading.Timer(900, self._execute_update, args=(pkg,))
                timer.daemon = True
                timer.start()
                return

            self.state = OtaState.DOWNLOADING
            self._report_status("DOWNLOADING", pkg.version)

            try:
                image_path = download_update(pkg.url, OTA_STAGING)
            except Exception as exc:
                logger.error("Download failed: %s", exc)
                self.state = OtaState.FAILED
                self._report_status("DOWNLOAD_FAILED", pkg.version)
                return

            self.state = OtaState.VERIFYING

            if not verify_checksum(image_path, pkg.checksum):
                self.state = OtaState.FAILED
                self._report_status("CHECKSUM_FAILED", pkg.version)
                return

            if not verify_signature(image_path, pkg.signature):
                self.state = OtaState.FAILED
                self._report_status("SIGNATURE_FAILED", pkg.version)
                return

            self.state = OtaState.INSTALLING
            self._report_status("INSTALLING", pkg.version)

            try:
                inactive = get_inactive_partition()
                install_to_partition(image_path, inactive)
                switch_active_partition(inactive)
            except Exception as exc:
                logger.error("Installation failed: %s", exc)
                self.state = OtaState.FAILED
                self._report_status("INSTALL_FAILED", pkg.version)
                return

            # Write version marker so post-reboot can identify this as an OTA reboot
            ota_marker = Path("/data/ota/pending_version.txt")
            ota_marker.parent.mkdir(parents=True, exist_ok=True)
            ota_marker.write_text(pkg.version)

            logger.info("Rebooting into new partition")
            self.state = OtaState.REBOOTING
            self._report_status("REBOOTING", pkg.version)
            time.sleep(2)
            try:
                subprocess.run(["reboot"], check=True, timeout=10)
            except subprocess.TimeoutExpired:
                logger.error("Reboot command timed out — trying fallback")
                subprocess.run(["shutdown", "-r", "now"], check=False, timeout=5)
            except subprocess.CalledProcessError as exc:
                logger.error("Reboot failed with exit code %d", exc.returncode)

    def _commit_update(self) -> None:
        self.state = OtaState.COMMITTED
        version = Path("/data/ota/pending_version.txt").read_text().strip()
        logger.info("OTA commit: v%s is now the active version", version)
        Path("/data/ota/pending_version.txt").unlink(missing_ok=True)
        # Update the running version marker
        Path("/data/config/version.txt").write_text(version)
        self._report_status("UPDATE_SUCCESS", version)

    def _rollback(self) -> None:
        self.state = OtaState.ROLLED_BACK
        # Switch back to previous partition
        inactive = get_inactive_partition()
        switch_active_partition(inactive)
        version = Path("/data/ota/pending_version.txt").read_text(
            errors="replace"
        ).strip()
        logger.error("Rollback executed — returning to previous partition")
        self._report_status("ROLLBACK_EXECUTED", version)
        time.sleep(2)
        try:
            subprocess.run(["reboot"], check=True, timeout=10)
        except subprocess.TimeoutExpired:
            logger.error("Rollback reboot timed out — trying fallback")
            subprocess.run(["shutdown", "-r", "now"], check=False, timeout=5)
        except subprocess.CalledProcessError as exc:
            logger.error("Rollback reboot failed with exit code %d", exc.returncode)

    def _report_status(self, status: str, version: str) -> None:
        topic = f"lifo4/{SYSTEM_ID}/ota/status"
        payload = {
            "status": status,
            "version": version,
            "active_partition": str(get_active_partition()),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        try:
            self.mqtt.publish(topic, json.dumps(payload), qos=1)
        except Exception as exc:
            logger.warning("Could not report OTA status: %s", exc)


# ---------------------------------------------------------------------------
# Standalone entry point (used during post-reboot healthcheck phase)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.INFO)

    if "--post-reboot" in sys.argv:
        logger.info("Post-reboot mode: verifying OTA update")
        pending = Path("/data/ota/pending_version.txt")
        if not pending.exists():
            logger.info("No pending OTA — nothing to verify")
            sys.exit(0)

        client = mqtt.Client(client_id=f"ota-{SYSTEM_ID}", protocol=mqtt.MQTTv5)
        client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT)
        client.loop_start()

        updater = OtaUpdater(client)
        updater.apply_staged_update()

        client.loop_stop()
    else:
        logger.info("OTA Updater loaded — waiting for MQTT update notifications")
