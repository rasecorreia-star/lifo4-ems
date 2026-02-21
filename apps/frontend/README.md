# Frontend - LIFO4 EMS

Frontend React + TypeScript do sistema de gerenciamento de energia para baterias (BESS).

## Estrutura

Este é o **apps/frontend/** em uma estrutura de monorepo:

```
lifo4-ems/
├── apps/
│   ├── frontend/          ← VOCÊ ESTÁ AQUI
│   ├── backend/
│   └── edge/
├── packages/
│   └── shared/
└── docs/
```

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Variáveis de ambiente

```bash
# Copiar .env.example
cp ../../frontend/.env.example .env

# Editar .env conforme necessário
```

### 3. Executar em desenvolvimento

```bash
npm run dev
```

Acessar em: http://localhost:5174

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Iniciar dev server (Vite) |
| `npm run build` | Build para produção |
| `npm run build:check` | TypeScript check + build |
| `npm run preview` | Preview da build |
| `npm run lint` | Rodar ESLint |
| `npm run lint:fix` | Corrigir linting issues |
| `npm run test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes E2E (Playwright) |

## Arquitetura

### Stack

- **Framework**: React 18
- **Linguagem**: TypeScript 5.3
- **Build**: Vite 5.0
- **Styling**: TailwindCSS 3.3
- **Forms**: React Hook Form + Zod
- **State**: Zustand + React Query
- **UI**: Radix UI
- **Charts**: ECharts + Recharts
- **Maps**: Leaflet
- **Testing**: Playwright + Vitest

### Diretórios

```
src/
├── components/        # Componentes reutilizáveis
│   ├── ui/           # Componentes base (Radix UI)
│   ├── layout/       # Layout e navegação
│   └── systems/      # Componentes de sistemas
├── pages/            # Páginas da aplicação (100+)
├── services/         # API, WebSocket, config
├── store/            # Estado global (Zustand)
├── hooks/            # Custom React hooks
├── types/            # TypeScript tipos
├── lib/              # Utilidades
└── styles/           # CSS global
```

### Path Aliases

Imports com alias (configurado no tsconfig.json):

```typescript
import { Button } from '@components/ui/button';
import { Dashboard } from '@pages/Dashboard';
import { useAuthStore } from '@store/auth.store';
import { api } from '@services/api';
```

## Migração de /frontend para /apps/frontend

### Status: EM PROGRESSO

A estrutura `apps/frontend/` foi criada com os arquivos de configuração:
- ✅ `package.json`
- ✅ `tsconfig.json`
- ✅ `vite.config.ts`

### Próximos passos:

1. **Copiar código-fonte** (manual ou via script):
   ```bash
   cp -r ../../frontend/src ./src
   cp -r ../../frontend/public ./public
   cp -r ../../frontend/tests ./tests
   cp ../../frontend/index.html ./index.html
   ```

2. **Copiar arquivos de configuração** (se ainda não copiados):
   ```bash
   cp ../../frontend/.env ./.env
   cp ../../frontend/.env.example ./.env.example
   cp ../../frontend/.env.development ./.env.development
   cp ../../frontend/playwright.config.ts ./
   cp ../../frontend/tailwind.config.js ./
   cp ../../frontend/postcss.config.js ./
   cp ../../frontend/tsconfig.node.json ./
   cp ../../frontend/tsconfig.json ./tsconfig.json
   ```

3. **Instalar e testar**:
   ```bash
   npm install
   npm run build:check
   npm run dev
   npm run test:e2e
   ```

4. **Depois de validar**:
   - Remover `/frontend` original (após backup)
   - Atualizar CI/CD paths
   - Committar migração

## Ambiente de desenvolvimento

### Requerimentos

- Node.js 20+
- npm 10+

### Variáveis de Ambiente (obrigatórias)

```
VITE_API_URL=http://localhost:3001
VITE_API_VERSION=v1
VITE_WS_URL=ws://localhost:3001
VITE_DEMO_MODE=true                    # development only!
VITE_DEMO_EMAIL=demo@lifo4.com.br
VITE_DEMO_PASSWORD=demo123
```

Ver `docs/ENVIRONMENT_VARIABLES.md` para lista completa.

## Testes

### Testes E2E

```bash
# Rodar todos os testes
npm run test:e2e

# Com UI
npm run test:e2e:ui

# Com browser visível
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Teste específico
npm run test:e2e -- tests/e2e/test-control.spec.ts
```

### Testes Unitários

```bash
npm run test
npm run test:ui
```

## Build

### Development

```bash
npm run dev
```

Port: `5174`

### Production

```bash
npm run build
npm run preview
```

Build output: `dist/`

## Performance

- **Code splitting**: Automático (vendor, charts, ui chunks)
- **PWA**: Suporta Progressive Web App (offline)
- **Lazy loading**: Routes com React.lazy()
- **Tree-shaking**: Vite remove código não-usado

## Troubleshooting

### Erro: "Cannot find module '@components/...'"
→ Verificar `tsconfig.json` paths e `vite.config.ts` resolve.alias

### Erro: "PORT 5174 in use"
→ Mudar `vite.config.ts` linha 74 para outra porta

### Build size grande
→ Analisar com `npm run build -- --report` (requer plugin)

### Imports lentos
→ Verificar se há imports circulares com `npm run build:check`

## Contribuindo

1. Criar branch: `git checkout -b feature/minha-feature`
2. Fazer changes
3. Rodar linting: `npm run lint:fix`
4. Rodar testes: `npm run test:e2e`
5. Commit: `git commit -m "feat: descrição"`
6. Push: `git push origin feature/minha-feature`
7. Criar PR

## Links

- [Documentação de Environment Variables](../../docs/ENVIRONMENT_VARIABLES.md)
- [Arquitetura Geral](../../docs/ARCHITECTURE.md)
- [Guia de Contribuição](../../CONTRIBUTING.md)
