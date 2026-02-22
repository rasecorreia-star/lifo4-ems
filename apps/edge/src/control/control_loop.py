"""
Main control loop for the edge controller.
Runs continuously, executing: read → safety → decide → command → sync.
Safety ALWAYS runs before optimization — no exceptions.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime

from src.config import EdgeConfig
from src.communication.modbus_client import ModbusClient
from src.communication.mqtt_client import EdgeMqttClient
from src.data.local_db import LocalDatabase
from src.data.sync_manager import SyncManager
from src.safety.safety_manager import SafetyAction, SafetyManager
from src.safety.watchdog import SoftwareWatchdog
from src.utils.logger import get_logger
from src.utils.metrics import (
    BATTERY_POWER,
    BATTERY_SOC,
    BATTERY_TEMP_MAX,
    CONTROL_LOOP_DURATION,
    SAFETY_VIOLATIONS_TOTAL,
)

logger = get_logger(__name__)


class ControlLoop:
    """
    Main edge controller loop.
    Coordinates: safety → optimization → command execution → cloud sync.
    """

    def __init__(
        self,
        config: EdgeConfig,
        modbus: ModbusClient,
        mqtt: EdgeMqttClient,
        db: LocalDatabase,
        decision_engine,  # LocalDecisionEngine (imported in Phase 5)
    ):
        self._config = config
        self._modbus = modbus
        self._mqtt = mqtt
        self._db = db
        self._sync = SyncManager(db, mqtt)
        self._safety = SafetyManager()
        self._engine = decision_engine
        self._watchdog = SoftwareWatchdog(timeout_seconds=60.0)
        self._site_id = config.site.id
        self._running = False
        self._last_optimization_time = 0.0
        self._last_cleanup_time = 0.0
        self._safe_mode = False

    async def start(self) -> None:
        """Start the control loop."""
        self._running = True
        await self._watchdog.start()

        # Subscribe MQTT topics
        self._mqtt.subscribe_commands(self._handle_cloud_command)
        self._mqtt.subscribe_config(self._handle_cloud_config)

        logger.info("control_loop_started", site_id=self._site_id)
        await self._run()

    async def stop(self) -> None:
        self._running = False
        await self._watchdog.stop()
        logger.info("control_loop_stopped")

    async def _run(self) -> None:
        """Main loop body."""
        while self._running:
            loop_start = time.monotonic()
            try:
                await self._cycle()
            except Exception as e:
                logger.critical("control_loop_unexpected_error", error=str(e), exc_info=True)
                await self._enter_safe_mode("Unexpected error in control loop")
            finally:
                elapsed = time.monotonic() - loop_start
                CONTROL_LOOP_DURATION.labels(site_id=self._site_id).observe(elapsed)
                # Sleep remaining time in the sample interval
                sleep_time = max(0.0, self._config.control.sample_interval_seconds - elapsed)
                await asyncio.sleep(sleep_time)

    async def _cycle(self) -> None:
        """One full control cycle."""
        self._watchdog.heartbeat()

        # ── 1. Read telemetry from BMS ───────────────────────────────────
        telemetry = await self._modbus.read_telemetry()
        if telemetry is None:
            logger.error("control_loop_no_telemetry")
            await self._handle_modbus_failure()
            return

        # ── 2. Update Prometheus metrics ─────────────────────────────────
        BATTERY_SOC.labels(site_id=self._site_id).set(telemetry.soc)
        BATTERY_POWER.labels(site_id=self._site_id).set(telemetry.power_kw)
        BATTERY_TEMP_MAX.labels(site_id=self._site_id).set(telemetry.temp_max)

        # ── 3. SAFETY CHECK (ALWAYS first, ALWAYS unconditional) ─────────
        safety_result = self._safety.check(telemetry)
        if not safety_result.is_ok:
            SAFETY_VIOLATIONS_TOTAL.labels(
                site_id=self._site_id, severity=safety_result.severity
            ).inc()
            await self._execute_safety_action(safety_result)
            await self._report_safety_event(safety_result)
            # Save telemetry even if in safety mode
            await self._db.save_telemetry(telemetry)
            return  # Skip optimization entirely

        # ── 4. Save telemetry locally ────────────────────────────────────
        await self._db.save_telemetry(telemetry)

        # ── 5. Optimization (every N seconds) ────────────────────────────
        now = time.monotonic()
        if now - self._last_optimization_time >= self._config.control.optimization_interval_seconds:
            self._last_optimization_time = now
            decision = await self._engine.decide(telemetry)
            await self._execute_decision(decision)
            await self._log_decision(decision)

        # ── 6. Send heartbeat ─────────────────────────────────────────────
        await self._mqtt.publish_heartbeat(self._engine.mode.value)

        # ── 7. Sync with cloud (if online) ───────────────────────────────
        if self._mqtt.is_connected:
            await self._sync.sync(telemetry)

        # ── 8. Periodic cleanup ───────────────────────────────────────────
        if now - self._last_cleanup_time >= self._config.data.cleanup_interval_hours * 3600:
            self._last_cleanup_time = now
            await self._db.cleanup_old_data(
                telemetry_hours=self._config.data.telemetry_retention_hours,
                decisions_days=self._config.data.decisions_retention_days,
                alarms_days=self._config.data.alarms_retention_days,
            )

    async def _execute_safety_action(self, result) -> None:
        """Execute the appropriate hardware action for a safety violation."""
        action = result.action
        logger.warning(
            "safety_action_executing",
            action=action.value,
            reason=result.reason,
        )

        if action == SafetyAction.EMERGENCY_STOP:
            await self._modbus.emergency_stop()
            await self._modbus.write_coil("charge_enable", False)
            await self._modbus.write_coil("discharge_enable", False)

        elif action == SafetyAction.STOP_CHARGE:
            await self._modbus.write_coil("charge_enable", False)
            await self._modbus.write_power_setpoint(0.0)

        elif action == SafetyAction.STOP_DISCHARGE:
            await self._modbus.write_coil("discharge_enable", False)
            await self._modbus.write_power_setpoint(0.0)

        elif action == SafetyAction.STOP_ALL:
            await self._modbus.write_power_setpoint(0.0)
            await self._modbus.write_coil("charge_enable", False)
            await self._modbus.write_coil("discharge_enable", False)

        elif action == SafetyAction.REDUCE_POWER:
            # Reduce to 50% of current power
            pass  # Decision engine handles power reduction

        elif action == SafetyAction.REDUCE_CURRENT:
            pass  # Decision engine handles current limiting

    async def _report_safety_event(self, result) -> None:
        """Log safety event to DB and MQTT."""
        alarm = {
            "timestamp": datetime.utcnow().isoformat(),
            "severity": result.severity,
            "type": f"SAFETY_{result.action.value}",
            "message": result.reason,
            "metadata": {"value": result.value, "limit": result.limit},
        }
        await self._db.save_alarm(alarm)
        await self._mqtt.publish_alarm(alarm)

    async def _execute_decision(self, decision: dict) -> None:
        """Send decision as Modbus command to PCS/BMS."""
        action = decision.get("action", "IDLE")
        power_kw = decision.get("power_kw", 0.0)

        if action == "IDLE":
            await self._modbus.write_power_setpoint(0.0)
        elif action == "CHARGE":
            await self._modbus.write_coil("charge_enable", True)
            await self._modbus.write_coil("discharge_enable", False)
            await self._modbus.write_power_setpoint(abs(power_kw))
        elif action == "DISCHARGE":
            await self._modbus.write_coil("charge_enable", False)
            await self._modbus.write_coil("discharge_enable", True)
            await self._modbus.write_power_setpoint(-abs(power_kw))
        elif action == "EMERGENCY_STOP":
            await self._modbus.emergency_stop()

        logger.info(
            "decision_executed",
            action=action,
            power_kw=power_kw,
            reason=decision.get("reason", ""),
        )

    async def _log_decision(self, decision: dict) -> None:
        """Save decision to SQLite and MQTT."""
        await self._db.save_decision(decision)
        if not self._mqtt.is_connected:
            await self._db.enqueue_for_sync(
                f"lifo4/{self._site_id}/decisions", decision, qos=1
            )
        else:
            await self._mqtt.publish_decision(decision)

    async def _handle_modbus_failure(self) -> None:
        """Handle BMS communication failure."""
        logger.error("modbus_failure_entering_safe_mode")
        await self._enter_safe_mode("Modbus communication failure")
        await asyncio.sleep(30)  # Wait before retry

    async def _enter_safe_mode(self, reason: str) -> None:
        """Enter safe mode: only maintain SOC within safe bounds."""
        if not self._safe_mode:
            logger.warning("entering_safe_mode", reason=reason)
            self._safe_mode = True
            await self._db.save_alarm({
                "severity": "high",
                "type": "SAFE_MODE_ENTERED",
                "message": reason,
            })

    async def _handle_cloud_command(self, command: dict) -> None:
        """Process command received from cloud via MQTT."""
        self._engine.receive_cloud_command(command)
        logger.info("cloud_command_received", command=command)

    async def _handle_cloud_config(self, config_update: dict) -> None:
        """Process configuration update from cloud."""
        self._engine.update_config(config_update)
        logger.info("cloud_config_updated")
