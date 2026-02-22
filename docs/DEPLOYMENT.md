# Deployment Guide — LIFO4 EMS

## Índice

1. [Ambiente de Desenvolvimento](#desenvolvimento)
2. [Deploy em Produção (VPS / Cloud)](#producao)
3. [Provisionar Novo Site](#novo-site)
4. [Atualização OTA](#ota)
5. [Rollback](#rollback)
6. [Variáveis de Ambiente](#env-vars)

---

## 1. Ambiente de Desenvolvimento <a name="desenvolvimento"></a>

### Pré-requisitos

- Docker Desktop ≥ 4.x
- Node.js ≥ 20 (para testes)
- Python ≥ 3.11 (edge controller)

### Subir ambiente local

```bash
# Subir todos os serviços
docker compose -f docker-compose.dev.yml up -d

# Verificar saúde
docker compose ps

# Logs em tempo real
docker compose logs -f backend
```

Serviços disponíveis:

| Serviço    | URL                        | Porta  |
|-----------|----------------------------|--------|
| Frontend  | http://localhost:5173       | 5173   |
| Backend   | http://localhost:3001       | 3001   |
| InfluxDB  | http://localhost:8086       | 8086   |
| PostgreSQL| postgresql://localhost:5432 | 5432   |
| MQTT      | mqtt://localhost:1883       | 1883   |
| Grafana   | http://localhost:3000       | 3000   |

### Rodar testes locais

```bash
# Instalar dependências de teste
npm install

# Testes de integração (requer Docker)
npm run test:integration

# Testes de stress (lento — apenas quando necessário)
npm run test:stress

# Todos os testes
npm test
```

---

## 2. Deploy em Produção <a name="producao"></a>

### Pré-requisitos de servidor

- Ubuntu 22.04 LTS
- Docker Engine ≥ 24
- 4+ vCPUs, 8+ GB RAM, 100 GB SSD
- Portas abertas: 80, 443, 8883 (MQTT TLS)

### Passo a passo

```bash
# 1. Clonar repositório
git clone https://github.com/lifo4/ems.git /opt/EMS
cd /opt/EMS

# 2. Configurar variáveis de ambiente
cp .env.example .env
nano .env   # Preencher TODOS os valores

# 3. Gerar certificados TLS (Let's Encrypt)
docker compose run --rm certbot certonly \
  --standalone -d ems.seudominio.com.br

# 4. Build e deploy
docker compose -f docker-compose.prod.yml up -d --build

# 5. Verificar saúde
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=50 backend

# 6. Rodar migrations de banco
docker compose -f docker-compose.prod.yml exec backend \
  npx prisma migrate deploy
```

### Verificação pós-deploy

- [ ] https://ems.seudominio.com.br abre sem erros
- [ ] `/health` retorna `{"status":"ok"}`
- [ ] Login funciona
- [ ] Métricas em http://grafana.seudominio.com.br

---

## 3. Provisionar Novo Site <a name="novo-site"></a>

O processo é **Zero-Touch** — técnico só instala o hardware.

### O que o técnico faz

1. Conectar edge controller à rede local (Ethernet)
2. Ligar o equipamento
3. Aguardar LED verde (~5 minutos)

### O que acontece automaticamente

```
Edge liga
  ↓
bootstrap.py executa
  ↓
Gera edge_id único (MAC + serial)
  ↓
Conecta ao MQTT cloud com certificado de bootstrap
  ↓
Publica em lifo4/provisioning/register
  ↓
Cloud cria sistema no PostgreSQL + responde com config
  ↓
Edge instala certificado definitivo
  ↓
Edge faz discovery Modbus dos dispositivos BMS/PCS
  ↓
Reporta: "Provisioned and operational"
  ↓
Cloud inicia período de baseline (7 dias)
  ↓
Após baseline: otimização automática ativa
```

### Como verificar no dashboard

1. Acessar **Sistemas > Mapa**
2. Novo site aparece com status **PROVISIONING** e após baseline **OPERATIONAL**

---

## 4. Atualização OTA <a name="ota"></a>

### Deploy gradual (canary)

```
Nova versão
  ↓
5% dos edges (sites piloto) — monitor 24h
  ↓ (se OK)
25% — monitor 24h
  ↓ (se OK)
50% — monitor 24h
  ↓ (se OK)
100%
```

### Forçar OTA update manual (emergência)

```bash
# Via API
curl -X POST https://api.ems.lifo4.com.br/api/v1/ota/deploy \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "version": "1.2.0",
    "targetEdgeIds": ["edge-abc123"],
    "skipCanary": true
  }'
```

### Quando NÃO atualiza automaticamente

- Operação de carga/descarga ativa
- Alarme crítico ativo
- Island mode (blackout)
- SOC < 20%
- Fora da janela de manutenção (padrão: 02:00–05:00)

---

## 5. Rollback <a name="rollback"></a>

### Rollback automático

Ocorre automaticamente se o healthcheck falhar após OTA:
- Control loop não inicializado em 5 min
- Modbus não responde
- MQTT desconectado
- Safety manager inoperacional

### Rollback manual

```bash
# Via API
curl -X POST https://api.ems.lifo4.com.br/api/v1/ota/rollback \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"edgeId": "edge-abc123"}'

# Via MQTT (acesso direto ao edge)
mosquitto_pub -h mqtt.lifo4.com.br -t "lifo4/edge-abc123/ota/rollback" \
  -m '{"targetVersion": "previous"}' --cafile ca.crt
```

### Rollback do backend/frontend

```bash
# Ver histórico de imagens
docker images lifo4/backend --format "table {{.Tag}}\t{{.CreatedAt}}"

# Fazer rollback para versão anterior
docker compose -f docker-compose.prod.yml \
  up -d --no-deps backend=lifo4/backend:1.1.0
```

---

## 6. Variáveis de Ambiente <a name="env-vars"></a>

Ver `docs/ENVIRONMENT_VARIABLES.md` para lista completa.

Mínimo para produção:

```env
NODE_ENV=production
VITE_DEMO_MODE=false
DATABASE_URL=postgresql://...
INFLUXDB_TOKEN=...
JWT_SECRET=...  # min 64 chars, random
MQTT_BROKER_HOST=...
```
