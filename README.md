# LIFO4 EMS — Energy Management System for Battery Storage

Advanced Energy Management System for Battery Energy Storage Systems (BESS), developed by LIFO4 Energia.

## 📁 Project Structure

This is a **monorepo** using npm workspaces for managing multiple applications:

```
lifo4-ems/
├── apps/
│   ├── frontend/         React 18 + TypeScript + Vite
│   ├── backend/          Node.js + Express + TypeScript
│   └── edge/             Edge Controller (IoT devices)
├── packages/
│   └── shared/           Shared types, constants, utilities
├── docs/                 Documentation
├── .github/workflows/    CI/CD pipelines
└── package.json          Workspace root
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **npm 10+**

### Installation

```bash
# Install all dependencies
npm install

# Or use the convenience script
npm run install-all
```

### Development

```bash
# Start frontend dev server (port 5174)
npm run dev

# In another terminal, start backend (port 3001)
npm run dev --workspace=backend
```

Access the application at `http://localhost:5174`

### Build

```bash
# Build all apps
npm run build

# Check types + build (frontend)
npm run build:check
```

### Testing

```bash
# Unit tests (Vitest)
npm run test

# Integration tests (requires Docker)
npm run test:integration

# Stress tests — 100 BESS, 1000 commands, 10 failover cycles
npm run test:stress

# E2E tests (Playwright)
npm run test:e2e

# Specific workspace
npm run test --workspace=frontend
```

### Linting

```bash
# Lint all workspaces
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📚 Documentation

- **[Architecture](./docs/ARCHITECTURE.md)** — System design and components
- **[Deployment Guide](./docs/DEPLOYMENT.md)** — Dev setup, production deploy, provisioning, OTA, rollback
- **[Operations Runbook](./docs/OPERATIONS.md)** — Incident response and operational procedures
- **[Edge Controller](./docs/EDGE_CONTROLLER.md)** — Edge hardware, modes, safety limits, Modbus
- **[ML Pipeline](./docs/ML_PIPELINE.md)** — Forecasting models, training, deploy
- **[Security](./docs/SECURITY.md)** — Threat model, auth, encryption, incident response
- **[API Reference](./docs/API.md)** — REST endpoints, authentication, error codes
- **[Environment Variables](./docs/ENVIRONMENT_VARIABLES.md)** — All configurable variables
- **[Production Checklist](./docs/PRODUCTION_CHECKLIST.md)** — Pre-deploy verification
- **[Changelog](./docs/CHANGELOG.md)** — Version history

## 🔐 Security

- **Demo Mode**: Controlled via `VITE_DEMO_MODE` environment variable
- **Credentials**: Never hardcoded — use `.env` files
- **CI/CD**: Automated security checks and credential scanning
- **API Keys**: Stored in environment variables, never in code

## 🛠️ Development Workflow

1. Create a feature branch: `git checkout -b feature/my-feature`
2. Make changes and test locally
3. Run linting: `npm run lint:fix`
4. Run tests: `npm run test:e2e`
5. Commit with descriptive message
6. Push to remote and create a PR

## 📊 CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push:

1. **Lint** — ESLint code quality checks
2. **Type Check** — TypeScript compilation
3. **Build** — Production builds
4. **Security** — Dependency audit
5. **Tests** — Unit (Vitest) + E2E (Playwright)

All checks must pass before merging to main.

## 🏗️ Monorepo Commands

```bash
# Run command in specific workspace
npm run <script> --workspace=frontend
npm run <script> --workspace=backend

# Run in all workspaces
npm run <script> --workspaces

# List all workspaces
npm query '.workspaces'
```

## 🐳 Docker

```bash
# Build frontend image
docker build -f apps/frontend/Dockerfile -t lifo4-ems-frontend .

# Build backend image
docker build -f apps/backend/Dockerfile -t lifo4-ems-backend .

# Run with docker-compose
docker-compose up -d
```

## 📦 Dependencies

- **Frontend**: React 18, TypeScript 5.3, Vite 5, Tailwind CSS, Zustand
- **Backend**: Express, TypeScript, Firebase Admin SDK
- **Shared**: TypeScript types, enums, constants
- **Testing**: Playwright (E2E), Vitest (unit)
- **Quality**: ESLint, TypeScript strict mode

## 🔄 Workspace Commands Cheat Sheet

| Command | Effect |
|---------|--------|
| `npm install` | Install deps in root + all workspaces |
| `npm run dev` | Start frontend dev server |
| `npm run build` | Build all apps |
| `npm run lint` | Lint all code |
| `npm run type-check` | TypeScript check all apps |
| `npm run test` | Run all tests |
| `npm run clean` | Clean all dist + node_modules |

## 🤝 Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## 📧 Support

For issues and questions:
- Create an issue on GitHub
- Check existing documentation
- Review the architecture document

## 📄 License

UNLICENSED — Internal use only

---

**Last Updated**: 2026-02-21
**Status**: FASE 1 Implementation (92% complete)
