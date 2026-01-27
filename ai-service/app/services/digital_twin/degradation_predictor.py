"""
Degradation Predictor for Battery Digital Twin
Predicts battery degradation and remaining useful life using ML models
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np
import pickle
from pathlib import Path

try:
    from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
    from sklearn.preprocessing import StandardScaler
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

logger = logging.getLogger(__name__)


@dataclass
class DegradationFactors:
    """Factors affecting battery degradation"""
    avg_dod: float = 0.8  # Average depth of discharge
    avg_c_rate_charge: float = 0.5  # Average charge C-rate
    avg_c_rate_discharge: float = 0.5  # Average discharge C-rate
    avg_temperature: float = 25.0  # Average temperature
    max_temperature: float = 35.0  # Maximum temperature experienced
    min_temperature: float = 15.0  # Minimum temperature experienced
    time_at_high_soc: float = 0.1  # Fraction of time at SOC > 90%
    time_at_low_soc: float = 0.1  # Fraction of time at SOC < 20%
    calendar_days: int = 0  # Days since commissioning
    cycle_count: float = 0  # Equivalent full cycles


@dataclass
class DegradationPrediction:
    """Prediction results"""
    current_soh: float
    predicted_soh_1year: float
    predicted_soh_3year: float
    predicted_soh_5year: float
    remaining_cycles: int
    remaining_years: float
    eol_date: datetime
    degradation_rate: float  # % per year
    primary_stressor: str
    recommendations: List[str]
    confidence: float


class PhysicsBasedModel:
    """
    Physics-based degradation model for LiFePO4 batteries
    Based on calendar aging and cycle aging mechanisms
    """

    def __init__(self):
        # LiFePO4 degradation parameters (empirical)
        # Calendar aging: capacity_loss = k_cal * t^0.5 * exp(-Ea_cal / (R*T))
        self.k_cal = 0.02  # Calendar aging coefficient
        self.Ea_cal = 20000  # Activation energy (J/mol)

        # Cycle aging: capacity_loss = k_cyc * N^0.5 * f(DOD) * f(C-rate) * f(T)
        self.k_cyc = 0.0001  # Cycle aging coefficient

        # Reference conditions
        self.T_ref = 298.15  # 25°C in Kelvin
        self.R = 8.314  # Gas constant

    def calculate_calendar_aging(
        self,
        days: int,
        avg_temperature: float,
        avg_soc: float
    ) -> float:
        """Calculate capacity loss from calendar aging"""
        T = avg_temperature + 273.15  # Convert to Kelvin

        # Temperature acceleration factor
        temp_factor = np.exp(-self.Ea_cal / self.R * (1/T - 1/self.T_ref))

        # SOC acceleration factor (higher SOC = faster aging)
        soc_factor = 1 + 2 * (avg_soc - 0.5) ** 2

        # Calendar aging follows sqrt(time) relationship
        years = days / 365
        capacity_loss = self.k_cal * np.sqrt(years) * temp_factor * soc_factor

        return capacity_loss

    def calculate_cycle_aging(
        self,
        factors: DegradationFactors
    ) -> float:
        """Calculate capacity loss from cycling"""
        # DOD factor: higher DOD = more degradation
        # LiFePO4 is relatively insensitive to DOD compared to other chemistries
        dod_factor = 0.8 + 0.4 * factors.avg_dod

        # C-rate factor: higher C-rate = more degradation
        c_rate_avg = (factors.avg_c_rate_charge + factors.avg_c_rate_discharge) / 2
        c_rate_factor = 1.0 + 0.3 * max(0, c_rate_avg - 0.5)

        # Temperature factor
        T = factors.avg_temperature + 273.15
        temp_factor = np.exp(-self.Ea_cal / self.R * (1/T - 1/self.T_ref))

        # Extreme temperature penalty
        if factors.max_temperature > 45 or factors.min_temperature < 0:
            temp_factor *= 1.5

        # Cycle aging follows sqrt(N) relationship
        capacity_loss = (
            self.k_cyc *
            np.sqrt(factors.cycle_count) *
            dod_factor *
            c_rate_factor *
            temp_factor
        )

        return capacity_loss

    def predict_degradation(
        self,
        factors: DegradationFactors,
        initial_soh: float = 1.0
    ) -> Dict[str, float]:
        """
        Predict battery degradation

        Returns:
            Dictionary with SOH and contributing factors
        """
        # Calculate aging contributions
        calendar_loss = self.calculate_calendar_aging(
            factors.calendar_days,
            factors.avg_temperature,
            0.5  # Assume average SOC
        )

        cycle_loss = self.calculate_cycle_aging(factors)

        # Total capacity loss (not simply additive - use quadratic sum)
        total_loss = np.sqrt(calendar_loss**2 + cycle_loss**2)

        # Current SOH
        current_soh = max(0, initial_soh - total_loss)

        return {
            "current_soh": current_soh,
            "calendar_loss": calendar_loss,
            "cycle_loss": cycle_loss,
            "total_loss": total_loss,
            "calendar_contribution": calendar_loss / (total_loss + 1e-6),
            "cycle_contribution": cycle_loss / (total_loss + 1e-6),
        }

    def predict_remaining_life(
        self,
        current_soh: float,
        factors: DegradationFactors,
        eol_soh: float = 0.8
    ) -> Dict[str, Any]:
        """Predict remaining useful life"""
        if current_soh <= eol_soh:
            return {
                "remaining_cycles": 0,
                "remaining_years": 0,
                "eol_date": datetime.utcnow(),
            }

        # Estimate degradation rate
        if factors.calendar_days > 0:
            degradation_per_day = (1 - current_soh) / factors.calendar_days
        else:
            degradation_per_day = 0.0001  # Default

        if factors.cycle_count > 0:
            degradation_per_cycle = (1 - current_soh) / factors.cycle_count
        else:
            degradation_per_cycle = 0.00005  # Default

        # Remaining capacity
        remaining = current_soh - eol_soh

        # Estimate remaining life (use more conservative of the two)
        if degradation_per_day > 0:
            days_remaining = remaining / degradation_per_day
        else:
            days_remaining = 3650  # 10 years default

        if degradation_per_cycle > 0:
            cycles_remaining = remaining / degradation_per_cycle
        else:
            cycles_remaining = 6000  # Default

        # Use average cycles per day if available
        if factors.calendar_days > 0 and factors.cycle_count > 0:
            cycles_per_day = factors.cycle_count / factors.calendar_days
            days_from_cycles = cycles_remaining / cycles_per_day if cycles_per_day > 0 else days_remaining

            # Use minimum
            days_remaining = min(days_remaining, days_from_cycles)

        return {
            "remaining_cycles": int(cycles_remaining),
            "remaining_years": days_remaining / 365,
            "remaining_days": int(days_remaining),
            "eol_date": datetime.utcnow() + timedelta(days=days_remaining),
            "degradation_rate_yearly": (1 - current_soh) / (factors.calendar_days / 365 + 0.01) * 100,
        }


class MLDegradationModel:
    """
    Machine learning model for degradation prediction
    Uses historical data to improve predictions
    """

    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path
        self.model = None
        self.scaler = None
        self.is_trained = False

        if SKLEARN_AVAILABLE:
            self.model = GradientBoostingRegressor(
                n_estimators=100,
                max_depth=5,
                learning_rate=0.1,
                random_state=42
            )
            self.scaler = StandardScaler()

    def _prepare_features(self, factors: DegradationFactors) -> np.ndarray:
        """Convert factors to feature vector"""
        features = np.array([
            factors.avg_dod,
            factors.avg_c_rate_charge,
            factors.avg_c_rate_discharge,
            factors.avg_temperature,
            factors.max_temperature,
            factors.min_temperature,
            factors.time_at_high_soc,
            factors.time_at_low_soc,
            factors.calendar_days,
            factors.cycle_count,
            np.sqrt(factors.cycle_count),  # Transformed feature
            factors.calendar_days / 365,  # Years
        ]).reshape(1, -1)

        return features

    def train(
        self,
        training_data: List[Tuple[DegradationFactors, float]]
    ):
        """
        Train the model on historical data

        Args:
            training_data: List of (factors, measured_soh) tuples
        """
        if not SKLEARN_AVAILABLE:
            logger.warning("sklearn not available, ML model disabled")
            return

        X = np.vstack([self._prepare_features(f) for f, _ in training_data])
        y = np.array([soh for _, soh in training_data])

        # Scale features
        X_scaled = self.scaler.fit_transform(X)

        # Train model
        self.model.fit(X_scaled, y)
        self.is_trained = True

        logger.info(f"ML degradation model trained on {len(training_data)} samples")

    def predict(self, factors: DegradationFactors) -> float:
        """Predict SOH using trained model"""
        if not self.is_trained or not SKLEARN_AVAILABLE:
            return None

        X = self._prepare_features(factors)
        X_scaled = self.scaler.transform(X)
        return float(self.model.predict(X_scaled)[0])

    def save(self, path: str):
        """Save trained model"""
        if not self.is_trained:
            return

        with open(path, 'wb') as f:
            pickle.dump({
                'model': self.model,
                'scaler': self.scaler,
            }, f)

    def load(self, path: str) -> bool:
        """Load trained model"""
        try:
            with open(path, 'rb') as f:
                data = pickle.load(f)
                self.model = data['model']
                self.scaler = data['scaler']
                self.is_trained = True
            return True
        except Exception as e:
            logger.error(f"Failed to load model: {e}")
            return False


class DegradationPredictor:
    """
    Main degradation predictor combining physics and ML models
    """

    def __init__(self, model_path: Optional[str] = None):
        self.physics_model = PhysicsBasedModel()
        self.ml_model = MLDegradationModel(model_path)
        self.is_loaded = False
        self._lock = asyncio.Lock()

        # Historical data for model training
        self._history: List[Tuple[DegradationFactors, float]] = []

    async def load_model(self) -> bool:
        """Initialize the predictor"""
        async with self._lock:
            # Try to load ML model if path provided
            if self.ml_model.model_path and Path(self.ml_model.model_path).exists():
                self.ml_model.load(self.ml_model.model_path)

            self.is_loaded = True
            logger.info("Degradation predictor initialized")
            return True

    async def predict(
        self,
        factors: DegradationFactors,
        use_ml: bool = True
    ) -> DegradationPrediction:
        """
        Predict battery degradation and remaining life

        Args:
            factors: Current degradation factors
            use_ml: Whether to use ML model (if trained)

        Returns:
            DegradationPrediction with full analysis
        """
        async with self._lock:
            # Physics-based prediction
            physics_result = self.physics_model.predict_degradation(factors)
            physics_soh = physics_result["current_soh"]

            # ML prediction (if available)
            ml_soh = None
            if use_ml and self.ml_model.is_trained:
                ml_soh = self.ml_model.predict(factors)

            # Combine predictions (if both available)
            if ml_soh is not None:
                # Weighted average favoring ML if well-trained
                current_soh = 0.3 * physics_soh + 0.7 * ml_soh
                confidence = 0.85
            else:
                current_soh = physics_soh
                confidence = 0.7

            # Remaining life prediction
            life_pred = self.physics_model.predict_remaining_life(current_soh, factors)

            # Future SOH predictions
            future_factors_1y = DegradationFactors(
                **{**factors.__dict__, 'calendar_days': factors.calendar_days + 365}
            )
            future_factors_3y = DegradationFactors(
                **{**factors.__dict__, 'calendar_days': factors.calendar_days + 1095}
            )
            future_factors_5y = DegradationFactors(
                **{**factors.__dict__, 'calendar_days': factors.calendar_days + 1825}
            )

            # Estimate future cycles
            if factors.calendar_days > 0 and factors.cycle_count > 0:
                cycles_per_year = factors.cycle_count / (factors.calendar_days / 365)
                future_factors_1y.cycle_count = factors.cycle_count + cycles_per_year
                future_factors_3y.cycle_count = factors.cycle_count + cycles_per_year * 3
                future_factors_5y.cycle_count = factors.cycle_count + cycles_per_year * 5

            soh_1y = self.physics_model.predict_degradation(future_factors_1y)["current_soh"]
            soh_3y = self.physics_model.predict_degradation(future_factors_3y)["current_soh"]
            soh_5y = self.physics_model.predict_degradation(future_factors_5y)["current_soh"]

            # Identify primary stressor
            if physics_result["calendar_contribution"] > physics_result["cycle_contribution"]:
                primary_stressor = "calendar_aging"
            else:
                primary_stressor = "cycle_aging"

            # Generate recommendations
            recommendations = self._generate_recommendations(factors, physics_result)

            return DegradationPrediction(
                current_soh=current_soh,
                predicted_soh_1year=soh_1y,
                predicted_soh_3year=soh_3y,
                predicted_soh_5year=soh_5y,
                remaining_cycles=life_pred["remaining_cycles"],
                remaining_years=life_pred["remaining_years"],
                eol_date=life_pred["eol_date"],
                degradation_rate=life_pred.get("degradation_rate_yearly", 0),
                primary_stressor=primary_stressor,
                recommendations=recommendations,
                confidence=confidence,
            )

    def _generate_recommendations(
        self,
        factors: DegradationFactors,
        result: Dict[str, float]
    ) -> List[str]:
        """Generate recommendations based on usage patterns"""
        recommendations = []

        # Temperature recommendations
        if factors.avg_temperature > 35:
            recommendations.append(
                "Consider improving cooling to reduce average temperature below 35°C"
            )
        elif factors.avg_temperature < 15:
            recommendations.append(
                "Consider heating system to maintain temperature above 15°C"
            )

        # DOD recommendations
        if factors.avg_dod > 0.9:
            recommendations.append(
                "Reducing average DOD from {:.0%} to 80% could extend life by ~15%".format(factors.avg_dod)
            )

        # C-rate recommendations
        if factors.avg_c_rate_charge > 0.7:
            recommendations.append(
                "Reducing average charge rate could improve longevity"
            )

        # High SOC time
        if factors.time_at_high_soc > 0.3:
            recommendations.append(
                "Reducing time at high SOC (>90%) can reduce calendar aging"
            )

        # Low SOC time
        if factors.time_at_low_soc > 0.2:
            recommendations.append(
                "Avoid extended periods at low SOC (<20%) to prevent degradation"
            )

        # General maintenance
        if not recommendations:
            recommendations.append(
                "Current usage patterns are within optimal parameters"
            )

        return recommendations

    async def record_measurement(
        self,
        factors: DegradationFactors,
        measured_soh: float
    ):
        """Record a SOH measurement for ML training"""
        async with self._lock:
            self._history.append((factors, measured_soh))

            # Retrain ML model periodically
            if len(self._history) >= 50 and len(self._history) % 10 == 0:
                self.ml_model.train(self._history)

    async def get_degradation_trajectory(
        self,
        factors: DegradationFactors,
        years: int = 10,
        points_per_year: int = 12
    ) -> Dict[str, List]:
        """Get predicted SOH trajectory over time"""
        dates = []
        soh_values = []
        cycles = []

        base_date = datetime.utcnow()

        # Calculate cycles per day
        if factors.calendar_days > 0:
            cycles_per_day = factors.cycle_count / factors.calendar_days
        else:
            cycles_per_day = 1.0

        for i in range(years * points_per_year + 1):
            months = i * (12 / points_per_year)
            days = int(months * 30)

            future_factors = DegradationFactors(
                avg_dod=factors.avg_dod,
                avg_c_rate_charge=factors.avg_c_rate_charge,
                avg_c_rate_discharge=factors.avg_c_rate_discharge,
                avg_temperature=factors.avg_temperature,
                max_temperature=factors.max_temperature,
                min_temperature=factors.min_temperature,
                time_at_high_soc=factors.time_at_high_soc,
                time_at_low_soc=factors.time_at_low_soc,
                calendar_days=factors.calendar_days + days,
                cycle_count=factors.cycle_count + cycles_per_day * days,
            )

            result = self.physics_model.predict_degradation(future_factors)

            dates.append((base_date + timedelta(days=days)).isoformat())
            soh_values.append(result["current_soh"])
            cycles.append(int(future_factors.cycle_count))

        return {
            "dates": dates,
            "soh": soh_values,
            "cycles": cycles,
            "eol_threshold": 0.8,
        }

    def to_dict(self, prediction: DegradationPrediction) -> Dict[str, Any]:
        """Convert prediction to dictionary"""
        return {
            "current_soh": round(prediction.current_soh * 100, 1),
            "predicted_soh": {
                "1_year": round(prediction.predicted_soh_1year * 100, 1),
                "3_years": round(prediction.predicted_soh_3year * 100, 1),
                "5_years": round(prediction.predicted_soh_5year * 100, 1),
            },
            "remaining_life": {
                "cycles": prediction.remaining_cycles,
                "years": round(prediction.remaining_years, 1),
                "eol_date": prediction.eol_date.isoformat(),
            },
            "degradation_rate_percent_per_year": round(prediction.degradation_rate, 2),
            "primary_stressor": prediction.primary_stressor,
            "recommendations": prediction.recommendations,
            "confidence_percent": round(prediction.confidence * 100, 1),
        }


# Singleton instance
degradation_predictor = DegradationPredictor()
