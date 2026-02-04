/**
 * JK BMS PB2A16S20P Simulator
 * 16S LiFePO4 Battery Management System
 *
 * Specs:
 * - 16 cells in series (LiFePO4)
 * - 200Ah nominal capacity
 * - 48V nominal (51.2V nominal)
 * - Bluetooth + UART communication
 */

class JKBMS {
  constructor(config = {}) {
    this.deviceId = config.deviceId || 'jk-bms-001';
    this.cellCount = 16;
    this.nominalCapacity = config.nominalCapacity || 200; // Ah
    this.nominalVoltage = 51.2; // V (16 * 3.2V)

    // Initial state
    this.state = {
      soc: config.initialSoc || 85,
      soh: 98,
      cycles: 127,

      // Cell voltages (V) - LiFePO4 range: 2.5V - 3.65V
      cells: this._initCells(),

      // Temperatures (°C)
      temps: [28.5, 29.1, 27.8, 28.2],
      tempMosfet: 32.5,

      // Current state
      current: 0, // A (+ charging, - discharging)

      // Protection status
      chargingEnabled: true,
      dischargingEnabled: true,
      balancingActive: false,
      balancingCells: 0, // Bitmask

      // Alarms (all false = normal)
      alarms: {
        overvoltage: false,
        undervoltage: false,
        overcurrent: false,
        overtemp: false,
        undertemp: false,
        cellImbalance: false,
        shortCircuit: false,
        mosfetOvertemp: false
      },

      // Manual alarms (set via UI/API, persists until reset)
      manualAlarms: {
        overvoltage: false,
        undervoltage: false,
        overcurrent: false,
        overtemp: false,
        undertemp: false,
        cellImbalance: false,
        shortCircuit: false,
        mosfetOvertemp: false
      },

      // Warnings
      warnings: {
        highVoltage: false,
        lowVoltage: false,
        highTemp: false,
        lowTemp: false,
        lowSoc: false,
        highSoc: false
      }
    };

    // Simulation parameters
    this.chargeEfficiency = 0.98;
    this.dischargeEfficiency = 0.97;
    this.selfDischargeRate = 0.0001; // % per second
  }

  _initCells() {
    // Initialize cells with slight variations
    const baseVoltage = 3.28; // ~85% SOC for LiFePO4
    return Array.from({ length: this.cellCount }, () =>
      baseVoltage + (Math.random() - 0.5) * 0.01
    );
  }

  /**
   * Update simulation state based on scenario
   * @param {string} scenario - Current scenario name
   * @param {number} deltaTime - Time since last update (ms)
   */
  update(scenario, deltaTime = 1000) {
    const dt = deltaTime / 1000; // Convert to seconds

    switch (scenario) {
      case 'normal':
        this._updateNormal(dt);
        break;
      case 'solar-charging':
        this._updateSolarCharging(dt);
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
        this._updateZeroImport(dt);
        break;
      default:
        this._updateNormal(dt);
    }

    // Always update derived values
    this._updateDerivedValues();
    this._checkAlarms();
    this._updateBalancing();
  }

  _updateNormal(dt) {
    // Standby - small self-discharge
    this.state.current = (Math.random() - 0.5) * 0.5; // ±0.25A noise
    this.state.soc = Math.max(0, this.state.soc - this.selfDischargeRate * dt);
    this._driftTemperatures(25, dt);
  }

  _updateSolarCharging(dt) {
    // Solar charging - 20-40A typical
    const baseChargeCurrent = 30;
    const variation = (Math.random() - 0.5) * 10;
    this.state.current = this.state.soc >= 98 ? 2 : baseChargeCurrent + variation;

    // SOC increases (with absorption phase at high SOC)
    const chargeRate = this.state.soc > 90 ? 0.5 : 1;
    const socIncrease = (this.state.current / this.nominalCapacity) * 100 * dt / 3600 * chargeRate;
    this.state.soc = Math.min(100, this.state.soc + socIncrease * this.chargeEfficiency);

    // Temps rise slightly during charging
    this._driftTemperatures(32, dt);
  }

  _updateDischarging(dt) {
    // Discharging - 15-35A typical load
    const baseDischargeRate = -25;
    const variation = (Math.random() - 0.5) * 10;
    this.state.current = baseDischargeRate + variation;

    // SOC decreases
    const socDecrease = (Math.abs(this.state.current) / this.nominalCapacity) * 100 * dt / 3600;
    this.state.soc = Math.max(0, this.state.soc - socDecrease / this.dischargeEfficiency);

    // Temps rise during discharge
    this._driftTemperatures(35, dt);
  }

  _updateGridCharging(dt) {
    // Grid charging - constant current
    const chargeCurrent = 50; // Fast charge from grid
    this.state.current = this.state.soc >= 95 ? 10 : chargeCurrent;

    const socIncrease = (this.state.current / this.nominalCapacity) * 100 * dt / 3600;
    this.state.soc = Math.min(100, this.state.soc + socIncrease * this.chargeEfficiency);

    this._driftTemperatures(38, dt);
  }

  _updateLowBattery(dt) {
    // Low battery scenario
    this.state.soc = Math.min(this.state.soc, 15);
    this.state.current = -5; // Small discharge
    this.state.warnings.lowSoc = true;

    // Cells at low voltage
    this.state.cells = this.state.cells.map(() =>
      3.0 + (Math.random() - 0.5) * 0.05
    );

    this._driftTemperatures(25, dt);
  }

  _updateHighTemp(dt) {
    // High temperature scenario
    this.state.current = -20;
    this.state.temps = this.state.temps.map(() =>
      50 + Math.random() * 5
    );
    this.state.tempMosfet = 58 + Math.random() * 5;

    // May trigger protection
    if (this.state.temps[0] > 55) {
      this.state.alarms.overtemp = true;
      this.state.dischargingEnabled = false;
    }
  }

  _updateGridFailure(dt) {
    // Grid failure - battery supplying critical loads
    const criticalLoad = -40; // High discharge
    this.state.current = criticalLoad + (Math.random() - 0.5) * 5;

    const socDecrease = (Math.abs(this.state.current) / this.nominalCapacity) * 100 * dt / 3600;
    this.state.soc = Math.max(10, this.state.soc - socDecrease / this.dischargeEfficiency);

    this._driftTemperatures(40, dt);
  }

  _updateZeroImport(dt) {
    // Zero grid import - battery covers difference
    const netLoad = -8; // Small discharge to achieve zero import
    this.state.current = netLoad + (Math.random() - 0.5) * 2;

    const socDecrease = (Math.abs(this.state.current) / this.nominalCapacity) * 100 * dt / 3600;
    this.state.soc = Math.max(20, this.state.soc - socDecrease / this.dischargeEfficiency);

    this._driftTemperatures(30, dt);
  }

  _driftTemperatures(target, dt) {
    const rate = 0.1; // °C per second drift rate
    this.state.temps = this.state.temps.map(t => {
      const diff = target - t;
      const drift = Math.sign(diff) * Math.min(Math.abs(diff), rate * dt);
      return t + drift + (Math.random() - 0.5) * 0.2;
    });

    // MOSFET temp follows with offset
    const avgTemp = this.state.temps.reduce((a, b) => a + b, 0) / this.state.temps.length;
    this.state.tempMosfet = avgTemp + 5 + Math.random() * 2;
  }

  _updateDerivedValues() {
    // Update cell voltages based on SOC (LiFePO4 OCV curve)
    const ocv = this._socToOcv(this.state.soc);
    const irDrop = this.state.current * 0.001; // Internal resistance effect

    this.state.cells = this.state.cells.map((cell, i) => {
      const baseVoltage = ocv + irDrop;
      // Add small cell-to-cell variation
      const variation = (Math.random() - 0.5) * 0.005;
      return Math.max(2.5, Math.min(3.65, baseVoltage + variation));
    });
  }

  _socToOcv(soc) {
    // LiFePO4 OCV curve approximation
    // Very flat in the middle (20-80%)
    if (soc <= 10) return 2.8 + (soc / 10) * 0.4;
    if (soc <= 20) return 3.2 + ((soc - 10) / 10) * 0.05;
    if (soc <= 80) return 3.25 + ((soc - 20) / 60) * 0.05;
    if (soc <= 90) return 3.3 + ((soc - 80) / 10) * 0.1;
    return 3.4 + ((soc - 90) / 10) * 0.2;
  }

  _checkAlarms() {
    const cells = this.state.cells;
    const temps = this.state.temps;
    const current = this.state.current;

    // Auto-detect alarms based on conditions
    const autoAlarms = {
      overvoltage: cells.some(v => v > 3.65),
      undervoltage: cells.some(v => v < 2.5),
      overcurrent: Math.abs(current) > 150,
      overtemp: temps.some(t => t > 55),
      undertemp: temps.some(t => t < 0),
      cellImbalance: (Math.max(...cells) - Math.min(...cells)) > 0.1,
      shortCircuit: false,
      mosfetOvertemp: this.state.tempMosfet > 65
    };

    // Merge with manual alarms (manual overrides auto)
    this.state.alarms = {
      overvoltage: this.state.manualAlarms?.overvoltage || autoAlarms.overvoltage,
      undervoltage: this.state.manualAlarms?.undervoltage || autoAlarms.undervoltage,
      overcurrent: this.state.manualAlarms?.overcurrent || autoAlarms.overcurrent,
      overtemp: this.state.manualAlarms?.overtemp || autoAlarms.overtemp,
      undertemp: this.state.manualAlarms?.undertemp || autoAlarms.undertemp,
      cellImbalance: this.state.manualAlarms?.cellImbalance || autoAlarms.cellImbalance,
      shortCircuit: this.state.manualAlarms?.shortCircuit || autoAlarms.shortCircuit,
      mosfetOvertemp: this.state.manualAlarms?.mosfetOvertemp || autoAlarms.mosfetOvertemp
    };

    // Warnings (less severe thresholds)
    this.state.warnings = {
      highVoltage: cells.some(v => v > 3.55),
      lowVoltage: cells.some(v => v < 2.8),
      highTemp: temps.some(t => t > 45),
      lowTemp: temps.some(t => t < 5),
      lowSoc: this.state.soc < 20,
      highSoc: this.state.soc > 95
    };
  }

  _updateBalancing() {
    // Balancing starts when any cell is > 3.4V and diff > 30mV
    const maxCell = Math.max(...this.state.cells);
    const minCell = Math.min(...this.state.cells);
    const diff = maxCell - minCell;

    if (maxCell > 3.4 && diff > 0.03) {
      this.state.balancingActive = true;
      // Set bitmask for cells needing balance (highest cells)
      this.state.balancingCells = this.state.cells.reduce((mask, v, i) => {
        return (v > minCell + 0.02) ? mask | (1 << i) : mask;
      }, 0);
    } else {
      this.state.balancingActive = false;
      this.state.balancingCells = 0;
    }
  }

  /**
   * Get telemetry in EMS-compatible format
   */
  getTelemetry() {
    const voltage = this.state.cells.reduce((sum, v) => sum + v, 0);
    const power = voltage * this.state.current;

    // Convert alarms to bitmask
    const alarmBits = Object.values(this.state.alarms);
    const alarmMask = alarmBits.reduce((mask, v, i) => v ? mask | (1 << i) : mask, 0);

    // Convert warnings to bitmask
    const warnBits = Object.values(this.state.warnings);
    const warnMask = warnBits.reduce((mask, v, i) => v ? mask | (1 << i) : mask, 0);

    return {
      v: parseFloat(voltage.toFixed(2)),
      i: parseFloat(this.state.current.toFixed(2)),
      soc: parseFloat(this.state.soc.toFixed(1)),
      soh: this.state.soh,
      cells: this.state.cells.map(v => parseFloat(v.toFixed(3))),
      temps: this.state.temps.map(t => parseFloat(t.toFixed(1))),
      bal: this.state.balancingCells,
      alm: alarmMask,
      wrn: warnMask,
      cyc: this.state.cycles,
      cap: parseFloat((this.nominalCapacity * this.state.soc / 100).toFixed(1))
    };
  }

  /**
   * Get detailed BMS status (for API/UI)
   */
  getDetailedStatus() {
    const voltage = this.state.cells.reduce((sum, v) => sum + v, 0);
    const power = voltage * this.state.current;

    return {
      deviceId: this.deviceId,
      model: 'JK BMS PB2A16S20P',
      firmware: '11.XW',

      // Pack
      voltage: parseFloat(voltage.toFixed(2)),
      current: parseFloat(this.state.current.toFixed(2)),
      power: parseFloat(power.toFixed(0)),
      soc: parseFloat(this.state.soc.toFixed(1)),
      soh: this.state.soh,
      cycles: this.state.cycles,
      capacity: this.nominalCapacity,
      energyRemaining: parseFloat((this.nominalCapacity * this.state.soc / 100 * voltage / 1000).toFixed(2)),

      // Cells
      cells: this.state.cells.map((v, i) => ({
        index: i + 1,
        voltage: parseFloat(v.toFixed(3)),
        isBalancing: (this.state.balancingCells & (1 << i)) !== 0
      })),
      cellMin: parseFloat(Math.min(...this.state.cells).toFixed(3)),
      cellMax: parseFloat(Math.max(...this.state.cells).toFixed(3)),
      cellDiff: parseFloat((Math.max(...this.state.cells) - Math.min(...this.state.cells)).toFixed(3)),

      // Temperatures
      temperatures: this.state.temps.map((t, i) => ({
        sensor: i + 1,
        value: parseFloat(t.toFixed(1))
      })),
      tempMosfet: parseFloat(this.state.tempMosfet.toFixed(1)),
      tempMin: parseFloat(Math.min(...this.state.temps).toFixed(1)),
      tempMax: parseFloat(Math.max(...this.state.temps).toFixed(1)),

      // Status
      chargingEnabled: this.state.chargingEnabled,
      dischargingEnabled: this.state.dischargingEnabled,
      balancingActive: this.state.balancingActive,

      // Alarms & Warnings
      alarms: this.state.alarms,
      warnings: this.state.warnings,
      hasAlarm: Object.values(this.state.alarms).some(v => v),
      hasWarning: Object.values(this.state.warnings).some(v => v)
    };
  }

  /**
   * Set SOC directly (for scenario changes)
   */
  setSoc(soc) {
    this.state.soc = Math.max(0, Math.min(100, soc));
    this._updateDerivedValues();
  }

  /**
   * Reset alarms
   */
  resetAlarms() {
    this.state.alarms = Object.fromEntries(
      Object.keys(this.state.alarms).map(k => [k, false])
    );
    this.state.manualAlarms = Object.fromEntries(
      Object.keys(this.state.manualAlarms).map(k => [k, false])
    );
    this.state.chargingEnabled = true;
    this.state.dischargingEnabled = true;
  }
}

module.exports = JKBMS;
