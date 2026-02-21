/**
 * Mock Server for Lifo4 EMS Development
 * Simulates backend APIs for testing the frontend
 */

const express = require('express');
const cors = require('cors');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

app.use(cors());
app.use(express.json());

// ============================================
// MOCK DATA
// ============================================

const mockUser = {
  id: 'user-1',
  email: 'admin@lifo4.com.br',
  name: 'Administrador',
  phone: '(86) 99999-9999',
  role: 'admin',
  organizationId: 'org-1',
  permissions: [
    { resource: 'systems', actions: ['create', 'read', 'update', 'delete', 'control'] },
    { resource: 'alerts', actions: ['read', 'update'] },
    { resource: 'reports', actions: ['create', 'read'] },
    { resource: 'users', actions: ['read'] },
  ],
  isActive: true,
  twoFactorEnabled: false,
  lastLogin: new Date(),
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date(),
  notificationPreferences: {
    email: { enabled: true, criticalOnly: false },
    whatsapp: { enabled: false, criticalOnly: true },
    push: { enabled: true },
    telegram: { enabled: false },
    quietHours: { enabled: false, start: '22:00', end: '08:00' },
  },
  language: 'pt-BR',
  theme: 'dark',
};

const mockSystems = [
  {
    id: 'sys-1',
    name: 'BESS Teresina #01',
    siteId: 'site-1',
    organizationId: 'org-1',
    serialNumber: 'LF4-2024-001',
    model: 'LiFePO4 48V 200Ah',
    manufacturer: 'Lifo4 Energia',
    installationDate: new Date('2024-06-15'),
    warrantyExpiration: new Date('2027-06-15'),
    batterySpec: {
      chemistry: 'LiFePO4',
      nominalCapacity: 200,
      nominalVoltage: 51.2,
      energyCapacity: 10.24,
      cellCount: 16,
      cellsInParallel: 4,
      maxChargeCurrent: 100,
      maxDischargeCurrent: 150,
      maxChargeVoltage: 58.4,
      minDischargeVoltage: 40,
      maxTemperature: 55,
      minTemperature: 0,
    },
    status: 'charging',
    connectionStatus: 'online',
    lastCommunication: new Date(),
    deviceId: 'ESP32-001',
    mqttTopic: 'lifo4/bess/sys-1',
    firmwareVersion: '2.1.0',
    operationMode: 'auto',
    isActive: true,
    createdAt: new Date('2024-06-15'),
    updatedAt: new Date(),
  },
  {
    id: 'sys-2',
    name: 'BESS Teresina #02',
    siteId: 'site-1',
    organizationId: 'org-1',
    serialNumber: 'LF4-2024-002',
    model: 'LiFePO4 48V 100Ah',
    manufacturer: 'Lifo4 Energia',
    installationDate: new Date('2024-08-20'),
    batterySpec: {
      chemistry: 'LiFePO4',
      nominalCapacity: 100,
      nominalVoltage: 51.2,
      energyCapacity: 5.12,
      cellCount: 16,
      cellsInParallel: 2,
      maxChargeCurrent: 50,
      maxDischargeCurrent: 80,
      maxChargeVoltage: 58.4,
      minDischargeVoltage: 40,
      maxTemperature: 55,
      minTemperature: 0,
    },
    status: 'idle',
    connectionStatus: 'online',
    lastCommunication: new Date(),
    deviceId: 'ESP32-002',
    mqttTopic: 'lifo4/bess/sys-2',
    firmwareVersion: '2.1.0',
    operationMode: 'auto',
    isActive: true,
    createdAt: new Date('2024-08-20'),
    updatedAt: new Date(),
  },
  {
    id: 'sys-3',
    name: 'BESS Parnaiba #01',
    siteId: 'site-2',
    organizationId: 'org-1',
    serialNumber: 'LF4-2024-003',
    model: 'LiFePO4 48V 200Ah',
    manufacturer: 'Lifo4 Energia',
    installationDate: new Date('2024-10-01'),
    batterySpec: {
      chemistry: 'LiFePO4',
      nominalCapacity: 200,
      nominalVoltage: 51.2,
      energyCapacity: 10.24,
      cellCount: 16,
      cellsInParallel: 4,
      maxChargeCurrent: 100,
      maxDischargeCurrent: 150,
      maxChargeVoltage: 58.4,
      minDischargeVoltage: 40,
      maxTemperature: 55,
      minTemperature: 0,
    },
    status: 'offline',
    connectionStatus: 'offline',
    lastCommunication: new Date(Date.now() - 3600000),
    deviceId: 'ESP32-003',
    mqttTopic: 'lifo4/bess/sys-3',
    firmwareVersion: '2.0.5',
    operationMode: 'auto',
    isActive: true,
    createdAt: new Date('2024-10-01'),
    updatedAt: new Date(),
  },
];

// Cache for mock-bess data
let mockBessCache = null;
let mockBessCacheTime = 0;
const MOCK_BESS_URL = 'http://localhost:3002';

// Fetch data from mock-bess simulator
const fetchMockBessData = async () => {
  // Use cache if less than 1 second old
  if (mockBessCache && Date.now() - mockBessCacheTime < 1000) {
    return mockBessCache;
  }

  try {
    const response = await fetch(`${MOCK_BESS_URL}/api/status`);
    if (response.ok) {
      const result = await response.json();
      mockBessCache = result.data;
      mockBessCacheTime = Date.now();
      return mockBessCache;
    }
  } catch (e) {
    // Mock-bess not available, use fallback
  }
  return null;
};

const generateTelemetry = (systemId) => {
  const system = mockSystems.find(s => s.id === systemId);
  if (!system || system.connectionStatus === 'offline') return null;

  // Try to use mock-bess data if available
  const bessData = mockBessCache;
  if (bessData && bessData.bms) {
    const bms = bessData.bms;
    const inv = bessData.inverter;

    const cells = bms.cells.map((c, i) => ({
      index: i,
      voltage: c.voltage,
      temperature: bms.temperatures[i % bms.temperatures.length]?.value || 28,
      isBalancing: c.isBalancing,
      status: c.voltage < 3.0 || c.voltage > 3.5 ? 'attention' : 'normal',
    }));

    // Update system status based on mock-bess
    if (inv) {
      system.status = inv.battery.charging ? 'charging' : inv.battery.discharging ? 'discharging' : 'idle';
    }

    return {
      id: `tel-${Date.now()}`,
      systemId,
      timestamp: new Date(),
      soc: bms.soc,
      soh: bms.soh,
      totalVoltage: bms.voltage,
      current: bms.current,
      power: bms.voltage * bms.current,
      temperature: {
        min: bms.tempMin,
        max: bms.tempMax,
        average: (bms.tempMin + bms.tempMax) / 2,
        sensors: bms.temperatures.map(t => t.value),
      },
      cells,
      chargeCapacity: system.batterySpec.nominalCapacity * (bms.soc / 100),
      energyRemaining: system.batterySpec.energyCapacity * (bms.soc / 100),
      cycleCount: bms.cycles,
      isCharging: inv?.battery.charging || false,
      isDischarging: inv?.battery.discharging || false,
      isBalancing: bms.balancingActive,
      alarms: Object.entries(bms.alarms).filter(([,v]) => v).map(([type]) => type),
      warnings: Object.entries(bms.warnings).filter(([,v]) => v).map(([type]) => type),
      // Extra data from inverter
      inverter: inv ? {
        mode: inv.mode,
        pvPower: inv.pv.power,
        gridPower: inv.grid.power,
        loadPower: inv.output.power,
        gridConnected: inv.grid.connected,
      } : null,
    };
  }

  // Fallback to random data if mock-bess not available
  const soc = 45 + Math.random() * 50;
  const isCharging = system.status === 'charging';
  const isDischarging = system.status === 'discharging';
  const current = isCharging ? 20 + Math.random() * 30 : isDischarging ? -(10 + Math.random() * 20) : 0;

  const cells = Array.from({ length: 16 }, (_, i) => ({
    index: i,
    voltage: 3.2 + Math.random() * 0.15,
    temperature: 25 + Math.random() * 10,
    isBalancing: Math.random() > 0.9,
    status: Math.random() > 0.95 ? 'attention' : 'normal',
  }));

  return {
    id: `tel-${Date.now()}`,
    systemId,
    timestamp: new Date(),
    soc,
    soh: 98 + Math.random() * 2,
    totalVoltage: cells.reduce((sum, c) => sum + c.voltage, 0),
    current,
    power: cells.reduce((sum, c) => sum + c.voltage, 0) * current,
    temperature: {
      min: 24 + Math.random() * 3,
      max: 32 + Math.random() * 5,
      average: 28 + Math.random() * 3,
      sensors: [26, 27, 28, 29],
    },
    cells,
    chargeCapacity: system.batterySpec.nominalCapacity * (soc / 100),
    energyRemaining: system.batterySpec.energyCapacity * (soc / 100),
    cycleCount: 150 + Math.floor(Math.random() * 50),
    isCharging,
    isDischarging,
    isBalancing: cells.some(c => c.isBalancing),
    alarms: [],
    warnings: [],
  };
};

// Periodically fetch mock-bess data
setInterval(async () => {
  await fetchMockBessData();
}, 1000);

const mockAlerts = [
  {
    id: 'alert-1',
    systemId: 'sys-1',
    organizationId: 'org-1',
    type: 'high_temperature',
    severity: 'high',
    title: 'Temperatura elevada detectada',
    message: 'A temperatura do pack atingiu 42°C, acima do limite recomendado de 40°C.',
    isRead: false,
    isAcknowledged: false,
    createdAt: new Date(Date.now() - 1800000),
  },
  {
    id: 'alert-2',
    systemId: 'sys-2',
    organizationId: 'org-1',
    type: 'cell_imbalance',
    severity: 'medium',
    title: 'Desbalanceamento de células',
    message: 'Diferença de tensão entre células superior a 30mV detectada.',
    isRead: true,
    isAcknowledged: false,
    createdAt: new Date(Date.now() - 7200000),
  },
  {
    id: 'alert-3',
    systemId: 'sys-3',
    organizationId: 'org-1',
    type: 'communication_error',
    severity: 'critical',
    title: 'Falha de comunicação',
    message: 'Sistema offline há mais de 1 hora. Verifique a conexão.',
    isRead: false,
    isAcknowledged: false,
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: 'alert-4',
    systemId: 'sys-1',
    organizationId: 'org-1',
    type: 'low_soc',
    severity: 'low',
    title: 'SOC baixo',
    message: 'Estado de carga abaixo de 20%. Considere iniciar carga.',
    isRead: true,
    isAcknowledged: true,
    acknowledgedAt: new Date(Date.now() - 86400000),
    createdAt: new Date(Date.now() - 172800000),
  },
];

const mockReports = [
  {
    id: 'report-1',
    systemId: 'sys-1',
    type: 'daily',
    format: 'pdf',
    status: 'completed',
    createdAt: new Date(Date.now() - 86400000),
    completedAt: new Date(Date.now() - 86300000),
  },
  {
    id: 'report-2',
    systemId: 'sys-1',
    type: 'weekly',
    format: 'excel',
    status: 'completed',
    createdAt: new Date(Date.now() - 604800000),
    completedAt: new Date(Date.now() - 604700000),
  },
  {
    id: 'report-3',
    systemId: 'sys-2',
    type: 'monthly',
    format: 'pdf',
    status: 'processing',
    createdAt: new Date(),
  },
];

let tokens = {
  accessToken: 'mock-access-token-12345',
  refreshToken: 'mock-refresh-token-67890',
};

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;

  // Simulate login
  if (email && password) {
    res.json({
      success: true,
      data: {
        user: mockUser,
        tokens,
      },
    });
  } else {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Email e senha são obrigatórios' },
    });
  }
});

// Dev login endpoint (same as regular login, used in development mode)
app.post('/api/v1/auth/dev-login', (req, res) => {
  const { email, password } = req.body;

  // Simulate login - accepts any credentials in dev mode
  if (email && password) {
    res.json({
      success: true,
      data: {
        user: { ...mockUser, email },
        tokens,
      },
    });
  } else {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_CREDENTIALS', message: 'Email e senha são obrigatórios' },
    });
  }
});

app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, name } = req.body;

  res.json({
    success: true,
    data: {
      user: { ...mockUser, email, name },
      tokens,
    },
  });
});

app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ success: true });
});

app.post('/api/v1/auth/refresh', (req, res) => {
  res.json({
    success: true,
    data: { tokens },
  });
});

app.get('/api/v1/auth/me', (req, res) => {
  res.json({
    success: true,
    data: mockUser,
  });
});

// ============================================
// SYSTEMS ROUTES
// ============================================

app.get('/api/v1/systems', (req, res) => {
  res.json({
    success: true,
    data: mockSystems,
    pagination: { page: 1, limit: 10, total: mockSystems.length, totalPages: 1 },
  });
});

app.get('/api/v1/systems/overview', (req, res) => {
  res.json({
    success: true,
    data: {
      total: mockSystems.length,
      online: mockSystems.filter(s => s.connectionStatus === 'online').length,
      offline: mockSystems.filter(s => s.connectionStatus === 'offline').length,
      error: mockSystems.filter(s => s.status === 'error').length,
      charging: mockSystems.filter(s => s.status === 'charging').length,
      discharging: mockSystems.filter(s => s.status === 'discharging').length,
    },
  });
});

app.get('/api/v1/systems/:systemId', (req, res) => {
  const system = mockSystems.find(s => s.id === req.params.systemId);
  if (system) {
    res.json({ success: true, data: system });
  } else {
    res.status(404).json({ success: false, error: { message: 'Sistema não encontrado' } });
  }
});

// ============================================
// TELEMETRY ROUTES
// ============================================

app.get('/api/v1/telemetry/:systemId/current', (req, res) => {
  const telemetry = generateTelemetry(req.params.systemId);
  if (telemetry) {
    res.json({ success: true, data: telemetry });
  } else {
    res.status(404).json({ success: false, error: { message: 'Telemetria não disponível' } });
  }
});

app.get('/api/v1/telemetry/:systemId/history', (req, res) => {
  const { startDate, endDate, resolution } = req.query;
  const systemId = req.params.systemId;
  const system = mockSystems.find(s => s.id === systemId);

  if (!system) {
    return res.status(404).json({ success: false, error: { message: 'Sistema não encontrado' } });
  }

  // Calculate time range and number of points
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 24 * 3600000);
  const rangeDuration = end.getTime() - start.getTime();

  // Determine interval based on resolution or duration
  let intervalMs;
  switch (resolution) {
    case '1m':
      intervalMs = 60 * 1000;
      break;
    case '5m':
      intervalMs = 5 * 60 * 1000;
      break;
    case '15m':
      intervalMs = 15 * 60 * 1000;
      break;
    case '1h':
      intervalMs = 60 * 60 * 1000;
      break;
    case '6h':
      intervalMs = 6 * 60 * 60 * 1000;
      break;
    default:
      // Auto-determine based on range
      if (rangeDuration <= 2 * 3600000) intervalMs = 60 * 1000; // <= 2h: 1min
      else if (rangeDuration <= 12 * 3600000) intervalMs = 5 * 60 * 1000; // <= 12h: 5min
      else if (rangeDuration <= 48 * 3600000) intervalMs = 15 * 60 * 1000; // <= 48h: 15min
      else if (rangeDuration <= 14 * 24 * 3600000) intervalMs = 60 * 60 * 1000; // <= 14d: 1h
      else intervalMs = 6 * 60 * 60 * 1000; // > 14d: 6h
  }

  const numPoints = Math.min(Math.floor(rangeDuration / intervalMs), 500); // Limit to 500 points

  // Generate realistic data with patterns
  const history = [];
  let baseSoc = 50 + Math.random() * 30; // Starting SOC
  let trend = Math.random() > 0.5 ? 1 : -1; // Charging or discharging trend

  for (let i = 0; i < numPoints; i++) {
    const timestamp = new Date(start.getTime() + i * intervalMs);
    const hour = timestamp.getHours();

    // Simulate daily patterns (charge during day, discharge at night)
    const isDaytime = hour >= 8 && hour <= 18;
    const shouldCharge = isDaytime && baseSoc < 90;
    const shouldDischarge = !isDaytime && baseSoc > 20;

    // Update SOC with realistic changes
    if (shouldCharge) {
      baseSoc = Math.min(100, baseSoc + (0.5 + Math.random() * 1.5));
      trend = 1;
    } else if (shouldDischarge) {
      baseSoc = Math.max(10, baseSoc - (0.3 + Math.random() * 1.0));
      trend = -1;
    } else {
      // Small fluctuations
      baseSoc += (Math.random() - 0.5) * 0.5;
      trend = 0;
    }

    const isCharging = trend > 0;
    const isDischarging = trend < 0;
    const current = isCharging ? (15 + Math.random() * 35) : isDischarging ? -(10 + Math.random() * 25) : (Math.random() - 0.5) * 2;

    // Generate cell voltages with slight variations
    const cells = Array.from({ length: 16 }, (_, cellIdx) => {
      const baseVoltage = 3.0 + (baseSoc / 100) * 0.35; // 3.0V at 0% to 3.35V at 100%
      const variation = (Math.random() - 0.5) * 0.02; // ±10mV variation
      return {
        index: cellIdx,
        voltage: baseVoltage + variation,
        temperature: 25 + Math.random() * 8,
        isBalancing: Math.random() > 0.95,
        status: 'normal',
      };
    });

    const totalVoltage = cells.reduce((sum, c) => sum + c.voltage, 0);
    const power = totalVoltage * current;

    // Temperature varies with load and time of day
    const loadFactor = Math.abs(current) / 50;
    const ambientTemp = 25 + Math.sin((hour - 6) * Math.PI / 12) * 5; // Peaks at noon
    const tempBase = ambientTemp + loadFactor * 10;

    history.push({
      id: `tel-${timestamp.getTime()}`,
      systemId,
      timestamp: timestamp.toISOString(),
      soc: Math.max(10, Math.min(100, baseSoc)),
      soh: 97 + Math.random() * 3,
      totalVoltage,
      current,
      power,
      temperature: {
        min: tempBase - 2 - Math.random() * 2,
        max: tempBase + 2 + Math.random() * 3,
        average: tempBase,
        sensors: [tempBase - 1, tempBase, tempBase + 1, tempBase + 0.5],
      },
      cells,
      chargeCapacity: system.batterySpec.nominalCapacity * (baseSoc / 100),
      energyRemaining: system.batterySpec.energyCapacity * (baseSoc / 100),
      cycleCount: 150 + Math.floor(i / 50),
      isCharging,
      isDischarging,
      isBalancing: cells.some(c => c.isBalancing),
      alarms: [],
      warnings: [],
    });
  }

  res.json({ success: true, data: history });
});

// ============================================
// CONTROL ROUTES
// ============================================

app.post('/api/v1/control/:systemId/charge/start', (req, res) => {
  const system = mockSystems.find(s => s.id === req.params.systemId);
  if (system) {
    system.status = 'charging';
    res.json({ success: true, data: { message: 'Carga iniciada' } });
  } else {
    res.status(404).json({ success: false });
  }
});

app.post('/api/v1/control/:systemId/charge/stop', (req, res) => {
  const system = mockSystems.find(s => s.id === req.params.systemId);
  if (system) {
    system.status = 'idle';
    res.json({ success: true, data: { message: 'Carga parada' } });
  } else {
    res.status(404).json({ success: false });
  }
});

app.post('/api/v1/control/:systemId/discharge/start', (req, res) => {
  const system = mockSystems.find(s => s.id === req.params.systemId);
  if (system) {
    system.status = 'discharging';
    res.json({ success: true, data: { message: 'Descarga iniciada' } });
  } else {
    res.status(404).json({ success: false });
  }
});

app.post('/api/v1/control/:systemId/emergency-stop', (req, res) => {
  const system = mockSystems.find(s => s.id === req.params.systemId);
  if (system) {
    system.status = 'idle';
    res.json({ success: true, data: { message: 'Parada de emergência executada' } });
  } else {
    res.status(404).json({ success: false });
  }
});

// ============================================
// PROTECTION SETTINGS ROUTES
// ============================================

const mockProtectionSettings = {};

app.get('/api/v1/systems/:systemId/protection', (req, res) => {
  const systemId = req.params.systemId;
  const settings = mockProtectionSettings[systemId] || {
    id: `prot-${systemId}`,
    systemId,
    cellOvervoltage: 3.65,
    cellUndervoltage: 2.5,
    cellOvervoltageRecovery: 3.55,
    cellUndervoltageRecovery: 2.8,
    maxChargeCurrent: 100,
    maxDischargeCurrent: 150,
    chargeHighTemp: 45,
    chargeLowTemp: 0,
    dischargeHighTemp: 55,
    dischargeLowTemp: -20,
    balanceStartVoltage: 3.4,
    balanceDeltaVoltage: 0.03,
    minSoc: 10,
    maxSoc: 95,
    updatedAt: new Date(),
    updatedBy: 'user-1',
  };
  res.json({ success: true, data: settings });
});

app.patch('/api/v1/systems/:systemId/protection', (req, res) => {
  const systemId = req.params.systemId;
  mockProtectionSettings[systemId] = {
    ...mockProtectionSettings[systemId],
    ...req.body,
    updatedAt: new Date(),
  };
  res.json({ success: true, data: mockProtectionSettings[systemId] });
});

// ============================================
// SCHEDULES ROUTES
// ============================================

const mockSchedules = [
  {
    id: 'sched-1',
    systemId: 'sys-1',
    name: 'Carga Solar',
    isActive: true,
    startTime: '08:00',
    endTime: '17:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    action: 'charge',
    targetSoc: 95,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
  {
    id: 'sched-2',
    systemId: 'sys-1',
    name: 'Peak Shaving Noturno',
    isActive: true,
    startTime: '18:00',
    endTime: '21:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    action: 'peak_shaving',
    powerLimit: 5000,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
  {
    id: 'sched-3',
    systemId: 'sys-2',
    name: 'Carga Fim de Semana',
    isActive: false,
    startTime: '10:00',
    endTime: '16:00',
    daysOfWeek: [0, 6],
    action: 'charge',
    targetSoc: 80,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  },
];

app.get('/api/v1/control/:systemId/schedules', (req, res) => {
  const systemId = req.params.systemId;
  const schedules = mockSchedules.filter(s => s.systemId === systemId);
  res.json({ success: true, data: schedules });
});

app.post('/api/v1/control/schedules', (req, res) => {
  const newSchedule = {
    id: `sched-${Date.now()}`,
    ...req.body,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  mockSchedules.push(newSchedule);
  res.json({ success: true, data: newSchedule });
});

app.patch('/api/v1/control/schedules/:scheduleId', (req, res) => {
  const schedule = mockSchedules.find(s => s.id === req.params.scheduleId);
  if (schedule) {
    Object.assign(schedule, req.body, { updatedAt: new Date() });
    res.json({ success: true, data: schedule });
  } else {
    res.status(404).json({ success: false });
  }
});

app.delete('/api/v1/control/schedules/:scheduleId', (req, res) => {
  const index = mockSchedules.findIndex(s => s.id === req.params.scheduleId);
  if (index !== -1) {
    mockSchedules.splice(index, 1);
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

// ============================================
// ALERTS ROUTES
// ============================================

app.get('/api/v1/alerts', (req, res) => {
  res.json({
    success: true,
    data: mockAlerts,
    pagination: { page: 1, limit: 10, total: mockAlerts.length, totalPages: 1 },
  });
});

app.get('/api/v1/alerts/summary', (req, res) => {
  res.json({
    success: true,
    data: {
      total: mockAlerts.length,
      critical: mockAlerts.filter(a => a.severity === 'critical').length,
      high: mockAlerts.filter(a => a.severity === 'high').length,
      medium: mockAlerts.filter(a => a.severity === 'medium').length,
      low: mockAlerts.filter(a => a.severity === 'low').length,
      unread: mockAlerts.filter(a => !a.isRead).length,
      unacknowledged: mockAlerts.filter(a => !a.isAcknowledged).length,
    },
  });
});

app.get('/api/v1/alerts/unread-count', (req, res) => {
  res.json({
    success: true,
    data: { count: mockAlerts.filter(a => !a.isRead).length },
  });
});

app.post('/api/v1/alerts/:alertId/read', (req, res) => {
  const alert = mockAlerts.find(a => a.id === req.params.alertId);
  if (alert) {
    alert.isRead = true;
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

app.post('/api/v1/alerts/:alertId/acknowledge', (req, res) => {
  const alert = mockAlerts.find(a => a.id === req.params.alertId);
  if (alert) {
    alert.isAcknowledged = true;
    alert.acknowledgedAt = new Date();
    res.json({ success: true });
  } else {
    res.status(404).json({ success: false });
  }
});

app.post('/api/v1/alerts/read-multiple', (req, res) => {
  const { alertIds } = req.body;
  alertIds.forEach(id => {
    const alert = mockAlerts.find(a => a.id === id);
    if (alert) alert.isRead = true;
  });
  res.json({ success: true });
});

// ============================================
// DEVICE DISCOVERY ROUTES
// ============================================

// Store for discovered devices and connections
const discoveredDevices = [];
const deviceConnections = {};
let lastDiscoveryCheck = Date.now();

// Check mock-bess for new devices (now checks ALL 9 devices)
const checkForNewDevices = async () => {
  try {
    // Use /api/devices to get ALL BESS units
    const response = await fetch('http://localhost:3002/api/devices');
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.data && Array.isArray(data.data)) {
        for (const device of data.data) {
          const deviceId = `discovered-${device.id}`;

          // Check if already discovered
          const exists = discoveredDevices.some(d => d.id === deviceId);
          if (!exists && device.online) {
            const newDevice = {
              id: deviceId,
              name: device.name || `BESS ${device.id}`,
              type: 'bms',
              manufacturer: 'JK BMS',
              model: `LiFePO4 ${device.capacity}Ah`,
              protocol: 'mqtt',
              address: 'localhost',
              port: 1883,
              topic: `lifo4/${device.id}/telemetry`,
              serialNumber: device.id,
              firmware: '11.XW',
              discoveredAt: new Date().toISOString(),
              signalStrength: -45 + Math.floor(Math.random() * 10),
              status: 'new',
              site: device.site,
              soc: device.soc,
              capacity: device.capacity,
            };
            discoveredDevices.push(newDevice);
            console.log('New device discovered:', newDevice.name);
          }
        }
      }
    }
  } catch (error) {
    // Mock-bess not available
  }
};

// Start periodic discovery check
setInterval(checkForNewDevices, 10000);
checkForNewDevices(); // Initial check

// Get newly discovered devices (since last check)
app.get('/api/v1/discovery/new', (req, res) => {
  const newDevices = discoveredDevices.filter(d =>
    d.status === 'new' && new Date(d.discoveredAt).getTime() > lastDiscoveryCheck
  );
  lastDiscoveryCheck = Date.now();
  res.json({ success: true, data: newDevices });
});

// Scan for devices
app.post('/api/v1/discovery/scan', async (req, res) => {
  await checkForNewDevices();

  // Return all discovered devices
  res.json({
    success: true,
    data: discoveredDevices.map(d => ({
      ...d,
      status: deviceConnections[d.id]?.enabled ? 'added' : d.status
    }))
  });
});

// Add discovered device to system
app.post('/api/v1/discovery/add', (req, res) => {
  const device = req.body;
  const systemId = `sys-${Date.now()}`;

  // Create a new system entry in mockSystems
  const newSystem = {
    id: systemId,
    name: device.name || `${device.manufacturer} ${device.model}`,
    siteId: 'site-1',
    organizationId: 'org-1',
    serialNumber: device.serialNumber || `AUTO-${Date.now()}`,
    model: device.model || 'Auto-discovered',
    manufacturer: device.manufacturer || 'Unknown',
    installationDate: new Date(),
    batterySpec: {
      chemistry: 'LiFePO4',
      nominalCapacity: 200,
      nominalVoltage: 51.2,
      energyCapacity: 10.24,
      cellCount: 16,
      cellsInParallel: 4,
      maxChargeCurrent: 100,
      maxDischargeCurrent: 150,
      maxChargeVoltage: 58.4,
      minDischargeVoltage: 40,
      maxTemperature: 55,
      minTemperature: 0,
    },
    status: 'idle',
    connectionStatus: 'online',
    lastCommunication: new Date(),
    deviceId: device.id,
    mqttTopic: device.topic || `lifo4/bess/${systemId}`,
    firmwareVersion: device.firmware || '1.0.0',
    operationMode: 'auto',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Add to mockSystems array
  mockSystems.push(newSystem);
  console.log(`New system added: ${newSystem.name} (${systemId})`);

  // Create connection config
  deviceConnections[device.id] = {
    ...device,
    enabled: true,
    connectedAt: new Date().toISOString(),
    systemId: systemId,
  };

  // Also create connection for the new system ID
  deviceConnections[systemId] = {
    ...device,
    systemId,
    enabled: true,
    connectionStatus: 'connected',
    connectedAt: new Date().toISOString(),
  };

  // Update device status in discovered list
  const idx = discoveredDevices.findIndex(d => d.id === device.id);
  if (idx !== -1) {
    discoveredDevices[idx].status = 'added';
  }

  res.json({ success: true, data: { system: newSystem, connection: deviceConnections[device.id] } });
});

// ============================================
// CONNECTION CONFIG ROUTES
// ============================================

// Get connection config for a system
app.get('/api/v1/systems/:systemId/connection', (req, res) => {
  const { systemId } = req.params;
  const connection = deviceConnections[systemId] || {
    id: `conn-${systemId}`,
    systemId,
    protocol: 'http',
    enabled: systemId === 'sys-1', // sys-1 is connected by default
    apiUrl: 'http://localhost:3002',
    bmsModel: 'PB2A16S20P',
    bmsManufacturer: 'JK BMS',
    connectionStatus: systemId === 'sys-1' ? 'connected' : 'disconnected',
  };
  res.json({ success: true, data: connection });
});

// Save connection config
app.post('/api/v1/systems/:systemId/connection', (req, res) => {
  const { systemId } = req.params;
  deviceConnections[systemId] = {
    ...req.body,
    systemId,
    updatedAt: new Date().toISOString(),
  };
  res.json({ success: true, data: deviceConnections[systemId] });
});

// Test connection
app.post('/api/v1/systems/:systemId/connection/test', async (req, res) => {
  const config = req.body;

  try {
    if (config.protocol === 'http' && config.apiUrl) {
      const response = await fetch(`${config.apiUrl}/health`);
      if (response.ok) {
        res.json({
          success: true,
          data: { message: 'Dispositivo respondeu corretamente' }
        });
      } else {
        res.json({
          success: false,
          error: { message: `Dispositivo retornou erro: ${response.status}` }
        });
      }
    } else if (config.protocol === 'mqtt') {
      // Simulate MQTT test
      res.json({
        success: true,
        data: { message: `Broker MQTT ${config.mqttBroker}:${config.mqttPort} acessivel` }
      });
    } else {
      res.json({
        success: true,
        data: { message: 'Configuracao validada (simulado)' }
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: { message: `Nao foi possivel conectar: ${error.message}` }
    });
  }
});

// Connect device
app.post('/api/v1/systems/:systemId/connection/connect', (req, res) => {
  const { systemId } = req.params;
  const config = req.body;

  deviceConnections[systemId] = {
    ...config,
    systemId,
    enabled: true,
    connectionStatus: 'connected',
    connectedAt: new Date().toISOString(),
  };

  // Update the mock system status
  const system = mockSystems.find(s => s.id === systemId);
  if (system) {
    system.connectionStatus = 'online';
  }

  res.json({ success: true, data: deviceConnections[systemId] });
});

// Disconnect device
app.post('/api/v1/systems/:systemId/connection/disconnect', (req, res) => {
  const { systemId } = req.params;

  if (deviceConnections[systemId]) {
    deviceConnections[systemId].enabled = false;
    deviceConnections[systemId].connectionStatus = 'disconnected';
  }

  res.json({ success: true });
});

// ============================================
// REPORTS ROUTES
// ============================================

app.get('/api/v1/reports', (req, res) => {
  res.json({
    success: true,
    data: mockReports,
  });
});

app.post('/api/v1/reports/generate', (req, res) => {
  const newReport = {
    id: `report-${Date.now()}`,
    systemId: req.body.systemId,
    type: req.body.type,
    format: req.body.format || 'pdf',
    status: 'processing',
    createdAt: new Date(),
  };
  mockReports.unshift(newReport);

  // Simulate processing
  setTimeout(() => {
    newReport.status = 'completed';
    newReport.completedAt = new Date();
  }, 3000);

  res.json({ success: true, data: newReport });
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ============================================
// WEBSOCKET
// ============================================

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('subscribe:system', (systemId) => {
    console.log(`Client ${socket.id} subscribed to system ${systemId}`);
    socket.join(`system:${systemId}`);
  });

  socket.on('unsubscribe:system', (systemId) => {
    socket.leave(`system:${systemId}`);
  });

  socket.on('subscribe:alerts', () => {
    socket.join('alerts');
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Emit telemetry updates every 5 seconds
setInterval(() => {
  mockSystems.forEach(system => {
    if (system.connectionStatus === 'online') {
      const telemetry = generateTelemetry(system.id);
      io.to(`system:${system.id}`).emit('telemetry', { systemId: system.id, data: telemetry });
    }
  });
}, 5000);

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔋 Lifo4 EMS - Mock Server                              ║
║                                                           ║
║   Server running on: http://localhost:${PORT}               ║
║   WebSocket ready                                         ║
║                                                           ║
║   Mock Credentials:                                       ║
║   Email: admin@lifo4.com.br                               ║
║   Password: (any password works)                          ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
