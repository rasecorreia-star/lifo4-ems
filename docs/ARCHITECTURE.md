# Arquitetura do Sistema Lifo4 EMS

## Visao Geral da Arquitetura

O Lifo4 EMS utiliza uma arquitetura de microservicos com os seguintes componentes principais:

```
                                    +-----------------+
                                    |    CloudFlare   |
                                    |      CDN        |
                                    +--------+--------+
                                             |
                    +------------------------+------------------------+
                    |                        |                        |
          +---------+---------+    +---------+---------+    +---------+---------+
          |    Frontend       |    |      Mobile       |    |   AI Service      |
          |  (React + Vite)   |    | (React Native)    |    |  (FastAPI)        |
          |  Vercel/Netlify   |    |   App Store       |    |  GPU Server       |
          +---------+---------+    +---------+---------+    +---------+---------+
                    |                        |                        |
                    +------------------------+------------------------+
                                             |
                              +--------------+---------------+
                              |        API Gateway           |
                              |    (Backend Node.js)         |
                              |    Cloud Run / ECS           |
                              +--------------+---------------+
                                             |
            +--------------------------------+--------------------------------+
            |                |               |               |                |
    +-------+-------+ +------+------+ +------+------+ +------+------+ +------+------+
    |   Firebase    | |    MQTT     | | WebSocket  | |   Redis     | |  Storage    |
    |   Firestore   | |  Mosquitto  | |  Socket.io | |   Cache     | |   GCS/S3    |
    +---------------+ +------+------+ +------------+ +-------------+ +-------------+
                             |
               +-------------+-------------+
               |                           |
    +----------+----------+     +----------+----------+
    |    Edge Gateway     |     |    Edge Gateway     |
    |   (Raspberry Pi)    |     |   (Raspberry Pi)    |
    +----------+----------+     +----------+----------+
               |                           |
    +----------+----------+     +----------+----------+
    |    ESP32 BMS        |     |    ESP32 BMS        |
    |    Gateway          |     |    Gateway          |
    +---------------------+     +---------------------+
```

## Componentes

### 1. Frontend (React)

**Responsabilidades:**
- Interface web responsiva
- Dashboards em tempo real
- Configuracao de sistemas
- Relatorios e analytics

**Tecnologias:**
- React 18 com TypeScript
- Vite para build
- TailwindCSS para styling
- Recharts para graficos
- Zustand para state management
- React Query para data fetching

### 2. Mobile (React Native)

**Responsabilidades:**
- Acesso movel nativo (iOS/Android)
- Notificacoes push
- QR code scanning
- Mapas de sistemas proximos

**Tecnologias:**
- React Native + Expo
- React Navigation
- Expo SecureStore
- Expo Notifications

### 3. Backend (Node.js)

**Responsabilidades:**
- API REST principal
- Autenticacao e autorizacao
- Business logic
- Integracao com servicos externos

**Tecnologias:**
- Node.js 20+
- Express.js
- TypeScript
- Firebase Admin SDK
- Socket.io

### 4. AI Service (Python)

**Responsabilidades:**
- Deteccao de pessoas (YOLOv8)
- Transcricao de audio (Whisper)
- Anomaly detection
- Load forecasting

**Tecnologias:**
- FastAPI
- PyTorch
- Ultralytics YOLOv8
- OpenAI Whisper
- Scikit-learn

### 5. Edge Computing

#### ESP32
- Comunicacao direta com BMS via Modbus/RS485
- Publicacao MQTT de telemetria
- Controle de reles

#### Raspberry Pi
- Gateway local agregador
- Buffer de dados offline
- API local para dashboard
- Protocolo handlers (Modbus, CAN)

## Fluxo de Dados

### Telemetria

```
BMS -> ESP32 (Modbus) -> MQTT Broker -> Backend -> WebSocket -> Frontend
                                    -> Firestore (persistencia)
                                    -> AI Service (analytics)
```

### Comandos

```
Frontend -> Backend API -> MQTT Broker -> ESP32 -> BMS
                       -> WebSocket (feedback)
```

### Cameras

```
Camera -> RTSP Stream -> AI Service (YOLOv8) -> Backend (eventos)
                                             -> WebSocket (alertas)
```

## Seguranca

### Autenticacao
- Firebase Authentication
- JWT tokens com refresh
- 2FA opcional

### Autorizacao
- RBAC (Role-Based Access Control)
- 7 niveis de permissao
- Multi-tenant isolation

### Comunicacao
- HTTPS/TLS em todas as comunicacoes
- MQTT com TLS
- Encriptacao de dados sensiveis

## Escalabilidade

### Horizontal Scaling
- Backend stateless (Cloud Run/ECS auto-scaling)
- MQTT cluster com load balancing
- Redis para cache distribuido

### Database Sharding
- Firestore com collections por organizacao
- Indices otimizados para queries frequentes

### Edge Computing
- Processamento local reduz carga no cloud
- Buffer offline para resiliencia

## Alta Disponibilidade

### Redundancia
- Multi-region deployment
- Database replication
- MQTT broker clustering

### Failover
- Health checks automaticos
- Circuit breakers
- Graceful degradation

### Monitoring
- Prometheus + Grafana
- Alertmanager
- Structured logging

## Integracao

### APIs Externas
- OCPP Central System (EV Chargers)
- Weather APIs (solar forecasting)
- CCEE (mercado de energia)

### Webhooks
- Alertas para sistemas externos
- Integracao com ERPs
- Notificacoes customizadas

## Deployment

### Desenvolvimento
```bash
# Backend
npm run dev

# Frontend
npm run dev

# AI Service
uvicorn app.main:app --reload
```

### Producao
```bash
# Docker Compose
docker-compose up -d

# Kubernetes
kubectl apply -f k8s/
```

### CI/CD
- GitHub Actions
- Automated testing
- Staged rollouts
