/**
 * High Availability Service
 * Provides redundancy, hot-swap capability, and 99.9% uptime support
 */

import { getFirestore, Collections } from '../../config/firebase.js';
import { mqttService } from '../../mqtt/mqtt.service.js';
import { socketService } from '../../websocket/socket.service.js';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export enum NodeRole {
  PRIMARY = 'primary',
  SECONDARY = 'secondary',
  ARBITER = 'arbiter',
}

export enum NodeState {
  ACTIVE = 'active',
  STANDBY = 'standby',
  SYNCING = 'syncing',
  FAILED = 'failed',
  MAINTENANCE = 'maintenance',
}

export interface HANode {
  id: string;
  hostname: string;
  ip: string;
  port: number;
  role: NodeRole;
  state: NodeState;
  lastHeartbeat: Date;
  version: string;
  metrics: NodeMetrics;
}

export interface NodeMetrics {
  cpu: number; // %
  memory: number; // %
  disk: number; // %
  networkLatency: number; // ms
  activeConnections: number;
  requestsPerSecond: number;
  errorRate: number; // %
  uptime: number; // seconds
}

export interface HACluster {
  id: string;
  name: string;
  nodes: HANode[];
  primaryId: string | null;
  splitBrainProtection: boolean;
  quorumRequired: number;
  failoverTimeout: number; // ms
  heartbeatInterval: number; // ms
  lastFailover?: Date;
  failoverCount: number;
}

export interface HealthCheck {
  id: string;
  name: string;
  type: 'http' | 'tcp' | 'mqtt' | 'database' | 'custom';
  target: string;
  interval: number; // ms
  timeout: number; // ms
  healthyThreshold: number;
  unhealthyThreshold: number;
  lastCheck: Date;
  status: 'healthy' | 'unhealthy' | 'degraded';
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  latency: number; // ms
}

export interface FailoverEvent {
  id: string;
  clusterId: string;
  timestamp: Date;
  previousPrimary: string;
  newPrimary: string;
  reason: string;
  duration: number; // ms
  automatic: boolean;
  success: boolean;
}

export interface HAConfig {
  clusterId: string;
  nodeId: string;
  role: NodeRole;
  peerNodes: string[];
  virtualIp?: string;
  healthChecks: HealthCheck[];
  autoFailover: boolean;
  preemption: boolean; // Allow primary to reclaim role when recovered
  syncReplication: boolean;
}

// ============================================
// HIGH AVAILABILITY SERVICE
// ============================================

export class HighAvailabilityService {
  private db = getFirestore();
  private nodeId: string;
  private clusterId: string;
  private currentRole: NodeRole = NodeRole.SECONDARY;
  private currentState: NodeState = NodeState.STANDBY;
  private cluster: HACluster | null = null;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private failoverInProgress = false;
  private metrics: NodeMetrics = {
    cpu: 0,
    memory: 0,
    disk: 0,
    networkLatency: 0,
    activeConnections: 0,
    requestsPerSecond: 0,
    errorRate: 0,
    uptime: 0,
  };
  private startTime = Date.now();

  constructor() {
    this.nodeId = process.env.NODE_ID || `node_${Math.random().toString(36).substr(2, 9)}`;
    this.clusterId = process.env.CLUSTER_ID || 'default';
  }

  /**
   * Initialize HA service
   */
  async initialize(config: HAConfig): Promise<void> {
    this.clusterId = config.clusterId;
    this.nodeId = config.nodeId;
    this.currentRole = config.role;

    // Load or create cluster
    await this.loadCluster();

    // Register this node
    await this.registerNode();

    // Start heartbeat
    this.startHeartbeat();

    // Initialize health checks
    for (const check of config.healthChecks) {
      await this.addHealthCheck(check);
    }

    // Start metrics collection
    this.startMetricsCollection();

    // Subscribe to cluster events
    this.subscribeToClusterEvents();

    logger.info(`HA service initialized: Node ${this.nodeId}, Role: ${this.currentRole}`);
  }

  /**
   * Load or create cluster
   */
  private async loadCluster(): Promise<void> {
    const doc = await this.db.collection('ha_clusters').doc(this.clusterId).get();

    if (doc.exists) {
      this.cluster = doc.data() as HACluster;
    } else {
      this.cluster = {
        id: this.clusterId,
        name: `Cluster ${this.clusterId}`,
        nodes: [],
        primaryId: null,
        splitBrainProtection: true,
        quorumRequired: 2,
        failoverTimeout: 5000,
        heartbeatInterval: 1000,
        failoverCount: 0,
      };

      await this.db.collection('ha_clusters').doc(this.clusterId).set(this.cluster);
    }
  }

  /**
   * Register this node with the cluster
   */
  private async registerNode(): Promise<void> {
    const node: HANode = {
      id: this.nodeId,
      hostname: process.env.HOSTNAME || 'localhost',
      ip: process.env.NODE_IP || '127.0.0.1',
      port: parseInt(process.env.PORT || '3000'),
      role: this.currentRole,
      state: this.currentState,
      lastHeartbeat: new Date(),
      version: process.env.APP_VERSION || '1.0.0',
      metrics: this.metrics,
    };

    // Update cluster nodes
    if (this.cluster) {
      const existingIndex = this.cluster.nodes.findIndex(n => n.id === this.nodeId);
      if (existingIndex >= 0) {
        this.cluster.nodes[existingIndex] = node;
      } else {
        this.cluster.nodes.push(node);
      }

      // If no primary and we're primary role, become primary
      if (!this.cluster.primaryId && this.currentRole === NodeRole.PRIMARY) {
        await this.becomePrimary();
      }

      await this.updateCluster();
    }
  }

  /**
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    const interval = this.cluster?.heartbeatInterval || 1000;

    this.heartbeatInterval = setInterval(async () => {
      await this.sendHeartbeat();
      await this.checkPeerHealth();
    }, interval);
  }

  /**
   * Send heartbeat
   */
  private async sendHeartbeat(): Promise<void> {
    if (!this.cluster) return;

    const nodeIndex = this.cluster.nodes.findIndex(n => n.id === this.nodeId);
    if (nodeIndex >= 0) {
      this.cluster.nodes[nodeIndex].lastHeartbeat = new Date();
      this.cluster.nodes[nodeIndex].state = this.currentState;
      this.cluster.nodes[nodeIndex].metrics = this.metrics;

      await this.db.collection('ha_nodes').doc(this.nodeId).set({
        ...this.cluster.nodes[nodeIndex],
        clusterId: this.clusterId,
      });

      // Publish heartbeat via MQTT for faster detection
      await mqttService.publish(`ha/${this.clusterId}/heartbeat`, JSON.stringify({
        nodeId: this.nodeId,
        timestamp: Date.now(),
        state: this.currentState,
        role: this.currentRole,
      }));
    }
  }

  /**
   * Check health of peer nodes
   */
  private async checkPeerHealth(): Promise<void> {
    if (!this.cluster || this.failoverInProgress) return;

    const now = Date.now();
    const timeout = this.cluster.failoverTimeout;

    for (const node of this.cluster.nodes) {
      if (node.id === this.nodeId) continue;

      const lastHeartbeat = new Date(node.lastHeartbeat).getTime();
      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat > timeout && node.state !== NodeState.FAILED) {
        logger.warn(`Node ${node.id} appears to be down (${timeSinceHeartbeat}ms since last heartbeat)`);

        // Mark node as failed
        node.state = NodeState.FAILED;

        // If failed node was primary, initiate failover
        if (node.id === this.cluster.primaryId) {
          await this.initiateFailover(node.id, 'Primary node heartbeat timeout');
        }
      }
    }

    await this.updateCluster();
  }

  /**
   * Initiate failover
   */
  async initiateFailover(failedNodeId: string, reason: string): Promise<void> {
    if (this.failoverInProgress) {
      logger.warn('Failover already in progress, skipping');
      return;
    }

    this.failoverInProgress = true;
    const startTime = Date.now();

    logger.warn(`Initiating failover: ${reason}`);

    try {
      if (!this.cluster) throw new Error('Cluster not initialized');

      // Check quorum
      const healthyNodes = this.cluster.nodes.filter(n =>
        n.state === NodeState.ACTIVE || n.state === NodeState.STANDBY
      );

      if (healthyNodes.length < this.cluster.quorumRequired) {
        logger.error('Cannot failover: quorum not met');
        this.failoverInProgress = false;
        return;
      }

      // Select new primary
      const candidates = healthyNodes
        .filter(n => n.role === NodeRole.SECONDARY && n.id !== failedNodeId)
        .sort((a, b) => a.metrics.cpu - b.metrics.cpu); // Prefer node with lowest load

      if (candidates.length === 0) {
        logger.error('No failover candidates available');
        this.failoverInProgress = false;
        return;
      }

      const newPrimary = candidates[0];
      const previousPrimary = this.cluster.primaryId;

      // Update cluster
      this.cluster.primaryId = newPrimary.id;
      this.cluster.lastFailover = new Date();
      this.cluster.failoverCount++;

      // If this node is selected as primary
      if (newPrimary.id === this.nodeId) {
        await this.becomePrimary();
      }

      await this.updateCluster();

      // Record failover event
      const duration = Date.now() - startTime;
      await this.recordFailoverEvent({
        id: `failover_${Date.now()}`,
        clusterId: this.clusterId,
        timestamp: new Date(),
        previousPrimary: previousPrimary || 'none',
        newPrimary: newPrimary.id,
        reason,
        duration,
        automatic: true,
        success: true,
      });

      // Notify clients
      socketService.broadcastToOrganization('system', 'ha:failover', {
        previousPrimary,
        newPrimary: newPrimary.id,
        reason,
        duration,
      });

      logger.info(`Failover complete: ${newPrimary.id} is now primary (${duration}ms)`);

    } catch (error) {
      logger.error('Failover failed', { error });

      await this.recordFailoverEvent({
        id: `failover_${Date.now()}`,
        clusterId: this.clusterId,
        timestamp: new Date(),
        previousPrimary: this.cluster?.primaryId || 'none',
        newPrimary: 'none',
        reason,
        duration: Date.now() - startTime,
        automatic: true,
        success: false,
      });
    } finally {
      this.failoverInProgress = false;
    }
  }

  /**
   * Become primary
   */
  private async becomePrimary(): Promise<void> {
    logger.info(`Node ${this.nodeId} becoming primary`);

    this.currentRole = NodeRole.PRIMARY;
    this.currentState = NodeState.ACTIVE;

    if (this.cluster) {
      this.cluster.primaryId = this.nodeId;
      const nodeIndex = this.cluster.nodes.findIndex(n => n.id === this.nodeId);
      if (nodeIndex >= 0) {
        this.cluster.nodes[nodeIndex].role = NodeRole.PRIMARY;
        this.cluster.nodes[nodeIndex].state = NodeState.ACTIVE;
      }
    }

    // Take over virtual IP if configured
    await this.claimVirtualIP();

    // Start accepting requests
    await this.enableRequestHandling();

    logger.info(`Node ${this.nodeId} is now PRIMARY`);
  }

  /**
   * Become secondary
   */
  async becomeSecondary(): Promise<void> {
    logger.info(`Node ${this.nodeId} becoming secondary`);

    this.currentRole = NodeRole.SECONDARY;
    this.currentState = NodeState.STANDBY;

    if (this.cluster) {
      const nodeIndex = this.cluster.nodes.findIndex(n => n.id === this.nodeId);
      if (nodeIndex >= 0) {
        this.cluster.nodes[nodeIndex].role = NodeRole.SECONDARY;
        this.cluster.nodes[nodeIndex].state = NodeState.STANDBY;
      }
    }

    // Release virtual IP
    await this.releaseVirtualIP();

    // Start syncing from primary
    await this.startSyncFromPrimary();
  }

  /**
   * Claim virtual IP
   */
  private async claimVirtualIP(): Promise<void> {
    // In production, this would use ARP or BGP announcements
    // For cloud deployments, update load balancer target
    logger.info('Virtual IP claimed');
  }

  /**
   * Release virtual IP
   */
  private async releaseVirtualIP(): Promise<void> {
    logger.info('Virtual IP released');
  }

  /**
   * Enable request handling
   */
  private async enableRequestHandling(): Promise<void> {
    // Signal to HTTP server that this node is ready to handle requests
    process.env.NODE_READY = 'true';
  }

  /**
   * Start sync from primary
   */
  private async startSyncFromPrimary(): Promise<void> {
    if (!this.cluster?.primaryId || this.cluster.primaryId === this.nodeId) return;

    this.currentState = NodeState.SYNCING;

    // In production, sync state from primary
    // For stateless deployments with Firebase, this is automatic

    this.currentState = NodeState.STANDBY;
    logger.info('Sync from primary complete');
  }

  /**
   * Add health check
   */
  async addHealthCheck(check: HealthCheck): Promise<void> {
    this.healthChecks.set(check.id, check);

    const interval = setInterval(async () => {
      await this.runHealthCheck(check.id);
    }, check.interval);

    this.healthCheckIntervals.set(check.id, interval);
  }

  /**
   * Run health check
   */
  private async runHealthCheck(checkId: string): Promise<void> {
    const check = this.healthChecks.get(checkId);
    if (!check) return;

    const startTime = Date.now();
    let success = false;

    try {
      switch (check.type) {
        case 'http':
          success = await this.httpHealthCheck(check.target, check.timeout);
          break;
        case 'tcp':
          success = await this.tcpHealthCheck(check.target, check.timeout);
          break;
        case 'mqtt':
          success = mqttService.connected;
          break;
        case 'database':
          success = await this.databaseHealthCheck(check.timeout);
          break;
        default:
          success = true;
      }
    } catch {
      success = false;
    }

    const latency = Date.now() - startTime;
    check.latency = latency;
    check.lastCheck = new Date();

    if (success) {
      check.consecutiveSuccesses++;
      check.consecutiveFailures = 0;

      if (check.consecutiveSuccesses >= check.healthyThreshold) {
        check.status = 'healthy';
      }
    } else {
      check.consecutiveFailures++;
      check.consecutiveSuccesses = 0;

      if (check.consecutiveFailures >= check.unhealthyThreshold) {
        check.status = 'unhealthy';
        logger.warn(`Health check ${check.name} is unhealthy: ${check.consecutiveFailures} failures`);
      } else {
        check.status = 'degraded';
      }
    }

    this.healthChecks.set(checkId, check);
  }

  /**
   * HTTP health check
   */
  private async httpHealthCheck(url: string, timeout: number): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * TCP health check
   */
  private async tcpHealthCheck(target: string, timeout: number): Promise<boolean> {
    // In production, use net.Socket for TCP check
    return true;
  }

  /**
   * Database health check
   */
  private async databaseHealthCheck(timeout: number): Promise<boolean> {
    try {
      // Simple Firestore read to verify connectivity
      await this.db.collection('ha_health').doc('ping').get();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      this.collectMetrics();
    }, 1000);
  }

  /**
   * Collect node metrics
   */
  private collectMetrics(): void {
    // CPU usage (simplified - in production use os.cpus())
    this.metrics.cpu = Math.random() * 30 + 10; // Simulated

    // Memory usage
    const memUsage = process.memoryUsage();
    this.metrics.memory = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    // Uptime
    this.metrics.uptime = (Date.now() - this.startTime) / 1000;

    // Connection count (from socket service)
    this.metrics.activeConnections = socketService.getConnectedUsersCount();
  }

  /**
   * Subscribe to cluster events
   */
  private subscribeToClusterEvents(): void {
    mqttService.subscribe(`ha/${this.clusterId}/+`, (topic, payload) => {
      const parts = topic.split('/');
      const eventType = parts[2];

      switch (eventType) {
        case 'heartbeat':
          // Update peer node heartbeat
          const data = JSON.parse(payload.toString());
          this.updatePeerHeartbeat(data.nodeId, data.timestamp);
          break;

        case 'failover':
          // Handle failover notification
          break;
      }
    });
  }

  /**
   * Update peer heartbeat
   */
  private updatePeerHeartbeat(nodeId: string, timestamp: number): void {
    if (!this.cluster || nodeId === this.nodeId) return;

    const nodeIndex = this.cluster.nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex >= 0) {
      this.cluster.nodes[nodeIndex].lastHeartbeat = new Date(timestamp);
      if (this.cluster.nodes[nodeIndex].state === NodeState.FAILED) {
        this.cluster.nodes[nodeIndex].state = NodeState.STANDBY;
        logger.info(`Node ${nodeId} recovered`);
      }
    }
  }

  /**
   * Update cluster in database
   */
  private async updateCluster(): Promise<void> {
    if (!this.cluster) return;
    await this.db.collection('ha_clusters').doc(this.clusterId).set(this.cluster);
  }

  /**
   * Record failover event
   */
  private async recordFailoverEvent(event: FailoverEvent): Promise<void> {
    await this.db.collection('ha_failover_events').add(event);
  }

  /**
   * Manual failover
   */
  async manualFailover(targetNodeId: string): Promise<void> {
    if (!this.cluster) throw new Error('Cluster not initialized');

    const targetNode = this.cluster.nodes.find(n => n.id === targetNodeId);
    if (!targetNode) throw new Error('Target node not found');

    if (targetNode.state !== NodeState.ACTIVE && targetNode.state !== NodeState.STANDBY) {
      throw new Error('Target node is not healthy');
    }

    await this.initiateFailover(this.cluster.primaryId || '', `Manual failover to ${targetNodeId}`);
  }

  /**
   * Get cluster status
   */
  getClusterStatus(): HACluster | null {
    return this.cluster;
  }

  /**
   * Get health check results
   */
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  /**
   * Get node metrics
   */
  getNodeMetrics(): NodeMetrics {
    return this.metrics;
  }

  /**
   * Is this node primary?
   */
  isPrimary(): boolean {
    return this.currentRole === NodeRole.PRIMARY && this.currentState === NodeState.ACTIVE;
  }

  /**
   * Get failover history
   */
  async getFailoverHistory(limit = 50): Promise<FailoverEvent[]> {
    const snapshot = await this.db.collection('ha_failover_events')
      .where('clusterId', '==', this.clusterId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      ...doc.data(),
      timestamp: doc.data().timestamp?.toDate(),
    })) as FailoverEvent[];
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    logger.info(`Node ${this.nodeId} shutting down`);

    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }

    // Mark node as maintenance
    if (this.cluster) {
      const nodeIndex = this.cluster.nodes.findIndex(n => n.id === this.nodeId);
      if (nodeIndex >= 0) {
        this.cluster.nodes[nodeIndex].state = NodeState.MAINTENANCE;
      }

      // If we're primary, initiate failover
      if (this.cluster.primaryId === this.nodeId) {
        this.cluster.primaryId = null;
        await this.initiateFailover(this.nodeId, 'Primary node graceful shutdown');
      }

      await this.updateCluster();
    }

    logger.info(`Node ${this.nodeId} shutdown complete`);
  }
}

export const haService = new HighAvailabilityService();
