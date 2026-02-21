import { getFirestore, Collections } from '../config/firebase.js';
import { mqttService } from '../mqtt/mqtt.service.js';
import { OperationMode, BessSystem, Schedule, ScheduleAction } from '../models/types.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { logCriticalAction as auditCriticalAction } from '../middlewares/audit.middleware.js';

interface CommandResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

type CommandType =
  | 'start_charge'
  | 'stop_charge'
  | 'start_discharge'
  | 'stop_discharge'
  | 'emergency_stop'
  | 'reset_alarms'
  | 'start_balance'
  | 'stop_balance'
  | 'set_mode'
  | 'calibrate_soc';

export class ControlService {
  private db = getFirestore();

  /**
   * Send a command to a BESS system
   */
  async sendCommand(
    systemId: string,
    command: CommandType,
    params: Record<string, unknown> = {},
    userId: string
  ): Promise<CommandResult> {
    // Get system info
    const system = await this.getSystem(systemId);

    // Validate system is online
    if (system.connectionStatus === 'offline') {
      throw new BadRequestError('System is offline. Cannot send commands.');
    }

    // Build command payload
    const payload = {
      command,
      params,
      timestamp: Date.now(),
      requestId: this.generateRequestId(),
    };

    // Log critical actions
    if (['emergency_stop', 'set_mode', 'calibrate_soc'].includes(command)) {
      await auditCriticalAction(userId, system.organizationId, `COMMAND_${command.toUpperCase()}`, {
        systemId,
        params,
      });
    }

    // Send via MQTT
    const topic = `${system.mqttTopic}/command`;
    const success = await mqttService.publish(topic, JSON.stringify(payload));

    if (!success) {
      logger.error(`Failed to send command to system ${systemId}`, { command, params });
      return {
        success: false,
        message: 'Failed to send command to device',
      };
    }

    // Store command in history
    await this.storeCommandHistory(systemId, command, params, userId);

    logger.info(`Command sent to system ${systemId}: ${command}`, { params });

    return {
      success: true,
      message: `Command ${command} sent successfully`,
      data: { requestId: payload.requestId },
    };
  }

  /**
   * Set operation mode
   */
  async setOperationMode(
    systemId: string,
    mode: OperationMode,
    userId: string
  ): Promise<CommandResult> {
    const modeSettings: Record<OperationMode, Record<string, unknown>> = {
      [OperationMode.AUTO]: { autoControl: true },
      [OperationMode.MANUAL]: { autoControl: false },
      [OperationMode.ECONOMIC]: { autoControl: true, optimizeForCost: true },
      [OperationMode.GRID_SUPPORT]: { autoControl: true, gridSupport: true },
      [OperationMode.MAINTENANCE]: { autoControl: false, limitPower: true },
      [OperationMode.EMERGENCY]: { autoControl: false, emergencyMode: true },
    };

    // Update mode in database
    await this.db.collection(Collections.SYSTEMS).doc(systemId).update({
      operationMode: mode,
      updatedAt: new Date(),
    });

    // Send command to device
    return this.sendCommand(systemId, 'set_mode', { mode, ...modeSettings[mode] }, userId);
  }

  /**
   * Emergency stop - highest priority command
   */
  async emergencyStop(systemId: string, userId: string, reason: string): Promise<CommandResult> {
    const system = await this.getSystem(systemId);

    // Log critical action
    await auditCriticalAction(userId, system.organizationId, 'EMERGENCY_STOP', {
      systemId,
      reason,
    });

    // Update system status
    await this.db.collection(Collections.SYSTEMS).doc(systemId).update({
      status: 'emergency',
      operationMode: OperationMode.EMERGENCY,
      updatedAt: new Date(),
    });

    // Send emergency command
    const result = await this.sendCommand(systemId, 'emergency_stop', { reason }, userId);

    // Create alert
    await this.db.collection(Collections.ALERTS).add({
      systemId,
      organizationId: system.organizationId,
      type: 'emergency_stop',
      severity: 'critical',
      title: 'Parada de Emergência Ativada',
      message: `Sistema parado por ${userId}. Motivo: ${reason}`,
      isRead: false,
      isAcknowledged: false,
      createdAt: new Date(),
    });

    return result;
  }

  /**
   * Start charging
   */
  async startCharge(
    systemId: string,
    userId: string,
    options?: { targetSoc?: number; maxCurrent?: number }
  ): Promise<CommandResult> {
    return this.sendCommand(systemId, 'start_charge', options || {}, userId);
  }

  /**
   * Stop charging
   */
  async stopCharge(systemId: string, userId: string): Promise<CommandResult> {
    return this.sendCommand(systemId, 'stop_charge', {}, userId);
  }

  /**
   * Start discharging
   */
  async startDischarge(
    systemId: string,
    userId: string,
    options?: { targetSoc?: number; maxCurrent?: number; power?: number }
  ): Promise<CommandResult> {
    return this.sendCommand(systemId, 'start_discharge', options || {}, userId);
  }

  /**
   * Stop discharging
   */
  async stopDischarge(systemId: string, userId: string): Promise<CommandResult> {
    return this.sendCommand(systemId, 'stop_discharge', {}, userId);
  }

  /**
   * Reset alarms
   */
  async resetAlarms(systemId: string, userId: string): Promise<CommandResult> {
    return this.sendCommand(systemId, 'reset_alarms', {}, userId);
  }

  /**
   * Start cell balancing
   */
  async startBalance(systemId: string, userId: string): Promise<CommandResult> {
    return this.sendCommand(systemId, 'start_balance', {}, userId);
  }

  /**
   * Stop cell balancing
   */
  async stopBalance(systemId: string, userId: string): Promise<CommandResult> {
    return this.sendCommand(systemId, 'stop_balance', {}, userId);
  }

  /**
   * Calibrate SOC
   */
  async calibrateSoc(systemId: string, userId: string, actualSoc: number): Promise<CommandResult> {
    if (actualSoc < 0 || actualSoc > 100) {
      throw new BadRequestError('SOC must be between 0 and 100');
    }

    return this.sendCommand(systemId, 'calibrate_soc', { actualSoc }, userId);
  }

  // ============================================
  // SCHEDULING
  // ============================================

  /**
   * Create a new schedule
   */
  async createSchedule(schedule: Omit<Schedule, 'id' | 'createdAt' | 'updatedAt'>): Promise<Schedule> {
    // Validate system exists
    await this.getSystem(schedule.systemId);

    const scheduleRef = this.db.collection(Collections.SCHEDULES).doc();
    const now = new Date();

    const newSchedule: Omit<Schedule, 'id'> = {
      ...schedule,
      createdAt: now,
      updatedAt: now,
    };

    await scheduleRef.set(newSchedule);

    logger.info(`Schedule created: ${scheduleRef.id}`);

    return { id: scheduleRef.id, ...newSchedule };
  }

  /**
   * Get schedules for a system
   */
  async getSchedules(systemId: string): Promise<Schedule[]> {
    const snapshot = await this.db
      .collection(Collections.SCHEDULES)
      .where('systemId', '==', systemId)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Schedule[];
  }

  /**
   * Update schedule
   */
  async updateSchedule(scheduleId: string, updates: Partial<Schedule>): Promise<Schedule> {
    const scheduleRef = this.db.collection(Collections.SCHEDULES).doc(scheduleId);
    const doc = await scheduleRef.get();

    if (!doc.exists) {
      throw new NotFoundError('Schedule');
    }

    await scheduleRef.update({
      ...updates,
      updatedAt: new Date(),
    });

    const updated = await scheduleRef.get();
    return {
      id: updated.id,
      ...updated.data(),
    } as Schedule;
  }

  /**
   * Delete schedule
   */
  async deleteSchedule(scheduleId: string): Promise<void> {
    const scheduleRef = this.db.collection(Collections.SCHEDULES).doc(scheduleId);
    const doc = await scheduleRef.get();

    if (!doc.exists) {
      throw new NotFoundError('Schedule');
    }

    await scheduleRef.delete();
    logger.info(`Schedule deleted: ${scheduleId}`);
  }

  /**
   * Execute scheduled action (called by cron job)
   */
  async executeScheduledAction(schedule: Schedule): Promise<void> {
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Check if schedule should run now
    if (!schedule.isActive) return;
    if (!schedule.daysOfWeek.includes(currentDay)) return;
    if (schedule.startTime !== currentTime) return;

    logger.info(`Executing scheduled action: ${schedule.name}`, {
      scheduleId: schedule.id,
      systemId: schedule.systemId,
      action: schedule.action,
    });

    // Execute action
    switch (schedule.action) {
      case ScheduleAction.CHARGE:
        await this.startCharge(schedule.systemId, 'scheduler', {
          targetSoc: schedule.targetSoc,
        });
        break;

      case ScheduleAction.DISCHARGE:
        await this.startDischarge(schedule.systemId, 'scheduler', {
          targetSoc: schedule.targetSoc,
          power: schedule.powerLimit,
        });
        break;

      case ScheduleAction.IDLE:
        await this.stopCharge(schedule.systemId, 'scheduler');
        await this.stopDischarge(schedule.systemId, 'scheduler');
        break;

      case ScheduleAction.PEAK_SHAVING:
        // Peak shaving logic would go here
        await this.setOperationMode(schedule.systemId, OperationMode.GRID_SUPPORT, 'scheduler');
        break;
    }
  }

  // ============================================
  // HELPERS
  // ============================================

  private async getSystem(systemId: string): Promise<BessSystem> {
    const doc = await this.db.collection(Collections.SYSTEMS).doc(systemId).get();

    if (!doc.exists) {
      throw new NotFoundError('System');
    }

    return { id: doc.id, ...doc.data() } as BessSystem;
  }

  private async storeCommandHistory(
    systemId: string,
    command: string,
    params: Record<string, unknown>,
    userId: string
  ): Promise<void> {
    await this.db.collection(Collections.EVENTS).add({
      systemId,
      type: 'command',
      command,
      params,
      userId,
      timestamp: new Date(),
    });
  }

  private generateRequestId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const controlService = new ControlService();
