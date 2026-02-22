# LIFO4 Edge Controller

O **Edge Controller** é o "cérebro local" de cada site BESS.
Roda em hardware embarcado (RPi 4 / Jetson Nano / IPC industrial)
e garante **99% de autonomia** mesmo sem conexão à internet.

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                  EDGE CONTROLLER                        │
│                                                         │
│  main.py                                                │
│     │                                                   │
│     ├── ControlLoop (5s)                                │
│     │      ├── ModbusClient → BMS/PCS                   │
│     │      ├── SafetyManager (NUNCA falha)              │
│     │      ├── LocalDecisionEngine                      │
│     │      │      ├── BlackStartController (FSM 6 est.) │
│     │      │      ├── PeakShavingController             │
│     │      │      ├── ArbitrageController               │
│     │      │      └── SolarSelfConsumptionController    │
│     │      ├── LocalDatabase (SQLite 72h)               │
│     │      └── SyncManager → MQTT → Cloud              │
│     │                                                   │
│     ├── MqttClient (auto-reconnect)                     │
│     └── SoftwareWatchdog                                │
└─────────────────────────────────────────────────────────┘
```

## Modos de Operação

| Modo | Condição | Comportamento |
|------|----------|---------------|
| **ONLINE** | Cloud conectado | Executa setpoints do cloud |
| **AUTONOMOUS** | Cloud offline >15min | Algoritmos locais com cache |
| **SAFE_MODE** | Erro crítico | Apenas SOC 20-80%, sem otimização |

## Prioridades de Decisão

```
1. SAFETY      → SafetyManager (SEMPRE primeiro, não pode ser desabilitado)
2. GRID_CODE   → BlackStart (ilhamento + reconexão)
3. CONTRACTUAL → PeakShaving (proteção de demanda contratada)
4. ECONOMIC    → Arbitragem + Solar
5. LONGEVITY   → Saúde da bateria
```

## Estrutura

```
apps/edge/
├── Dockerfile
├── docker-compose.yml       (desenvolvimento local)
├── requirements.txt
├── config/
│   ├── default.yaml         (configuração padrão)
│   ├── site-template.yaml   (template por site)
│   ├── safety-limits.yaml   (documentação dos limites)
│   └── modbus-map.yaml      (mapa de registros Modbus)
├── src/
│   ├── main.py              (entry point)
│   ├── config.py            (carregador de configuração)
│   ├── safety/
│   │   ├── safety_manager.py    ← CAMADA 1 (nunca depende de cloud)
│   │   ├── limits.py            ← Constantes hardcoded
│   │   └── watchdog.py          ← Watchdog de software
│   ├── control/
│   │   ├── control_loop.py      ← Loop principal (5s)
│   │   ├── decision_engine.py   ← Coordenador de otimização
│   │   ├── arbitrage.py         ← Arbitragem com preços cached
│   │   ├── peak_shaving.py      ← Proteção de demanda
│   │   ├── solar_self.py        ← Autoconsumo solar
│   │   └── black_start.py       ← FSM de ilhamento
│   ├── communication/
│   │   ├── modbus_client.py     ← BMS via Modbus TCP/RTU
│   │   ├── mqtt_client.py       ← Cloud via MQTT (offline buffer)
│   │   └── protocol_handler.py  ← Abstração de protocolo
│   ├── data/
│   │   ├── local_db.py          ← SQLite (72h telemetria)
│   │   ├── telemetry_buffer.py  ← Buffer circular em memória
│   │   ├── sync_manager.py      ← Sincronização com cloud
│   │   └── cache_manager.py     ← Cache de preços/forecasts
│   └── ml/
│       ├── inference.py         ← ONNX Runtime local
│       └── models/              ← Modelos .onnx (OTA via MQTT)
├── tests/
│   ├── test_safety.py
│   ├── test_control_loop.py
│   ├── test_modbus.py
│   └── test_decision_engine.py  (inclui cenários completos)
└── scripts/
    ├── simulate_bms.py      ← Simulador BMS para desenvolvimento
    └── install.sh           ← Instalação em hardware real
```

## Desenvolvimento

```bash
# Subir stack completo (edge + BMS simulator + MQTT)
docker compose up

# Testar cenário específico
BMS_SCENARIO=hot-day docker compose up

# Rodar testes
pytest tests/ -v

# Instalar em hardware real
sudo bash scripts/install.sh
```

## Cenários do Simulador

| Cenário | Descrição |
|---------|-----------|
| `normal` | Operação normal, SOC 50%, temp 25°C |
| `solar-peak` | Geração solar alta, SOC subindo |
| `grid-failure` | Frequência baixa, tensão instável |
| `hot-day` | Temperatura 47°C, redução de potência |
| `degraded-cell` | Uma célula 170mV abaixo das demais |
| `full-charge` | SOC 96%, próximo do limite |
| `empty` | SOC 7%, próximo do mínimo |

## Segurança

- **Limites hardcoded** em `safety/limits.py` — não podem ser alterados remotamente
- **Safety check SEMPRE** roda antes de qualquer otimização
- **mTLS** para comunicação MQTT com cloud em produção
- **SQLite WAL mode** para consistência de dados
- **Watchdog de software** reinicia o processo se travar
