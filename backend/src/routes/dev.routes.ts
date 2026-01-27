/**
 * Development-only mock routes
 * These bypass Firebase and return mock data for testing
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Mock BESS Systems
const mockSystems = [
  {
    id: 'sys-demo-001',
    name: 'BESS Demo - 100kWh',
    organizationId: 'org-demo',
    siteId: 'site-teresina',
    type: 'bess',
    status: 'online',
    capacity: { energy: 100, power: 50 },
    batteryConfig: {
      chemistry: 'LiFePO4',
      nominalVoltage: 51.2,
      nominalCapacity: 100,
      cellCount: 16,
      moduleCount: 4,
    },
    location: {
      latitude: -5.0892,
      longitude: -42.8019,
      address: 'Teresina, PI',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'sys-demo-002',
    name: 'BESS Comercial - 200kWh',
    organizationId: 'org-demo',
    siteId: 'site-teresina',
    type: 'bess',
    status: 'online',
    capacity: { energy: 200, power: 100 },
    batteryConfig: {
      chemistry: 'LiFePO4',
      nominalVoltage: 51.2,
      nominalCapacity: 200,
      cellCount: 16,
      moduleCount: 8,
    },
    location: {
      latitude: -5.0892,
      longitude: -42.8019,
      address: 'Teresina, PI',
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// Mock Telemetry Data
const generateMockTelemetry = (systemId: string) => ({
  systemId,
  timestamp: new Date(),
  voltage: 51.2 + Math.random() * 2 - 1,
  current: Math.random() * 50 - 25,
  power: Math.random() * 25 - 12.5,
  soc: 45 + Math.random() * 40,
  soh: 98 + Math.random() * 2,
  temperature: {
    average: 25 + Math.random() * 10,
    min: 22 + Math.random() * 5,
    max: 28 + Math.random() * 10,
  },
  cells: Array.from({ length: 16 }, (_, i) => ({
    id: i + 1,
    voltage: 3.2 + Math.random() * 0.2,
    temperature: 25 + Math.random() * 5,
    balancing: Math.random() > 0.9,
  })),
  status: {
    charging: Math.random() > 0.5,
    discharging: Math.random() > 0.5,
    balancing: Math.random() > 0.8,
    alarm: false,
    fault: false,
  },
  energy: {
    charged: 1250 + Math.random() * 100,
    discharged: 1180 + Math.random() * 100,
    cycles: 125,
  },
});

// Mock Alerts
const mockAlerts = [
  {
    id: 'alert-001',
    systemId: 'sys-demo-001',
    organizationId: 'org-demo',
    title: 'Temperatura elevada no modulo 3',
    message: 'A temperatura do modulo 3 atingiu 35C, acima do limite de 32C.',
    severity: 'medium',
    isRead: false,
    isAcknowledged: false,
    createdAt: new Date(Date.now() - 3600000),
  },
  {
    id: 'alert-002',
    systemId: 'sys-demo-002',
    organizationId: 'org-demo',
    title: 'Balanceamento concluido',
    message: 'O balanceamento de celulas foi concluido com sucesso.',
    severity: 'low',
    isRead: true,
    isAcknowledged: true,
    createdAt: new Date(Date.now() - 86400000),
  },
];

// Systems endpoints
router.get('/systems', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockSystems,
    pagination: { page: 1, limit: 10, total: mockSystems.length, totalPages: 1 },
  });
});

router.get('/systems/overview', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      totalSystems: mockSystems.length,
      onlineSystems: mockSystems.filter(s => s.status === 'online').length,
      offlineSystems: 0,
      alertingSystems: 0,
      totalCapacity: mockSystems.reduce((sum, s) => sum + s.capacity.energy, 0),
      totalPower: mockSystems.reduce((sum, s) => sum + s.capacity.power, 0),
      averageSoc: 65,
      averageSoh: 98,
    },
  });
});

router.get('/systems/:systemId', (req: Request, res: Response) => {
  const system = mockSystems.find(s => s.id === req.params.systemId);
  if (!system) {
    res.status(404).json({ success: false, error: { message: 'System not found' } });
    return;
  }
  res.json({ success: true, data: system });
});

// Telemetry endpoints
router.get('/telemetry/:systemId/current', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: generateMockTelemetry(req.params.systemId),
  });
});

router.get('/telemetry/:systemId/history', (req: Request, res: Response) => {
  const history = Array.from({ length: 24 }, (_, i) => ({
    ...generateMockTelemetry(req.params.systemId),
    timestamp: new Date(Date.now() - i * 3600000),
  }));
  res.json({ success: true, data: history });
});

// Alerts endpoints
router.get('/alerts', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: mockAlerts,
    pagination: { page: 1, limit: 10, total: mockAlerts.length, totalPages: 1 },
  });
});

router.get('/alerts/summary', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      total: mockAlerts.length,
      critical: 0,
      high: 0,
      medium: 1,
      low: 1,
      unread: mockAlerts.filter(a => !a.isRead).length,
      unacknowledged: mockAlerts.filter(a => !a.isAcknowledged).length,
    },
  });
});

router.get('/alerts/unread-count', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: { count: mockAlerts.filter(a => !a.isRead).length },
  });
});

// Control endpoints (mock responses)
router.post('/control/:systemId/mode', (req: Request, res: Response) => {
  res.json({ success: true, message: `Mode set to ${req.body.mode}` });
});

router.post('/control/command', (req: Request, res: Response) => {
  res.json({ success: true, message: `Command ${req.body.command} sent` });
});

// Optimization endpoints
router.get('/optimization/strategies', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'arbitrage', name: 'Arbitragem de Energia', description: 'Compra na baixa, vende na alta' },
      { id: 'peak_shaving', name: 'Peak Shaving', description: 'Reduz picos de demanda' },
      { id: 'self_consumption', name: 'Autoconsumo', description: 'Maximiza uso de energia solar' },
      { id: 'frequency_response', name: 'Resposta de Frequencia', description: 'Estabilizacao da rede' },
    ],
  });
});

// Grid endpoints
router.get('/grid/:systemId/powerflow', (_req: Request, res: Response) => {
  const solarPower = 15 + Math.random() * 10;
  const bessPower = Math.random() > 0.5 ? -(5 + Math.random() * 8) : (3 + Math.random() * 5);
  const gridPower = Math.random() > 0.6 ? (2 + Math.random() * 5) : -(1 + Math.random() * 3);
  const loadPower = 12 + Math.random() * 8;

  res.json({
    success: true,
    data: {
      solar: { power: solarPower, energy: 45.2 + Math.random() * 20 },
      bess: { power: bessPower, energy: 12.8 + Math.random() * 10, soc: 45 + Math.random() * 40 },
      grid: { power: gridPower, energy: 8.5 + Math.random() * 5, importing: gridPower > 0 },
      load: { power: loadPower, energy: 66.5 + Math.random() * 20 },
      voltage: 220 + Math.random() * 2 - 1,
      frequency: 60 + Math.random() * 0.1 - 0.05,
      powerFactor: 0.95 + Math.random() * 0.05,
      thd: 2 + Math.random() * 2,
      timestamp: new Date(),
    },
  });
});

router.get('/grid/modes', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'grid_following', name: 'Grid Following', description: 'Segue a rede eletrica' },
      { id: 'grid_forming', name: 'Grid Forming', description: 'Forma a referencia de tensao/frequencia' },
      { id: 'islanding', name: 'Islanding', description: 'Operacao em ilha' },
      { id: 'droop', name: 'Droop Control', description: 'Controle de queda para compartilhamento de carga' },
    ],
  });
});

router.post('/grid/:systemId/mode', (req: Request, res: Response) => {
  const { mode } = req.body;
  res.json({
    success: true,
    message: `Modo de controle alterado para ${mode}`,
    data: { mode, timestamp: new Date() },
  });
});

router.get('/grid/:systemId/history', (req: Request, res: Response) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const history = hours.map((hour) => {
    const isSolarHour = hour >= 6 && hour <= 18;
    const isPeakHour = (hour >= 18 && hour <= 21) || (hour >= 7 && hour <= 9);
    return {
      hour: `${hour.toString().padStart(2, '0')}:00`,
      solar: isSolarHour ? Math.sin((hour - 6) / 12 * Math.PI) * 20 + Math.random() * 5 : 0,
      bess: isPeakHour ? -(5 + Math.random() * 8) : (2 + Math.random() * 4),
      grid: isPeakHour ? (3 + Math.random() * 5) : -(2 + Math.random() * 3),
      load: 8 + Math.random() * 10 + (isPeakHour ? 5 : 0),
    };
  });
  res.json({ success: true, data: history });
});

// Optimization endpoints
router.get('/optimization/:systemId/config', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      arbitrage: {
        enabled: true,
        priority: 1,
        parameters: {
          buyThresholdPrice: 0.45,
          sellThresholdPrice: 0.85,
          minSocForSell: 30,
          maxSocForBuy: 90,
        },
      },
      peak_shaving: {
        enabled: true,
        priority: 2,
        parameters: {
          demandLimit: 100,
          triggerThreshold: 80,
          minSoc: 20,
          responseTime: 5,
        },
      },
      self_consumption: {
        enabled: false,
        priority: 3,
        parameters: {
          minSolarExcess: 1,
          targetSoc: 80,
          nightDischarge: true,
        },
      },
      frequency_response: {
        enabled: false,
        priority: 4,
        parameters: {
          frequencyDeadband: 0.05,
          droopPercentage: 5,
          maxPowerResponse: 50,
        },
      },
      demand_response: {
        enabled: false,
        priority: 5,
        parameters: {
          minEventDuration: 30,
          maxReduction: 80,
          advanceNotice: 15,
        },
      },
    },
  });
});

router.put('/optimization/:systemId/config', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Configuration updated', data: req.body });
});

router.get('/optimization/:systemId/results', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      savings: 12450.80,
      energyArbitraged: 2450,
      peakReduction: 35,
      selfConsumptionRate: 78,
      co2Avoided: 1.2,
    },
  });
});

router.post('/optimization/:systemId/run', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Optimization started' });
});

// Schedules mock endpoints
router.get('/control/:systemId/schedules', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      {
        id: 'sched-001',
        systemId: 'sys-demo-001',
        name: 'Carga Noturna',
        action: 'charge',
        startTime: '22:00',
        endTime: '06:00',
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
        targetSoc: 100,
        isActive: true,
      },
      {
        id: 'sched-002',
        systemId: 'sys-demo-001',
        name: 'Descarga Pico',
        action: 'discharge',
        startTime: '18:00',
        endTime: '21:00',
        daysOfWeek: [1, 2, 3, 4, 5],
        targetSoc: 20,
        isActive: true,
      },
    ],
  });
});

router.post('/control/schedules', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { id: 'sched-new', ...req.body, createdAt: new Date() },
  });
});

router.patch('/control/schedules/:scheduleId', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { id: req.params.scheduleId, ...req.body, updatedAt: new Date() },
  });
});

router.delete('/control/schedules/:scheduleId', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'Schedule deleted' });
});

// Black Start endpoints
router.get('/blackstart/:systemId/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      state: 'grid_connected',
      gridVoltage: 220 + Math.random() * 4 - 2,
      gridFrequency: 60 + Math.random() * 0.1 - 0.05,
      bessSoc: 85 + Math.random() * 10,
      totalLoadPower: 25 + Math.random() * 10,
      availableAutonomy: 3.5,
      lastTransferTest: new Date(Date.now() - 86400000 * 7),
      criticalLoadsActive: 6,
      criticalLoadsTotal: 6,
    },
  });
});

router.post('/blackstart/:systemId/trigger', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Black start triggered - transferring to island mode',
    data: { transferTime: 15, timestamp: new Date() },
  });
});

router.post('/blackstart/:systemId/reconnect', (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Grid reconnection initiated',
    data: { syncTime: 2000, timestamp: new Date() },
  });
});

router.get('/blackstart/:systemId/history', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'evt-1', timestamp: new Date(Date.now() - 86400000 * 30), type: 'grid_failure', duration: 3600, cause: 'Queda de energia na rede' },
      { id: 'evt-2', timestamp: new Date(Date.now() - 86400000 * 15), type: 'test', duration: 60, cause: 'Teste programado' },
      { id: 'evt-3', timestamp: new Date(Date.now() - 86400000 * 7), type: 'test', duration: 45, cause: 'Teste manual' },
    ],
  });
});

router.put('/blackstart/:systemId/config', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Black start configuration updated',
    data: req.body,
  });
});

router.get('/blackstart/:systemId/loads', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { id: 'load-1', name: 'Iluminacao de Emergencia', power: 2.5, priority: 1, status: 'active', essential: true },
      { id: 'load-2', name: 'Servidores TI', power: 8.0, priority: 2, status: 'active', essential: true },
      { id: 'load-3', name: 'Sistemas de Seguranca', power: 1.5, priority: 3, status: 'active', essential: true },
      { id: 'load-4', name: 'Comunicacoes', power: 0.8, priority: 4, status: 'active', essential: true },
      { id: 'load-5', name: 'HVAC Critico', power: 15.0, priority: 5, status: 'active', essential: false },
      { id: 'load-6', name: 'Elevadores', power: 12.0, priority: 6, status: 'standby', essential: false },
    ],
  });
});

export default router;
