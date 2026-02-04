/**
 * Grid Energy Meter Simulator (CT Sensor / Smart Meter)
 *
 * Simulates a bidirectional energy meter at the point of common coupling (PCC)
 * Measures power flow between the installation and the utility grid
 */

class GridMeter {
  constructor(config = {}) {
    this.deviceId = config.deviceId || 'grid-meter-001';
    this.ctRatio = config.ctRatio || 100; // 100:5A typical

    this.state = {
      // Instantaneous measurements
      voltage: 220,
      current: 0,
      power: 0,          // W (+ import from grid, - export to grid)
      reactivePower: 0,  // VAR
      apparentPower: 0,  // VA
      powerFactor: 1.0,
      frequency: 60,

      // 3-phase (if applicable)
      voltageL1: 220,
      voltageL2: 220,
      voltageL3: 220,
      currentL1: 0,
      currentL2: 0,
      currentL3: 0,

      // Energy counters (kWh)
      energyImport: 1520.5,  // Total imported from grid
      energyExport: 890.2,   // Total exported to grid

      // Demand
      demandCurrent: 0,      // Current 15-min demand (kW)
      demandPeak: 0,         // Peak demand this month (kW)

      // Status
      online: true,
      gridAvailable: true
    };

    // Demand calculation
    this.demandSamples = [];
    this.demandWindow = 15 * 60 * 1000; // 15 minutes in ms
  }

  /**
   * Update meter based on inverter grid power
   * @param {number} gridPower - Power from inverter (+ import, - export)
   * @param {string} scenario - Current scenario
   * @param {number} deltaTime - Time delta in ms
   */
  update(gridPower, scenario, deltaTime = 1000) {
    const dt = deltaTime / 1000;

    // Base power from inverter
    let power = gridPower;

    // Add some noise and other loads in the building
    const otherLoads = 50 + Math.random() * 100; // 50-150W of other loads
    power += otherLoads;

    // Apply scenario modifications
    switch (scenario) {
      case 'grid-failure':
        this.state.gridAvailable = false;
        this.state.voltage = 0;
        this.state.frequency = 0;
        power = 0;
        break;

      case 'zero-import':
        // Target zero (or slightly negative for export)
        power = Math.max(-100, Math.min(100, power));
        this.state.gridAvailable = true;
        break;

      default:
        this.state.gridAvailable = true;
        this.state.voltage = 220 + (Math.random() - 0.5) * 6;
        this.state.frequency = 60 + (Math.random() - 0.5) * 0.3;
    }

    // Update state
    this.state.power = parseFloat(power.toFixed(0));
    this.state.current = Math.abs(power) / this.state.voltage;

    // Reactive power simulation (based on typical residential PF)
    const pf = 0.85 + Math.random() * 0.13; // 0.85-0.98
    this.state.powerFactor = parseFloat(pf.toFixed(2));
    this.state.apparentPower = Math.abs(power) / pf;
    this.state.reactivePower = Math.sqrt(
      this.state.apparentPower ** 2 - power ** 2
    );

    // Update energy counters
    const hours = dt / 3600;
    if (power > 0) {
      this.state.energyImport += (power / 1000) * hours;
    } else {
      this.state.energyExport += (Math.abs(power) / 1000) * hours;
    }

    // Update 3-phase (balanced for simplicity)
    if (this.state.gridAvailable) {
      this.state.voltageL1 = this.state.voltage + (Math.random() - 0.5) * 2;
      this.state.voltageL2 = this.state.voltage + (Math.random() - 0.5) * 2;
      this.state.voltageL3 = this.state.voltage + (Math.random() - 0.5) * 2;
      this.state.currentL1 = this.state.current / 3 + (Math.random() - 0.5) * 0.5;
      this.state.currentL2 = this.state.current / 3 + (Math.random() - 0.5) * 0.5;
      this.state.currentL3 = this.state.current / 3 + (Math.random() - 0.5) * 0.5;
    } else {
      this.state.voltageL1 = 0;
      this.state.voltageL2 = 0;
      this.state.voltageL3 = 0;
      this.state.currentL1 = 0;
      this.state.currentL2 = 0;
      this.state.currentL3 = 0;
    }

    // Update demand calculation
    this._updateDemand(power);
  }

  _updateDemand(power) {
    const now = Date.now();

    // Add current sample
    this.demandSamples.push({ time: now, power: Math.max(0, power) });

    // Remove old samples outside 15-min window
    this.demandSamples = this.demandSamples.filter(
      s => now - s.time < this.demandWindow
    );

    // Calculate average demand over window
    if (this.demandSamples.length > 0) {
      const avgPower = this.demandSamples.reduce((sum, s) => sum + s.power, 0)
        / this.demandSamples.length;
      this.state.demandCurrent = parseFloat((avgPower / 1000).toFixed(2));

      // Update peak if exceeded
      if (this.state.demandCurrent > this.state.demandPeak) {
        this.state.demandPeak = this.state.demandCurrent;
      }
    }
  }

  /**
   * Get meter telemetry
   */
  getTelemetry() {
    return {
      voltage: parseFloat(this.state.voltage.toFixed(1)),
      current: parseFloat(this.state.current.toFixed(2)),
      power: this.state.power,
      reactivePower: parseFloat(this.state.reactivePower.toFixed(0)),
      apparentPower: parseFloat(this.state.apparentPower.toFixed(0)),
      powerFactor: this.state.powerFactor,
      frequency: parseFloat(this.state.frequency.toFixed(2)),
      energyImport: parseFloat(this.state.energyImport.toFixed(2)),
      energyExport: parseFloat(this.state.energyExport.toFixed(2)),
      gridAvailable: this.state.gridAvailable
    };
  }

  /**
   * Get detailed status for API/UI
   */
  getDetailedStatus() {
    return {
      deviceId: this.deviceId,
      model: 'Smart Meter CT-100',
      ...this.getTelemetry(),
      threePhase: {
        voltageL1: parseFloat(this.state.voltageL1.toFixed(1)),
        voltageL2: parseFloat(this.state.voltageL2.toFixed(1)),
        voltageL3: parseFloat(this.state.voltageL3.toFixed(1)),
        currentL1: parseFloat(this.state.currentL1.toFixed(2)),
        currentL2: parseFloat(this.state.currentL2.toFixed(2)),
        currentL3: parseFloat(this.state.currentL3.toFixed(2))
      },
      demand: {
        current: this.state.demandCurrent,
        peak: this.state.demandPeak,
        windowMinutes: 15
      },
      online: this.state.online
    };
  }

  /**
   * Reset peak demand (typically monthly)
   */
  resetPeakDemand() {
    this.state.demandPeak = 0;
  }

  /**
   * Simulate grid failure
   */
  setGridFailure(failed) {
    this.state.gridAvailable = !failed;
    if (failed) {
      this.state.voltage = 0;
      this.state.frequency = 0;
      this.state.power = 0;
      this.state.current = 0;
    }
  }
}

module.exports = GridMeter;
