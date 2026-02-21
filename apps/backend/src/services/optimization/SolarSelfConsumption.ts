/**
 * Solar Self-Consumption Optimization Service
 * Maximizes on-site solar consumption to reduce grid imports
 */

import { SystemTelemetry, GridState, MarketData, DecisionResult, DecisionAction } from '../../../../../packages/shared/src/types/optimization';

export class SolarSelfConsumptionService {
  constructor(private systemId: string) {}

  /**
   * Calculate excess solar generation
   * @param geracaoKW Solar generation in kW
   * @param consumoKW Current consumption in kW
   * @returns Excess solar in kW (0 if no excess)
   */
  calcularExcedenteSolar(geracaoKW: number, consumoKW: number): number {
    const excedente = geracaoKW - consumoKW;
    return Math.max(0, excedente);
  }

  /**
   * Decide optimal storage action for excess solar
   * @param excedente Excess solar generation (kW)
   * @param soc Current state of charge (%)
   * @param constraints System constraints
   * @returns Decision to CHARGE if beneficial, IDLE otherwise
   */
  decidirArmazenamento(excedente: number, soc: number, constraints: any): DecisionResult {
    const decision: DecisionResult = {
      action: 'IDLE' as DecisionAction,
      powerKW: 0,
      durationMinutes: 0,
      confidence: 0.8,
      priority: 'ECONOMIC',
      reason: 'Solar self-consumption optimization',
      timestamp: new Date(),
      nextReviewAt: new Date(Date.now() + 5 * 60000),
    };

    // If there's excess solar and battery not full, charge
    if (excedente > 0 && soc < constraints.maxSOC - 5) {
      decision.action = 'CHARGE' as DecisionAction;
      decision.powerKW = Math.min(excedente, constraints.maxPower);
      decision.durationMinutes = 60; // Assume 1 hour charge duration
      decision.confidence = 0.9;
      decision.reason = `Armazenar ${excedente.toFixed(1)}kW de excedente solar. SOC atual: ${soc}%`;
    }

    return decision;
  }

  /**
   * Calculate self-consumption rate
   * @param gerado Total solar generated (kWh)
   * @param consumido Total consumed locally (kWh)
   * @param armazenado Total stored in battery (kWh)
   * @returns Self-consumption rate (0-1)
   */
  calcularTaxaAutoconsumo(gerado: number, consumido: number, armazenado: number): number {
    if (gerado === 0) return 0;
    const totalLocal = consumido + armazenado;
    return Math.min(1, totalLocal / gerado);
  }

  /**
   * Calculate potential savings from self-consumption
   * @param excedente Annual excess solar (kWh)
   * @param spotPrice Grid import price (R$/kWh)
   * @param efficiency Round-trip battery efficiency (0-1)
   * @returns Annual savings in R$
   */
  calcularEconomiaAnual(excedente: number, spotPrice: number, efficiency: number = 0.95): number {
    // Assume 30% of excess can be stored and used later
    const armazenavelAnual = excedente * 0.3 * efficiency;
    return armazenavelAnual * spotPrice;
  }
}
