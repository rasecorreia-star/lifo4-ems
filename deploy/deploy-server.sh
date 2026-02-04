#!/bin/bash
# ==============================================
# EMS BESS - Server Deploy Script
# Este script roda no servidor VPS
# Uso: ./deploy-server.sh [build|start|stop|restart|logs|status|update]
# ==============================================

set -e

COMPOSE_FILE="docker-compose.prebuilt.yml"
PROJECT_DIR="/opt/EMS"
ENV_FILE="$PROJECT_DIR/deploy/.env"

cd "$PROJECT_DIR/deploy"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar se .env existe
check_env() {
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${YELLOW}Arquivo .env nao encontrado. Criando a partir do exemplo...${NC}"
        if [ -f "$PROJECT_DIR/deploy/.env.example" ]; then
            cp "$PROJECT_DIR/deploy/.env.example" "$ENV_FILE"
            echo -e "${RED}ATENCAO: Configure as variaveis em $ENV_FILE${NC}"
        fi
    fi
}

case "$1" in
    build)
        echo -e "${BLUE}[EMS] Building images...${NC}"
        check_env
        docker compose -f $COMPOSE_FILE build --no-cache
        echo -e "${GREEN}Build concluido!${NC}"
        ;;

    start)
        echo -e "${BLUE}[EMS] Starting services...${NC}"
        check_env
        docker compose -f $COMPOSE_FILE up -d
        echo -e "${YELLOW}Aguardando servicos ficarem prontos...${NC}"
        sleep 15
        docker compose -f $COMPOSE_FILE ps
        echo -e "${GREEN}Servicos iniciados!${NC}"
        ;;

    stop)
        echo -e "${BLUE}[EMS] Stopping services...${NC}"
        docker compose -f $COMPOSE_FILE down
        echo -e "${GREEN}Servicos parados!${NC}"
        ;;

    restart)
        echo -e "${BLUE}[EMS] Restarting services...${NC}"
        docker compose -f $COMPOSE_FILE restart
        sleep 10
        docker compose -f $COMPOSE_FILE ps
        echo -e "${GREEN}Servicos reiniciados!${NC}"
        ;;

    logs)
        SERVICE=${2:-}
        if [ -n "$SERVICE" ]; then
            docker compose -f $COMPOSE_FILE logs -f "$SERVICE"
        else
            docker compose -f $COMPOSE_FILE logs -f --tail=100
        fi
        ;;

    status)
        echo -e "${BLUE}=== Status dos Containers ===${NC}"
        docker compose -f $COMPOSE_FILE ps
        echo ""
        echo -e "${BLUE}=== Uso de Recursos ===${NC}"
        docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
        echo ""
        echo -e "${BLUE}=== Uso de Disco ===${NC}"
        df -h /
        echo ""
        echo -e "${BLUE}=== Memoria do Sistema ===${NC}"
        free -h
        ;;

    update)
        echo -e "${BLUE}========================================${NC}"
        echo -e "${BLUE}[EMS] Atualizando aplicacao...${NC}"
        echo -e "${BLUE}========================================${NC}"

        check_env

        echo -e "${YELLOW}[1/3] Parando servicos antigos...${NC}"
        docker compose -f $COMPOSE_FILE down || true

        echo -e "${YELLOW}[2/3] Rebuild das imagens...${NC}"
        docker compose -f $COMPOSE_FILE build

        echo -e "${YELLOW}[3/3] Iniciando servicos...${NC}"
        docker compose -f $COMPOSE_FILE up -d

        echo -e "${YELLOW}Aguardando servicos ficarem prontos...${NC}"
        sleep 15

        docker compose -f $COMPOSE_FILE ps

        echo -e "${GREEN}========================================${NC}"
        echo -e "${GREEN}   Atualizacao concluida!${NC}"
        echo -e "${GREEN}========================================${NC}"
        ;;

    clean)
        echo -e "${BLUE}[EMS] Limpando recursos Docker nao utilizados...${NC}"
        docker system prune -af --volumes
        echo -e "${GREEN}Limpeza concluida!${NC}"
        ;;

    backup)
        BACKUP_DIR="/opt/backups/ems"
        BACKUP_FILE="$BACKUP_DIR/backup_$(date +%Y%m%d_%H%M%S).tar.gz"
        mkdir -p "$BACKUP_DIR"

        echo -e "${BLUE}[EMS] Criando backup...${NC}"

        # Backup volumes Docker
        docker compose -f $COMPOSE_FILE exec -T redis redis-cli BGSAVE || true
        sleep 2

        tar -czvf "$BACKUP_FILE" \
            /var/lib/docker/volumes/deploy_redis-data \
            /var/lib/docker/volumes/deploy_mosquitto-data \
            "$PROJECT_DIR/deploy/.env" 2>/dev/null || true

        echo -e "${GREEN}Backup criado: $BACKUP_FILE${NC}"

        # Manter apenas os ultimos 5 backups
        ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
        ;;

    health)
        echo -e "${BLUE}=== Health Check ===${NC}"

        # Backend
        echo -n "Backend API: "
        if curl -sf http://localhost:3000/health > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi

        # Frontend
        echo -n "Frontend:    "
        if curl -sf http://localhost:80 > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi

        # AI Service
        echo -n "AI Service:  "
        if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi

        # Redis
        echo -n "Redis:       "
        if docker compose -f $COMPOSE_FILE exec -T redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi

        # MQTT
        echo -n "MQTT:        "
        if nc -z localhost 1883 2>/dev/null; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAIL${NC}"
        fi
        ;;

    *)
        echo -e "${BLUE}EMS BESS - Server Deploy Script${NC}"
        echo ""
        echo "Uso: $0 {build|start|stop|restart|logs|status|update|clean|backup|health}"
        echo ""
        echo "Comandos:"
        echo "  build    - Build das imagens Docker"
        echo "  start    - Inicia todos os servicos"
        echo "  stop     - Para todos os servicos"
        echo "  restart  - Reinicia todos os servicos"
        echo "  logs     - Visualiza logs (opcional: nome do servico)"
        echo "  status   - Mostra status e uso de recursos"
        echo "  update   - Atualiza e reinicia a aplicacao"
        echo "  clean    - Limpa recursos Docker nao utilizados"
        echo "  backup   - Cria backup dos dados"
        echo "  health   - Verifica saude dos servicos"
        exit 1
        ;;
esac
