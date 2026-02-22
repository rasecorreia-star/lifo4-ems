"""Tests for feature engineering and evaluator."""
import pytest
import numpy as np

from src.training.data_loader import DataLoader
from src.training.feature_engineering import FeatureEngineer
from src.training.evaluator import ModelEvaluator


def test_feature_engineering_shape():
    loader = DataLoader()
    data = loader._generate_synthetic(days=5)
    assert data.shape[1] == 5  # [timestamp, load, soc, temp, price]

    fe = FeatureEngineer()
    X_train, X_val, y_train, y_val = fe.prepare(data, val_fraction=0.2)
    assert X_train.shape[1] == 16  # 16 features
    assert len(X_train) + len(X_val) == len(data)


def test_evaluator_metrics():
    y_true = np.array([50.0, 60.0, 70.0, 80.0])
    y_pred = np.array([52.0, 58.0, 72.0, 78.0])

    class FakeModel:
        def predict(self, X):
            return y_pred

    evaluator = ModelEvaluator()
    metrics = evaluator.evaluate(FakeModel(), X_val=np.zeros((4, 1)), y_val=y_true)
    assert "mape" in metrics
    assert "rmse" in metrics
    assert "mae" in metrics
    assert metrics["mape"] > 0
