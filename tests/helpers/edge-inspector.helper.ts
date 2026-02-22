/**
 * Edge Inspector helper — reads edge controller internal state for test assertions
 */

import http from 'http';

export interface EdgeInspectorConfig {
  systemId: string;
  edgeDebugUrl?: string;
}

export interface EdgeHeartbeat {
  timestamp: number;
  mode: 'ONLINE' | 'AUTONOMOUS' | 'SAFE_MODE' | 'ERROR';
  version: string;
  controlLoopHz: number;
}

export interface EdgeDecision {
  timestamp: number;
  action: string;
  source: 'CLOUD' | 'CACHED' | 'LOCAL' | 'SAFETY';
  reason: string;
}

export class EdgeInspector {
  private readonly debugUrl: string;

  constructor(private readonly config: EdgeInspectorConfig) {
    this.debugUrl = config.edgeDebugUrl ?? `http://localhost:9090/${config.systemId}`;
  }

  async getLastHeartbeat(): Promise<EdgeHeartbeat | null> {
    try {
      const data = await this.get<EdgeHeartbeat>('/heartbeat');
      return data;
    } catch {
      return null;
    }
  }

  async getSqliteBufferCount(): Promise<number> {
    try {
      const data = await this.get<{ count: number }>('/buffer/count');
      return data.count;
    } catch {
      return -1;
    }
  }

  async getRecentDecisions(count: number): Promise<EdgeDecision[]> {
    try {
      const data = await this.get<{ decisions: EdgeDecision[] }>(`/decisions?limit=${count}`);
      return data.decisions;
    } catch {
      return [];
    }
  }

  async getCurrentVersion(): Promise<string> {
    try {
      const data = await this.get<{ version: string }>('/version');
      return data.version;
    } catch {
      return 'unknown';
    }
  }

  async getSafetyViolationCount(): Promise<number> {
    try {
      const data = await this.get<{ violations: number }>('/safety/violations');
      return data.violations;
    } catch {
      return 0;
    }
  }

  async setDebugFlag(flag: string, value: unknown): Promise<void> {
    await this.post('/debug/flags', { [flag]: value });
  }

  private get<T>(path: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.debugUrl);
      http.get(url, { timeout: 5000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON from edge inspector: ${data}`));
          }
        });
      }).on('error', reject);
    });
  }

  private post<T>(path: string, body: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.debugUrl);
      const bodyStr = JSON.stringify(body);
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(bodyStr),
          },
          timeout: 5000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve(data as unknown as T); }
          });
        },
      );
      req.on('error', reject);
      req.write(bodyStr);
      req.end();
    });
  }
}
