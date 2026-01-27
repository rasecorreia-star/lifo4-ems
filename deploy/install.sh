#!/bin/bash

# ============================================
# Lifo4 EMS - Installation Script
# For Ubuntu 22.04 VPS (3GB RAM / 50GB Disk)
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "============================================"
echo "   Lifo4 EMS - Installation Script"
echo "   Energy Management System"
echo "============================================"
echo -e "${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Please run as root (sudo)${NC}"
    exit 1
fi

# Variables
INSTALL_DIR="/opt/lifo4-ems"
REPO_URL="https://github.com/lifo4energia/ems.git"  # Update with your repo

echo -e "${YELLOW}[1/8] Updating system...${NC}"
apt-get update && apt-get upgrade -y

echo -e "${YELLOW}[2/8] Installing dependencies...${NC}"
apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    htop \
    unzip \
    ufw

echo -e "${YELLOW}[3/8] Installing Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    systemctl enable docker
    systemctl start docker
else
    echo "Docker already installed"
fi

echo -e "${YELLOW}[4/8] Installing Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')
    curl -L "https://github.com/docker/compose/releases/download/${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose already installed"
fi

echo -e "${YELLOW}[5/8] Configuring firewall...${NC}"
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1883/tcp  # MQTT
ufw allow 9001/tcp  # MQTT WebSocket
ufw --force enable

echo -e "${YELLOW}[6/8] Creating swap file (for 3GB RAM)...${NC}"
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    # Optimize swap
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    sysctl -p
else
    echo "Swap already configured"
fi

echo -e "${YELLOW}[7/8] Creating application directory...${NC}"
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Create directory structure
mkdir -p deploy/nginx/conf.d
mkdir -p deploy/mosquitto/config
mkdir -p deploy/mosquitto/data
mkdir -p deploy/mosquitto/log
mkdir -p deploy/certbot/www
mkdir -p deploy/certbot/conf

echo -e "${YELLOW}[8/8] Setting permissions...${NC}"
chown -R 1000:1000 $INSTALL_DIR

echo -e "${GREEN}"
echo "============================================"
echo "   Base installation completed!"
echo "============================================"
echo -e "${NC}"

echo -e "${BLUE}Next steps:${NC}"
echo "1. Copy your project files to: $INSTALL_DIR"
echo "2. Configure environment variables in: $INSTALL_DIR/deploy/.env"
echo "3. Run: cd $INSTALL_DIR/deploy && docker-compose -f docker-compose.prod.yml up -d"
echo ""
echo -e "${YELLOW}Server IP: $(curl -s ifconfig.me)${NC}"
echo ""
