"""
Edge Deployer -- sends trained ONNX models to edge devices via MQTT.
"""
import os
import asyncio
import hashlib
import json
import struct
from datetime import datetime, timezone
from urllib.parse import urlparse
import structlog

log = structlog.get_logger()

MQTT_URL = os.getenv("MQTT_URL", "mqtt://mosquitto:1883")
MODEL_DEPLOY_TOPIC = "lifo4/{system_id}/models"
MODEL_ACK_TOPIC = "lifo4/{system_id}/models/ack"
DEPLOY_TIMEOUT_SECONDS = 3600  # 1 hour


class EdgeDeployer:
    """Publishes ONNX models to edge devices via MQTT."""

    async def deploy(self, system_id: str, onnx_path: str, metadata: dict):
        """Send model to edge device and wait for acknowledgement."""
        try:
            import asyncio_mqtt as aiomqtt

            with open(onnx_path, "rb") as f:
                model_bytes = f.read()

            checksum = hashlib.sha256(model_bytes).hexdigest()
            payload = {
                "type": "model_update",
                "system_id": system_id,
                "model_type": "load_forecast",
                "checksum": checksum,
                "size_bytes": len(model_bytes),
                "metadata": metadata,
                "model_b64": __import__("base64").b64encode(model_bytes).decode(),
            }

            topic = MODEL_DEPLOY_TOPIC.format(system_id=system_id)
            parsed = urlparse(MQTT_URL)
            host = parsed.hostname or "mosquitto"
            port = parsed.port or 1883

            async with aiomqtt.Client(hostname=host, port=port) as client:
                await client.publish(topic, json.dumps(payload), qos=1)
                log.info("model_published_to_edge", system_id=system_id, checksum=checksum[:8], bytes=len(model_bytes))

                # Wait for ack
                ack_topic = MODEL_ACK_TOPIC.format(system_id=system_id)
                async with client.messages() as messages:
                    await client.subscribe(ack_topic)
                    try:
                        async with asyncio.timeout(60):
                            async for msg in messages:
                                ack = json.loads(msg.payload)
                                if ack.get("checksum") == checksum:
                                    log.info("model_ack_received", system_id=system_id)
                                    return
                    except asyncio.TimeoutError:
                        log.warning("model_ack_timeout", system_id=system_id)

        except Exception as e:
            log.error("edge_deploy_failed", system_id=system_id, error=str(e))
