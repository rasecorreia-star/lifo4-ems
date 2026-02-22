"""
InfluxDB Client utility -- async helper for time-series queries.
"""
import os
import structlog

log = structlog.get_logger()

INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "")
INFLUX_ORG = os.getenv("INFLUX_ORG", "lifo4")


class InfluxHelper:
    """Thin wrapper around influxdb-client for common query patterns."""

    def __init__(self):
        self._client = None

    def _get_client(self):
        if not self._client:
            from influxdb_client import InfluxDBClient
            self._client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
        return self._client

    def query(self, flux_query: str) -> list:
        """Execute Flux query and return list of records."""
        client = self._get_client()
        query_api = client.query_api()
        tables = query_api.query(flux_query)
        results = []
        for table in tables:
            for record in table.records:
                results.append(record.values)
        return results

    def close(self):
        if self._client:
            self._client.close()
            self._client = None
