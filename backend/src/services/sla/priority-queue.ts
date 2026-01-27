/**
 * Priority Queue Service
 * Ensures SLA-critical requests are processed with appropriate priority
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import {
  Priority,
  PrioritizedRequest,
  SLATier,
  getPriorityFromTier,
} from '../../models/sla.types.js';

// ============================================
// TYPES
// ============================================

interface QueueStats {
  totalEnqueued: number;
  totalDequeued: number;
  totalDropped: number;
  totalTimedOut: number;
  currentSize: number;
  sizeByPriority: Record<Priority, number>;
  avgWaitTime: number;
}

interface QueueConfig {
  maxSize: number;
  maxSizeByPriority: Record<Priority, number>;
  defaultTimeout: number;  // ms
  enableFairness: boolean;  // Prevent starvation of low-priority items
  fairnessInterval: number;  // Process one low-priority item every N high-priority items
}

// ============================================
// HEAP-BASED PRIORITY QUEUE
// ============================================

class MinHeap<T> {
  private heap: T[] = [];
  private compareFn: (a: T, b: T) => number;

  constructor(compareFn: (a: T, b: T) => number) {
    this.compareFn = compareFn;
  }

  get size(): number {
    return this.heap.length;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const result = this.heap[0];
    this.heap[0] = this.heap.pop()!;
    this.bubbleDown(0);
    return result;
  }

  remove(predicate: (item: T) => boolean): T | undefined {
    const index = this.heap.findIndex(predicate);
    if (index === -1) return undefined;

    const item = this.heap[index];
    if (index === this.heap.length - 1) {
      this.heap.pop();
    } else {
      this.heap[index] = this.heap.pop()!;
      this.bubbleDown(index);
      this.bubbleUp(index);
    }
    return item;
  }

  toArray(): T[] {
    return [...this.heap];
  }

  clear(): void {
    this.heap = [];
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compareFn(this.heap[index], this.heap[parentIndex]) >= 0) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    const length = this.heap.length;
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < length && this.compareFn(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < length && this.compareFn(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }

      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

// ============================================
// PRIORITY QUEUE SERVICE
// ============================================

export class PriorityQueueService extends EventEmitter {
  private queue: MinHeap<PrioritizedRequest>;
  private config: QueueConfig;
  private stats: QueueStats;
  private waitTimes: number[] = [];
  private highPriorityCount: number = 0;
  private timeoutCheckerInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<QueueConfig> = {}) {
    super();

    this.config = {
      maxSize: 10000,
      maxSizeByPriority: {
        [Priority.CRITICAL]: 1000,
        [Priority.HIGH]: 2000,
        [Priority.MEDIUM]: 3000,
        [Priority.LOW]: 2500,
        [Priority.BACKGROUND]: 1500,
      },
      defaultTimeout: 30000,  // 30 seconds
      enableFairness: true,
      fairnessInterval: 10,
      ...config,
    };

    this.queue = new MinHeap<PrioritizedRequest>((a, b) => {
      // First compare by priority (lower is higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by deadline (earlier deadline first)
      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;
      // Then by timestamp (FIFO within same priority)
      return a.timestamp.getTime() - b.timestamp.getTime();
    });

    this.stats = {
      totalEnqueued: 0,
      totalDequeued: 0,
      totalDropped: 0,
      totalTimedOut: 0,
      currentSize: 0,
      sizeByPriority: {
        [Priority.CRITICAL]: 0,
        [Priority.HIGH]: 0,
        [Priority.MEDIUM]: 0,
        [Priority.LOW]: 0,
        [Priority.BACKGROUND]: 0,
      },
      avgWaitTime: 0,
    };

    this.startTimeoutChecker();
  }

  /**
   * Enqueue a request with priority
   */
  enqueue(request: Omit<PrioritizedRequest, 'id' | 'timestamp' | 'retries'>): string {
    const id = `${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const prioritizedRequest: PrioritizedRequest = {
      ...request,
      id,
      timestamp: new Date(),
      retries: 0,
      deadline: request.deadline || new Date(Date.now() + this.config.defaultTimeout),
    };

    // Check queue capacity
    if (this.queue.size >= this.config.maxSize) {
      // Try to drop lowest priority items
      if (!this.dropLowestPriority(prioritizedRequest.priority)) {
        this.stats.totalDropped++;
        this.emit('dropped', { request: prioritizedRequest, reason: 'queue_full' });
        throw new Error('Queue is full and cannot accept more requests');
      }
    }

    // Check per-priority capacity
    if (this.stats.sizeByPriority[prioritizedRequest.priority] >=
        this.config.maxSizeByPriority[prioritizedRequest.priority]) {
      this.stats.totalDropped++;
      this.emit('dropped', { request: prioritizedRequest, reason: 'priority_limit' });
      throw new Error(`Priority ${prioritizedRequest.priority} queue is full`);
    }

    this.queue.push(prioritizedRequest);
    this.stats.totalEnqueued++;
    this.stats.currentSize = this.queue.size;
    this.stats.sizeByPriority[prioritizedRequest.priority]++;

    this.emit('enqueued', prioritizedRequest);
    logger.debug(`Request enqueued: ${id}, priority: ${prioritizedRequest.priority}`);

    return id;
  }

  /**
   * Dequeue the highest priority request
   */
  dequeue(): PrioritizedRequest | undefined {
    // Fairness: occasionally process a lower priority item
    if (this.config.enableFairness && this.highPriorityCount >= this.config.fairnessInterval) {
      const fairItem = this.dequeueLowerPriority();
      if (fairItem) {
        this.highPriorityCount = 0;
        return fairItem;
      }
    }

    const request = this.queue.pop();
    if (!request) return undefined;

    // Track high priority processing for fairness
    if (request.priority <= Priority.HIGH) {
      this.highPriorityCount++;
    } else {
      this.highPriorityCount = 0;
    }

    this.updateStatsOnDequeue(request);
    return request;
  }

  /**
   * Peek at the next request without removing it
   */
  peek(): PrioritizedRequest | undefined {
    return this.queue.peek();
  }

  /**
   * Get a specific request by ID
   */
  getById(id: string): PrioritizedRequest | undefined {
    return this.queue.toArray().find(r => r.id === id);
  }

  /**
   * Remove a specific request by ID
   */
  remove(id: string): PrioritizedRequest | undefined {
    const request = this.queue.remove(r => r.id === id);
    if (request) {
      this.stats.currentSize = this.queue.size;
      this.stats.sizeByPriority[request.priority]--;
      this.emit('removed', request);
    }
    return request;
  }

  /**
   * Requeue a failed request with retry logic
   */
  requeue(request: PrioritizedRequest): boolean {
    if (request.retries >= request.maxRetries) {
      this.emit('maxRetriesExceeded', request);
      return false;
    }

    const retriedRequest: PrioritizedRequest = {
      ...request,
      retries: request.retries + 1,
      timestamp: new Date(),
      // Extend deadline for retry
      deadline: new Date(Date.now() + this.config.defaultTimeout),
    };

    try {
      this.queue.push(retriedRequest);
      this.stats.currentSize = this.queue.size;
      this.stats.sizeByPriority[retriedRequest.priority]++;
      this.emit('requeued', retriedRequest);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get requests for a specific system
   */
  getBySystem(systemId: string): PrioritizedRequest[] {
    return this.queue.toArray().filter(r => r.systemId === systemId);
  }

  /**
   * Get requests by type
   */
  getByType(type: PrioritizedRequest['type']): PrioritizedRequest[] {
    return this.queue.toArray().filter(r => r.type === type);
  }

  /**
   * Create prioritized request from SLA tier
   */
  createFromSLATier(
    systemId: string,
    slaTier: SLATier,
    type: PrioritizedRequest['type'],
    payload: unknown,
    options: { deadline?: Date; maxRetries?: number } = {}
  ): string {
    return this.enqueue({
      priority: getPriorityFromTier(slaTier),
      systemId,
      slaTier,
      type,
      payload,
      maxRetries: options.maxRetries || 3,
      deadline: options.deadline,
    });
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    return {
      ...this.stats,
      avgWaitTime: this.calculateAvgWaitTime(),
    };
  }

  /**
   * Get queue size
   */
  get size(): number {
    return this.queue.size;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.queue.size === 0;
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.clear();
    this.stats.currentSize = 0;
    this.stats.sizeByPriority = {
      [Priority.CRITICAL]: 0,
      [Priority.HIGH]: 0,
      [Priority.MEDIUM]: 0,
      [Priority.LOW]: 0,
      [Priority.BACKGROUND]: 0,
    };
    this.emit('cleared');
  }

  /**
   * Shutdown the queue service
   */
  shutdown(): void {
    if (this.timeoutCheckerInterval) {
      clearInterval(this.timeoutCheckerInterval);
    }
    this.clear();
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private dropLowestPriority(incomingPriority: Priority): boolean {
    // Only drop if incoming has higher priority (lower number)
    const allRequests = this.queue.toArray();
    const droppable = allRequests
      .filter(r => r.priority > incomingPriority)
      .sort((a, b) => b.priority - a.priority || a.timestamp.getTime() - b.timestamp.getTime());

    if (droppable.length > 0) {
      const toDrop = droppable[0];
      this.remove(toDrop.id);
      this.stats.totalDropped++;
      this.emit('dropped', { request: toDrop, reason: 'preempted' });
      return true;
    }
    return false;
  }

  private dequeueLowerPriority(): PrioritizedRequest | undefined {
    const allRequests = this.queue.toArray();
    const lowerPriority = allRequests
      .filter(r => r.priority > Priority.HIGH)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (lowerPriority.length > 0) {
      return this.queue.remove(r => r.id === lowerPriority[0].id);
    }
    return undefined;
  }

  private updateStatsOnDequeue(request: PrioritizedRequest): void {
    this.stats.totalDequeued++;
    this.stats.currentSize = this.queue.size;
    this.stats.sizeByPriority[request.priority]--;

    // Track wait time
    const waitTime = Date.now() - request.timestamp.getTime();
    this.waitTimes.push(waitTime);
    if (this.waitTimes.length > 1000) {
      this.waitTimes.shift();
    }

    this.emit('dequeued', { request, waitTime });
  }

  private calculateAvgWaitTime(): number {
    if (this.waitTimes.length === 0) return 0;
    return this.waitTimes.reduce((a, b) => a + b, 0) / this.waitTimes.length;
  }

  private startTimeoutChecker(): void {
    this.timeoutCheckerInterval = setInterval(() => {
      this.checkTimeouts();
    }, 1000);  // Check every second
  }

  private checkTimeouts(): void {
    const now = new Date();
    const allRequests = this.queue.toArray();

    for (const request of allRequests) {
      if (request.deadline && request.deadline < now) {
        this.remove(request.id);
        this.stats.totalTimedOut++;
        this.emit('timeout', request);
        logger.warn(`Request timed out: ${request.id}, type: ${request.type}`);
      }
    }
  }
}

export const priorityQueue = new PriorityQueueService();
