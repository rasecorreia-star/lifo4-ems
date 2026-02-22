/**
 * Prometheus Metrics Middleware — Phase 8
 * Instruments all HTTP requests with latency, throughput metrics.
 */

import { Request, Response, NextFunction } from 'express';
import { Registry, Counter, Histogram, Gauge } from 'prom-client';

// ─── Registry ────────────────────────────────────────────────────────────────

export const metricsRegistry = new Registry();
metricsRegistry.setDefaultLabels({ service: 'lifo4-ems-backend' });

// ─── Metrics Definitions ─────────────────────────────────────────────────────

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [metricsRegistry],
});

export const mqttMessagesReceived = new Counter({
  name: 'mqtt_messages_received_total',
  help: 'Total MQTT messages received',
  labelNames: ['topic'],
  registers: [metricsRegistry],
});

export const mqttMessagesSent = new Counter({
  name: 'mqtt_messages_sent_total',
  help: 'Total MQTT messages sent',
  labelNames: ['topic'],
  registers: [metricsRegistry],
});

export const activeWebSocketConnections = new Gauge({
  name: 'active_websocket_connections',
  help: 'Number of active WebSocket connections',
  registers: [metricsRegistry],
});

export const activeSystemsTotal = new Gauge({
  name: 'active_systems_total',
  help: 'Number of BESS systems currently online',
  registers: [metricsRegistry],
});

export const influxWriteDuration = new Histogram({
  name: 'influxdb_write_duration_seconds',
  help: 'InfluxDB write operation duration',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

export const postgresQueryDuration = new Histogram({
  name: 'postgres_query_duration_seconds',
  help: 'PostgreSQL query duration',
  labelNames: ['query_type'],
  buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

// ─── Middleware ───────────────────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = (req.route?.path ?? req.path ?? 'unknown').replace(/\/[0-9a-f-]{8,}/gi, '/:id');
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    httpRequestDuration.observe(labels, duration);
    httpRequestsTotal.inc(labels);
  });

  next();
}

// ─── Metrics endpoint handler ─────────────────────────────────────────────────

export async function metricsHandler(req: Request, res: Response): Promise<void> {
  res.setHeader('Content-Type', metricsRegistry.contentType);
  const metrics = await metricsRegistry.metrics();
  res.end(metrics);
}
