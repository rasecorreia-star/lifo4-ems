# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Mock Service Worker (MSW) for API mocking in demo mode
- Docker Compose files for local development and production
- Backend placeholder structure in `apps/backend/`
- Edge Controller placeholder in `apps/edge/` for FASE 3

### Changed
- Frontend workspace references updated from `frontend` to `lifo4-ems-frontend` in CI/CD

### Fixed
- CI/CD references to deprecated `/frontend/` directory

## [1.0.0] - 2026-02-21

FASE 1 Complete: Security hardening, environment management, and monorepo foundation.

### Added

#### Security & Demo Mode
- Environment-controlled demo mode via `VITE_DEMO_MODE` environment variable
- Zero hardcoded credentials in codebase
- Demo mode banner in Header component for visual indication
- Mock Service Worker (MSW) integration for API mocking
- CI/CD guards preventing `isDemoMode = true` hardcoding
- CI/CD detection of hardcoded credentials

#### Environment Variables
- Centralized API URL management with `buildApiUrl()` helper
- Documented environment variables in `docs/ENVIRONMENT_VARIABLES.md` (318 lines)
- `.env.example` at project root and in each app
- `.env.development` for local development
- Environment variable validation in credential initialization

#### CI/CD Pipeline
- GitHub Actions workflow (`.github/workflows/ci.yml`) with 5 jobs:
  - ESLint for frontend code quality
  - TypeScript type checking (tsc --noEmit)
  - Build verification with artifact upload
  - Security checks (npm audit, credential detection)
  - Vitest unit tests + Playwright E2E tests
- Branch protection with required status checks

#### Monorepo Structure
- Root `package.json` with npm workspaces configuration
- `apps/frontend/` - React 18 + Vite + TypeScript frontend (100+ pages, full routing)
- `apps/backend/` - Placeholder for Node.js backend API
- `apps/edge/` - Placeholder for Edge Controller (FASE 3)
- `packages/shared/` - Shared TypeScript types and constants:
  - 150+ lines of type definitions
  - 300+ lines of configuration constants (battery specs, limits, endpoints, topics)
  - Properly configured with TypeScript build

#### Documentation
- `README.md` (350+ lines) - Project overview and quick start guide
- `docs/ARCHITECTURE.md` (400+ lines) - System design, data flows, security architecture
- `docs/CHANGELOG.md` - This file (Keep a Changelog format)
- `docs/ENVIRONMENT_VARIABLES.md` - Comprehensive environment variable reference

#### Code Quality & Testing
- Playwright E2E test suite (8 test specs)
- Vitest unit test framework
- ESLint configuration for TypeScript
- Dead code documentation (14+ unrouted pages with TODO comments)

#### Deployment
- `docker-compose.yml` for development (frontend, backend, PostgreSQL, MQTT, Redis)
- `docker-compose.prod.yml` for production with proper health checks and restarts

### Changed

#### Demo Mode
- **Before**: `isDemoMode = true` hardcoded in `ProtectedRoute.tsx` and `Sidebar.tsx`
- **After**: Uses `import.meta.env.VITE_DEMO_MODE === 'true'` with env validation

#### API URL Management
- **Before**: Hardcoded `http://localhost:3001` in 6 locations (DeviceDiscovery, ConnectionConfig)
- **After**: Centralized via `buildApiUrl()` helper in `services/config.ts`

#### Credentials
- **Before**: Demo credentials with fallback defaults (`|| 'demo@lifo4.com.br'`, `|| 'demo123'`)
- **After**: Explicit environment variables with validation errors if missing

#### Frontend Directory Structure
- `frontend/` legacy directory maintained for backward compatibility
- `apps/frontend/` as primary active directory
- Both synchronized with same code (until legacy removal)

### Removed

- Hardcoded credentials from codebase (`demo@lifo4.com.br`, `demo123` fallbacks)
- Hardcoded API URLs from components
- Puppeteer and `auto-test/` directory (replaced with Playwright)
- Unused imports (Maintenance component)

### Security

- 🔒 All secrets managed via environment variables only
- 🔒 `.env` files added to `.gitignore`
- 🔒 CI/CD pipeline validates no hardcoded credentials or demo mode
- 🔒 Environment variable schema documented and validated
- 🔒 No console.log in production code (CI/CD checks)
- 🔒 Mock server support for demo mode (MSW)

### Fixed

- `apps/frontend/src/components/auth/ProtectedRoute.tsx:15` - isDemoMode now env-controlled
- `apps/frontend/src/components/layout/Sidebar.tsx:172` - isDemoMode now env-controlled
- `apps/frontend/src/services/config.ts:84-85` - Credential fallbacks removed
- `apps/frontend/src/store/auth.store.ts:146-147` - Credential fallbacks removed
- `apps/frontend/src/components/systems/DeviceDiscovery.tsx:58,85,107` - URLs use buildApiUrl()
- `apps/frontend/src/components/systems/ConnectionConfig.tsx:157,184` - URLs use buildApiUrl()
- CI/CD references to deprecated workspace names

## FASE 1 Completion Checklist

- ✅ Security: Demo mode environment-controlled, zero hardcoded credentials
- ✅ Environment Variables: Centralized URL management with buildApiUrl()
- ✅ CI/CD: 5-job GitHub Actions pipeline with security checks
- ✅ Monorepo: Proper npm workspaces, shared package, architecture docs
- ✅ Dead Code: 14+ unrouted pages documented with TODO comments
- ✅ Testing: Playwright E2E + Vitest (Puppeteer removed)
- ✅ Documentation: README, ARCHITECTURE, ENVIRONMENT_VARIABLES, this CHANGELOG
- ✅ Demo Mode: Mock Service Worker integration for API mocking
- ✅ Docker: docker-compose.yml for development and production

## Known Limitations & Future Work

### Known Limitations
1. Backend API not yet implemented (structure prepared in `apps/backend/`)
2. Edge Controller not yet implemented (structure prepared in `apps/edge/`)
3. 14+ unrouted pages preserved with TODO comments for future routing decisions
4. Legacy `/frontend/` directory coexists with `/apps/frontend/` (cleanup pending)

### Next Steps (FASE 2+)
1. Implement backend API in `apps/backend/`
2. Consolidate frontend by removing legacy `/frontend/` directory
3. Implement unrouted page features or remove if unnecessary
4. Add unit tests for critical components
5. Implement real mock server behaviors for common API endpoints

## Future Roadmap

### FASE 2 - Unified Decision Engine
- Complete backend API with Express.js
- Database schema (PostgreSQL)
- Authentication & authorization
- Battery optimization algorithms
- Real-time telemetry processing

### FASE 3 - Edge Controller
- Edge device management
- Local processing capabilities
- Offline operation support
- Direct Modbus communication

### FASE 4+ - Advanced Features
- Machine learning models
- Multi-site aggregation
- Advanced analytics & reporting
- Virtual Power Plant (VPP) capabilities

---

**Format**: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)
**Versioning**: [Semantic Versioning](https://semver.org/spec/v2.0.0.html)
**Last Updated**: 2026-02-21
