#!/bin/bash
# InfluxDB initialization script
# Creates buckets, tasks (downsampling), and initial configuration
# This runs automatically via docker-entrypoint-initdb.d

set -e

INFLUX_URL="http://localhost:8086"
# F14: use :? to fail hard if token is not set — never fall back to insecure default
TOKEN="${DOCKER_INFLUXDB_INIT_ADMIN_TOKEN:?Error: DOCKER_INFLUXDB_INIT_ADMIN_TOKEN must be set in environment}"
ORG="lifo4"

echo "Waiting for InfluxDB to be ready..."
until curl -sf "${INFLUX_URL}/ping" > /dev/null; do
    sleep 2
done
echo "InfluxDB is ready."

# Create aggregated telemetry bucket (2 year retention)
influx bucket create \
    --name telemetry_aggregated \
    --org "${ORG}" \
    --token "${TOKEN}" \
    --retention 8760h \
    2>/dev/null || echo "Bucket telemetry_aggregated already exists"

# Create downsampling task (runs hourly)
influx task create \
    --org "${ORG}" \
    --token "${TOKEN}" \
    --file /docker-entrypoint-initdb.d/downsample_task.flux \
    2>/dev/null || echo "Downsampling task may already exist"

echo "InfluxDB initialization complete."
