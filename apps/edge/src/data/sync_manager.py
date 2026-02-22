"""
Sync manager: sends locally buffered data to cloud when online.
"""
from __future__ import annotations

from src.data.local_db import LocalDatabase
from src.communication.mqtt_client import EdgeMqttClient
from src.utils.logger import get_logger

logger = get_logger(__name__)


class SyncManager:
    def __init__(self, db: LocalDatabase, mqtt: EdgeMqttClient):
        self._db = db
        self._mqtt = mqtt

    async def sync(self, telemetry_snapshot: object) -> None:
        """Publish current telemetry and flush sync queue."""
        # Publish current reading
        await self._mqtt.publish_telemetry({
            "soc": telemetry_snapshot.soc,
            "soh": telemetry_snapshot.soh,
            "voltage": telemetry_snapshot.voltage,
            "current": telemetry_snapshot.current,
            "power_kw": telemetry_snapshot.power_kw,
            "temp_min": telemetry_snapshot.temp_min,
            "temp_max": telemetry_snapshot.temp_max,
            "temp_avg": telemetry_snapshot.temp_avg,
            "frequency": telemetry_snapshot.frequency,
            "grid_voltage": telemetry_snapshot.grid_voltage,
        })

        # Flush buffered sync queue (offline messages)
        pending = await self._db.get_pending_sync(limit=50)
        if not pending:
            return

        flushed_ids = []
        for item in pending:
            import json
            payload = json.loads(item["payload"])
            if item["topic"].endswith("/alarms"):
                await self._mqtt.publish_alarm(payload)
            elif item["topic"].endswith("/decisions"):
                await self._mqtt.publish_decision(payload)
            flushed_ids.append(item["id"])

        if flushed_ids:
            await self._db.mark_synced(flushed_ids)
            logger.info("sync_manager_flushed", count=len(flushed_ids))
