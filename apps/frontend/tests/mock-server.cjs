/**
 * Mock Server for E2E Testing
 * Simulates all backend APIs for Playwright tests
 */

const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ============================================================================
// AUTH ENDPOINTS
// ============================================================================

app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;

  // Accept any credentials for testing
  if (email && password) {
    res.json({
      success: true,
      data: {
        user: {
          id: 'user-1',
          email: email,
          name: 'Admin Teste',
          role: 'super_admin',
          organizationId: 'org-1',
        },
        token: 'mock-jwt-token-' + Date.now(),
        refreshToken: 'mock-refresh-token-' + Date.now(),
      }
    });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.post('/api/v1/auth/dev-login', (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: 'dev-user-1',
        email: 'admin@lifo4.com.br',
        name: 'Dev Admin',
        role: 'super_admin',
        organizationId: 'org-1',
      },
      token: 'mock-dev-jwt-token-' + Date.now(),
      refreshToken: 'mock-dev-refresh-token-' + Date.now(),
    }
  });
});

app.get('/api/v1/auth/me', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'user-1',
      email: 'admin@lifo4.com.br',
      name: 'Admin Teste',
      role: 'super_admin',
      organizationId: 'org-1',
    }
  });
});

app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ success: true });
});

// ============================================================================
// SYSTEMS ENDPOINTS
// ============================================================================

const mockSystems = [
  {
    id: 'sys-1',
    name: 'BESS Industrial 01',
    model: 'LFP 16S1P',
    serialNumber: 'SN-001',
    firmwareVersion: '2.1.0',
    capacity: 14.3,
    nominalVoltage: 51.2,
    maxChargePower: 5000,
    maxDischargePower: 5000,
    status: 'normal',
    connectionStatus: 'online',
    operationMode: 'auto',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
    lastCommunication: new Date().toISOString(),
  },
  {
    id: 'sys-2',
    name: 'BESS Comercial 02',
    model: 'LFP 16S2P',
    serialNumber: 'SN-002',
    firmwareVersion: '2.1.0',
    capacity: 28.6,
    nominalVoltage: 51.2,
    maxChargePower: 10000,
    maxDischargePower: 10000,
    status: 'normal',
    connectionStatus: 'online',
    operationMode: 'manual',
    createdAt: '2024-02-01T00:00:00Z',
    updatedAt: new Date().toISOString(),
  },
];

app.get('/api/v1/systems', (req, res) => {
  res.json({
    success: true,
    data: mockSystems,
    pagination: {
      total: mockSystems.length,
      page: 1,
      limit: 20,
    }
  });
});

app.get('/api/v1/systems/:id', (req, res) => {
  const system = mockSystems.find(s => s.id === req.params.id) || mockSystems[0];
  res.json({
    success: true,
    data: system,
  });
});

app.post('/api/v1/systems', (req, res) => {
  const newSystem = {
    id: 'sys-' + Date.now(),
    ...req.body,
    status: 'offline',
    connectionStatus: 'offline',
    operationMode: 'standby',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  mockSystems.push(newSystem);
  res.json({ success: true, data: newSystem });
});

// ============================================================================
// TELEMETRY ENDPOINTS
// ============================================================================

app.get('/api/v1/telemetry/:systemId/current', (req, res) => {
  res.json({
    success: true,
    data: {
      systemId: req.params.systemId,
      timestamp: new Date().toISOString(),
      soc: 78.5 + Math.random() * 5,
      soh: 94.2,
      voltage: 51.2 + Math.random() * 2 - 1,
      current: Math.random() * 50 - 25,
      power: Math.random() * 5000 - 2500,
      temperature: 25 + Math.random() * 10,
      isCharging: Math.random() > 0.5,
      isDischarging: Math.random() > 0.5,
      cells: Array.from({ length: 16 }, (_, i) => ({
        id: i + 1,
        voltage: 3.2 + Math.random() * 0.1,
        temperature: 25 + Math.random() * 5,
      })),
    }
  });
});

app.get('/api/v1/telemetry/:systemId/history', (req, res) => {
  const dataPoints = 60;
  res.json({
    success: true,
    data: Array.from({ length: dataPoints }, (_, i) => ({
      timestamp: new Date(Date.now() - (dataPoints - i) * 60000).toISOString(),
      soc: 50 + i * 0.5,
      voltage: 51.2 + Math.sin(i * 0.1) * 2,
      current: Math.sin(i * 0.2) * 25,
      power: Math.sin(i * 0.2) * 2500,
      temperature: 25 + Math.sin(i * 0.05) * 5,
    })),
  });
});

// ============================================================================
// DIGITAL TWIN ENDPOINTS
// ============================================================================

app.post('/api/v1/digital-twin/simulate', (req, res) => {
  const { config } = req.body;
  const timeSteps = Math.floor((config?.simulationTime || 3600) / (config?.timeStep || 60));

  res.json({
    success: true,
    result: {
      time: Array.from({ length: timeSteps }, (_, i) => i * (config?.timeStep || 60)),
      voltage: Array.from({ length: timeSteps }, (_, i) => {
        const soc = (config?.initialSoc || 0.5) + i * 0.01;
        return 51.2 + soc * 5 - 2.5;
      }),
      current: Array.from({ length: timeSteps }, () => (config?.cRate || 0.5) * 100 * (Math.random() > 0.5 ? 1 : -1)),
      soc: Array.from({ length: timeSteps }, (_, i) => Math.min(1, (config?.initialSoc || 0.5) + i * 0.01)),
      temperature: Array.from({ length: timeSteps }, (_, i) => (config?.temperature || 25) + i * 0.1),
      power: Array.from({ length: timeSteps }, () => (config?.cRate || 0.5) * 100 * 51.2 * (Math.random() > 0.5 ? 1 : -1)),
    }
  });
});

app.post('/api/v1/digital-twin/degradation/predict', (req, res) => {
  const { factors } = req.body;
  const currentSoh = 94.2;
  const degradationRate = 2.5;

  res.json({
    success: true,
    prediction: {
      currentSoh: currentSoh,
      predictedSoh: {
        oneYear: currentSoh - degradationRate,
        threeYears: currentSoh - degradationRate * 3,
        fiveYears: currentSoh - degradationRate * 5,
      },
      remainingLife: {
        cycles: 3500,
        years: 5.6,
        eolDate: new Date(Date.now() + 5.6 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
      degradationRatePerYear: degradationRate,
      primaryStressor: 'cycle_aging',
      recommendations: [
        'Manter SOC entre 20% e 80% para maximizar vida util',
        'Evitar temperaturas acima de 35C durante carga',
        'Reduzir C-rate de descarga para menos de 0.5C',
        'Considerar balanceamento ativo para celulas desiguais',
      ],
      confidence: 87.5,
    }
  });
});

app.post('/api/v1/digital-twin/compare/:systemId', (req, res) => {
  res.json({
    success: true,
    comparison: {
      voltage: {
        mae: 0.012,
        rmse: 0.018,
        mape: 0.8,
      },
      current: {
        mae: 0.5,
        rmse: 0.8,
        mape: 2.1,
      },
      soc: {
        mae: 0.5,
        rmse: 0.7,
        mape: 1.2,
      },
      overallAccuracy: 0.962,
      modelValid: true,
    }
  });
});

// ============================================================================
// ALERTS ENDPOINTS
// ============================================================================

app.get('/api/v1/alerts', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'alert-1',
        systemId: 'sys-1',
        type: 'warning',
        severity: 'medium',
        message: 'Temperatura da celula 5 acima do normal',
        timestamp: new Date().toISOString(),
        acknowledged: false,
      },
      {
        id: 'alert-2',
        systemId: 'sys-1',
        type: 'info',
        severity: 'low',
        message: 'Balanceamento de celulas iniciado',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        acknowledged: true,
      },
    ]
  });
});

// ============================================================================
// TRADING ENDPOINTS
// ============================================================================

app.get('/api/v1/trading/prices', (req, res) => {
  res.json({
    success: true,
    data: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      price: 150 + Math.sin(i * 0.5) * 100 + Math.random() * 50,
      predicted: 150 + Math.sin(i * 0.5) * 100,
    }))
  });
});

app.get('/api/v1/trading/positions', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'pos-1',
        type: 'buy',
        amount: 500,
        price: 180.5,
        status: 'open',
        profit: 125.50,
        timestamp: new Date().toISOString(),
      },
      {
        id: 'pos-2',
        type: 'sell',
        amount: 300,
        price: 220.0,
        status: 'closed',
        profit: -45.20,
        timestamp: new Date(Date.now() - 7200000).toISOString(),
      },
    ]
  });
});

app.get('/api/v1/trading/opportunities', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'opp-1',
        type: 'arbitrage',
        buyPrice: 150.0,
        sellPrice: 185.0,
        profit: 35.0,
        confidence: 0.85,
        window: '14:00 - 18:00',
      },
    ]
  });
});

// ============================================================================
// NLP/ASSISTANT ENDPOINTS
// ============================================================================

app.post('/api/v1/nlp/query', (req, res) => {
  const { message } = req.body;

  res.json({
    success: true,
    data: {
      response: `Recebi sua mensagem: "${message}". O sistema BESS esta operando normalmente com SOC de 78.5% e todas as celulas dentro dos parametros.`,
      intent: 'status_query',
      entities: [],
      actions: [],
      suggestions: [
        'Ver detalhes do sistema',
        'Gerar relatorio',
        'Verificar alertas',
      ],
    }
  });
});

// ============================================================================
// VPP ENDPOINTS
// ============================================================================

app.get('/api/v1/vpp/assets', (req, res) => {
  res.json({
    success: true,
    data: [
      { id: 'vpp-1', name: 'BESS Industrial 01', type: 'bess', capacity: 14.3, status: 'online' },
      { id: 'vpp-2', name: 'BESS Comercial 02', type: 'bess', capacity: 28.6, status: 'online' },
      { id: 'vpp-3', name: 'Solar Array 01', type: 'solar', capacity: 50.0, status: 'online' },
    ]
  });
});

app.get('/api/v1/vpp/dispatch', (req, res) => {
  res.json({
    success: true,
    data: {
      mode: 'auto',
      totalCapacity: 92.9,
      currentOutput: 45.5,
      schedule: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        output: Math.sin(i * 0.3) * 40 + 50,
      })),
    }
  });
});

// ============================================================================
// REPORTS ENDPOINTS
// ============================================================================

app.get('/api/v1/reports', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'report-1',
        name: 'Relatorio Mensal Janeiro 2026',
        type: 'monthly',
        createdAt: '2026-01-31T00:00:00Z',
        status: 'completed',
      },
      {
        id: 'report-2',
        name: 'Analise de Performance Q4 2025',
        type: 'quarterly',
        createdAt: '2026-01-05T00:00:00Z',
        status: 'completed',
      },
    ]
  });
});

app.post('/api/v1/reports/generate', (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'report-' + Date.now(),
      status: 'processing',
      message: 'Relatorio sendo gerado...',
    }
  });
});

// ============================================================================
// GAMIFICATION ENDPOINTS
// ============================================================================

app.get('/api/v1/gamification/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      points: 12500,
      level: 8,
      rank: 'Expert',
      achievements: [
        { id: 'ach-1', name: 'Primeiro Login', icon: 'star', earned: true },
        { id: 'ach-2', name: '100% Uptime', icon: 'award', earned: true },
        { id: 'ach-3', name: 'Energia Verde', icon: 'leaf', earned: false },
      ],
      leaderboard: [
        { rank: 1, name: 'Usuario A', points: 25000 },
        { rank: 2, name: 'Usuario B', points: 18500 },
        { rank: 3, name: 'Voce', points: 12500 },
      ],
    }
  });
});

// ============================================================================
// SLA ENDPOINTS
// ============================================================================

app.get('/api/v1/sla/metrics', (req, res) => {
  res.json({
    success: true,
    data: {
      uptime: 99.95,
      latency: {
        p50: 45,
        p95: 120,
        p99: 250,
      },
      compliance: 98.5,
      incidents: 2,
    }
  });
});

// ============================================================================
// CATCH-ALL FOR UNHANDLED ROUTES
// ============================================================================

app.all('*', (req, res) => {
  console.log(`[Mock Server] Unhandled: ${req.method} ${req.path}`);
  res.json({
    success: true,
    data: [],
    message: 'Mock response'
  });
});

// ============================================================================
// START SERVER
// ============================================================================

const PORT = process.env.MOCK_PORT || 3001;

app.listen(PORT, () => {
  console.log(`Mock Server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  - POST /api/v1/auth/login');
  console.log('  - GET  /api/v1/systems');
  console.log('  - POST /api/v1/digital-twin/simulate');
  console.log('  - POST /api/v1/digital-twin/degradation/predict');
  console.log('  - GET  /api/v1/trading/prices');
  console.log('  - POST /api/v1/nlp/query');
  console.log('  - GET  /api/v1/vpp/assets');
  console.log('  ... and more');
});

module.exports = app;
