"""
MQTT client with automatic reconnect, offline buffering, and QoS differentiation.
Supports mTLS for secure cloud communication.
"""
from __future__ import annotations

import asyncio
import json
from collections import deque
from datetime import datetime
from typing import Any, Callable, Optional

import asyncio_mqtt as aiomqtt

from src.config import MqttConfig
from src.utils.logger import get_logger
from src.utils.metrics import CLOUD_CONNECTION_STATUS, MQTT_MESSAGES_SENT

logger = get_logger(__name__)

# F2: QoS requirements per topic suffix
# commands/config/models are safety-critical — require exactly-once (QoS 2)
# telemetry/alarms/status/heartbeat use lower QoS for throughput
_TOPIC_QOS: dict[str, int] = {
    "commands": 2,  # Exactly-once: BMS commands must not duplicate or be lost
    "config":   2,  # Exactly-once: config changes must be applied exactly once
    "models":   2,  # Exactly-once: ML model OTA must not partially update
}


class MqttMessage:
    """Buffered message awaiting delivery."""
    def __init__(self, topic: str, payload: dict, qos: int):
        self.topic = topic
        self.payload = payload
        self.qos = qos
        self.created_at = datetime.utcnow()


class EdgeMqttClient:
    """
    MQTT client with:
    - Auto-reconnect with exponential backoff
    - Offline buffer (up to N messages)
    - QoS differentiation (0=telemetry, 1=alarms, 2=commands/config/models)
    - Last Will Testament (LWT) for disconnect detection
    - mTLS support
    """

    def __init__(self, config: MqttConfig, site_id: str):
        self._config = config
        self._site_id = site_id
        self._client: Optional[aiomqtt.Client] = None
        self._connected = False
        self._offline_buffer: deque[MqttMessage] = deque(maxlen=config.offline_buffer_size)
        # F2: store (handler, qos) per topic
        self._message_handlers: dict[str, tuple[Callable, int]] = {}
        self._reconnect_delay = config.reconnect_min_delay
        self._running = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    def _topic(self, suffix: str) -> str:
        return f"lifo4/{self._site_id}/{suffix}"

    def _topic_qos(self, topic: str) -> int:
        """Return the required QoS for a topic (by its last segment)."""
        suffix = topic.rsplit("/", 1)[-1]
        return _TOPIC_QOS.get(suffix, 1)

    def subscribe_commands(self, handler: Callable[[dict], Any]) -> None:
        """Register handler for commands received from cloud (QoS 2 — exactly-once)."""
        topic = self._topic("commands")
        self._message_handlers[topic] = (handler, 2)  # F2: QoS 2

    def subscribe_config(self, handler: Callable[[dict], Any]) -> None:
        """Register handler for config updates from cloud (QoS 2 — exactly-once)."""
        topic = self._topic("config")
        self._message_handlers[topic] = (handler, 2)  # F2: QoS 2

    def subscribe_models(self, handler: Callable[[dict], Any]) -> None:
        """Register handler for ML model OTA updates (QoS 2 — exactly-once)."""
        topic = self._topic("models")
        self._message_handlers[topic] = (handler, 2)  # F2: QoS 2

    async def start(self) -> None:
        """Start MQTT client with auto-reconnect loop."""
        self._running = True
        asyncio.create_task(self._connection_loop())
        logger.info("mqtt_client_started", site_id=self._site_id)

    async def stop(self) -> None:
        self._running = False
        self._connected = False
        logger.info("mqtt_client_stopped")

    async def _connection_loop(self) -> None:
        """Continuously try to maintain MQTT connection."""
        while self._running:
            try:
                tls_params = None
                if self._config.use_tls:
                    import ssl
                    tls_params = aiomqtt.TLSParameters(
                        ca_certs=self._config.ca_cert,
                        certfile=self._config.client_cert,
                        keyfile=self._config.client_key,
                        tls_version=ssl.PROTOCOL_TLS_CLIENT,
                    )

                port = (
                    self._config.broker_tls_port
                    if self._config.use_tls
                    else self._config.broker_port
                )

                will = aiomqtt.Will(
                    topic=self._topic("status"),
                    payload=json.dumps({"online": False, "site_id": self._site_id}).encode(),
                    qos=1,
                    retain=True,
                )

                async with aiomqtt.Client(
                    hostname=self._config.broker_host,
                    port=port,
                    keepalive=self._config.keepalive_seconds,
                    identifier=self._config.client_id,
                    will=will,
                    tls_params=tls_params,
                ) as client:
                    self._client = client
                    self._connected = True
                    self._reconnect_delay = self._config.reconnect_min_delay
                    CLOUD_CONNECTION_STATUS.labels(site_id=self._site_id).set(1)
                    logger.info("mqtt_connected", broker=self._config.broker_host)

                    # Announce online status
                    await self._publish_raw(
                        self._topic("status"),
                        {"online": True, "site_id": self._site_id},
                        qos=1,
                        retain=True,
                    )

                    # F2: Subscribe each topic with its required QoS
                    for topic, (_, qos) in self._message_handlers.items():
                        await client.subscribe(topic, qos=qos)
                        logger.info("mqtt_subscribed", topic=topic, qos=qos)

                    # Flush offline buffer
                    await self._flush_offline_buffer()

                    # Process incoming messages
                    async with client.messages() as messages:
                        async for message in messages:
                            await self._handle_message(message)

            except Exception as e:
                self._connected = False
                self._client = None
                CLOUD_CONNECTION_STATUS.labels(site_id=self._site_id).set(0)
                logger.warning(
                    "mqtt_disconnected",
                    error=str(e),
                    reconnect_in=self._reconnect_delay,
                )
                await asyncio.sleep(self._reconnect_delay)
                self._reconnect_delay = min(
                    self._reconnect_delay * 2,
                    self._config.reconnect_max_delay,
                )

    async def _handle_message(self, message: aiomqtt.Message) -> None:
        """Route incoming MQTT message to registered handler."""
        topic = str(message.topic)
        entry = self._message_handlers.get(topic)
        if entry:
            handler, _ = entry
            try:
                payload = json.loads(message.payload.decode())
                await handler(payload) if asyncio.iscoroutinefunction(handler) else handler(payload)
            except Exception as e:
                logger.error("mqtt_message_handler_error", topic=topic, error=str(e))

    async def _publish_raw(self, topic: str, payload: dict, qos: int = 0, retain: bool = False) -> None:
        if self._client and self._connected:
            await self._client.publish(
                topic=topic,
                payload=json.dumps(payload).encode(),
                qos=qos,
                retain=retain,
            )
            MQTT_MESSAGES_SENT.labels(site_id=self._site_id, topic=topic.split("/")[-1]).inc()

    async def _flush_offline_buffer(self) -> None:
        """Send all buffered messages after reconnection."""
        flushed = 0
        while self._offline_buffer:
            msg = self._offline_buffer.popleft()
            await self._publish_raw(msg.topic, msg.payload, msg.qos)
            flushed += 1
        if flushed:
            logger.info("mqtt_buffer_flushed", count=flushed)

    async def publish_telemetry(self, data: dict) -> None:
        """Publish standard telemetry — QoS 0 (fire and forget, 1Hz cadence)."""
        topic = self._topic("telemetry")
        if self._connected:
            await self._publish_raw(topic, data, qos=0)
        else:
            self._offline_buffer.append(MqttMessage(topic, data, qos=0))

    async def publish_fast_telemetry(self, data: dict) -> None:
        """
        F8: Publish fast telemetry — QoS 0 on dedicated high-frequency topic.
        Used for real-time dashboard updates at 10Hz cadence.
        Not buffered offline (fire-and-forget — stale fast data has no value).
        """
        if self._connected:
            await self._publish_raw(self._topic("telemetry/fast"), data, qos=0)

    async def publish_alarm(self, alarm: dict) -> None:
        """Publish alarm — QoS 1 (at least once)."""
        topic = self._topic("alarms")
        if self._connected:
            await self._publish_raw(topic, alarm, qos=1)
        else:
            self._offline_buffer.append(MqttMessage(topic, alarm, qos=1))

    async def publish_decision(self, decision: dict) -> None:
        """Publish decision log — QoS 1."""
        topic = self._topic("decisions")
        if self._connected:
            await self._publish_raw(topic, decision, qos=1)
        else:
            self._offline_buffer.append(MqttMessage(topic, decision, qos=1))

    async def publish_heartbeat(self, state: str) -> None:
        """Publish heartbeat — QoS 0."""
        await self._publish_raw(
            self._topic("heartbeat"),
            {"site_id": self._site_id, "state": state, "ts": datetime.utcnow().isoformat()},
            qos=0,
        )
