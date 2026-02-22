# Security Documentation — LIFO4 EMS

## Modelo de Ameaças

### Ativos a proteger

| Ativo | Criticidade | Impacto de comprometimento |
|-------|-------------|---------------------------|
| Controle de bateria | CRÍTICO | Dano físico, incêndio |
| Dados de telemetria | ALTO | Exposição de informações do cliente |
| Credenciais de usuário | ALTO | Acesso não autorizado ao sistema |
| Configurações de otimização | MÉDIO | Perda econômica |
| Relatórios fiscais | ALTO | Exposição de dados financeiros |

### Vetores de ameaça

1. **Acesso não autorizado à API** — mitigado por JWT + RBAC
2. **Comprometimento de edge controller** — mitigado por mTLS + code signing
3. **Injeção de comandos via MQTT** — mitigado por autenticação de certificado
4. **Replay attacks** — mitigado por timestamp em comandos (janela de 30s)
5. **Escalation de privilégios** — mitigado por RBAC de 7 níveis
6. **Supply chain (atualização maliciosa)** — mitigado por code signing Ed25519

---

## Autenticação e Autorização

### Usuários (API REST)

- **JWT** com expiração: Access Token 1h, Refresh Token 30 dias
- **2FA obrigatório** para SUPER_ADMIN e ADMIN
- **Rate limiting** em login: 5 tentativas / 15 minutos por IP

### Edge Controllers (MQTT)

- **mTLS** (mutual TLS) — edge e cloud autenticam com certificado
- **Bootstrap certificate**: certificado genérico apenas para registro inicial
- **Device certificate**: certificado único por edge, emitido após provisioning
- Certificados: Ed25519 com rotação anual automática

### Hierarquia de Papéis (RBAC)

```
SUPER_ADMIN   → Acesso total (apenas equipe Lifo4)
  ADMIN       → Gerencia organização
    MANAGER   → Operações e relatórios
      TECHNICIAN → Diagnósticos e comissionamento
        OPERATOR → Comandos e agendamentos
          VIEWER → Somente leitura
            USER → Sistemas atribuídos apenas
```

### Permissões críticas

| Ação | Papel mínimo |
|------|-------------|
| Emergency Stop | OPERATOR |
| Reset Emergency Stop | TECHNICIAN |
| Desativar demo mode | SUPER_ADMIN |
| Deploy OTA | SUPER_ADMIN |
| Criar organização | SUPER_ADMIN |
| Ver dados de outros clientes | SUPER_ADMIN |

---

## Criptografia

### Em Trânsito

| Canal | Protocolo | Versão mínima |
|-------|-----------|---------------|
| Frontend → Backend | HTTPS | TLS 1.3 |
| Edge → MQTT | MQTT over TLS | TLS 1.3 |
| Edge → Backend REST | HTTPS | TLS 1.3 |
| InfluxDB → Backend | HTTPS | TLS 1.2+ |
| PostgreSQL → Backend | TLS | TLS 1.2+ |

### Em Repouso

| Dado | Criptografia |
|------|-------------|
| Senhas | bcrypt (custo 12) |
| JWT secret | SHA-256 HMAC (64+ chars) |
| Chaves de API | AES-256-GCM no banco |
| Backups | AES-256 |
| SQLite edge | SQLCipher (opcional) |

### Code Signing (OTA)

- Algoritmo: Ed25519
- Chave privada: armazenada em HSM ou Vault, NUNCA em disco
- Verificação: edge verifica assinatura antes de instalar qualquer update
- Rotação de chave: anual

---

## Headers de Segurança HTTP

```nginx
# nginx.conf
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' wss:;
  font-src 'self';
  object-src 'none';
  frame-ancestors 'none';
" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

---

## Rate Limiting

| Endpoint | Limite | Janela |
|----------|--------|--------|
| POST /auth/login | 5 req | 15 min / IP |
| POST /systems/{id}/commands/* | 60 req | 1 min / usuário |
| POST /systems/{id}/emergency-stop | 10 req | 1 min / usuário |
| GET /telemetry/* | 300 req | 1 min / usuário |
| POST /auth/refresh | 20 req | 1 h / usuário |

Rate limiting implementado com Redis sliding window.
Resposta 429 inclui `Retry-After` header.

---

## Audit Log

Todo evento de escrita é registrado:

```sql
-- Tabela audit_log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,      -- ex: 'command.charge'
    resource_type VARCHAR(50),          -- ex: 'system'
    resource_id VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    payload JSONB,                      -- dados da requisição
    result VARCHAR(20),                 -- 'success' | 'rejected' | 'error'
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Retenção: **5 anos** (exigência regulatória ANEEL).

---

## Procedimento de Resposta a Incidentes

### Classificação

| Classe | Critério | Tempo de resposta |
|--------|----------|------------------|
| SEV-1 | Controle de bateria comprometido | 15 min |
| SEV-2 | Dados de clientes expostos | 1h |
| SEV-3 | Serviço degradado | 4h |
| SEV-4 | Vulnerabilidade sem exploração ativa | 24h |

### Passos (SEV-1 ou SEV-2)

1. **Contenção** (< 15 min)
   - Isolar sistema afetado: `POST /systems/{id}/commands/emergency-stop`
   - Revogar tokens de acesso suspeitos
   - Bloquear IP do atacante

2. **Investigação** (< 2h)
   - Revisar audit_log das últimas 24h
   - Analisar logs de MQTT e backend
   - Identificar vetor de ataque

3. **Remediação**
   - Corrigir vulnerabilidade
   - Rodar scan: `npm audit fix` + Snyk
   - Deploy de patch via OTA se afeta edge

4. **Comunicação**
   - Notificar cliente afetado (se dados expostos)
   - Notificar ANPD se dados pessoais (LGPD — 72h)
   - Post-mortem interno em 5 dias úteis

---

## Scan de Vulnerabilidades

### Automatizado (CI/CD)

```yaml
# .github/workflows/security.yml
- name: npm audit
  run: npm audit --audit-level=high

- name: Snyk scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Manual (antes de release)

```bash
# Backend
cd apps/backend && npm audit

# Frontend
cd apps/frontend && npm audit

# Docker images
docker scout cves lifo4/backend:latest
docker scout cves lifo4/frontend:latest

# OWASP ZAP (API scan)
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://api.staging.lifo4.com.br
```

Critério de release: zero vulnerabilidades CRITICAL ou HIGH sem mitigação documentada.
