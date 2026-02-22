/**
 * BMS Simulator helper for integration tests
 * Simulates a real BESS device publishing MQTT telemetry and responding to commands
 */

import mqtt from 'mqtt';
import EventEmitter from 'events';

const MQTT_URL = process.env.MQTT_URL ?? 'mqtt://localhost:1883';

export interface BmsConfig {
  systemId: string;
  socPercent: number;
  voltageV?: number;
  temperatureC?: number;
  powerKw?: number;
}

export interface BmsStatus {
  mode: 'IDLE' | 'CHARGING' | 'DISCHARGING' | 'EMERGENCY_STOP' | 'STANDBY';
  socPercent: number;
  voltageV: number;
  currentA: number;
  temperatureC: number;
  powerKw: number;
}

export class BmsSimulator extends EventEmitter {
  private client: mqtt.MqttClient | null = null;
  private status: BmsStatus;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly config: BmsConfig) {
    super();
    this.status = {
      mode: 'IDLE',
      socPercent: config.socPercent,
      voltageV: config.voltageV ?? 48.5,
      currentA: 0,
      temperatureC: config.temperatureC ?? 25,
      powerKw: config.powerKw ?? 0,
    };
  }

  async start(): Promise<void> {
    this.client = mqtt.connect(MQTT_URL, {
      clientId: `bms-sim-${this.config.systemId}`,
    });

    await new Promise<void>((resolve) => this.client!.once('connect', resolve));

    // Subscribe to command topics
    this.client.subscribe(`lifo4/${this.config.systemId}/commands`);
    this.client.subscribe(`lifo4/${this.config.systemId}/ota/update`);

    this.client.on('message', (topic, payload) => {
      const data = JSON.parse(payload.toString());
      this.handleCommand(topic, data);
    });

    // Start periodic telemetry publishing
    this.interval = setInterval(() => this.publishTelemetry(), 5000);
    await this.publishTelemetry();
  }

  async stop(): Promise<void> {
    if (this.interval) clearInterval(this.interval);
    this.client?.end();
  }

  async publishTelemetry(override: Partial<BmsStatus> = {}): Promise<void> {
    if (!this.client?.connected) return;

    const telemetry = {
      system_id: this.config.systemId,
      ...this.status,
      ...override,
      timestamp: Date.now(),
    };

    return new Promise((resolve) => {
      this.client!.publish(
        `lifo4/${this.config.systemId}/telemetry`,
        JSON.stringify(telemetry),
        { qos: 1 },
        () => resolve(),
      );
    });
  }

  async waitForCommand(
    commandType: string,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | false> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      this.once(`command:${commandType}`, (data) => {
        clearTimeout(timer);
        resolve(data);
      });
    });
  }

  async waitForMode(mode: BmsStatus['mode'], timeoutMs: number): Promise<boolean> {
    if (this.status.mode === mode) return true;

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      const check = () => {
        if (this.status.mode === mode) {
          clearTimeout(timer);
          resolve(true);
        }
      };
      this.on('status:changed', check);
      setTimeout(() => this.removeListener('status:changed', check), timeoutMs);
    });
  }

  async waitForSOC(targetSoc: number, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), timeoutMs);
      const interval = setInterval(() => {
        if (this.status.socPercent <= targetSoc) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(true);
        }
      }, 500);
    });
  }

  async getStatus(): Promise<BmsStatus> {
    return { ...this.status };
  }

  async getOutputFrequency(): Promise<number> {
    // Simulated frequency output
    return this.status.mode === 'IDLE' ? 60.0 : 59.98 + Math.random() * 0.04;
  }

  async forceSOC(soc: number): Promise<void> {
    this.status.socPercent = soc;
    await this.publishTelemetry();
  }

  async forceTemperature(temp: number): Promise<void> {
    this.status.temperatureC = temp;
    await this.publishTelemetry();
  }

  private handleCommand(topic: string, data: Record<string, unknown>): void {
    const command = data.command as string | undefined;

    if (!command) return;

    switch (command) {
      case 'charge':
        this.status.mode = 'CHARGING';
        this.status.currentA = 20;
        this.status.powerKw = this.status.voltageV * this.status.currentA / 1000;
        this.emit('command:charge', data);
        break;
      case 'discharge':
        this.status.mode = 'DISCHARGING';
        this.status.currentA = -20;
        this.status.powerKw = -(this.status.voltageV * 20 / 1000);
        this.emit('command:discharge', data);
        break;
      case 'emergency_stop':
        this.status.mode = 'EMERGENCY_STOP';
        this.status.currentA = 0;
        this.status.powerKw = 0;
        this.emit('command:emergency_stop', data);
        break;
      case 'idle':
        this.status.mode = 'IDLE';
        this.status.currentA = 0;
        this.status.powerKw = 0;
        break;
    }

    this.emit('status:changed', this.status);
  }
}
