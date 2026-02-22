# Checklist de Produção — LIFO4 EMS

Executar este checklist antes de cada deploy em produção ou ao provisionar novo cliente.

---

## Segurança

- [ ] Demo mode desabilitado (`VITE_DEMO_MODE=false` no `.env`)
- [ ] Todas as variáveis de ambiente configuradas (ver `ENVIRONMENT_VARIABLES.md`)
- [ ] HTTPS habilitado com certificado válido (Let's Encrypt ou CA corporativa)
- [ ] mTLS configurado para comunicação edge-cloud (MQTT broker)
- [ ] Rate limiting ativo em todos os endpoints críticos
- [ ] 2FA habilitado para todas as contas ADMIN e SUPER_ADMIN
- [ ] Audit log funcionando e registrando ações de escrita
- [ ] Scan de vulnerabilidades sem issues CRITICAL ou HIGH (`npm audit` + Snyk)
- [ ] Zero credenciais hardcoded no código (`git grep -r "password\|secret\|token" --include="*.ts" src/`)
- [ ] JWT secret com 64+ caracteres aleatórios
- [ ] Headers de segurança HTTP configurados no nginx
- [ ] CSP (Content Security Policy) restritiva (sem `unsafe-eval`)
- [ ] CORS configurado para domínio específico (não `*`)

---

## Infraestrutura

- [ ] InfluxDB rodando com backup automático diário (verificar cron)
- [ ] PostgreSQL rodando com backup automático diário (verificar cron)
- [ ] Prometheus coletando métricas de todos os serviços
- [ ] Grafana com dashboards: Overview, Battery, ML Performance, Edge Status
- [ ] Alertas P1–P4 configurados e testados (enviar alerta de teste)
- [ ] DNS configurado e apontando para IP correto
- [ ] SSL/TLS certificados com data de expiração > 60 dias
- [ ] Volumes Docker com backup snapshot
- [ ] Espaço em disco > 40 GB livres
- [ ] Monitoramento de disco configurado (alerta em 80%)

---

## Edge Controller (por site)

- [ ] Safety limits verificados para modelo de bateria específico do cliente
- [ ] Teste de simulador de BMS contra hardware real (pelo menos 30 min)
- [ ] Fallback offline testado: desconectar internet por 60 min, verificar operação
- [ ] Black start testado: simular queda de rede, verificar restauração
- [ ] OTA update testado com rollback automático (usar versão de teste)
- [ ] Watchdog testado: matar processo `lifo4-edge`, verificar restart em < 10s
- [ ] Certificados MQTT com data de expiração > 90 dias
- [ ] SQLite buffer funcionando (verificar arquivo `/data/telemetry/buffer.db`)
- [ ] Sincronização pós-offline verificada (dados chegam ao InfluxDB)

---

## Operação

- [ ] Runbook de incidentes documentado e acessível à equipe
- [ ] Escalation de alertas configurado (PagerDuty / WhatsApp)
- [ ] Relatórios automáticos configurados (testar geração de PDF)
- [ ] Primeiro relatório fiscal gerado e validado por contador do cliente
- [ ] Treinamento da equipe de operação realizado (mínimo 2 pessoas)
- [ ] Procedimento de emergência impresso e afixado no site físico

---

## Performance

- [ ] Stress test com 100 BESS simultâneos: **PASSOU** (sem degradação em 5 min)
- [ ] Latência de comando via API < 2s: **VERIFICADO**
- [ ] Latência de telemetria MQTT → InfluxDB < 500ms: **VERIFICADO**
- [ ] Uptime do edge > 99.9% em teste de 7 dias: **VERIFICADO**
- [ ] Memória do backend estável (sem leak) em 24h de carga: **VERIFICADO**
- [ ] Build frontend sem warnings: `npm run build`
- [ ] Bundle size < 2MB (gzipped): **VERIFICADO**

---

## Testes

- [ ] Todos os testes de integração passam: `npm run test:integration`
- [ ] Stress tests passam: `npm run test:stress`
- [ ] Testes E2E do frontend passam: `npx playwright test`
- [ ] Zero vulnerabilidades críticas no scan de segurança
- [ ] Cobertura de testes unitários > 70%

---

## Documentação

- [ ] `docs/ARCHITECTURE.md` atualizado
- [ ] `docs/API.md` reflete todos os endpoints atuais
- [ ] `docs/DEPLOYMENT.md` tem instruções de deploy corretas
- [ ] `docs/OPERATIONS.md` tem runbook atualizado
- [ ] `docs/EDGE_CONTROLLER.md` reflete versão atual do firmware
- [ ] `docs/ML_PIPELINE.md` tem métricas atualizadas
- [ ] `docs/SECURITY.md` reflete configuração atual
- [ ] `README.md` com badge de CI/CD verde

---

## Pós-Deploy

- [ ] Acessar https://[domínio] sem erros
- [ ] `/health` retorna `{"status":"ok","version":"x.y.z"}`
- [ ] Login com conta admin funciona
- [ ] Dashboard carrega dados em tempo real
- [ ] Pelo menos 1 sistema aparece no mapa com telemetria recente
- [ ] Enviar comando de teste (charge com 1 kW) e verificar ACK
- [ ] Verificar Grafana: métricas chegando
- [ ] Verificar que alertas de e-mail chegam (enviar teste)

---

**Responsável pelo checklist**: ________________________

**Data**: ________________________

**Versão deployada**: ________________________

**Assinatura**: ________________________
