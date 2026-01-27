"""
Training Pipeline for Protocol Detection
Automated ML model training and validation for protocol identification
"""

import asyncio
import json
import logging
import pickle
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import numpy as np
from collections import defaultdict

logger = logging.getLogger(__name__)


# ============================================
# TYPES
# ============================================

class TrainingStatus(str, Enum):
    """Status of training job"""
    PENDING = "pending"
    COLLECTING = "collecting"
    PREPROCESSING = "preprocessing"
    TRAINING = "training"
    VALIDATING = "validating"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class TrainingSample:
    """A single training sample"""
    data: bytes
    protocol: str
    device_type: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingDataset:
    """Collection of training samples"""
    name: str
    samples: List[TrainingSample] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.now)
    version: str = "1.0.0"

    def add_sample(self, sample: TrainingSample):
        self.samples.append(sample)

    def get_statistics(self) -> Dict[str, Any]:
        """Get dataset statistics"""
        protocol_counts = defaultdict(int)
        device_counts = defaultdict(int)
        manufacturer_counts = defaultdict(int)

        for sample in self.samples:
            protocol_counts[sample.protocol] += 1
            if sample.device_type:
                device_counts[sample.device_type] += 1
            if sample.manufacturer:
                manufacturer_counts[sample.manufacturer] += 1

        return {
            "total_samples": len(self.samples),
            "protocols": dict(protocol_counts),
            "device_types": dict(device_counts),
            "manufacturers": dict(manufacturer_counts),
        }


@dataclass
class TrainingJob:
    """A training job"""
    id: str
    dataset_name: str
    status: TrainingStatus = TrainingStatus.PENDING
    progress: float = 0.0
    created_at: datetime = field(default_factory=datetime.now)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metrics: Dict[str, float] = field(default_factory=dict)
    error: Optional[str] = None


@dataclass
class ModelMetrics:
    """Model evaluation metrics"""
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: List[List[int]]
    class_labels: List[str]
    per_class_metrics: Dict[str, Dict[str, float]]


# ============================================
# FEATURE EXTRACTION
# ============================================

class FeatureExtractor:
    """Extract features from raw protocol data"""

    def __init__(self):
        self.feature_names = [
            "length", "entropy", "byte_mean", "byte_std",
            "zero_ratio", "printable_ratio", "high_byte_ratio",
            "modbus_header_match", "can_frame_match",
            "sunspec_marker", "iec61850_marker",
            "byte_pairs_unique", "byte_runs_max",
            "checksum_valid_crc16", "checksum_valid_crc32",
            "timing_interval_ms", "response_time_ms",
            "packet_size_variance"
        ]

    def extract(self, data: bytes, metadata: Dict[str, Any] = None) -> np.ndarray:
        """Extract feature vector from data"""
        metadata = metadata or {}
        features = []

        # Basic statistics
        features.append(len(data))
        features.append(self._calculate_entropy(data))

        if len(data) > 0:
            arr = np.frombuffer(data, dtype=np.uint8)
            features.append(float(np.mean(arr)))
            features.append(float(np.std(arr)))
            features.append(np.sum(arr == 0) / len(arr))
            features.append(sum(32 <= b <= 126 for b in data) / len(data))
            features.append(sum(b >= 128 for b in data) / len(data))
        else:
            features.extend([0.0] * 5)

        # Protocol markers
        features.append(self._check_modbus_header(data))
        features.append(self._check_can_frame(data))
        features.append(1.0 if b'SunS' in data else 0.0)
        features.append(1.0 if self._check_iec61850(data) else 0.0)

        # Pattern analysis
        features.append(self._count_unique_byte_pairs(data))
        features.append(self._max_byte_run(data))

        # Checksum validation
        features.append(1.0 if self._validate_crc16(data) else 0.0)
        features.append(1.0 if self._validate_crc32(data) else 0.0)

        # Timing features (from metadata)
        features.append(metadata.get("timing_interval_ms", 0.0))
        features.append(metadata.get("response_time_ms", 0.0))
        features.append(metadata.get("packet_size_variance", 0.0))

        return np.array(features, dtype=np.float32)

    def _calculate_entropy(self, data: bytes) -> float:
        """Calculate Shannon entropy"""
        if not data:
            return 0.0

        counts = np.bincount(np.frombuffer(data, dtype=np.uint8), minlength=256)
        probs = counts / len(data)
        probs = probs[probs > 0]
        return float(-np.sum(probs * np.log2(probs)))

    def _check_modbus_header(self, data: bytes) -> float:
        """Check if data looks like Modbus"""
        if len(data) < 4:
            return 0.0

        # Check for valid function codes
        if len(data) >= 2:
            func_code = data[1] & 0x7F
            if func_code in [1, 2, 3, 4, 5, 6, 15, 16, 23]:
                return 1.0

        # Check for Modbus TCP header
        if len(data) >= 7:
            protocol_id = int.from_bytes(data[2:4], "big")
            if protocol_id == 0:
                return 0.8

        return 0.0

    def _check_can_frame(self, data: bytes) -> float:
        """Check if data looks like CAN frame"""
        if len(data) == 8:
            return 0.5
        if len(data) == 13:  # Extended frame
            return 0.7
        return 0.0

    def _check_iec61850(self, data: bytes) -> bool:
        """Check for IEC 61850 markers"""
        markers = [b'\x61\x00', b'\x62\x00', b'\xa2\x00']
        return any(marker in data for marker in markers)

    def _count_unique_byte_pairs(self, data: bytes) -> float:
        """Count unique consecutive byte pairs"""
        if len(data) < 2:
            return 0.0
        pairs = set(zip(data[:-1], data[1:]))
        return len(pairs) / (len(data) - 1)

    def _max_byte_run(self, data: bytes) -> float:
        """Find maximum run of same byte"""
        if not data:
            return 0.0

        max_run = 1
        current_run = 1

        for i in range(1, len(data)):
            if data[i] == data[i-1]:
                current_run += 1
                max_run = max(max_run, current_run)
            else:
                current_run = 1

        return max_run / len(data)

    def _validate_crc16(self, data: bytes) -> bool:
        """Validate CRC16 (Modbus)"""
        if len(data) < 4:
            return False

        def crc16(data: bytes) -> int:
            crc = 0xFFFF
            for byte in data:
                crc ^= byte
                for _ in range(8):
                    if crc & 1:
                        crc = (crc >> 1) ^ 0xA001
                    else:
                        crc >>= 1
            return crc

        message = data[:-2]
        expected = int.from_bytes(data[-2:], "little")
        return crc16(message) == expected

    def _validate_crc32(self, data: bytes) -> bool:
        """Validate CRC32"""
        if len(data) < 6:
            return False

        import binascii
        message = data[:-4]
        expected = int.from_bytes(data[-4:], "little")
        return binascii.crc32(message) & 0xFFFFFFFF == expected


# ============================================
# MODEL TRAINER
# ============================================

class ModelTrainer:
    """Train protocol detection models"""

    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.models: Dict[str, Any] = {}
        self.label_encoders: Dict[str, Dict[str, int]] = {}

    def prepare_data(
        self,
        dataset: TrainingDataset
    ) -> Tuple[np.ndarray, np.ndarray, List[str]]:
        """Prepare training data from dataset"""
        X = []
        y = []
        labels = []

        label_to_idx = {}

        for sample in dataset.samples:
            features = self.feature_extractor.extract(
                sample.data,
                sample.metadata
            )
            X.append(features)

            if sample.protocol not in label_to_idx:
                label_to_idx[sample.protocol] = len(label_to_idx)
                labels.append(sample.protocol)

            y.append(label_to_idx[sample.protocol])

        self.label_encoders["protocol"] = label_to_idx

        return np.array(X), np.array(y), labels

    def train_random_forest(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_estimators: int = 100
    ) -> Dict[str, Any]:
        """Train Random Forest classifier"""
        # Simple implementation without sklearn
        # In production, use sklearn.ensemble.RandomForestClassifier

        model = {
            "type": "random_forest",
            "n_estimators": n_estimators,
            "trees": [],
            "feature_importances": np.zeros(X.shape[1])
        }

        n_samples = X.shape[0]
        n_classes = len(np.unique(y))

        for i in range(n_estimators):
            # Bootstrap sample
            indices = np.random.choice(n_samples, n_samples, replace=True)
            X_boot = X[indices]
            y_boot = y[indices]

            # Build simple decision stump
            tree = self._build_decision_stump(X_boot, y_boot, n_classes)
            model["trees"].append(tree)

        # Calculate feature importances
        for tree in model["trees"]:
            if "feature_idx" in tree:
                model["feature_importances"][tree["feature_idx"]] += 1

        model["feature_importances"] /= n_estimators

        return model

    def _build_decision_stump(
        self,
        X: np.ndarray,
        y: np.ndarray,
        n_classes: int
    ) -> Dict[str, Any]:
        """Build a simple decision stump"""
        best_feature = 0
        best_threshold = 0.0
        best_gini = float('inf')

        n_features = X.shape[1]

        # Try random subset of features
        features_to_try = np.random.choice(
            n_features,
            min(int(np.sqrt(n_features)) + 1, n_features),
            replace=False
        )

        for feature_idx in features_to_try:
            values = X[:, feature_idx]
            thresholds = np.percentile(values, [25, 50, 75])

            for threshold in thresholds:
                left_mask = values <= threshold
                right_mask = ~left_mask

                if np.sum(left_mask) == 0 or np.sum(right_mask) == 0:
                    continue

                gini = self._calculate_gini(
                    y[left_mask], y[right_mask], n_classes
                )

                if gini < best_gini:
                    best_gini = gini
                    best_feature = feature_idx
                    best_threshold = threshold

        # Calculate leaf predictions
        left_mask = X[:, best_feature] <= best_threshold

        left_counts = np.bincount(y[left_mask], minlength=n_classes)
        right_counts = np.bincount(y[~left_mask], minlength=n_classes)

        return {
            "feature_idx": best_feature,
            "threshold": best_threshold,
            "left_prediction": int(np.argmax(left_counts)),
            "right_prediction": int(np.argmax(right_counts)),
            "left_probs": left_counts / max(np.sum(left_counts), 1),
            "right_probs": right_counts / max(np.sum(right_counts), 1),
        }

    def _calculate_gini(
        self,
        y_left: np.ndarray,
        y_right: np.ndarray,
        n_classes: int
    ) -> float:
        """Calculate weighted Gini impurity"""
        def gini(y):
            if len(y) == 0:
                return 0.0
            counts = np.bincount(y, minlength=n_classes)
            probs = counts / len(y)
            return 1.0 - np.sum(probs ** 2)

        n_left = len(y_left)
        n_right = len(y_right)
        n_total = n_left + n_right

        return (n_left / n_total) * gini(y_left) + \
               (n_right / n_total) * gini(y_right)

    def predict(
        self,
        model: Dict[str, Any],
        X: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Make predictions with trained model"""
        if model["type"] != "random_forest":
            raise ValueError(f"Unknown model type: {model['type']}")

        n_samples = X.shape[0] if len(X.shape) > 1 else 1
        if len(X.shape) == 1:
            X = X.reshape(1, -1)

        n_classes = len(model["trees"][0]["left_probs"])
        predictions = np.zeros((n_samples, n_classes))

        for tree in model["trees"]:
            for i in range(n_samples):
                if X[i, tree["feature_idx"]] <= tree["threshold"]:
                    predictions[i] += tree["left_probs"]
                else:
                    predictions[i] += tree["right_probs"]

        predictions /= len(model["trees"])

        return np.argmax(predictions, axis=1), predictions

    def evaluate(
        self,
        model: Dict[str, Any],
        X: np.ndarray,
        y: np.ndarray,
        labels: List[str]
    ) -> ModelMetrics:
        """Evaluate model performance"""
        y_pred, y_prob = self.predict(model, X)

        n_classes = len(labels)
        confusion = np.zeros((n_classes, n_classes), dtype=int)

        for true, pred in zip(y, y_pred):
            confusion[true, pred] += 1

        # Calculate metrics
        accuracy = np.sum(y == y_pred) / len(y)

        per_class = {}
        precisions = []
        recalls = []

        for i, label in enumerate(labels):
            tp = confusion[i, i]
            fp = np.sum(confusion[:, i]) - tp
            fn = np.sum(confusion[i, :]) - tp

            precision = tp / max(tp + fp, 1)
            recall = tp / max(tp + fn, 1)
            f1 = 2 * precision * recall / max(precision + recall, 1e-10)

            per_class[label] = {
                "precision": precision,
                "recall": recall,
                "f1_score": f1,
                "support": int(np.sum(confusion[i, :]))
            }

            precisions.append(precision)
            recalls.append(recall)

        macro_precision = np.mean(precisions)
        macro_recall = np.mean(recalls)
        macro_f1 = 2 * macro_precision * macro_recall / \
                   max(macro_precision + macro_recall, 1e-10)

        return ModelMetrics(
            accuracy=accuracy,
            precision=macro_precision,
            recall=macro_recall,
            f1_score=macro_f1,
            confusion_matrix=confusion.tolist(),
            class_labels=labels,
            per_class_metrics=per_class
        )


# ============================================
# TRAINING PIPELINE
# ============================================

class TrainingPipeline:
    """Main training pipeline for protocol detection"""

    def __init__(self, data_dir: str = "./training_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

        self.datasets: Dict[str, TrainingDataset] = {}
        self.jobs: Dict[str, TrainingJob] = {}
        self.trainer = ModelTrainer()
        self.models: Dict[str, Dict[str, Any]] = {}

        self._load_datasets()

    def _load_datasets(self):
        """Load existing datasets from disk"""
        for path in self.data_dir.glob("*.dataset"):
            try:
                with open(path, "rb") as f:
                    dataset = pickle.load(f)
                    self.datasets[dataset.name] = dataset
                    logger.info(f"Loaded dataset: {dataset.name}")
            except Exception as e:
                logger.error(f"Failed to load dataset {path}: {e}")

    def create_dataset(self, name: str) -> TrainingDataset:
        """Create a new training dataset"""
        dataset = TrainingDataset(name=name)
        self.datasets[name] = dataset
        return dataset

    def add_sample(
        self,
        dataset_name: str,
        data: bytes,
        protocol: str,
        device_type: Optional[str] = None,
        manufacturer: Optional[str] = None,
        model: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ):
        """Add a training sample to a dataset"""
        if dataset_name not in self.datasets:
            self.create_dataset(dataset_name)

        sample = TrainingSample(
            data=data,
            protocol=protocol,
            device_type=device_type,
            manufacturer=manufacturer,
            model=model,
            metadata=metadata or {}
        )

        self.datasets[dataset_name].add_sample(sample)

    def save_dataset(self, dataset_name: str):
        """Save dataset to disk"""
        if dataset_name not in self.datasets:
            raise ValueError(f"Dataset not found: {dataset_name}")

        path = self.data_dir / f"{dataset_name}.dataset"
        with open(path, "wb") as f:
            pickle.dump(self.datasets[dataset_name], f)

        logger.info(f"Saved dataset: {dataset_name}")

    async def start_training(
        self,
        dataset_name: str,
        job_id: Optional[str] = None
    ) -> TrainingJob:
        """Start a training job"""
        if dataset_name not in self.datasets:
            raise ValueError(f"Dataset not found: {dataset_name}")

        job_id = job_id or f"job_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        job = TrainingJob(
            id=job_id,
            dataset_name=dataset_name,
            status=TrainingStatus.PENDING
        )
        self.jobs[job_id] = job

        # Start training in background
        asyncio.create_task(self._run_training(job))

        return job

    async def _run_training(self, job: TrainingJob):
        """Run the training job"""
        try:
            job.status = TrainingStatus.PREPROCESSING
            job.started_at = datetime.now()
            job.progress = 0.1

            dataset = self.datasets[job.dataset_name]

            # Prepare data
            X, y, labels = self.trainer.prepare_data(dataset)
            job.progress = 0.2

            # Split data (80/20)
            n_samples = len(X)
            indices = np.random.permutation(n_samples)
            split = int(n_samples * 0.8)

            X_train = X[indices[:split]]
            y_train = y[indices[:split]]
            X_test = X[indices[split:]]
            y_test = y[indices[split:]]

            job.status = TrainingStatus.TRAINING
            job.progress = 0.3

            # Train model
            model = self.trainer.train_random_forest(X_train, y_train)
            job.progress = 0.7

            job.status = TrainingStatus.VALIDATING

            # Evaluate
            metrics = self.trainer.evaluate(model, X_test, y_test, labels)
            job.progress = 0.9

            # Save model
            model_name = f"protocol_detector_{job.id}"
            model["labels"] = labels
            model["label_encoder"] = self.trainer.label_encoders.get("protocol", {})
            self.models[model_name] = model

            # Save to disk
            model_path = self.data_dir / f"{model_name}.model"
            with open(model_path, "wb") as f:
                pickle.dump(model, f)

            job.status = TrainingStatus.COMPLETED
            job.progress = 1.0
            job.completed_at = datetime.now()
            job.metrics = {
                "accuracy": metrics.accuracy,
                "precision": metrics.precision,
                "recall": metrics.recall,
                "f1_score": metrics.f1_score,
            }

            logger.info(
                f"Training completed: {job.id}, "
                f"accuracy={metrics.accuracy:.3f}, f1={metrics.f1_score:.3f}"
            )

        except Exception as e:
            job.status = TrainingStatus.FAILED
            job.error = str(e)
            logger.error(f"Training failed: {e}")

    def get_job_status(self, job_id: str) -> Optional[TrainingJob]:
        """Get training job status"""
        return self.jobs.get(job_id)

    def load_model(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Load a trained model"""
        if model_name in self.models:
            return self.models[model_name]

        model_path = self.data_dir / f"{model_name}.model"
        if model_path.exists():
            with open(model_path, "rb") as f:
                model = pickle.load(f)
                self.models[model_name] = model
                return model

        return None

    def predict(
        self,
        data: bytes,
        model_name: Optional[str] = None,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Make prediction using trained model"""
        # Find best model if not specified
        if model_name is None:
            if not self.models:
                # Load latest model
                model_files = sorted(self.data_dir.glob("*.model"))
                if model_files:
                    model_name = model_files[-1].stem
                    self.load_model(model_name)

            if self.models:
                model_name = list(self.models.keys())[-1]

        if model_name is None or model_name not in self.models:
            return {
                "error": "No trained model available",
                "protocol": "unknown",
                "confidence": 0.0
            }

        model = self.models[model_name]

        # Extract features
        features = self.trainer.feature_extractor.extract(data, metadata or {})

        # Predict
        predictions, probabilities = self.trainer.predict(model, features)

        predicted_idx = int(predictions[0])
        labels = model.get("labels", [])

        if predicted_idx < len(labels):
            protocol = labels[predicted_idx]
            confidence = float(probabilities[0, predicted_idx])
        else:
            protocol = "unknown"
            confidence = 0.0

        # Get top predictions
        sorted_indices = np.argsort(probabilities[0])[::-1]
        top_predictions = []
        for idx in sorted_indices[:3]:
            if idx < len(labels):
                top_predictions.append({
                    "protocol": labels[idx],
                    "confidence": float(probabilities[0, idx])
                })

        return {
            "protocol": protocol,
            "confidence": confidence,
            "top_predictions": top_predictions,
            "model_used": model_name
        }

    def get_dataset_info(self, dataset_name: str) -> Optional[Dict[str, Any]]:
        """Get dataset information"""
        if dataset_name not in self.datasets:
            return None

        dataset = self.datasets[dataset_name]
        stats = dataset.get_statistics()

        return {
            "name": dataset.name,
            "version": dataset.version,
            "created_at": dataset.created_at.isoformat(),
            "statistics": stats
        }

    def list_datasets(self) -> List[str]:
        """List available datasets"""
        return list(self.datasets.keys())

    def list_models(self) -> List[Dict[str, Any]]:
        """List available models"""
        models = []

        for path in self.data_dir.glob("*.model"):
            model_name = path.stem
            model = self.load_model(model_name)

            if model:
                models.append({
                    "name": model_name,
                    "type": model.get("type", "unknown"),
                    "labels": model.get("labels", []),
                    "n_estimators": model.get("n_estimators", 0)
                })

        return models

    def export_model(self, model_name: str, format: str = "json") -> str:
        """Export model to portable format"""
        model = self.load_model(model_name)
        if not model:
            raise ValueError(f"Model not found: {model_name}")

        if format == "json":
            # Convert numpy arrays to lists
            export_model = {}
            for key, value in model.items():
                if isinstance(value, np.ndarray):
                    export_model[key] = value.tolist()
                elif isinstance(value, list):
                    export_model[key] = [
                        {k: v.tolist() if isinstance(v, np.ndarray) else v
                         for k, v in item.items()}
                        if isinstance(item, dict) else item
                        for item in value
                    ]
                else:
                    export_model[key] = value

            return json.dumps(export_model, indent=2)

        raise ValueError(f"Unknown format: {format}")


# Singleton instance
training_pipeline = TrainingPipeline()
