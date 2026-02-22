FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Create non-root user and data directory
# F7: never run as root — dedicated system user without login shell
RUN useradd --system --no-create-home --shell /bin/false lifo4edge \
    && mkdir -p /data \
    && chown -R lifo4edge:lifo4edge /app /data

USER lifo4edge

# F1: healthcheck verifies Prometheus metrics endpoint is alive,
# confirming the control loop process is running — not just that a file exists
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -sf http://localhost:9100/metrics | grep -q lifo4_control_loop_duration_seconds

EXPOSE 9100

ENTRYPOINT ["python", "-m", "src.main"]
