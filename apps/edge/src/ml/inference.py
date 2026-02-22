"""
Local ML Inference -- runs ONNX models on the edge device.
Handles model loading, inference, and receiving new models via MQTT.
"""
import os
import json
import hashlib
import base64
import asyncio
from datetime import datetime, timezone
from typing import Optional
import numpy as np
import structlog

log = structlog.get_logger()

MODEL_DIR = os.getenv("MODEL_DIR", "/app/models")


class LocalInference:
    """
    Executes ML models locally on the edge using ONNX Runtime.
    Operates fully offline -- does not require cloud connectivity for inference.
    """

    def __init__(self, system_id: str):
        self.system_id = system_id
        self._session: Optional[object] = None
        self._model_version: Optional[str] = None
        self._metadata: dict = {}
        self._previous_session: Optional[object] = None
        self._previous_metadata: dict = {}

    def load_model(self, model_file: str = "load_forecast.onnx") -> bool:
        """Load ONNX model from disk. Returns True if successful."""
        try:
            import onnxruntime as ort
            model_path = os.path.join(MODEL_DIR, self.system_id, model_file)
            if not os.path.exists(model_path):
                log.info("no_onnx_model_found", system_id=self.system_id, path=model_path)
                return False
            self._session = ort.InferenceSession(model_path, providers=["CPUExecutionProvider"])
            self._model_version = model_file
            log.info("onnx_model_loaded", system_id=self.system_id, model=model_file)
            return True
        except Exception as e:
            log.error("onnx_load_error", system_id=self.system_id, error=str(e))
            return False

    def predict_load(self, features: np.ndarray) -> np.ndarray:
        """
        Predict load for next 24h from feature vector.
        Input: features array (1, n_features) float32
        Output: predicted load values (kW) array
        Falls back to time-of-day heuristic if no model loaded.
        """
        if self._session is not None:
            try:
                result = self._session.run(None, {"input": features.astype(np.float32)})
                return result[0].flatten()
            except Exception as e:
                log.error("onnx_inference_error", system_id=self.system_id, error=str(e))

        # Heuristic fallback
        return self._heuristic_load_24h()

    def predict_soh(self, battery_data: dict) -> float:
        """
        Estimate State of Health from battery operational data.
        Input: {cycles, avg_dod, avg_temp, internal_resistance_ohm}
        Output: SoH estimate 0-100%
        """
        cycles = battery_data.get("cycles", 0)
        avg_dod = battery_data.get("avg_dod", 50.0)
        avg_temp = battery_data.get("avg_temp", 25.0)

        # Simplified linear model (matches cloud SoHEstimator)
        temp_factor = 1.0 + max(0, (avg_temp - 25.0)) * 0.02
        dod_factor = 1.0 + max(0, (avg_dod - 50.0)) / 100.0
        monthly_rate = 0.20 * temp_factor

        # Approximate months from cycles (avg 2 cycles/day)
        months = cycles / 60
        soh = 100.0 - (monthly_rate * months) - (cycles * 0.00005 * dod_factor * 100)
        return max(80.0, min(100.0, round(soh, 1)))

    def detect_anomaly(self, telemetry_window: np.ndarray) -> bool:
        """
        Detect anomaly in a sliding window of telemetry.
        Input: (N, features) array -- last 60 min of data
        Output: True if anomaly detected
        Uses statistical thresholds (IQR-based) as primary detector.
        """
        if len(telemetry_window) == 0:
            return False
        # Simple z-score threshold on voltage and temperature
        for col_idx in range(min(2, telemetry_window.shape[1])):
            col = telemetry_window[:, col_idx]
            mean, std = np.mean(col), np.std(col)
            if std > 0 and np.any(np.abs(col - mean) > 4 * std):
                log.warning("anomaly_detected", system_id=self.system_id, column=col_idx)
                return True
        return False

    async def on_new_model(self, payload_json: str, mqtt_client=None):
        """
        Callback when a new model arrives via MQTT.
        1. Validate checksum
        2. Save to disk
        3. Load new model (keep old as fallback)
        4. Acknowledge receipt
        """
        try:
            payload = json.loads(payload_json)
            model_b64 = payload.get("model_b64", "")
            expected_checksum = payload.get("checksum", "")
            metadata = payload.get("metadata", {})

            # Decode and verify
            model_bytes = base64.b64decode(model_b64)
            actual_checksum = hashlib.sha256(model_bytes).hexdigest()
            if actual_checksum != expected_checksum:
                log.error("model_checksum_mismatch", system_id=self.system_id,
                          expected=expected_checksum[:8], actual=actual_checksum[:8])
                return

            # Save to disk
            model_dir = os.path.join(MODEL_DIR, self.system_id)
            os.makedirs(model_dir, exist_ok=True)
            new_model_path = os.path.join(model_dir, "load_forecast_new.onnx")
            with open(new_model_path, "wb") as f:
                f.write(model_bytes)

            # Backup current model
            self._previous_session = self._session
            self._previous_metadata = self._metadata.copy()

            # Load new model
            import onnxruntime as ort
            new_session = ort.InferenceSession(new_model_path, providers=["CPUExecutionProvider"])

            # Rename to production path
            prod_path = os.path.join(model_dir, "load_forecast.onnx")
            os.replace(new_model_path, prod_path)

            self._session = new_session
            self._metadata = metadata
            self._model_version = metadata.get("version", "unknown")

            log.info("new_model_loaded", system_id=self.system_id, version=self._model_version)

            # Send ACK via MQTT
            if mqtt_client:
                ack_topic = "lifo4/" + self.system_id + "/models/ack"
                ack_payload = json.dumps({
                    "system_id": self.system_id,
                    "checksum": actual_checksum,
                    "version": self._model_version,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                })
                await mqtt_client.publish(ack_topic, ack_payload, qos=1)

        except Exception as e:
            log.error("model_update_failed", system_id=self.system_id, error=str(e))
            # Rollback to previous model
            if self._previous_session:
                self._session = self._previous_session
                self._metadata = self._previous_metadata
                log.info("model_rollback_done", system_id=self.system_id)

    def _heuristic_load_24h(self) -> np.ndarray:
        """Time-of-day heuristic -- generates 24h load profile."""
        from datetime import datetime
        base = 50.0
        hour_profiles = [
            0.3, 0.25, 0.22, 0.20, 0.20, 0.25,
            0.45, 0.65, 0.80, 0.88, 0.90, 0.92,
            0.88, 0.85, 0.87, 0.90, 0.92, 0.95,
            1.00, 0.97, 0.90, 0.80, 0.65, 0.45,
        ]
        current_hour = datetime.now().hour
        predictions = []
        for h in range(24):
            idx = (current_hour + h) % 24
            noise = 1.0 + (np.random.random() - 0.5) * 0.05
            predictions.append(base * hour_profiles[idx] * noise)
        return np.array(predictions, dtype=np.float32)
