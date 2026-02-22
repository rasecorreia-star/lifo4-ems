"""
ONNX Converter -- converts trained sklearn/XGBoost models to ONNX format.
"""
import os
import structlog

log = structlog.get_logger()

MODEL_DIR = os.getenv("MODEL_DIR", "/app/models")


class ONNXConverter:
    """Converts trained models to ONNX format for edge deployment."""

    def convert(self, model, system_id: str, n_features: int) -> str:
        """
        Convert XGBoost model to ONNX. Returns path to .onnx file.
        """
        try:
            from skl2onnx import convert_sklearn
            from skl2onnx.common.data_types import FloatTensorType

            onnx_model = convert_sklearn(
                model,
                initial_types=[("input", FloatTensorType([None, n_features]))],
                target_opset=17,
            )
            out_dir = os.path.join(MODEL_DIR, system_id)
            os.makedirs(out_dir, exist_ok=True)
            out_path = os.path.join(out_dir, "load_forecast.onnx")
            with open(out_path, "wb") as f:
                f.write(onnx_model.SerializeToString())
            log.info("onnx_conversion_done", system_id=system_id, path=out_path)
            return out_path
        except ImportError:
            # Fallback: try onnxmltools for XGBoost native
            try:
                import onnxmltools
                from onnxmltools.convert import convert_xgboost
                from onnxmltools.utils import save_model
                from skl2onnx.common.data_types import FloatTensorType

                onnx_model = convert_xgboost(model, initial_types=[("input", FloatTensorType([None, n_features]))])
                out_dir = os.path.join(MODEL_DIR, system_id)
                os.makedirs(out_dir, exist_ok=True)
                out_path = os.path.join(out_dir, "load_forecast.onnx")
                save_model(onnx_model, out_path)
                return out_path
            except Exception as e2:
                log.error("onnx_conversion_failed", system_id=system_id, error=str(e2))
                raise
