"""Tests for ONNX conversion pipeline."""
import pytest
import numpy as np
import os
import tempfile


def test_onnx_converter_creates_file():
    """Test that ONNX converter produces a valid file."""
    pytest.importorskip("xgboost")
    pytest.importorskip("skl2onnx")

    import xgboost as xgb
    from src.training.feature_engineering import FeatureEngineer
    from src.training.data_loader import DataLoader
    from src.deployment.onnx_converter import ONNXConverter

    loader = DataLoader()
    data = loader._generate_synthetic(days=10)
    fe = FeatureEngineer()
    X_train, X_val, y_train, y_val = fe.prepare(data)

    model = xgb.XGBRegressor(n_estimators=10, random_state=42, tree_method="hist")
    model.fit(X_train, y_train, verbose=False)

    with tempfile.TemporaryDirectory() as tmpdir:
        os.environ["MODEL_DIR"] = tmpdir
        converter = ONNXConverter()
        path = converter.convert(model, system_id="test-sys", n_features=X_train.shape[1])
        assert os.path.exists(path)
        assert path.endswith(".onnx")
