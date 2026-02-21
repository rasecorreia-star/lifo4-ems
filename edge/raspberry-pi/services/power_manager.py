"""
Raspberry Pi Power Manager
Implements power saving strategies for edge gateway devices.

Power Modes:
- ACTIVE: Full operation (~600mA)
- POWER_SAVE: Reduced CPU, minimal services (~300mA)
- DEEP_SAVE: Minimum operation (~150mA)
- STANDBY: WiFi off, GPIO wake (~50mA)
"""

import os
import time
import json
import logging
import threading
import subprocess
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime, timedelta
from pathlib import Path

logger = logging.getLogger(__name__)


class PowerMode(Enum):
    """Power operation modes"""
    ACTIVE = "active"           # Full operation
    POWER_SAVE = "power_save"   # Reduced CPU frequency
    DEEP_SAVE = "deep_save"     # Minimum services
    STANDBY = "standby"         # WiFi off, waiting for wake


@dataclass
class PowerConfig:
    """Power manager configuration"""
    # CPU settings
    active_cpu_freq: int = 1500  # MHz
    power_save_cpu_freq: int = 600  # MHz
    deep_save_cpu_freq: int = 400  # MHz

    # Timeouts
    idle_timeout_s: int = 60
    power_save_timeout_s: int = 300
    deep_save_timeout_s: int = 900

    # Wake sources
    wake_gpio_pin: int = 17
    alert_gpio_pin: int = 27

    # Telemetry
    telemetry_interval_active_s: int = 5
    telemetry_interval_save_s: int = 60
    telemetry_interval_deep_s: int = 300

    # Services to stop in deep save
    services_to_stop: List[str] = field(default_factory=lambda: [
        "bluetooth", "cups", "avahi-daemon"
    ])

    # Critical services (never stop)
    critical_services: List[str] = field(default_factory=lambda: [
        "ssh", "mosquitto", "networking"
    ])


@dataclass
class PowerStats:
    """Power statistics"""
    current_mode: PowerMode = PowerMode.ACTIVE
    mode_transitions: int = 0
    last_activity: datetime = field(default_factory=datetime.now)
    uptime_s: float = 0
    cpu_temp_c: float = 0
    cpu_freq_mhz: int = 0
    memory_usage_percent: float = 0
    estimated_power_mw: float = 0
    wake_count: int = 0
    last_wake_reason: str = "boot"


class TelemetryBuffer:
    """Buffer for storing telemetry during low power modes"""

    def __init__(self, max_size: int = 1000):
        self.max_size = max_size
        self.buffer: List[Dict[str, Any]] = []
        self.lock = threading.Lock()
        self.file_path = Path("/tmp/telemetry_buffer.json")

    def add(self, data: Dict[str, Any]) -> bool:
        with self.lock:
            if len(self.buffer) >= self.max_size:
                # Remove oldest
                self.buffer.pop(0)

            self.buffer.append({
                "timestamp": datetime.now().isoformat(),
                "data": data
            })
            return True

    def get_all(self) -> List[Dict[str, Any]]:
        with self.lock:
            return self.buffer.copy()

    def clear(self):
        with self.lock:
            self.buffer.clear()

    def persist(self):
        """Save buffer to disk before deep sleep"""
        with self.lock:
            with open(self.file_path, 'w') as f:
                json.dump(self.buffer, f)

    def restore(self):
        """Restore buffer from disk after wake"""
        try:
            if self.file_path.exists():
                with open(self.file_path, 'r') as f:
                    self.buffer = json.load(f)
                self.file_path.unlink()
        except Exception as e:
            logger.error(f"Failed to restore buffer: {e}")


class PowerManager:
    """
    Raspberry Pi Power Manager

    Manages power consumption through:
    - CPU frequency scaling
    - Service management
    - GPIO wake interrupts
    - Telemetry buffering
    """

    def __init__(self, config: Optional[PowerConfig] = None):
        self.config = config or PowerConfig()
        self.stats = PowerStats()
        self.buffer = TelemetryBuffer()

        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._lock = threading.Lock()
        self._callbacks: List[Callable[[PowerMode, PowerMode], None]] = []

        # GPIO setup
        self._gpio_initialized = False
        self._setup_gpio()

        # Restore buffer if exists
        self.buffer.restore()

        logger.info("Power manager initialized")

    def _setup_gpio(self):
        """Setup GPIO for wake interrupts"""
        try:
            import RPi.GPIO as GPIO
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(self.config.wake_gpio_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            GPIO.setup(self.config.alert_gpio_pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)

            # Wake interrupt
            GPIO.add_event_detect(
                self.config.wake_gpio_pin,
                GPIO.FALLING,
                callback=self._on_wake_interrupt,
                bouncetime=300
            )

            # Alert interrupt
            GPIO.add_event_detect(
                self.config.alert_gpio_pin,
                GPIO.FALLING,
                callback=self._on_alert_interrupt,
                bouncetime=300
            )

            self._gpio_initialized = True
            logger.info("GPIO initialized for wake/alert detection")
        except ImportError:
            logger.warning("RPi.GPIO not available, GPIO features disabled")
        except Exception as e:
            logger.error(f"GPIO setup failed: {e}")

    def _on_wake_interrupt(self, channel):
        """Handle wake GPIO interrupt"""
        logger.info("Wake interrupt received")
        self.stats.wake_count += 1
        self.stats.last_wake_reason = "gpio"
        self.register_activity()

    def _on_alert_interrupt(self, channel):
        """Handle alert GPIO interrupt"""
        logger.warning("Alert interrupt received!")
        self.stats.wake_count += 1
        self.stats.last_wake_reason = "alert"
        # Force active mode on alert
        self.set_mode(PowerMode.ACTIVE)

    def start(self):
        """Start power manager background thread"""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info("Power manager started")

    def stop(self):
        """Stop power manager"""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Power manager stopped")

    def _run_loop(self):
        """Main processing loop"""
        while self._running:
            try:
                self._update_stats()
                self._check_transitions()
                time.sleep(1)
            except Exception as e:
                logger.error(f"Power manager error: {e}")

    def _update_stats(self):
        """Update power statistics"""
        self.stats.uptime_s = time.time() - self._get_boot_time()
        self.stats.cpu_temp_c = self._get_cpu_temp()
        self.stats.cpu_freq_mhz = self._get_cpu_freq()
        self.stats.memory_usage_percent = self._get_memory_usage()
        self.stats.estimated_power_mw = self._estimate_power()

    def _check_transitions(self):
        """Check if power mode should change"""
        idle_time = (datetime.now() - self.stats.last_activity).total_seconds()

        current = self.stats.current_mode

        if current == PowerMode.ACTIVE:
            if idle_time > self.config.idle_timeout_s:
                self.set_mode(PowerMode.POWER_SAVE)
        elif current == PowerMode.POWER_SAVE:
            if idle_time > self.config.power_save_timeout_s:
                self.set_mode(PowerMode.DEEP_SAVE)
        elif current == PowerMode.DEEP_SAVE:
            if idle_time > self.config.deep_save_timeout_s:
                self.set_mode(PowerMode.STANDBY)

    def set_mode(self, mode: PowerMode) -> bool:
        """Set power mode"""
        with self._lock:
            if mode == self.stats.current_mode:
                return True

            old_mode = self.stats.current_mode
            logger.info(f"Power mode: {old_mode.value} -> {mode.value}")

            success = self._apply_mode(mode)

            if success:
                self.stats.current_mode = mode
                self.stats.mode_transitions += 1

                # Notify callbacks
                for callback in self._callbacks:
                    try:
                        callback(old_mode, mode)
                    except Exception as e:
                        logger.error(f"Callback error: {e}")

            return success

    def _apply_mode(self, mode: PowerMode) -> bool:
        """Apply power mode settings"""
        try:
            if mode == PowerMode.ACTIVE:
                self._set_cpu_freq(self.config.active_cpu_freq)
                self._start_services()
                self._enable_wifi()

            elif mode == PowerMode.POWER_SAVE:
                self._set_cpu_freq(self.config.power_save_cpu_freq)
                self._disable_hdmi()

            elif mode == PowerMode.DEEP_SAVE:
                self._set_cpu_freq(self.config.deep_save_cpu_freq)
                self._stop_non_critical_services()
                self._disable_usb()
                self.buffer.persist()

            elif mode == PowerMode.STANDBY:
                self._set_cpu_freq(self.config.deep_save_cpu_freq)
                self._disable_wifi()
                self.buffer.persist()

            return True
        except Exception as e:
            logger.error(f"Failed to apply mode {mode.value}: {e}")
            return False

    def register_activity(self):
        """Register activity (resets idle timer)"""
        self.stats.last_activity = datetime.now()

        if self.stats.current_mode != PowerMode.ACTIVE:
            self.set_mode(PowerMode.ACTIVE)

    def buffer_telemetry(self, data: Dict[str, Any]) -> bool:
        """Buffer telemetry for batch send"""
        return self.buffer.add(data)

    def get_buffered_telemetry(self) -> List[Dict[str, Any]]:
        """Get all buffered telemetry"""
        return self.buffer.get_all()

    def clear_buffer(self):
        """Clear telemetry buffer"""
        self.buffer.clear()

    def add_mode_callback(self, callback: Callable[[PowerMode, PowerMode], None]):
        """Add callback for mode changes"""
        self._callbacks.append(callback)

    def get_stats(self) -> Dict[str, Any]:
        """Get power statistics"""
        return {
            "current_mode": self.stats.current_mode.value,
            "mode_transitions": self.stats.mode_transitions,
            "last_activity": self.stats.last_activity.isoformat(),
            "uptime_s": self.stats.uptime_s,
            "cpu_temp_c": self.stats.cpu_temp_c,
            "cpu_freq_mhz": self.stats.cpu_freq_mhz,
            "memory_usage_percent": self.stats.memory_usage_percent,
            "estimated_power_mw": self.stats.estimated_power_mw,
            "wake_count": self.stats.wake_count,
            "last_wake_reason": self.stats.last_wake_reason,
            "buffer_size": len(self.buffer.buffer)
        }

    def get_telemetry_interval(self) -> int:
        """Get telemetry interval for current mode"""
        mode = self.stats.current_mode

        if mode == PowerMode.ACTIVE:
            return self.config.telemetry_interval_active_s
        elif mode == PowerMode.POWER_SAVE:
            return self.config.telemetry_interval_save_s
        else:
            return self.config.telemetry_interval_deep_s

    # ============== Hardware control ==============

    def _set_cpu_freq(self, freq_mhz: int):
        """Set CPU frequency"""
        try:
            freq_khz = freq_mhz * 1000
            with open('/sys/devices/system/cpu/cpu0/cpufreq/scaling_setspeed', 'w') as f:
                f.write(str(freq_khz))
            logger.debug(f"CPU frequency set to {freq_mhz} MHz")
        except Exception as e:
            logger.warning(f"Could not set CPU freq: {e}")

    def _get_cpu_freq(self) -> int:
        """Get current CPU frequency"""
        try:
            with open('/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq', 'r') as f:
                return int(f.read().strip()) // 1000
        except:
            return 0

    def _get_cpu_temp(self) -> float:
        """Get CPU temperature"""
        try:
            with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
                return int(f.read().strip()) / 1000
        except:
            return 0

    def _get_memory_usage(self) -> float:
        """Get memory usage percentage"""
        try:
            with open('/proc/meminfo', 'r') as f:
                lines = f.readlines()
                total = int(lines[0].split()[1])
                available = int(lines[2].split()[1])
                return ((total - available) / total) * 100
        except:
            return 0

    def _get_boot_time(self) -> float:
        """Get system boot time"""
        try:
            with open('/proc/uptime', 'r') as f:
                return time.time() - float(f.read().split()[0])
        except:
            return time.time()

    def _estimate_power(self) -> float:
        """Estimate current power consumption"""
        mode = self.stats.current_mode
        base_power = {
            PowerMode.ACTIVE: 600,
            PowerMode.POWER_SAVE: 300,
            PowerMode.DEEP_SAVE: 150,
            PowerMode.STANDBY: 50
        }

        power = base_power.get(mode, 600)

        # Adjust for CPU temp (higher temp = more power)
        if self.stats.cpu_temp_c > 60:
            power *= 1.1

        return power

    def _disable_hdmi(self):
        """Disable HDMI output"""
        try:
            subprocess.run(['tvservice', '-o'], check=False, capture_output=True)
            logger.debug("HDMI disabled")
        except:
            pass

    def _enable_hdmi(self):
        """Enable HDMI output"""
        try:
            subprocess.run(['tvservice', '-p'], check=False, capture_output=True)
            logger.debug("HDMI enabled")
        except:
            pass

    def _disable_usb(self):
        """Disable USB ports"""
        try:
            # This works on Pi 4
            with open('/sys/devices/platform/soc/fd500000.pcie/power/control', 'w') as f:
                f.write('auto')
            logger.debug("USB power saving enabled")
        except:
            pass

    def _disable_wifi(self):
        """Disable WiFi"""
        try:
            subprocess.run(['rfkill', 'block', 'wifi'], check=False, capture_output=True)
            logger.debug("WiFi disabled")
        except:
            pass

    def _enable_wifi(self):
        """Enable WiFi"""
        try:
            subprocess.run(['rfkill', 'unblock', 'wifi'], check=False, capture_output=True)
            logger.debug("WiFi enabled")
        except:
            pass

    def _stop_non_critical_services(self):
        """Stop non-critical services"""
        for service in self.config.services_to_stop:
            try:
                subprocess.run(
                    ['systemctl', 'stop', service],
                    check=False, capture_output=True
                )
                logger.debug(f"Stopped service: {service}")
            except:
                pass

    def _start_services(self):
        """Restart stopped services"""
        for service in self.config.services_to_stop:
            try:
                subprocess.run(
                    ['systemctl', 'start', service],
                    check=False, capture_output=True
                )
                logger.debug(f"Started service: {service}")
            except:
                pass

    def __del__(self):
        """Cleanup"""
        self.stop()
        if self._gpio_initialized:
            try:
                import RPi.GPIO as GPIO
                GPIO.cleanup()
            except:
                pass


# Singleton instance
_power_manager: Optional[PowerManager] = None


def get_power_manager(config: Optional[PowerConfig] = None) -> PowerManager:
    """Get or create power manager singleton"""
    global _power_manager
    if _power_manager is None:
        _power_manager = PowerManager(config)
    return _power_manager


# CLI interface
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Power Manager CLI")
    parser.add_argument("command", choices=["status", "active", "save", "deep", "standby"])
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO)
    pm = get_power_manager()

    if args.command == "status":
        stats = pm.get_stats()
        print(json.dumps(stats, indent=2))
    elif args.command == "active":
        pm.set_mode(PowerMode.ACTIVE)
        print("Mode set to ACTIVE")
    elif args.command == "save":
        pm.set_mode(PowerMode.POWER_SAVE)
        print("Mode set to POWER_SAVE")
    elif args.command == "deep":
        pm.set_mode(PowerMode.DEEP_SAVE)
        print("Mode set to DEEP_SAVE")
    elif args.command == "standby":
        pm.set_mode(PowerMode.STANDBY)
        print("Mode set to STANDBY")
