"""Data Loader -- fetches telemetry from InfluxDB for model training."""
import os
import numpy as np
import structlog

log = structlog.get_logger()

INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "")
INFLUX_ORG = os.getenv("INFLUX_ORG", "lifo4")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "bess_telemetry")


class DataLoader:
    """Loads training data from InfluxDB."""

    async def load(self, system_id: str, days: int = 90) -> "np.ndarray":
        """Load telemetry. Falls back to synthetic if InfluxDB unavailable."""
        try:
            return await self._load_from_influx(system_id, days)
        except Exception as e:
            log.warning("influx_unavailable_using_synthetic", error=str(e))
            return self._generate_synthetic(days)

    async def _load_from_influx(self, system_id: str, days: int) -> "np.ndarray":
        """Query InfluxDB for telemetry data."""
        from influxdb_client import InfluxDBClient
        if not INFLUX_TOKEN:
            raise ValueError("INFLUX_TOKEN not configured")
        client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
        query_api = client.query_api()
        # Flux query built with string concat to avoid f-string/triple-quote issues
        query = (
            "from(bucket: \"" + INFLUX_BUCKET + "\")" + chr(10)
            + "  |> range(start: -" + str(days) + "d)" + chr(10)
            + "  |> filter(fn: (r) => r[\"system_id\"] == \"" + system_id + "\")" + chr(10)
            + "  |> filter(fn: (r) => r[\"_measurement\"] == \"telemetry\")" + chr(10)
            + "  |> pivot(rowKey:[\"_time\"], columnKey: [\"_field\"], valueColumn: \"_value\")" + chr(10)
            + "  |> sort(columns: [\"_time\"])"
        )
        tables = query_api.query(query)
        records = []
        for table in tables:
            for record in table.records:
                records.append([
                    record.get_time().timestamp(),
                    record.values.get("load_kw", 0),
                    record.values.get("soc", 50),
                    record.values.get("temperature", 25),
                    record.values.get("price_brl_kwh", 0.45),
                ])
        client.close()
        return np.array(records, dtype=np.float32) if records else self._generate_synthetic(days)

    def _generate_synthetic(self, days: int) -> "np.ndarray":
        """Generate synthetic training data with realistic patterns."""
        import time
        points_per_day = 24 * 12
        n = days * points_per_day
        now = time.time()
        timestamps = np.linspace(now - days * 86400, now, n)
        hours = (timestamps % 86400) / 3600
        load = 50 + 30 * np.sin(np.pi * (hours - 6) / 12) + np.random.randn(n) * 5
        load = np.clip(load, 5, 120)
        soc = 50 + 30 * np.sin(np.pi * hours / 12) + np.random.randn(n) * 3
        soc = np.clip(soc, 10, 95)
        temp = 25 + 10 * np.sin(np.pi * (hours - 4) / 12) + np.random.randn(n) * 2
        price = np.where((hours >= 18) & (hours < 21), 0.85, 0.38)
        return np.column_stack([timestamps, load, soc, temp, price]).astype(np.float32)
