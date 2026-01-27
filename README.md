# Lifo4 EMS - Energy Management System

Sistema profissional de gerenciamento de energia para BESS (Battery Energy Storage Systems), Carregadores de VE, Microgrids e mais - desenvolvido pela Lifo4 Energia.

## Visao Geral

O Lifo4 EMS e uma plataforma enterprise completa para monitoramento, controle e otimizacao de sistemas de energia com baterias LiFePO4. O sistema permite gerenciamento remoto via nuvem com comunicacao em tempo real, integracao com carregadores de veiculos eletricos (OCPP), cameras IP com IA, e gerenciamento de microgrids.

## Funcionalidades

### Gerenciamento de BESS
- Monitoramento em tempo real (SOC, SOH, tensao, corrente, temperatura)
- Visualizacao celula-a-celula (16+ celulas LiFePO4)
- Graficos historicos interativos
- Controle inteligente com multiplos modos de operacao
- Sistema de protecoes configuravel
- Balanceamento ativo/passivo

### Carregadores de VE (OCPP)
- Suporte a OCPP 1.6 e 2.0
- Gerenciamento de sessoes de carga
- Autenticacao por RFID/App
- Smart charging com load balancing
- Integracao com BESS para peak shaving

### Cameras IP com IA
- Stream RTSP/HLS
- Deteccao de pessoas (YOLOv8)
- Controle PTZ
- Gravacao de eventos
- Transcricao de audio (Whisper)

### Microgrids
- Modos: grid-connected, islanded, black start
- Balanceamento automatico de carga
- Integracao solar + BESS + grid
- Frequencia e regulacao de tensao

### Sistema Pre-Vendas
- Analise de perfil de carga
- Recomendacoes de BESS (3 tiers)
- Calculo de ROI e payback
- Geracao de propostas

### Multi-tenant
- 7 niveis de permissao (Super Admin -> User)
- Isolamento por organizacao
- Auditoria completa

## Arquitetura

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
          +---------+---------+    +---------+---------+    +---------+---------+
                    |                        |                        |
                    +------------------------+------------------------+
                                             |
                              +--------------+---------------+
                              |        API Gateway           |
                              |    (Backend Node.js)         |
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

## Stack Tecnologica

### Frontend Web
- React 18 + TypeScript
- Vite (build tool)
- TailwindCSS + Shadcn/ui
- Recharts + Apache ECharts
- Zustand (state management)
- React Query (data fetching)

### Mobile App
- React Native + Expo
- React Navigation
- Expo SecureStore
- Push Notifications

### Backend
- Node.js 20+ Express + TypeScript
- Firebase Firestore (database)
- Firebase Authentication
- MQTT.js (comunicacao IoT)
- Socket.io (real-time)
- OCPP-JS (carregadores VE)

### AI Service
- Python 3.11+ FastAPI
- YOLOv8 (deteccao de objetos)
- OpenAI Whisper (transcricao)
- Scikit-learn (anomaly detection)
- PyTorch (deep learning)

### Edge Computing
- ESP32 (PlatformIO/Arduino)
- Raspberry Pi (Python)
- RS485/Modbus RTU
- CAN Bus
- WiFi + MQTT

## Estrutura do Projeto

```
lifo4-ems/
├── backend/              # API Node.js + Express
│   ├── src/
│   │   ├── config/       # Configuracoes
│   │   ├── controllers/  # Controllers REST
│   │   ├── middlewares/  # Auth, RBAC, etc
│   │   ├── models/       # Types/Interfaces
│   │   ├── routes/       # Rotas API
│   │   ├── services/     # Business logic
│   │   ├── mqtt/         # MQTT handlers
│   │   ├── websocket/    # Socket.io handlers
│   │   └── protocols/    # OCPP, Modbus, etc
│   └── package.json
│
├── frontend/             # React + Vite
│   ├── src/
│   │   ├── components/   # Componentes React
│   │   ├── pages/        # Paginas
│   │   ├── hooks/        # Custom hooks
│   │   ├── services/     # API services
│   │   ├── store/        # Zustand stores
│   │   └── utils/        # Utilitarios
│   └── package.json
│
├── mobile/               # React Native + Expo
│   ├── src/
│   │   ├── components/   # Componentes
│   │   ├── screens/      # Telas
│   │   ├── navigation/   # React Navigation
│   │   ├── services/     # API services
│   │   └── store/        # Estado global
│   └── package.json
│
├── ai-service/           # Python FastAPI
│   ├── app/
│   │   ├── services/     # YOLOv8, Whisper, etc
│   │   ├── routers/      # API endpoints
│   │   └── config.py     # Configuracoes
│   ├── requirements.txt
│   └── Dockerfile
│
├── edge/                 # Edge Computing
│   ├── esp32/            # Firmware ESP32
│   │   ├── src/          # Codigo fonte
│   │   ├── include/      # Headers
│   │   └── platformio.ini
│   │
│   └── raspberry-pi/     # Gateway Raspberry Pi
│       ├── services/     # MQTT, Sync, etc
│       ├── protocols/    # Modbus handler
│       └── main.py
│
└── docs/                 # Documentacao
    ├── API.md            # Documentacao API
    └── ARCHITECTURE.md   # Arquitetura
```

## Instalacao

### Pre-requisitos

- Node.js 20+
- Python 3.11+
- npm ou yarn
- Firebase CLI
- PlatformIO (para ESP32)
- Docker (opcional)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Configure as variaveis de ambiente
npm run dev
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

### Mobile

```bash
cd mobile
npm install
cp .env.example .env
npx expo start
```

### AI Service

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Linux/Mac
# ou venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Edge - ESP32

```bash
cd edge/esp32
# Abra no VSCode com extensao PlatformIO
# Configure include/config.h
# Build e Upload para ESP32
pio run -t upload
```

### Edge - Raspberry Pi

```bash
cd edge/raspberry-pi
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py
```

## Configuracao Firebase

1. Crie um projeto no Firebase Console
2. Ative Firestore Database
3. Ative Authentication (Email/Password, Google)
4. Gere as credenciais do Admin SDK
5. Configure as variaveis de ambiente no backend

## Deploy

### Docker Compose (Desenvolvimento)

```bash
docker-compose up -d
```

### Kubernetes (Producao)

```bash
kubectl apply -f k8s/
```

### Servicos Individuais

**Frontend (Vercel/Netlify):**
```bash
cd frontend
npm run build
vercel deploy
```

**Backend (Cloud Run/ECS):**
```bash
cd backend
npm run build
gcloud run deploy
```

**AI Service (GPU Server):**
```bash
cd ai-service
docker build -t lifo4-ai .
docker run --gpus all -p 8000:8000 lifo4-ai
```

## API

A documentacao completa da API esta disponivel em `docs/API.md`.

### Endpoints Principais

| Recurso | Endpoint | Descricao |
|---------|----------|-----------|
| Auth | `/api/v1/auth/*` | Autenticacao e tokens |
| Systems | `/api/v1/systems/*` | Gerenciamento BESS |
| Telemetry | `/api/v1/telemetry/*` | Dados em tempo real |
| Control | `/api/v1/control/*` | Comandos de controle |
| EV Chargers | `/api/v1/ev-chargers/*` | Carregadores OCPP |
| Cameras | `/api/v1/cameras/*` | Cameras IP |
| Microgrids | `/api/v1/microgrids/*` | Microgrids |
| Prospects | `/api/v1/prospects/*` | Pre-vendas |
| Alerts | `/api/v1/alerts/*` | Sistema de alertas |

## WebSocket Events

| Evento | Direcao | Descricao |
|--------|---------|-----------|
| `telemetry:update` | Server->Client | Dados de telemetria |
| `alert:new` | Server->Client | Novo alerta |
| `command:execute` | Client->Server | Executar comando |
| `command:result` | Server->Client | Resultado do comando |

## MQTT Topics

| Topic | Direcao | Descricao |
|-------|---------|-----------|
| `lifo4/{orgId}/{siteId}/telemetry` | Device->Cloud | Telemetria |
| `lifo4/{orgId}/{siteId}/status` | Device->Cloud | Status |
| `lifo4/{orgId}/{siteId}/command` | Cloud->Device | Comandos |
| `lifo4/{orgId}/{siteId}/response` | Device->Cloud | Respostas |

## Variaveis de Ambiente

Veja os arquivos `.env.example` em cada diretorio para as variaveis necessarias.

### Backend (.env)
```
PORT=3000
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
MQTT_BROKER_URL=
REDIS_URL=
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
VITE_FIREBASE_API_KEY=
```

### Mobile (.env)
```
API_URL=https://api.lifo4.com.br
WS_URL=wss://api.lifo4.com.br
```

## Testes

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm test

# AI Service
cd ai-service && pytest

# E2E
npm run test:e2e
```

## Monitoramento

- **Prometheus + Grafana** para metricas
- **Alertmanager** para notificacoes
- **ELK Stack** para logs

## Seguranca

- HTTPS/TLS em todas as comunicacoes
- JWT com refresh tokens
- RBAC com 7 niveis de permissao
- 2FA opcional
- Auditoria completa
- Encriptacao de dados sensiveis

## Licenca

Proprietario - Lifo4 Energia LTDA

## Contato

- **Empresa:** Lifo4 Energia
- **Localizacao:** Teresina, PI - Brasil
- **Website:** https://lifo4.com.br
- **Email:** contato@lifo4.com.br
- **Especializacao:** Energia Solar, Baterias e Sistemas de Armazenamento
