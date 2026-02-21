"""
YOLOv8 Person Detection Service
Detects persons, vehicles, and objects in camera frames
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import numpy as np
from PIL import Image
import io
import torch

from app.config import settings

logger = logging.getLogger(__name__)


class YOLOService:
    """YOLOv8 object detection service."""

    def __init__(self):
        self.model = None
        self.is_loaded = False
        self.device = "cuda" if settings.use_gpu and torch.cuda.is_available() else "cpu"

        # Class names for COCO dataset (YOLOv8 default)
        self.person_class_id = 0  # 'person' in COCO
        self.vehicle_class_ids = [2, 3, 5, 7]  # car, motorcycle, bus, truck

        # Security-relevant classes
        self.security_classes = {
            0: "person",
            2: "car",
            3: "motorcycle",
            5: "bus",
            7: "truck",
            16: "dog",
            17: "horse",
        }

    async def load_model(self):
        """Load YOLOv8 model."""
        try:
            from ultralytics import YOLO

            model_path = settings.yolo_model
            logger.info(f"Loading YOLOv8 model: {model_path} on {self.device}")

            # Load model in thread pool to not block event loop
            loop = asyncio.get_event_loop()
            self.model = await loop.run_in_executor(
                None, lambda: YOLO(model_path)
            )

            # Move to GPU if available
            if self.device == "cuda":
                self.model.to(self.device)

            self.is_loaded = True
            logger.info(f"YOLOv8 model loaded successfully on {self.device}")

        except Exception as e:
            logger.error(f"Failed to load YOLOv8 model: {e}")
            self.is_loaded = False

    async def detect_objects(
        self,
        image: Image.Image,
        confidence: float = None,
        classes: List[int] = None,
    ) -> Dict[str, Any]:
        """
        Detect objects in an image.

        Args:
            image: PIL Image to process
            confidence: Minimum confidence threshold
            classes: List of class IDs to detect (None = all)

        Returns:
            Detection results with bounding boxes
        """
        if not self.is_loaded:
            raise RuntimeError("YOLOv8 model not loaded")

        conf = confidence or settings.yolo_confidence

        # Resize if too large
        if max(image.size) > settings.max_image_size:
            ratio = settings.max_image_size / max(image.size)
            new_size = (int(image.width * ratio), int(image.height * ratio))
            image = image.resize(new_size, Image.LANCZOS)

        # Run inference
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            lambda: self.model(
                image,
                conf=conf,
                iou=settings.yolo_iou_threshold,
                classes=classes,
                verbose=False,
            )
        )

        # Process results
        detections = []
        for result in results:
            boxes = result.boxes
            for i, box in enumerate(boxes):
                class_id = int(box.cls[0])
                class_name = result.names[class_id]
                confidence_score = float(box.conf[0])

                # Get bounding box coordinates
                x1, y1, x2, y2 = box.xyxy[0].tolist()

                detections.append({
                    "class_id": class_id,
                    "class_name": class_name,
                    "confidence": round(confidence_score, 3),
                    "bbox": {
                        "x1": round(x1),
                        "y1": round(y1),
                        "x2": round(x2),
                        "y2": round(y2),
                        "width": round(x2 - x1),
                        "height": round(y2 - y1),
                    },
                    "center": {
                        "x": round((x1 + x2) / 2),
                        "y": round((y1 + y2) / 2),
                    }
                })

        return {
            "image_size": {"width": image.width, "height": image.height},
            "detections": detections,
            "count": len(detections),
            "persons": len([d for d in detections if d["class_id"] == 0]),
            "vehicles": len([d for d in detections if d["class_id"] in self.vehicle_class_ids]),
        }

    async def detect_persons(
        self,
        image: Image.Image,
        confidence: float = None,
    ) -> Dict[str, Any]:
        """Detect only persons in an image."""
        return await self.detect_objects(
            image,
            confidence=confidence,
            classes=[self.person_class_id],
        )

    async def detect_in_zone(
        self,
        image: Image.Image,
        zone_polygon: List[Tuple[int, int]],
        confidence: float = None,
    ) -> Dict[str, Any]:
        """
        Detect objects within a specific zone (polygon).

        Args:
            image: PIL Image
            zone_polygon: List of (x, y) points defining the zone
            confidence: Minimum confidence

        Returns:
            Detections filtered to only those within the zone
        """
        results = await self.detect_objects(image, confidence)

        # Filter detections to those inside the zone
        from shapely.geometry import Point, Polygon

        zone = Polygon(zone_polygon)

        in_zone = []
        for detection in results["detections"]:
            center = Point(detection["center"]["x"], detection["center"]["y"])
            if zone.contains(center):
                detection["in_zone"] = True
                in_zone.append(detection)

        return {
            "image_size": results["image_size"],
            "detections": in_zone,
            "count": len(in_zone),
            "persons": len([d for d in in_zone if d["class_id"] == 0]),
            "zone_triggered": len(in_zone) > 0,
        }

    async def analyze_frame_sequence(
        self,
        frames: List[Image.Image],
        confidence: float = None,
    ) -> Dict[str, Any]:
        """
        Analyze a sequence of frames for motion/tracking.

        Args:
            frames: List of PIL Images
            confidence: Minimum confidence

        Returns:
            Analysis results with person tracking
        """
        all_detections = []
        person_counts = []

        for i, frame in enumerate(frames):
            result = await self.detect_persons(frame, confidence)
            all_detections.append(result)
            person_counts.append(result["persons"])

        # Simple motion analysis
        motion_detected = max(person_counts) > 0
        person_entered = person_counts[-1] > person_counts[0] if len(person_counts) > 1 else False
        person_exited = person_counts[-1] < person_counts[0] if len(person_counts) > 1 else False

        return {
            "frames_analyzed": len(frames),
            "motion_detected": motion_detected,
            "max_persons": max(person_counts),
            "avg_persons": sum(person_counts) / len(person_counts),
            "person_entered": person_entered,
            "person_exited": person_exited,
            "timeline": person_counts,
        }


# Singleton instance
yolo_service = YOLOService()
