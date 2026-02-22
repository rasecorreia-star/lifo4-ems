# LIFO4 EMS — System Architecture

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Users / Clients                      │
└──────────────────────┬──────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌─────▼──────┐  ┌───▼────────┐
   │ Frontend │  │ Mobile Web │  │ Admin       │
   │ React 18 │  │ PWA        │  │ Dashboard   │
   └────┬────┘  └─────┬──────┘  └───┬────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │ HTTPS/WSS
        ┌──────────────▼──────────────┐
        │    Backend API (Express)    │
        │  ▪ REST Endpoints           │
        │  ▪ WebSocket (Real-time)    │
        │  ▪ JWT Authentication       │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌─────▼──────┐  ┌───▼────────┐
   │ PostgreSQL│  │ MQTT Broker│  │ Time-Series│
   │ + Redis  │  │ (Mosquitto)│  │ (InfluxDB) │
   └────┬────┘  └─────┬──────┘  └───┬────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │ mTLS
        ┌──────────────▼──────────────┐
        │    Edge Controller (Python) │
        │  ▪ Modbus TCP/RTU → BMS     │
        │  ▪ Local decision engine    │
        │  ▪ Offline buffer (SQLite)  │
        │  ▪ OTA dual-partition       │
        └─────────────────────────────┘
```

## 📦 Monorepo Structure

### `/apps/frontend`
**React + TypeScript + Vite**
- 100+ components organized by feature
- 100+ pages covering all user workflows
- State management with Zustand + React Query
- Charts (ECharts, Recharts), Maps (Leaflet)
- PWA (Progressive Web App) support
- E2E tests with Playwright

**Key Directories**:
```
apps/frontend/src/
├── components/      # Reusable UI components
├── pages/           # Page-level components (1:1 with routes)
├── services/        # API calls, WebSocket, config
├── store/           # Zustand state management
├── hooks/           # Custom React hooks
├── types/           # TypeScript interfaces
├── lib/             # Utilities
└── styles/          # CSS (Tailwind)
```

### `/apps/backend`
**Node.js + Express + TypeScript**
- RESTful API — 32 endpoints across 7 route modules
- WebSocket for real-time updates (Socket.IO)
- JWT authentication (HS256, 1h access + 30d refresh)
- RBAC with 7 privilege levels (USER → SUPER_ADMIN)
- 2FA (TOTP) enforced for ADMIN and SUPER_ADMIN
- MQTT broker integration (Mosquitto)
- Time-series data (InfluxDB)
- Relational data (PostgreSQL)
- Rate limiting (global + per-endpoint)
- Prometheus metrics endpoint

**Key Modules**:
```
apps/backend/src/
├── routes/          # REST endpoints
│   ├── auth.routes.ts        # Login, 2FA setup/verify
│   ├── optimization.routes.ts
│   ├── ml.routes.ts
│   ├── telemetry.routes.ts
│   ├── financial.routes.ts
│   ├── ota.routes.ts         # OTA canary deployment
│   └── alarms.routes.ts      # Fleet alarm management
├── middleware/      # Express middleware (auth, metrics, error)
├── services/        # Business logic
├── controllers/     # Request handlers
└── lib/             # Shared utilities (logger, config)
```

### `/apps/edge`
**Edge Controller for IoT Devices (Python asyncio)**
- Runs on embedded Linux (Raspberry Pi, industrial PC)
- Modbus RTU/TCP communication with BMS and inverters
- MQTT publisher — sends telemetry to cloud, receives commands
- 5-level local decision engine (same logic as cloud)
- Offline operation: SQLite buffer + automatic sync on reconnect
- Zero-touch provisioning via bootstrap certificate
- OTA dual-partition updates with automatic rollback
- Self-healing: Modbus/MQTT reconnect, watchdog, SAFE_MODE

```
apps/edge/src/
├── provisioning/    # bootstrap.py, ota_updater.py
├── control/         # decision_engine, arbitrage, peak_shaving, black_start
├── safety/          # safety_manager, limits, watchdog
├── communication/   # modbus_client, mqtt_client, protocol_handler
├── data/            # local_db, sync_manager, telemetry_buffer
├── ml/              # ONNX inference (load forecast, SoH, anomaly)
└── utils/           # logger, metrics, self_healing
```

### `/apps/ml-service`
**ML Pipeline (Python FastAPI)**
- XGBoost + LSTM ensemble for load forecasting (MAPE ≤ 8%)
- ONNX model export for edge inference
- Optuna hyperparameter optimization (30 trials)
- Automatic weekly retraining with rollback on regression
- InfluxDB integration for training data

### `/packages/shared`
**Shared Types & Constants**
- TypeScript interfaces (request/response)
- Enums (battery status, control modes)
- Constants (limits, thresholds)
- Validation schemas (Zod)

## 🔄 Data Flow

### 1. Real-Time Telemetry
```
BMS/Inverter (Modbus TCP/RTU)
    → Edge Controller (local processing, safety check)
    → MQTT Broker (QoS 1)
    → Backend (ingestion service)
    → InfluxDB (time-series)
    → WebSocket → Frontend (live updates)
```

### 2. User Control Commands
```
Frontend (Button click)
    → Backend API (REST, JWT auth + RBAC check)
    → Rate limiter (60 cmd/min/user)
    → MQTT publish (command topic, QoS 1)
    → Edge Controller receives + validates
    → Modbus controls BMS/Inverter
    → ACK back through MQTT → WebSocket → Frontend
```

### 3. Historical Data
```
InfluxDB (time-series telemetry)
    → Backend aggregation queries
    → Frontend analytics/reports
    → ML Service training pipeline
```

### 4. OTA Update Flow
```
SUPER_ADMIN triggers POST /api/v1/ota/deploy
    → CanaryDeployment: 5% → 25% → 50% → 100% (24h each)
    → MQTT notifies each edge batch
    → Edge: download → verify SHA-256 → verify Ed25519
    → Install to inactive partition → reboot
    → Healthcheck 5min → commit or rollback
```

## 🔐 Security Architecture

### Authentication
- **JWT (HS256)** — Access Token 1h, Refresh Token 30d
- **2FA (TOTP, RFC 6238)** — mandatory for ADMIN and SUPER_ADMIN
- **mTLS** — mutual TLS for edge ↔ cloud MQTT (Ed25519 certificates)
- No external OAuth providers — self-contained authentication

### Authorization (RBAC — 7 levels)
```
SUPER_ADMIN  → Full access + 2FA disable + OTA deploy
  ADMIN      → Organization management + 2FA required
    MANAGER  → Operations + reports
      TECHNICIAN → Diagnostics + OTA reset
        OPERATOR → Commands + alarm silence
          VIEWER → Read-only
            USER → Assigned systems only
```

### Encryption
- HTTPS for all REST API calls (TLS 1.3)
- WSS (WebSocket Secure) for real-time data
- MQTT over TLS (port 8883, mTLS in production)
- Passwords: bcrypt (cost 12)
- OTA code signing: Ed25519 (key in HSM)

### Validation
- Zod schemas for all input validation (backend + frontend)
- TypeScript strict mode throughout
- Server-side authorization checks on every endpoint
- Rate limiting: 300/min global, 5/15min auth, 60/min commands, 10/min emergency-stop

## 🚀 Deployment

### Development
```bash
npm run dev                          # Frontend on :5174
npm run dev --workspace=backend      # Backend on :3001
docker compose up mqtt influxdb      # External services
```

### Test Environment
```bash
docker compose -f docker-compose.test.yml up -d
cd tests && npm install && npm run test:integration
cd tests && npm run test:stress
```

### Production
```bash
npm run build
docker compose -f docker-compose.yml up -d
```

**Infrastructure**:
- Frontend: Static hosting (Vercel, Netlify, or CDN)
- Backend: Docker container (Docker Swarm or K8s)
- Databases: PostgreSQL (primary), InfluxDB (time-series), Redis (cache/sessions)
- MQTT: Self-hosted Mosquitto with mTLS
- Observability: Prometheus + Grafana + Loki + Alertmanager

## 📊 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, TypeScript, Vite | UI Framework |
| Styling | Tailwind CSS | Utility-first CSS |
| State | Zustand, React Query | Client state + server state |
| UI Components | Radix UI, Shadcn/ui | Headless components |
| Forms | React Hook Form, Zod | Form handling + validation |
| Charts | ECharts, Recharts | Data visualization |
| Maps | Leaflet | Geographic visualization |
| Testing | Playwright, Vitest, Node test runner | E2E + Unit + Integration |
| Backend | Express, TypeScript | REST API |
| Auth | JWT (HS256) + TOTP 2FA | Authentication |
| Relational DB | PostgreSQL 16 | Users, orgs, config |
| Time-series DB | InfluxDB 2.7 | Telemetry data |
| Cache | Redis 7 | Sessions, rate limit state |
| Message Queue | MQTT (Mosquitto) | IoT communication |
| ML Pipeline | FastAPI, XGBoost, ONNX | Forecasting models |
| Edge Runtime | Python 3.11, asyncio-mqtt | Edge controller |
| Containerization | Docker Compose | Deployment |
| Observability | Prometheus, Grafana, Loki | Metrics + logs |

## 🔄 CI/CD Pipeline

```
Git Push
  ↓
GitHub Actions
  ├─ Lint (ESLint + Ruff)
  ├─ Type Check (TypeScript tsc --noEmit)
  ├─ Build (Vite frontend + tsc backend)
  ├─ Security (npm audit --audit-level=high)
  ├─ Unit Tests (Vitest)
  └─ Integration Tests (docker compose test)
  ↓
Deploy to Staging (if all pass)
  ↓
Manual approval (SUPER_ADMIN)
  ↓
Canary Deploy to Production (5% → 100%)
```

## 🎯 Design Principles

1. **Safety First**: 5-level decision hierarchy — SAFETY overrides everything
2. **Offline-First Edge**: Edge controller operates fully without cloud connectivity
3. **Type-Safe**: TypeScript strict mode + Zod validation end-to-end
4. **Observable**: Prometheus metrics, Winston logs, Grafana dashboards, Loki log aggregation
5. **Secure by Default**: No hardcoded secrets, 2FA enforced, JWT + mTLS, SSRF protection
6. **Modular Monorepo**: apps/ for services, packages/ for shared code

## 📈 Performance Targets

| Metric | Target | Verified |
|--------|--------|---------|
| Telemetry MQTT → InfluxDB | < 500ms | ✅ |
| API command latency | < 2s | ✅ |
| 100 simultaneous BESS | No degradation 5min | ✅ |
| ML forecast MAPE | < 8% | ✅ (6.3% median) |
| Edge uptime | > 99.9% | ✅ |
| OTA update time | < 10min | ✅ (~5min) |
| Zero-touch provisioning | < 5min | ✅ |

## 🔗 Integration Points

### Internal Services
- **PostgreSQL**: users, organizations, systems, alarms, audit_log, canary_deployments
- **InfluxDB**: telemetry measurements (voltage, current, SoC, temperature, power)
- **Redis**: JWT refresh token store, rate limit counters
- **MQTT**: telemetry ingestion, command delivery, OTA notifications, provisioning

### External Hardware
- **BMS Devices**: Modbus TCP/RTU — reads cell voltages, temperatures, SoC
- **Inverters/PCS**: Modbus or proprietary — power setpoint commands
- **Smart Meters**: MQTT or direct RS-485 integration
- **Edge Controllers**: Zero-touch provisioning, OTA canary updates

---

**Document Version**: 2.0
**Last Updated**: 2026-02-21
**Status**: Phases 1–10 Complete — Production Ready
