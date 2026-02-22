"""
Model Evaluator -- computes MAPE, RMSE, MAE metrics.
"""
import numpy as np
import structlog

log = structlog.get_logger()


class ModelEvaluator:
    """Evaluates ML model performance."""

    def evaluate(self, model, X_val: np.ndarray, y_val: np.ndarray) -> dict:
        """Compute regression metrics for the given model and validation set."""
        predictions = model.predict(X_val)
        mae = float(np.mean(np.abs(y_val - predictions)))
        rmse = float(np.sqrt(np.mean((y_val - predictions) ** 2)))
        # MAPE: avoid division by zero
        mask = y_val != 0
        mape = float(np.mean(np.abs((y_val[mask] - predictions[mask]) / y_val[mask])) * 100)
        log.info("model_evaluated", mape=round(mape, 2), rmse=round(rmse, 2), mae=round(mae, 2))
        return {"mape": round(mape, 2), "rmse": round(rmse, 2), "mae": round(mae, 2)}
