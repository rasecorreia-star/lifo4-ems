# Unit Tests — Vitest

## Estrutura

```
src/__tests__/
├── setup.ts                 # Setup global para testes
├── lib.test.ts             # Testes de funções utilitárias
├── store.test.ts           # Testes de estado (Zustand)
├── components.test.tsx     # Testes de componentes React
└── types.test.ts           # Testes de validação com Zod
```

## Rodar Testes

```bash
# Todos os testes
npm run test

# Em modo watch
npm run test -- --watch

# Com UI
npm run test:ui

# Com coverage
npm run test -- --coverage
```

## E2E Tests — Playwright

```bash
# Todos os testes E2E
npm run test:e2e

# Com interface
npm run test:e2e:ui

# Em modo headed (com navegador visível)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug
```

## Cobertura

- ✅ Vitest: Unit tests (lib, store, types, componentes)
- ✅ Playwright: E2E tests (9 specs)
- ✅ MSW: Mock server para testes de API

## Adicionar Novos Testes

1. Crie arquivo `src/__tests__/nomedoarquivo.test.ts(x)`
2. Importe utilities de `vitest` e `@testing-library/react`
3. Use describe/it para organizar testes
4. Execute `npm run test`

## Exemplo

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import MyComponent from '@/components/MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByRole('heading')).toBeInTheDocument();
  });
});
```
