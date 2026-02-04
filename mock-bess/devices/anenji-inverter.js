/**
 * ANENJI ANJ-6200W-48V Hybrid Inverter Simulator
 *
 * Specs:
 * - 6.2kW rated power
 * - 48V battery input
 * - MPPT solar input (500V max, 5500W max)
 * - Pure sine wave output
 * - Multiple operation modes: UTL, SOL, SBU, SUB
 */

class AnenjiInverter {
  constructor(config = {}) {
    this.deviceId = config.deviceId || 'anenji-001';
    this.ratedPower = 6200; // W
    this.maxSolarPower = 5500; // W
    this.maxSolarVoltage = 500; // V
    this.batteryVoltageNominal = 48; // V

    // Operation modes:
    // UTL - Utility first (grid priority)
    // SOL - Solar first
    // SBU - Solar > Battery > Utility
    // SUB - Solar > Utility > Battery
    this.state = {
      mode: config.mode || 'SBU',
      isOnline: true,

      // PV (Solar) Input
      pv: {
        voltage: 0,
        current: 0,
        power: 0
      },

      // Grid (Utility) Input
      grid: {
        voltage: 220,
        frequency: 60,
        connected: true,
        power: 0, // + importing, - exporting
        available: true
      },

      // AC Output
      output: {
        voltage: 220,
        frequency: 60,
        power: 0,
        apparentPower: 0,
        loadPercent: 0
      },

      // Battery
      battery: {
        voltage: 52.0,
        current: 0,
        power: 0,
        soc: 85,
        charging: false,
        discharging: false
      },

      // Temperatures
      temps: {
        heatsink: 35,
        transformer: 32,
        ambient: 28
      },

      // Fault/Warning status
      faults: {
        overload: false,
        shortCircuit: false,
        batteryOvervoltage: false,
        batteryUndervoltage: false,
        overTemperature: false,
        fanFault: false
      },

      warnings: {
        highTemperature: false,
        lowBattery: false,
        overload75: false
      },

      // Counters
      energyToday: {
        pvGeneration: 0,    // kWh
        batteryCharge: 0,   // kWh
        batteryDischarge: 0, // kWh
        gridImport: 0,      // kWh
        gridExport: 0,      // kWh
        consumption: 0      // kWh
      }
    };

    // Solar irradiance simulation
    this.solarProfile = this._getSolarProfile();
  }

  _getSolarProfile() {
    // Simplified solar profile based on hour
    // Returns fraction of max solar power (0-1)
    return {
      0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0,
      6: 0.05, 7: 0.15, 8: 0.35, 9: 0.55, 10: 0.75,
      11: 0.9, 12: 1.0, 13: 0.95, 14: 0.85, 15: 0.7,
      16: 0.5, 17: 0.3, 18: 0.1, 19: 0, 20: 0,
      21: 0, 22: 0, 23: 0
    };
  }

  /**
   * Update simulation state based on scenario
   * @param {string} scenario - Current scenario name
   * @param {object} bmsState - Current BMS state (for battery coordination)
   * @param {number} deltaTime - Time since last update (ms)
   */
  update(scenario, bmsState = null, deltaTime = 1000) {
    const dt = deltaTime / 1000;
    const hour = new Date().getHours();

    // Update battery state from BMS
    if (bmsState) {
      this.state.battery.soc = bmsState.soc || this.state.battery.soc;
      // bmsState.cells can be objects {index, voltage} or just numbers
      if (bmsState.cells && bmsState.cells.length > 0) {
        const firstCell = bmsState.cells[0];
        if (typeof firstCell === 'object' && firstCell.voltage !== undefined) {
          this.state.battery.voltage = bmsState.cells.reduce((sum, c) => sum + c.voltage, 0);
        } else if (typeof firstCell === 'number') {
          this.state.battery.voltage = bmsState.cells.reduce((sum, v) => sum + v, 0);
        }
      } else if (bmsState.voltage) {
        this.state.battery.voltage = bmsState.voltage;
      }
    }

    switch (scenario) {
      case 'normal':
        this._updateNormal(hour, dt);
        break;
      case 'solar-charging':
        this._updateSolarCharging(hour, dt);
        break;
      case 'discharging':
        this._updateDischarging(dt);
        break;
      case 'grid-charging':
        this._updateGridCharging(dt);
        break;
      case 'low-battery':
        this._updateLowBattery(dt);
        break;
      case 'high-temp':
        this._updateHighTemp(dt);
        break;
      case 'grid-failure':
        this._updateGridFailure(dt);
        break;
      case 'zero-import':
        this._updateZeroImport(hour, dt);
        break;
      default:
        this._updateNormal(hour, dt);
    }

    this._updateTemperatures(dt);
    this._checkFaults();
    this._updateEnergy(dt);
  }

  _updateNormal(hour, dt) {
    // Normal operation - follow solar profile
    const solarFraction = this.solarProfile[hour] || 0;
    this._setSolarPower(solarFraction * this.maxSolarPower * (0.8 + Math.random() * 0.2));

    // Small household load
    const baseLoad = 500 + Math.random() * 300;
    this._setLoad(baseLoad);

    // Grid connected
    this.state.grid.connected = true;
    this.state.grid.available = true;

    // Balance: Solar covers load, excess to battery or grid
    this._balancePower();
  }

  _updateSolarCharging(hour, dt) {
    // Peak solar production
    const solarFraction = Math.max(0.8, this.solarProfile[hour] || 0.8);
    this._setSolarPower(solarFraction * this.maxSolarPower);

    // Light load
    this._setLoad(400 + Math.random() * 200);

    // Grid connected but not used (export enabled)
    this.state.grid.connected = true;
    this.state.grid.available = true;

    // Priority to battery charging
    const excessPower = this.state.pv.power - this.state.output.power;
    if (excessPower > 0 && this.state.battery.soc < 100) {
      // Charge battery
      this.state.battery.charging = true;
      this.state.battery.discharging = false;
      this.state.battery.power = Math.min(excessPower, 3000); // Max 3kW charge
      this.state.battery.current = this.state.battery.power / this.state.battery.voltage;
      this.state.grid.power = -(excessPower - this.state.battery.power); // Export remainder
    }
  }

  _updateDischarging(dt) {
    // Evening/night - high load, battery discharging
    this._setSolarPower(0); // No solar

    // High household load
    this._setLoad(2500 + Math.random() * 1500);

    this.state.grid.connected = true;
    this.state.grid.available = true;

    // Battery covers load (up to battery capacity)
    this.state.battery.discharging = true;
    this.state.battery.charging = false;
    const maxBatteryPower = Math.min(this.state.output.power, 5000); // Max 5kW discharge
    this.state.battery.power = -maxBatteryPower;
    this.state.battery.current = this.state.battery.power / this.state.battery.voltage;

    // Grid covers remainder
    const deficit = this.state.output.power - maxBatteryPower;
    this.state.grid.power = Math.max(0, deficit);
  }

  _updateGridCharging(dt) {
    // Grid charging battery (off-peak hours)
    this._setSolarPower(0);
    this._setLoad(300 + Math.random() * 100);

    this.state.grid.connected = true;
    this.state.grid.available = true;

    // Charge from grid
    const chargeRate = 2500; // W
    this.state.battery.charging = true;
    this.state.battery.discharging = false;
    this.state.battery.power = chargeRate;
    this.state.battery.current = chargeRate / this.state.battery.voltage;

    this.state.grid.power = this.state.output.power + chargeRate;
  }

  _updateLowBattery(dt) {
    // Low battery - grid takes over
    this._setSolarPower(200 + Math.random() * 100); // Low solar
    this._setLoad(1500 + Math.random() * 500);

    this.state.grid.connected = true;
    this.state.grid.available = true;

    this.state.warnings.lowBattery = true;
    this.state.battery.soc = Math.min(this.state.battery.soc, 15);

    // Battery disabled, grid powers everything
    this.state.battery.charging = false;
    this.state.battery.discharging = false;
    this.state.battery.power = 0;
    this.state.battery.current = 0;

    this.state.grid.power = this.state.output.power - this.state.pv.power;
  }

  _updateHighTemp(dt) {
    // High temperature - reduced power
    const hour = new Date().getHours();
    const solarFraction = this.solarProfile[hour] || 0.5;
    this._setSolarPower(solarFraction * this.maxSolarPower * 0.6); // Derating

    this._setLoad(1000 + Math.random() * 500);

    this.state.temps.heatsink = 70 + Math.random() * 5;
    this.state.temps.transformer = 65 + Math.random() * 5;
    this.state.warnings.highTemperature = true;

    this._balancePower();
  }

  _updateGridFailure(dt) {
    // Grid failure - UPS mode
    this._setSolarPower(Math.random() * 1000); // Whatever solar is available

    // Critical load only
    this._setLoad(800 + Math.random() * 400);

    this.state.grid.connected = false;
    this.state.grid.available = false;
    this.state.grid.power = 0;
    this.state.grid.voltage = 0;

    // Battery + Solar must cover load
    const deficit = this.state.output.power - this.state.pv.power;
    if (deficit > 0) {
      this.state.battery.discharging = true;
      this.state.battery.charging = false;
      this.state.battery.power = -deficit;
      this.state.battery.current = -deficit / this.state.battery.voltage;
    }
  }

  _updateZeroImport(hour, dt) {
    // Zero grid import mode
    const solarFraction = this.solarProfile[hour] || 0.5;
    this._setSolarPower(solarFraction * this.maxSolarPower);

    // Variable load
    this._setLoad(1200 + Math.random() * 800);

    this.state.grid.connected = true;
    this.state.grid.available = true;

    // Balance to achieve zero import
    const solarDeficit = this.state.output.power - this.state.pv.power;

    if (solarDeficit > 0) {
      // Need more power - use battery
      this.state.battery.discharging = true;
      this.state.battery.charging = false;
      this.state.battery.power = -solarDeficit;
      this.state.battery.current = -solarDeficit / this.state.battery.voltage;
      this.state.grid.power = 0; // Zero import achieved
    } else {
      // Excess solar - charge battery or export
      this.state.battery.charging = true;
      this.state.battery.discharging = false;
      const excess = -solarDeficit;
      const toBattery = Math.min(excess, 3000);
      this.state.battery.power = toBattery;
      this.state.battery.current = toBattery / this.state.battery.voltage;
      this.state.grid.power = -(excess - toBattery); // Export remainder
    }
  }

  _setSolarPower(power) {
    this.state.pv.power = Math.max(0, power + (Math.random() - 0.5) * 50);

    // Calculate voltage/current (MPPT)
    if (this.state.pv.power > 0) {
      // Typical MPPT voltage around 350-400V for this setup
      this.state.pv.voltage = 350 + Math.random() * 50;
      this.state.pv.current = this.state.pv.power / this.state.pv.voltage;
    } else {
      this.state.pv.voltage = 0;
      this.state.pv.current = 0;
    }
  }

  _setLoad(power) {
    this.state.output.power = power;
    this.state.output.loadPercent = (power / this.ratedPower) * 100;
    this.state.output.apparentPower = power / 0.95; // Assume 0.95 PF
    this.state.output.voltage = 220 + (Math.random() - 0.5) * 4;
    this.state.output.frequency = 60 + (Math.random() - 0.5) * 0.2;
  }

  _balancePower() {
    const solarPower = this.state.pv.power;
    const loadPower = this.state.output.power;
    const netPower = solarPower - loadPower;

    if (netPower > 0) {
      // Excess solar
      if (this.state.battery.soc < 95) {
        // Charge battery
        const toBattery = Math.min(netPower, 3000);
        this.state.battery.charging = true;
        this.state.battery.discharging = false;
        this.state.battery.power = toBattery;
        this.state.battery.current = toBattery / this.state.battery.voltage;
        this.state.grid.power = -(netPower - toBattery); // Export
      } else {
        // Export all to grid
        this.state.battery.charging = false;
        this.state.battery.power = 0;
        this.state.battery.current = 0;
        this.state.grid.power = -netPower;
      }
    } else {
      // Deficit - need battery or grid
      const deficit = -netPower;

      if (this.state.battery.soc > 20 && this.state.mode !== 'UTL') {
        // Use battery first (SBU/SOL mode)
        const fromBattery = Math.min(deficit, 5000);
        this.state.battery.discharging = true;
        this.state.battery.charging = false;
        this.state.battery.power = -fromBattery;
        this.state.battery.current = -fromBattery / this.state.battery.voltage;
        this.state.grid.power = deficit - fromBattery;
      } else {
        // Use grid
        this.state.battery.discharging = false;
        this.state.battery.power = 0;
        this.state.battery.current = 0;
        this.state.grid.power = deficit;
      }
    }
  }

  _updateTemperatures(dt) {
    const loadFactor = this.state.output.loadPercent / 100;
    const targetTemp = 30 + loadFactor * 30;

    ['heatsink', 'transformer'].forEach(sensor => {
      const current = this.state.temps[sensor];
      const diff = targetTemp - current;
      this.state.temps[sensor] = current + diff * 0.1 * dt + (Math.random() - 0.5) * 0.5;
    });
  }

  _checkFaults() {
    const s = this.state;

    s.faults.overload = s.output.loadPercent > 110;
    s.faults.overTemperature = s.temps.heatsink > 75;
    s.faults.batteryOvervoltage = s.battery.voltage > 58;
    s.faults.batteryUndervoltage = s.battery.voltage < 42;

    s.warnings.highTemperature = s.temps.heatsink > 60;
    s.warnings.lowBattery = s.battery.soc < 20;
    s.warnings.overload75 = s.output.loadPercent > 75;
  }

  _updateEnergy(dt) {
    const hours = dt / 3600;

    if (this.state.pv.power > 0) {
      this.state.energyToday.pvGeneration += (this.state.pv.power / 1000) * hours;
    }

    if (this.state.battery.power > 0) {
      this.state.energyToday.batteryCharge += (this.state.battery.power / 1000) * hours;
    } else if (this.state.battery.power < 0) {
      this.state.energyToday.batteryDischarge += (Math.abs(this.state.battery.power) / 1000) * hours;
    }

    if (this.state.grid.power > 0) {
      this.state.energyToday.gridImport += (this.state.grid.power / 1000) * hours;
    } else if (this.state.grid.power < 0) {
      this.state.energyToday.gridExport += (Math.abs(this.state.grid.power) / 1000) * hours;
    }

    this.state.energyToday.consumption += (this.state.output.power / 1000) * hours;
  }

  /**
   * Get inverter telemetry
   */
  getTelemetry() {
    return {
      mode: this.state.mode,
      online: this.state.isOnline,

      pv: {
        voltage: parseFloat(this.state.pv.voltage.toFixed(1)),
        current: parseFloat(this.state.pv.current.toFixed(2)),
        power: parseFloat(this.state.pv.power.toFixed(0))
      },

      grid: {
        voltage: parseFloat(this.state.grid.voltage.toFixed(1)),
        frequency: parseFloat(this.state.grid.frequency.toFixed(2)),
        connected: this.state.grid.connected,
        power: parseFloat(this.state.grid.power.toFixed(0))
      },

      output: {
        voltage: parseFloat(this.state.output.voltage.toFixed(1)),
        frequency: parseFloat(this.state.output.frequency.toFixed(2)),
        power: parseFloat(this.state.output.power.toFixed(0)),
        loadPercent: parseFloat(this.state.output.loadPercent.toFixed(1))
      },

      battery: {
        voltage: parseFloat(this.state.battery.voltage.toFixed(2)),
        current: parseFloat(this.state.battery.current.toFixed(2)),
        power: parseFloat(this.state.battery.power.toFixed(0)),
        soc: parseFloat(this.state.battery.soc.toFixed(1)),
        charging: this.state.battery.charging,
        discharging: this.state.battery.discharging
      },

      temps: {
        heatsink: parseFloat(this.state.temps.heatsink.toFixed(1)),
        transformer: parseFloat(this.state.temps.transformer.toFixed(1))
      }
    };
  }

  /**
   * Get detailed status for API/UI
   */
  getDetailedStatus() {
    return {
      deviceId: this.deviceId,
      model: 'ANENJI ANJ-6200W-48V',
      firmware: '3.2.1',
      ...this.getTelemetry(),
      faults: this.state.faults,
      warnings: this.state.warnings,
      hasFault: Object.values(this.state.faults).some(v => v),
      hasWarning: Object.values(this.state.warnings).some(v => v),
      energyToday: {
        pvGeneration: parseFloat(this.state.energyToday.pvGeneration.toFixed(2)),
        batteryCharge: parseFloat(this.state.energyToday.batteryCharge.toFixed(2)),
        batteryDischarge: parseFloat(this.state.energyToday.batteryDischarge.toFixed(2)),
        gridImport: parseFloat(this.state.energyToday.gridImport.toFixed(2)),
        gridExport: parseFloat(this.state.energyToday.gridExport.toFixed(2)),
        consumption: parseFloat(this.state.energyToday.consumption.toFixed(2))
      }
    };
  }

  /**
   * Set operation mode
   */
  setMode(mode) {
    if (['UTL', 'SOL', 'SBU', 'SUB'].includes(mode)) {
      this.state.mode = mode;
    }
  }

  /**
   * Reset daily energy counters
   */
  resetDailyCounters() {
    this.state.energyToday = {
      pvGeneration: 0,
      batteryCharge: 0,
      batteryDischarge: 0,
      gridImport: 0,
      gridExport: 0,
      consumption: 0
    };
  }
}

module.exports = AnenjiInverter;
