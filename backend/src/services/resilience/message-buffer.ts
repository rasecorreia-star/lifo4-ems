/**
 * Message Buffer Service
 * Circular buffer for offline message storage with persistence
 */

import { EventEmitter } from 'events';
import { createWriteStream, createReadStream, existsSync, mkdirSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPES
// ============================================

export interface BufferedMessage {
  id: string;
  timestamp: Date;
  topic: string;
  priority: MessagePriority;
  payload: Buffer;
  metadata: Record<string, unknown>;
  retries: number;
  maxRetries: number;
  expiresAt?: Date;
}

export enum MessagePriority {
  CRITICAL = 0,
  HIGH = 1,
  NORMAL = 2,
  LOW = 3,
  BATCH = 4,
}

export interface BufferStats {
  totalMessages: number;
  totalSize: number;
  oldestMessage?: Date;
  newestMessage?: Date;
  byPriority: Record<MessagePriority, number>;
  byTopic: Record<string, number>;
  dropCount: number;
  persistedFiles: number;
}

export interface BufferConfig {
  maxMemorySize: number;  // bytes
  maxDiskSize: number;  // bytes
  persistPath: string;
  compressOnPersist: boolean;
  maxMessageAge: number;  // ms
  flushInterval: number;  // ms
}

// ============================================
// MESSAGE BUFFER SERVICE
// ============================================

export class MessageBuffer extends EventEmitter {
  private memoryBuffer: BufferedMessage[] = [];
  private memorySize: number = 0;
  private config: BufferConfig;
  private dropCount: number = 0;
  private flushInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<BufferConfig> = {}) {
    super();

    this.config = {
      maxMemorySize: 50 * 1024 * 1024,  // 50MB memory
      maxDiskSize: 100 * 1024 * 1024,   // 100MB disk
      persistPath: './data/message-buffer',
      compressOnPersist: true,
      maxMessageAge: 24 * 60 * 60 * 1000,  // 24 hours
      flushInterval: 30000,  // 30 seconds
      ...config,
    };

    this.ensurePersistPath();
    this.startFlushInterval();
    this.startCleanupInterval();
  }

  /**
   * Add message to buffer
   */
  add(message: Omit<BufferedMessage, 'id' | 'timestamp' | 'retries'>): string {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    const bufferedMessage: BufferedMessage = {
      ...message,
      id,
      timestamp: new Date(),
      retries: 0,
    };

    const messageSize = this.calculateMessageSize(bufferedMessage);

    // Check if we need to make room
    if (this.memorySize + messageSize > this.config.maxMemorySize) {
      this.makeRoom(messageSize, message.priority);
    }

    // Add to buffer (sorted by priority)
    this.insertByPriority(bufferedMessage);
    this.memorySize += messageSize;

    this.emit('messageAdded', bufferedMessage);
    return id;
  }

  /**
   * Get next message to send (highest priority, oldest first)
   */
  peek(): BufferedMessage | undefined {
    return this.memoryBuffer[0];
  }

  /**
   * Remove and return next message
   */
  pop(): BufferedMessage | undefined {
    const message = this.memoryBuffer.shift();
    if (message) {
      this.memorySize -= this.calculateMessageSize(message);
      this.emit('messageRemoved', message);
    }
    return message;
  }

  /**
   * Get message by ID
   */
  get(id: string): BufferedMessage | undefined {
    return this.memoryBuffer.find(m => m.id === id);
  }

  /**
   * Remove message by ID
   */
  remove(id: string): boolean {
    const index = this.memoryBuffer.findIndex(m => m.id === id);
    if (index === -1) return false;

    const message = this.memoryBuffer.splice(index, 1)[0];
    this.memorySize -= this.calculateMessageSize(message);
    this.emit('messageRemoved', message);
    return true;
  }

  /**
   * Get messages by topic
   */
  getByTopic(topic: string, limit?: number): BufferedMessage[] {
    const messages = this.memoryBuffer.filter(m => m.topic === topic);
    return limit ? messages.slice(0, limit) : messages;
  }

  /**
   * Get messages by priority
   */
  getByPriority(priority: MessagePriority, limit?: number): BufferedMessage[] {
    const messages = this.memoryBuffer.filter(m => m.priority === priority);
    return limit ? messages.slice(0, limit) : messages;
  }

  /**
   * Requeue a failed message
   */
  requeue(message: BufferedMessage): boolean {
    if (message.retries >= message.maxRetries) {
      this.emit('messageDropped', { message, reason: 'max_retries' });
      this.dropCount++;
      return false;
    }

    message.retries++;
    message.timestamp = new Date();

    // Lower priority on retry
    if (message.priority < MessagePriority.BATCH) {
      message.priority++;
    }

    this.insertByPriority(message);
    this.emit('messageRequeued', message);
    return true;
  }

  /**
   * Get buffer statistics
   */
  getStats(): BufferStats {
    const byPriority: Record<MessagePriority, number> = {
      [MessagePriority.CRITICAL]: 0,
      [MessagePriority.HIGH]: 0,
      [MessagePriority.NORMAL]: 0,
      [MessagePriority.LOW]: 0,
      [MessagePriority.BATCH]: 0,
    };

    const byTopic: Record<string, number> = {};

    for (const msg of this.memoryBuffer) {
      byPriority[msg.priority]++;
      byTopic[msg.topic] = (byTopic[msg.topic] || 0) + 1;
    }

    return {
      totalMessages: this.memoryBuffer.length,
      totalSize: this.memorySize,
      oldestMessage: this.memoryBuffer[this.memoryBuffer.length - 1]?.timestamp,
      newestMessage: this.memoryBuffer[0]?.timestamp,
      byPriority,
      byTopic,
      dropCount: this.dropCount,
      persistedFiles: this.countPersistedFiles(),
    };
  }

  /**
   * Persist buffer to disk
   */
  async persistToDisk(): Promise<string> {
    if (this.memoryBuffer.length === 0) {
      return '';
    }

    const filename = `buffer-${Date.now()}.json${this.config.compressOnPersist ? '.gz' : ''}`;
    const filepath = join(this.config.persistPath, filename);

    try {
      const data = JSON.stringify(this.memoryBuffer);

      if (this.config.compressOnPersist) {
        const input = Buffer.from(data);
        const writeStream = createWriteStream(filepath);
        const gzip = createGzip();

        await new Promise<void>((resolve, reject) => {
          gzip.on('error', reject);
          writeStream.on('error', reject);
          writeStream.on('finish', resolve);

          gzip.end(input);
          gzip.pipe(writeStream);
        });
      } else {
        const writeStream = createWriteStream(filepath);
        await new Promise<void>((resolve, reject) => {
          writeStream.on('error', reject);
          writeStream.on('finish', resolve);
          writeStream.end(data);
        });
      }

      logger.info(`Buffer persisted to disk: ${filename}, ${this.memoryBuffer.length} messages`);
      this.emit('persisted', { filepath, messageCount: this.memoryBuffer.length });

      return filepath;
    } catch (error) {
      logger.error('Failed to persist buffer to disk', { error });
      throw error;
    }
  }

  /**
   * Load buffer from disk
   */
  async loadFromDisk(filepath: string): Promise<number> {
    if (!existsSync(filepath)) {
      throw new Error(`File not found: ${filepath}`);
    }

    try {
      let data: string;

      if (filepath.endsWith('.gz')) {
        const chunks: Buffer[] = [];
        const readStream = createReadStream(filepath);
        const gunzip = createGunzip();

        await new Promise<void>((resolve, reject) => {
          gunzip.on('data', chunk => chunks.push(chunk));
          gunzip.on('error', reject);
          gunzip.on('end', resolve);
          readStream.pipe(gunzip);
        });

        data = Buffer.concat(chunks).toString('utf-8');
      } else {
        const chunks: Buffer[] = [];
        const readStream = createReadStream(filepath);

        await new Promise<void>((resolve, reject) => {
          readStream.on('data', chunk => chunks.push(chunk as Buffer));
          readStream.on('error', reject);
          readStream.on('end', resolve);
        });

        data = Buffer.concat(chunks).toString('utf-8');
      }

      const messages: BufferedMessage[] = JSON.parse(data);

      // Restore messages (convert date strings back to Date objects)
      let loadedCount = 0;
      for (const msg of messages) {
        msg.timestamp = new Date(msg.timestamp);
        if (msg.expiresAt) {
          msg.expiresAt = new Date(msg.expiresAt);
        }

        // Skip expired messages
        if (msg.expiresAt && msg.expiresAt < new Date()) continue;
        if (Date.now() - msg.timestamp.getTime() > this.config.maxMessageAge) continue;

        const size = this.calculateMessageSize(msg);
        if (this.memorySize + size <= this.config.maxMemorySize) {
          this.insertByPriority(msg);
          this.memorySize += size;
          loadedCount++;
        }
      }

      logger.info(`Loaded ${loadedCount} messages from disk: ${filepath}`);
      this.emit('loaded', { filepath, messageCount: loadedCount });

      return loadedCount;
    } catch (error) {
      logger.error('Failed to load buffer from disk', { error, filepath });
      throw error;
    }
  }

  /**
   * Clear buffer
   */
  clear(): void {
    this.memoryBuffer = [];
    this.memorySize = 0;
    this.emit('cleared');
  }

  /**
   * Get buffer size info
   */
  getSize(): { messages: number; bytes: number; percentFull: number } {
    return {
      messages: this.memoryBuffer.length,
      bytes: this.memorySize,
      percentFull: (this.memorySize / this.config.maxMemorySize) * 100,
    };
  }

  /**
   * Shutdown buffer service
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Persist remaining messages
    if (this.memoryBuffer.length > 0) {
      await this.persistToDisk();
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private ensurePersistPath(): void {
    if (!existsSync(this.config.persistPath)) {
      mkdirSync(this.config.persistPath, { recursive: true });
    }
  }

  private calculateMessageSize(message: BufferedMessage): number {
    return (
      message.payload.length +
      Buffer.byteLength(message.topic) +
      Buffer.byteLength(JSON.stringify(message.metadata)) +
      100  // Overhead for other fields
    );
  }

  private insertByPriority(message: BufferedMessage): void {
    // Binary search for insertion point
    let low = 0;
    let high = this.memoryBuffer.length;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      const existing = this.memoryBuffer[mid];

      // Compare by priority first, then by timestamp
      if (
        existing.priority < message.priority ||
        (existing.priority === message.priority && existing.timestamp < message.timestamp)
      ) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    this.memoryBuffer.splice(low, 0, message);
  }

  private makeRoom(requiredSize: number, newMessagePriority: MessagePriority): void {
    // First try to remove lowest priority messages
    while (
      this.memorySize + requiredSize > this.config.maxMemorySize &&
      this.memoryBuffer.length > 0
    ) {
      // Find lowest priority message from the end
      let lowestIdx = this.memoryBuffer.length - 1;
      const lowestPriority = this.memoryBuffer[lowestIdx].priority;

      // Don't drop messages with higher priority than the new one
      if (lowestPriority <= newMessagePriority) {
        // Need to persist to disk instead
        this.persistToDisk().catch(err => {
          logger.error('Failed to persist during makeRoom', { error: err });
        });
        break;
      }

      const dropped = this.memoryBuffer.pop()!;
      this.memorySize -= this.calculateMessageSize(dropped);
      this.dropCount++;
      this.emit('messageDropped', { message: dropped, reason: 'buffer_full' });
    }
  }

  private startFlushInterval(): void {
    this.flushInterval = setInterval(async () => {
      // Persist if buffer is over 80% full
      if (this.memorySize > this.config.maxMemorySize * 0.8) {
        await this.persistToDisk();
      }
    }, this.config.flushInterval);
  }

  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredMessages();
      this.cleanupOldFiles();
    }, 60000);  // Every minute
  }

  private cleanupExpiredMessages(): void {
    const now = new Date();
    const maxAge = this.config.maxMessageAge;

    let i = this.memoryBuffer.length - 1;
    while (i >= 0) {
      const msg = this.memoryBuffer[i];

      const isExpired =
        (msg.expiresAt && msg.expiresAt < now) ||
        (now.getTime() - msg.timestamp.getTime() > maxAge);

      if (isExpired) {
        this.memoryBuffer.splice(i, 1);
        this.memorySize -= this.calculateMessageSize(msg);
        this.emit('messageExpired', msg);
      }
      i--;
    }
  }

  private cleanupOldFiles(): void {
    try {
      const files = this.getPersistedFiles();
      let totalSize = 0;

      // Sort by modification time (newest first)
      files.sort((a, b) => b.mtime - a.mtime);

      for (const file of files) {
        totalSize += file.size;

        if (totalSize > this.config.maxDiskSize) {
          unlinkSync(file.path);
          logger.info(`Deleted old buffer file: ${file.path}`);
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup old buffer files', { error });
    }
  }

  private getPersistedFiles(): Array<{ path: string; size: number; mtime: number }> {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(this.config.persistPath);
      return files
        .filter((f: string) => f.startsWith('buffer-'))
        .map((f: string) => {
          const filepath = join(this.config.persistPath, f);
          const stats = statSync(filepath);
          return {
            path: filepath,
            size: stats.size,
            mtime: stats.mtimeMs,
          };
        });
    } catch {
      return [];
    }
  }

  private countPersistedFiles(): number {
    return this.getPersistedFiles().length;
  }
}

export const messageBuffer = new MessageBuffer();
