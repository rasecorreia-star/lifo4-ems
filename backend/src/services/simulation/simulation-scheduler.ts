/**
 * Simulation Scheduler Service
 * Manages scheduled digital twin simulations and comparisons
 */

import { getFirestore } from '../../config/firebase.js';
import { logger } from '../../utils/logger.js';
import { digitalTwinService, SimulationConfig } from './digital-twin.service.js';
import cron from 'node-cron';

// ============================================
// TYPES
// ============================================

export interface ScheduledSimulation {
  id: string;
  systemId: string;
  name: string;
  schedule: string; // Cron expression
  config: SimulationConfig;
  enabled: boolean;
  lastRun?: Date;
  lastResult?: 'success' | 'failure';
  nextRun?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SimulationJob {
  task: cron.ScheduledTask;
  simulation: ScheduledSimulation;
}

// ============================================
// SIMULATION SCHEDULER SERVICE
// ============================================

export class SimulationSchedulerService {
  private db = getFirestore();
  private jobs: Map<string, SimulationJob> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize scheduler and load scheduled simulations
   */
  async initialize(): Promise<void> {
    logger.info('Initializing simulation scheduler...');

    // Load scheduled simulations from database
    const snapshot = await this.db.collection('scheduled_simulations')
      .where('enabled', '==', true)
      .get();

    for (const doc of snapshot.docs) {
      const simulation = { id: doc.id, ...doc.data() } as ScheduledSimulation;
      await this.scheduleSimulation(simulation);
    }

    // Start health check
    this.startHealthCheck();

    logger.info(`Simulation scheduler initialized with ${this.jobs.size} scheduled jobs`);
  }

  /**
   * Create a new scheduled simulation
   */
  async createScheduledSimulation(
    systemId: string,
    name: string,
    schedule: string,
    config: SimulationConfig
  ): Promise<ScheduledSimulation> {
    // Validate cron expression
    if (!cron.validate(schedule)) {
      throw new Error('Invalid cron expression');
    }

    const simulation: ScheduledSimulation = {
      id: '',
      systemId,
      name,
      schedule,
      config,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save to database
    const docRef = await this.db.collection('scheduled_simulations').add(simulation);
    simulation.id = docRef.id;

    // Schedule the job
    await this.scheduleSimulation(simulation);

    logger.info(`Created scheduled simulation: ${name} (${schedule})`);
    return simulation;
  }

  /**
   * Schedule a simulation job
   */
  private async scheduleSimulation(simulation: ScheduledSimulation): Promise<void> {
    // Cancel existing job if present
    const existing = this.jobs.get(simulation.id);
    if (existing) {
      existing.task.stop();
    }

    // Create new scheduled task
    const task = cron.schedule(simulation.schedule, async () => {
      await this.runSimulation(simulation);
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/Sao_Paulo',
    });

    this.jobs.set(simulation.id, { task, simulation });

    // Update next run time
    simulation.nextRun = this.getNextRunTime(simulation.schedule);
    await this.updateSimulation(simulation);
  }

  /**
   * Run a simulation
   */
  private async runSimulation(simulation: ScheduledSimulation): Promise<void> {
    logger.info(`Running scheduled simulation: ${simulation.name}`);

    try {
      // Run the simulation
      const result = await digitalTwinService.simulate(
        simulation.systemId,
        simulation.config
      );

      // Update simulation record
      simulation.lastRun = new Date();
      simulation.lastResult = 'success';
      simulation.nextRun = this.getNextRunTime(simulation.schedule);

      await this.updateSimulation(simulation);

      // Store simulation result
      await this.db.collection('simulation_results').add({
        simulationId: simulation.id,
        systemId: simulation.systemId,
        result: {
          summary: {
            durationHours: result.time[result.time.length - 1] / 3600,
            finalSoc: result.soc[result.soc.length - 1],
            maxPowerKw: Math.max(...result.power.map(Math.abs)) / 1000,
            avgTemperature: result.temperature.reduce((a, b) => a + b, 0) / result.temperature.length,
          },
        },
        status: 'success',
        createdAt: new Date(),
      });

      logger.info(`Scheduled simulation completed: ${simulation.name}`);

    } catch (error) {
      logger.error(`Scheduled simulation failed: ${simulation.name}`, { error });

      simulation.lastRun = new Date();
      simulation.lastResult = 'failure';
      simulation.nextRun = this.getNextRunTime(simulation.schedule);

      await this.updateSimulation(simulation);

      // Store failure record
      await this.db.collection('simulation_results').add({
        simulationId: simulation.id,
        systemId: simulation.systemId,
        status: 'failure',
        error: String(error),
        createdAt: new Date(),
      });
    }
  }

  /**
   * Trigger a simulation manually
   */
  async triggerSimulation(simulationId: string): Promise<void> {
    const job = this.jobs.get(simulationId);
    if (!job) {
      throw new Error('Scheduled simulation not found');
    }

    await this.runSimulation(job.simulation);
  }

  /**
   * Update a scheduled simulation
   */
  async updateSimulation(simulation: ScheduledSimulation): Promise<void> {
    simulation.updatedAt = new Date();
    await this.db.collection('scheduled_simulations')
      .doc(simulation.id)
      .update(simulation);
  }

  /**
   * Enable/disable a scheduled simulation
   */
  async setEnabled(simulationId: string, enabled: boolean): Promise<void> {
    const job = this.jobs.get(simulationId);
    if (!job) {
      throw new Error('Scheduled simulation not found');
    }

    job.simulation.enabled = enabled;

    if (enabled) {
      job.task.start();
    } else {
      job.task.stop();
    }

    await this.updateSimulation(job.simulation);
  }

  /**
   * Delete a scheduled simulation
   */
  async deleteSimulation(simulationId: string): Promise<void> {
    const job = this.jobs.get(simulationId);
    if (job) {
      job.task.stop();
      this.jobs.delete(simulationId);
    }

    await this.db.collection('scheduled_simulations').doc(simulationId).delete();
    logger.info(`Deleted scheduled simulation: ${simulationId}`);
  }

  /**
   * Get all scheduled simulations
   */
  async getScheduledSimulations(): Promise<ScheduledSimulation[]> {
    const snapshot = await this.db.collection('scheduled_simulations').get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ScheduledSimulation));
  }

  /**
   * Get scheduled simulations for a system
   */
  async getSystemSimulations(systemId: string): Promise<ScheduledSimulation[]> {
    const snapshot = await this.db.collection('scheduled_simulations')
      .where('systemId', '==', systemId)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as ScheduledSimulation));
  }

  /**
   * Schedule periodic comparison with real data
   */
  async scheduleComparison(
    systemId: string,
    schedule: string = '0 0 * * *' // Daily at midnight
  ): Promise<string> {
    const jobId = `comparison_${systemId}`;

    // Cancel existing if present
    const existing = this.jobs.get(jobId);
    if (existing) {
      existing.task.stop();
    }

    // Create comparison task
    const task = cron.schedule(schedule, async () => {
      await this.runComparison(systemId);
    }, {
      scheduled: true,
      timezone: process.env.TZ || 'America/Sao_Paulo',
    });

    this.jobs.set(jobId, {
      task,
      simulation: {
        id: jobId,
        systemId,
        name: 'Real Data Comparison',
        schedule,
        config: {} as SimulationConfig,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    logger.info(`Scheduled comparison for system ${systemId}: ${schedule}`);
    return jobId;
  }

  /**
   * Run comparison with real telemetry data
   */
  private async runComparison(systemId: string): Promise<void> {
    logger.info(`Running scheduled comparison for system ${systemId}`);

    try {
      // Get recent telemetry data
      const telemetrySnapshot = await this.db.collection('telemetry')
        .where('systemId', '==', systemId)
        .orderBy('timestamp', 'desc')
        .limit(3600) // Last hour at 1s intervals
        .get();

      if (telemetrySnapshot.empty) {
        logger.warn(`No telemetry data for comparison: ${systemId}`);
        return;
      }

      // Extract time series
      const telemetryData = telemetrySnapshot.docs
        .map(doc => doc.data())
        .reverse(); // Chronological order

      const realData = {
        time: telemetryData.map((_, i) => i),
        voltage: telemetryData.map(d => d.packVoltage || d.voltage || 0),
        current: telemetryData.map(d => d.current || 0),
        soc: telemetryData.map(d => (d.soc || 50) / 100),
      };

      // Get system configuration
      const systemDoc = await this.db.collection('systems').doc(systemId).get();
      const system = systemDoc.data();

      if (!system) {
        logger.warn(`System not found for comparison: ${systemId}`);
        return;
      }

      // Create simulation config from system
      const config: SimulationConfig = {
        nominalCapacity: system.batterySpec?.energyCapacity || 100,
        nominalVoltage: system.batterySpec?.nominalVoltage || 51.2,
        cellsInSeries: 16,
        cellsInParallel: 1,
        initialSoc: realData.soc[0] || 0.5,
        temperature: telemetryData[0]?.temperature || 25,
        cRate: 0.5,
        simulationTime: realData.time.length,
        timeStep: 1,
      };

      // Run comparison
      const comparison = await digitalTwinService.compareWithReal(
        systemId,
        config,
        realData
      );

      // Store comparison result
      await this.db.collection('comparison_results').add({
        systemId,
        comparison,
        telemetryPoints: realData.time.length,
        createdAt: new Date(),
      });

      logger.info(`Comparison completed for system ${systemId}: accuracy=${(comparison.overallAccuracy * 100).toFixed(1)}%`);

    } catch (error) {
      logger.error(`Comparison failed for system ${systemId}`, { error });
    }
  }

  /**
   * Get next run time from cron expression
   */
  private getNextRunTime(schedule: string): Date {
    const interval = cron.validate(schedule);
    if (!interval) {
      return new Date();
    }

    // Simple next run calculation
    // In production, use a proper cron parser
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    return now;
  }

  /**
   * Start health check for AI service
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      const healthy = await digitalTwinService.checkHealth();
      if (!healthy) {
        logger.warn('Digital twin AI service is not healthy');
      }
    }, 60000); // Check every minute
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    // Stop all jobs
    for (const [id, job] of this.jobs) {
      job.task.stop();
      logger.info(`Stopped scheduled job: ${id}`);
    }
    this.jobs.clear();

    // Stop health check
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('Simulation scheduler stopped');
  }
}

// Singleton export
export const simulationScheduler = new SimulationSchedulerService();
