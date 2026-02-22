/**
 * Load Simulator helper — simulates facility electrical demand for peak shaving tests
 */

import mqtt from 'mqtt';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

export interface LoadSimulatorConfig {
  systemId: string;
  baselineKw: number;
}

export class LoadSimulator {
  private client: mqtt.MqttClient | null = null;
  private currentDemandKw: number;
  private interval: ReturnType<typeof setInterval> | null = null;
  private measuredNetDemandKw = 0;

  constructor(private readonly config: LoadSimulatorConfig) {
    this.currentDemandKw = config.baselineKw;
  }

  async start(): Promise<void> {
    this.client = mqtt.connect(MQTT_URL, { clientId: `load-sim-${this.config.systemId}` });
    await new Promise<void>((resolve) => this.client!.once('connect', resolve));

    // Subscribe to battery power output to compute net demand
    this.client.subscribe(`lifo4/${this.config.systemId}/telemetry`);
    this.client.on('message', (_topic, payload) => {
      const data = JSON.parse(payload.toString());
      const batteryPowerKw = data.powerKw ?? 0;
      this.measuredNetDemandKw = Math.max(0, this.currentDemandKw - Math.abs(batteryPowerKw));
    });

    this.interval = setInterval(() => this.publishDemand(), 2000);
  }

  async stop(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    this.client?.end();
  }

  async setDemandKw(kw: number): Promise<void> {
    this.currentDemandKw = kw;
    await this.publishDemand();
  }

  async getMeasuredNetDemandKw(): Promise<number> {
    return this.measuredNetDemandKw;
  }

  private publishDemand(): void {
    if (!this.client?.connected) return;
    const payload = JSON.stringify({
      system_id: this.config.systemId,
      demand_kw: this.currentDemandKw,
      timestamp: Date.now(),
    });
    this.client.publish(`lifo4/${this.config.systemId}/demand`, payload, { qos: 0 });
  }
}
