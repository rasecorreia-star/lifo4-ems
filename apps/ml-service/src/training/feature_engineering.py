"""
Feature Engineering -- transforms raw telemetry into ML-ready features.
"""
import numpy as np
from typing import Tuple
import structlog

log = structlog.get_logger()


class FeatureEngineer:
    """Transforms raw telemetry into features for model training."""

    def prepare(
        self,
        data: np.ndarray,
        val_fraction: float = 0.2,
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Prepare features and targets for training.
        Input: (N, 5) array [timestamp, load_kw, soc, temperature, price]
        Output: (X_train, X_val, y_train, y_val)
        """
        timestamps = data[:, 0]
        load = data[:, 1]
        soc = data[:, 2]
        temp = data[:, 3]
        price = data[:, 4]

        # Datetime features
        hours = (timestamps % 86400) / 3600
        hour_sin = np.sin(2 * np.pi * hours / 24)
        hour_cos = np.cos(2 * np.pi * hours / 24)
        day_of_week = ((timestamps // 86400) % 7)
        dow_sin = np.sin(2 * np.pi * day_of_week / 7)
        dow_cos = np.cos(2 * np.pi * day_of_week / 7)
        is_weekend = (day_of_week >= 5).astype(float)
        is_peak = ((hours >= 18) & (hours < 21) & (~is_weekend.astype(bool))).astype(float)

        # Lag features (1h, 2h, 24h)
        steps_1h = 12   # 12 x 5min = 1h
        steps_2h = 24
        steps_24h = 288

        def lag(arr, n):
            lagged = np.roll(arr, n)
            lagged[:n] = arr[0]
            return lagged

        # Moving average 1h
        ma_1h = np.convolve(load, np.ones(steps_1h) / steps_1h, mode="same")

        X = np.column_stack([
            hour_sin, hour_cos, dow_sin, dow_cos, is_weekend, is_peak,
            soc, temp, price,
            lag(load, steps_1h), lag(load, steps_2h), lag(load, steps_24h),
            ma_1h,
            np.gradient(load),  # rate of change
            np.gradient(soc),
            np.gradient(temp),
        ])
        y = load  # Predict next load

        # Temporal train/val split (no shuffle -- preserve time order)
        split = int(len(X) * (1 - val_fraction))
        return X[:split], X[split:], y[:split], y[split:]
