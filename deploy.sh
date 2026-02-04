#!/bin/bash
# ==============================================
# EMS BESS - Deploy Script
# Uso: ./deploy.sh [local|deploy|setup|ssh|logs|status]
# ==============================================

set -e

# Configuracoes
VPS_IP="76.13.164.252"
VPS_USER="root"
SSH_KEY="$HOME/.ssh/id_ed25519"
REMOTE_DIR="/opt/EMS"
PROJECT_NAME="ems-bess"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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
    local)
        echo -e "${CYAN}========================================${NC}"
        echo -e "${CYAN}   EMS BESS - Teste Local com Docker${NC}"
        echo -e "${CYAN}========================================${NC}"
        echo -e "${YELLOW}Isso simula EXATAMENTE o ambiente do VPS${NC}"
        echo ""

        cd "$SCRIPT_DIR"

        # Build do frontend
        echo -e "${YELLOW}[1/3] Fazendo build do frontend...${NC}"
        cd frontend
        npm run build
        cd ..

        # Parar containers antigos se existirem
        echo -e "${YELLOW}[2/3] Parando containers antigos...${NC}"
        cd deploy
        docker compose -f docker-compose.prebuilt.yml down 2>/dev/null || true

        # Subir containers
        echo -e "${YELLOW}[3/3] Subindo containers Docker...${NC}"
        docker compose -f docker-compose.prebuilt.yml up --build -d

        echo ""
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   Teste local rodando!${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   Acesse: http://localhost:8081${NC}"
        echo -e "${GREEN}========================================${NC}"
        echo ""
        echo -e "${CYAN}Comandos úteis:${NC}"
        echo -e "  Ver logs:    docker compose -f deploy/docker-compose.prebuilt.yml logs -f"
        echo -e "  Parar:       docker compose -f deploy/docker-compose.prebuilt.yml down"
        echo ""
        echo -e "${YELLOW}Se funcionar aqui, vai funcionar no VPS!${NC}"
        echo -e "${YELLOW}Quando estiver OK, execute: ./deploy.sh deploy${NC}"
        ;;

    local-stop)
        echo -e "${BLUE}Parando containers locais...${NC}"
        cd "$SCRIPT_DIR/deploy"
        docker compose -f docker-compose.prebuilt.yml down
        echo -e "${GREEN}Containers parados!${NC}"
        ;;

    local-logs)
        cd "$SCRIPT_DIR/deploy"
        docker compose -f docker-compose.prebuilt.yml logs -f
        ;;

    deploy)
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}   EMS BESS - Deploy to VPS${NC}"
        echo -e "${BLUE}========================================${NC}"

        cd "$SCRIPT_DIR"

        # Build do frontend primeiro
        echo -e "${YELLOW}[1/7] Fazendo build do frontend...${NC}"
        cd frontend
        npm run build
        cd ..

        # Criar arquivo tar com dist já compilado
        echo -e "${YELLOW}[2/7] Criando pacote de deploy...${NC}"
        tar --exclude='node_modules' \
            --exclude='.git' \
            --exclude='*.log' \
            --exclude='.env' \
            --exclude='playwright-report' \
            --exclude='test-results' \
            --exclude='screenshots' \
            --exclude='__pycache__' \
            --exclude='.pytest_cache' \
            --exclude='*.pyc' \
            --exclude='frontend/src' \
            --exclude='frontend/public' \
            --exclude='frontend/tests' \
            --exclude='auto-test' \
            --exclude='*.md' \
            -czvf /tmp/ems-deploy.tar.gz \
            frontend/dist \
            frontend/Dockerfile.prebuilt \
            frontend/nginx.conf \
            backend/demo-server-full.js \
            backend/Dockerfile.demo \
            backend/package*.json \
            deploy/

        echo -e "${YELLOW}[3/7] Verificando conexao SSH...${NC}"
        ssh_cmd "echo 'Conexao OK'"

        echo -e "${YELLOW}[4/7] Limpando arquivos antigos no VPS...${NC}"
        ssh_cmd "cd $REMOTE_DIR 2>/dev/null && \
                 docker compose -f deploy/docker-compose.prebuilt.yml down 2>/dev/null || true && \
                 rm -rf frontend/dist backend/demo-server-full.js 2>/dev/null || true"

        echo -e "${YELLOW}[5/7] Enviando arquivos para o servidor...${NC}"
        scp_cmd /tmp/ems-deploy.tar.gz "$VPS_USER@$VPS_IP:/tmp/"

        echo -e "${YELLOW}[6/7] Extraindo no servidor...${NC}"
        ssh_cmd "mkdir -p $REMOTE_DIR && \
                 cd $REMOTE_DIR && \
                 tar -xzvf /tmp/ems-deploy.tar.gz && \
                 rm /tmp/ems-deploy.tar.gz"

        echo -e "${YELLOW}[7/7] Reconstruindo e iniciando containers...${NC}"
        ssh_cmd "cd $REMOTE_DIR/deploy && \
                 docker compose -f docker-compose.prebuilt.yml up --build -d --force-recreate"

        # Limpar arquivo local
        rm /tmp/ems-deploy.tar.gz

        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   Deploy concluido com sucesso!${NC}"
        echo -e "${GREEN}   Acesse: http://$VPS_IP:8081${NC}"
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
        echo "Uso: $0 {local|deploy|setup|ssh|logs|status|start|stop|restart|build}"
        echo ""
        echo -e "${CYAN}=== TESTE LOCAL (Docker) ===${NC}"
        echo "  local       - Testa com Docker local (simula VPS)"
        echo "  local-stop  - Para containers locais"
        echo "  local-logs  - Ver logs dos containers locais"
        echo ""
        echo -e "${CYAN}=== DEPLOY VPS ===${NC}"
        echo "  deploy   - Build + envia + reinicia no VPS"
        echo "  setup    - Configuracao inicial do VPS"
        echo ""
        echo -e "${CYAN}=== GERENCIAMENTO VPS ===${NC}"
        echo "  ssh      - Conecta ao VPS via SSH"
        echo "  status   - Mostra status dos containers"
        echo "  logs     - Visualiza logs (opcional: nome do servico)"
        echo "  start    - Inicia todos os servicos"
        echo "  stop     - Para todos os servicos"
        echo "  restart  - Reinicia todos os servicos"
        echo "  build    - Rebuild dos containers Docker"
        echo ""
        echo -e "${YELLOW}Fluxo recomendado:${NC}"
        echo "  1. Desenvolve com: npm run dev"
        echo "  2. Testa Docker:   ./deploy.sh local"
        echo "  3. Se OK, deploy:  ./deploy.sh deploy"
        echo ""
        echo "Configuracoes:"
        echo "  VPS IP:      $VPS_IP"
        echo "  SSH Key:     $SSH_KEY"
        echo "  Remote Dir:  $REMOTE_DIR"
        echo "  Local Test:  http://localhost:8081"
        echo "  Production:  http://$VPS_IP:8081"
        exit 1
        ;;
esac
