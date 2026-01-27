#!/bin/bash

# ============================================
# Lifo4 EMS - Quick Install Script
# Execute com: curl -sSL URL | bash
# ============================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}"
    echo "============================================"
    echo "   Lifo4 EMS - Quick Install"
    echo "   VPS: Ubuntu 22.04 / 3GB RAM"
    echo "============================================"
    echo -e "${NC}"
}

print_header

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Execute como root!${NC}"
    exit 1
fi

echo -e "${YELLOW}[1/7] Atualizando sistema...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

echo -e "${YELLOW}[2/7] Instalando dependencias...${NC}"
apt-get install -y -qq curl git htop unzip ufw

echo -e "${YELLOW}[3/7] Instalando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

echo -e "${YELLOW}[4/7] Instalando Docker Compose...${NC}"
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo -e "${YELLOW}[5/7] Configurando firewall...${NC}"
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 1883/tcp
ufw allow 9001/tcp
ufw --force enable

echo -e "${YELLOW}[6/7] Configurando swap...${NC}"
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    echo 'vm.swappiness=10' >> /etc/sysctl.conf
    sysctl -p
fi

echo -e "${YELLOW}[7/7] Preparando diretorio...${NC}"
mkdir -p /opt/lifo4-ems
chown -R 1000:1000 /opt/lifo4-ems

# Show versions
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}   Instalacao Base Concluida!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "Docker:         $(docker --version | cut -d' ' -f3 | tr -d ',')"
echo -e "Docker Compose: $(docker-compose --version | cut -d' ' -f4 | tr -d ',')"
echo -e "Swap:           $(free -h | grep Swap | awk '{print $2}')"
echo ""
echo -e "${BLUE}Proximo passo:${NC}"
echo "Copie os arquivos do projeto para /opt/lifo4-ems"
echo ""
echo -e "${YELLOW}No seu computador Windows, execute:${NC}"
echo "1. Comprima o projeto (sem node_modules)"
echo "2. scp lifo4-ems.tar.gz root@$(curl -s ifconfig.me):/opt/lifo4-ems/"
echo ""
