import { Point } from '@influxdata/influxdb-client';
import { getWriteApi, getQueryApi } from './connection';

export interface TelemetryPoint {
  systemId: string;
  organizationId: string;
  soc: number;
  soh: number;
  voltage: number;
  current: number;
  powerKw: number;
  tempMin: number;
  tempMax: number;
  tempAvg: number;
  frequency: number;
  gridVoltage: number;
  cellVoltageMin?: number;
  cellVoltageMax?: number;
  timestamp?: Date;
}

/** Write a telemetry point to InfluxDB (batched). */
export function writeTelemetryPoint(data: TelemetryPoint): void {
  const writeApi = getWriteApi();
  const point = new Point('bess_telemetry')
    .tag('system_id', data.systemId)
    .tag('organization_id', data.organizationId)
    .floatField('soc', data.soc)
    .floatField('soh', data.soh)
    .floatField('voltage', data.voltage)
    .floatField('current', data.current)
    .floatField('power_kw', data.powerKw)
    .floatField('temp_min', data.tempMin)
    .floatField('temp_max', data.tempMax)
    .floatField('temp_avg', data.tempAvg)
    .floatField('frequency', data.frequency)
    .floatField('grid_voltage', data.gridVoltage);

  if (data.cellVoltageMin !== undefined) {
    point.floatField('cell_voltage_min', data.cellVoltageMin);
  }
  if (data.cellVoltageMax !== undefined) {
    point.floatField('cell_voltage_max', data.cellVoltageMax);
  }
  if (data.timestamp) {
    point.timestamp(data.timestamp);
  }

  writeApi.writePoint(point);
}

/** Query recent telemetry for a system. */
export async function queryRecentTelemetry(
  systemId: string,
  hours: number = 24
): Promise<TelemetryPoint[]> {
  const queryApi = getQueryApi();
  const flux = `
    from(bucket: "telemetry")
      |> range(start: -${hours}h)
      |> filter(fn: (r) => r._measurement == "bess_telemetry")
      |> filter(fn: (r) => r.system_id == "${systemId}")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: true)
  `;

  const rows: TelemetryPoint[] = [];
  await queryApi.collectRows(flux, (row: Record<string, unknown>) => {
    rows.push({
      systemId: row.system_id as string,
      organizationId: row.organization_id as string,
      soc: row.soc as number,
      soh: row.soh as number,
      voltage: row.voltage as number,
      current: row.current as number,
      powerKw: row.power_kw as number,
      tempMin: row.temp_min as number,
      tempMax: row.temp_max as number,
      tempAvg: row.temp_avg as number,
      frequency: row.frequency as number,
      gridVoltage: row.grid_voltage as number,
      timestamp: new Date(row._time as string),
    });
  });
  return rows;
}

/** Query aggregated hourly data. */
export async function queryHourlyAggregated(
  systemId: string,
  days: number = 7
): Promise<unknown[]> {
  const queryApi = getQueryApi();
  const flux = `
    from(bucket: "telemetry_aggregated")
      |> range(start: -${days}d)
      |> filter(fn: (r) => r._measurement == "bess_telemetry")
      |> filter(fn: (r) => r.system_id == "${systemId}")
      |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      |> sort(columns: ["_time"], desc: false)
  `;

  const rows: unknown[] = [];
  await queryApi.collectRows(flux, (row) => rows.push(row));
  return rows;
}
