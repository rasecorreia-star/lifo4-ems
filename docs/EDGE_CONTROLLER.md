# Edge Controller — Documentação Técnica

## Visão Geral

O Edge Controller é o **cérebro local** que roda em cada site do cliente.
Opera em hardware embarcado (Jetson Orin Nano, RPi 4 ou IPC industrial).

**Função principal**: garantir controle contínuo da bateria mesmo sem internet.

---

## Modos de Operação

### ONLINE
- Conectado ao cloud via MQTT
- Recebe atualizações de otimização em tempo real
- Envia telemetria ao InfluxDB cloud
- Sincroniza setpoints e configurações

### AUTONOMOUS
- Cloud inacessível (perda de internet ou MQTT)
- Opera com parâmetros de otimização cached no SQLite local
- Bufferiza telemetria localmente (72h de capacidade)
- Continua todas as decisões de segurança e controle
- **Sem degradação de segurança** — Safety Manager permanece ativo

### SAFE_MODE
- Ativado se control loop falhar por > 30s em modo AUTONOMOUS
- Mantém bateria em SOC estável (não carrega nem descarrega)
- Mantém emergency stop disponível
- Gera alerta P1 ao cloud assim que conectar

---

## Safety Limits

Os safety limits são configurados por modelo de bateria e NÃO podem ser overridden pelo optimizer.

| Parâmetro | Padrão LiFePO4 | Descrição |
|-----------|---------------|-----------|
| SOC mínimo | 10% | Abaixo: bloqueia descarga |
| SOC máximo | 95% | Acima: bloqueia carga |
| SOC mínimo operação | 20% | Para arbitragem econômica |
| Tensão célula mínima | 2.5V | Proteção de célula |
| Tensão célula máxima | 3.65V | Proteção de sobrecarregamento |
| Temperatura máxima | 50°C | Parada de emergência |
| Temperatura alerta | 45°C | Alerta P1 |
| Corrente máxima C-rate | 1C | Proteção de vida útil |
| Imbalance máximo | 300mV | Alerta P2 |

Safety limits por organização podem ser customizados pelo SUPER_ADMIN via API.

---

## Arquitetura do Control Loop

```
┌─────────────────────────────────────────────────────────┐
│                   Control Loop (100ms)                   │
├──────────────┬──────────────┬──────────────┬────────────┤
│   READ       │   DECIDE     │   EXECUTE    │   REPORT   │
│              │              │              │            │
│ Modbus poll  │ Safety check │ Send setpoint│ MQTT pub   │
│ BMS data     │ (P1 — block) │ to PCS/BMS   │ SQLite log │
│ PCS data     │ Optimizer    │              │            │
│              │ (P2–P5)      │              │            │
└──────────────┴──────────────┴──────────────┴────────────┘
```

**Frequência**: 100ms por ciclo (10 Hz)

**Prioridade de decisão** (SAFETY sempre vence):
1. SAFETY — limites físicos, temperatura, tensão
2. GRID_CODE — regulação ONS, frequência
3. CONTRACTUAL — SLA com cliente, demanda contratada
4. ECONOMIC — arbitragem, peak shaving
5. LONGEVITY — proteção de vida útil da bateria

---

## Comunicação com BMS/PCS

### Modbus TCP (padrão)

```
Edge → Modbus TCP → PCS/BMS
Host: configurável (ex: 192.168.1.10)
Port: 502
Timeout: 3s
Retry: 3x antes de falha
```

Registros principais:

| Endereço | Tipo | Descrição |
|----------|------|-----------|
| 0x0000 | Holding | Setpoint de potência (kW × 10) |
| 0x0001 | Holding | Setpoint SOC alvo (%) |
| 0x0100 | Input | SOC atual (%) |
| 0x0101 | Input | Tensão do pack (V × 10) |
| 0x0102 | Input | Corrente (A × 10) |
| 0x0103 | Input | Temperatura máxima célula (°C × 10) |
| 0x0000 | Coil | Enable charge |
| 0x0001 | Coil | Enable discharge |
| 0x0002 | Coil | Emergency stop |

### Modbus RTU (alternativo)

Configuração via `/data/config/device.json`:
```json
{
  "modbus_config": {
    "type": "rtu",
    "port": "/dev/ttyUSB0",
    "baud": 19200,
    "parity": "N",
    "data_bits": 8,
    "stop_bits": 1
  }
}
```

---

## SQLite Buffer

Localização: `/data/telemetry/buffer.db`

Capacidade: **72h** de dados a 5s de intervalo = ~51.840 registros por sistema

Schema:
```sql
CREATE TABLE telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    system_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,  -- Unix ms
    payload TEXT NOT NULL,       -- JSON
    synced INTEGER DEFAULT 0     -- 0=pending, 1=synced
);
```

Dados são marcados como `synced=1` após confirmação do InfluxDB cloud.
Registros `synced=1` com mais de 7 dias são removidos automaticamente.

---

## Como Testar com Simulador de BMS

### Subir simulador local

```bash
# Via Docker Compose de testes
docker compose -f docker-compose.test.yml up bms-simulator

# Ou diretamente
python apps/edge/tests/bms_simulator.py --system-id test-bess-001 --soc 65
```

### Verificar control loop via debug API

```bash
# Heartbeat do edge
curl http://localhost:9090/test-bess-001/heartbeat

# Últimas 10 decisões
curl http://localhost:9090/test-bess-001/decisions?limit=10

# Buffer SQLite
curl http://localhost:9090/test-bess-001/buffer/count
```

### Simular falha de cloud

```bash
# Bloquear MQTT no firewall local (Linux)
sudo iptables -A OUTPUT -p tcp --dport 1883 -j DROP
sudo iptables -A OUTPUT -p tcp --dport 8883 -j DROP

# Verificar que edge entrou em AUTONOMOUS
curl http://localhost:9090/test-bess-001/heartbeat | jq .mode
# Deve retornar "AUTONOMOUS"

# Restaurar
sudo iptables -D OUTPUT -p tcp --dport 1883 -j DROP
sudo iptables -D OUTPUT -p tcp --dport 8883 -j DROP
```

---

## Watchdog

O edge controller possui dois níveis de watchdog:

### Software watchdog (systemd)
```ini
# /etc/systemd/system/lifo4-edge.service
[Service]
Restart=always
RestartSec=5
WatchdogSec=30
```

Se o processo não reportar healthcheck em 30s, systemd faz restart automático.

### Hardware watchdog (opcional — IPC industrial)
```bash
# Configurar watchdog do kernel
echo 10 > /dev/watchdog  # reset em 10s se não alimentado
```

O control loop alimenta o hardware watchdog a cada ciclo (100ms).
