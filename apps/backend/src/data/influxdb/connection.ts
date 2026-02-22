import { InfluxDB, WriteApi, QueryApi } from '@influxdata/influxdb-client';

let _influx: InfluxDB | null = null;
let _writeApi: WriteApi | null = null;
let _queryApi: QueryApi | null = null;

const ORG = 'lifo4';
const BUCKET = 'telemetry';

function getInflux(): InfluxDB {
  if (!_influx) {
    const url = process.env.INFLUXDB_URL || 'http://localhost:8086';
    const token = process.env.INFLUXDB_TOKEN;
    if (!token) {
      throw new Error('INFLUXDB_TOKEN environment variable is required');
    }
    _influx = new InfluxDB({ url, token });
  }
  return _influx;
}

export function getWriteApi(): WriteApi {
  if (!_writeApi) {
    _writeApi = getInflux().getWriteApi(ORG, BUCKET, 'ms', {
      batchSize: 100,
      flushInterval: 5000,  // flush every 5 seconds
      maxRetries: 3,
    });
  }
  return _writeApi;
}

export function getQueryApi(): QueryApi {
  if (!_queryApi) {
    _queryApi = getInflux().getQueryApi(ORG);
  }
  return _queryApi;
}

export async function closeInflux(): Promise<void> {
  if (_writeApi) {
    await _writeApi.close();
    _writeApi = null;
  }
}
