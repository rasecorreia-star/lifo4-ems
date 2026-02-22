"""
Zero-Touch Provisioning Bootstrap for LIFO4 Edge Controller

Flow:
    1. Technician installs hardware (edge controller + BESS + cables)
    2. Technician connects edge controller to network (Ethernet or WiFi)
    3. Edge controller boots and runs this bootstrap:
       a. Generate unique identity (MAC + serial)
       b. Connect to MQTT broker with bootstrap certificate (generic, registration-only)
       c. Publish registration payload to lifo4/provisioning/register
       d. Wait for cloud config response
       e. Save config, swap MQTT certificate to the permanent one
       f. Run Modbus device discovery
       g. Report: "Provisioned and operational"
    4. Cloud automatically:
       a. Creates system in PostgreSQL
       b. Assigns to organization
       c. Configures default alerts
       d. Starts 7-day baseline period
       e. After baseline: activates optimization

Total time: ~5 minutes after boot
Human intervention: ZERO (technician only installs hardware)
"""

import hashlib
import json
import logging
import os
import socket
import subprocess
import time
import uuid
from dataclasses import asdict, dataclass
from enum import Enum
from pathlib import Path
from typing import Optional

import paho.mqtt.client as mqtt

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("bootstrap")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MQTT_BROKER_HOST = os.getenv("MQTT_BROKER_HOST", "mqtt.lifo4.com.br")
MQTT_BROKER_PORT = int(os.getenv("MQTT_BROKER_PORT", "8883"))
BOOTSTRAP_CERT_PATH = Path(os.getenv("BOOTSTRAP_CERT_PATH", "/certs/bootstrap"))
PERMANENT_CERT_PATH = Path(os.getenv("PERMANENT_CERT_PATH", "/certs/device"))
CONFIG_PATH = Path(os.getenv("CONFIG_PATH", "/data/config/device.json"))
PROVISIONING_TIMEOUT_S = int(os.getenv("PROVISIONING_TIMEOUT_S", "300"))  # 5 min

TOPIC_REGISTER = "lifo4/provisioning/register"
TOPIC_CONFIG_PREFIX = "lifo4/provisioning"


# ---------------------------------------------------------------------------
# Data models
# ---------------------------------------------------------------------------


class ProvisioningState(Enum):
    INIT = "INIT"
    CONNECTING = "CONNECTING"
    REGISTERING = "REGISTERING"
    WAITING_CONFIG = "WAITING_CONFIG"
    CONFIGURING = "CONFIGURING"
    DISCOVERING = "DISCOVERING"
    OPERATIONAL = "OPERATIONAL"
    FAILED = "FAILED"


@dataclass
class HardwareInfo:
    mac_address: str
    serial_number: str
    hardware_model: str
    cpu_cores: int
    memory_mb: int
    storage_gb: int


@dataclass
class RegistrationPayload:
    edge_id: str
    mac_address: str
    hardware: str
    software_version: str
    ip_address: str
    timestamp: str
    serial_number: str
    capabilities: list


@dataclass
class CloudConfig:
    site_id: str
    system_id: str
    organization_id: str
    modbus_config: dict
    mqtt_config: dict
    optimization_config: dict
    safety_limits: dict


# ---------------------------------------------------------------------------
# Hardware detection helpers
# ---------------------------------------------------------------------------


def get_mac_address() -> str:
    """Return the primary network interface MAC address."""
    try:
        # Try to get from /sys/class/net (Linux)
        for iface in ["eth0", "enp1s0", "ens3", "wlan0"]:
            mac_file = Path(f"/sys/class/net/{iface}/address")
            if mac_file.exists():
                return mac_file.read_text().strip().upper()
    except Exception:
        pass
    # Fallback: use uuid node
    mac_int = uuid.getnode()
    return ":".join(f"{(mac_int >> (8 * i)) & 0xFF:02X}" for i in range(5, -1, -1))


def get_serial_number() -> str:
    """Return hardware serial number (Jetson or RPi)."""
    try:
        result = subprocess.run(
            ["cat", "/proc/cpuinfo"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        for line in result.stdout.splitlines():
            if "Serial" in line:
                return line.split(":")[-1].strip()
    except Exception:
        pass
    # Stable fallback based on MAC
    return hashlib.sha256(get_mac_address().encode()).hexdigest()[:16].upper()


def get_hardware_model() -> str:
    """Detect hardware platform."""
    try:
        model_file = Path("/proc/device-tree/model")
        if model_file.exists():
            return model_file.read_text().strip().replace("\x00", "")
    except Exception:
        pass
    return "generic-x86"


def get_local_ip() -> str:
    """Return outbound IP address."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"


def get_software_version() -> str:
    version_file = Path("/data/config/version.txt")
    if version_file.exists():
        return version_file.read_text().strip()
    return os.getenv("SOFTWARE_VERSION", "1.0.0")


def build_edge_id(mac: str, serial: str) -> str:
    """Deterministic edge ID from MAC + serial."""
    raw = f"{mac}-{serial}"
    short = hashlib.sha256(raw.encode()).hexdigest()[:12]
    return f"edge-{short}"


# ---------------------------------------------------------------------------
# Modbus device discovery
# ---------------------------------------------------------------------------


def discover_modbus_devices(modbus_config: dict) -> list:
    """
    Scan Modbus TCP holding registers to detect BMS/PCS devices.
    Returns list of discovered device descriptors.
    """
    try:
        from pymodbus.client import ModbusTcpClient  # type: ignore

        host = modbus_config.get("host", "192.168.1.10")
        port = modbus_config.get("port", 502)
        discovered = []

        client = ModbusTcpClient(host, port=port, timeout=3)
        if client.connect():
            logger.info("Modbus TCP connected to %s:%s", host, port)
            # Probe unit IDs 1-10
            for unit_id in range(1, 11):
                try:
                    result = client.read_holding_registers(0, count=10, slave=unit_id)
                    if not result.isError():
                        discovered.append(
                            {
                                "unit_id": unit_id,
                                "type": "holding_registers",
                                "register_count": 10,
                            }
                        )
                        logger.info("  Found device at unit_id=%d", unit_id)
                except Exception:
                    pass
            client.close()
        return discovered
    except ImportError:
        logger.warning("pymodbus not installed — skipping Modbus discovery")
        return []


# ---------------------------------------------------------------------------
# Certificate management
# ---------------------------------------------------------------------------


def install_permanent_certificates(mqtt_config: dict) -> None:
    """Write permanent client cert/key received from cloud."""
    PERMANENT_CERT_PATH.mkdir(parents=True, exist_ok=True)

    cert_pem = mqtt_config.get("client_cert", "")
    key_pem = mqtt_config.get("client_key", "")

    if cert_pem:
        (PERMANENT_CERT_PATH / "client.crt").write_text(cert_pem)
    if key_pem:
        (PERMANENT_CERT_PATH / "client.key").write_text(key_pem)

    logger.info("Permanent certificates installed at %s", PERMANENT_CERT_PATH)


def save_device_config(config: CloudConfig, edge_id: str) -> None:
    """Persist received config to disk."""
    CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "edge_id": edge_id,
        "provisioned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        **asdict(config),
    }
    CONFIG_PATH.write_text(json.dumps(data, indent=2))
    logger.info("Device config saved to %s", CONFIG_PATH)


def load_existing_config() -> Optional[dict]:
    """Return saved config if already provisioned."""
    if CONFIG_PATH.exists():
        try:
            data = json.loads(CONFIG_PATH.read_text())
            logger.info("Existing config found — already provisioned as %s", data.get("edge_id"))
            return data
        except Exception:
            logger.warning("Corrupt config file — re-provisioning")
    return None


# ---------------------------------------------------------------------------
# Main bootstrap orchestrator
# ---------------------------------------------------------------------------


class BootstrapOrchestrator:
    def __init__(self) -> None:
        self.state = ProvisioningState.INIT
        self.cloud_config: Optional[CloudConfig] = None
        self.edge_id: str = ""
        self._mqtt_client: Optional[mqtt.Client] = None
        self._config_received = False

    # ------------------------------------------------------------------
    # MQTT callbacks
    # ------------------------------------------------------------------

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        if rc == 0:
            logger.info("MQTT connected (bootstrap cert)")
            # Subscribe to our personal provisioning topic
            topic = f"{TOPIC_CONFIG_PREFIX}/{self.edge_id}/config"
            client.subscribe(topic, qos=1)
            logger.info("Subscribed to %s", topic)
        else:
            logger.error("MQTT connection failed: rc=%d", rc)

    def _on_message(self, client, userdata, msg):
        logger.info("Message on %s", msg.topic)
        try:
            payload = json.loads(msg.payload.decode())
            self.cloud_config = CloudConfig(
                site_id=payload["site_id"],
                system_id=payload["system_id"],
                organization_id=payload["organization_id"],
                modbus_config=payload.get("modbus_config", {}),
                mqtt_config=payload.get("mqtt_config", {}),
                optimization_config=payload.get("optimization_config", {}),
                safety_limits=payload.get("safety_limits", {}),
            )
            self._config_received = True
            logger.info(
                "Cloud config received — site=%s system=%s org=%s",
                self.cloud_config.site_id,
                self.cloud_config.system_id,
                self.cloud_config.organization_id,
            )
        except Exception as exc:
            logger.error("Failed to parse cloud config: %s", exc)

    # ------------------------------------------------------------------
    # Steps
    # ------------------------------------------------------------------

    def _build_mqtt_client(self) -> mqtt.Client:
        client = mqtt.Client(client_id=self.edge_id, protocol=mqtt.MQTTv5)
        client.on_connect = self._on_connect
        client.on_message = self._on_message

        ca_cert = BOOTSTRAP_CERT_PATH / "ca.crt"
        client_cert = BOOTSTRAP_CERT_PATH / "client.crt"
        client_key = BOOTSTRAP_CERT_PATH / "client.key"

        if ca_cert.exists() and client_cert.exists() and client_key.exists():
            client.tls_set(
                ca_certs=str(ca_cert),
                certfile=str(client_cert),
                keyfile=str(client_key),
            )
        else:
            logger.warning("Bootstrap certs not found — using plain MQTT (dev mode)")

        return client

    def _connect_mqtt(self) -> bool:
        self.state = ProvisioningState.CONNECTING
        logger.info("Connecting to MQTT broker %s:%d", MQTT_BROKER_HOST, MQTT_BROKER_PORT)
        try:
            self._mqtt_client = self._build_mqtt_client()
            self._mqtt_client.connect(MQTT_BROKER_HOST, MQTT_BROKER_PORT, keepalive=60)
            self._mqtt_client.loop_start()
            # Wait up to 10s for connection
            for _ in range(20):
                time.sleep(0.5)
                if self._mqtt_client.is_connected():
                    return True
            logger.error("MQTT connection timeout")
            return False
        except Exception as exc:
            logger.error("MQTT connection error: %s", exc)
            return False

    def _register(self, hw: HardwareInfo) -> None:
        self.state = ProvisioningState.REGISTERING
        payload = RegistrationPayload(
            edge_id=self.edge_id,
            mac_address=hw.mac_address,
            hardware=hw.hardware_model,
            software_version=get_software_version(),
            ip_address=get_local_ip(),
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            serial_number=hw.serial_number,
            capabilities=["modbus-tcp", "mqtt", "sqlite", "edge-ml"],
        )
        self._mqtt_client.publish(
            TOPIC_REGISTER,
            json.dumps(asdict(payload)),
            qos=1,
        )
        logger.info("Registration published for edge_id=%s", self.edge_id)

    def _wait_for_config(self) -> bool:
        self.state = ProvisioningState.WAITING_CONFIG
        logger.info("Waiting for cloud config (timeout=%ds)", PROVISIONING_TIMEOUT_S)
        deadline = time.time() + PROVISIONING_TIMEOUT_S
        while time.time() < deadline:
            if self._config_received:
                return True
            time.sleep(1)
        logger.error("Timeout waiting for cloud config")
        return False

    def _apply_config(self) -> None:
        self.state = ProvisioningState.CONFIGURING
        assert self.cloud_config is not None
        install_permanent_certificates(self.cloud_config.mqtt_config)
        save_device_config(self.cloud_config, self.edge_id)

    def _discover_devices(self) -> list:
        self.state = ProvisioningState.DISCOVERING
        assert self.cloud_config is not None
        return discover_modbus_devices(self.cloud_config.modbus_config)

    def _report_operational(self, devices: list) -> None:
        self.state = ProvisioningState.OPERATIONAL
        assert self.cloud_config is not None
        status_topic = f"lifo4/{self.cloud_config.system_id}/status"
        status = {
            "edge_id": self.edge_id,
            "status": "PROVISIONED_AND_OPERATIONAL",
            "discovered_devices": devices,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        self._mqtt_client.publish(status_topic, json.dumps(status), qos=1)
        logger.info("Reported OPERATIONAL — system_id=%s", self.cloud_config.system_id)

    # ------------------------------------------------------------------
    # Main entrypoint
    # ------------------------------------------------------------------

    def run(self) -> bool:
        """
        Execute full provisioning flow.
        Returns True if successful, False otherwise.
        """
        logger.info("=== LIFO4 Edge Bootstrap v%s ===", get_software_version())

        # Skip if already provisioned
        existing = load_existing_config()
        if existing:
            logger.info("Device already provisioned — skipping bootstrap")
            return True

        # Gather hardware info
        mac = get_mac_address()
        serial = get_serial_number()
        self.edge_id = build_edge_id(mac, serial)

        hw = HardwareInfo(
            mac_address=mac,
            serial_number=serial,
            hardware_model=get_hardware_model(),
            cpu_cores=os.cpu_count() or 1,
            memory_mb=int(os.popen("free -m | awk '/Mem:/{print $2}'").read().strip() or 0),
            storage_gb=0,  # optional
        )

        logger.info("Edge ID: %s | MAC: %s | HW: %s", self.edge_id, mac, hw.hardware_model)

        # MQTT connect
        if not self._connect_mqtt():
            self.state = ProvisioningState.FAILED
            return False

        # Register
        self._register(hw)

        # Wait for cloud config
        if not self._wait_for_config():
            self.state = ProvisioningState.FAILED
            self._mqtt_client.loop_stop()
            return False

        # Apply config
        self._apply_config()

        # Modbus discovery
        devices = self._discover_devices()
        logger.info("Discovered %d Modbus device(s)", len(devices))

        # Report operational
        self._report_operational(devices)

        self._mqtt_client.loop_stop()
        logger.info("Bootstrap complete in state=%s", self.state.value)
        return True


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    orchestrator = BootstrapOrchestrator()
    success = orchestrator.run()
    exit(0 if success else 1)
