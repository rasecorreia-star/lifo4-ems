"""Prometheus metrics for the edge controller."""
from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram, start_http_server

# Telemetry gauges
BATTERY_SOC = Gauge("lifo4_battery_soc_percent", "Battery State of Charge", ["site_id"])
BATTERY_SOH = Gauge("lifo4_battery_soh_percent", "Battery State of Health", ["site_id"])
BATTERY_POWER = Gauge("lifo4_battery_power_kw", "Battery power (+ charge, - discharge)", ["site_id"])
BATTERY_TEMP_MAX = Gauge("lifo4_battery_temp_max_c", "Max cell temperature", ["site_id"])
GRID_FREQUENCY = Gauge("lifo4_grid_frequency_hz", "Grid frequency", ["site_id"])

# Control metrics
DECISIONS_TOTAL = Counter("lifo4_decisions_total", "Total optimization decisions", ["site_id", "action"])
SAFETY_VIOLATIONS_TOTAL = Counter("lifo4_safety_violations_total", "Total safety violations", ["site_id", "severity"])
MODBUS_ERRORS_TOTAL = Counter("lifo4_modbus_errors_total", "Total Modbus errors", ["site_id"])
MQTT_MESSAGES_SENT = Counter("lifo4_mqtt_messages_sent_total", "Total MQTT messages sent", ["site_id", "topic"])
CLOUD_CONNECTION_STATUS = Gauge("lifo4_cloud_connected", "Cloud MQTT connection (1=connected)", ["site_id"])
CONTROL_LOOP_DURATION = Histogram("lifo4_control_loop_duration_seconds", "Control loop execution time", ["site_id"])


def start_metrics_server(port: int = 9100) -> None:
    """Start Prometheus metrics HTTP server."""
    start_http_server(port)
