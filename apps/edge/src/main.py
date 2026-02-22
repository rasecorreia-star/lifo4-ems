"""
Edge Controller entry point.
Initializes all components and starts the control loop.
"""
from __future__ import annotations

import asyncio
import signal
import sys

from src.config import load_config
from src.communication.modbus_client import ModbusClient
from src.communication.mqtt_client import EdgeMqttClient
from src.control.control_loop import ControlLoop
from src.data.local_db import LocalDatabase
from src.utils.logger import get_logger, setup_logging
from src.utils.metrics import start_metrics_server

# Import decision engine (implemented in Phase 5)
from src.control.decision_engine import LocalDecisionEngine


async def main() -> None:
    config = load_config()
    setup_logging(level="INFO")
    logger = get_logger("main")

    logger.info(
        "edge_controller_starting",
        site_id=config.site.id,
        site_name=config.site.name,
    )

    # Start Prometheus metrics server
    try:
        start_metrics_server(port=9100)
    except Exception as e:
        logger.warning("metrics_server_failed", error=str(e))

    # Initialize components
    db = LocalDatabase(config.data.sqlite_path)
    await db.connect()

    modbus = ModbusClient(config.modbus, config.site.id)
    mqtt = EdgeMqttClient(config.mqtt, config.site.id)
    engine = LocalDecisionEngine(config)

    # Start MQTT connection (background task)
    await mqtt.start()

    loop = ControlLoop(
        config=config,
        modbus=modbus,
        mqtt=mqtt,
        db=db,
        decision_engine=engine,
    )

    # Graceful shutdown on SIGTERM/SIGINT
    stop_event = asyncio.Event()

    def _shutdown(*_):
        logger.info("shutdown_signal_received")
        stop_event.set()

    for sig in (signal.SIGTERM, signal.SIGINT):
        try:
            asyncio.get_running_loop().add_signal_handler(sig, _shutdown)
        except (OSError, NotImplementedError):
            pass  # Windows doesn't support add_signal_handler

    # Start control loop (runs until shutdown)
    control_task = asyncio.create_task(loop.start())
    await stop_event.wait()

    # Graceful shutdown
    await loop.stop()
    await mqtt.stop()
    await modbus.disconnect()
    await db.close()
    control_task.cancel()

    logger.info("edge_controller_stopped")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
