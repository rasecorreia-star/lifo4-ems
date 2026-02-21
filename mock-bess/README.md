# BESS Mock Simulator

Simulador de hardware BESS para testes do EMS sem equipamento real.

## Equipamentos Simulados

- **JK BMS PB2A16S20P** - BMS 16S LiFePO4, 200Ah
- **ANENJI ANJ-6200W-48V** - Inversor híbrido 6.2kW
- **Smart Meter CT-100** - Medidor de energia bidirecional

## Instalação

```bash
cd mock-bess
npm install
```

## Uso

```bash
# Inicia o simulador
npm start

# Ou com configuração customizada
MQTT_BROKER=mqtt://192.168.1.100:1883 DEVICE_ID=my-bess-001 npm start
```

## Variáveis de Ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `MQTT_BROKER` | `mqtt://localhost:1883` | URL do broker MQTT |
| `MQTT_TOPIC_PREFIX` | `lifo4` | Prefixo dos tópicos MQTT |
| `DEVICE_ID` | `mock-bess-001` | ID do dispositivo simulado |
| `MOCK_PORT` | `3002` | Porta do servidor HTTP |

## API HTTP

### Status Geral
```bash
GET http://localhost:3002/api/status
```

### Cenários Disponíveis
```bash
GET http://localhost:3002/api/scenarios
```

### Trocar Cenário
```bash
POST http://localhost:3002/api/scenario
Content-Type: application/json

{"scenario": "solar-charging"}
```

### Status do BMS
```bash
GET http://localhost:3002/api/bms
```

### Status do Inversor
```bash
GET http://localhost:3002/api/inverter
```

### Status do Medidor
```bash
GET http://localhost:3002/api/grid
```

### Ajustar SOC
```bash
POST http://localhost:3002/api/bms/soc
Content-Type: application/json

{"soc": 50}
```

### Mudar Modo do Inversor
```bash
POST http://localhost:3002/api/inverter/mode
Content-Type: application/json

{"mode": "SBU"}  # UTL, SOL, SBU, SUB
```

## Cenários Disponíveis

| ID | Nome | Descrição |
|----|------|-----------|
| `normal` | Normal/Standby | Sistema em espera |
| `solar-charging` | Carga Solar | Sol carregando bateria |
| `discharging` | Descarga | Bateria alimentando cargas |
| `grid-charging` | Carga pela Rede | Carregando via rede |
| `low-battery` | Bateria Baixa | SOC crítico (~12%) |
| `high-temp` | Temperatura Alta | Temperatura elevada |
| `grid-failure` | Falha de Rede | Blackout/modo UPS |
| `zero-import` | Zero Import | Consumo zero da rede |

## Tópicos MQTT Publicados

```
lifo4/{deviceId}/telemetry  - Telemetria do BMS (formato EMS)
lifo4/{deviceId}/inverter   - Telemetria do inversor
lifo4/{deviceId}/grid       - Telemetria do medidor
lifo4/{deviceId}/status     - Status do dispositivo
lifo4/{deviceId}/alarm      - Alarmes ativos
```

### Formato da Telemetria BMS

```json
{
  "v": 52.56,
  "i": 15.5,
  "soc": 85,
  "soh": 98,
  "cells": [3.285, 3.287, ...],
  "temps": [28.5, 29.1, 27.8, 28.2],
  "bal": 0,
  "alm": 0,
  "wrn": 0,
  "cyc": 127,
  "cap": 170
}
```

### Formato da Telemetria Inversor

```json
{
  "mode": "SBU",
  "online": true,
  "pv": {"voltage": 380, "current": 12.5, "power": 4750},
  "grid": {"voltage": 220, "frequency": 60, "connected": true, "power": 0},
  "output": {"voltage": 220, "frequency": 60, "power": 1500, "loadPercent": 24},
  "battery": {"voltage": 52.5, "current": 25, "power": 1312, "soc": 85, "charging": true},
  "temps": {"heatsink": 45, "transformer": 42}
}
```

## Testando com mosquitto_sub

```bash
# Ver toda telemetria
mosquitto_sub -h localhost -t "lifo4/#" -v

# Só telemetria do BMS
mosquitto_sub -h localhost -t "lifo4/+/telemetry" -v

# Alarmes
mosquitto_sub -h localhost -t "lifo4/+/alarm" -v
```

## Enviar Comandos via MQTT

```bash
# Trocar cenário
mosquitto_pub -h localhost -t "lifo4/mock-bess-001/command" \
  -m '{"action":"setScenario","scenario":"solar-charging"}'

# Ajustar SOC
mosquitto_pub -h localhost -t "lifo4/mock-bess-001/command" \
  -m '{"action":"setSoc","value":50}'

# Mudar modo do inversor
mosquitto_pub -h localhost -t "lifo4/mock-bess-001/command" \
  -m '{"action":"setMode","mode":"UTL"}'
```
