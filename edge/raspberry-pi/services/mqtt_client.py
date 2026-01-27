"""
MQTT Client Service for Edge Gateway
"""

import asyncio
import json
import logging
from typing import Callable, Optional
import paho.mqtt.client as mqtt

logger = logging.getLogger(__name__)


class MQTTClient:
    """Async MQTT client for edge gateway."""

    def __init__(
        self,
        broker: str,
        port: int,
        username: str,
        password: str,
        device_id: str,
    ):
        self.broker = broker
        self.port = port
        self.username = username
        self.password = password
        self.device_id = device_id

        self.client: Optional[mqtt.Client] = None
        self.is_connected = False
        self.message_callbacks: dict = {}

        # Topic prefixes
        self.topic_prefix = f"lifo4/edge/{device_id}"

    async def connect(self):
        """Connect to MQTT broker."""
        try:
            self.client = mqtt.Client(
                client_id=self.device_id,
                protocol=mqtt.MQTTv311,
                callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
            )

            self.client.username_pw_set(self.username, self.password)

            # Set callbacks
            self.client.on_connect = self._on_connect
            self.client.on_disconnect = self._on_disconnect
            self.client.on_message = self._on_message

            # LWT message
            lwt_topic = f"{self.topic_prefix}/status"
            lwt_payload = json.dumps({"online": False, "device_id": self.device_id})
            self.client.will_set(lwt_topic, lwt_payload, qos=1, retain=True)

            # Connect
            self.client.connect_async(self.broker, self.port, keepalive=60)
            self.client.loop_start()

            # Wait for connection
            for _ in range(30):
                if self.is_connected:
                    logger.info(f"Connected to MQTT broker: {self.broker}:{self.port}")
                    return True
                await asyncio.sleep(1)

            logger.warning("MQTT connection timeout")
            return False

        except Exception as e:
            logger.error(f"MQTT connection error: {e}")
            return False

    async def disconnect(self):
        """Disconnect from MQTT broker."""
        if self.client:
            # Publish offline status
            await self.publish_status({"online": False, "device_id": self.device_id})

            self.client.loop_stop()
            self.client.disconnect()
            self.is_connected = False
            logger.info("Disconnected from MQTT broker")

    def _on_connect(self, client, userdata, flags, rc, properties=None):
        """Callback when connected to broker."""
        if rc == 0:
            self.is_connected = True
            logger.info("MQTT connected successfully")

            # Subscribe to command topics
            self.client.subscribe(f"{self.topic_prefix}/command/#")
            self.client.subscribe(f"{self.topic_prefix}/config/#")
        else:
            logger.error(f"MQTT connection failed with code: {rc}")

    def _on_disconnect(self, client, userdata, flags, rc, properties=None):
        """Callback when disconnected from broker."""
        self.is_connected = False
        if rc != 0:
            logger.warning(f"MQTT disconnected unexpectedly: {rc}")

    def _on_message(self, client, userdata, message):
        """Callback when message received."""
        try:
            topic = message.topic
            payload = json.loads(message.payload.decode())

            logger.debug(f"MQTT message: {topic} -> {payload}")

            # Find matching callback
            for pattern, callback in self.message_callbacks.items():
                if topic.startswith(pattern.replace("#", "")):
                    asyncio.create_task(callback(topic, payload))
                    break

        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")

    def subscribe(self, topic: str, callback: Callable):
        """Subscribe to a topic with callback."""
        full_topic = f"{self.topic_prefix}/{topic}"
        self.message_callbacks[full_topic] = callback
        if self.client and self.is_connected:
            self.client.subscribe(full_topic)
        logger.debug(f"Subscribed to {full_topic}")

    async def publish(self, topic: str, payload: dict, retain: bool = False):
        """Publish message to topic."""
        if not self.client or not self.is_connected:
            logger.warning("MQTT not connected, cannot publish")
            return False

        full_topic = f"{self.topic_prefix}/{topic}"
        message = json.dumps(payload)

        result = self.client.publish(full_topic, message, qos=1, retain=retain)

        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            logger.debug(f"Published to {full_topic}")
            return True
        else:
            logger.error(f"Publish failed: {result.rc}")
            return False

    async def publish_telemetry(self, device_id: str, data: dict):
        """Publish telemetry data."""
        topic = f"bms/{device_id}/telemetry"
        return await self.publish(topic, data)

    async def publish_status(self, status: dict):
        """Publish gateway status."""
        return await self.publish("status", status, retain=True)

    async def publish_alert(self, alert: dict):
        """Publish alert."""
        return await self.publish("alert", alert)
