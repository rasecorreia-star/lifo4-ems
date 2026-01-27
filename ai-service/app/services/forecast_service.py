"""
Load Forecasting Service
Predicts energy consumption and optimal battery dispatch
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
import numpy as np
import pickle
from datetime import datetime, timedelta
import pandas as pd

from app.config import settings

logger = logging.getLogger(__name__)


class ForecastService:
    """Energy load and price forecasting service."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.is_loaded = False

        # Brazilian electricity tariff structure (TUSD + TE)
        # Based on ANEEL regulations for Piauí (Equatorial)
        self.tariff = {
            "peak_hours": [(17, 20)],  # 17:00-20:00
            "peak_rate": 1.45,  # R$/kWh during peak
            "off_peak_rate": 0.65,  # R$/kWh off-peak
            "demand_charge": 15.50,  # R$/kW contracted demand
        }

        # Typical load patterns (normalized 0-1 for 24 hours)
        self.load_patterns = {
            "residential": [
                0.3, 0.2, 0.2, 0.2, 0.25, 0.35,  # 00:00-05:59
                0.5, 0.7, 0.6, 0.5, 0.45, 0.5,   # 06:00-11:59
                0.6, 0.55, 0.5, 0.5, 0.6, 0.8,   # 12:00-17:59
                0.95, 1.0, 0.9, 0.7, 0.5, 0.4,   # 18:00-23:59
            ],
            "commercial": [
                0.2, 0.15, 0.15, 0.15, 0.2, 0.3, # 00:00-05:59
                0.5, 0.7, 0.85, 0.9, 0.95, 1.0,  # 06:00-11:59
                0.95, 0.9, 0.85, 0.8, 0.75, 0.6, # 12:00-17:59
                0.4, 0.3, 0.25, 0.2, 0.2, 0.2,   # 18:00-23:59
            ],
            "industrial": [
                0.6, 0.6, 0.6, 0.6, 0.65, 0.7,   # 00:00-05:59
                0.85, 0.95, 1.0, 1.0, 1.0, 0.95, # 06:00-11:59
                0.9, 0.95, 1.0, 1.0, 0.95, 0.85, # 12:00-17:59
                0.7, 0.65, 0.6, 0.6, 0.6, 0.6,   # 18:00-23:59
            ],
        }

    async def load_model(self):
        """Load forecasting model."""
        try:
            model_path = Path(settings.forecast_model_path)

            if model_path.exists():
                logger.info(f"Loading forecast model from {model_path}")
                loop = asyncio.get_event_loop()

                with open(model_path, "rb") as f:
                    data = await loop.run_in_executor(None, pickle.load, f)
                    self.model = data.get("model")
                    self.scaler = data.get("scaler")

                self.is_loaded = True
                logger.info("Forecast model loaded")
            else:
                logger.warning(f"Forecast model not found, using pattern-based forecasting")
                self.is_loaded = True  # Use pattern-based fallback

        except Exception as e:
            logger.error(f"Failed to load forecast model: {e}")
            self.is_loaded = True  # Use pattern-based fallback

    async def forecast_load(
        self,
        base_load_kw: float,
        pattern_type: str = "residential",
        hours_ahead: int = 24,
        start_time: datetime = None,
    ) -> Dict[str, Any]:
        """
        Forecast energy load for the next N hours.

        Args:
            base_load_kw: Base load in kW
            pattern_type: Load pattern type (residential, commercial, industrial)
            hours_ahead: Number of hours to forecast
            start_time: Starting time (default: now)

        Returns:
            Hourly load forecast
        """
        if start_time is None:
            start_time = datetime.now()

        pattern = self.load_patterns.get(pattern_type, self.load_patterns["residential"])

        forecast = []
        current_time = start_time

        for i in range(hours_ahead):
            hour = current_time.hour
            load_factor = pattern[hour]

            # Add some randomness for realism
            noise = np.random.normal(0, 0.05)
            load_factor = max(0.1, min(1.0, load_factor + noise))

            # Calculate load
            load_kw = base_load_kw * load_factor

            # Determine if peak hour
            is_peak = any(start <= hour < end for start, end in self.tariff["peak_hours"])

            # Calculate cost
            rate = self.tariff["peak_rate"] if is_peak else self.tariff["off_peak_rate"]
            cost_per_hour = load_kw * rate

            forecast.append({
                "timestamp": current_time.isoformat(),
                "hour": hour,
                "load_kw": round(load_kw, 2),
                "load_factor": round(load_factor, 3),
                "is_peak": is_peak,
                "rate": rate,
                "cost_estimate": round(cost_per_hour, 2),
            })

            current_time += timedelta(hours=1)

        # Calculate totals
        total_energy = sum(f["load_kw"] for f in forecast)
        total_cost = sum(f["cost_estimate"] for f in forecast)
        peak_load = max(f["load_kw"] for f in forecast)

        return {
            "forecast": forecast,
            "summary": {
                "hours": hours_ahead,
                "total_energy_kwh": round(total_energy, 2),
                "average_load_kw": round(total_energy / hours_ahead, 2),
                "peak_load_kw": round(peak_load, 2),
                "total_cost_estimate": round(total_cost, 2),
            },
            "pattern_type": pattern_type,
            "generated_at": datetime.now().isoformat(),
        }

    async def optimize_battery_dispatch(
        self,
        load_forecast: List[Dict[str, Any]],
        battery_capacity_kwh: float,
        battery_power_kw: float,
        current_soc: float,
        min_soc: float = 20,
        max_soc: float = 95,
    ) -> Dict[str, Any]:
        """
        Optimize battery charge/discharge schedule.

        Strategy:
        - Charge during off-peak hours
        - Discharge during peak hours to reduce costs
        - Maintain minimum SOC reserve

        Args:
            load_forecast: Hourly load forecast
            battery_capacity_kwh: Battery capacity in kWh
            battery_power_kw: Max charge/discharge power in kW
            current_soc: Current state of charge (%)
            min_soc: Minimum SOC to maintain
            max_soc: Maximum SOC target

        Returns:
            Optimized dispatch schedule
        """
        schedule = []
        soc = current_soc
        usable_capacity = battery_capacity_kwh * (max_soc - min_soc) / 100

        total_savings = 0
        energy_charged = 0
        energy_discharged = 0

        for hour_data in load_forecast:
            is_peak = hour_data["is_peak"]
            load_kw = hour_data["load_kw"]
            timestamp = hour_data["timestamp"]
            rate = hour_data["rate"]

            action = "idle"
            power = 0
            energy = 0

            if is_peak and soc > min_soc:
                # Discharge during peak to offset load
                max_discharge = min(
                    battery_power_kw,
                    load_kw,
                    (soc - min_soc) / 100 * battery_capacity_kwh,
                )
                power = -max_discharge  # Negative = discharge
                energy = max_discharge  # kWh discharged
                action = "discharge"

                # Update SOC
                soc -= (energy / battery_capacity_kwh) * 100

                # Calculate savings (avoiding peak rate)
                savings = energy * self.tariff["peak_rate"]
                total_savings += savings
                energy_discharged += energy

            elif not is_peak and soc < max_soc:
                # Charge during off-peak
                max_charge = min(
                    battery_power_kw,
                    (max_soc - soc) / 100 * battery_capacity_kwh,
                )
                power = max_charge  # Positive = charge
                energy = max_charge
                action = "charge"

                # Update SOC
                soc += (energy / battery_capacity_kwh) * 100

                # Cost of charging
                charge_cost = energy * self.tariff["off_peak_rate"]
                energy_charged += energy

            schedule.append({
                "timestamp": timestamp,
                "hour": hour_data["hour"],
                "action": action,
                "power_kw": round(power, 2),
                "energy_kwh": round(energy, 2),
                "soc_after": round(soc, 1),
                "is_peak": is_peak,
                "grid_load_kw": round(load_kw - abs(power) if action == "discharge" else load_kw, 2),
            })

        # Calculate net benefit
        charge_cost = energy_charged * self.tariff["off_peak_rate"]
        net_savings = total_savings - charge_cost

        return {
            "schedule": schedule,
            "summary": {
                "total_savings": round(total_savings, 2),
                "charging_cost": round(charge_cost, 2),
                "net_savings": round(net_savings, 2),
                "energy_charged_kwh": round(energy_charged, 2),
                "energy_discharged_kwh": round(energy_discharged, 2),
                "final_soc": round(soc, 1),
                "cycles_used": round(energy_discharged / battery_capacity_kwh, 2),
            },
            "optimization": "peak_shaving",
            "generated_at": datetime.now().isoformat(),
        }

    async def analyze_prospect_load(
        self,
        power_readings: List[Dict[str, Any]],
        measurement_days: int = 7,
    ) -> Dict[str, Any]:
        """
        Analyze prospect's load data and recommend battery size.

        Args:
            power_readings: List of power readings with timestamp and power_kw
            measurement_days: Number of days measured

        Returns:
            Load analysis and BESS sizing recommendations
        """
        if not power_readings:
            return {"error": "No power readings provided"}

        # Convert to DataFrame
        df = pd.DataFrame(power_readings)
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        df["hour"] = df["timestamp"].dt.hour

        # Calculate metrics
        peak_demand = df["power_kw"].max()
        avg_demand = df["power_kw"].mean()
        min_demand = df["power_kw"].min()

        # Daily consumption
        total_kwh = df["power_kw"].sum() / (len(df) / 24)  # Average daily kWh

        # Peak hours analysis
        peak_hours_mask = df["hour"].apply(
            lambda h: any(start <= h < end for start, end in self.tariff["peak_hours"])
        )
        peak_consumption = df[peak_hours_mask]["power_kw"].sum() / measurement_days
        off_peak_consumption = df[~peak_hours_mask]["power_kw"].sum() / measurement_days

        # Load pattern classification
        load_profile = self._classify_load_pattern(df)

        # BESS sizing recommendations
        recommendations = self._calculate_bess_sizing(
            peak_demand=peak_demand,
            peak_consumption=peak_consumption,
            daily_consumption=total_kwh,
        )

        return {
            "analysis": {
                "measurement_days": measurement_days,
                "data_points": len(power_readings),
                "peak_demand_kw": round(peak_demand, 2),
                "average_demand_kw": round(avg_demand, 2),
                "min_demand_kw": round(min_demand, 2),
                "daily_consumption_kwh": round(total_kwh, 2),
                "peak_hours_consumption_kwh": round(peak_consumption, 2),
                "off_peak_consumption_kwh": round(off_peak_consumption, 2),
                "load_factor": round(avg_demand / peak_demand * 100, 1),
            },
            "load_profile": load_profile,
            "recommendations": recommendations,
            "potential_savings": self._calculate_potential_savings(
                peak_consumption,
                recommendations["optimal"]["capacity_kwh"],
            ),
            "generated_at": datetime.now().isoformat(),
        }

    def _classify_load_pattern(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Classify the load pattern type."""
        hourly_avg = df.groupby("hour")["power_kw"].mean()
        normalized = (hourly_avg - hourly_avg.min()) / (hourly_avg.max() - hourly_avg.min())

        # Compare with known patterns
        best_match = "residential"
        best_score = 0

        for pattern_name, pattern in self.load_patterns.items():
            pattern_series = pd.Series(pattern)
            correlation = normalized.corr(pattern_series)
            if correlation > best_score:
                best_score = correlation
                best_match = pattern_name

        return {
            "type": best_match,
            "confidence": round(best_score * 100, 1),
            "peak_hours": list(hourly_avg.nlargest(3).index),
            "off_peak_hours": list(hourly_avg.nsmallest(3).index),
        }

    def _calculate_bess_sizing(
        self,
        peak_demand: float,
        peak_consumption: float,
        daily_consumption: float,
    ) -> Dict[str, Any]:
        """Calculate recommended BESS sizes."""
        # Conservative: Cover 50% of peak hours
        conservative_kwh = peak_consumption * 0.5
        conservative_kw = peak_demand * 0.5

        # Optimal: Cover 100% of peak hours
        optimal_kwh = peak_consumption
        optimal_kw = peak_demand * 0.8

        # Maximum: Full daily backup
        maximum_kwh = daily_consumption * 0.8
        maximum_kw = peak_demand

        return {
            "conservative": {
                "capacity_kwh": round(conservative_kwh),
                "power_kw": round(conservative_kw),
                "description": "Cobertura de 50% do horário de ponta",
            },
            "optimal": {
                "capacity_kwh": round(optimal_kwh),
                "power_kw": round(optimal_kw),
                "description": "Cobertura completa do horário de ponta",
            },
            "maximum": {
                "capacity_kwh": round(maximum_kwh),
                "power_kw": round(maximum_kw),
                "description": "Backup diário com reserva",
            },
        }

    def _calculate_potential_savings(
        self,
        peak_consumption: float,
        battery_kwh: float,
    ) -> Dict[str, Any]:
        """Calculate potential savings with BESS."""
        # Energy shifted from peak to off-peak
        shiftable = min(peak_consumption, battery_kwh)

        # Savings from rate difference
        rate_diff = self.tariff["peak_rate"] - self.tariff["off_peak_rate"]
        daily_savings = shiftable * rate_diff * 0.85  # 85% efficiency

        return {
            "daily_savings": round(daily_savings, 2),
            "monthly_savings": round(daily_savings * 30, 2),
            "annual_savings": round(daily_savings * 365, 2),
            "assumptions": {
                "peak_rate": self.tariff["peak_rate"],
                "off_peak_rate": self.tariff["off_peak_rate"],
                "round_trip_efficiency": 0.85,
            },
        }


# Singleton instance
forecast_service = ForecastService()
