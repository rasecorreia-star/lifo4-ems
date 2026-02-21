"""
Cloud Synchronization Service
Syncs local data with Lifo4 cloud when connection available
"""

import asyncio
import logging
from typing import Optional, List
from datetime import datetime

import httpx

from services.data_buffer import DataBuffer

logger = logging.getLogger(__name__)


class CloudSync:
    """Handles synchronization with cloud API."""

    def __init__(
        self,
        api_url: str,
        api_key: Optional[str],
        data_buffer: DataBuffer,
        batch_size: int = 100,
        timeout: float = 30.0,
    ):
        self.api_url = api_url.rstrip("/")
        self.api_key = api_key
        self.data_buffer = data_buffer
        self.batch_size = batch_size
        self.timeout = timeout

        self.is_syncing = False
        self.last_sync: Optional[datetime] = None
        self.sync_errors = 0

    async def sync_pending_data(self) -> int:
        """Sync all pending telemetry data to cloud."""
        if self.is_syncing:
            logger.debug("Sync already in progress")
            return 0

        self.is_syncing = True
        synced_count = 0

        try:
            # Get pending records
            pending = await self.data_buffer.get_pending_telemetry(self.batch_size)

            if not pending:
                return 0

            logger.info(f"Syncing {len(pending)} records to cloud...")

            # Group by device
            by_device = {}
            for record in pending:
                device_id = record["device_id"]
                if device_id not in by_device:
                    by_device[device_id] = []
                by_device[device_id].append(record)

            # Send to cloud
            synced_ids = []

            async with httpx.AsyncClient(timeout=self.timeout) as client:
                for device_id, records in by_device.items():
                    success = await self._send_batch(client, device_id, records)
                    if success:
                        synced_ids.extend([r["id"] for r in records])
                        synced_count += len(records)

            # Mark as synced
            if synced_ids:
                await self.data_buffer.mark_synced(synced_ids)
                self.last_sync = datetime.utcnow()
                self.sync_errors = 0
                logger.info(f"Successfully synced {synced_count} records")

            return synced_count

        except Exception as e:
            self.sync_errors += 1
            logger.error(f"Sync error (attempt {self.sync_errors}): {e}")
            return 0

        finally:
            self.is_syncing = False

    async def _send_batch(
        self,
        client: httpx.AsyncClient,
        device_id: str,
        records: List[dict],
    ) -> bool:
        """Send a batch of records to cloud API."""
        try:
            headers = {"Content-Type": "application/json"}
            if self.api_key:
                headers["X-API-Key"] = self.api_key

            # Prepare payload
            payload = {
                "deviceId": device_id,
                "telemetry": [
                    {
                        "timestamp": r["timestamp"],
                        **r["data"],
                    }
                    for r in records
                ],
            }

            response = await client.post(
                f"{self.api_url}/api/v1/telemetry/batch",
                json=payload,
                headers=headers,
            )

            if response.status_code == 200:
                return True
            else:
                logger.warning(f"Cloud API error: {response.status_code} - {response.text}")
                return False

        except httpx.TimeoutException:
            logger.warning("Cloud API timeout")
            return False
        except Exception as e:
            logger.error(f"Cloud API error: {e}")
            return False

    async def check_cloud_connection(self) -> bool:
        """Check if cloud API is reachable."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.api_url}/health")
                return response.status_code == 200
        except:
            return False

    async def get_sync_status(self) -> dict:
        """Get current sync status."""
        pending = await self.data_buffer.get_pending_count()

        return {
            "is_syncing": self.is_syncing,
            "pending_records": pending,
            "last_sync": self.last_sync.isoformat() if self.last_sync else None,
            "sync_errors": self.sync_errors,
            "cloud_reachable": await self.check_cloud_connection(),
        }
