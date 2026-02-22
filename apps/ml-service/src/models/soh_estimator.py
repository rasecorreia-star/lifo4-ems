"""
State of Health (SoH) Estimator — battery degradation model.
Queries real operational data from InfluxDB; falls back to simulated values.
"""
import os
from datetime import datetime, timezone, timedelta
import structlog

log = structlog.get_logger()

INFLUX_URL = os.getenv("INFLUX_URL", "http://influxdb:8086")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "")
INFLUX_ORG = os.getenv("INFLUX_ORG", "lifo4")
INFLUX_BUCKET = os.getenv("INFLUX_BUCKET", "bess_telemetry")


class SoHEstimator:
    """Estimates battery State of Health and remaining useful life."""

    CYCLE_DEGRADATION_FACTOR = 0.00005  # % per cycle
    MONTHLY_DEGRADATION_RATE = 0.20     # % per month (base)
    END_OF_LIFE_SOH = 80.0              # % (commercial EoL)
    TOTAL_RATED_CYCLES = 4000           # for LiFePO4

    def estimate(self, system_id: str) -> dict:
        """Estimate SoH from operational data. Tries InfluxDB; falls back to simulation."""
        operational = self._load_from_influx(system_id)
        if operational is None:
            log.warning("soh_using_simulated_data", system_id=system_id)
            operational = {
                "months_operating": 18,
                "total_cycles": 650,
                "avg_dod": 68.0,
                "avg_temp": 32.0,
            }
        return self._calculate(system_id, **operational)

    def _load_from_influx(self, system_id: str) -> dict | None:
        """Query InfluxDB for aggregate operational metrics."""
        try:
            from influxdb_client import InfluxDBClient
            if not INFLUX_TOKEN:
                return None

            client = InfluxDBClient(url=INFLUX_URL, token=INFLUX_TOKEN, org=INFLUX_ORG)
            query_api = client.query_api()

            # Query aggregated stats over all available history
            query = (
                "from(bucket: \"" + INFLUX_BUCKET + "\")"
                + "\n  |> range(start: -730d)"  # 2 years
                + "\n  |> filter(fn: (r) => r[\"system_id\"] == \"" + system_id + "\")"
                + "\n  |> filter(fn: (r) => r[\"_measurement\"] == \"telemetry\")"
                + "\n  |> filter(fn: (r) => r[\"_field\"] == \"soc\" or r[\"_field\"] == \"temp_avg\")"
                + "\n  |> pivot(rowKey:[\"_time\"], columnKey: [\"_field\"], valueColumn: \"_value\")"
            )

            tables = query_api.query(query)
            soc_values = []
            temp_values = []
            first_ts = None
            last_ts = None

            for table in tables:
                for record in table.records:
                    ts = record.get_time()
                    if first_ts is None or ts < first_ts:
                        first_ts = ts
                    if last_ts is None or ts > last_ts:
                        last_ts = ts
                    soc = record.values.get("soc")
                    temp = record.values.get("temp_avg")
                    if soc is not None:
                        soc_values.append(float(soc))
                    if temp is not None:
                        temp_values.append(float(temp))

            client.close()

            if not soc_values or first_ts is None:
                return None

            # Calculate months operating
            months_operating = max(1, int((last_ts - first_ts).days / 30))

            # Estimate cycle count: each full DoD swing ~ 1 cycle
            avg_dod = float(sum(soc_values) / len(soc_values))
            # Rough cycle estimate: data points at 5min intervals = 12/h; each 2 swings = 1 cycle
            points_per_day = 12 * 24
            total_days = (last_ts - first_ts).days or 1
            total_cycles = max(1, int(total_days * (avg_dod / 100) * 1.5))

            avg_temp = float(sum(temp_values) / len(temp_values)) if temp_values else 28.0

            return {
                "months_operating": months_operating,
                "total_cycles": total_cycles,
                "avg_dod": round(avg_dod, 1),
                "avg_temp": round(avg_temp, 1),
            }

        except Exception as e:
            log.warning("soh_influx_query_failed", system_id=system_id, error=str(e))
            return None

    def _calculate(self, system_id: str, months_operating: int, total_cycles: int,
                   avg_dod: float, avg_temp: float) -> dict:
        """Core SoH calculation using Arrhenius + DoD factors."""
        now = datetime.now(timezone.utc)

        # Temperature-adjusted degradation (Arrhenius approximation)
        temp_factor = 1.0 + max(0, (avg_temp - 25.0)) * 0.02
        monthly_rate = self.MONTHLY_DEGRADATION_RATE * temp_factor

        # DoD factor (higher DoD = faster degradation)
        dod_factor = 1.0 + max(0, (avg_dod - 50.0)) / 100.0

        soh = 100.0 - (monthly_rate * months_operating) - (total_cycles * self.CYCLE_DEGRADATION_FACTOR * dod_factor * 100)
        soh = max(self.END_OF_LIFE_SOH, min(100.0, round(soh, 1)))

        # Remaining useful life
        remaining_soh = soh - self.END_OF_LIFE_SOH
        degradation_per_month = monthly_rate
        remaining_months = int(remaining_soh / degradation_per_month) if degradation_per_month > 0 else 240
        remaining_years = round(remaining_months / 12, 1)
        remaining_cycles = int((soh - self.END_OF_LIFE_SOH) / (self.CYCLE_DEGRADATION_FACTOR * dod_factor * 100))
        eol_date = (now + timedelta(days=remaining_months * 30)).strftime("%Y-%m")

        # Risk classification
        if soh >= 95:
            risk = "LOW"
            recs = ["Continue normal operation", "Schedule routine maintenance in 6 months"]
        elif soh >= 90:
            risk = "MEDIUM"
            recs = ["Monitor degradation closely", "Consider reducing peak DoD", "Schedule maintenance soon"]
        elif soh >= 85:
            risk = "HIGH"
            recs = ["Immediate maintenance recommended", "Reduce DoD to < 60%", "Evaluate replacement timeline"]
        else:
            risk = "CRITICAL"
            recs = ["Battery approaching end-of-life", "Begin replacement procurement", "Restrict to 50% DoD maximum"]

        log.info("soh_calculated", system_id=system_id, soh=soh, risk=risk,
                 months=months_operating, cycles=total_cycles)

        return {
            "system_id": system_id,
            "soh_percent": soh,
            "remaining_useful_life_cycles": remaining_cycles,
            "remaining_useful_life_years": remaining_years,
            "degradation_rate_per_month": round(monthly_rate, 3),
            "end_of_life_date": eol_date,
            "risk_level": risk,
            "recommendations": recs,
        }
