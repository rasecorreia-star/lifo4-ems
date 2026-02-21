/**
 * BESS Mock Simulator for EMS Testing
 *
 * Simulates MULTIPLE BESS units (up to 9)
 * Each with: JK BMS + ANENJI Inverter + Grid Meter
 */

const mqtt = require('mqtt');
const express = require('express');
const cors = require('cors');
const path = require('path');

const JKBMS = require('./devices/jk-bms');
const AnenjiInverter = require('./devices/anenji-inverter');
const GridMeter = require('./devices/grid-meter');
const { getScenarios, getScenario } = require('./scenarios');

// Configuration
const CONFIG = {
  mqtt: {
    broker: process.env.MQTT_BROKER || 'mqtt://localhost:1883',
    clientId: 'mock-bess-simulator',
    topicPrefix: process.env.MQTT_TOPIC_PREFIX || 'lifo4',
  },
  http: {
    port: process.env.MOCK_PORT || 3002
  },
  simulation: {
    updateInterval: 1000,
    publishInterval: 2000
  }
};

// Define 9 BESS configurations
const BESS_CONFIGS = [
  { id: 'bess-001', name: 'BESS Teresina #01', site: 'Teresina', capacity: 200, soc: 85 },
  { id: 'bess-002', name: 'BESS Teresina #02', site: 'Teresina', capacity: 100, soc: 72 },
  { id: 'bess-003', name: 'BESS Parnaiba #01', site: 'Parnaiba', capacity: 200, soc: 45 },
  { id: 'bess-004', name: 'BESS Parnaiba #02', site: 'Parnaiba', capacity: 150, soc: 90 },
  { id: 'bess-005', name: 'BESS Picos #01', site: 'Picos', capacity: 200, soc: 30 },
  { id: 'bess-006', name: 'BESS Floriano #01', site: 'Floriano', capacity: 100, soc: 65 },
  { id: 'bess-007', name: 'BESS Piripiri #01', site: 'Piripiri', capacity: 200, soc: 55 },
  { id: 'bess-008', name: 'BESS Campo Maior #01', site: 'Campo Maior', capacity: 150, soc: 80 },
  { id: 'bess-009', name: 'BESS Oeiras #01', site: 'Oeiras', capacity: 100, soc: 40 },
];

// Store for all BESS units
const bessUnits = {};

// Initialize all BESS units
BESS_CONFIGS.forEach(config => {
  bessUnits[config.id] = {
    config,
    bms: new JKBMS({
      deviceId: config.id,
      nominalCapacity: config.capacity,
      initialSoc: config.soc
    }),
    inverter: new AnenjiInverter({
      deviceId: config.id,
      mode: 'SBU'
    }),
    gridMeter: new GridMeter({
      deviceId: config.id
    }),
    scenario: 'normal',
    enabled: true, // Can be enabled/disabled individually
    online: true
  };
});

// Global state
let simulationRunning = true;
let mqttClient = null;

// ============================================
// MQTT Setup
// ============================================

function connectMQTT() {
  console.log(`Connecting to MQTT broker: ${CONFIG.mqtt.broker}`);

  mqttClient = mqtt.connect(CONFIG.mqtt.broker, {
    clientId: CONFIG.mqtt.clientId,
    clean: true,
    connectTimeout: 4000,
    reconnectPeriod: 1000
  });

  mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');

    // Subscribe to command topics for all devices
    Object.keys(bessUnits).forEach(id => {
      const commandTopic = `${CONFIG.mqtt.topicPrefix}/${id}/command`;
      mqttClient.subscribe(commandTopic);
    });
  });

  mqttClient.on('message', (topic, message) => {
    try {
      const parts = topic.split('/');
      const deviceId = parts[1];
      const command = JSON.parse(message.toString());
      handleCommand(deviceId, command);
    } catch (e) {
      console.error('Failed to parse command:', e);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err);
  });
}

function publishTelemetry() {
  if (!mqttClient || !mqttClient.connected) return;

  const prefix = CONFIG.mqtt.topicPrefix;

  Object.entries(bessUnits).forEach(([id, unit]) => {
    if (!unit.enabled || !unit.online) return;

    // Publish BMS telemetry
    const bmsTelemetry = unit.bms.getTelemetry();
    mqttClient.publish(`${prefix}/${id}/telemetry`, JSON.stringify(bmsTelemetry), { qos: 1 });

    // Publish inverter telemetry
    const inverterTelemetry = unit.inverter.getTelemetry();
    mqttClient.publish(`${prefix}/${id}/inverter`, JSON.stringify(inverterTelemetry), { qos: 1 });

    // Publish grid meter telemetry
    const gridTelemetry = unit.gridMeter.getTelemetry();
    mqttClient.publish(`${prefix}/${id}/grid`, JSON.stringify(gridTelemetry), { qos: 1 });

    // Publish status
    mqttClient.publish(`${prefix}/${id}/status`, JSON.stringify({
      online: unit.online,
      firmware: '2.1.0',
      rssi: -45 + Math.floor(Math.random() * 10),
      scenario: unit.scenario
    }), { qos: 1 });
  });
}

function handleCommand(deviceId, command) {
  const unit = bessUnits[deviceId];
  if (!unit) return;

  console.log(`Command for ${deviceId}:`, command);

  switch (command.action) {
    case 'setScenario':
      setScenario(deviceId, command.scenario);
      break;
    case 'setSoc':
      unit.bms.setSoc(command.value);
      break;
    case 'setMode':
      unit.inverter.setMode(command.mode);
      break;
    case 'resetAlarms':
      unit.bms.resetAlarms();
      break;
    case 'setOnline':
      unit.online = command.value;
      break;
  }
}

// ============================================
// Simulation Loop
// ============================================

function runSimulation() {
  if (!simulationRunning) return;

  Object.values(bessUnits).forEach(unit => {
    if (!unit.enabled) return;

    // Update BMS
    unit.bms.update(unit.scenario, CONFIG.simulation.updateInterval);

    // Update inverter with BMS state
    const bmsState = unit.bms.getDetailedStatus();
    unit.inverter.update(unit.scenario, bmsState, CONFIG.simulation.updateInterval);

    // Update grid meter with inverter state
    const inverterState = unit.inverter.getTelemetry();
    unit.gridMeter.update(inverterState.grid.power, unit.scenario, CONFIG.simulation.updateInterval);
  });
}

function setScenario(deviceId, scenarioId) {
  const unit = bessUnits[deviceId];
  if (!unit) return false;

  const scenario = getScenario(scenarioId);
  if (scenario) {
    unit.scenario = scenarioId;
    console.log(`${deviceId} scenario changed to: ${scenario.name}`);

    if (scenario.initialState) {
      if (scenario.initialState.bms?.soc !== undefined) {
        unit.bms.setSoc(scenario.initialState.bms.soc);
      }
      if (scenario.initialState.inverter?.mode) {
        unit.inverter.setMode(scenario.initialState.inverter.mode);
      }
    }
    return true;
  }
  return false;
}

// Set scenario for ALL units
function setScenarioAll(scenarioId) {
  Object.keys(bessUnits).forEach(id => setScenario(id, scenarioId));
}

// ============================================
// HTTP API
// ============================================

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Get all BESS units
app.get('/api/devices', (req, res) => {
  const devices = Object.entries(bessUnits).map(([id, unit]) => ({
    id,
    name: unit.config.name,
    site: unit.config.site,
    capacity: unit.config.capacity,
    scenario: unit.scenario,
    enabled: unit.enabled,
    online: unit.online,
    soc: unit.bms.state.soc,
    power: unit.bms.state.current * unit.bms.state.cells.reduce((sum, v) => sum + v, 0)
  }));
  res.json({ success: true, data: devices });
});

// Get single BESS status
app.get('/api/devices/:deviceId', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  res.json({
    success: true,
    data: {
      id: req.params.deviceId,
      config: unit.config,
      scenario: unit.scenario,
      enabled: unit.enabled,
      online: unit.online,
      bms: unit.bms.getDetailedStatus(),
      inverter: unit.inverter.getDetailedStatus(),
      grid: unit.gridMeter.getDetailedStatus()
    }
  });
});

// Set scenario for single device
app.post('/api/devices/:deviceId/scenario', (req, res) => {
  const { scenario } = req.body;
  if (setScenario(req.params.deviceId, scenario)) {
    res.json({ success: true, data: { scenario } });
  } else {
    res.status(400).json({ success: false, error: 'Invalid scenario or device' });
  }
});

// Toggle device online/offline
app.post('/api/devices/:deviceId/online', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  unit.online = req.body.online !== false;
  res.json({ success: true, data: { online: unit.online } });
});

// Toggle device enabled/disabled
app.post('/api/devices/:deviceId/enabled', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  unit.enabled = req.body.enabled !== false;
  res.json({ success: true, data: { enabled: unit.enabled } });
});

// Set SOC for device
app.post('/api/devices/:deviceId/soc', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  unit.bms.setSoc(req.body.soc);
  res.json({ success: true });
});

// Set current/power for device
app.post('/api/devices/:deviceId/current', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  unit.bms.state.current = parseFloat(req.body.current) || 0;
  res.json({ success: true, data: { current: unit.bms.state.current } });
});

// Set temperature for device
app.post('/api/devices/:deviceId/temperature', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  const temp = parseFloat(req.body.temperature) || 25;
  unit.bms.state.temps = unit.bms.state.temps.map(() => temp + (Math.random() - 0.5) * 2);
  unit.bms.state.tempMosfet = temp + 5 + Math.random() * 2;
  res.json({ success: true, data: { temperature: temp } });
});

// Set cell voltages for device
app.post('/api/devices/:deviceId/voltage', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  const cellVoltage = parseFloat(req.body.cellVoltage) || 3.2;
  unit.bms.state.cells = unit.bms.state.cells.map(() => cellVoltage + (Math.random() - 0.5) * 0.01);
  res.json({ success: true, data: { cellVoltage } });
});

// Trigger alarm for device
app.post('/api/devices/:deviceId/alarm', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  const { alarm, active } = req.body;
  if (unit.bms.state.alarms.hasOwnProperty(alarm)) {
    // Set manual alarm (persists until reset)
    unit.bms.state.manualAlarms[alarm] = active !== false;
    unit.bms.state.alarms[alarm] = active !== false;
    console.log(`[ALARM] ${req.params.deviceId}: ${alarm} = ${active}`);
    res.json({ success: true, data: { alarm, active: unit.bms.state.alarms[alarm] } });
  } else {
    res.status(400).json({ success: false, error: 'Invalid alarm type' });
  }
});

// Reset alarms for device
app.post('/api/devices/:deviceId/reset-alarms', (req, res) => {
  const unit = bessUnits[req.params.deviceId];
  if (!unit) {
    return res.status(404).json({ success: false, error: 'Device not found' });
  }
  unit.bms.resetAlarms();
  res.json({ success: true });
});

// Get available scenarios
app.get('/api/scenarios', (req, res) => {
  res.json({ success: true, data: getScenarios() });
});

// Set scenario for ALL devices
app.post('/api/scenario/all', (req, res) => {
  const { scenario } = req.body;
  setScenarioAll(scenario);
  res.json({ success: true, data: { scenario } });
});

// Legacy endpoints (for backwards compatibility)
app.get('/api/status', (req, res) => {
  // Return first device as default
  const firstUnit = Object.values(bessUnits)[0];
  res.json({
    success: true,
    data: {
      scenario: firstUnit.scenario,
      scenarioName: getScenario(firstUnit.scenario).name,
      bms: firstUnit.bms.getDetailedStatus(),
      inverter: firstUnit.inverter.getDetailedStatus(),
      grid: firstUnit.gridMeter.getDetailedStatus(),
      mqtt: {
        connected: mqttClient?.connected || false,
        broker: CONFIG.mqtt.broker
      },
      // Also include count of all devices
      totalDevices: Object.keys(bessUnits).length,
      onlineDevices: Object.values(bessUnits).filter(u => u.online).length
    }
  });
});

app.get('/api/scenario', (req, res) => {
  const firstUnit = Object.values(bessUnits)[0];
  res.json({
    success: true,
    data: {
      current: firstUnit.scenario,
      ...getScenario(firstUnit.scenario)
    }
  });
});

app.post('/api/scenario', (req, res) => {
  const { scenario } = req.body;
  setScenarioAll(scenario);
  res.json({ success: true, data: { scenario } });
});

app.get('/api/bms', (req, res) => {
  const firstUnit = Object.values(bessUnits)[0];
  res.json({ success: true, data: firstUnit.bms.getDetailedStatus() });
});

app.get('/api/inverter', (req, res) => {
  const firstUnit = Object.values(bessUnits)[0];
  res.json({ success: true, data: firstUnit.inverter.getDetailedStatus() });
});

app.get('/api/grid', (req, res) => {
  const firstUnit = Object.values(bessUnits)[0];
  res.json({ success: true, data: firstUnit.gridMeter.getDetailedStatus() });
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    simulation: simulationRunning,
    mqtt: mqttClient?.connected || false,
    devices: Object.keys(bessUnits).length,
    online: Object.values(bessUnits).filter(u => u.online).length
  });
});

// ============================================
// Start Server
// ============================================

function start() {
  connectMQTT();

  setInterval(runSimulation, CONFIG.simulation.updateInterval);
  setInterval(publishTelemetry, CONFIG.simulation.publishInterval);

  app.listen(CONFIG.http.port, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔋 BESS Mock Simulator - MULTI-DEVICE                       ║
║                                                               ║
║   HTTP API:  http://localhost:${CONFIG.http.port}                        ║
║   MQTT:      ${CONFIG.mqtt.broker.padEnd(35)}       ║
║                                                               ║
║   Simulating ${Object.keys(bessUnits).length} BESS units:                                  ║
${Object.entries(bessUnits).map(([id, u]) =>
`║     • ${u.config.name.padEnd(25)} (${u.config.capacity}Ah)       ║`
).join('\n')}
║                                                               ║
║   Endpoints:                                                  ║
║   GET  /api/devices          - List all BESS units            ║
║   GET  /api/devices/:id      - Single BESS status             ║
║   POST /api/devices/:id/scenario - Set scenario               ║
║   POST /api/scenario/all     - Set scenario for ALL           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
  });
}

start();
