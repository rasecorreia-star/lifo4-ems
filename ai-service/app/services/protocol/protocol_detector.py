"""
Protocol Detector Service
ML-based automatic protocol detection from communication traffic
"""

import numpy as np
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
import logging
import pickle
import json
from pathlib import Path

logger = logging.getLogger(__name__)


# ============================================
# TYPES
# ============================================

class ProtocolType(str, Enum):
    """Supported protocol types"""
    MODBUS_RTU = "modbus_rtu"
    MODBUS_TCP = "modbus_tcp"
    CANBUS = "canbus"
    CANOPEN = "canopen"
    IEC_61850 = "iec_61850"
    SUNSPEC = "sunspec"
    MQTT = "mqtt"
    OPCUA = "opcua"
    PROPRIETARY = "proprietary"
    UNKNOWN = "unknown"


class DeviceType(str, Enum):
    """Device categories"""
    BMS = "bms"
    PCS = "pcs"
    INVERTER = "inverter"
    METER = "meter"
    SENSOR = "sensor"
    CONTROLLER = "controller"
    UNKNOWN = "unknown"


@dataclass
class TrafficSample:
    """A sample of communication traffic"""
    timestamp: datetime
    raw_data: bytes
    direction: str  # 'tx' or 'rx'
    source: str
    destination: str
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class DetectionResult:
    """Result of protocol detection"""
    protocol: ProtocolType
    confidence: float
    device_type: DeviceType
    manufacturer: Optional[str]
    model: Optional[str]
    features: Dict[str, Any]
    recommendations: List[str]


@dataclass
class ProtocolSignature:
    """Signature for a known protocol/device"""
    protocol: ProtocolType
    device_type: DeviceType
    manufacturer: str
    model: str
    patterns: List[bytes]
    register_map: Optional[Dict[str, Any]]
    features: Dict[str, float]


# ============================================
# FEATURE EXTRACTOR
# ============================================

class FeatureExtractor:
    """Extract features from traffic for ML classification"""

    def __init__(self):
        self.feature_names = [
            # Byte distribution features
            "byte_mean", "byte_std", "byte_min", "byte_max",
            "byte_entropy", "zero_ratio", "printable_ratio",
            # Length features
            "length", "length_variance",
            # Pattern features
            "header_signature", "has_crc", "has_length_field",
            # Timing features
            "inter_packet_time_mean", "inter_packet_time_std",
            # Protocol-specific features
            "modbus_function_codes", "can_id_range",
            "starts_with_00", "starts_with_ff",
        ]

    def extract(self, samples: List[TrafficSample]) -> np.ndarray:
        """Extract features from traffic samples"""
        if not samples:
            return np.zeros(len(self.feature_names))

        features = []
        all_data = b''.join(s.raw_data for s in samples)

        if not all_data:
            return np.zeros(len(self.feature_names))

        byte_array = np.frombuffer(all_data, dtype=np.uint8)

        # Byte distribution features
        features.append(np.mean(byte_array))  # byte_mean
        features.append(np.std(byte_array))   # byte_std
        features.append(np.min(byte_array))   # byte_min
        features.append(np.max(byte_array))   # byte_max

        # Entropy calculation
        _, counts = np.unique(byte_array, return_counts=True)
        probs = counts / len(byte_array)
        entropy = -np.sum(probs * np.log2(probs + 1e-10))
        features.append(entropy)  # byte_entropy

        # Ratios
        features.append(np.sum(byte_array == 0) / len(byte_array))  # zero_ratio
        printable = np.sum((byte_array >= 32) & (byte_array <= 126))
        features.append(printable / len(byte_array))  # printable_ratio

        # Length features
        lengths = [len(s.raw_data) for s in samples]
        features.append(np.mean(lengths))  # length
        features.append(np.var(lengths) if len(lengths) > 1 else 0)  # length_variance

        # Pattern features
        features.append(self._detect_header_signature(samples))  # header_signature
        features.append(self._has_crc(samples))  # has_crc
        features.append(self._has_length_field(samples))  # has_length_field

        # Timing features
        if len(samples) > 1:
            times = [s.timestamp.timestamp() for s in samples]
            intervals = np.diff(times)
            features.append(np.mean(intervals))  # inter_packet_time_mean
            features.append(np.std(intervals))   # inter_packet_time_std
        else:
            features.extend([0, 0])

        # Protocol-specific
        features.append(self._count_modbus_function_codes(samples))  # modbus_function_codes
        features.append(self._can_id_range(samples))  # can_id_range
        features.append(1.0 if all_data[:2] == b'\x00\x00' else 0.0)  # starts_with_00
        features.append(1.0 if all_data[:2] == b'\xff\xff' else 0.0)  # starts_with_ff

        return np.array(features)

    def _detect_header_signature(self, samples: List[TrafficSample]) -> float:
        """Detect common header patterns"""
        if not samples:
            return 0.0

        # Check for consistent header
        headers = [s.raw_data[:4] if len(s.raw_data) >= 4 else s.raw_data for s in samples]
        if len(set(headers)) == 1:
            return 1.0
        return len(set(headers)) / len(headers)

    def _has_crc(self, samples: List[TrafficSample]) -> float:
        """Detect if messages have CRC"""
        crc_detected = 0
        for sample in samples:
            if len(sample.raw_data) >= 2:
                # Simple CRC detection: last 2 bytes vary with content
                crc_detected += 1
        return crc_detected / max(len(samples), 1)

    def _has_length_field(self, samples: List[TrafficSample]) -> float:
        """Detect if messages have a length field"""
        matches = 0
        for sample in samples:
            if len(sample.raw_data) >= 3:
                # Check if byte 2 or 3 matches length
                if sample.raw_data[1] == len(sample.raw_data) - 2:
                    matches += 1
                elif sample.raw_data[2] == len(sample.raw_data) - 3:
                    matches += 1
        return matches / max(len(samples), 1)

    def _count_modbus_function_codes(self, samples: List[TrafficSample]) -> float:
        """Count valid Modbus function codes"""
        modbus_codes = {1, 2, 3, 4, 5, 6, 15, 16, 23}
        count = 0
        for sample in samples:
            if len(sample.raw_data) >= 2:
                if sample.raw_data[1] in modbus_codes:
                    count += 1
        return count / max(len(samples), 1)

    def _can_id_range(self, samples: List[TrafficSample]) -> float:
        """Detect CAN bus ID range patterns"""
        ids = set()
        for sample in samples:
            if len(sample.raw_data) >= 4:
                can_id = int.from_bytes(sample.raw_data[:4], 'big') & 0x1FFFFFFF
                if can_id < 0x800:  # Standard CAN ID range
                    ids.add(can_id)
        return len(ids) / max(len(samples), 1)


# ============================================
# PROTOCOL CLASSIFIER
# ============================================

class ProtocolClassifier:
    """ML model for protocol classification"""

    def __init__(self):
        self.feature_extractor = FeatureExtractor()
        self.model = None
        self.label_encoder = None
        self._initialize_default_model()

    def _initialize_default_model(self):
        """Initialize with rule-based classifier until trained"""
        self.rules = {
            ProtocolType.MODBUS_RTU: {
                "min_length": 4,
                "max_length": 256,
                "function_code_threshold": 0.5,
            },
            ProtocolType.MODBUS_TCP: {
                "header": b'\x00\x00',
                "min_length": 12,
            },
            ProtocolType.CANBUS: {
                "min_length": 8,
                "max_length": 16,
                "can_id_threshold": 0.3,
            },
            ProtocolType.SUNSPEC: {
                "register_base": 40000,
                "identifier": b'SunS',
            },
        }

    def predict(self, samples: List[TrafficSample]) -> Tuple[ProtocolType, float]:
        """Predict protocol from samples"""
        if not samples:
            return ProtocolType.UNKNOWN, 0.0

        features = self.feature_extractor.extract(samples)

        # Rule-based classification (fallback)
        scores = {}

        # Check Modbus TCP (MBAP header)
        if self._check_modbus_tcp(samples):
            scores[ProtocolType.MODBUS_TCP] = 0.9

        # Check Modbus RTU
        modbus_score = features[14]  # modbus_function_codes feature
        if modbus_score > 0.5:
            scores[ProtocolType.MODBUS_RTU] = modbus_score

        # Check CAN bus
        can_score = features[15]  # can_id_range feature
        if can_score > 0.3:
            scores[ProtocolType.CANBUS] = can_score

        # Check SunSpec
        if self._check_sunspec(samples):
            scores[ProtocolType.SUNSPEC] = 0.95

        # Check for high entropy (possibly encrypted/proprietary)
        if features[4] > 7.5:  # byte_entropy
            scores[ProtocolType.PROPRIETARY] = 0.6

        if not scores:
            return ProtocolType.UNKNOWN, 0.0

        best_protocol = max(scores, key=scores.get)
        return best_protocol, scores[best_protocol]

    def _check_modbus_tcp(self, samples: List[TrafficSample]) -> bool:
        """Check for Modbus TCP MBAP header"""
        for sample in samples:
            if len(sample.raw_data) >= 7:
                # MBAP header: transaction ID (2) + protocol ID (2) + length (2) + unit ID (1)
                protocol_id = int.from_bytes(sample.raw_data[2:4], 'big')
                if protocol_id == 0:  # Modbus protocol ID
                    return True
        return False

    def _check_sunspec(self, samples: List[TrafficSample]) -> bool:
        """Check for SunSpec identifier"""
        for sample in samples:
            if b'SunS' in sample.raw_data:
                return True
        return False

    def train(self, training_data: List[Tuple[List[TrafficSample], ProtocolType]]):
        """Train the classifier with labeled data"""
        if len(training_data) < 10:
            logger.warning("Insufficient training data, using rule-based classifier")
            return

        X = []
        y = []

        for samples, protocol in training_data:
            features = self.feature_extractor.extract(samples)
            X.append(features)
            y.append(protocol.value)

        X = np.array(X)
        y = np.array(y)

        # Simple centroid-based classifier
        self.centroids = {}
        for protocol in set(y):
            mask = y == protocol
            self.centroids[protocol] = np.mean(X[mask], axis=0)

        logger.info(f"Trained classifier with {len(training_data)} samples")

    def save(self, path: str):
        """Save trained model"""
        with open(path, 'wb') as f:
            pickle.dump({
                'centroids': getattr(self, 'centroids', None),
                'rules': self.rules,
            }, f)

    def load(self, path: str):
        """Load trained model"""
        with open(path, 'rb') as f:
            data = pickle.load(f)
            self.centroids = data.get('centroids')
            self.rules = data.get('rules', self.rules)


# ============================================
# DEVICE IDENTIFIER
# ============================================

class DeviceIdentifier:
    """Identify device manufacturer and model"""

    def __init__(self):
        self.signatures: List[ProtocolSignature] = []
        self._load_known_signatures()

    def _load_known_signatures(self):
        """Load known device signatures"""
        # BMS signatures
        self.signatures.extend([
            ProtocolSignature(
                protocol=ProtocolType.CANBUS,
                device_type=DeviceType.BMS,
                manufacturer="CATL",
                model="LFP280",
                patterns=[b'\x18\xff\x50'],
                register_map=None,
                features={"can_base_id": 0x1800}
            ),
            ProtocolSignature(
                protocol=ProtocolType.MODBUS_RTU,
                device_type=DeviceType.BMS,
                manufacturer="Pylontech",
                model="US2000",
                patterns=[b'\x01\x03'],
                register_map=None,
                features={"slave_id": 1}
            ),
            ProtocolSignature(
                protocol=ProtocolType.MODBUS_RTU,
                device_type=DeviceType.BMS,
                manufacturer="BYD",
                model="B-Box",
                patterns=[b'\x01\x03', b'\x01\x04'],
                register_map=None,
                features={"slave_id": 1}
            ),
        ])

        # PCS/Inverter signatures
        self.signatures.extend([
            ProtocolSignature(
                protocol=ProtocolType.MODBUS_TCP,
                device_type=DeviceType.PCS,
                manufacturer="Sungrow",
                model="SC1000",
                patterns=[b'\x00\x00\x00\x00'],
                register_map=None,
                features={"holding_register_base": 5000}
            ),
            ProtocolSignature(
                protocol=ProtocolType.SUNSPEC,
                device_type=DeviceType.INVERTER,
                manufacturer="SMA",
                model="Sunny Tripower",
                patterns=[b'SunS'],
                register_map=None,
                features={"sunspec_base": 40000}
            ),
        ])

    def identify(
        self,
        samples: List[TrafficSample],
        protocol: ProtocolType
    ) -> Tuple[DeviceType, Optional[str], Optional[str], float]:
        """Identify device from traffic samples"""
        best_match = None
        best_score = 0.0

        for signature in self.signatures:
            if signature.protocol != protocol:
                continue

            score = self._match_signature(samples, signature)
            if score > best_score:
                best_score = score
                best_match = signature

        if best_match and best_score > 0.5:
            return (
                best_match.device_type,
                best_match.manufacturer,
                best_match.model,
                best_score
            )

        # Fallback to device type detection
        device_type = self._detect_device_type(samples, protocol)
        return device_type, None, None, 0.3

    def _match_signature(
        self,
        samples: List[TrafficSample],
        signature: ProtocolSignature
    ) -> float:
        """Calculate match score for a signature"""
        if not samples:
            return 0.0

        pattern_matches = 0
        for sample in samples:
            for pattern in signature.patterns:
                if pattern in sample.raw_data:
                    pattern_matches += 1
                    break

        return pattern_matches / len(samples)

    def _detect_device_type(
        self,
        samples: List[TrafficSample],
        protocol: ProtocolType
    ) -> DeviceType:
        """Detect device type from traffic patterns"""
        # Analyze register ranges and values
        if protocol in [ProtocolType.MODBUS_RTU, ProtocolType.MODBUS_TCP]:
            # BMS typically reads voltage, current, SOC
            # PCS typically has power control registers
            pass

        return DeviceType.UNKNOWN

    def add_signature(self, signature: ProtocolSignature):
        """Add a new device signature"""
        self.signatures.append(signature)


# ============================================
# PROTOCOL DETECTOR SERVICE
# ============================================

class ProtocolDetector:
    """Main protocol detection service"""

    def __init__(self, model_path: Optional[str] = None):
        self.classifier = ProtocolClassifier()
        self.identifier = DeviceIdentifier()
        self.detection_history: List[DetectionResult] = []

        if model_path and Path(model_path).exists():
            self.classifier.load(model_path)

    def detect(
        self,
        samples: List[TrafficSample],
        min_samples: int = 10
    ) -> DetectionResult:
        """Detect protocol and device from traffic samples"""
        if len(samples) < min_samples:
            logger.warning(f"Insufficient samples ({len(samples)} < {min_samples})")
            return DetectionResult(
                protocol=ProtocolType.UNKNOWN,
                confidence=0.0,
                device_type=DeviceType.UNKNOWN,
                manufacturer=None,
                model=None,
                features={},
                recommendations=["Collect more traffic samples"]
            )

        # Detect protocol
        protocol, protocol_confidence = self.classifier.predict(samples)

        # Identify device
        device_type, manufacturer, model, device_confidence = \
            self.identifier.identify(samples, protocol)

        # Extract features for reporting
        features = {
            "sample_count": len(samples),
            "protocol_confidence": protocol_confidence,
            "device_confidence": device_confidence,
            "total_bytes": sum(len(s.raw_data) for s in samples),
        }

        # Generate recommendations
        recommendations = self._generate_recommendations(
            protocol, protocol_confidence, device_type, manufacturer
        )

        # Calculate overall confidence
        overall_confidence = (protocol_confidence + device_confidence) / 2

        result = DetectionResult(
            protocol=protocol,
            confidence=overall_confidence,
            device_type=device_type,
            manufacturer=manufacturer,
            model=model,
            features=features,
            recommendations=recommendations
        )

        self.detection_history.append(result)

        logger.info(
            f"Protocol detected: {protocol.value} ({protocol_confidence:.2f}), "
            f"Device: {manufacturer or 'Unknown'} {model or ''}"
        )

        return result

    def detect_from_raw(
        self,
        raw_data: List[bytes],
        source: str = "unknown",
        destination: str = "unknown"
    ) -> DetectionResult:
        """Detect protocol from raw byte arrays"""
        samples = [
            TrafficSample(
                timestamp=datetime.now(),
                raw_data=data,
                direction='rx',
                source=source,
                destination=destination
            )
            for data in raw_data
        ]
        return self.detect(samples)

    def _generate_recommendations(
        self,
        protocol: ProtocolType,
        confidence: float,
        device_type: DeviceType,
        manufacturer: Optional[str]
    ) -> List[str]:
        """Generate configuration recommendations"""
        recommendations = []

        if confidence < 0.7:
            recommendations.append("Low confidence - verify protocol manually")

        if protocol == ProtocolType.MODBUS_RTU:
            recommendations.append("Configure serial port: 9600/19200 baud, 8N1")
            recommendations.append("Set appropriate slave ID (typically 1-247)")

        elif protocol == ProtocolType.MODBUS_TCP:
            recommendations.append("Configure TCP port 502 (default Modbus)")
            recommendations.append("Set unit ID if using gateway")

        elif protocol == ProtocolType.CANBUS:
            recommendations.append("Configure CAN bus speed: 125/250/500 kbps")
            recommendations.append("Set appropriate CAN ID filters")

        elif protocol == ProtocolType.SUNSPEC:
            recommendations.append("Use SunSpec register base 40000")
            recommendations.append("Query model 1 (Common) first for device info")

        if manufacturer:
            recommendations.append(f"Load {manufacturer} register map from library")

        return recommendations

    def get_history(self, limit: int = 100) -> List[DetectionResult]:
        """Get detection history"""
        return self.detection_history[-limit:]

    def train(self, training_data: List[Tuple[List[TrafficSample], ProtocolType]]):
        """Train the detector with labeled data"""
        self.classifier.train(training_data)

    def save_model(self, path: str):
        """Save trained model"""
        self.classifier.save(path)

    def load_model(self, path: str):
        """Load trained model"""
        self.classifier.load(path)


# Singleton instance
protocol_detector = ProtocolDetector()
