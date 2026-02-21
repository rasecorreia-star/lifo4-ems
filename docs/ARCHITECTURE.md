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
        │  ▪ Authentication           │
        └──────────────┬──────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼────┐  ┌─────▼──────┐  ┌───▼────────┐
   │ Firebase │  │ MQTT Broker│  │ Time-Series│
   │ Auth     │  │ (Mosquitto)│  │ Database   │
   │ Firestore│  │            │  │ (InfluxDB) │
   └────┬────┘  └─────┬──────┘  └───┬────────┘
        │              │              │
        └──────────────┼──────────────┘
                       │
        ┌──────────────▼──────────────┐
        │     IoT Devices / Hardware   │
        │  ▪ BMS (Battery Management)  │
        │  ▪ Inverters                 │
        │  ▪ Smart Meters              │
        │  ▪ Environmental Sensors     │
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
- RESTful API endpoints
- WebSocket for real-time updates
- Firebase Authentication + Firestore
- MQTT broker integration (Mosquitto)
- Time-series data (InfluxDB)
- Modbus/MQTT protocol support

**Key Modules**:
```
apps/backend/src/
├── api/             # REST endpoints
├── middleware/      # Express middleware
├── services/        # Business logic
├── models/          # Data models
├── utils/           # Utilities
└── config/          # Configuration
```

### `/apps/edge`
**Edge Controller for IoT Devices**
- Runs on embedded Linux (Raspberry Pi, etc.)
- Modbus RTU/TCP communication with BMS
- MQTT publisher (sends data to backend)
- Local control without internet dependency
- Future implementation (FASE 3)

### `/packages/shared`
**Shared Types & Constants**
- TypeScript interfaces (request/response)
- Enums (battery status, control modes)
- Constants (limits, thresholds)
- Validation schemas (Zod)

## 🔄 Data Flow

### 1. Real-Time Telemetry
```
BMS/Inverter (Modbus)
    → Edge Controller (local processing)
    → MQTT Broker
    → Backend (WebSocket)
    → Frontend (Live updates)
```

### 2. User Control Commands
```
Frontend (Button click)
    → Backend API (REST)
    → Backend validates + authenticates
    → MQTT publishes command
    → Edge Controller receives
    → Modbus controls BMS/Inverter
    → Confirmation back through chain
```

### 3. Historical Data
```
Backend ingests telemetry
    → InfluxDB (time-series storage)
    → Frontend queries analytics/reports
```

## 🔐 Security Architecture

### Authentication
- Firebase Authentication (email/password, OAuth)
- JWT tokens with refresh mechanism
- Role-based access control (RBAC)

### Encryption
- HTTPS for all REST API calls
- WSS (WebSocket Secure) for real-time data
- TLS for MQTT connections
- Environment variables for secrets

### Validation
- Zod schemas for input validation
- TypeScript strict mode
- Server-side authorization checks
- Rate limiting on API endpoints

## 🚀 Deployment

### Development
```
npm run dev          # Frontend on :5174
npm run dev --workspace=backend  # Backend on :3001
```

### Production
```bash
npm run build        # Create optimized builds
docker-compose -f docker-compose.prod.yml up
```

**Infrastructure**:
- Frontend: Static hosting (Vercel, Netlify, or S3 + CloudFront)
- Backend: Container orchestration (Kubernetes, Docker Swarm)
- Databases: Cloud-hosted (Firebase, AWS, Google Cloud)
- MQTT: Managed broker or self-hosted Mosquitto

## 📊 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18, TypeScript, Vite | UI Framework |
| Styling | Tailwind CSS | Utility-first CSS |
| State | Zustand, React Query | Client state + server state |
| UI Components | Radix UI | Headless components |
| Forms | React Hook Form, Zod | Form handling + validation |
| Charts | ECharts, Recharts | Data visualization |
| Maps | Leaflet | Geographic visualization |
| Testing | Playwright, Vitest | E2E + Unit tests |
| Backend | Express, TypeScript | REST API |
| Auth | Firebase | Authentication |
| Database | Firestore, InfluxDB | Data storage |
| Message Queue | MQTT (Mosquitto) | IoT communication |
| Containerization | Docker | Deployment |

## 🔄 CI/CD Pipeline

```
Git Push
  ↓
GitHub Actions
  ├─ Lint (ESLint)
  ├─ Type Check (TypeScript)
  ├─ Build (Vite)
  ├─ Security (npm audit)
  └─ Tests (Playwright, Vitest)
  ↓
Deploy to Staging (if all pass)
  ↓
Manual approval
  ↓
Deploy to Production
```

## 🎯 Design Principles

1. **Modular**: Each app is independently deployable
2. **Scalable**: Monorepo enables code sharing without coupling
3. **Type-Safe**: TypeScript throughout for compile-time safety
4. **Testable**: Automated tests catch regressions early
5. **Observable**: Logging, error tracking, metrics
6. **Secure**: No hardcoded secrets, environment-driven config

## 📈 Performance Considerations

### Frontend
- Code splitting by route (lazy loading)
- Service workers for offline capability
- Image optimization
- Bundle size monitoring

### Backend
- Database indexing
- Caching strategies (Redis)
- Connection pooling
- Horizontal scaling via load balancers

### Data
- InfluxDB for time-series compression
- MQTT QoS levels for reliability
- Data retention policies
- Archive old data

## 🔗 Integration Points

### Third-Party Services
- **Firebase**: Authentication, Firestore database
- **MQTT Broker**: IoT device communication
- **InfluxDB**: Time-series data
- **Sentry**: Error tracking (optional)
- **Analytics**: User behavior tracking (optional)

### External Hardware
- **BMS Devices**: Modbus TCP/RTU communication
- **Inverters**: Modbus, CAN, or proprietary protocols
- **Meters**: Smart meters via MQTT or direct integration
- **Edge Controllers**: Local processing devices

## 📝 Next Phases

### FASE 2
- UnifiedDecisionEngine for AI-based optimization
- Move more logic to backend

### FASE 3
- Edge Controller implementation
- Local processing without cloud dependency

### FASE 4+
- Machine learning for prediction
- Advanced control algorithms
- Multi-site aggregation

---

**Document Version**: 1.0
**Last Updated**: 2026-02-21
**Status**: FASE 1 Complete
