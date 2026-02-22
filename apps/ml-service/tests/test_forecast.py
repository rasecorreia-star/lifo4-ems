"""Tests for forecast models."""
import pytest
import numpy as np

from src.models.load_forecast import LoadForecastModel
from src.models.price_forecast import PriceForecastModel
from src.models.soh_estimator import SoHEstimator
from src.models.anomaly_detector import AnomalyDetector


def test_load_forecast_heuristic():
    model = LoadForecastModel()
    result = model.predict(system_id="test-001", horizon_hours=24)
    assert result["system_id"] == "test-001"
    assert result["horizon_hours"] == 24
    assert len(result["predictions"]) == 24
    assert all(p["load_kw"] > 0 for p in result["predictions"])


def test_price_forecast():
    model = PriceForecastModel()
    result = model.predict(system_id="test-001", horizon_hours=24)
    assert len(result["predictions"]) == 24
    assert all(0.20 <= p["price_brl_kwh"] <= 1.20 for p in result["predictions"])


def test_soh_estimator():
    estimator = SoHEstimator()
    result = estimator.estimate(system_id="test-001")
    assert 80.0 <= result["soh_percent"] <= 100.0
    assert result["risk_level"] in ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    assert len(result["recommendations"]) > 0


def test_anomaly_detector_no_anomalies():
    detector = AnomalyDetector()
    anomalies = detector.detect(system_id="test-001", lookback_hours=24)
    assert isinstance(anomalies, list)
