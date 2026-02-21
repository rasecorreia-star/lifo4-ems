# Plano de Migração para Monorepo

## Status: EM EXECUÇÃO 🚀

Migrando de estrutura plana para monorepo:
```
ANTES:                          DEPOIS:
lifo4-ems/                      lifo4-ems/
├── frontend/                   ├── apps/
├── backend/                    │   ├── frontend/
└── ...                         │   ├── backend/
                                │   └── edge/
                                ├── packages/
                                │   └── shared/
                                └── ...
```

---

## Etapa 1: Criar Estrutura de Diretórios

```bash
# Criar estrutura
mkdir -p apps/frontend
mkdir -p apps/backend
mkdir -p apps/edge
mkdir -p packages/shared

# Estrutura esperada:
apps/
├── frontend/          ← (será preenchido)
├── backend/           ← (será preenchido)
└── edge/              ← (será preenchido, vazio por enquanto)

packages/
└── shared/            ← (será preenchido na Fase 5)
```

## Etapa 2: Mover Frontend

COMANDO (executar na raiz do projeto):
```bash
cp -r frontend/* apps/frontend/
```

APÓS: Verificar que os arquivos estão em `apps/frontend/`

## Etapa 3: Mover Backend

COMANDO:
```bash
cp -r backend/* apps/backend/
```

APÓS: Verificar que os arquivos estão em `apps/backend/`

## Etapa 4: Criar Aplicação Edge (Vazia)

COMANDO:
```bash
mkdir -p apps/edge/src
echo "# Edge Controller (FASE 3)" > apps/edge/README.md
```

## Etapa 5: Verificar Imports

Frontend imports já usam aliases (`@/*`), então não precisam mudar!

Alias mapeamento (em `apps/frontend/tsconfig.json`):
```json
{
  "baseUrl": ".",
  "paths": {
    "@/*": ["./src/*"],
    "@components/*": ["./src/components/*"],
    "@pages/*": ["./src/pages/*"],
    "@hooks/*": ["./src/hooks/*"],
    "@services/*": ["./src/services/*"],
    "@store/*": ["./src/store/*"],
    "@lib/*": ["./src/lib/*"],
    "@types/*": ["./src/types/*"]
  }
}
```

## Etapa 6: Build Test

COMANDO (na pasta `apps/frontend/`):
```bash
cd apps/frontend
npm install
npm run build:check
npm run dev
```

ESPERADO: Tudo funciona sem erro

## Etapa 7: Cleanup (Opcional)

Remover diretórios antigos:
```bash
rm -rf frontend
rm -rf backend
```

## Etapa 8: Update CI/CD

Arquivo `.github/workflows/ci.yml` precisa atualizar paths:

```yaml
# ANTES:
npm run lint --workspace=frontend

# DEPOIS:
npm run lint --workspace=apps/frontend
```

---

## Checklist

- [ ] Diretórios `apps/` e `packages/` criados
- [ ] Frontend copiado para `apps/frontend/`
- [ ] Backend copiado para `apps/backend/`
- [ ] Edge dir criado (vazio)
- [ ] npm install em `apps/frontend/` OK
- [ ] `npm run build:check` OK
- [ ] `npm run dev` OK
- [ ] Teste E2E OK
- [ ] CI/CD pipeline atualizado
- [ ] Diretórios antigos removidos
- [ ] Git commit feito

---

## Troubleshooting

### Erro: "Cannot find module '@components/...'"
→ Verificar `apps/frontend/tsconfig.json` paths

### Erro: "Vite: PORT 5173 already in use"
→ Mudar porta em `apps/frontend/vite.config.ts` linha 10

### Erro: "npm ERR! code ERESOLVE"
→ Rodar `npm ci` em vez de `npm install`

### Build OK mas dev server não funciona
→ Verificar `vite.config.ts` resolve.alias

---

## Próximos Passos

Após concluir esta migração:
1. ✅ Estrutura monorepo concluída (Fase 1)
2. → Remover código morto (Fase 1)
3. → Fase 2: UnifiedDecisionEngine

---

Atualizado: 2026-02-21
