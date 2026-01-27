"""
State Estimator for Battery Digital Twin
Provides SOC, SOH, and power estimation using Kalman filtering and ML
"""

import logging
import asyncio
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from datetime import datetime, timedelta
import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class BatteryState:
    """Current estimated battery state"""
    soc: float  # State of Charge (0-1)
    soh: float  # State of Health (0-1)
    sop_charge: float  # State of Power - max charge (kW)
    sop_discharge: float  # State of Power - max discharge (kW)
    internal_resistance: float  # Estimated resistance (Ohms)
    temperature: float  # Estimated core temperature (C)
    timestamp: datetime
    confidence: float  # Estimation confidence (0-1)


@dataclass
class EstimatorConfig:
    """Configuration for state estimator"""
    nominal_capacity: float = 100.0  # Ah
    nominal_voltage: float = 51.2  # V
    cells_in_series: int = 16
    max_charge_power: float = 50.0  # kW
    max_discharge_power: float = 100.0  # kW
    min_soc: float = 0.1
    max_soc: float = 0.95
    process_noise: float = 0.001
    measurement_noise: float = 0.01


class ExtendedKalmanFilter:
    """
    Extended Kalman Filter for battery state estimation
    State vector: [SOC, internal_resistance]
    """

    def __init__(self, config: EstimatorConfig):
        self.config = config

        # State vector [SOC, R_internal]
        self.x = np.array([0.5, 0.01])

        # State covariance
        self.P = np.diag([0.01, 0.001])

        # Process noise covariance
        self.Q = np.diag([config.process_noise, config.process_noise * 0.1])

        # Measurement noise covariance
        self.R = np.array([[config.measurement_noise]])

        # OCV lookup table (LiFePO4)
        self._soc_points = np.array([0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0])
        self._ocv_points = np.array([2.5, 3.0, 3.15, 3.2, 3.22, 3.25, 3.27, 3.3, 3.32, 3.35, 3.65])

    def predict(self, current: float, dt: float):
        """
        Predict step

        Args:
            current: Battery current (A), positive = discharge
            dt: Time step (s)
        """
        soc, r_int = self.x

        # State transition: SOC changes with current
        delta_soc = -current * dt / (self.config.nominal_capacity * 3600)

        # Predicted state
        soc_pred = np.clip(soc + delta_soc, 0, 1)
        r_pred = r_int  # Resistance assumed constant over short time

        self.x = np.array([soc_pred, r_pred])

        # State transition Jacobian
        F = np.array([
            [1, 0],
            [0, 1]
        ])

        # Update covariance
        self.P = F @ self.P @ F.T + self.Q

    def update(self, voltage: float, current: float):
        """
        Update step with voltage measurement

        Args:
            voltage: Terminal voltage (V)
            current: Battery current (A)
        """
        soc, r_int = self.x

        # Expected OCV
        cell_ocv = np.interp(soc, self._soc_points, self._ocv_points)
        pack_ocv = cell_ocv * self.config.cells_in_series

        # Expected terminal voltage
        v_expected = pack_ocv - current * r_int

        # Measurement residual
        y = voltage - v_expected

        # Measurement Jacobian
        # dV/dSOC = dOCV/dSOC * cells_in_series
        docv_dsoc = np.interp(
            soc,
            self._soc_points[:-1] + 0.05,
            np.diff(self._ocv_points) / np.diff(self._soc_points)
        )
        H = np.array([[docv_dsoc * self.config.cells_in_series, -current]])

        # Kalman gain
        S = H @ self.P @ H.T + self.R
        K = self.P @ H.T @ np.linalg.inv(S)

        # Update state
        self.x = self.x + (K @ np.array([y])).flatten()
        self.x[0] = np.clip(self.x[0], 0, 1)
        self.x[1] = np.clip(self.x[1], 0.001, 0.1)

        # Update covariance
        I = np.eye(2)
        self.P = (I - K @ H) @ self.P

    def get_state(self) -> Tuple[float, float]:
        """Get current estimated SOC and resistance"""
        return float(self.x[0]), float(self.x[1])

    def get_confidence(self) -> float:
        """Get estimation confidence based on covariance"""
        # Lower covariance = higher confidence
        soc_variance = self.P[0, 0]
        confidence = 1.0 - min(1.0, soc_variance * 10)
        return confidence

    def reset(self, initial_soc: float = 0.5, initial_resistance: float = 0.01):
        """Reset filter state"""
        self.x = np.array([initial_soc, initial_resistance])
        self.P = np.diag([0.01, 0.001])


class SOHEstimator:
    """
    State of Health estimator using capacity fade and resistance increase
    """

    def __init__(self, nominal_capacity: float = 100.0):
        self.nominal_capacity = nominal_capacity
        self.capacity_history: List[Tuple[datetime, float]] = []
        self.resistance_history: List[Tuple[datetime, float]] = []
        self.cycle_count = 0

    def update_capacity_measurement(self, measured_capacity: float, timestamp: datetime):
        """Record a capacity measurement"""
        self.capacity_history.append((timestamp, measured_capacity))
        # Keep last 100 measurements
        if len(self.capacity_history) > 100:
            self.capacity_history.pop(0)

    def update_resistance_measurement(self, measured_resistance: float, timestamp: datetime):
        """Record a resistance measurement"""
        self.resistance_history.append((timestamp, measured_resistance))
        if len(self.resistance_history) > 100:
            self.resistance_history.pop(0)

    def increment_cycle(self, dod: float = 1.0):
        """Increment cycle count (with partial cycles)"""
        self.cycle_count += dod

    def estimate_soh(self) -> Dict[str, float]:
        """
        Estimate SOH based on capacity and resistance measurements

        Returns:
            Dictionary with soh, capacity_soh, resistance_soh
        """
        # Capacity-based SOH
        if self.capacity_history:
            recent_capacity = np.mean([c for _, c in self.capacity_history[-10:]])
            capacity_soh = recent_capacity / self.nominal_capacity
        else:
            capacity_soh = 1.0

        # Resistance-based SOH (assuming 50% increase at EOL)
        if self.resistance_history:
            initial_r = self.resistance_history[0][1] if self.resistance_history else 0.01
            current_r = np.mean([r for _, r in self.resistance_history[-10:]])
            resistance_increase = current_r / initial_r
            resistance_soh = max(0, 1.0 - (resistance_increase - 1.0) * 2)
        else:
            resistance_soh = 1.0

        # Combined SOH (weighted average)
        combined_soh = 0.7 * capacity_soh + 0.3 * resistance_soh

        return {
            "soh": np.clip(combined_soh, 0, 1),
            "capacity_soh": np.clip(capacity_soh, 0, 1),
            "resistance_soh": np.clip(resistance_soh, 0, 1),
            "cycle_count": self.cycle_count,
        }

    def predict_remaining_life(
        self,
        current_soh: float,
        cycles_per_month: float = 30
    ) -> Dict[str, Any]:
        """Predict remaining useful life"""
        eol_soh = 0.8
        if current_soh <= eol_soh:
            return {
                "months_remaining": 0,
                "cycles_remaining": 0,
                "eol_date": datetime.utcnow().isoformat(),
            }

        # Simple linear extrapolation
        if len(self.capacity_history) >= 2:
            times = [t.timestamp() for t, _ in self.capacity_history[-10:]]
            capacities = [c for _, c in self.capacity_history[-10:]]

            if len(times) >= 2 and times[-1] > times[0]:
                # Fade rate per second
                fade_rate = (capacities[0] - capacities[-1]) / (times[-1] - times[0])
                if fade_rate > 0:
                    remaining_capacity = self.nominal_capacity * (current_soh - eol_soh)
                    seconds_remaining = remaining_capacity / fade_rate
                    months_remaining = seconds_remaining / (30 * 24 * 3600)
                else:
                    months_remaining = 120  # Default 10 years if no degradation

                eol_date = datetime.utcnow() + timedelta(seconds=seconds_remaining)
            else:
                months_remaining = 120
                eol_date = datetime.utcnow() + timedelta(days=3650)
        else:
            # Default based on typical LiFePO4 life
            remaining_soh = current_soh - eol_soh
            cycles_remaining = remaining_soh * 6000 / 0.2  # Assuming 6000 cycles to 80% SOH
            months_remaining = cycles_remaining / cycles_per_month
            eol_date = datetime.utcnow() + timedelta(days=months_remaining * 30)

        return {
            "months_remaining": int(months_remaining),
            "cycles_remaining": int(months_remaining * cycles_per_month),
            "eol_date": eol_date.isoformat(),
            "confidence": 0.7 if len(self.capacity_history) >= 10 else 0.5,
        }


class StateEstimator:
    """
    Main state estimator combining Kalman filter, SOH estimation, and power limits
    """

    def __init__(self, config: Optional[EstimatorConfig] = None):
        self.config = config or EstimatorConfig()
        self.ekf = ExtendedKalmanFilter(self.config)
        self.soh_estimator = SOHEstimator(self.config.nominal_capacity)
        self.is_loaded = False
        self._lock = asyncio.Lock()

        # Temperature estimation
        self._temperature = 25.0
        self._ambient_temperature = 25.0

        # State history for analytics
        self._state_history: List[BatteryState] = []

    async def load_model(self) -> bool:
        """Initialize the estimator"""
        self.is_loaded = True
        logger.info("State estimator initialized")
        return True

    async def update(
        self,
        voltage: float,
        current: float,
        temperature: Optional[float] = None,
        dt: float = 1.0
    ) -> BatteryState:
        """
        Update state estimate with new measurements

        Args:
            voltage: Terminal voltage (V)
            current: Current (A), positive = discharge
            temperature: Measured temperature (C), optional
            dt: Time step since last update (s)

        Returns:
            Updated BatteryState
        """
        async with self._lock:
            # Update temperature
            if temperature is not None:
                self._temperature = temperature

            # EKF predict and update
            self.ekf.predict(current, dt)
            self.ekf.update(voltage, current)

            soc, resistance = self.ekf.get_state()

            # Update SOH estimator
            self.soh_estimator.update_resistance_measurement(resistance, datetime.utcnow())

            # Track cycles
            if abs(current) > 0.1:
                delta_soc = abs(current * dt / (self.config.nominal_capacity * 3600))
                self.soh_estimator.increment_cycle(delta_soc / 2)  # Half cycle

            # Get SOH
            soh_result = self.soh_estimator.estimate_soh()

            # Calculate power limits
            sop_charge, sop_discharge = self._calculate_power_limits(
                soc, resistance, self._temperature
            )

            state = BatteryState(
                soc=soc,
                soh=soh_result["soh"],
                sop_charge=sop_charge,
                sop_discharge=sop_discharge,
                internal_resistance=resistance,
                temperature=self._temperature,
                timestamp=datetime.utcnow(),
                confidence=self.ekf.get_confidence(),
            )

            # Store history
            self._state_history.append(state)
            if len(self._state_history) > 1000:
                self._state_history.pop(0)

            return state

    def _calculate_power_limits(
        self,
        soc: float,
        resistance: float,
        temperature: float
    ) -> Tuple[float, float]:
        """Calculate state of power limits"""
        # Base limits
        max_charge = self.config.max_charge_power
        max_discharge = self.config.max_discharge_power

        # SOC limits
        if soc > 0.9:
            charge_factor = (self.config.max_soc - soc) / (self.config.max_soc - 0.9)
        else:
            charge_factor = 1.0

        if soc < 0.2:
            discharge_factor = (soc - self.config.min_soc) / (0.2 - self.config.min_soc)
        else:
            discharge_factor = 1.0

        # Temperature limits
        if temperature < 0:
            temp_charge_factor = 0.2  # Very limited charging below freezing
            temp_discharge_factor = 0.5
        elif temperature < 10:
            temp_charge_factor = 0.5
            temp_discharge_factor = 0.8
        elif temperature > 45:
            temp_charge_factor = 0.5
            temp_discharge_factor = 0.5
        else:
            temp_charge_factor = 1.0
            temp_discharge_factor = 1.0

        # Resistance derating (higher resistance = lower power)
        r_factor = 1.0 / (1.0 + (resistance - 0.01) * 10)

        sop_charge = max_charge * charge_factor * temp_charge_factor * r_factor
        sop_discharge = max_discharge * discharge_factor * temp_discharge_factor * r_factor

        return max(0, sop_charge), max(0, sop_discharge)

    async def get_current_state(self) -> Optional[BatteryState]:
        """Get the most recent state estimate"""
        if self._state_history:
            return self._state_history[-1]
        return None

    async def get_state_history(
        self,
        minutes: int = 60
    ) -> List[BatteryState]:
        """Get state history for the last N minutes"""
        cutoff = datetime.utcnow() - timedelta(minutes=minutes)
        return [s for s in self._state_history if s.timestamp > cutoff]

    async def estimate_from_telemetry(
        self,
        telemetry_data: List[Dict[str, Any]]
    ) -> BatteryState:
        """
        Process a batch of telemetry data to estimate current state

        Args:
            telemetry_data: List of telemetry readings with voltage, current, timestamp

        Returns:
            Final estimated state
        """
        state = None
        prev_time = None

        for reading in sorted(telemetry_data, key=lambda x: x.get('timestamp', 0)):
            timestamp = reading.get('timestamp')
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            elif isinstance(timestamp, (int, float)):
                timestamp = datetime.fromtimestamp(timestamp)

            if prev_time is not None:
                dt = (timestamp - prev_time).total_seconds()
            else:
                dt = 1.0

            state = await self.update(
                voltage=reading.get('voltage', reading.get('packVoltage', 0)),
                current=reading.get('current', 0),
                temperature=reading.get('temperature', None),
                dt=dt
            )
            prev_time = timestamp

        return state

    async def calibrate(
        self,
        actual_soc: float,
        actual_capacity: Optional[float] = None
    ):
        """
        Calibrate estimator with known values

        Args:
            actual_soc: Known SOC (e.g., from full charge)
            actual_capacity: Known capacity (e.g., from capacity test)
        """
        async with self._lock:
            self.ekf.reset(initial_soc=actual_soc)

            if actual_capacity is not None:
                self.soh_estimator.update_capacity_measurement(
                    actual_capacity,
                    datetime.utcnow()
                )

            logger.info(f"Estimator calibrated: SOC={actual_soc:.2f}")

    def to_dict(self, state: BatteryState) -> Dict[str, Any]:
        """Convert state to dictionary"""
        return {
            "soc": round(state.soc * 100, 1),
            "soh": round(state.soh * 100, 1),
            "sop_charge_kw": round(state.sop_charge, 2),
            "sop_discharge_kw": round(state.sop_discharge, 2),
            "internal_resistance_mohm": round(state.internal_resistance * 1000, 2),
            "temperature_c": round(state.temperature, 1),
            "timestamp": state.timestamp.isoformat(),
            "confidence": round(state.confidence * 100, 1),
        }


# Singleton instance
state_estimator = StateEstimator()
