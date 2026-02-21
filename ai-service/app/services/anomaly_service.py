"""
Battery Anomaly Detection Service
Detects anomalies in battery telemetry data using ML models
"""

import logging
import asyncio
from typing import Dict, Any, List, Optional
from pathlib import Path
import numpy as np
import pickle
from datetime import datetime, timedelta

from app.config import settings

logger = logging.getLogger(__name__)


class AnomalyService:
    """Battery anomaly detection using ML models."""

    def __init__(self):
        self.model = None
        self.scaler = None
        self.is_loaded = False

        # Thresholds for rule-based detection
        self.thresholds = {
            # Voltage thresholds (per cell, LiFePO4)
            "cell_overvoltage": 3.65,
            "cell_undervoltage": 2.5,
            "cell_voltage_warning_high": 3.55,
            "cell_voltage_warning_low": 2.8,
            "cell_imbalance_max": 0.05,  # 50mV max delta

            # Temperature thresholds
            "temp_high_critical": 55,
            "temp_high_warning": 45,
            "temp_low_warning": 5,
            "temp_low_critical": 0,
            "temp_gradient_max": 10,  # Max diff between sensors

            # Current thresholds
            "charge_current_max": 1.0,  # C-rate
            "discharge_current_max": 1.0,

            # SOC/SOH thresholds
            "soh_degraded": 80,
            "soh_critical": 70,
            "soc_low": 10,
        }

    async def load_model(self):
        """Load anomaly detection model."""
        try:
            model_path = Path(settings.anomaly_model_path)

            if model_path.exists():
                logger.info(f"Loading anomaly model from {model_path}")
                loop = asyncio.get_event_loop()

                with open(model_path, "rb") as f:
                    data = await loop.run_in_executor(None, pickle.load, f)
                    self.model = data.get("model")
                    self.scaler = data.get("scaler")

                self.is_loaded = True
                logger.info("Anomaly detection model loaded")
            else:
                logger.warning(f"Anomaly model not found at {model_path}, using rule-based detection")
                self.is_loaded = True  # Use rule-based fallback

        except Exception as e:
            logger.error(f"Failed to load anomaly model: {e}")
            self.is_loaded = True  # Use rule-based fallback

    async def analyze_telemetry(
        self,
        telemetry: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Analyze single telemetry point for anomalies.

        Args:
            telemetry: Battery telemetry data

        Returns:
            Anomaly analysis results
        """
        anomalies = []
        warnings = []
        score = 100  # Health score starts at 100

        # Cell voltage analysis
        cells = telemetry.get("cells", [])
        if cells:
            voltages = [c.get("voltage", 0) for c in cells]
            min_v = min(voltages)
            max_v = max(voltages)
            delta_v = max_v - min_v

            # Check overvoltage
            if max_v > self.thresholds["cell_overvoltage"]:
                anomalies.append({
                    "type": "cell_overvoltage",
                    "severity": "critical",
                    "message": f"Célula com sobretensão: {max_v:.3f}V",
                    "value": max_v,
                    "threshold": self.thresholds["cell_overvoltage"],
                })
                score -= 30

            elif max_v > self.thresholds["cell_voltage_warning_high"]:
                warnings.append({
                    "type": "cell_high_voltage",
                    "severity": "warning",
                    "message": f"Célula com tensão elevada: {max_v:.3f}V",
                    "value": max_v,
                })
                score -= 10

            # Check undervoltage
            if min_v < self.thresholds["cell_undervoltage"]:
                anomalies.append({
                    "type": "cell_undervoltage",
                    "severity": "critical",
                    "message": f"Célula com subtensão: {min_v:.3f}V",
                    "value": min_v,
                    "threshold": self.thresholds["cell_undervoltage"],
                })
                score -= 30

            elif min_v < self.thresholds["cell_voltage_warning_low"]:
                warnings.append({
                    "type": "cell_low_voltage",
                    "severity": "warning",
                    "message": f"Célula com tensão baixa: {min_v:.3f}V",
                    "value": min_v,
                })
                score -= 10

            # Check imbalance
            if delta_v > self.thresholds["cell_imbalance_max"]:
                anomalies.append({
                    "type": "cell_imbalance",
                    "severity": "high",
                    "message": f"Desbalanceamento excessivo: {delta_v*1000:.1f}mV",
                    "value": delta_v,
                    "threshold": self.thresholds["cell_imbalance_max"],
                })
                score -= 20

        # Temperature analysis
        temp_data = telemetry.get("temperature", {})
        temp_max = temp_data.get("max", 25)
        temp_min = temp_data.get("min", 25)
        temp_gradient = temp_max - temp_min

        if temp_max > self.thresholds["temp_high_critical"]:
            anomalies.append({
                "type": "overtemperature",
                "severity": "critical",
                "message": f"Temperatura crítica: {temp_max}°C",
                "value": temp_max,
            })
            score -= 40

        elif temp_max > self.thresholds["temp_high_warning"]:
            warnings.append({
                "type": "high_temperature",
                "severity": "warning",
                "message": f"Temperatura elevada: {temp_max}°C",
                "value": temp_max,
            })
            score -= 15

        if temp_min < self.thresholds["temp_low_critical"]:
            anomalies.append({
                "type": "undertemperature",
                "severity": "critical",
                "message": f"Temperatura muito baixa: {temp_min}°C",
                "value": temp_min,
            })
            score -= 30

        if temp_gradient > self.thresholds["temp_gradient_max"]:
            warnings.append({
                "type": "temperature_gradient",
                "severity": "warning",
                "message": f"Gradiente de temperatura alto: {temp_gradient}°C",
                "value": temp_gradient,
            })
            score -= 10

        # SOH analysis
        soh = telemetry.get("soh", 100)
        if soh < self.thresholds["soh_critical"]:
            anomalies.append({
                "type": "soh_critical",
                "severity": "high",
                "message": f"SOH crítico: {soh}%",
                "value": soh,
            })
            score -= 25

        elif soh < self.thresholds["soh_degraded"]:
            warnings.append({
                "type": "soh_degraded",
                "severity": "warning",
                "message": f"SOH degradado: {soh}%",
                "value": soh,
            })
            score -= 10

        # SOC analysis
        soc = telemetry.get("soc", 50)
        if soc < self.thresholds["soc_low"]:
            warnings.append({
                "type": "soc_low",
                "severity": "warning",
                "message": f"SOC baixo: {soc}%",
                "value": soc,
            })

        # Ensure score doesn't go below 0
        score = max(0, score)

        return {
            "health_score": score,
            "status": "critical" if score < 50 else "warning" if score < 80 else "healthy",
            "anomalies": anomalies,
            "warnings": warnings,
            "total_issues": len(anomalies) + len(warnings),
            "analyzed_at": datetime.utcnow().isoformat(),
        }

    async def analyze_history(
        self,
        telemetry_history: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Analyze telemetry history for trends and patterns.

        Args:
            telemetry_history: List of telemetry data points

        Returns:
            Trend analysis and predictions
        """
        if not telemetry_history:
            return {"error": "No data to analyze"}

        # Extract time series
        soh_values = [t.get("soh", 100) for t in telemetry_history]
        soc_values = [t.get("soc", 50) for t in telemetry_history]
        cycle_counts = [t.get("cycleCount", 0) for t in telemetry_history]

        # Calculate trends
        soh_trend = self._calculate_trend(soh_values)
        soc_trend = self._calculate_trend(soc_values)

        # Estimate remaining life
        remaining_cycles = self._estimate_remaining_cycles(soh_values, cycle_counts)

        # Detect degradation rate
        degradation_rate = self._calculate_degradation_rate(soh_values, cycle_counts)

        return {
            "data_points": len(telemetry_history),
            "soh_trend": soh_trend,
            "current_soh": soh_values[-1] if soh_values else None,
            "degradation_rate": degradation_rate,
            "estimated_remaining_cycles": remaining_cycles,
            "estimated_eol_date": self._estimate_eol_date(remaining_cycles, cycle_counts),
            "recommendations": self._generate_recommendations(
                soh_values[-1] if soh_values else 100,
                degradation_rate,
            ),
        }

    def _calculate_trend(self, values: List[float]) -> str:
        """Calculate trend direction from values."""
        if len(values) < 2:
            return "stable"

        first_half = np.mean(values[:len(values)//2])
        second_half = np.mean(values[len(values)//2:])

        diff = second_half - first_half
        if diff > 0.5:
            return "improving"
        elif diff < -0.5:
            return "declining"
        return "stable"

    def _calculate_degradation_rate(
        self,
        soh_values: List[float],
        cycle_counts: List[int],
    ) -> Optional[float]:
        """Calculate SOH degradation rate per 100 cycles."""
        if len(soh_values) < 2 or len(cycle_counts) < 2:
            return None

        soh_diff = soh_values[0] - soh_values[-1]
        cycle_diff = cycle_counts[-1] - cycle_counts[0]

        if cycle_diff <= 0:
            return None

        return round((soh_diff / cycle_diff) * 100, 2)

    def _estimate_remaining_cycles(
        self,
        soh_values: List[float],
        cycle_counts: List[int],
    ) -> Optional[int]:
        """Estimate remaining cycles until EOL (70% SOH)."""
        current_soh = soh_values[-1] if soh_values else 100
        rate = self._calculate_degradation_rate(soh_values, cycle_counts)

        if not rate or rate <= 0:
            return None

        remaining_soh = current_soh - 70  # Until 70% EOL
        remaining_cycles = int((remaining_soh / rate) * 100)

        return max(0, remaining_cycles)

    def _estimate_eol_date(
        self,
        remaining_cycles: Optional[int],
        cycle_counts: List[int],
    ) -> Optional[str]:
        """Estimate end-of-life date."""
        if not remaining_cycles or len(cycle_counts) < 2:
            return None

        # Assume average 1 cycle per day (configurable)
        days_remaining = remaining_cycles
        eol_date = datetime.now() + timedelta(days=days_remaining)

        return eol_date.strftime("%Y-%m-%d")

    def _generate_recommendations(
        self,
        current_soh: float,
        degradation_rate: Optional[float],
    ) -> List[str]:
        """Generate maintenance recommendations."""
        recommendations = []

        if current_soh < 80:
            recommendations.append("Considere programar manutenção preventiva")

        if current_soh < 70:
            recommendations.append("Bateria próxima do fim de vida útil - planeje substituição")

        if degradation_rate and degradation_rate > 1.0:
            recommendations.append("Taxa de degradação acima do normal - verifique condições de operação")
            recommendations.append("Evite descargas profundas e cargas rápidas frequentes")

        if not recommendations:
            recommendations.append("Sistema operando dentro dos parâmetros normais")

        return recommendations


# Singleton instance
anomaly_service = AnomalyService()
