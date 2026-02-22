/**
 * Grid Simulator helper — simulates grid events for black start tests
 */

import mqtt from 'mqtt';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

export interface GridSimulatorConfig {
  systemId: string;
}

export class GridSimulator {
  private client: mqtt.MqttClient | null = null;
  private criticalLoadsActive = true;
  private nonCriticalLoadsActive = true;
  private gridOnline = true;

  constructor(private readonly config: GridSimulatorConfig) {}

  async start(): Promise<void> {
    this.client = mqtt.connect(MQTT_URL, { clientId: `grid-sim-${this.config.systemId}` });
    await new Promise<void>((resolve) => this.client!.once('connect', resolve));
  }

  async stop(): Promise<void> {
    this.client?.end();
  }

  async simulateBlackout(): Promise<void> {
    this.gridOnline = false;
    this.criticalLoadsActive = false;
    this.nonCriticalLoadsActive = false;

    const payload = JSON.stringify({
      system_id: this.config.systemId,
      event: 'BLACKOUT',
      grid_voltage: 0,
      grid_frequency: 0,
      timestamp: Date.now(),
    });

    this.client?.publish(`lifo4/${this.config.systemId}/grid/event`, payload, { qos: 1 });
  }

  async restoreGrid(): Promise<void> {
    this.gridOnline = true;
    this.criticalLoadsActive = true;
    this.nonCriticalLoadsActive = true;

    const payload = JSON.stringify({
      system_id: this.config.systemId,
      event: 'GRID_RESTORED',
      grid_voltage: 220,
      grid_frequency: 60,
      timestamp: Date.now(),
    });

    this.client?.publish(`lifo4/${this.config.systemId}/grid/event`, payload, { qos: 1 });
  }

  async getCriticalLoadsStatus(): Promise<boolean> {
    return this.criticalLoadsActive;
  }

  async getNonCriticalLoadsStatus(): Promise<boolean> {
    return this.nonCriticalLoadsActive;
  }

  async isGridOnline(): Promise<boolean> {
    return this.gridOnline;
  }
}
