const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors());
app.use(express.json());

const JWT_SECRET = 'demo-secret-key-lifo4-ems';
const PORT = 3000;

// Demo user com todas as permissoes
const demoUser = {
  id: 'demo-user-001',
  email: 'demo@lifo4.com.br',
  name: 'Usuario Demo',
  role: 'super_admin',
  organizationId: 'org-001',
  permissions: ['all']
};

// Demo data
const systems = [
  { id: 'sys-001', name: 'BESS Teresina Centro', model: 'Lifo4 100kWh', serialNumber: 'LF4-2024-001', connectionStatus: 'online', status: 'charging', soc: 75, soh: 98, power: 25000, siteId: 'site-001', location: { lat: -5.0892, lng: -42.8019 } },
  { id: 'sys-002', name: 'BESS Teresina Sul', model: 'Lifo4 50kWh', serialNumber: 'LF4-2024-002', connectionStatus: 'online', status: 'discharging', soc: 45, soh: 99, power: -15000, siteId: 'site-002', location: { lat: -5.11, lng: -42.82 } },
  { id: 'sys-003', name: 'BESS Timon', model: 'Lifo4 200kWh', serialNumber: 'LF4-2024-003', connectionStatus: 'online', status: 'idle', soc: 90, soh: 97, power: 0, siteId: 'site-003', location: { lat: -5.09, lng: -42.84 } }
];

const evChargers = [
  { id: 'evse-001', name: 'Carregador 1', status: 'available', power: 22000, connector: 'Type2', siteId: 'site-001', ocppStatus: 'online' },
  { id: 'evse-002', name: 'Carregador 2', status: 'charging', power: 22000, connector: 'Type2', siteId: 'site-001', ocppStatus: 'online', currentPower: 18500 },
  { id: 'evse-003', name: 'Carregador DC', status: 'available', power: 150000, connector: 'CCS2', siteId: 'site-002', ocppStatus: 'online' }
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

// Health
app.get('/health', (req, res) => res.json({ status: 'ok', mode: 'demo' }));

// AUTH
app.post('/auth/login', (req, res) => {
  const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, data: { user: demoUser, tokens: { accessToken: token, refreshToken: token, expiresIn: 86400 } } });
});
app.post('/auth/register', (req, res) => res.json({ success: true, data: {} }));
app.post('/auth/logout', (req, res) => res.json({ success: true }));
app.post('/auth/refresh', (req, res) => {
  const token = jwt.sign(demoUser, JWT_SECRET, { expiresIn: '24h' });
  res.json({ success: true, data: { accessToken: token, expiresIn: 86400 } });
});
app.get('/auth/me', auth, (req, res) => res.json({ success: true, data: demoUser }));
app.post('/auth/change-password', auth, (req, res) => res.json({ success: true }));
app.post('/auth/2fa/setup', auth, (req, res) => res.json({ success: true, data: { secret: 'DEMO', qrCode: '' } }));
app.post('/auth/2fa/verify', auth, (req, res) => res.json({ success: true }));
app.post('/auth/2fa/disable', auth, (req, res) => res.json({ success: true }));

// SYSTEMS
app.get('/systems', auth, (req, res) => res.json(paginate(systems)));
app.get('/systems/overview', auth, (req, res) => res.json({ success: true, data: { total: 3, online: 3 } }));
app.get('/systems/:id', auth, (req, res) => res.json({ success: true, data: systems.find(s => s.id === req.params.id) || systems[0] }));
app.post('/systems', auth, (req, res) => res.json({ success: true, data: { id: 'sys-new', ...req.body } }));
app.patch('/systems/:id', auth, (req, res) => res.json({ success: true, data: req.body }));
app.delete('/systems/:id', auth, (req, res) => res.json({ success: true }));
app.get('/systems/:id/protection', auth, (req, res) => res.json({ success: true, data: {} }));
app.patch('/systems/:id/protection', auth, (req, res) => res.json({ success: true, data: req.body }));

// TELEMETRY
app.get('/telemetry/:id/current', auth, (req, res) => {
  res.json({ success: true, data: {
    systemId: req.params.id, timestamp: new Date().toISOString(), soc: 75.5, soh: 98.2,
    totalVoltage: 51.8, current: 45.2, power: 2341,
    temperature: { min: 25, max: 32, average: 28.5 },
    cells: Array.from({length: 16}, (_, i) => ({ index: i, voltage: 3.20 + Math.random() * 0.1, temperature: 25 + Math.random() * 5, status: 'normal' })),
    isCharging: true, isDischarging: false, isBalancing: false
  }});
});
app.get('/telemetry/:id/history', auth, (req, res) => {
  res.json({ success: true, data: Array.from({length: 24}, (_, i) => ({
    timestamp: new Date(Date.now() - i * 3600000).toISOString(), soc: 50 + Math.random() * 40, power: -20000 + Math.random() * 40000
  }))});
});
app.get('/telemetry/:id/cells', auth, (req, res) => res.json({ success: true, data: [] }));
app.get('/telemetry/:id/range', auth, (req, res) => res.json({ success: true, data: [] }));
app.get('/telemetry/:id/soc', auth, (req, res) => res.json({ success: true, data: [] }));
app.get('/telemetry/:id/energy', auth, (req, res) => res.json({ success: true, data: {} }));

// CONTROL
app.post('/control/command', auth, (req, res) => res.json({ success: true, data: {} }));
app.post('/control/:id/mode', auth, (req, res) => res.json({ success: true, data: {} }));
app.post('/control/:id/emergency-stop', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/charge/start', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/charge/stop', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/discharge/start', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/discharge/stop', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/reset-alarms', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/balance/start', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/balance/stop', auth, (req, res) => res.json({ success: true }));
app.post('/control/:id/calibrate-soc', auth, (req, res) => res.json({ success: true }));
app.get('/control/:id/schedules', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/control/schedules', auth, (req, res) => res.json({ success: true, data: {} }));

// ALERTS
app.get('/alerts', auth, (req, res) => res.json(paginate(alerts)));
app.get('/alerts/summary', auth, (req, res) => res.json({ success: true, data: { total: 2, critical: 0, high: 0, medium: 1, low: 1, unread: 1, unacknowledged: 1 } }));
app.get('/alerts/unread-count', auth, (req, res) => res.json({ success: true, data: { count: 1 } }));
app.get('/alerts/stats', auth, (req, res) => res.json({ success: true, data: { critical: 0, warning: 1, info: 1 } }));
app.get('/alerts/:id', auth, (req, res) => res.json({ success: true, data: alerts[0] }));
app.post('/alerts/:id/acknowledge', auth, (req, res) => res.json({ success: true }));

// EV CHARGERS
app.get('/ev-chargers', auth, (req, res) => res.json(paginate(evChargers)));
app.get('/ev-chargers/:id', auth, (req, res) => res.json({ success: true, data: evChargers[0] }));
app.get('/ev-chargers/:id/status', auth, (req, res) => res.json({ success: true, data: { status: 'available' } }));
app.post('/ev-chargers/:id/start', auth, (req, res) => res.json({ success: true }));
app.post('/ev-chargers/:id/stop', auth, (req, res) => res.json({ success: true }));
app.get('/ev-chargers/sessions/active', auth, (req, res) => res.json({ success: true, data: [] }));

// CAMERAS
app.get('/cameras', auth, (req, res) => res.json(paginate(cameras)));
app.get('/cameras/:id', auth, (req, res) => res.json({ success: true, data: cameras[0] }));
app.get('/cameras/:id/stream', auth, (req, res) => res.json({ success: true, data: { streamUrl: '', hlsUrl: '' } }));
app.post('/cameras/:id/ptz', auth, (req, res) => res.json({ success: true }));
app.post('/cameras/:id/snapshot', auth, (req, res) => res.json({ success: true, data: {} }));
app.get('/cameras/:id/events', auth, (req, res) => res.json({ success: true, data: [] }));

// MICROGRIDS
app.get('/microgrids', auth, (req, res) => res.json(paginate(microgrids)));
app.get('/microgrids/:id', auth, (req, res) => res.json({ success: true, data: microgrids[0] }));
app.get('/microgrids/:id/status', auth, (req, res) => res.json({ success: true, data: {} }));
app.post('/microgrids/:id/mode', auth, (req, res) => res.json({ success: true }));
app.post('/microgrids/:id/island', auth, (req, res) => res.json({ success: true }));
app.post('/microgrids/:id/blackstart', auth, (req, res) => res.json({ success: true }));

// PROSPECTS
app.get('/prospects', auth, (req, res) => res.json(paginate(prospects)));
app.get('/prospects/:id', auth, (req, res) => res.json({ success: true, data: prospects[0] }));
app.post('/prospects', auth, (req, res) => res.json({ success: true, data: {} }));
app.patch('/prospects/:id', auth, (req, res) => res.json({ success: true, data: {} }));
app.delete('/prospects/:id', auth, (req, res) => res.json({ success: true }));
app.get('/prospects/:id/analysis', auth, (req, res) => res.json({ success: true, data: {} }));
app.get('/prospects/:id/recommendations', auth, (req, res) => res.json({ success: true, data: { recommendations: [] } }));

// USERS
app.get('/users', auth, (req, res) => res.json(paginate(users)));
app.get('/users/:id', auth, (req, res) => res.json({ success: true, data: users[0] }));
app.post('/users', auth, (req, res) => res.json({ success: true, data: {} }));
app.patch('/users/:id', auth, (req, res) => res.json({ success: true, data: {} }));
app.delete('/users/:id', auth, (req, res) => res.json({ success: true }));

// SITES
app.get('/sites', auth, (req, res) => res.json({ success: true, data: [{ id: 'site-001', name: 'Site Principal' }] }));
app.get('/sites/:id', auth, (req, res) => res.json({ success: true, data: { id: 'site-001', name: 'Site Principal' } }));

// ORGANIZATIONS
app.get('/organizations', auth, (req, res) => res.json({ success: true, data: [{ id: 'org-001', name: 'Lifo4 Energia' }] }));
app.get('/organizations/:id', auth, (req, res) => res.json({ success: true, data: { id: 'org-001', name: 'Lifo4 Energia' } }));

// REPORTS
app.get('/reports', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/reports/generate', auth, (req, res) => res.json({ success: true, data: { reportId: 'rpt-001' } }));
app.get('/reports/:id', auth, (req, res) => res.json({ success: true, data: {} }));

// DASHBOARD
app.get('/dashboard/stats', auth, (req, res) => res.json({ success: true, data: {
  totalSystems: 3, onlineSystems: 3, totalCapacity: 350, currentPower: 10000, todayEnergy: 245.5,
  alerts: { critical: 0, warning: 1, info: 1 }
}}));
app.get('/dashboard/overview', auth, (req, res) => res.json({ success: true, data: {} }));

// SETTINGS
app.get('/settings', auth, (req, res) => res.json({ success: true, data: {} }));
app.patch('/settings', auth, (req, res) => res.json({ success: true, data: {} }));
app.get('/settings/notifications', auth, (req, res) => res.json({ success: true, data: {} }));
app.patch('/settings/notifications', auth, (req, res) => res.json({ success: true, data: {} }));

// AUDIT
app.get('/audit-logs', auth, (req, res) => res.json({ success: true, data: [] }));

// BMS CONFIG
app.get('/bms-config', auth, (req, res) => res.json({ success: true, data: [] }));
app.get('/bms-config/:id', auth, (req, res) => res.json({ success: true, data: {} }));
app.patch('/bms-config/:id', auth, (req, res) => res.json({ success: true, data: {} }));

// FLEET
app.get('/fleet', auth, (req, res) => res.json({ success: true, data: systems }));
app.get('/fleet/stats', auth, (req, res) => res.json({ success: true, data: {} }));

// OPTIMIZATION
app.get('/optimization/recommendations', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/optimization/run', auth, (req, res) => res.json({ success: true, data: {} }));

// MAINTENANCE
app.get('/maintenance/schedules', auth, (req, res) => res.json({ success: true, data: [] }));
app.get('/maintenance/history', auth, (req, res) => res.json({ success: true, data: [] }));

// API KEYS
app.get('/api-keys', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/api-keys', auth, (req, res) => res.json({ success: true, data: {} }));
app.delete('/api-keys/:id', auth, (req, res) => res.json({ success: true }));

// NOTIFICATIONS
app.get('/notifications', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/notifications/:id/read', auth, (req, res) => res.json({ success: true }));

// GRID
app.get('/grid/status', auth, (req, res) => res.json({ success: true, data: { connected: true, frequency: 60, voltage: 220 } }));
app.get('/grid/tariffs', auth, (req, res) => res.json({ success: true, data: [] }));

// ENERGY
app.get('/energy/consumption', auth, (req, res) => res.json({ success: true, data: [] }));
app.get('/energy/generation', auth, (req, res) => res.json({ success: true, data: [] }));
app.get('/energy/forecast', auth, (req, res) => res.json({ success: true, data: [] }));

// ANALYTICS
app.get('/analytics/summary', auth, (req, res) => res.json({ success: true, data: {} }));
app.get('/analytics/trends', auth, (req, res) => res.json({ success: true, data: [] }));

// SUPPORT
app.get('/support/tickets', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/support/tickets', auth, (req, res) => res.json({ success: true, data: {} }));

// FIRMWARE
app.get('/firmware/updates', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/firmware/update/:id', auth, (req, res) => res.json({ success: true }));

// INTEGRATIONS
app.get('/integrations', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/integrations', auth, (req, res) => res.json({ success: true, data: {} }));

// WEBHOOKS
app.get('/webhooks', auth, (req, res) => res.json({ success: true, data: [] }));
app.post('/webhooks', auth, (req, res) => res.json({ success: true, data: {} }));

// Catch-all
app.use(auth, (req, res) => {
  console.log('Unhandled:', req.method, req.path);
  res.json({ success: true, data: [] });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(50));
  console.log('  Lifo4 EMS - DEMO MODE (Full)');
  console.log('  Port: ' + PORT);
  console.log('='.repeat(50));
});
