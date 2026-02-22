/**
 * API Client helper for integration tests
 */

import http from 'http';
import https from 'https';
import { URL } from 'url';

export interface ApiClientConfig {
  baseUrl: string;
}

export interface RequestOptions {
  expectError?: boolean;
}

interface ApiResponse<T = unknown> {
  status: number;
  data: T;
}

export class ApiClient {
  private token: string | null = null;

  constructor(private readonly config: ApiClientConfig) {}

  async authenticate(credentials: { email: string; password: string }): Promise<void> {
    const response = await this.post<{ token: string }>('/auth/login', credentials);
    this.token = response.data.token;
  }

  async get<T = unknown>(path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, opts);
  }

  async post<T = unknown>(
    path: string,
    body?: unknown,
    opts: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, opts);
  }

  async put<T = unknown>(
    path: string,
    body?: unknown,
    opts: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, opts);
  }

  async delete<T = unknown>(path: string, opts: RequestOptions = {}): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, opts);
  }

  private request<T>(
    method: string,
    path: string,
    body?: unknown,
    opts: RequestOptions = {},
  ): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.config.baseUrl);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const bodyStr = body ? JSON.stringify(body) : undefined;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };

      if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
      if (bodyStr) headers['Content-Length'] = String(Buffer.byteLength(bodyStr));

      const req = lib.request(
        {
          hostname: url.hostname,
          port: url.port || (isHttps ? 443 : 80),
          path: url.pathname + url.search,
          method,
          headers,
          timeout: 30_000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let parsed: T;
            try {
              parsed = JSON.parse(data);
            } catch {
              parsed = data as unknown as T;
            }

            const response: ApiResponse<T> = { status: res.statusCode ?? 0, data: parsed };

            if (!opts.expectError && res.statusCode && res.statusCode >= 400) {
              reject(new Error(`HTTP ${res.statusCode}: ${JSON.stringify(parsed)}`));
            } else {
              resolve(response);
            }
          });
        },
      );

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Request timeout')));

      if (bodyStr) req.write(bodyStr);
      req.end();
    });
  }
}
