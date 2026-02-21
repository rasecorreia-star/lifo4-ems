# Variáveis de Ambiente - LIFO4 EMS

Documentação completa de todas as variáveis de environment usadas no projeto.

---

## 🚀 Quick Start

```bash
# Frontend
cp frontend/.env.example frontend/.env
cp frontend/.env.development frontend/.env.development  # para dev local

# Backend (quando implementado)
cp backend/.env.example backend/.env
```

---

## Frontend Variables

### API & Communication

| Variável | Descrição | Padrão | Obrigatória | Exemplo |
|----------|-----------|--------|-------------|---------|
| `VITE_API_URL` | URL base da API backend | `http://localhost:3001` | ✅ | `https://api.lifo4.com.br` |
| `VITE_API_VERSION` | Versão da API | `v1` | ✅ | `v1` |
| `VITE_WS_URL` | URL do WebSocket | `ws://localhost:3001` | ✅ | `wss://api.lifo4.com.br` |

### Demo Mode (⚠️ NUNCA true em produção!)

| Variável | Descrição | Padrão | Obrigatória | Segurança |
|----------|-----------|--------|-------------|-----------|
| `VITE_DEMO_MODE` | Ativar modo demonstração (auto-login) | `false` | ✅ | 🔴 CRÍTICO |
| `VITE_DEMO_EMAIL` | Email para auto-login em demo | `demo@lifo4.com.br` | ⚠️ Se `VITE_DEMO_MODE=true` | 🔴 CRÍTICO |
| `VITE_DEMO_PASSWORD` | Senha para auto-login em demo | `demo123` | ⚠️ Se `VITE_DEMO_MODE=true` | 🔴 CRÍTICO |

### Firebase (Authentication & Realtime Database)

| Variável | Descrição | Obrigatória | Notas |
|----------|-----------|-------------|-------|
| `VITE_FIREBASE_API_KEY` | Public API key do Firebase | ✅ | Pode ser exposto (é public) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain do projeto Firebase | ✅ | Ex: `my-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | ID do projeto Firebase | ✅ | Ex: `my-project` |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket | ✅ | Ex: `my-project.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Sender ID | ✅ | Número como string |
| `VITE_FIREBASE_APP_ID` | App ID | ✅ | Identificador da app |

**Onde pegar?**
1. Ir para https://console.firebase.google.com
2. Selecionar projeto
3. Settings → Project Settings → Your apps → Web
4. Copiar `firebaseConfig`

### App Configuration

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `VITE_APP_NAME` | Nome da aplicação (usado no title) | `Lifo4 EMS` | ❌ |
| `VITE_APP_VERSION` | Versão da app (mostrada em about) | `1.0.0` | ❌ |

### Feature Flags

| Variável | Descrição | Padrão | Notas |
|----------|-----------|--------|-------|
| `VITE_ENABLE_PWA` | Ativar Progressive Web App | `false` | Não implementado ainda |
| `VITE_ENABLE_ANALYTICS` | Ativar Google Analytics | `false` | Não implementado ainda |
| `VITE_ENABLE_SENTRY` | Ativar error tracking (Sentry) | `false` | Opcional |

### Error Tracking (Sentry)

| Variável | Descrição | Obrigatória | Se desabilitado |
|----------|-----------|-------------|-----------------|
| `VITE_SENTRY_DSN` | Data Source Name do Sentry | ❌ | Defina como vazio ou remova |

---

## Backend Variables

### Server Configuration

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `NODE_ENV` | Ambiente (development/production) | `development` | ✅ |
| `PORT` | Porta do servidor | `3001` | ❌ |
| `API_VERSION` | Versão da API | `v1` | ❌ |

### Authentication & Secrets

| Variável | Descrição | Obrigatória | ⚠️ Segurança |
|----------|-----------|-------------|-------------|
| `JWT_SECRET` | Secret para assinar JWT tokens | ✅ | 🔴 CRÍTICO - use chave forte! |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens | ✅ | 🔴 CRÍTICO |
| `JWT_ACCESS_EXPIRY` | Tempo de exp. access token | `1h` | ❌ |
| `JWT_REFRESH_EXPIRY` | Tempo de exp. refresh token | `30d` | ❌ |

### Firebase Admin SDK

| Variável | Descrição | Obrigatória |
|----------|-----------|-------------|
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase | ✅ |
| `FIREBASE_PRIVATE_KEY` | Private key (arquivo serviceAccountKey.json) | ✅ |
| `FIREBASE_CLIENT_EMAIL` | Email da service account | ✅ |
| `FIREBASE_DATABASE_URL` | URL do Realtime Database | ✅ |

**Onde pegar?**
1. Firebase Console → Project Settings → Service Accounts
2. Clique "Generate New Private Key"
3. Download o arquivo JSON
4. Extraia os valores ou passe o arquivo via `FIREBASE_SERVICE_ACCOUNT_JSON`

### Database (quando migrar para PostgreSQL + InfluxDB)

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `DATABASE_URL` | Connection string PostgreSQL | - | ✅ (Fase 4) |
| `INFLUXDB_URL` | URL do InfluxDB | `http://localhost:8086` | ✅ (Fase 4) |
| `INFLUXDB_TOKEN` | Token de autenticação InfluxDB | - | ✅ (Fase 4) |
| `INFLUXDB_ORG` | Organização no InfluxDB | `lifo4` | ❌ (Fase 4) |
| `INFLUXDB_BUCKET` | Bucket de telemetria | `telemetry` | ❌ (Fase 4) |

### Message Queue (MQTT)

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `MQTT_BROKER_URL` | URL do broker MQTT | `mqtt://localhost:1883` | ✅ |
| `MQTT_USERNAME` | Usuário MQTT (opcional) | - | ❌ |
| `MQTT_PASSWORD` | Senha MQTT (opcional) | - | ❌ |
| `MQTT_CLIENT_ID` | ID do cliente MQTT | `lifo4-ems-backend` | ❌ |
| `MQTT_TOPIC_PREFIX` | Prefixo de tópicos | `lifo4` | ❌ |

### Logging

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `LOG_LEVEL` | Nível de log (debug/info/warn/error) | `info` | ❌ |
| `LOG_FORMAT` | Formato (json/pretty) | `json` | ❌ |

### Email & Notifications

| Variável | Descrição | Obrigatória | Notas |
|----------|-----------|-------------|-------|
| `SMTP_HOST` | Host SMTP | ❌ | Para envio de relatórios |
| `SMTP_PORT` | Porta SMTP | `587` | ❌ |
| `SMTP_USER` | Usuário SMTP | ❌ | ❌ |
| `SMTP_PASSWORD` | Senha SMTP | ❌ | 🔴 CRÍTICO |
| `SMTP_FROM_EMAIL` | Email de origem | `noreply@lifo4.com.br` | ❌ |

### External Services

| Variável | Descrição | Obrigatória | Fase |
|----------|-----------|-------------|------|
| `ML_SERVICE_URL` | URL do ML service | ❌ | Fase 6 |
| `WEATHER_API_KEY` | OpenWeatherMap API key | ❌ | Fase 7 |
| `PLD_API_URL` | URL da API de preços PLD | ❌ | Fase 7 |
| `SENTRY_DSN` | Sentry error tracking | ❌ | Opcional |

---

## Edge Controller Variables

### Server

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `EDGE_SITE_ID` | ID único do site/edge controller | - | ✅ |
| `EDGE_SYSTEM_ID` | ID do sistema BESS | - | ✅ |
| `LOG_LEVEL` | Nível de log (debug/info/warn/error) | `info` | ❌ |

### Communication

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `MQTT_BROKER_URL` | URL do broker MQTT | `mqtt://localhost:1883` | ✅ |
| `MQTT_USERNAME` | Usuário MQTT | - | ❌ |
| `MQTT_PASSWORD` | Senha MQTT | - | ❌ |
| `MODBUS_TCP_HOST` | Host Modbus TCP | `192.168.1.100` | ❌ |
| `MODBUS_TCP_PORT` | Porta Modbus TCP | `502` | ❌ |
| `MODBUS_RTU_PORT` | Porta serial (Linux: `/dev/ttyUSB0`, Windows: `COM3`) | `COM3` | ❌ |
| `MODBUS_RTU_BAUD` | Baud rate serial | `9600` | ❌ |

### Control Loop

| Variável | Descrição | Padrão | Obrigatória |
|----------|-----------|--------|-------------|
| `CONTROL_LOOP_INTERVAL_MS` | Intervalo do loop de controle | `5000` | ❌ |
| `MODBUS_TIMEOUT_MS` | Timeout de leitura Modbus | `5000` | ❌ |
| `MODBUS_RETRY_COUNT` | Número de retries Modbus | `3` | ❌ |

### Safety Limits (⚠️ Nunca override remoto!)

| Variável | Descrição | Padrão | Crítico |
|----------|-----------|--------|---------|
| `SAFETY_CELL_VOLTAGE_MIN` | Tensão mínima célula (V) | `2.5` | 🔴 Hardcoded |
| `SAFETY_CELL_VOLTAGE_MAX` | Tensão máxima célula (V) | `3.65` | 🔴 Hardcoded |
| `SAFETY_TEMP_MAX` | Temperatura máxima (°C) | `50` | 🔴 Hardcoded |
| `SAFETY_TEMP_MIN` | Temperatura mínima (°C) | `-10` | 🔴 Hardcoded |
| `SAFETY_SOC_MIN` | SOC mínimo absoluto (%) | `5` | 🔴 Hardcoded |
| `SAFETY_SOC_MAX` | SOC máximo absoluto (%) | `98` | 🔴 Hardcoded |

---

## Environment Files

### Development (`.env.development`)
- `VITE_DEMO_MODE=true`
- Localhost URLs (`http://localhost:3001`)
- Firebase dev project
- Pode ter credenciais plaintext (nunca commit)

### Production (`.env.production`)
- `VITE_DEMO_MODE=false`
- HTTPS URLs (`https://api.lifo4.com.br`)
- Firebase production project
- Todas as credenciais em secrets manager

### Testing (`.env.test`)
- URLs de teste (`http://localhost:5173`)
- Mock API (`http://localhost:3002`)
- Firebase emulator (opcional)
- Dados de teste

---

## Security Best Practices

### 🔴 NUNCA FAZER

```bash
# ❌ Commitar .env
git add .env  # NÃO FAZER!

# ❌ Colocar senhas em código
const password = "demo123";  // NÃO FAZER!

# ❌ Usar secrets em .env.example
VITE_FIREBASE_API_KEY=AIzaSyDKdB...  # NÃO FAZER!
```

### ✅ SEMPRE FAZER

```bash
# ✅ Usar .env.example sem values
VITE_FIREBASE_API_KEY=your-firebase-api-key

# ✅ Usar secrets manager em produção
# GitHub Secrets, AWS Secrets Manager, HashiCorp Vault, etc

# ✅ Restringir .env no .gitignore
.env
.env.local
.env.*.local
```

### Loadind Order (Priority)

```
1. .env.{NODE_ENV}.local    (ignored in git)
2. .env.{NODE_ENV}          (not committed)
3. .env.local               (ignored in git)
4. .env                     (ignored in git)
5. .env.example             (committed - defaults only)
```

---

## Validação de Variáveis

### Frontend (Vite)
```typescript
// Validar que variáveis obrigatórias existem
if (!import.meta.env.VITE_API_URL) {
  throw new Error('VITE_API_URL não configurada!');
}
```

### Backend (Node.js)
```typescript
// Validar startup
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET não configurada!');
}
```

### Edge Controller (Python)
```python
# Validar startup
import os
required_vars = ['EDGE_SITE_ID', 'EDGE_SYSTEM_ID', 'MQTT_BROKER_URL']
for var in required_vars:
    if not os.getenv(var):
        raise ValueError(f'{var} não configurada!')
```

---

## Troubleshooting

### Erro: "VITE_API_URL não definida"
- Solução: Copie `.env.example` para `.env` e preencha os valores

### Erro: "Cannot find module firebase"
- Solução: Verificar `.env` tem `VITE_FIREBASE_API_KEY` definida

### Erro: "Firebase config is invalid"
- Solução: Verificar que todos os campos Firebase estão corretos

### Local: "Failed to connect to api.lifo4.com.br"
- Solução: Use `.env.development` com `VITE_API_URL=http://localhost:3001`

---

## Referências

- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Node.js Best Practices](https://12factor.net/config)
