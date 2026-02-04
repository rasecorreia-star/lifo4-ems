/**
 * BESS Scenarios Configuration
 *
 * Each scenario simulates a specific operational condition
 * for testing the EMS behavior
 */

const scenarios = {
  normal: {
    name: 'Normal / Standby',
    description: 'Sistema em standby, pequeno consumo residual',
    initialState: {
      bms: { soc: 85 },
      inverter: { mode: 'SBU' }
    },
    conditions: {
      solarAvailable: false,
      gridConnected: true,
      loadLevel: 'low'
    }
  },

  'solar-charging': {
    name: 'Carga Solar',
    description: 'Sol forte carregando bateria, possível exportação',
    initialState: {
      bms: { soc: 60 },
      inverter: { mode: 'SBU' }
    },
    conditions: {
      solarAvailable: true,
      solarIntensity: 0.9, // 90% of max
      gridConnected: true,
      loadLevel: 'low'
    }
  },

  discharging: {
    name: 'Descarga',
    description: 'Bateria alimentando cargas, horário de pico',
    initialState: {
      bms: { soc: 75 },
      inverter: { mode: 'SBU' }
    },
    conditions: {
      solarAvailable: false,
      gridConnected: true,
      loadLevel: 'high'
    }
  },

  'grid-charging': {
    name: 'Carga pela Rede',
    description: 'Carregando bateria via rede elétrica (horário fora de pico)',
    initialState: {
      bms: { soc: 30 },
      inverter: { mode: 'UTL' }
    },
    conditions: {
      solarAvailable: false,
      gridConnected: true,
      loadLevel: 'low',
      gridCharging: true
    }
  },

  'low-battery': {
    name: 'Bateria Baixa',
    description: 'SOC crítico, alarme de bateria baixa',
    initialState: {
      bms: { soc: 12 },
      inverter: { mode: 'UTL' }
    },
    conditions: {
      solarAvailable: false,
      gridConnected: true,
      loadLevel: 'medium',
      batteryProtection: true
    },
    expectedAlarms: ['lowSoc', 'lowVoltage']
  },

  'high-temp': {
    name: 'Temperatura Alta',
    description: 'Temperatura elevada, possível derating',
    initialState: {
      bms: { soc: 70 },
      inverter: { mode: 'SBU' }
    },
    conditions: {
      solarAvailable: true,
      gridConnected: true,
      loadLevel: 'high',
      ambientTemp: 45
    },
    expectedAlarms: ['highTemp']
  },

  'grid-failure': {
    name: 'Falha de Rede',
    description: 'Blackout - sistema em modo backup/UPS',
    initialState: {
      bms: { soc: 80 },
      inverter: { mode: 'SBU' }
    },
    conditions: {
      solarAvailable: false,
      gridConnected: false,
      loadLevel: 'critical-only'
    },
    expectedAlarms: ['gridFailure']
  },

  'zero-import': {
    name: 'Zero Import',
    description: 'Controlando para consumo zero da rede',
    initialState: {
      bms: { soc: 70 },
      inverter: { mode: 'SBU' }
    },
    conditions: {
      solarAvailable: true,
      gridConnected: true,
      loadLevel: 'medium',
      zeroImportTarget: true
    },
    targets: {
      gridPower: 0, // Target zero import
      tolerance: 50 // ±50W
    }
  }
};

/**
 * Get all available scenarios
 */
function getScenarios() {
  return Object.entries(scenarios).map(([id, config]) => ({
    id,
    name: config.name,
    description: config.description
  }));
}

/**
 * Get scenario configuration
 */
function getScenario(scenarioId) {
  return scenarios[scenarioId] || scenarios.normal;
}

/**
 * Get scenario by name
 */
function getScenarioByName(name) {
  const entry = Object.entries(scenarios).find(([, cfg]) => cfg.name === name);
  return entry ? { id: entry[0], ...entry[1] } : null;
}

module.exports = {
  scenarios,
  getScenarios,
  getScenario,
  getScenarioByName
};
