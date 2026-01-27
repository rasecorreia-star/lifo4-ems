"""
Object Detection Router - YOLOv8 endpoints
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from PIL import Image
import io
from typing import List, Optional
import base64

from app.services.yolo_service import yolo_service

router = APIRouter()


@router.post("/image")
async def detect_in_image(
    file: UploadFile = File(...),
    confidence: float = Query(0.5, ge=0.1, le=1.0),
    classes: Optional[str] = Query(None, description="Comma-separated class IDs"),
):
    """
    Detect objects in an uploaded image.

    Args:
        file: Image file (JPEG, PNG)
        confidence: Minimum confidence threshold (0.1-1.0)
        classes: Optional comma-separated class IDs to detect

    Returns:
        Detection results with bounding boxes
    """
    if not yolo_service.is_loaded:
        raise HTTPException(status_code=503, detail="YOLOv8 model not loaded")

    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        # Read and convert image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        # Parse class filter
        class_filter = None
        if classes:
            class_filter = [int(c.strip()) for c in classes.split(",")]

        # Run detection
        results = await yolo_service.detect_objects(
            image,
            confidence=confidence,
            classes=class_filter,
        )

        return JSONResponse(content={
            "success": True,
            "data": results,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/persons")
async def detect_persons(
    file: UploadFile = File(...),
    confidence: float = Query(0.5, ge=0.1, le=1.0),
):
    """
    Detect only persons in an image.

    Optimized endpoint for security applications.
    """
    if not yolo_service.is_loaded:
        raise HTTPException(status_code=503, detail="YOLOv8 model not loaded")

    try:
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        results = await yolo_service.detect_persons(image, confidence=confidence)

        return JSONResponse(content={
            "success": True,
            "data": results,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/zone")
async def detect_in_zone(
    file: UploadFile = File(...),
    zone: str = Query(..., description="Zone polygon as JSON array of [x,y] points"),
    confidence: float = Query(0.5, ge=0.1, le=1.0),
):
    """
    Detect objects within a security zone.

    Zone is defined as a polygon with points [[x1,y1], [x2,y2], ...].
    """
    import json

    if not yolo_service.is_loaded:
        raise HTTPException(status_code=503, detail="YOLOv8 model not loaded")

    try:
        # Parse zone polygon
        zone_polygon = json.loads(zone)
        if not isinstance(zone_polygon, list) or len(zone_polygon) < 3:
            raise HTTPException(
                status_code=400,
                detail="Zone must be a polygon with at least 3 points"
            )

        zone_tuples = [(p[0], p[1]) for p in zone_polygon]

        contents = await file.read()
        image = Image.open(io.BytesIO(contents))

        results = await yolo_service.detect_in_zone(
            image,
            zone_polygon=zone_tuples,
            confidence=confidence,
        )

        return JSONResponse(content={
            "success": True,
            "data": results,
        })

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid zone polygon format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/base64")
async def detect_in_base64(
    image_data: str,
    confidence: float = Query(0.5, ge=0.1, le=1.0),
    classes: Optional[str] = Query(None),
):
    """
    Detect objects in a base64-encoded image.

    Useful for real-time camera frame analysis.
    """
    if not yolo_service.is_loaded:
        raise HTTPException(status_code=503, detail="YOLOv8 model not loaded")

    try:
        # Decode base64
        if "," in image_data:
            image_data = image_data.split(",")[1]

        image_bytes = base64.b64decode(image_data)
        image = Image.open(io.BytesIO(image_bytes))

        class_filter = None
        if classes:
            class_filter = [int(c.strip()) for c in classes.split(",")]

        results = await yolo_service.detect_objects(
            image,
            confidence=confidence,
            classes=class_filter,
        )

        return JSONResponse(content={
            "success": True,
            "data": results,
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def detection_status():
    """Get detection service status."""
    return {
        "service": "yolo_detection",
        "loaded": yolo_service.is_loaded,
        "device": yolo_service.device,
        "model": yolo_service.model.__class__.__name__ if yolo_service.model else None,
    }
