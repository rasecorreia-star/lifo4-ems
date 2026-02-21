import { http, HttpResponse, delay } from 'msw';

// Helper para gerar dados mock baseado em timestamps
function generateMockTelemetry(systemId: string) {
  return {
    systemId,
    timestamp: new Date().toISOString(),
    soc: Math.floor(Math.random() * 100),
    soh: 95 + Math.random() * 5,
    isCharging: Math.random() > 0.5,
    isDischarging: Math.random() > 0.5,
    temperature: {
      min: 20 + Math.random() * 5,
      max: 25 + Math.random() * 10,
      average: 22 + Math.random() * 8,
    },
    voltage: {
      min: 390,
      max: 410,
      average: 400 + Math.random() * 10,
    },
    current: {
      min: -100,
      max: 100,
      average: Math.random() * 50 - 25,
    },
    power: Math.random() * 50000 - 25000,
    energy: Math.random() * 1000,
  };
}

function generateMockSystem(id: string) {
  return {
    id,
    name: `Sistema ${id}`,
    location: `Localização ${id}`,
    connectionStatus: Math.random() > 0.1 ? 'online' : 'offline',
    capacity: 100000,
    installDate: new Date(2023, 0, 1).toISOString(),
    status: 'active',
    lastUpdate: new Date().toISOString(),
  };
}

export const handlers = [
  // Auth endpoints
  http.post('/api/v1/auth/login', async ({ request }) => {
    await delay(500);
    const body = await request.json();

    return HttpResponse.json({
      success: true,
      data: {
        token: 'demo-jwt-token-' + Math.random().toString(36),
        user: {
          id: 'demo-user-1',
          name: 'Demo User',
          email: (body as any).email || 'demo@lifo4.com.br',
          role: 'admin',
          allowedSystems: ['SYS-001', 'SYS-002', 'SYS-003'],
        },
      },
    });
  }),

  http.post('/api/v1/auth/logout', async () => {
    await delay(200);
    return HttpResponse.json({ success: true });
  }),

  http.post('/api/v1/auth/refresh', async () => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: {
        token: 'demo-jwt-token-' + Math.random().toString(36),
      },
    });
  }),

  // Systems endpoints
  http.get('/api/v1/systems', async () => {
    await delay(600);
    return HttpResponse.json({
      success: true,
      data: [
        generateMockSystem('SYS-001'),
        generateMockSystem('SYS-002'),
        generateMockSystem('SYS-003'),
      ],
    });
  }),

  http.get('/api/v1/systems/:systemId', async ({ params }) => {
    await delay(400);
    return HttpResponse.json({
      success: true,
      data: generateMockSystem(params.systemId as string),
    });
  }),

  http.post('/api/v1/systems', async ({ request }) => {
    await delay(800);
    const body = await request.json();
    return HttpResponse.json(
      {
        success: true,
        data: { id: 'SYS-' + Math.random().toString(36).substr(2, 9), ...(body as any) },
      },
      { status: 201 }
    );
  }),

  // Telemetry endpoints
  http.get('/api/v1/systems/:systemId/telemetry/current', async ({ params }) => {
    await delay(300);
    return HttpResponse.json({
      success: true,
      data: generateMockTelemetry(params.systemId as string),
    });
  }),

  http.get('/api/v1/systems/:systemId/telemetry/history', async ({ params, request }) => {
    await delay(500);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '100');

    const history = [];
    for (let i = 0; i < Math.min(limit, 50); i++) {
      const timestamp = new Date();
      timestamp.setHours(timestamp.getHours() - i);
      history.push({
        ...generateMockTelemetry(params.systemId as string),
        timestamp: timestamp.toISOString(),
      });
    }

    return HttpResponse.json({
      success: true,
      data: history,
    });
  }),

  // Alerts endpoints
  http.get('/api/v1/alerts', async ({ request }) => {
    await delay(400);
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const alerts = [];
    for (let i = 1; i <= Math.min(limit, 10); i++) {
      alerts.push({
        id: 'ALERT-' + i,
        systemId: `SYS-${Math.floor(i / 3) + 1}`,
        severity: ['low', 'medium', 'high', 'critical'][Math.floor(Math.random() * 4)],
        title: `Alert ${i}`,
        description: `Mock alert message ${i}`,
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        read: Math.random() > 0.5,
      });
    }

    return HttpResponse.json({
      success: true,
      data: alerts,
    });
  }),

  // Control endpoints
  http.post('/api/v1/systems/:systemId/control/charge', async ({ params }) => {
    await delay(800);
    return HttpResponse.json({
      success: true,
      data: {
        systemId: params.systemId,
        command: 'charge',
        status: 'executing',
        timestamp: new Date().toISOString(),
      },
    });
  }),

  http.post('/api/v1/systems/:systemId/control/discharge', async ({ params }) => {
    await delay(800);
    return HttpResponse.json({
      success: true,
      data: {
        systemId: params.systemId,
        command: 'discharge',
        status: 'executing',
        timestamp: new Date().toISOString(),
      },
    });
  }),

  http.post('/api/v1/systems/:systemId/control/stop', async ({ params }) => {
    await delay(600);
    return HttpResponse.json({
      success: true,
      data: {
        systemId: params.systemId,
        command: 'stop',
        status: 'completed',
        timestamp: new Date().toISOString(),
      },
    });
  }),

  // Device Discovery endpoints
  http.post('/api/v1/discovery/new', async () => {
    await delay(2000);
    return HttpResponse.json({
      success: true,
      data: {
        discoveryId: 'DISCO-' + Math.random().toString(36).substr(2, 9),
        status: 'in_progress',
        foundDevices: [],
      },
    });
  }),

  http.post('/api/v1/discovery/scan', async () => {
    await delay(3000);
    return HttpResponse.json({
      success: true,
      data: {
        discoveryId: 'DISCO-' + Math.random().toString(36).substr(2, 9),
        status: 'completed',
        foundDevices: [
          { id: 'DEV-001', type: 'BMS', model: 'LFP100' },
          { id: 'DEV-002', type: 'Inverter', model: 'INV-50K' },
          { id: 'DEV-003', type: 'Meter', model: 'EM-01' },
        ],
      },
    });
  }),

  http.post('/api/v1/discovery/add', async ({ request }) => {
    await delay(1000);
    const body = await request.json();
    return HttpResponse.json({
      success: true,
      data: {
        systemId: 'SYS-' + Math.random().toString(36).substr(2, 9),
        devices: (body as any).devices || [],
        status: 'configured',
      },
    });
  }),

  // Fallback para endpoints não mapeados
  http.all('*', async () => {
    await delay(200);
    return HttpResponse.json(
      {
        success: false,
        error: 'Not implemented in mock server',
      },
      { status: 501 }
    );
  }),
];
