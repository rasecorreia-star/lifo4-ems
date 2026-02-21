# LIFO4 EMS - API Endpoints Documentation

**Base URL**: `http://localhost:3001/api/v1`

---

## 📊 OPTIMIZATION ENDPOINTS (`/optimization`)

### 1. Unified Decision Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/decision` | Make a single decision based on system state |
| `POST` | `/decision/batch` | Make decisions for multiple systems simultaneously |
| `GET` | `/decision/priority/:priority` | Get information about a priority level |
| `GET` | `/config/default` | Get default system constraints and configuration |

**Example Request** (`POST /decision`):
```json
{
  "systemId": "bess-001",
  "telemetry": {
    "soc": 65,
    "soh": 98,
    "temperature": 32,
    "voltage": 800,
    "current": 150,
    "power": 120
  },
  "gridState": {
    "frequency": 59.8,
    "voltage": 380,
    "gridConnected": true
  },
  "marketData": {
    "spotPrice": 350,
    "timePrice": 0.65,
    "demandForecast": 450,
    "loadProfile": "peak"
  }
}
```

---

### 2. Arbitrage (Energy Trading)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/arbitrage/evaluate` | Evaluate arbitrage opportunity |
| `POST` | `/arbitrage/revenue` | Calculate expected revenue |
| `GET` | `/arbitrage/market-signal` | Get market signal strength (0-1) |
| `POST` | `/arbitrage/strategy` | Get recommended buy/sell strategy |

**Example Request** (`POST /arbitrage/evaluate`):
```json
{
  "telemetry": { "soc": 45, "soh": 95 },
  "marketData": { "spotPrice": 280 },
  "historicalPrices": { "low": 250, "high": 500 }
}
```

---

### 3. Peak Shaving (Demand Management)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/peak-shaving/evaluate` | Evaluate if peak shaving is needed |
| `POST` | `/peak-shaving/demand-charge-savings` | Calculate demand charge savings |
| `POST` | `/peak-shaving/compliance` | Calculate DR compliance rate |
| `POST` | `/peak-shaving/roi` | Calculate ROI of investment |
| `GET` | `/peak-shaving/tariff` | Get tariff info for current hour |

**Example Request** (`POST /peak-shaving/evaluate`):
```json
{
  "telemetry": { "soc": 75 },
  "marketData": { "demandForecast": 520 },
  "currentHour": 18
}
```

---

### 4. Grid Services (Integration & VPP)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/grid-services/select-mode` | Select optimal control mode |
| `GET` | `/grid-services/current-mode` | Get current control mode |
| `POST` | `/grid-services/demand-response` | Process DR event |
| `POST` | `/grid-services/demand-response/compliance` | Calculate DR compliance |
| `GET` | `/grid-services/vpp` | Get VPP aggregated state |
| `POST` | `/grid-services/vpp/register` | Register as VPP participant |
| `POST` | `/grid-services/vpp/dispatch` | Coordinate VPP dispatch |
| `GET` | `/grid-services/tariff` | Get tariff schedule |
| `POST` | `/grid-services/load-shedding` | Calculate load shedding |

**Control Modes**:
- `grid_following` - Standard grid-connected operation
- `grid_forming` - Creates voltage/frequency reference
- `islanding` - Independent operation
- `black_start` - Grid restoration support
- `synchronizing` - Synchronizing after islanding

---

### 5. Black Start (Grid Restoration)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/grid-services/black-start/process` | Process blackout FSM |
| `GET` | `/grid-services/black-start/state-history` | Get FSM transition history |
| `POST` | `/grid-services/black-start/island-duration` | Estimate island mode duration |
| `POST` | `/grid-services/black-start/capability` | Check black start capability |
| `POST` | `/grid-services/black-start/restoration-time` | Estimate restoration time |
| `GET` | `/grid-services/black-start/fsm-states` | Get available FSM states |
| `POST` | `/grid-services/black-start/reset` | Reset FSM to initial state |

**FSM States**:
```
grid_connected → blackout_detected → transferring → island_mode → synchronizing → resynchronized → grid_connected
```

---

## 🤖 MACHINE LEARNING ENDPOINTS (`/ml`)

### 1. Forecasting (5 ML Models)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/forecasting/ensemble` | Get 24-hour ensemble forecast |
| `GET` | `/forecasting/models` | Get available models & metrics |
| `POST` | `/forecasting/compare` | Compare multiple model predictions |
| `GET` | `/forecasting/model/:modelName` | Get specific model info |
| `POST` | `/forecasting/uncertainty` | Get uncertainty bounds |

**Available Models**:
- Ensemble: 94.5% accuracy
- LSTM: 92.8% accuracy
- XGBoost: 93.1% accuracy
- Prophet: 91.2% accuracy
- ARIMA: 88.5% accuracy

**Example Request** (`GET /forecasting/ensemble?currentHour=12&solarCapacity=100`):
Returns 24-hour forecast with demand, price, and solar predictions.

---

### 2. Battery Health (SOH Monitoring)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/battery-health/calculate-soh` | Calculate current SOH |
| `POST` | `/battery-health/estimate-degradation` | Estimate degradation |
| `POST` | `/battery-health/remaining-life` | Estimate RUL (Remaining Useful Life) |
| `POST` | `/battery-health/report` | Generate comprehensive health report |
| `GET` | `/battery-health/warranty/:systemId` | Check warranty status |
| `POST` | `/battery-health/cost-of-degradation` | Calculate degradation cost |

**Example Request** (`POST /battery-health/calculate-soh`):
```json
{
  "currentCapacity": 485,
  "nominalCapacity": 500
}
```

---

### 3. Predictive Maintenance (Failure Prediction)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/maintenance/evaluate-component` | Evaluate component health |
| `POST` | `/maintenance/recommendation` | Get maintenance recommendation |
| `POST` | `/maintenance/predict-failure` | Predict failure probability |
| `GET` | `/maintenance/models/metrics` | Get ML model metrics (94.2% accuracy) |
| `POST` | `/maintenance/cost-comparison` | Compare preventive vs reactive costs |
| `GET` | `/maintenance/components` | Get trackable component types |

**Component Types**:
- battery_pack
- bms (Battery Management System)
- inverter
- cooling_system
- electrical
- mechanical

**Example Request** (`POST /maintenance/evaluate-component`):
```json
{
  "componentType": "battery_pack",
  "metrics": {
    "soh": 92,
    "temperature": 35,
    "cellVoltageImbalance": 45
  }
}
```

---

## 🔑 Response Format

All endpoints return standardized JSON responses:

### Success Response
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "timestamp": "2026-02-21T15:30:00Z"
}
```

### Error Response
```json
{
  "error": "Error message describing what went wrong"
}
```

---

## 📈 Summary Statistics

- **Total Endpoints**: 50+
- **Controllers**: 8
- **Services**: 8
- **Shared Types**: 16+
- **Lines of Code**: 4,500+

---

## 🚀 Integration Examples

### Example 1: Make a Decision
```bash
curl -X POST http://localhost:3001/api/v1/optimization/decision \
  -H "Content-Type: application/json" \
  -d @decision-payload.json
```

### Example 2: Get Forecast
```bash
curl http://localhost:3001/api/v1/ml/forecasting/ensemble?currentHour=14&solarCapacity=100
```

### Example 3: Check Battery Health
```bash
curl -X POST http://localhost:3001/api/v1/ml/battery-health/calculate-soh \
  -H "Content-Type: application/json" \
  -d '{"currentCapacity": 485, "nominalCapacity": 500}'
```

---

## 📚 Authentication

*(To be implemented in next phase)*

All endpoints will require Bearer token authentication:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format
- All monetary values are in Brazilian Real (R$)
- Power values in kW, energy in kWh
- SOC/SOH as percentages (0-100)
- Temperature in Celsius (°C)
- Frequency in Hz, Voltage in V
