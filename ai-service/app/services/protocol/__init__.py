"""
Protocol Auto-Detection Module
ML-based protocol detection and automatic register mapping
"""

from .protocol_detector import ProtocolDetector, protocol_detector
from .pattern_matcher import PatternMatcher, pattern_matcher
from .register_mapper import RegisterMapper, register_mapper
from .training_pipeline import TrainingPipeline, training_pipeline

__all__ = [
    "ProtocolDetector",
    "protocol_detector",
    "PatternMatcher",
    "pattern_matcher",
    "RegisterMapper",
    "register_mapper",
    "TrainingPipeline",
    "training_pipeline",
]
