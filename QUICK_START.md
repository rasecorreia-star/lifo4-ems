# LIFO4 EMS - Quick Start Guide

**Tempo para primeira execução**: ~5 minutos

## 1️⃣ DESENVOLVIMENTO LOCAL

### Setup Backend

```bash
# 1. Navegar para backend
cd apps/backend

# 2. Instalar dependências
npm install

# 3. Criar .env
cp .env.example .env

# 4. Iniciar servidor
npm run dev

# Backend rodando em: http://localhost:3001
```

### Setup Frontend

```bash
# 1. Em novo terminal, navegar para frontend
cd apps/frontend

# 2. Instalar dependências
npm install

# 3. Criar .env
cp .env.example .env

# 4. Iniciar dev server
npm run dev

# Frontend rodando em: http://localhost:3000
```

### Acessar Dashboards

```
Frontend: http://localhost:3000
Backend Health: http://localhost:3001/health
API Docs: http://localhost:3001/api/v1/docs
```

---

## 2️⃣ USANDO O SISTEMA

### Fazer uma Decisão

**API REST**:
```bash
curl -X POST http://localhost:3001/api/v1/optimization/decision \
  -H "Content-Type: application/json" \
  -d '{
    "systemId": "bess-001",
    "telemetry": {
      "soc": 65,
      "soh": 96,
      "temperature": 32,
      "voltage": 800,
      "current": 150,
      "power": 120
    },
    "gridState": {
      "frequency": 59.85,
      "voltage": 378,
      "gridConnected": true
    },
    "marketData": {
      "spotPrice": 340,
      "timePrice": 0.62,
      "demandForecast": 450,
      "loadProfile": "peak"
    }
  }'
```

**React Hook**:
```typescript
import { useUnifiedDecision } from '@/hooks';

function MyComponent() {
  const { mutate: makeDecision, data } = useUnifiedDecision();

  const handleDecision = () => {
    makeDecision({
      systemId: 'bess-001',
      telemetry: { soc: 65, soh: 96, ... },
      gridState: { frequency: 59.85, voltage: 378, ... },
      marketData: { spotPrice: 340, ... }
    });
  };

  return (
    <div>
      <button onClick={handleDecision}>Fazer Decisão</button>
      {data && <p>Ação: {data.data.decision.action}</p>}
    </div>
  );
}
```

### Obter Previsões (24h)

**API**:
```bash
curl "http://localhost:3001/api/v1/ml/forecasting/ensemble?currentHour=14&solarCapacity=100"
```

**Hook**:
```typescript
import { useEnsembleForecast } from '@/hooks';

const { data: forecast } = useEnsembleForecast({
  currentHour: 14,
  solarCapacity: 100,
  horizonHours: 24
});

// data.forecasts contém 24 horas de previsões
```

### Verificar Saúde da Bateria

**Hook**:
```typescript
import { useHealthReport } from '@/hooks';

const { mutate: generateReport } = useHealthReport();

generateReport({
  systemId: 'bess-001',
  nominalCapacity: 500,
  currentCapacity: 485,
  cycleCount: 1200,
  // ... outros parâmetros
});
```

---

## 3️⃣ COMPONENTES PRONTOS

Use os componentes React já implementados:

```typescript
import {
  UnifiedDecisionCard,
  ArbitragePanel,
  ForecastChart,
  BatteryHealthPanel,
  GridServicesPanel,
  MaintenanceAlert,
} from '@/components';

// Exemplo completo
<div>
  <UnifiedDecisionCard
    systemId="bess-001"
    telemetry={telemetry}
    gridState={gridState}
    marketData={marketData}
  />

  <ArbitragePanel
    telemetry={telemetry}
    marketData={marketData}
    historicalPrices={{ low: 250, high: 500 }}
  />

  <ForecastChart horizonHours={24} />

  <BatteryHealthPanel
    systemId="bess-001"
    nominalCapacity={500}
    currentCapacity={485}
    // ...
  />
</div>
```

---

## 4️⃣ AUTENTICAÇÃO

### Fazer Login

```typescript
import { useAuth } from '@/store/auth.context';

function LoginForm() {
  const { login, isLoading, error } = useAuth();

  const handleLogin = async () => {
    try {
      await login('demo@lifo4.com.br', 'password');
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <button onClick={handleLogin} disabled={isLoading}>
      {isLoading ? 'Entrando...' : 'Entrar'}
    </button>
  );
}
```

### Verificar Permissões

```typescript
const { user, hasRole, hasSystemAccess } = useAuth();

// Verificar role
if (hasRole('ADMIN')) {
  // Mostrar painel admin
}

// Verificar acesso a sistema
if (hasSystemAccess('bess-001')) {
  // Mostrar dados do sistema
}
```

---

## 5️⃣ DASHBOARD COMPLETO

Use o OptimizationDashboard pronto:

```typescript
import { OptimizationDashboard } from '@/pages';

export default OptimizationDashboard;
```

Já inclui:
- ⚡ Decisão unificada
- 💰 Arbitragem
- 📊 Previsões
- 🔋 Saúde da bateria
- 🌐 Serviços de grid
- 🔧 Manutenção preditiva

---

## 6️⃣ REAL-TIME (WebSocket)

```typescript
import { useRealtimeDecision } from '@/hooks';

function RealtimeComponent() {
  const { decision, isConnected, requestDecision } = useRealtimeDecision({
    systemId: 'bess-001',
    onDecisionUpdate: (newDecision) => {
      console.log('Decisão atualizada:', newDecision);
    },
  });

  return (
    <div>
      <p>Conectado: {isConnected ? '✅' : '❌'}</p>
      <p>Decisão atual: {decision?.action}</p>
      <button onClick={() => requestDecision({...})}>
        Solicitar Decisão
      </button>
    </div>
  );
}
```

---

## 7️⃣ PRODUÇÃO

### Com Docker Compose

```bash
# 1. Clonar e navegar
cd apps

# 2. Iniciar stack completo
docker-compose up -d

# 3. Verificar
docker-compose ps

# Backend: http://localhost:3001
# Frontend: http://localhost:3000
# Postgres: localhost:5432
```

### Sem Docker

```bash
# Terminal 1: Backend
cd apps/backend
npm install
npm run build
npm start

# Terminal 2: Frontend
cd apps/frontend
npm install
npm run build
npm run preview

# Terminal 3: PostgreSQL
# Usar seu servidor PostgreSQL favorito
```

---

## 8️⃣ TESTING

```bash
# Backend tests
cd apps/backend
npm test

# Frontend tests
cd apps/frontend
npm test

# E2E tests
npm run test:e2e
```

---

## 9️⃣ TROUBLESHOOTING

### CORS error

```bash
# Verificar CORS_ORIGIN em .env
CORS_ORIGIN=http://localhost:3000
```

### Database connection error

```bash
# Verificar DATABASE_URL em .env backend
DATABASE_URL=postgresql://user:password@localhost:5432/emsdb
```

### WebSocket not connecting

```bash
# Verificar WS_URL em .env frontend
VITE_WS_URL=ws://localhost:3001
```

---

## 🔟 ENDPOINTS ÚTEIS

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| POST | `/api/v1/optimization/decision` | Fazer decisão |
| GET | `/api/v1/ml/forecasting/ensemble` | Previsões 24h |
| POST | `/api/v1/ml/battery-health/report` | Saúde da bateria |
| GET | `/api/v1/grid-services/vpp` | Estado VPP |
| POST | `/api/v1/ml/maintenance/predict-failure` | Predição de falhas |
| GET | `/api/v1/health` | Health check |
| GET | `/api/v1/docs` | API documentation |

---

## 📚 DOCUMENTAÇÃO COMPLETA

- **API_ENDPOINTS.md** - Lista completa de 51 endpoints
- **DEPLOYMENT_GUIDE.md** - Como fazer deploy em produção
- **FASES_1-10_COMPLETA.md** - Visão geral completa
- **Code Comments** - Inline documentation em todo o código

---

## ⚡ DICAS RÁPIDAS

1. **Token Demo**: Use `demo-token` como Bearer token para testes
2. **Dados Mock**: OptimizationDashboard usa dados mock - substitua com dados reais
3. **Hot Reload**: Frontend tem hot reload automático
4. **Logs**: Backend loga todas as requisições no console
5. **Tipos**: Todos os tipos estão em `packages/shared/src/types/`

---

## ✅ CHECKLIST PARA COMEÇAR

- [ ] Clone o repositório
- [ ] Instale Node.js 18+
- [ ] `npm install` em backend e frontend
- [ ] Configure arquivos `.env`
- [ ] `npm run dev` em ambos
- [ ] Acesse http://localhost:3000
- [ ] Teste um endpoint via Postman/curl
- [ ] Use um hook no componente
- [ ] Veja dados em tempo real

---

**Pronto! Você está 100% operacional em 5 minutos! 🚀**

Para dúvidas, consulte os arquivos de documentação ou a seção de comentários no código.
