"""
Anomaly Detector — threshold-based detection with InfluxDB data.
Implements isolation-forest-inspired statistical analysis over recent telemetry windows.
"""
import os
from datetime import datetime, timezone
import numpy as np
import structlog

log = structlog.get_logger()

INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "")
INFLUX_ORG = os.getenv("INFLUX_ORG", "lifo4")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "bess_telemetry")


class AnomalyDetector:
    """Detects anomalies in battery telemetry using threshold + statistical analysis."""

    THRESHOLDS = {
        "voltage_cell_delta_max_v": 0.10,   # max inter-cell voltage difference
        "temperature_max_c": 50.0,           # max cell temperature
        "current_spike_ka": 2.5,             # abnormal current spike (kA)
        "efficiency_min_pct": 85.0,          # minimum round-trip efficiency %
        "soc_drop_per_hour_max_pct": 30.0,  # max SoC drop per hour
        "voltage_std_max": 0.05,             # max voltage standard deviation
    }

    def detect(self, system_id: str, lookback_hours: int = 24) -> list[dict]:
        """
        Detect anomalies in the last N hours.
        Tries InfluxDB first; falls back to empty list if unavailable.
        """
        try:
            return self._detect_from_influx(system_id, lookback_hours)
        except Exception as e:
            log.warning("anomaly_detection_influx_unavailable", system_id=system_id, error=str(e))
            return []

    def _detect_from_influx(self, system_id: str, lookback_hours: int) -> list[dict]:
        """Query InfluxDB and run anomaly checks on real telemetry."""
        from influxdb_client import InfluxDBClient
        if not INFLUX_TOKEN:
            raise ValueError("INFLUX_TOKEN not configured")

        client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
        query_api = client.query_api()

        query = (
            "from(bucket: \"" + INFLUX_BUCKET + "\")"
            + "\n  |> range(start: -" + str(lookback_hours) + "h)"
            + "\n  |> filter(fn: (r) => r[\"system_id\"] == \"" + system_id + "\")"
            + "\n  |> filter(fn: (r) => r[\"_measurement\"] == \"telemetry\")"
            + "\n  |> pivot(rowKey:[\"_time\"], columnKey: [\"_field\"], valueColumn: \"_value\")"
            + "\n  |> sort(columns: [\"_time\"])"
        )

        tables = query_api.query(query)
        records = []
        for table in tables:
            for record in table.records:
                records.append({
                    "timestamp": record.get_time().isoformat(),
                    "temperature": record.values.get("temp_avg", 25.0),
                    "cell_voltage_min": record.values.get("cell_voltage_min"),
                    "cell_voltage_max": record.values.get("cell_voltage_max"),
                    "current": record.values.get("current", 0.0),
                    "soc": record.values.get("soc", 50.0),
                    "voltage": record.values.get("voltage", 48.0),
                })
        client.close()

        if not records:
            return []

        return self._analyze(system_id, records)

    def _analyze(self, system_id: str, records: list[dict]) -> list[dict]:
        """Run threshold and statistical checks on telemetry records."""
        anomalies = []
        now = datetime.now(timezone.utc).isoformat()

        temperatures = [r["temperature"] for r in records if r.get("temperature") is not None]
        currents = [abs(r["current"]) for r in records if r.get("current") is not None]
        soc_values = [r["soc"] for r in records if r.get("soc") is not None]
        voltages = [r["voltage"] for r in records if r.get("voltage") is not None]
        cell_deltas = [
            r["cell_voltage_max"] - r["cell_voltage_min"]
            for r in records
            if r.get("cell_voltage_min") is not None and r.get("cell_voltage_max") is not None
        ]

        # 1. Over-temperature check
        if temperatures:
            max_temp = max(temperatures)
            if max_temp > self.THRESHOLDS["temperature_max_c"]:
                anomalies.append(self._build(
                    system_id, "OVER_TEMPERATURE", max_temp,
                    self.THRESHOLDS["temperature_max_c"],
                    f"Peak temperature {max_temp:.1f}°C exceeds {self.THRESHOLDS['temperature_max_c']}°C limit",
                    "HIGH",
                ))

        # 2. Inter-cell voltage imbalance
        if cell_deltas:
            max_delta = max(cell_deltas)
            if max_delta > self.THRESHOLDS["voltage_cell_delta_max_v"]:
                anomalies.append(self._build(
                    system_id, "CELL_VOLTAGE_IMBALANCE", max_delta,
                    self.THRESHOLDS["voltage_cell_delta_max_v"],
                    f"Cell voltage delta {max_delta:.3f}V exceeds {self.THRESHOLDS['voltage_cell_delta_max_v']}V",
                    "HIGH",
                ))

        # 3. Current spike detection (statistical: > mean + 3*std)
        if len(currents) >= 10:
            arr = np.array(currents)
            mean, std = arr.mean(), arr.std()
            spikes = arr[arr > mean + 3 * std]
            if len(spikes) > 0 and spikes.max() > self.THRESHOLDS["current_spike_ka"] * 1000:
                anomalies.append(self._build(
                    system_id, "CURRENT_SPIKE", float(spikes.max()),
                    self.THRESHOLDS["current_spike_ka"] * 1000,
                    f"Current spike {spikes.max():.1f}A detected (>{mean + 3 * std:.1f}A threshold)",
                    "MEDIUM",
                ))

        # 4. Rapid SoC drop (> threshold per hour)
        if len(soc_values) >= 2:
            soc_arr = np.array(soc_values)
            # Check max drop in any 12 consecutive readings (~1h at 5min intervals)
            window = min(12, len(soc_arr))
            drops = [soc_arr[i] - soc_arr[i + window] for i in range(len(soc_arr) - window) if soc_arr[i] > soc_arr[i + window]]
            if drops and max(drops) > self.THRESHOLDS["soc_drop_per_hour_max_pct"]:
                anomalies.append(self._build(
                    system_id, "RAPID_SOC_DROP", max(drops),
                    self.THRESHOLDS["soc_drop_per_hour_max_pct"],
                    f"SoC dropped {max(drops):.1f}% in ~1h (limit {self.THRESHOLDS['soc_drop_per_hour_max_pct']}%)",
                    "MEDIUM",
                ))

        # 5. Voltage standard deviation (pack instability)
        if len(voltages) >= 10:
            v_std = float(np.std(voltages))
            if v_std > self.THRESHOLDS["voltage_std_max"] * np.mean(voltages):
                anomalies.append(self._build(
                    system_id, "VOLTAGE_INSTABILITY", v_std,
                    self.THRESHOLDS["voltage_std_max"],
                    f"Pack voltage std {v_std:.4f}V suggests instability",
                    "LOW",
                ))

        log.info("anomaly_scan_complete", system_id=system_id, hours=lookback_hours, count=len(anomalies))
        return anomalies

    def _build(self, system_id: str, anomaly_type: str, value: float,
               threshold: float, description: str, severity: str) -> dict:
        return {
            "system_id": system_id,
            "type": anomaly_type,
            "value": round(value, 4),
            "threshold": threshold,
            "description": description,
            "severity": severity,
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }
