import { getPool } from './connection';

export interface OptimizationConfig {
  systemId: string;
  arbitrageConfig: Record<string, unknown>;
  peakShavingConfig: Record<string, unknown>;
  solarConfig: Record<string, unknown>;
  gridServicesConfig: Record<string, unknown>;
  taxOptimizerConfig: Record<string, unknown>;
  updatedAt: Date;
}

export async function getOptimizationConfig(systemId: string): Promise<OptimizationConfig | null> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM optimization_configs WHERE system_id = $1`,
    [systemId]
  );
  if (!result.rows[0]) return null;
  const row = result.rows[0];
  return {
    systemId: row.system_id,
    arbitrageConfig: row.arbitrage_config,
    peakShavingConfig: row.peak_shaving_config,
    solarConfig: row.solar_config,
    gridServicesConfig: row.grid_services_config,
    taxOptimizerConfig: row.tax_optimizer_config,
    updatedAt: row.updated_at,
  };
}

export async function upsertOptimizationConfig(
  systemId: string,
  config: Partial<OptimizationConfig>,
  updatedBy: string
): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO optimization_configs
       (system_id, arbitrage_config, peak_shaving_config, solar_config,
        grid_services_config, tax_optimizer_config, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (system_id) DO UPDATE SET
       arbitrage_config = COALESCE($2, EXCLUDED.arbitrage_config),
       peak_shaving_config = COALESCE($3, EXCLUDED.peak_shaving_config),
       solar_config = COALESCE($4, EXCLUDED.solar_config),
       grid_services_config = COALESCE($5, EXCLUDED.grid_services_config),
       tax_optimizer_config = COALESCE($6, EXCLUDED.tax_optimizer_config),
       updated_by = $7,
       updated_at = NOW()`,
    [
      systemId,
      config.arbitrageConfig ? JSON.stringify(config.arbitrageConfig) : null,
      config.peakShavingConfig ? JSON.stringify(config.peakShavingConfig) : null,
      config.solarConfig ? JSON.stringify(config.solarConfig) : null,
      config.gridServicesConfig ? JSON.stringify(config.gridServicesConfig) : null,
      config.taxOptimizerConfig ? JSON.stringify(config.taxOptimizerConfig) : null,
      updatedBy,
    ]
  );
}
