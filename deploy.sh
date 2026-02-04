#!/bin/bash
# ==============================================
# EMS BESS - Deploy Script
# Uso: ./deploy.sh [deploy|setup|ssh|logs|status]
# ==============================================

set -e

# Configuracoes
VPS_IP="76.13.164.252"
VPS_USER="root"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/opt/EMS"
PROJECT_NAME="ems-bess"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Funcao para SSH
ssh_cmd() {
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "$VPS_USER@$VPS_IP" "$@"
}

# Funcao para SCP
scp_cmd() {
    scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -r "$@"
}

case "$1" in
    deploy)
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}   EMS BESS - Deploy to VPS${NC}"
        echo -e "${BLUE}========================================${NC}"

        # Criar arquivo tar excluindo node_modules e outros
        echo -e "${YELLOW}[1/5] Criando pacote de deploy...${NC}"
        tar --exclude='node_modules' \
            --exclude='.git' \
            --exclude='*.log' \
            --exclude='dist' \
            --exclude='build' \
            --exclude='.env' \
            --exclude='playwright-report' \
            --exclude='test-results' \
            --exclude='screenshots' \
            --exclude='__pycache__' \
            --exclude='.pytest_cache' \
            --exclude='*.pyc' \
            -czvf /tmp/ems-deploy.tar.gz \
            -C "$(dirname "$0")" .

        echo -e "${YELLOW}[2/5] Verificando conexao SSH...${NC}"
        ssh_cmd "echo 'Conexao OK'"

        echo -e "${YELLOW}[3/5] Enviando arquivos para o servidor...${NC}"
        scp_cmd /tmp/ems-deploy.tar.gz "$VPS_USER@$VPS_IP:/tmp/"

        echo -e "${YELLOW}[4/5] Extraindo no servidor...${NC}"
        ssh_cmd "mkdir -p $REMOTE_DIR && \
                 cd $REMOTE_DIR && \
                 tar -xzvf /tmp/ems-deploy.tar.gz && \
                 rm /tmp/ems-deploy.tar.gz"

        echo -e "${YELLOW}[5/5] Iniciando servicos...${NC}"
        ssh_cmd "cd $REMOTE_DIR && chmod +x deploy/deploy-server.sh && ./deploy/deploy-server.sh update"

        # Limpar arquivo local
        rm /tmp/ems-deploy.tar.gz

        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   Deploy concluido com sucesso!${NC}"
        echo -e "${GREEN}   Acesse: http://$VPS_IP${NC}"
        echo -e "${GREEN}========================================${NC}"
        ;;

    setup)
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}   EMS BESS - Setup Inicial do VPS${NC}"
        echo -e "${BLUE}========================================${NC}"

        echo -e "${YELLOW}[1/4] Verificando conexao SSH...${NC}"
        ssh_cmd "echo 'Conexao OK'"

        echo -e "${YELLOW}[2/4] Instalando dependencias (Docker, etc)...${NC}"
        ssh_cmd 'apt-get update && apt-get install -y docker.io docker-compose git curl htop ufw'

        echo -e "${YELLOW}[3/4] Configurando firewall...${NC}"
        ssh_cmd 'ufw allow ssh && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 1883/tcp && ufw --force enable || true'

        echo -e "${YELLOW}[4/4] Criando diretorio do projeto...${NC}"
        ssh_cmd "mkdir -p $REMOTE_DIR"

        echo -e "${GREEN}Setup concluido! Execute: ./deploy.sh deploy${NC}"
        ;;

    ssh)
        echo -e "${BLUE}Conectando ao VPS...${NC}"
        ssh -i "$SSH_KEY" "$VPS_USER@$VPS_IP"
        ;;

    logs)
        SERVICE=${2:-}
        echo -e "${BLUE}Visualizando logs...${NC}"
        ssh_cmd "cd $REMOTE_DIR && ./deploy/deploy-server.sh logs $SERVICE"
        ;;

    status)
        echo -e "${BLUE}Status dos servicos:${NC}"
        ssh_cmd "cd $REMOTE_DIR && ./deploy/deploy-server.sh status"
        ;;

    start)
        echo -e "${BLUE}Iniciando servicos...${NC}"
        ssh_cmd "cd $REMOTE_DIR && ./deploy/deploy-server.sh start"
        ;;

    stop)
        echo -e "${BLUE}Parando servicos...${NC}"
        ssh_cmd "cd $REMOTE_DIR && ./deploy/deploy-server.sh stop"
        ;;

    restart)
        echo -e "${BLUE}Reiniciando servicos...${NC}"
        ssh_cmd "cd $REMOTE_DIR && ./deploy/deploy-server.sh restart"
        ;;

    build)
        echo -e "${BLUE}Rebuild dos containers...${NC}"
        ssh_cmd "cd $REMOTE_DIR && ./deploy/deploy-server.sh build"
        ;;

    *)
        echo -e "${BLUE}EMS BESS - Deploy Script${NC}"
        echo ""
        echo "Uso: $0 {deploy|setup|ssh|logs|status|start|stop|restart|build}"
        echo ""
        echo "Comandos:"
        echo "  setup    - Configuracao inicial do VPS (Docker, firewall, etc)"
        echo "  deploy   - Envia codigo e reinicia servicos"
        echo "  ssh      - Conecta ao VPS via SSH"
        echo "  status   - Mostra status dos containers"
        echo "  logs     - Visualiza logs (opcional: nome do servico)"
        echo "  start    - Inicia todos os servicos"
        echo "  stop     - Para todos os servicos"
        echo "  restart  - Reinicia todos os servicos"
        echo "  build    - Rebuild dos containers Docker"
        echo ""
        echo "Configuracoes:"
        echo "  VPS IP:     $VPS_IP"
        echo "  SSH Key:    $SSH_KEY"
        echo "  Remote Dir: $REMOTE_DIR"
        exit 1
        ;;
esac
