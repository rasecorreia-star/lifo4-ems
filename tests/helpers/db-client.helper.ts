/**
 * Database client helper for integration tests
 */

import { Client, QueryResult } from 'pg';

export interface DbClientConfig {
  connectionString: string;
}

export class DbClient {
  private readonly client: Client;

  constructor(config: DbClientConfig) {
    this.client = new Client({ connectionString: config.connectionString });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: unknown[] = [],
  ): Promise<QueryResult<T>> {
    if (this.client['_connected'] === false) {
      await this.connect();
    }
    return this.client.query<T>(sql, params);
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
