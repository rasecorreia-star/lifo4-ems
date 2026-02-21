"""
Device Manager Service
Manages discovered and configured devices
"""

import asyncio
import logging
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class DeviceManager:
    """Manages edge devices (BMS, inverters, meters)."""

    def __init__(self):
        self.devices: Dict[str, dict] = {}
        self.device_status: Dict[str, dict] = {}

    def register_device(
        self,
        device_id: str,
        device_type: str,
        connection_type: str,
        config: dict,
    ):
        """Register a device."""
        self.devices[device_id] = {
            "device_id": device_id,
            "device_type": device_type,
            "connection_type": connection_type,
            "config": config,
            "registered_at": datetime.utcnow().isoformat(),
        }

        self.device_status[device_id] = {
            "online": False,
            "last_seen": None,
            "error_count": 0,
            "last_error": None,
        }

        logger.info(f"Registered device: {device_id} ({device_type})")

    def unregister_device(self, device_id: str):
        """Unregister a device."""
        self.devices.pop(device_id, None)
        self.device_status.pop(device_id, None)
        logger.info(f"Unregistered device: {device_id}")

    def update_device_status(
        self,
        device_id: str,
        online: bool,
        error: Optional[str] = None,
    ):
        """Update device status."""
        if device_id not in self.device_status:
            return

        status = self.device_status[device_id]
        status["online"] = online
        status["last_seen"] = datetime.utcnow().isoformat() if online else status["last_seen"]

        if error:
            status["error_count"] += 1
            status["last_error"] = error
        elif online:
            status["error_count"] = 0
            status["last_error"] = None

    def get_device(self, device_id: str) -> Optional[dict]:
        """Get device configuration."""
        device = self.devices.get(device_id)
        if device:
            return {
                **device,
                "status": self.device_status.get(device_id, {}),
            }
        return None

    async def list_devices(self) -> dict:
        """List all registered devices."""
        devices = []
        for device_id, device in self.devices.items():
            devices.append({
                **device,
                "status": self.device_status.get(device_id, {}),
            })

        # Summary
        online_count = sum(1 for s in self.device_status.values() if s.get("online"))

        return {
            "devices": devices,
            "summary": {
                "total": len(devices),
                "online": online_count,
                "offline": len(devices) - online_count,
            },
        }

    def get_devices_by_type(self, device_type: str) -> List[dict]:
        """Get devices of a specific type."""
        return [
            {**d, "status": self.device_status.get(d["device_id"], {})}
            for d in self.devices.values()
            if d["device_type"] == device_type
        ]

    def get_online_devices(self) -> List[str]:
        """Get list of online device IDs."""
        return [
            device_id
            for device_id, status in self.device_status.items()
            if status.get("online")
        ]

    def get_offline_devices(self, timeout_minutes: int = 5) -> List[str]:
        """Get devices that haven't reported recently."""
        cutoff = datetime.utcnow() - timedelta(minutes=timeout_minutes)
        offline = []

        for device_id, status in self.device_status.items():
            last_seen = status.get("last_seen")
            if not last_seen:
                offline.append(device_id)
            elif datetime.fromisoformat(last_seen) < cutoff:
                offline.append(device_id)

        return offline
