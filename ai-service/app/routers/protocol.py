"""
Protocol Detection Router
API endpoints for ML-based protocol detection and register mapping
"""

import base64
import logging
from typing import Dict, List, Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from ..services.protocol import (
    protocol_detector,
    pattern_matcher,
    register_mapper,
    training_pipeline
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/protocol", tags=["Protocol Detection"])


# ============================================
# REQUEST/RESPONSE MODELS
# ============================================

class DetectRequest(BaseModel):
    """Protocol detection request"""
    data: str  # Base64 encoded
    metadata: Optional[Dict[str, Any]] = None


class DetectResponse(BaseModel):
    """Protocol detection response"""
    protocol: str
    confidence: float
    device_type: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    firmware_version: Optional[str] = None
    top_predictions: Optional[List[Dict[str, Any]]] = None


class RegisterSample(BaseModel):
    """Register sample for analysis"""
    address: int
    values: List[int]


class AnalyzeRegistersRequest(BaseModel):
    """Register analysis request"""
    samples: List[RegisterSample]
    device_id: Optional[str] = None


class RegisterInfo(BaseModel):
    """Detected register info"""
    address: int
    name: str
    data_type: str
    scale: float
    unit: str
    description: str
    category: str
    writable: bool = False


class AnalyzeRegistersResponse(BaseModel):
    """Register analysis response"""
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    registers: List[RegisterInfo]


class PatternMatchRequest(BaseModel):
    """Pattern match request"""
    data: str  # Base64 encoded


class PatternMatchResponse(BaseModel):
    """Pattern match response"""
    matches: List[Dict[str, Any]]


class TrainingSampleRequest(BaseModel):
    """Add training sample request"""
    dataset_name: str
    data: str  # Base64 encoded
    protocol: str
    device_type: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


class StartTrainingRequest(BaseModel):
    """Start training request"""
    dataset_name: str
    job_id: Optional[str] = None


class PredictRequest(BaseModel):
    """Prediction request using trained model"""
    data: str  # Base64 encoded
    model_name: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None


# ============================================
# DETECTION ENDPOINTS
# ============================================

@router.post("/detect", response_model=DetectResponse)
async def detect_protocol(request: DetectRequest):
    """
    Detect protocol type from raw data

    Analyzes binary data to identify:
    - Protocol type (Modbus RTU/TCP, CAN, SunSpec, etc.)
    - Device type (BMS, PCS, Inverter, etc.)
    - Manufacturer and model
    """
    try:
        data = base64.b64decode(request.data)

        result = protocol_detector.detect(data, request.metadata)

        return DetectResponse(
            protocol=result.protocol.value,
            confidence=result.confidence,
            device_type=result.device_type.value if result.device_type else None,
            manufacturer=result.manufacturer,
            model=result.model,
            firmware_version=result.firmware_version,
            top_predictions=[
                {"protocol": p.value, "confidence": c}
                for p, c in result.top_predictions
            ] if result.top_predictions else None
        )
    except Exception as e:
        logger.error(f"Protocol detection failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/identify-device")
async def identify_device(request: DetectRequest):
    """
    Identify device from multiple data samples
    """
    try:
        data = base64.b64decode(request.data)

        result = protocol_detector.identify_device(data, request.metadata)

        return {
            "manufacturer": result.manufacturer,
            "model": result.model,
            "firmware_version": result.firmware_version,
            "device_type": result.device_type.value if result.device_type else None,
            "protocol": result.protocol.value if result.protocol else None,
            "confidence": result.confidence,
            "signatures_matched": result.signatures_matched
        }
    except Exception as e:
        logger.error(f"Device identification failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# PATTERN MATCHING ENDPOINTS
# ============================================

@router.post("/match-patterns", response_model=PatternMatchResponse)
async def match_patterns(request: PatternMatchRequest):
    """
    Find all matching patterns in data
    """
    try:
        data = base64.b64decode(request.data)

        results = pattern_matcher.match_all(data)

        return PatternMatchResponse(
            matches=[
                {
                    "pattern_id": r.pattern_id,
                    "pattern_name": r.pattern_name,
                    "confidence": r.confidence,
                    "position": r.position,
                    "metadata": r.metadata
                }
                for r in results
            ]
        )
    except Exception as e:
        logger.error(f"Pattern matching failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-modbus")
async def parse_modbus(request: PatternMatchRequest, is_request: bool = True):
    """
    Parse Modbus request or response
    """
    try:
        data = base64.b64decode(request.data)

        result = pattern_matcher.match_modbus(data, is_request)

        if result is None:
            raise HTTPException(status_code=400, detail="Invalid Modbus frame")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Modbus parsing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# REGISTER MAPPING ENDPOINTS
# ============================================

@router.post("/analyze-registers", response_model=AnalyzeRegistersResponse)
async def analyze_registers(request: AnalyzeRegistersRequest):
    """
    Analyze registers and detect their types
    """
    try:
        samples = [
            (s.address, s.values)
            for s in request.samples
        ]

        result = register_mapper.analyze_registers(samples)

        return AnalyzeRegistersResponse(
            manufacturer=result.get("manufacturer"),
            model=result.get("model"),
            registers=[
                RegisterInfo(
                    address=r["address"],
                    name=r["name"],
                    data_type=r.get("data_type", "uint16"),
                    scale=r.get("scale", 1.0),
                    unit=r.get("unit", ""),
                    description=r.get("description", ""),
                    category=r.get("category", "unknown"),
                    writable=r.get("writable", False)
                )
                for r in result.get("registers", [])
            ]
        )
    except Exception as e:
        logger.error(f"Register analysis failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-config")
async def generate_config(
    request: AnalyzeRegistersRequest,
    format: str = "json"
):
    """
    Generate register configuration file

    Formats: json, typescript
    """
    try:
        samples = [
            (s.address, s.values)
            for s in request.samples
        ]

        config = register_mapper.generate_config(
            samples,
            device_id=request.device_id,
            export_format=format
        )

        return {
            "format": format,
            "config": config
        }
    except Exception as e:
        logger.error(f"Config generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/built-in-maps")
async def get_built_in_maps():
    """
    Get list of built-in register maps
    """
    return {
        "maps": register_mapper.list_built_in_maps()
    }


@router.get("/built-in-maps/{map_name}")
async def get_built_in_map(map_name: str):
    """
    Get specific built-in register map
    """
    register_map = register_mapper.get_built_in_map(map_name)

    if register_map is None:
        raise HTTPException(status_code=404, detail="Map not found")

    return register_map


# ============================================
# TRAINING ENDPOINTS
# ============================================

@router.get("/training/datasets")
async def list_datasets():
    """
    List available training datasets
    """
    return {
        "datasets": training_pipeline.list_datasets()
    }


@router.get("/training/datasets/{name}")
async def get_dataset_info(name: str):
    """
    Get dataset information
    """
    info = training_pipeline.get_dataset_info(name)

    if info is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    return info


@router.post("/training/samples")
async def add_training_sample(request: TrainingSampleRequest):
    """
    Add a training sample to a dataset
    """
    try:
        data = base64.b64decode(request.data)

        training_pipeline.add_sample(
            dataset_name=request.dataset_name,
            data=data,
            protocol=request.protocol,
            device_type=request.device_type,
            manufacturer=request.manufacturer,
            model=request.model,
            metadata=request.metadata
        )

        training_pipeline.save_dataset(request.dataset_name)

        return {"success": True, "dataset": request.dataset_name}
    except Exception as e:
        logger.error(f"Failed to add training sample: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/training/start")
async def start_training(request: StartTrainingRequest):
    """
    Start a training job
    """
    try:
        job = await training_pipeline.start_training(
            dataset_name=request.dataset_name,
            job_id=request.job_id
        )

        return {
            "job_id": job.id,
            "status": job.status.value,
            "dataset": job.dataset_name
        }
    except Exception as e:
        logger.error(f"Failed to start training: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training/jobs/{job_id}")
async def get_job_status(job_id: str):
    """
    Get training job status
    """
    job = training_pipeline.get_job_status(job_id)

    if job is None:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": job.id,
        "status": job.status.value,
        "progress": job.progress,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "completed_at": job.completed_at.isoformat() if job.completed_at else None,
        "metrics": job.metrics,
        "error": job.error
    }


@router.get("/training/models")
async def list_models():
    """
    List available trained models
    """
    return {
        "models": training_pipeline.list_models()
    }


@router.post("/training/predict")
async def predict_with_model(request: PredictRequest):
    """
    Make prediction using trained model
    """
    try:
        data = base64.b64decode(request.data)

        result = training_pipeline.predict(
            data=data,
            model_name=request.model_name,
            metadata=request.metadata
        )

        return result
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/training/models/{model_name}/export")
async def export_model(model_name: str, format: str = "json"):
    """
    Export trained model
    """
    try:
        export_data = training_pipeline.export_model(model_name, format)

        return {
            "model_name": model_name,
            "format": format,
            "data": export_data
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Model export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
