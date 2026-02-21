#!/bin/bash

# ============================================
# Lifo4 EMS - Setup and Deploy Script
# Run this AFTER copying files to the server
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

INSTALL_DIR="/opt/lifo4-ems"
cd $INSTALL_DIR

echo -e "${BLUE}"
echo "============================================"
echo "   Lifo4 EMS - Setup and Deploy"
echo "============================================"
echo -e "${NC}"

# Check if .env exists
if [ ! -f deploy/.env ]; then
    echo -e "${YELLOW}Creating .env from example...${NC}"
    cp deploy/.env.example deploy/.env
    echo -e "${RED}Please edit deploy/.env with your configuration!${NC}"
    echo "Run: nano deploy/.env"
    exit 1
fi

echo -e "${YELLOW}[1/5] Creating required directories...${NC}"
mkdir -p deploy/mosquitto/data
mkdir -p deploy/mosquitto/log
mkdir -p deploy/certbot/www
mkdir -p deploy/certbot/conf

# Set permissions for mosquitto
chmod -R 777 deploy/mosquitto/data
chmod -R 777 deploy/mosquitto/log

echo -e "${YELLOW}[2/5] Building Docker images...${NC}"
cd deploy
docker-compose -f docker-compose.prod.yml build --no-cache

echo -e "${YELLOW}[3/5] Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

echo -e "${YELLOW}[4/5] Waiting for services to start...${NC}"
sleep 30

echo -e "${YELLOW}[5/5] Checking service status...${NC}"
docker-compose -f docker-compose.prod.yml ps

echo -e "${GREEN}"
echo "============================================"
echo "   Deployment completed!"
echo "============================================"
echo -e "${NC}"

# Get server IP
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || echo "76.76.164.252")

echo -e "${BLUE}Access your application:${NC}"
echo "  Frontend: http://$SERVER_IP"
echo "  API:      http://$SERVER_IP/api"
echo "  AI:       http://$SERVER_IP/ai"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "  View logs:     docker-compose -f docker-compose.prod.yml logs -f"
echo "  Stop:          docker-compose -f docker-compose.prod.yml down"
echo "  Restart:       docker-compose -f docker-compose.prod.yml restart"
echo "  Status:        docker-compose -f docker-compose.prod.yml ps"
echo ""
