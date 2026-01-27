/**
 * Failover Manager Service
 * Manages connection failover and redundancy
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export interface ConnectionEndpoint {
  id: string;
  name: string;
  type: EndpointType;
  url: string;
  priority: number;  // Lower = higher priority
  weight?: number;   // For load balancing
  healthCheck: HealthCheckConfig;
  status: EndpointStatus;
  lastChecked?: Date;
  lastFailure?: Date;
  failureCount: number;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export enum EndpointType {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  TERTIARY = 'tertiary',
  BACKUP = 'backup',
}

export enum EndpointStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
  MAINTENANCE = 'maintenance',
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number;
  timeoutMs: number;
  successThreshold: number;
  failureThreshold: number;
  method: 'tcp' | 'http' | 'ping' | 'custom';
  path?: string;  // For HTTP checks
}

export interface FailoverPolicy {
  mode: FailoverMode;
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  maxRetryDelayMs: number;
  circuitBreaker: CircuitBreakerConfig;
}

export enum FailoverMode {
  PRIORITY = 'priority',      // Strict priority order
  ROUND_ROBIN = 'round_robin', // Rotate through healthy endpoints
  WEIGHTED = 'weighted',       // Weighted distribution
  FASTEST = 'fastest',         // Route to lowest latency
  FAILOVER = 'failover',       // Only failover on failure
}

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenRequests: number;
}

export enum CircuitState {
  CLOSED = 'closed',      // Normal operation
  OPEN = 'open',          // Failing, reject requests
  HALF_OPEN = 'half_open', // Testing recovery
}

export interface FailoverEvent {
  timestamp: Date;
  fromEndpoint: string;
  toEndpoint: string;
  reason: string;
  automatic: boolean;
}

// ============================================
// FAILOVER MANAGER SERVICE
// ============================================

export class FailoverManager extends EventEmitter {
  private endpoints: Map<string, ConnectionEndpoint> = new Map();
  private groups: Map<string, string[]> = new Map();  // groupId -> endpointIds
  private activeEndpoint: Map<string, string> = new Map();  // groupId -> active endpointId
  private circuitStates: Map<string, CircuitState> = new Map();
  private circuitFailures: Map<string, number> = new Map();
  private failoverHistory: FailoverEvent[] = [];
  private roundRobinIndex: Map<string, number> = new Map();

  private defaultPolicy: FailoverPolicy = {
    mode: FailoverMode.PRIORITY,
    maxRetries: 3,
    retryDelayMs: 1000,
    backoffMultiplier: 2,
    maxRetryDelayMs: 30000,
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      resetTimeoutMs: 30000,
      halfOpenRequests: 3,
    },
  };

  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private policies: Map<string, FailoverPolicy> = new Map();

  constructor() {
    super();
  }

  /**
   * Register an endpoint
   */
  registerEndpoint(endpoint: ConnectionEndpoint, groupId: string = 'default'): void {
    this.endpoints.set(endpoint.id, endpoint);
    this.circuitStates.set(endpoint.id, CircuitState.CLOSED);
    this.circuitFailures.set(endpoint.id, 0);

    // Add to group
    const group = this.groups.get(groupId) || [];
    if (!group.includes(endpoint.id)) {
      group.push(endpoint.id);
      group.sort((a, b) => {
        const epA = this.endpoints.get(a)!;
        const epB = this.endpoints.get(b)!;
        return epA.priority - epB.priority;
      });
      this.groups.set(groupId, group);
    }

    // Start health check if enabled
    if (endpoint.healthCheck.enabled) {
      this.startHealthCheck(endpoint.id);
    }

    // Set as active if first in group
    if (!this.activeEndpoint.has(groupId)) {
      this.activeEndpoint.set(groupId, endpoint.id);
    }

    logger.info(`Endpoint registered: ${endpoint.name} (${endpoint.id}) in group ${groupId}`);
    this.emit('endpointRegistered', { endpoint, groupId });
  }

  /**
   * Set failover policy for a group
   */
  setPolicy(groupId: string, policy: Partial<FailoverPolicy>): void {
    const merged = { ...this.defaultPolicy, ...policy };
    this.policies.set(groupId, merged);
  }

  /**
   * Get current active endpoint for a group
   */
  getActiveEndpoint(groupId: string = 'default'): ConnectionEndpoint | undefined {
    const endpointId = this.activeEndpoint.get(groupId);
    if (!endpointId) return undefined;
    return this.endpoints.get(endpointId);
  }

  /**
   * Get next endpoint based on policy
   */
  getNextEndpoint(groupId: string = 'default'): ConnectionEndpoint | undefined {
    const group = this.groups.get(groupId);
    if (!group || group.length === 0) return undefined;

    const policy = this.policies.get(groupId) || this.defaultPolicy;
    const healthyEndpoints = group
      .map(id => this.endpoints.get(id)!)
      .filter(ep => this.isEndpointAvailable(ep));

    if (healthyEndpoints.length === 0) {
      logger.warn(`No healthy endpoints available for group: ${groupId}`);
      return undefined;
    }

    switch (policy.mode) {
      case FailoverMode.PRIORITY:
        return healthyEndpoints[0];

      case FailoverMode.ROUND_ROBIN: {
        const index = this.roundRobinIndex.get(groupId) || 0;
        const next = healthyEndpoints[index % healthyEndpoints.length];
        this.roundRobinIndex.set(groupId, (index + 1) % healthyEndpoints.length);
        return next;
      }

      case FailoverMode.WEIGHTED: {
        const totalWeight = healthyEndpoints.reduce((sum, ep) => sum + (ep.weight || 1), 0);
        let random = Math.random() * totalWeight;
        for (const ep of healthyEndpoints) {
          random -= ep.weight || 1;
          if (random <= 0) return ep;
        }
        return healthyEndpoints[0];
      }

      case FailoverMode.FASTEST:
        return healthyEndpoints.sort((a, b) =>
          (a.latencyMs || Infinity) - (b.latencyMs || Infinity)
        )[0];

      case FailoverMode.FAILOVER:
        return this.endpoints.get(this.activeEndpoint.get(groupId)!) || healthyEndpoints[0];

      default:
        return healthyEndpoints[0];
    }
  }

  /**
   * Report success for an endpoint
   */
  reportSuccess(endpointId: string): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return;

    endpoint.failureCount = 0;
    this.circuitFailures.set(endpointId, 0);

    // Close circuit if it was half-open
    const circuitState = this.circuitStates.get(endpointId);
    if (circuitState === CircuitState.HALF_OPEN) {
      this.circuitStates.set(endpointId, CircuitState.CLOSED);
      logger.info(`Circuit breaker closed for endpoint: ${endpointId}`);
      this.emit('circuitClosed', { endpointId });
    }

    if (endpoint.status !== EndpointStatus.HEALTHY) {
      endpoint.status = EndpointStatus.HEALTHY;
      this.emit('endpointHealthy', endpoint);
    }
  }

  /**
   * Report failure for an endpoint
   */
  reportFailure(endpointId: string, error?: Error): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return;

    endpoint.failureCount++;
    endpoint.lastFailure = new Date();

    const failures = (this.circuitFailures.get(endpointId) || 0) + 1;
    this.circuitFailures.set(endpointId, failures);

    // Find policy for this endpoint's group
    let policy = this.defaultPolicy;
    for (const [groupId, endpointIds] of this.groups.entries()) {
      if (endpointIds.includes(endpointId)) {
        policy = this.policies.get(groupId) || this.defaultPolicy;
        break;
      }
    }

    // Check circuit breaker
    if (policy.circuitBreaker.enabled && failures >= policy.circuitBreaker.failureThreshold) {
      this.circuitStates.set(endpointId, CircuitState.OPEN);
      endpoint.status = EndpointStatus.UNHEALTHY;

      logger.warn(`Circuit breaker opened for endpoint: ${endpointId}`);
      this.emit('circuitOpened', { endpointId, failures });

      // Schedule half-open transition
      setTimeout(() => {
        this.transitionToHalfOpen(endpointId);
      }, policy.circuitBreaker.resetTimeoutMs);
    } else if (endpoint.failureCount >= 3) {
      endpoint.status = EndpointStatus.DEGRADED;
    }

    this.emit('endpointFailure', { endpoint, error });
  }

  /**
   * Trigger manual failover
   */
  async triggerFailover(
    groupId: string,
    reason: string = 'manual',
    targetEndpointId?: string
  ): Promise<boolean> {
    const currentEndpointId = this.activeEndpoint.get(groupId);
    const group = this.groups.get(groupId);

    if (!group || group.length === 0) {
      logger.error(`No endpoints in group: ${groupId}`);
      return false;
    }

    let newEndpointId: string | undefined;

    if (targetEndpointId) {
      // Specific target requested
      if (!group.includes(targetEndpointId)) {
        logger.error(`Target endpoint not in group: ${targetEndpointId}`);
        return false;
      }
      newEndpointId = targetEndpointId;
    } else {
      // Find next available endpoint
      for (const id of group) {
        if (id !== currentEndpointId && this.isEndpointAvailable(this.endpoints.get(id)!)) {
          newEndpointId = id;
          break;
        }
      }
    }

    if (!newEndpointId) {
      logger.error(`No available endpoint for failover in group: ${groupId}`);
      return false;
    }

    // Execute failover
    this.activeEndpoint.set(groupId, newEndpointId);

    const event: FailoverEvent = {
      timestamp: new Date(),
      fromEndpoint: currentEndpointId || 'none',
      toEndpoint: newEndpointId,
      reason,
      automatic: reason !== 'manual',
    };

    this.failoverHistory.push(event);
    if (this.failoverHistory.length > 100) {
      this.failoverHistory.shift();
    }

    logger.info(`Failover executed: ${currentEndpointId} -> ${newEndpointId}, reason: ${reason}`);
    this.emit('failover', event);

    return true;
  }

  /**
   * Execute operation with automatic failover
   */
  async executeWithFailover<T>(
    groupId: string,
    operation: (endpoint: ConnectionEndpoint) => Promise<T>
  ): Promise<T> {
    const policy = this.policies.get(groupId) || this.defaultPolicy;
    let lastError: Error | undefined;
    let delay = policy.retryDelayMs;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      const endpoint = this.getNextEndpoint(groupId);
      if (!endpoint) {
        throw new Error(`No available endpoints for group: ${groupId}`);
      }

      try {
        const result = await operation(endpoint);
        this.reportSuccess(endpoint.id);
        return result;
      } catch (error) {
        lastError = error as Error;
        this.reportFailure(endpoint.id, lastError);

        if (attempt < policy.maxRetries) {
          logger.warn(`Operation failed, retrying (${attempt + 1}/${policy.maxRetries})`, {
            endpoint: endpoint.id,
            error: lastError.message,
          });

          await this.delay(delay);
          delay = Math.min(delay * policy.backoffMultiplier, policy.maxRetryDelayMs);

          // Trigger failover to next endpoint
          await this.triggerFailover(groupId, 'automatic_retry');
        }
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Get endpoint status
   */
  getEndpointStatus(endpointId: string): {
    endpoint: ConnectionEndpoint;
    circuitState: CircuitState;
    available: boolean;
  } | undefined {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return undefined;

    return {
      endpoint,
      circuitState: this.circuitStates.get(endpointId) || CircuitState.CLOSED,
      available: this.isEndpointAvailable(endpoint),
    };
  }

  /**
   * Get all endpoints in a group
   */
  getGroupEndpoints(groupId: string): ConnectionEndpoint[] {
    const group = this.groups.get(groupId) || [];
    return group.map(id => this.endpoints.get(id)!).filter(Boolean);
  }

  /**
   * Get failover history
   */
  getFailoverHistory(limit: number = 50): FailoverEvent[] {
    return this.failoverHistory.slice(-limit);
  }

  /**
   * Manual health check
   */
  async checkHealth(endpointId: string): Promise<EndpointStatus> {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return EndpointStatus.UNKNOWN;

    try {
      const startTime = Date.now();

      // Simulate health check (in production, implement actual checks)
      await this.performHealthCheck(endpoint);

      endpoint.latencyMs = Date.now() - startTime;
      endpoint.lastChecked = new Date();
      endpoint.status = EndpointStatus.HEALTHY;

      return EndpointStatus.HEALTHY;
    } catch (error) {
      endpoint.status = EndpointStatus.UNHEALTHY;
      return EndpointStatus.UNHEALTHY;
    }
  }

  /**
   * Shutdown manager
   */
  shutdown(): void {
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private isEndpointAvailable(endpoint: ConnectionEndpoint): boolean {
    const circuitState = this.circuitStates.get(endpoint.id);

    if (circuitState === CircuitState.OPEN) {
      return false;
    }

    if (endpoint.status === EndpointStatus.UNHEALTHY) {
      return false;
    }

    if (endpoint.status === EndpointStatus.MAINTENANCE) {
      return false;
    }

    return true;
  }

  private transitionToHalfOpen(endpointId: string): void {
    const currentState = this.circuitStates.get(endpointId);
    if (currentState === CircuitState.OPEN) {
      this.circuitStates.set(endpointId, CircuitState.HALF_OPEN);
      logger.info(`Circuit breaker half-open for endpoint: ${endpointId}`);
      this.emit('circuitHalfOpen', { endpointId });
    }
  }

  private startHealthCheck(endpointId: string): void {
    const endpoint = this.endpoints.get(endpointId);
    if (!endpoint) return;

    const interval = setInterval(async () => {
      await this.checkHealth(endpointId);
    }, endpoint.healthCheck.intervalMs);

    this.healthCheckIntervals.set(endpointId, interval);
  }

  private async performHealthCheck(endpoint: ConnectionEndpoint): Promise<void> {
    // Simulate health check - in production implement actual checks
    // For TCP: try to connect
    // For HTTP: make request to healthCheck.path
    // For ping: ICMP ping
    await this.delay(50 + Math.random() * 100);

    // Simulate occasional failures (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('Health check failed');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export const failoverManager = new FailoverManager();
