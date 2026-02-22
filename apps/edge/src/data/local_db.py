"""
SQLite local database for the edge controller.
Stores telemetry, decisions, alarms, and sync queue.
Retention: 72h telemetry, 30 days decisions/alarms.
Uses WAL mode for better concurrent performance.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

import aiosqlite

from src.utils.logger import get_logger

logger = get_logger(__name__)

CREATE_TABLES = """
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;

CREATE TABLE IF NOT EXISTS telemetry (
    timestamp TEXT PRIMARY KEY,
    soc REAL,
    soh REAL,
    voltage REAL,
    current REAL,
    power_kw REAL,
    temp_min REAL,
    temp_max REAL,
    temp_avg REAL,
    frequency REAL,
    grid_voltage REAL,
    cell_voltage_min REAL,
    cell_voltage_max REAL
);

CREATE TABLE IF NOT EXISTS decisions (
    timestamp TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    power_kw REAL,
    duration_min REAL,
    priority TEXT,
    reason TEXT,
    confidence REAL,
    mode TEXT
);

CREATE TABLE IF NOT EXISTS alarms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    severity TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT,
    metadata TEXT,
    acknowledged INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    payload TEXT NOT NULL,
    qos INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    sent INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_ts ON decisions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_alarms_ts ON alarms(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sync_queue_unsent ON sync_queue(sent, created_at);
"""


class LocalDatabase:
    def __init__(self, db_path: str):
        self._path = Path(db_path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._db: aiosqlite.Connection | None = None

    async def connect(self) -> None:
        self._db = await aiosqlite.connect(str(self._path))
        self._db.row_factory = aiosqlite.Row
        await self._db.executescript(CREATE_TABLES)
        await self._db.commit()
        logger.info("local_db_connected", path=str(self._path))

    async def close(self) -> None:
        if self._db:
            await self._db.close()
            logger.info("local_db_closed")

    # ─── Telemetry ─────────────────────────────────────────────────────────

    async def save_telemetry(self, snapshot: Any) -> None:
        """Save a TelemetrySnapshot to SQLite."""
        ts = datetime.utcnow().isoformat()
        await self._db.execute(
            """INSERT OR REPLACE INTO telemetry
               (timestamp, soc, soh, voltage, current, power_kw,
                temp_min, temp_max, temp_avg, frequency, grid_voltage,
                cell_voltage_min, cell_voltage_max)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                ts, snapshot.soc, snapshot.soh, snapshot.voltage,
                snapshot.current, snapshot.power_kw,
                snapshot.temp_min, snapshot.temp_max, snapshot.temp_avg,
                snapshot.frequency, snapshot.grid_voltage,
                snapshot.cell_voltage_min, snapshot.cell_voltage_max,
            ),
        )
        await self._db.commit()

    async def get_recent_telemetry(self, hours: int = 1) -> list[dict]:
        since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
        async with self._db.execute(
            "SELECT * FROM telemetry WHERE timestamp > ? ORDER BY timestamp DESC",
            (since,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    # ─── Decisions ─────────────────────────────────────────────────────────

    async def save_decision(self, decision: dict) -> None:
        ts = decision.get("timestamp", datetime.utcnow().isoformat())
        await self._db.execute(
            """INSERT OR REPLACE INTO decisions
               (timestamp, action, power_kw, duration_min, priority, reason, confidence, mode)
               VALUES (?,?,?,?,?,?,?,?)""",
            (
                ts,
                decision.get("action", "IDLE"),
                decision.get("power_kw", 0.0),
                decision.get("duration_min", 0.0),
                decision.get("priority", "ECONOMIC"),
                decision.get("reason", ""),
                decision.get("confidence", 1.0),
                decision.get("mode", "AUTONOMOUS"),
            ),
        )
        await self._db.commit()

    # ─── Alarms ────────────────────────────────────────────────────────────

    async def save_alarm(self, alarm: dict) -> None:
        await self._db.execute(
            """INSERT INTO alarms (timestamp, severity, type, message, metadata)
               VALUES (?,?,?,?,?)""",
            (
                alarm.get("timestamp", datetime.utcnow().isoformat()),
                alarm.get("severity", "medium"),
                alarm.get("type", "UNKNOWN"),
                alarm.get("message", ""),
                json.dumps(alarm.get("metadata", {})),
            ),
        )
        await self._db.commit()

    async def get_unresolved_alarms(self) -> list[dict]:
        async with self._db.execute(
            "SELECT * FROM alarms WHERE acknowledged = 0 ORDER BY timestamp DESC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    # ─── Sync Queue ────────────────────────────────────────────────────────

    async def enqueue_for_sync(self, topic: str, payload: dict, qos: int = 0) -> None:
        await self._db.execute(
            "INSERT INTO sync_queue (topic, payload, qos, created_at) VALUES (?,?,?,?)",
            (topic, json.dumps(payload), qos, datetime.utcnow().isoformat()),
        )
        await self._db.commit()

    async def get_pending_sync(self, limit: int = 100) -> list[dict]:
        async with self._db.execute(
            "SELECT * FROM sync_queue WHERE sent = 0 ORDER BY created_at LIMIT ?",
            (limit,),
        ) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

    async def mark_synced(self, ids: list[int]) -> None:
        if not ids:
            return
        placeholders = ",".join("?" * len(ids))
        await self._db.execute(
            f"UPDATE sync_queue SET sent = 1 WHERE id IN ({placeholders})", ids
        )
        await self._db.commit()

    # ─── Cleanup ───────────────────────────────────────────────────────────

    async def cleanup_old_data(
        self,
        telemetry_hours: int = 72,
        decisions_days: int = 30,
        alarms_days: int = 30,
    ) -> None:
        """Purge old records to keep SQLite size bounded."""
        telemetry_cutoff = (datetime.utcnow() - timedelta(hours=telemetry_hours)).isoformat()
        decisions_cutoff = (datetime.utcnow() - timedelta(days=decisions_days)).isoformat()
        alarms_cutoff = (datetime.utcnow() - timedelta(days=alarms_days)).isoformat()
        sync_cutoff = (datetime.utcnow() - timedelta(days=7)).isoformat()

        await self._db.execute("DELETE FROM telemetry WHERE timestamp < ?", (telemetry_cutoff,))
        await self._db.execute("DELETE FROM decisions WHERE timestamp < ?", (decisions_cutoff,))
        await self._db.execute("DELETE FROM alarms WHERE timestamp < ? AND acknowledged = 1", (alarms_cutoff,))
        await self._db.execute("DELETE FROM sync_queue WHERE sent = 1 AND created_at < ?", (sync_cutoff,))
        await self._db.execute("PRAGMA wal_checkpoint(PASSIVE)")
        await self._db.commit()
        logger.info("local_db_cleanup_done")
