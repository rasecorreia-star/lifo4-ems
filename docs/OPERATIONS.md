# Operations Runbook — LIFO4 EMS

Runbook para a equipe de operações. Cobre os incidentes mais comuns.

---

## Índice

1. [Edge Offline](#edge-offline)
2. [Forçar OTA Update](#forcar-ota)
3. [Retreinar Modelo ML Manualmente](#retreinar-ml)
4. [Gerar Relatório Fiscal Manualmente](#relatorio-fiscal)
5. [Resposta a Incidentes P1](#incidente-p1)
6. [Diagnóstico de Alarmes](#alarmes)

---

## 1. Edge Offline <a name="edge-offline"></a>

### Sintomas

- Sistema aparece como "Offline" no dashboard
- Não há telemetria recente (> 30s sem dados)
- Alerta P2 gerado automaticamente

### Diagnóstico

```bash
# 1. Verificar conectividade de rede do site
ping <IP do edge>

# 2. Verificar logs do edge via SSH (se acessível na rede)
ssh admin@<IP-do-edge>
journalctl -u lifo4-edge -n 100 --no-pager

# 3. Verificar MQTT broker
mosquitto_sub -h mqtt.lifo4.com.br -t "lifo4/+/status" -v

# 4. Checar se edge está em modo autônomo
curl http://<IP-do-edge>:9090/heartbeat
```

### Resolução

| Causa | Solução |
|-------|---------|
| Sem internet no site | Verificar roteador/ISP local. Edge opera offline automaticamente |
| Processo edge travado | `ssh admin@<IP> "sudo systemctl restart lifo4-edge"` |
| Certificado MQTT expirado | Renovar certificado via API e publicar novo config |
| Partição com problema | Forçar rollback OTA via API |
| Hardware com falha | Trocar hardware; provisioning automático ao ligar |

### Edge em modo autônomo (sem internet)

**Não é incidente** — sistema projetado para operar offline.
Edge continua controlando bateria com config cached.
Dados são acumulados em SQLite e sincronizados ao voltar online.

---

## 2. Forçar OTA Update <a name="forcar-ota"></a>

```bash
# Via API REST (SUPER_ADMIN necessário)
curl -X POST $API_URL/api/v1/ota/deploy \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.2.0",
    "targetEdgeIds": ["edge-abc123", "edge-def456"],
    "skipCanary": true,
    "force": true
  }'

# Monitorar progresso
curl $API_URL/api/v1/ota/deployments/latest \
  -H "Authorization: Bearer $TOKEN"
```

### Bloqueios comuns

Se o update não iniciar:

1. Verificar se edge está em operação ativa (`/systems/{id}/status`)
2. Se há alarme crítico ativo, resolver primeiro
3. Se SOC < 20%, aguardar ou carregar manualmente
4. Verificar janela de manutenção (padrão 02:00–05:00)

Para ignorar a janela de manutenção:

```bash
# Configurar janela imediata via API
curl -X PUT $API_URL/api/v1/systems/{systemId}/maintenance-window \
  -d '{"startHour": 0, "endHour": 24}'
```

---

## 3. Retreinar Modelo ML Manualmente <a name="retreinar-ml"></a>

O retreinamento automático ocorre toda semana. Para forçar:

```bash
# Via API
curl -X POST $API_URL/api/v1/ml/retrain \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "systemId": "bess-456",
    "modelType": "ensemble",
    "trainingWindowDays": 90
  }'

# Verificar status do treino
curl $API_URL/api/v1/ml/training-jobs/latest \
  -H "Authorization: Bearer $TOKEN"

# Ver métricas do modelo atual
curl $API_URL/api/v1/ml/models/{systemId}/metrics \
  -H "Authorization: Bearer $TOKEN"
```

### Avaliar performance de um modelo

```bash
# Backtesting nos últimos 30 dias
curl -X POST $API_URL/api/v1/ml/evaluate \
  -d '{
    "systemId": "bess-456",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31"
  }'
```

Resposta inclui: MAPE, RMSE, acurácia por hora do dia.

### Quando retreinar

- MAPE > 8% nos últimos 7 dias
- Perfil de consumo do cliente mudou (nova máquina, reforma, etc.)
- Sazonalidade nova (verão/inverno pela primeira vez)

---

## 4. Gerar Relatório Fiscal Manualmente <a name="relatorio-fiscal"></a>

Relatórios fiscais são gerados automaticamente no dia 1 de cada mês.
Para gerar manualmente:

```bash
# Via API
curl -X POST $API_URL/api/v1/reports/fiscal \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "organizationId": "org-789",
    "period": "2026-01",
    "format": "pdf"
  }'

# Verificar status da geração
curl $API_URL/api/v1/reports/fiscal/jobs/latest \
  -H "Authorization: Bearer $TOKEN"

# Baixar relatório
curl $API_URL/api/v1/reports/fiscal/2026-01/download \
  -H "Authorization: Bearer $TOKEN" \
  -o relatorio-jan-2026.pdf
```

### Validação com contador

O relatório inclui:
- Memória de cálculo de crédito de ICMS
- Comprovante de autoconsumo (NF-e referenciada)
- Histórico de transações com horário-tarifário
- Regime tributário aplicado (Simples / Lucro Presumido / Real)

---

## 5. Resposta a Incidentes P1 <a name="incidente-p1"></a>

**P1 = Impacto crítico em bateria ou segurança**

### Processo

```
1. Alerta chega via PagerDuty/WhatsApp (automático)
2. Acessar dashboard → Sistemas → [sistema afetado] → Alarmes
3. Identificar tipo de alarme:
   - OVER_TEMPERATURE → ver item 5a
   - CELL_VOLTAGE_IMBALANCE → ver item 5b
   - EMERGENCY_STOP → ver item 5c
   - COMMUNICATION_LOSS → ver item 1 (edge offline)
4. Executar ação corretiva
5. Registrar ocorrência no sistema
6. Confirmar resolução
```

### 5a. Over Temperature (> 50°C)

```bash
# Verificar temperatura atual
curl $API_URL/api/v1/systems/{id}/telemetry/current

# Sistema já deve ter parado automaticamente
# Checar sistema de refrigeração via câmeras térmicas
# Se refrigeração falhou:
#   → Acionar manutenção preventiva
#   → NÃO religar até normalizar temperatura
```

### 5b. Cell Voltage Imbalance

```bash
# Ver detalhes de células
curl $API_URL/api/v1/systems/{id}/battery/cells

# Se delta > 200mV entre células:
#   → Executar equalização
curl -X POST $API_URL/api/v1/systems/{id}/commands/equalize \
  -H "Authorization: Bearer $TOKEN"
```

### 5c. Emergency Stop ativo

```bash
# Ver motivo do E-Stop
curl $API_URL/api/v1/systems/{id}/events?type=emergency_stop&limit=1

# NUNCA fazer reset sem identificar causa
# Após identificar e resolver:
curl -X POST $API_URL/api/v1/systems/{id}/commands/reset-emergency-stop \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"confirmedSafe": true, "operator": "seu-nome"}'
```

---

## 6. Diagnóstico de Alarmes <a name="alarmes"></a>

### Níveis de severidade

| Nível | Resposta | Exemplo |
|-------|----------|---------|
| P1 – CRITICAL | < 15 min | Over-temp, E-Stop, Cell failure |
| P2 – HIGH | < 1h | Edge offline > 10min, SOC crítico |
| P3 – MEDIUM | < 4h | Latência alta, MQTT instável |
| P4 – LOW | Próximo dia útil | Warning de manutenção, ML accuracy baixo |

### Ver alarmes ativos

```bash
# Todos os sistemas
curl $API_URL/api/v1/alarms?active=true \
  -H "Authorization: Bearer $TOKEN"

# Sistema específico
curl $API_URL/api/v1/systems/{id}/alarms?active=true \
  -H "Authorization: Bearer $TOKEN"
```

### Silenciar alarme (manutenção programada)

```bash
curl -X POST $API_URL/api/v1/alarms/{alarmId}/silence \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"durationMinutes": 60, "reason": "manutenção preventiva"}'
```
