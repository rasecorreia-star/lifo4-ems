"""
Model Registry -- tracks model versions, metadata, and deployment status.
"""
import json
import os
from datetime import datetime, timezone
from typing import Optional
import structlog

log = structlog.get_logger()

MODEL_DIR = os.getenv("MODEL_DIR", "/app/models")
REGISTRY_FILE = os.path.join(MODEL_DIR, "registry.json")


class ModelRegistry:
    """Manages model versions and deployment records."""

    def _load(self) -> dict:
        if os.path.exists(REGISTRY_FILE):
            with open(REGISTRY_FILE) as f:
                return json.load(f)
        return {}

    def _save(self, registry: dict):
        os.makedirs(MODEL_DIR, exist_ok=True)
        with open(REGISTRY_FILE, "w") as f:
            json.dump(registry, f, indent=2)

    def register(self, system_id: str, model_type: str, metadata: dict):
        """Register a new model version."""
        registry = self._load()
        key = f"{system_id}/{model_type}"
        if key not in registry:
            registry[key] = {"versions": []}
        metadata["registered_at"] = datetime.now(timezone.utc).isoformat()
        registry[key]["versions"].append(metadata)
        registry[key]["current"] = metadata
        self._save(registry)
        log.info("model_registered", system_id=system_id, model_type=model_type, version=metadata.get("version"))

    def get_current(self, system_id: str, model_type: str) -> Optional[dict]:
        registry = self._load()
        entry = registry.get(f"{system_id}/{model_type}")
        return entry.get("current") if entry else None

    def get_history(self, system_id: str, model_type: str) -> list:
        registry = self._load()
        entry = registry.get(f"{system_id}/{model_type}")
        return entry.get("versions", []) if entry else []
