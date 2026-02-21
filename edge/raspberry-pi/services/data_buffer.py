"""
Local Data Buffer Service
Stores telemetry data locally for offline operation and batch sync
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional

import aiosqlite

logger = logging.getLogger(__name__)


class DataBuffer:
    """Local SQLite buffer for telemetry data."""

    def __init__(self, database_path: str):
        self.database_path = database_path
        self.db: Optional[aiosqlite.Connection] = None

    async def initialize(self):
        """Initialize database and create tables."""
        # Ensure directory exists
        Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)

        self.db = await aiosqlite.connect(self.database_path)

        # Create tables
        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                data TEXT NOT NULL,
                synced INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await self.db.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                device_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                severity TEXT NOT NULL,
                message TEXT,
                data TEXT,
                synced INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)

        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_device
            ON telemetry(device_id, timestamp)
        """)

        await self.db.execute("""
            CREATE INDEX IF NOT EXISTS idx_telemetry_synced
            ON telemetry(synced)
        """)

        await self.db.commit()
        logger.info(f"Data buffer initialized: {self.database_path}")

    async def close(self):
        """Close database connection."""
        if self.db:
            await self.db.close()
            self.db = None

    async def store_telemetry(self, device_id: str, data: dict):
        """Store telemetry data point."""
        if not self.db:
            return

        timestamp = data.get("timestamp", datetime.utcnow().isoformat())

        await self.db.execute(
            "INSERT INTO telemetry (device_id, timestamp, data) VALUES (?, ?, ?)",
            (device_id, timestamp, json.dumps(data))
        )
        await self.db.commit()

    async def store_event(
        self,
        device_id: str,
        event_type: str,
        severity: str,
        message: str,
        data: dict = None,
    ):
        """Store event/alert."""
        if not self.db:
            return

        await self.db.execute(
            """INSERT INTO events (device_id, event_type, severity, message, data)
               VALUES (?, ?, ?, ?, ?)""",
            (device_id, event_type, severity, message, json.dumps(data) if data else None)
        )
        await self.db.commit()

    async def get_latest_telemetry(self, device_id: str) -> Optional[dict]:
        """Get most recent telemetry for a device."""
        if not self.db:
            return None

        cursor = await self.db.execute(
            """SELECT data FROM telemetry
               WHERE device_id = ?
               ORDER BY timestamp DESC LIMIT 1""",
            (device_id,)
        )
        row = await cursor.fetchone()

        if row:
            return json.loads(row[0])
        return None

    async def get_telemetry_history(
        self,
        device_id: str,
        start: str = None,
        end: str = None,
        limit: int = 100,
    ) -> List[dict]:
        """Get telemetry history for a device."""
        if not self.db:
            return []

        query = "SELECT timestamp, data FROM telemetry WHERE device_id = ?"
        params = [device_id]

        if start:
            query += " AND timestamp >= ?"
            params.append(start)
        if end:
            query += " AND timestamp <= ?"
            params.append(end)

        query += " ORDER BY timestamp DESC LIMIT ?"
        params.append(limit)

        cursor = await self.db.execute(query, params)
        rows = await cursor.fetchall()

        return [
            {"timestamp": row[0], **json.loads(row[1])}
            for row in rows
        ]

    async def get_pending_count(self) -> int:
        """Get count of un-synced records."""
        if not self.db:
            return 0

        cursor = await self.db.execute(
            "SELECT COUNT(*) FROM telemetry WHERE synced = 0"
        )
        row = await cursor.fetchone()
        return row[0] if row else 0

    async def get_pending_telemetry(self, limit: int = 100) -> List[dict]:
        """Get un-synced telemetry records."""
        if not self.db:
            return []

        cursor = await self.db.execute(
            """SELECT id, device_id, timestamp, data FROM telemetry
               WHERE synced = 0
               ORDER BY timestamp ASC LIMIT ?""",
            (limit,)
        )
        rows = await cursor.fetchall()

        return [
            {
                "id": row[0],
                "device_id": row[1],
                "timestamp": row[2],
                "data": json.loads(row[3]),
            }
            for row in rows
        ]

    async def mark_synced(self, ids: List[int]):
        """Mark records as synced."""
        if not self.db or not ids:
            return

        placeholders = ",".join(["?"] * len(ids))
        await self.db.execute(
            f"UPDATE telemetry SET synced = 1 WHERE id IN ({placeholders})",
            ids
        )
        await self.db.commit()

    async def cleanup_old_data(self, days: int = 7):
        """Remove old synced data."""
        if not self.db:
            return

        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

        cursor = await self.db.execute(
            "DELETE FROM telemetry WHERE synced = 1 AND created_at < ?",
            (cutoff,)
        )
        deleted = cursor.rowcount

        await self.db.commit()

        if deleted > 0:
            logger.info(f"Cleaned up {deleted} old telemetry records")
