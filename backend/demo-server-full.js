const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const http = require('http');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'demo-secret-key-lifo4-ems';
const PORT = process.env.PORT || 3001;
const MOCK_BESS_URL = process.env.MOCK_BESS_URL || 'http://localhost:3002';

// Helper to fetch from mock-bess (GET)
async function fetchFromMock(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MOCK_BESS_URL);
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

// Helper to post to mock-bess (POST)
async function postToMock(path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, MOCK_BESS_URL);
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      port: url.port || 3002,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ success: true });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// Router com prefixo /api/v1
const router = express.Router();

// Demo user com todas as permissoes
const demoUser = {
  id: 'demo-user-001',
  email: 'demo@lifo4.com.br',
  name: 'Usuario Demo',
  role: 'super_admin',
  organizationId: 'org-001',
  permissions: ['all']
};

// Helper to create full system object
const createSystem = (id, name, model, serial, status, connStatus, soc, soh, power, capacity, siteId, lat, lng) => ({
  id, name, model, serialNumber: serial, status, connectionStatus: connStatus,
  soc, soh, power, capacity, siteId,
  location: { lat, lng },
  organizationId: 'org-001',
  manufacturer: 'Lifo4 Energy',
  installationDate: '2024-01-15T00:00:00Z',
  warrantyExpiration: '2034-01-15T00:00:00Z',
  deviceId: id,
  mqttTopic: `lifo4/${id}/telemetry`,
  firmwareVersion: '2.1.0',
  operationMode: status === 'charging' ? 'charge' : status === 'discharging' ? 'discharge' : 'standby',
  isActive: connStatus === 'online',
  createdAt: '2024-01-15T00:00:00Z',
  updatedAt: new Date().toISOString(),
  batterySpec: {
    chemistry: 'LiFePO4',
    nominalCapacity: capacity,
    nominalVoltage: 51.2,
    energyCapacity: capacity,
    cellCount: 16,
    cellsInParallel: 4,
    maxChargeCurrent: 100,
    maxDischargeCurrent: 100,
    minCellVoltage: 2.5,
    maxCellVoltage: 3.65,
    minTemperature: 0,
    maxTemperature: 55
  }
});

// Demo data - 9 BESS (igual ao mock-bess)
const systems = [
  createSystem('bess-001', 'BESS Teresina #01', 'Lifo4 200kWh', 'LF4-2024-001', 'charging', 'online', 85, 98, 25000, 200, 'site-001', -5.0892, -42.8019),
  createSystem('bess-002', 'BESS Teresina #02', 'Lifo4 100kWh', 'LF4-2024-002', 'discharging', 'online', 72, 99, -15000, 100, 'site-001', -5.0895, -42.8025),
  createSystem('bess-003', 'BESS Parnaiba #01', 'Lifo4 200kWh', 'LF4-2024-003', 'discharging', 'online', 45, 97, -30000, 200, 'site-002', -2.9055, -41.7769),
  createSystem('bess-004', 'BESS Parnaiba #02', 'Lifo4 150kWh', 'LF4-2024-004', 'charging', 'online', 90, 99, 20000, 150, 'site-002', -2.9060, -41.7775),
  createSystem('bess-005', 'BESS Picos #01', 'Lifo4 200kWh', 'LF4-2024-005', 'idle', 'online', 30, 96, 0, 200, 'site-003', -7.0769, -41.4669),
  createSystem('bess-006', 'BESS Floriano #01', 'Lifo4 100kWh', 'LF4-2024-006', 'charging', 'online', 65, 98, 15000, 100, 'site-004', -6.7669, -43.0225),
  createSystem('bess-007', 'BESS Piripiri #01', 'Lifo4 200kWh', 'LF4-2024-007', 'discharging', 'online', 55, 97, -25000, 200, 'site-005', -4.2731, -41.7769),
  createSystem('bess-008', 'BESS Campo Maior #01', 'Lifo4 150kWh', 'LF4-2024-008', 'offline', 'offline', 80, 95, 0, 150, 'site-006', -4.8269, -42.1689),
  createSystem('bess-009', 'BESS Oeiras #01', 'Lifo4 100kWh', 'LF4-2024-009', 'idle', 'online', 40, 98, 0, 100, 'site-007', -7.0169, -42.1289)
];

const evChargers = [
  {
    id: 'charger-001',
    name: 'Carregador Estacionamento A1',
    model: 'ABB Terra 54',
    manufacturer: 'ABB',
    serialNumber: 'ABB-54-001',
    ocppVersion: '1.6',
    status: 'charging',
    connectors: [
      { id: 'conn-1', connectorId: 1, type: 'CCS2', maxPowerKw: 50, status: 'occupied', currentPowerKw: 45.5 },
      { id: 'conn-2', connectorId: 2, type: 'CHAdeMO', maxPowerKw: 50, status: 'available' }
    ],
    location: { address: 'Av. Paulista, 1000', latitude: -23.5629, longitude: -46.6544 },
    lastHeartbeat: new Date(Date.now() - 30000).toISOString(),
    firmwareVersion: '2.1.0',
    totalEnergyKwh: 15420,
    totalSessions: 1250,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'charger-002',
    name: 'Carregador Entrada Principal',
    model: 'Wallbox Pulsar Plus',
    manufacturer: 'Wallbox',
    serialNumber: 'WB-PP-002',
    ocppVersion: '1.6',
    status: 'available',
    connectors: [
      { id: 'conn-3', connectorId: 1, type: 'Type2', maxPowerKw: 22, status: 'available' }
    ],
    location: { address: 'Rua Augusta, 500', latitude: -23.5519, longitude: -46.6527 },
    lastHeartbeat: new Date(Date.now() - 15000).toISOString(),
    firmwareVersion: '5.6.1',
    totalEnergyKwh: 8750,
    totalSessions: 890,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'charger-003',
    name: 'Carregador Rapido B1',
    model: 'Tritium RTM 75',
    manufacturer: 'Tritium',
    serialNumber: 'TRI-75-003',
    ocppVersion: '2.0.1',
    status: 'faulted',
    connectors: [
      { id: 'conn-4', connectorId: 1, type: 'CCS2', maxPowerKw: 75, status: 'faulted' }
    ],
    location: { address: 'Av. Faria Lima, 2000', latitude: -23.5874, longitude: -46.6789 },
    lastHeartbeat: new Date(Date.now() - 3600000).toISOString(),
    firmwareVersion: '3.0.5',
    totalEnergyKwh: 22100,
    totalSessions: 1890,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'charger-004',
    name: 'Carregador Tesla Supercharger',
    model: 'Tesla Supercharger V3',
    manufacturer: 'Tesla',
    serialNumber: 'TSL-V3-004',
    ocppVersion: '2.0.1',
    status: 'charging',
    connectors: [
      { id: 'conn-5', connectorId: 1, type: 'Tesla', maxPowerKw: 250, status: 'occupied', currentPowerKw: 187.2 }
    ],
    location: { address: 'Shopping Iguatemi', latitude: -23.5789, longitude: -46.6891 },
    lastHeartbeat: new Date(Date.now() - 10000).toISOString(),
    firmwareVersion: '2024.8.1',
    totalEnergyKwh: 45200,
    totalSessions: 3200,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'charger-005',
    name: 'Carregador Residencial',
    model: 'ChargePoint Home Flex',
    manufacturer: 'ChargePoint',
    serialNumber: 'CP-HF-005',
    ocppVersion: '1.6',
    status: 'offline',
    connectors: [
      { id: 'conn-6', connectorId: 1, type: 'Type1', maxPowerKw: 11.5, status: 'unavailable' }
    ],
    location: { address: 'Rua das Flores, 100', latitude: -23.5412, longitude: -46.6234 },
    lastHeartbeat: new Date(Date.now() - 86400000).toISOString(),
    firmwareVersion: '1.8.2',
    totalEnergyKwh: 3200,
    totalSessions: 456,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'charger-006',
    name: 'Carregador Estacionamento B2',
    model: 'EVBox Troniq 100',
    manufacturer: 'EVBox',
    serialNumber: 'EVB-T100-006',
    ocppVersion: '2.0.1',
    status: 'available',
    connectors: [
      { id: 'conn-7', connectorId: 1, type: 'CCS2', maxPowerKw: 100, status: 'available' },
      { id: 'conn-8', connectorId: 2, type: 'CCS2', maxPowerKw: 100, status: 'available' }
    ],
    location: { address: 'Av. Brasil, 3000', latitude: -23.5678, longitude: -46.7012 },
    lastHeartbeat: new Date(Date.now() - 20000).toISOString(),
    firmwareVersion: '4.2.0',
    totalEnergyKwh: 28900,
    totalSessions: 2100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

const cameras = [
  { id: 'cam-001', name: 'Camera Entrada', status: 'online', type: 'ptz', siteId: 'site-001' },
  { id: 'cam-002', name: 'Camera BESS', status: 'online', type: 'fixed', siteId: 'site-001' },
  { id: 'cam-003', name: 'Camera Estacionamento', status: 'online', type: 'ptz', siteId: 'site-002' }
];

const microgrids = [
  { id: 'mg-001', name: 'Microgrid Site 1', operatingMode: 'grid_connected', gridConnected: true, siteId: 'site-001' },
  { id: 'mg-002', name: 'Microgrid Site 2', operatingMode: 'grid_connected', gridConnected: true, siteId: 'site-002' }
];

const prospects = [
  { id: 'prospect-001', name: 'Empresa ABC', contactName: 'Joao Silva', email: 'joao@abc.com', stage: 'analysis', estimatedDemand: 100 },
  { id: 'prospect-002', name: 'Industria XYZ', contactName: 'Maria Santos', email: 'maria@xyz.com', stage: 'proposal', estimatedDemand: 250 },
  { id: 'prospect-003', name: 'Comercio 123', contactName: 'Pedro Costa', email: 'pedro@123.com', stage: 'negotiation', estimatedDemand: 50 }
];

const alerts = [
  { id: 'alert-001', systemId: 'sys-001', organizationId: 'org-001', type: 'temperature', severity: 'warning', title: 'Temperatura Elevada', message: 'Temperatura elevada no modulo 1', isRead: false, isAcknowledged: false, createdAt: new Date().toISOString() },
  { id: 'alert-002', systemId: 'sys-002', organizationId: 'org-001', type: 'maintenance', severity: 'low', title: 'Balanceamento Concluido', message: 'Balanceamento de celulas concluido com sucesso', isRead: true, isAcknowledged: true, createdAt: new Date(Date.now() - 3600000).toISOString() }
];

const users = [
  { id: 'user-001', name: 'Admin Demo', email: 'admin@lifo4.com.br', role: 'super_admin', status: 'active' },
  { id: 'user-002', name: 'Operador 1', email: 'op1@lifo4.com.br', role: 'operator', status: 'active' }
];

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } }); }
};

const paginate = (data) => ({ success: true, data, pagination: { page: 1, limit: 20, total: data.length } });

// AUTH
router.post('/auth/login', (req, res) => {
  const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, data: { user: demoUser, tokens: { accessToken: token, refreshToken: token, expiresIn: 86400 } } });
});
// Dev login (same as login for demo mode)
router.post('/auth/dev-login', (req, res) => {
  const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, data: { user: demoUser, tokens: { accessToken: token, refreshToken: token, expiresIn: 86400 } } });
});
router.post('/auth/register', (req, res) => res.json({ success: true, data: {} }));
router.post('/auth/logout', (req, res) => res.json({ success: true }));
router.post('/auth/refresh', (req, res) => {
  const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, data: { accessToken: token, expiresIn: 86400 } });
});
router.get('/auth/me', auth, (req, res) => res.json({ success: true, data: demoUser }));
router.post('/auth/change-password', auth, (req, res) => res.json({ success: true }));
router.post('/auth/2fa/setup', auth, (req, res) => res.json({ success: true, data: { secret: 'DEMO', qrCode: '' } }));
router.post('/auth/2fa/verify', auth, (req, res) => res.json({ success: true }));
router.post('/auth/2fa/disable', auth, (req, res) => res.json({ success: true }));

// SYSTEMS - Fetch from Mock BESS when available
router.get('/systems', auth, async (req, res) => {
  try {
    const mockData = await fetchFromMock('/api/devices');
    if (mockData.success && mockData.data) {
      // Merge mock data with full system structure
      const enrichedSystems = mockData.data.map(device => {
        const baseSystem = systems.find(s => s.id === device.id) || systems[0];
        return {
          ...baseSystem,
          soc: device.soc,
          power: device.power,
          status: device.power > 0 ? 'charging' : device.power < 0 ? 'discharging' : 'idle',
          connectionStatus: device.online ? 'online' : 'offline',
          isActive: device.online
        };
      });
      return res.json(paginate(enrichedSystems));
    }
  } catch (e) {
    console.log('Mock BESS not available, using static data');
  }
  res.json(paginate(systems));
});
router.get('/systems/overview', auth, async (req, res) => {
  try {
    const mockData = await fetchFromMock('/api/devices');
    if (mockData.success && mockData.data) {
      const online = mockData.data.filter(d => d.online).length;
      return res.json({ success: true, data: { total: mockData.data.length, online } });
    }
  } catch (e) {}
  res.json({ success: true, data: { total: 9, online: 8 } });
});
router.get('/systems/:id', auth, async (req, res) => {
  try {
    const mockData = await fetchFromMock(`/api/devices/${req.params.id}`);
    if (mockData.success && mockData.data) {
      const device = mockData.data;
      const baseSystem = systems.find(s => s.id === req.params.id) || systems[0];
      const enriched = {
        ...baseSystem,
        id: device.id,
        soc: device.bms?.soc || device.soc || baseSystem.soc,
        soh: device.bms?.soh || baseSystem.soh,
        power: device.bms?.power || 0,
        status: (device.bms?.current || 0) > 0 ? 'charging' : (device.bms?.current || 0) < 0 ? 'discharging' : 'idle',
        connectionStatus: device.online ? 'online' : 'offline',
        isActive: device.online
      };
      return res.json({ success: true, data: enriched });
    }
  } catch (e) {
    console.log('Mock BESS not available for device:', req.params.id);
  }
  res.json({ success: true, data: systems.find(s => s.id === req.params.id) || systems[0] });
});
router.post('/systems', auth, (req, res) => {
  const id = `bess-${String(systems.length + 1).padStart(3, '0')}`;
  const newSystem = {
    id,
    name: req.body.name || 'Novo Sistema',
    model: req.body.model || 'Lifo4 Custom',
    serialNumber: `LF4-${Date.now()}`,
    status: 'offline',
    connectionStatus: 'offline',
    soc: 0,
    soh: 100,
    power: 0,
    capacity: req.body.capacity || 100,
    siteId: `site-${String(systems.length + 1).padStart(3, '0')}`,
    location: req.body.location || { lat: -5.0892, lng: -42.8019 },
    organizationId: 'org-001',
    manufacturer: 'Lifo4 Energy',
    installationDate: new Date().toISOString(),
    warrantyExpiration: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    deviceId: id,
    mqttTopic: `lifo4/${id}/telemetry`,
    firmwareVersion: '1.0.0',
    operationMode: 'standby',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    batterySpec: req.body.batterySpec || {},
    bmsConfig: req.body.bmsConfig || {},
    inverterConfig: req.body.inverterConfig || {},
    ...req.body
  };
  systems.push(newSystem);
  console.log(`[SYSTEM] New system registered: ${id} - ${newSystem.name}`);
  res.json({ success: true, data: newSystem });
});
router.patch('/systems/:id', auth, (req, res) => res.json({ success: true, data: req.body }));
router.delete('/systems/:id', auth, (req, res) => res.json({ success: true }));
router.get('/systems/:id/protection', auth, (req, res) => res.json({ success: true, data: {} }));
router.patch('/systems/:id/protection', auth, (req, res) => res.json({ success: true, data: req.body }));

// TELEMETRY - Fetch from Mock BESS when available
router.get('/telemetry/:id/current', auth, async (req, res) => {
  try {
    const mockData = await fetchFromMock(`/api/devices/${req.params.id}`);
    if (mockData.success && mockData.data) {
      const device = mockData.data;
      const bms = device.bms || {};
      const inverter = device.inverter || {};
      const grid = device.grid || {};
      const baseSystem = systems.find(s => s.id === req.params.id) || systems[0];

      // Use BMS values directly
      const voltage = bms.voltage || 51.2;
      const current = bms.current || 0;
      const power = bms.power || (voltage * current);
      const soc = bms.soc || 0;

      // Temperature from BMS
      const temps = bms.temperatures || [];
      const tempValues = temps.map(t => t.value);
      const tempMin = bms.tempMin || Math.min(...tempValues, 25);
      const tempMax = bms.tempMax || Math.max(...tempValues, 35);
      const tempAvg = tempValues.length > 0 ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 28;

      return res.json({ success: true, data: {
        systemId: req.params.id,
        timestamp: new Date().toISOString(),
        // BMS Data
        soc: soc,
        soh: bms.soh || 98,
        totalVoltage: voltage,
        current: current,
        power: power,
        // Temperature
        temperature: {
          min: tempMin,
          max: tempMax,
          average: tempAvg
        },
        // Cells
        cells: (bms.cells || []).map((cell, i) => ({
          index: i,
          voltage: cell.voltage || 3.2,
          temperature: temps[Math.floor(i / 4)]?.value || 28,
          status: cell.isBalancing ? 'balancing' : 'normal',
          isBalancing: cell.isBalancing || false
        })),
        cellMin: bms.cellMin || 3.2,
        cellMax: bms.cellMax || 3.3,
        cellDiff: bms.cellDiff || 0.01,
        // Status
        isCharging: current > 0.5,
        isDischarging: current < -0.5,
        isBalancing: bms.balancingActive || false,
        chargingEnabled: bms.chargingEnabled !== false,
        dischargingEnabled: bms.dischargingEnabled !== false,
        // Counters
        cycleCount: bms.cycles || 127,
        energyRemaining: bms.energyRemaining || (soc / 100) * (bms.capacity || 200),
        chargeCapacity: bms.capacity || baseSystem.capacity,
        // Alarms & Warnings
        alarms: Object.entries(bms.alarms || {}).filter(([k, v]) => v).map(([k]) => k),
        warnings: Object.entries(bms.warnings || {}).filter(([k, v]) => v).map(([k]) => k),
        hasAlarm: bms.hasAlarm || false,
        hasWarning: bms.hasWarning || false,
        // Inverter Data (extra)
        inverter: {
          mode: inverter.mode || 'SBU',
          pvPower: inverter.pv?.power || 0,
          gridPower: inverter.grid?.power || 0,
          outputPower: inverter.output?.power || 0,
          batteryPower: inverter.battery?.power || 0,
          loadPercent: inverter.output?.loadPercent || 0
        },
        // Grid Data (extra)
        grid: {
          voltage: grid.voltage || 220,
          power: grid.power || 0,
          frequency: grid.frequency || 60,
          available: grid.gridAvailable !== false
        }
      }});
    }
  } catch (e) {
    console.log('Mock BESS telemetry not available:', req.params.id, e.message);
  }
  // Fallback to static data
  const system = systems.find(s => s.id === req.params.id) || systems[0];
  const isCharging = system.power > 0;
  const isDischarging = system.power < 0;
  res.json({ success: true, data: {
    systemId: req.params.id,
    timestamp: new Date().toISOString(),
    soc: system.soc,
    soh: system.soh,
    totalVoltage: 51.8,
    current: Math.abs(system.power / 51.2),
    power: system.power,
    temperature: { min: 25, max: 32, average: 28.5 },
    cells: Array.from({length: 16}, (_, i) => ({
      index: i,
      voltage: 3.20 + Math.random() * 0.1,
      temperature: 25 + Math.random() * 5,
      status: 'normal',
      isBalancing: false
    })),
    isCharging,
    isDischarging,
    isBalancing: false,
    cycleCount: 127,
    energyRemaining: (system.soc / 100) * system.capacity,
    chargeCapacity: system.capacity,
    alarms: [],
    warnings: []
  }});
});
router.get('/telemetry/:id/history', auth, (req, res) => {
  res.json({ success: true, data: Array.from({length: 24}, (_, i) => ({
    timestamp: new Date(Date.now() - i * 3600000).toISOString(), soc: 50 + Math.random() * 40, power: -20000 + Math.random() * 40000
  }))});
});
router.get('/telemetry/:id/cells', auth, (req, res) => res.json({ success: true, data: [] }));
router.get('/telemetry/:id/range', auth, (req, res) => res.json({ success: true, data: [] }));
router.get('/telemetry/:id/soc', auth, (req, res) => res.json({ success: true, data: [] }));
router.get('/telemetry/:id/energy', auth, (req, res) => res.json({ success: true, data: {} }));

// CONTROL - Proxy to Mock BESS
router.post('/control/command', auth, (req, res) => res.json({ success: true, data: {} }));
router.post('/control/:id/mode', auth, (req, res) => res.json({ success: true, data: {} }));
router.post('/control/:id/emergency-stop', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/scenario`, { scenario: 'normal' });
    await postToMock(`/api/devices/${req.params.id}/current`, { current: 0 });
  } catch (e) {}
  res.json({ success: true });
});
router.post('/control/:id/charge/start', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/scenario`, { scenario: 'solar-charging' });
  } catch (e) {}
  res.json({ success: true });
});
router.post('/control/:id/charge/stop', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/scenario`, { scenario: 'normal' });
  } catch (e) {}
  res.json({ success: true });
});
router.post('/control/:id/discharge/start', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/scenario`, { scenario: 'discharging' });
  } catch (e) {}
  res.json({ success: true });
});
router.post('/control/:id/discharge/stop', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/scenario`, { scenario: 'normal' });
  } catch (e) {}
  res.json({ success: true });
});
router.post('/control/:id/reset-alarms', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/reset-alarms`, {});
  } catch (e) {}
  res.json({ success: true });
});
router.post('/control/:id/balance/start', auth, (req, res) => res.json({ success: true }));
router.post('/control/:id/balance/stop', auth, (req, res) => res.json({ success: true }));
router.post('/control/:id/calibrate-soc', auth, (req, res) => res.json({ success: true }));
router.get('/control/:id/schedules', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/control/schedules', auth, (req, res) => res.json({ success: true, data: {} }));

// CONNECT/DISCONNECT - Proxy to Mock BESS
router.post('/control/:id/connect', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/online`, { online: true });
    res.json({ success: true, data: { online: true } });
  } catch (e) {
    res.json({ success: true, data: { online: true } }); // Fallback
  }
});
router.post('/control/:id/disconnect', auth, async (req, res) => {
  try {
    await postToMock(`/api/devices/${req.params.id}/online`, { online: false });
    res.json({ success: true, data: { online: false } });
  } catch (e) {
    res.json({ success: true, data: { online: false } }); // Fallback
  }
});

// ALERTS
router.get('/alerts', auth, (req, res) => res.json(paginate(alerts)));
router.get('/alerts/summary', auth, (req, res) => res.json({ success: true, data: { total: 2, critical: 0, high: 0, medium: 1, low: 1, unread: 1, unacknowledged: 1 } }));
router.get('/alerts/unread-count', auth, (req, res) => res.json({ success: true, data: { count: 1 } }));
router.get('/alerts/stats', auth, (req, res) => res.json({ success: true, data: { critical: 0, warning: 1, info: 1 } }));
router.get('/alerts/:id', auth, (req, res) => res.json({ success: true, data: alerts[0] }));
router.post('/alerts/:id/acknowledge', auth, (req, res) => res.json({ success: true }));

// EV CHARGERS
router.get('/ev-chargers', auth, (req, res) => res.json(paginate(evChargers)));
router.get('/ev-chargers/:id', auth, (req, res) => res.json({ success: true, data: evChargers[0] }));
router.get('/ev-chargers/:id/status', auth, (req, res) => res.json({ success: true, data: { status: 'available' } }));
router.post('/ev-chargers/:id/start', auth, (req, res) => res.json({ success: true }));
router.post('/ev-chargers/:id/stop', auth, (req, res) => res.json({ success: true }));
router.get('/ev-chargers/sessions/active', auth, (req, res) => res.json({ success: true, data: [] }));

// CAMERAS
router.get('/cameras', auth, (req, res) => res.json(paginate(cameras)));
router.get('/cameras/:id', auth, (req, res) => res.json({ success: true, data: cameras[0] }));
router.get('/cameras/:id/stream', auth, (req, res) => res.json({ success: true, data: { streamUrl: '', hlsUrl: '' } }));
router.post('/cameras/:id/ptz', auth, (req, res) => res.json({ success: true }));
router.post('/cameras/:id/snapshot', auth, (req, res) => res.json({ success: true, data: {} }));
router.get('/cameras/:id/events', auth, (req, res) => res.json({ success: true, data: [] }));

// MICROGRIDS
router.get('/microgrids', auth, (req, res) => res.json(paginate(microgrids)));
router.get('/microgrids/:id', auth, (req, res) => res.json({ success: true, data: microgrids[0] }));
router.get('/microgrids/:id/status', auth, (req, res) => res.json({ success: true, data: {} }));
router.post('/microgrids/:id/mode', auth, (req, res) => res.json({ success: true }));
router.post('/microgrids/:id/island', auth, (req, res) => res.json({ success: true }));
router.post('/microgrids/:id/blackstart', auth, (req, res) => res.json({ success: true }));

// PROSPECTS
router.get('/prospects', auth, (req, res) => res.json(paginate(prospects)));
router.get('/prospects/:id', auth, (req, res) => res.json({ success: true, data: prospects[0] }));
router.post('/prospects', auth, (req, res) => res.json({ success: true, data: {} }));
router.patch('/prospects/:id', auth, (req, res) => res.json({ success: true, data: {} }));
router.delete('/prospects/:id', auth, (req, res) => res.json({ success: true }));
router.get('/prospects/:id/analysis', auth, (req, res) => res.json({ success: true, data: {} }));
router.get('/prospects/:id/recommendations', auth, (req, res) => res.json({ success: true, data: { recommendations: [] } }));

// USERS
router.get('/users', auth, (req, res) => res.json(paginate(users)));
router.get('/users/:id', auth, (req, res) => res.json({ success: true, data: users[0] }));
router.post('/users', auth, (req, res) => res.json({ success: true, data: {} }));
router.patch('/users/:id', auth, (req, res) => res.json({ success: true, data: {} }));
router.delete('/users/:id', auth, (req, res) => res.json({ success: true }));

// SITES
router.get('/sites', auth, (req, res) => res.json({ success: true, data: [{ id: 'site-001', name: 'Site Principal' }] }));
router.get('/sites/:id', auth, (req, res) => res.json({ success: true, data: { id: 'site-001', name: 'Site Principal' } }));

// ORGANIZATIONS
router.get('/organizations', auth, (req, res) => res.json({ success: true, data: [{ id: 'org-001', name: 'Lifo4 Energia' }] }));
router.get('/organizations/:id', auth, (req, res) => res.json({ success: true, data: { id: 'org-001', name: 'Lifo4 Energia' } }));

// REPORTS
router.get('/reports', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/reports/generate', auth, (req, res) => res.json({ success: true, data: { reportId: 'rpt-001' } }));
router.get('/reports/:id', auth, (req, res) => res.json({ success: true, data: {} }));

// DASHBOARD
router.get('/dashboard/stats', auth, (req, res) => res.json({ success: true, data: {
  totalSystems: 3, onlineSystems: 3, totalCapacity: 350, currentPower: 10000, todayEnergy: 245.5,
  alerts: { critical: 0, warning: 1, info: 1 }
}}));
router.get('/dashboard/overview', auth, (req, res) => res.json({ success: true, data: {} }));

// SETTINGS
router.get('/settings', auth, (req, res) => res.json({ success: true, data: {} }));
router.patch('/settings', auth, (req, res) => res.json({ success: true, data: {} }));
router.get('/settings/notifications', auth, (req, res) => res.json({ success: true, data: {} }));
router.patch('/settings/notifications', auth, (req, res) => res.json({ success: true, data: {} }));

// AUDIT
router.get('/audit-logs', auth, (req, res) => res.json({ success: true, data: [] }));

// BMS CONFIG
router.get('/bms-config', auth, (req, res) => res.json({ success: true, data: [] }));
router.get('/bms-config/:id', auth, (req, res) => res.json({ success: true, data: {} }));
router.patch('/bms-config/:id', auth, (req, res) => res.json({ success: true, data: {} }));

// FLEET
router.get('/fleet', auth, (req, res) => res.json({ success: true, data: systems }));
router.get('/fleet/stats', auth, (req, res) => res.json({ success: true, data: {} }));

// OPTIMIZATION
router.get('/optimization/recommendations', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/optimization/run', auth, (req, res) => res.json({ success: true, data: {} }));

// MAINTENANCE
router.get('/maintenance/schedules', auth, (req, res) => res.json({ success: true, data: [] }));
router.get('/maintenance/history', auth, (req, res) => res.json({ success: true, data: [] }));

// API KEYS
router.get('/api-keys', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/api-keys', auth, (req, res) => res.json({ success: true, data: {} }));
router.delete('/api-keys/:id', auth, (req, res) => res.json({ success: true }));

// NOTIFICATIONS
router.get('/notifications', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/notifications/:id/read', auth, (req, res) => res.json({ success: true }));

// GRID
router.get('/grid/status', auth, (req, res) => res.json({ success: true, data: { connected: true, frequency: 60, voltage: 220 } }));
router.get('/grid/tariffs', auth, (req, res) => res.json({ success: true, data: [] }));

// ENERGY
router.get('/energy/consumption', auth, (req, res) => res.json({ success: true, data: [] }));
router.get('/energy/generation', auth, (req, res) => res.json({ success: true, data: [] }));
router.get('/energy/forecast', auth, (req, res) => res.json({ success: true, data: [] }));

// ANALYTICS
router.get('/analytics/summary', auth, (req, res) => res.json({ success: true, data: {} }));
router.get('/analytics/trends', auth, (req, res) => res.json({ success: true, data: [] }));

// SUPPORT
router.get('/support/tickets', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/support/tickets', auth, (req, res) => res.json({ success: true, data: {} }));

// FIRMWARE
router.get('/firmware/updates', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/firmware/update/:id', auth, (req, res) => res.json({ success: true }));

// INTEGRATIONS
router.get('/integrations', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/integrations', auth, (req, res) => res.json({ success: true, data: {} }));

// WEBHOOKS
router.get('/webhooks', auth, (req, res) => res.json({ success: true, data: [] }));
router.post('/webhooks', auth, (req, res) => res.json({ success: true, data: {} }));

// Catch-all para rotas não encontradas no router
router.use(auth, (req, res) => {
  console.log('Unhandled:', req.method, req.path);
  res.json({ success: true, data: [] });
});

// Health check na raiz (sem prefixo)
app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'demo' }));

// Montar router com prefixo /api/v1
app.use('/api/v1', router);

// Também montar sem prefixo para compatibilidade
app.use('/', router);

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('  Lifo4 EMS - DEMO MODE (Full)');
  console.log('  Port: ' + PORT);
  console.log('  API: /api/v1/*');
  console.log('='.repeat(50));
});
