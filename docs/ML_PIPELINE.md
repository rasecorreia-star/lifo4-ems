# ML Pipeline — Documentação Técnica

## Modelos Utilizados

| Modelo | Tipo | MAPE | RMSE | Horizonte | Status |
|--------|------|------|------|-----------|--------|
| Ensemble | Hybrid voting | 3.2% | 45.8 kW | 24–48h | Ativo (padrão) |
| LSTM NN | Deep Learning | 4.1% | 52.3 kW | 24–48h | Ativo |
| XGBoost | Gradient Boosting | 3.9% | 49.6 kW | 24h | Ativo |
| Prophet | Seasonal decomposition | 4.8% | 58.1 kW | 48h | Ativo |
| ARIMA | Time Series | 6.2% | 68.4 kW | 12h | Legado |

**Ensemble voting**: média ponderada LSTM×0.4 + XGBoost×0.35 + Prophet×0.25

---

## Pipeline de Treino

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   InfluxDB   │    │   Feature    │    │   Train      │    │   Evaluate   │
│   30d data   │───►│  Engineering │───►│   Models     │───►│  & Compare   │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                     │
                                              ┌──────────────────────┘
                                              │
                                         MAPE < 8%?
                                              │
                                    ┌─────────┴─────────┐
                                    │ YES               │ NO
                                    ▼                   ▼
                             ┌──────────────┐    ┌──────────────┐
                             │  Deploy via  │    │  Keep old    │
                             │    MQTT OTA  │    │   model      │
                             └──────────────┘    └──────────────┘
```

### Features de entrada

- Histórico de carga: 30 dias (por hora)
- Hora do dia: one-hot encoded (24 dimensões)
- Dia da semana: one-hot encoded (7 dimensões)
- Feriados brasileiros: boolean
- Temperatura ambiente (se sensor disponível)
- Preço de energia (se integração com CCEE)
- Sazonalidade anual: seno/cosseno

### Saída

- Previsão de carga por hora: próximas 24–48h (kW)
- Intervalo de confiança 90%
- Probabilidade de pico de demanda por hora

---

## Como Funciona o Retraining

### Automático (semanal)

```
Toda segunda-feira às 03:00
  ↓
Coleta últimos 90 dias do InfluxDB
  ↓
Treina todos os 4 modelos em paralelo
  ↓
Avalia cada modelo via backtesting (últimos 14 dias)
  ↓
Atualiza ensemble weights conforme desempenho atual
  ↓
Se MAPE melhorou > 5%: deploy para edge via MQTT
  ↓
Modelo antigo arquivado (pode ser restaurado)
```

### Manual

```bash
# Via API
curl -X POST $API_URL/api/v1/ml/retrain \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "systemId": "bess-456",
    "modelType": "ensemble",
    "trainingWindowDays": 90,
    "forceRedeploy": false
  }'

# Verificar job
curl $API_URL/api/v1/ml/training-jobs/{jobId}
```

---

## Deploy de Modelo

Modelos são deployados no edge via MQTT:

```
Cloud publica em lifo4/{systemId}/ml/model
  Payload: {
    "version": "1.3.0",
    "modelType": "ensemble",
    "url": "https://models.lifo4.com.br/bess-456/v1.3.0.pkl",
    "checksum": "sha256:...",
    "accuracy": { "mape": 3.1, "rmse": 44.2 }
  }

Edge:
  1. Baixa modelo
  2. Verifica checksum
  3. Substitui modelo ativo
  4. Confirma via lifo4/{systemId}/ml/model/ack
```

Rollback automático se inferência falhar após deploy.

---

## Como Avaliar Performance de um Modelo

### Via API

```bash
# Backtesting: compara previsões vs realidade
curl -X POST $API_URL/api/v1/ml/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "systemId": "bess-456",
    "startDate": "2026-01-01",
    "endDate": "2026-01-31",
    "modelVersion": "1.2.0"
  }'
```

Resposta:
```json
{
  "mape": 3.8,
  "rmse": 47.2,
  "accuracy24h": 94.1,
  "accuracy48h": 89.7,
  "worstHours": [8, 17, 18],
  "bestHours": [2, 3, 4]
}
```

### Via Grafana

Dashboard: **ML Performance** → métricas históricas por modelo, sistema e horário.

### Quando o modelo está ruim

Sinais de alerta (alerta P4 automático):
- MAPE > 8% por 3 dias consecutivos
- RMSE aumentou > 20% vs. semana anterior
- Erro sistemático em horário específico (≥ 3h com erro > 15%)

Ações:
1. Verificar se perfil de carga mudou (nova máquina, reforma)
2. Retreinar com janela de dados mais recente
3. Se erro em horário específico: adicionar feature de flag de evento

---

## Inferência no Edge

```python
# O edge usa modelo serializado em ONNX para inferência leve
import onnxruntime as rt

session = rt.InferenceSession("/data/models/forecast.onnx")
features = prepare_features(history_24h, current_time, holidays)
predictions = session.run(None, {"input": features})[0]
# predictions: array de 24 valores (kW por hora)
```

Latência de inferência: **< 50ms** (Jetson Orin Nano)
Memória: **< 100MB** por modelo ONNX

---

## Armazenamento de Modelos

| Local | Conteúdo | Retenção |
|-------|----------|---------|
| `/data/models/forecast.onnx` | Modelo ativo no edge | - |
| `/data/models/forecast_previous.onnx` | Versão anterior (rollback) | 30 dias |
| S3/MinIO cloud | Histórico de todos os modelos | 1 ano |
| PostgreSQL | Metadados e métricas de cada versão | Indefinido |
