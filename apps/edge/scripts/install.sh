#!/bin/bash
# Installation script for edge controller on real hardware (RPi 4 / Jetson Nano / IPC)
# Tested on Ubuntu 22.04 LTS

set -e

INSTALL_DIR="/opt/lifo4-edge"
SERVICE_NAME="lifo4-edge"
PYTHON_MIN="3.11"
# F6: dedicated non-privileged user — never run as root
EDGE_USER="lifo4edge"

echo "=== LIFO4 Edge Controller Installation ==="
echo "Target: ${INSTALL_DIR}"

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "Python version: ${python_version}"

# F6: Create dedicated system user if not exists
if ! id "${EDGE_USER}" &>/dev/null; then
    sudo useradd --system --no-create-home --shell /bin/false "${EDGE_USER}"
    echo "Created system user: ${EDGE_USER}"
fi

# Create install directory
sudo mkdir -p "${INSTALL_DIR}"
sudo mkdir -p "${INSTALL_DIR}/data"
sudo mkdir -p "${INSTALL_DIR}/config"
sudo mkdir -p "${INSTALL_DIR}/certs"
sudo mkdir -p "${INSTALL_DIR}/src/ml/models"

# Copy application files
sudo cp -r src/ "${INSTALL_DIR}/"
sudo cp -r config/ "${INSTALL_DIR}/"
sudo cp requirements.txt "${INSTALL_DIR}/"

# Set ownership to dedicated user (not root)
sudo chown -R "${EDGE_USER}:${EDGE_USER}" "${INSTALL_DIR}"

# Install Python dependencies
sudo pip3 install -r requirements.txt --no-cache-dir

# Create systemd service
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=LIFO4 Edge Controller
After=network.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=${EDGE_USER}
Group=${EDGE_USER}
WorkingDirectory=${INSTALL_DIR}
Environment="PYTHONPATH=${INSTALL_DIR}"
Environment="SQLITE_PATH=${INSTALL_DIR}/data/edge.db"
ExecStart=/usr/bin/python3 -m src.main
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Security hardening (F6)
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${INSTALL_DIR}/data

# Resource limits
LimitNOFILE=65536
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl start "${SERVICE_NAME}"

echo ""
echo "=== Installation complete ==="
echo "Service status: sudo systemctl status ${SERVICE_NAME}"
echo "Logs: sudo journalctl -u ${SERVICE_NAME} -f"
echo ""
echo "IMPORTANT: Copy your site config to ${INSTALL_DIR}/config/site.yaml"
echo "IMPORTANT: Copy TLS certificates to ${INSTALL_DIR}/certs/"
