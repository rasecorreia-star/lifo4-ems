"""
Model Trainer — orchestrates end-to-end ML training pipeline.
Train -> Evaluate -> Compare -> Convert ONNX -> Deploy to edges.
"""
import asyncio
import uuid
import json
import os
from datetime import datetime, timezone
from typing import Optional
import structlog

from src.training.data_loader import DataLoader
from src.training.feature_engineering import FeatureEngineer
from src.training.evaluator import ModelEvaluator
from src.training.hyperparameter import tune_xgboost
from src.deployment.onnx_converter import ONNXConverter
from src.deployment.edge_deployer import EdgeDeployer
from src.deployment.model_registry import ModelRegistry

log = structlog.get_logger()

MODEL_DIR = os.getenv("MODEL_DIR", "/app/models")


class ModelTrainer:
    """Orchestrates full ML training pipeline."""

    def __init__(self):
        self._jobs: dict[str, dict] = {}
        self._data_loader = DataLoader()
        self._feature_engineer = FeatureEngineer()
        self._evaluator = ModelEvaluator()
        self._onnx_converter = ONNXConverter()
        self._edge_deployer = EdgeDeployer()
        self._registry = ModelRegistry()

    async def trigger_training(self, system_id: str, force: bool = False) -> str:
        """Start async training job. Returns job_id."""
        job_id = str(uuid.uuid4())[:8]
        self._jobs[job_id] = {
            "system_id": system_id,
            "status": "started",
            "started_at": datetime.now(timezone.utc).isoformat(),
        }
        asyncio.create_task(self._run_training(system_id, job_id, force))
        return job_id

    async def _run_training(self, system_id: str, job_id: str, force: bool):
        """Full training pipeline (runs in background)."""
        try:
            log.info("training_started", system_id=system_id, job_id=job_id)

            # 1. Load data
            data = await self._data_loader.load(system_id=system_id, days=90)
            if len(data) < 30 * 24 * 12:  # need 30 days at 5s intervals
                log.warning("insufficient_data", system_id=system_id, points=len(data))
                self._jobs[job_id]["status"] = "skipped_insufficient_data"
                return

            # 2. Feature engineering
            X_train, X_val, y_train, y_val = self._feature_engineer.prepare(data)

            # 3. Tune hyperparameters and train XGBoost model
            import xgboost as xgb
            best_params = tune_xgboost(X_train, y_train, X_val, y_val, n_trials=30)
            model = xgb.XGBRegressor(
                **best_params,
                random_state=42,
                tree_method="hist",
            )
            model.fit(X_train, y_train, eval_set=[(X_val, y_val)], verbose=False)

            # 4. Evaluate
            metrics = self._evaluator.evaluate(model, X_val, y_val)
            log.info("training_metrics", system_id=system_id, **metrics)

            # 5. Check if new model is better than current
            current_meta = self.get_model_info(system_id)
            if not force and current_meta and metrics["mape"] >= current_meta.get("mape", 999):
                log.info("model_not_improved", system_id=system_id, new_mape=metrics["mape"], old_mape=current_meta["mape"])
                self._jobs[job_id]["status"] = "skipped_not_improved"
                return

            # 6. Convert to ONNX
            onnx_path = self._onnx_converter.convert(model, system_id, X_train.shape[1])

            # 7. Save metadata
            meta = {
                "version": f"v{datetime.now().strftime('%Y%m%d_%H%M')}",
                "mape": metrics["mape"],
                "rmse": metrics["rmse"],
                "mae": metrics["mae"],
                "trained_at": datetime.now(timezone.utc).isoformat(),
                "data_points_used": len(data),
                "last_deployed_at": None,
            }
            os.makedirs(os.path.join(MODEL_DIR, system_id), exist_ok=True)
            meta_path = os.path.join(MODEL_DIR, system_id, "load_forecast_meta.json")
            with open(meta_path, "w") as f:
                json.dump(meta, f)

            # 8. Register model in registry
            self._registry.register(system_id, "load_forecast", meta)

            # 9. Deploy to edge
            await self._edge_deployer.deploy(system_id=system_id, onnx_path=onnx_path, metadata=meta)

            self._jobs[job_id]["status"] = "completed"
            self._jobs[job_id]["metrics"] = metrics
            log.info("training_completed", system_id=system_id, job_id=job_id, mape=metrics["mape"])

        except Exception as e:
            log.error("training_failed", system_id=system_id, job_id=job_id, error=str(e))
            self._jobs[job_id]["status"] = "failed"
            self._jobs[job_id]["error"] = str(e)

    def get_model_info(self, system_id: str) -> Optional[dict]:
        """Returns metadata of the current deployed model."""
        meta_path = os.path.join(MODEL_DIR, system_id, "load_forecast_meta.json")
        if not os.path.exists(meta_path):
            return None
        with open(meta_path) as f:
            meta = json.load(f)
        meta["system_id"] = system_id
        return meta

    def get_all_models_status(self) -> list[dict]:
        """Returns status of all models in MODEL_DIR."""
        statuses = []
        if not os.path.exists(MODEL_DIR):
            return statuses
        for system_id in os.listdir(MODEL_DIR):
            info = self.get_model_info(system_id)
            if info:
                statuses.append(info)
        return statuses
