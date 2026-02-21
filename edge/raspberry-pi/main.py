"""
Lifo4 EMS - Raspberry Pi Edge Gateway
Main application entry point
"""

import asyncio
import logging
import signal
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config import settings
from services.mqtt_client import MQTTClient
from services.data_buffer import DataBuffer
from services.device_manager import DeviceManager
from services.cloud_sync import CloudSync
from protocols.modbus_handler import ModbusHandler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# Global services
mqtt_client: MQTTClient = None
data_buffer: DataBuffer = None
device_manager: DeviceManager = None
cloud_sync: CloudSync = None
modbus_handler: ModbusHandler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    global mqtt_client, data_buffer, device_manager, cloud_sync, modbus_handler

    logger.info("=" * 50)
    logger.info("Lifo4 EMS - Edge Gateway Starting")
    logger.info(f"Device ID: {settings.device_id}")
    logger.info(f"Site ID: {settings.site_id}")
    logger.info("=" * 50)

    # Initialize services
    logger.info("Initializing data buffer...")
    data_buffer = DataBuffer(settings.database_path)
    await data_buffer.initialize()

    logger.info("Initializing device manager...")
    device_manager = DeviceManager()

    logger.info("Initializing MQTT client...")
    mqtt_client = MQTTClient(
        broker=settings.mqtt_broker,
        port=settings.mqtt_port,
        username=settings.mqtt_username,
        password=settings.mqtt_password,
        device_id=settings.device_id,
    )
    await mqtt_client.connect()

    logger.info("Initializing cloud sync...")
    cloud_sync = CloudSync(
        api_url=settings.cloud_api_url,
        api_key=settings.cloud_api_key,
        data_buffer=data_buffer,
    )

    # Initialize protocol handlers
    if settings.modbus_enabled:
        logger.info("Initializing Modbus handler...")
        modbus_handler = ModbusHandler(
            port=settings.modbus_port,
            baudrate=settings.modbus_baudrate,
            timeout=settings.modbus_timeout,
        )
        await modbus_handler.connect()

    # Start background tasks
    asyncio.create_task(telemetry_loop())
    asyncio.create_task(status_loop())
    asyncio.create_task(sync_loop())

    logger.info("Edge gateway started successfully!")

    yield

    # Shutdown
    logger.info("Shutting down edge gateway...")

    if mqtt_client:
        await mqtt_client.disconnect()
    if modbus_handler:
        await modbus_handler.disconnect()
    if data_buffer:
        await data_buffer.close()

    logger.info("Edge gateway stopped.")


# Create FastAPI app
app = FastAPI(
    title="Lifo4 EMS Edge Gateway",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# BACKGROUND TASKS
# ============================================

async def telemetry_loop():
    """Main telemetry collection loop."""
    while True:
        try:
            await asyncio.sleep(settings.telemetry_interval / 1000)

            if modbus_handler and modbus_handler.is_connected:
                # Read from all configured devices
                for device_id in settings.bms_devices:
                    data = await modbus_handler.read_bms_data(device_id)
                    if data:
                        # Store locally
                        await data_buffer.store_telemetry(device_id, data)

                        # Publish to MQTT
                        if mqtt_client and mqtt_client.is_connected:
                            await mqtt_client.publish_telemetry(device_id, data)

        except Exception as e:
            logger.error(f"Telemetry loop error: {e}")


async def status_loop():
    """System status publishing loop."""
    while True:
        try:
            await asyncio.sleep(settings.status_interval / 1000)

            status = {
                "device_id": settings.device_id,
                "site_id": settings.site_id,
                "online": True,
                "timestamp": datetime.utcnow().isoformat(),
                "uptime": 0,  # TODO: Calculate
                "mqtt_connected": mqtt_client.is_connected if mqtt_client else False,
                "modbus_connected": modbus_handler.is_connected if modbus_handler else False,
                "buffer_size": await data_buffer.get_pending_count() if data_buffer else 0,
            }

            if mqtt_client and mqtt_client.is_connected:
                await mqtt_client.publish_status(status)

        except Exception as e:
            logger.error(f"Status loop error: {e}")


async def sync_loop():
    """Cloud synchronization loop."""
    while True:
        try:
            await asyncio.sleep(settings.sync_interval / 1000)

            if cloud_sync:
                await cloud_sync.sync_pending_data()

        except Exception as e:
            logger.error(f"Sync loop error: {e}")


# ============================================
# API ENDPOINTS
# ============================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "device_id": settings.device_id,
        "timestamp": datetime.utcnow().isoformat(),
        "services": {
            "mqtt": mqtt_client.is_connected if mqtt_client else False,
            "modbus": modbus_handler.is_connected if modbus_handler else False,
            "database": data_buffer is not None,
        }
    }


@app.get("/status")
async def get_status():
    """Get gateway status."""
    pending = await data_buffer.get_pending_count() if data_buffer else 0

    return {
        "device_id": settings.device_id,
        "site_id": settings.site_id,
        "organization_id": settings.organization_id,
        "mqtt_connected": mqtt_client.is_connected if mqtt_client else False,
        "modbus_connected": modbus_handler.is_connected if modbus_handler else False,
        "pending_sync": pending,
        "configured_devices": {
            "bms": len(settings.bms_devices),
            "inverters": len(settings.inverter_devices),
            "meters": len(settings.meter_devices),
        }
    }


@app.get("/devices")
async def list_devices():
    """List connected devices."""
    if device_manager:
        return await device_manager.list_devices()
    return {"devices": []}


@app.get("/telemetry/{device_id}/current")
async def get_current_telemetry(device_id: str):
    """Get current telemetry for a device."""
    if data_buffer:
        data = await data_buffer.get_latest_telemetry(device_id)
        return {"device_id": device_id, "data": data}
    return {"error": "No data available"}


@app.get("/telemetry/{device_id}/history")
async def get_telemetry_history(
    device_id: str,
    start: str = None,
    end: str = None,
    limit: int = 100,
):
    """Get telemetry history for a device."""
    if data_buffer:
        data = await data_buffer.get_telemetry_history(device_id, start, end, limit)
        return {"device_id": device_id, "data": data}
    return {"error": "No data available"}


@app.post("/command/{device_id}")
async def send_command(device_id: str, command: dict):
    """Send command to a device."""
    logger.info(f"Command for {device_id}: {command}")

    if modbus_handler and modbus_handler.is_connected:
        result = await modbus_handler.send_command(device_id, command)
        return {"success": True, "result": result}

    return {"success": False, "error": "Device not reachable"}


# ============================================
# MAIN
# ============================================

def handle_signal(signum, frame):
    """Handle shutdown signals."""
    logger.info(f"Received signal {signum}, shutting down...")
    raise SystemExit(0)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    uvicorn.run(
        "main:app",
        host=settings.api_host,
        port=settings.api_port,
        log_level="info",
    )
