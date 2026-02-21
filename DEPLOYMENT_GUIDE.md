# Deployment Guide - LIFO4 EMS

## FASE 8: DEPLOYMENT SETUP

### Backend Deployment

#### Prerequisites
```bash
Node.js >= 16
npm >= 8
Docker (optional)
```

#### Installation & Setup
```bash
# Install dependencies
cd apps/backend
npm install

# Create .env file
cp .env.example .env

# Edit .env with your configuration
VITE_API_PORT=3001
VITE_NODE_ENV=production
VITE_LOG_LEVEL=info
VITE_CORS_ORIGIN=https://yourdomain.com
VITE_JWT_SECRET=your-secret-key
VITE_DATABASE_URL=postgresql://user:pass@localhost/emsdb
```

#### Start Server
```bash
npm run build
npm start

# Or with PM2 for production
pm2 start ecosystem.config.js --env production
```

### Frontend Deployment

#### Build
```bash
cd apps/frontend
npm install
npm run build

# Output in dist/
```

#### Environment Variables
```bash
# .env.production
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
VITE_APP_NAME=LIFO4 EMS
VITE_DEMO_MODE=false
```

#### Deploy (Vercel Example)
```bash
npm install -g vercel
vercel --prod
```

Or Docker:
```bash
docker build -t ems-frontend .
docker run -p 3000:3000 ems-frontend
```

### Database Setup (PostgreSQL)

```sql
-- Create database
CREATE DATABASE emsdb;

-- Create tables (run migrations)
-- Tables for: users, systems, telemetry, decisions, alerts, etc.
```

### Docker Compose (Full Stack)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_PASSWORD: password
      POSTGRES_DB: emsdb
    volumes:
      - postgres_data:/var/lib/postgresql/data

  backend:
    build: ./apps/backend
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/emsdb
      NODE_ENV: production
    depends_on:
      - postgres

  frontend:
    build: ./apps/frontend
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://backend:3001
      VITE_WS_URL: ws://backend:3001
    depends_on:
      - backend

volumes:
  postgres_data:
```

Start with:
```bash
docker-compose up -d
```

---

## FASE 9: MONITORING & OBSERVABILITY

### Logging Setup

#### Backend Logging
```typescript
// Use Winston or Pino
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});
```

### Metrics Collection

#### Prometheus Integration
```bash
npm install prom-client
```

```typescript
import client from 'prom-client';

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
});

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  next();
});

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});
```

### Health Checks

```typescript
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

app.get('/readiness', async (req, res) => {
  const isReady = await checkDatabaseConnection();
  if (isReady) {
    res.json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});
```

### Error Tracking (Sentry Example)

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());
```

---

## FASE 10: CI/CD & AUTOMATION

### GitHub Actions Workflow

```yaml
name: Deploy

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npm run type-check

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3

      - name: Deploy to production
        run: |
          # Your deployment commands here
          echo "Deploying to production..."
```

### Environment Configuration

#### Production
```bash
NODE_ENV=production
LOG_LEVEL=warn
CORS_ORIGIN=https://yourdomain.com
JWT_EXPIRATION=24h
SESSION_TIMEOUT=3600
```

#### Staging
```bash
NODE_ENV=staging
LOG_LEVEL=info
CORS_ORIGIN=https://staging.yourdomain.com
JWT_EXPIRATION=7d
SESSION_TIMEOUT=7200
```

### Automated Backups

```bash
# Daily database backup
0 2 * * * /scripts/backup-db.sh

# Script: backup-db.sh
#!/bin/bash
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > $BACKUP_DIR/backup_$TIMESTAMP.sql
gzip $BACKUP_DIR/backup_$TIMESTAMP.sql
```

### Monitoring Dashboard

Monitor these KPIs:
- API response time
- Error rate
- System availability
- Telemetry data flow
- Decision latency
- WebSocket connections
- Database performance

Tools:
- **Prometheus** for metrics collection
- **Grafana** for visualization
- **ELK Stack** for log aggregation
- **New Relic** / **DataDog** for APM

---

## Checklist

- [ ] Backend compiled and tested
- [ ] Frontend built and optimized
- [ ] Database created and migrated
- [ ] Environment variables configured
- [ ] Docker images built
- [ ] SSL/TLS certificates configured
- [ ] Logging enabled
- [ ] Monitoring setup
- [ ] Backups automated
- [ ] CI/CD pipeline working
- [ ] Health checks passing
- [ ] Load testing complete
- [ ] Documentation updated

## Support

For issues:
1. Check logs: `docker logs ems-backend`
2. Check metrics: `http://localhost:9090` (Prometheus)
3. Check dashboard: `http://localhost:3000` (Grafana)
4. Contact support: support@lifo4.com.br
