import { getFirestore, Collections } from '../config/firebase.js';
import { TelemetryData, CellData, CellStatus, AlarmFlag, WarningFlag } from '../models/types.js';
import { NotFoundError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

interface TelemetryQuery {
  systemId: string;
  startDate?: Date;
  endDate?: Date;
  resolution?: 'raw' | '1m' | '5m' | '15m' | '1h' | '1d';
  fields?: string[];
  limit?: number;
}

interface RawTelemetryFromBMS {
  packVoltage: number;
  current: number;
  soc: number;
  cellVoltages: number[];
  temperatures: number[];
  balancingStatus: number;
  alarms: number;
  warnings: number;
  cycleCount: number;
  capacity: number;
}

export class TelemetryService {
  private db = getFirestore();

  /**
   * Process and store incoming telemetry data from MQTT
   */
  async processTelemetry(systemId: string, rawData: RawTelemetryFromBMS): Promise<TelemetryData> {
    const now = new Date();

    // Calculate derived values
    const power = rawData.packVoltage * rawData.current;
    const isCharging = rawData.current > 0.1;
    const isDischarging = rawData.current < -0.1;

    // Process cell data
    const cells = this.processCellData(rawData.cellVoltages, rawData.balancingStatus);

    // Process temperature data
    const temperature = this.processTemperatureData(rawData.temperatures);

    // Process alarms and warnings
    const alarms = this.decodeAlarms(rawData.alarms);
    const warnings = this.decodeWarnings(rawData.warnings);

    // Calculate SOH (simplified - would use more complex algorithm in production)
    const nominalCapacity = 100; // Get from system config
    const soh = (rawData.capacity / nominalCapacity) * 100;

    // Create telemetry record
    const telemetry: Omit<TelemetryData, 'id'> = {
      systemId,
      timestamp: now,
      soc: rawData.soc,
      soh: Math.min(100, Math.max(0, soh)),
      totalVoltage: rawData.packVoltage,
      current: rawData.current,
      power,
      temperature,
      cells,
      chargeCapacity: rawData.capacity,
      energyRemaining: (rawData.capacity * rawData.packVoltage) / 1000, // kWh
      cycleCount: rawData.cycleCount,
      isCharging,
      isDischarging,
      isBalancing: rawData.balancingStatus > 0,
      alarms,
      warnings,
    };

    // Store in real-time collection (current state)
    const systemRef = this.db.collection(Collections.TELEMETRY).doc(systemId);
    await systemRef.set({
      ...telemetry,
      updatedAt: now,
    });

    // Store in history collection
    const historyRef = this.db
      .collection(Collections.TELEMETRY_HISTORY)
      .doc(systemId)
      .collection('data')
      .doc();

    await historyRef.set(telemetry);

    // Update system status
    await this.updateSystemStatus(systemId, telemetry as TelemetryData);

    // Check for alerts
    if (alarms.length > 0 || warnings.length > 0) {
      await this.createAlerts(systemId, alarms, warnings, telemetry as TelemetryData);
    }

    logger.debug(`Telemetry processed for system ${systemId}`, {
      soc: telemetry.soc,
      voltage: telemetry.totalVoltage,
      current: telemetry.current,
    });

    return { id: historyRef.id, ...telemetry };
  }

  /**
   * Get current telemetry for a system
   */
  async getCurrentTelemetry(systemId: string): Promise<TelemetryData | null> {
    const doc = await this.db.collection(Collections.TELEMETRY).doc(systemId).get();

    if (!doc.exists) {
      return null;
    }

    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      timestamp: data?.timestamp?.toDate() || new Date(),
    } as TelemetryData;
  }

  /**
   * Get historical telemetry data
   */
  async getHistoricalTelemetry(query: TelemetryQuery): Promise<TelemetryData[]> {
    let ref = this.db
      .collection(Collections.TELEMETRY_HISTORY)
      .doc(query.systemId)
      .collection('data')
      .orderBy('timestamp', 'desc');

    if (query.startDate) {
      ref = ref.where('timestamp', '>=', query.startDate);
    }

    if (query.endDate) {
      ref = ref.where('timestamp', '<=', query.endDate);
    }

    ref = ref.limit(query.limit || 1000);

    const snapshot = await ref.get();

    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate() || new Date(),
    })) as TelemetryData[];

    // Apply resolution aggregation if needed
    if (query.resolution && query.resolution !== 'raw') {
      return this.aggregateByResolution(data, query.resolution);
    }

    return data;
  }

  /**
   * Get cell-level data for a system
   */
  async getCellData(systemId: string): Promise<CellData[]> {
    const telemetry = await this.getCurrentTelemetry(systemId);
    return telemetry?.cells || [];
  }

  /**
   * Process raw cell voltages into CellData objects
   */
  private processCellData(voltages: number[], balancingStatus: number): CellData[] {
    return voltages.map((voltage, index) => {
      const isBalancing = (balancingStatus & (1 << index)) !== 0;
      const status = this.getCellStatus(voltage);

      return {
        index: index + 1,
        voltage,
        isBalancing,
        status,
      };
    });
  }

  /**
   * Determine cell status based on voltage
   */
  private getCellStatus(voltage: number): CellStatus {
    // LiFePO4 voltage thresholds
    if (voltage < 2.5 || voltage > 3.65) {
      return CellStatus.CRITICAL;
    }
    if (voltage < 2.8 || voltage > 3.55) {
      return CellStatus.ATTENTION;
    }
    return CellStatus.NORMAL;
  }

  /**
   * Process temperature sensor data
   */
  private processTemperatureData(temperatures: number[]): {
    min: number;
    max: number;
    average: number;
    sensors: number[];
  } {
    if (!temperatures || temperatures.length === 0) {
      return { min: 0, max: 0, average: 0, sensors: [] };
    }

    const validTemps = temperatures.filter(t => t > -40 && t < 100);
    const min = Math.min(...validTemps);
    const max = Math.max(...validTemps);
    const average = validTemps.reduce((sum, t) => sum + t, 0) / validTemps.length;

    return {
      min,
      max,
      average: Math.round(average * 10) / 10,
      sensors: temperatures,
    };
  }

  /**
   * Decode alarm bitmask
   */
  private decodeAlarms(alarmBits: number): AlarmFlag[] {
    const alarms: AlarmFlag[] = [];

    if (alarmBits & 0x01) alarms.push(AlarmFlag.OVERVOLTAGE);
    if (alarmBits & 0x02) alarms.push(AlarmFlag.UNDERVOLTAGE);
    if (alarmBits & 0x04) alarms.push(AlarmFlag.OVERCURRENT_CHARGE);
    if (alarmBits & 0x08) alarms.push(AlarmFlag.OVERCURRENT_DISCHARGE);
    if (alarmBits & 0x10) alarms.push(AlarmFlag.OVERTEMPERATURE);
    if (alarmBits & 0x20) alarms.push(AlarmFlag.UNDERTEMPERATURE);
    if (alarmBits & 0x40) alarms.push(AlarmFlag.CELL_IMBALANCE);
    if (alarmBits & 0x80) alarms.push(AlarmFlag.SHORT_CIRCUIT);

    return alarms;
  }

  /**
   * Decode warning bitmask
   */
  private decodeWarnings(warningBits: number): WarningFlag[] {
    const warnings: WarningFlag[] = [];

    if (warningBits & 0x01) warnings.push(WarningFlag.HIGH_TEMPERATURE);
    if (warningBits & 0x02) warnings.push(WarningFlag.LOW_TEMPERATURE);
    if (warningBits & 0x04) warnings.push(WarningFlag.HIGH_VOLTAGE);
    if (warningBits & 0x08) warnings.push(WarningFlag.LOW_VOLTAGE);
    if (warningBits & 0x10) warnings.push(WarningFlag.CELL_IMBALANCE_WARNING);
    if (warningBits & 0x20) warnings.push(WarningFlag.LOW_SOH);

    return warnings;
  }

  /**
   * Update system status based on telemetry
   */
  private async updateSystemStatus(systemId: string, telemetry: TelemetryData): Promise<void> {
    const systemRef = this.db.collection(Collections.SYSTEMS).doc(systemId);
    const systemDoc = await systemRef.get();

    if (!systemDoc.exists) {
      return;
    }

    let status = 'idle';
    if (telemetry.alarms.length > 0) {
      status = 'error';
    } else if (telemetry.isBalancing) {
      status = 'balancing';
    } else if (telemetry.isCharging) {
      status = 'charging';
    } else if (telemetry.isDischarging) {
      status = 'discharging';
    }

    await systemRef.update({
      status,
      connectionStatus: 'online',
      lastCommunication: new Date(),
    });
  }

  /**
   * Create alerts from alarms and warnings
   */
  private async createAlerts(
    systemId: string,
    alarms: AlarmFlag[],
    warnings: WarningFlag[],
    telemetry: TelemetryData
  ): Promise<void> {
    const systemDoc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();
    const organizationId = systemDoc.data()?.organizationId || '';

    const alertsRef = this.db.collection(Collections.ALERTS);

    // Create critical alerts for alarms
    for (const alarm of alarms) {
      await alertsRef.add({
        systemId,
        organizationId,
        type: alarm,
        severity: 'critical',
        title: this.getAlarmTitle(alarm),
        message: this.getAlarmMessage(alarm, telemetry),
        data: { telemetry },
        isRead: false,
        isAcknowledged: false,
        createdAt: new Date(),
      });
    }

    // Create medium alerts for warnings
    for (const warning of warnings) {
      await alertsRef.add({
        systemId,
        organizationId,
        type: warning,
        severity: 'medium',
        title: this.getWarningTitle(warning),
        message: this.getWarningMessage(warning, telemetry),
        data: { telemetry },
        isRead: false,
        isAcknowledged: false,
        createdAt: new Date(),
      });
    }
  }

  /**
   * Get human-readable alarm title
   */
  private getAlarmTitle(alarm: AlarmFlag): string {
    const titles: Record<AlarmFlag, string> = {
      [AlarmFlag.OVERVOLTAGE]: 'Sobretensão Detectada',
      [AlarmFlag.UNDERVOLTAGE]: 'Subtensão Detectada',
      [AlarmFlag.OVERCURRENT_CHARGE]: 'Sobrecorrente de Carga',
      [AlarmFlag.OVERCURRENT_DISCHARGE]: 'Sobrecorrente de Descarga',
      [AlarmFlag.OVERTEMPERATURE]: 'Temperatura Alta Crítica',
      [AlarmFlag.UNDERTEMPERATURE]: 'Temperatura Baixa Crítica',
      [AlarmFlag.CELL_IMBALANCE]: 'Desbalanceamento Crítico',
      [AlarmFlag.SHORT_CIRCUIT]: 'Curto-Circuito Detectado',
      [AlarmFlag.COMMUNICATION_ERROR]: 'Erro de Comunicação',
    };
    return titles[alarm] || alarm;
  }

  /**
   * Get human-readable alarm message
   */
  private getAlarmMessage(alarm: AlarmFlag, telemetry: TelemetryData): string {
    switch (alarm) {
      case AlarmFlag.OVERVOLTAGE:
        const maxCell = telemetry.cells.reduce((max, c) => c.voltage > max.voltage ? c : max);
        return `Célula ${maxCell.index} com tensão de ${maxCell.voltage.toFixed(3)}V excede o limite.`;
      case AlarmFlag.UNDERVOLTAGE:
        const minCell = telemetry.cells.reduce((min, c) => c.voltage < min.voltage ? c : min);
        return `Célula ${minCell.index} com tensão de ${minCell.voltage.toFixed(3)}V abaixo do limite.`;
      case AlarmFlag.OVERTEMPERATURE:
        return `Temperatura máxima de ${telemetry.temperature.max}°C excede o limite seguro.`;
      default:
        return `Alarme ${alarm} ativado. Verificar sistema imediatamente.`;
    }
  }

  /**
   * Get human-readable warning title
   */
  private getWarningTitle(warning: WarningFlag): string {
    const titles: Record<WarningFlag, string> = {
      [WarningFlag.HIGH_TEMPERATURE]: 'Temperatura Elevada',
      [WarningFlag.LOW_TEMPERATURE]: 'Temperatura Baixa',
      [WarningFlag.HIGH_VOLTAGE]: 'Tensão Elevada',
      [WarningFlag.LOW_VOLTAGE]: 'Tensão Baixa',
      [WarningFlag.CELL_IMBALANCE_WARNING]: 'Desbalanceamento',
      [WarningFlag.LOW_SOH]: 'Saúde da Bateria Baixa',
    };
    return titles[warning] || warning;
  }

  /**
   * Get human-readable warning message
   */
  private getWarningMessage(warning: WarningFlag, telemetry: TelemetryData): string {
    switch (warning) {
      case WarningFlag.LOW_SOH:
        return `SOH em ${telemetry.soh.toFixed(1)}%. Considere substituição em breve.`;
      case WarningFlag.CELL_IMBALANCE_WARNING:
        const voltages = telemetry.cells.map(c => c.voltage);
        const delta = Math.max(...voltages) - Math.min(...voltages);
        return `Diferença de tensão entre células: ${(delta * 1000).toFixed(0)}mV`;
      default:
        return `Aviso: ${warning}. Monitorar sistema.`;
    }
  }

  /**
   * Aggregate telemetry data by resolution
   */
  private aggregateByResolution(
    data: TelemetryData[],
    resolution: '1m' | '5m' | '15m' | '1h' | '1d'
  ): TelemetryData[] {
    const intervals: Record<string, number> = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '15m': 15 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    };

    const interval = intervals[resolution];
    const buckets = new Map<number, TelemetryData[]>();

    // Group data into buckets
    for (const item of data) {
      const bucketKey = Math.floor(item.timestamp.getTime() / interval) * interval;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey)!.push(item);
    }

    // Aggregate each bucket
    const aggregated: TelemetryData[] = [];
    for (const [timestamp, items] of buckets) {
      if (items.length === 0) continue;

      const avgSoc = items.reduce((sum, i) => sum + i.soc, 0) / items.length;
      const avgVoltage = items.reduce((sum, i) => sum + i.totalVoltage, 0) / items.length;
      const avgCurrent = items.reduce((sum, i) => sum + i.current, 0) / items.length;
      const avgPower = items.reduce((sum, i) => sum + i.power, 0) / items.length;
      const maxTemp = Math.max(...items.map(i => i.temperature.max));
      const minTemp = Math.min(...items.map(i => i.temperature.min));

      aggregated.push({
        ...items[0],
        id: `agg_${timestamp}`,
        timestamp: new Date(timestamp),
        soc: Math.round(avgSoc * 10) / 10,
        totalVoltage: Math.round(avgVoltage * 100) / 100,
        current: Math.round(avgCurrent * 100) / 100,
        power: Math.round(avgPower),
        temperature: {
          ...items[0].temperature,
          max: maxTemp,
          min: minTemp,
          average: (maxTemp + minTemp) / 2,
        },
      });
    }

    return aggregated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }
}

export const telemetryService = new TelemetryService();
