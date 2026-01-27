/**
 * Camera Service for Lifo4 EMS
 * Handles camera CRUD, security zones, voice messages, events, recordings,
 * PTZ control, two-way audio, statistics, and AI detection settings.
 */

import { getFirestore, getStorage } from '../config/firebase.js';
import { logger } from '../utils/logger.js';
import {
  Camera,
  CameraConnection,
  CameraCapabilities,
  CameraStatus,
  CameraAISettings,
  RecordingSettings,
  SecurityZone,
  AudioSettings,
  VoiceMessage,
  CameraEvent,
  CameraEventType,
  Recording,
  CameraStatistics,
  PTZCommand,
  PTZPreset,
  TalkBackSession,
  QuickMessage,
  Point,
  ZoneRule,
} from '../models/camera.types.js';

// Firestore collection names for camera-related data
const CameraCollections = {
  CAMERAS: 'cameras',
  CAMERA_EVENTS: 'camera_events',
  RECORDINGS: 'recordings',
  VOICE_MESSAGES: 'voice_messages',
  QUICK_MESSAGES: 'quick_messages',
  TALKBACK_SESSIONS: 'talkback_sessions',
  CAMERA_STATISTICS: 'camera_statistics',
  PTZ_PRESETS: 'ptz_presets',
} as const;

// Type definitions for service responses
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface CameraQueryOptions {
  siteId?: string;
  organizationId?: string;
  status?: CameraStatus['state'];
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface EventQueryOptions {
  cameraId?: string;
  siteId?: string;
  organizationId?: string;
  type?: CameraEventType;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  isAcknowledged?: boolean;
  page?: number;
  pageSize?: number;
}

export interface RecordingQueryOptions {
  cameraId?: string;
  type?: 'continuous' | 'event';
  startDate?: Date;
  endDate?: Date;
  status?: Recording['status'];
  page?: number;
  pageSize?: number;
}

export class CameraService {
  private db = getFirestore();

  constructor() {
    logger.info('CameraService initialized');
  }

  // ============================================
  // CAMERA CRUD OPERATIONS
  // ============================================

  /**
   * Create a new camera
   */
  async createCamera(cameraData: Omit<Camera, 'id' | 'createdAt' | 'updatedAt'>): Promise<Camera> {
    try {
      const now = new Date();
      const docRef = this.db.collection(CameraCollections.CAMERAS).doc();

      const camera: Camera = {
        ...cameraData,
        id: docRef.id,
        createdAt: now,
        updatedAt: now,
      };

      // Encrypt password before storing
      const encryptedCamera = this.encryptSensitiveData(camera);

      await docRef.set(this.serializeForFirestore(encryptedCamera));

      logger.info(`Camera created: ${camera.id}`, {
        name: camera.name,
        siteId: camera.siteId,
      });

      return camera;
    } catch (error) {
      logger.error('Failed to create camera', { error, cameraData });
      throw new Error(`Failed to create camera: ${(error as Error).message}`);
    }
  }

  /**
   * Get camera by ID
   */
  async getCameraById(cameraId: string): Promise<Camera | null> {
    try {
      const doc = await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).get();

      if (!doc.exists) {
        return null;
      }

      const camera = this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as Camera;
      return this.decryptSensitiveData(camera);
    } catch (error) {
      logger.error('Failed to get camera', { error, cameraId });
      throw new Error(`Failed to get camera: ${(error as Error).message}`);
    }
  }

  /**
   * List cameras with filtering and pagination
   */
  async listCameras(options: CameraQueryOptions = {}): Promise<PaginatedResult<Camera>> {
    try {
      const { siteId, organizationId, status, isActive, page = 1, pageSize = 20 } = options;

      let query: FirebaseFirestore.Query = this.db.collection(CameraCollections.CAMERAS);

      if (organizationId) {
        query = query.where('organizationId', '==', organizationId);
      }
      if (siteId) {
        query = query.where('siteId', '==', siteId);
      }
      if (status) {
        query = query.where('status.state', '==', status);
      }
      if (isActive !== undefined) {
        query = query.where('isActive', '==', isActive);
      }

      // Get total count
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Apply pagination
      query = query.orderBy('createdAt', 'desc').limit(pageSize).offset((page - 1) * pageSize);

      const snapshot = await query.get();
      const cameras = snapshot.docs.map((doc) => {
        const camera = this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as Camera;
        return this.decryptSensitiveData(camera);
      });

      return {
        data: cameras,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      };
    } catch (error) {
      logger.error('Failed to list cameras', { error, options });
      throw new Error(`Failed to list cameras: ${(error as Error).message}`);
    }
  }

  /**
   * Update camera
   */
  async updateCamera(cameraId: string, updates: Partial<Camera>): Promise<Camera> {
    try {
      const existingCamera = await this.getCameraById(cameraId);
      if (!existingCamera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const updatedCamera: Camera = {
        ...existingCamera,
        ...updates,
        id: cameraId, // Ensure ID cannot be changed
        updatedAt: new Date(),
      };

      const encryptedCamera = this.encryptSensitiveData(updatedCamera);

      await this.db
        .collection(CameraCollections.CAMERAS)
        .doc(cameraId)
        .update(this.serializeForFirestore(encryptedCamera));

      logger.info(`Camera updated: ${cameraId}`, { updates: Object.keys(updates) });

      return updatedCamera;
    } catch (error) {
      logger.error('Failed to update camera', { error, cameraId, updates });
      throw new Error(`Failed to update camera: ${(error as Error).message}`);
    }
  }

  /**
   * Delete camera
   */
  async deleteCamera(cameraId: string): Promise<void> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      // Delete associated data in batch
      const batch = this.db.batch();

      // Delete camera document
      batch.delete(this.db.collection(CameraCollections.CAMERAS).doc(cameraId));

      // Delete associated events (in batches if needed)
      const eventsSnapshot = await this.db
        .collection(CameraCollections.CAMERA_EVENTS)
        .where('cameraId', '==', cameraId)
        .limit(500)
        .get();

      eventsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

      // Delete associated recordings metadata
      const recordingsSnapshot = await this.db
        .collection(CameraCollections.RECORDINGS)
        .where('cameraId', '==', cameraId)
        .limit(500)
        .get();

      recordingsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

      // Delete PTZ presets
      const presetsSnapshot = await this.db
        .collection(CameraCollections.PTZ_PRESETS)
        .where('cameraId', '==', cameraId)
        .get();

      presetsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();

      logger.info(`Camera deleted: ${cameraId}`, { name: camera.name });
    } catch (error) {
      logger.error('Failed to delete camera', { error, cameraId });
      throw new Error(`Failed to delete camera: ${(error as Error).message}`);
    }
  }

  /**
   * Update camera status
   */
  async updateCameraStatus(cameraId: string, status: Partial<CameraStatus>): Promise<void> {
    try {
      await this.db
        .collection(CameraCollections.CAMERAS)
        .doc(cameraId)
        .update({
          status: status,
          lastSeen: new Date(),
          updatedAt: new Date(),
        });

      logger.debug(`Camera status updated: ${cameraId}`, { status });
    } catch (error) {
      logger.error('Failed to update camera status', { error, cameraId, status });
      throw new Error(`Failed to update camera status: ${(error as Error).message}`);
    }
  }

  // ============================================
  // SECURITY ZONE MANAGEMENT
  // ============================================

  /**
   * Add security zone to camera
   */
  async addSecurityZone(cameraId: string, zone: Omit<SecurityZone, 'id'>): Promise<SecurityZone> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const newZone: SecurityZone = {
        ...zone,
        id: this.generateId(),
      };

      // Validate polygon points
      this.validatePolygon(newZone.polygon);

      const updatedZones = [...(camera.securityZones || []), newZone];

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        securityZones: updatedZones,
        updatedAt: new Date(),
      });

      logger.info(`Security zone added to camera ${cameraId}`, {
        zoneId: newZone.id,
        zoneName: newZone.name,
        zoneType: newZone.type,
      });

      return newZone;
    } catch (error) {
      logger.error('Failed to add security zone', { error, cameraId, zone });
      throw new Error(`Failed to add security zone: ${(error as Error).message}`);
    }
  }

  /**
   * Update security zone
   */
  async updateSecurityZone(cameraId: string, zoneId: string, updates: Partial<SecurityZone>): Promise<SecurityZone> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const zoneIndex = camera.securityZones.findIndex((z) => z.id === zoneId);
      if (zoneIndex === -1) {
        throw new Error(`Security zone not found: ${zoneId}`);
      }

      // Validate polygon if being updated
      if (updates.polygon) {
        this.validatePolygon(updates.polygon);
      }

      const updatedZone: SecurityZone = {
        ...camera.securityZones[zoneIndex],
        ...updates,
        id: zoneId, // Ensure ID cannot be changed
      };

      const updatedZones = [...camera.securityZones];
      updatedZones[zoneIndex] = updatedZone;

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        securityZones: updatedZones,
        updatedAt: new Date(),
      });

      logger.info(`Security zone updated: ${zoneId}`, { cameraId, updates: Object.keys(updates) });

      return updatedZone;
    } catch (error) {
      logger.error('Failed to update security zone', { error, cameraId, zoneId, updates });
      throw new Error(`Failed to update security zone: ${(error as Error).message}`);
    }
  }

  /**
   * Delete security zone
   */
  async deleteSecurityZone(cameraId: string, zoneId: string): Promise<void> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const updatedZones = camera.securityZones.filter((z) => z.id !== zoneId);

      if (updatedZones.length === camera.securityZones.length) {
        throw new Error(`Security zone not found: ${zoneId}`);
      }

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        securityZones: updatedZones,
        updatedAt: new Date(),
      });

      logger.info(`Security zone deleted: ${zoneId}`, { cameraId });
    } catch (error) {
      logger.error('Failed to delete security zone', { error, cameraId, zoneId });
      throw new Error(`Failed to delete security zone: ${(error as Error).message}`);
    }
  }

  /**
   * Get all security zones for a camera
   */
  async getSecurityZones(cameraId: string): Promise<SecurityZone[]> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      return camera.securityZones || [];
    } catch (error) {
      logger.error('Failed to get security zones', { error, cameraId });
      throw new Error(`Failed to get security zones: ${(error as Error).message}`);
    }
  }

  // ============================================
  // VOICE MESSAGE MANAGEMENT
  // ============================================

  /**
   * Add voice message to camera
   */
  async addVoiceMessage(cameraId: string, message: Omit<VoiceMessage, 'id'>): Promise<VoiceMessage> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const newMessage: VoiceMessage = {
        ...message,
        id: this.generateId(),
      };

      const updatedMessages = [...(camera.audioSettings.voiceMessages || []), newMessage];

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        'audioSettings.voiceMessages': updatedMessages,
        updatedAt: new Date(),
      });

      logger.info(`Voice message added to camera ${cameraId}`, {
        messageId: newMessage.id,
        messageName: newMessage.name,
      });

      return newMessage;
    } catch (error) {
      logger.error('Failed to add voice message', { error, cameraId, message });
      throw new Error(`Failed to add voice message: ${(error as Error).message}`);
    }
  }

  /**
   * Update voice message
   */
  async updateVoiceMessage(
    cameraId: string,
    messageId: string,
    updates: Partial<VoiceMessage>
  ): Promise<VoiceMessage> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const messageIndex = camera.audioSettings.voiceMessages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) {
        throw new Error(`Voice message not found: ${messageId}`);
      }

      const updatedMessage: VoiceMessage = {
        ...camera.audioSettings.voiceMessages[messageIndex],
        ...updates,
        id: messageId, // Ensure ID cannot be changed
      };

      const updatedMessages = [...camera.audioSettings.voiceMessages];
      updatedMessages[messageIndex] = updatedMessage;

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        'audioSettings.voiceMessages': updatedMessages,
        updatedAt: new Date(),
      });

      logger.info(`Voice message updated: ${messageId}`, { cameraId });

      return updatedMessage;
    } catch (error) {
      logger.error('Failed to update voice message', { error, cameraId, messageId, updates });
      throw new Error(`Failed to update voice message: ${(error as Error).message}`);
    }
  }

  /**
   * Delete voice message
   */
  async deleteVoiceMessage(cameraId: string, messageId: string): Promise<void> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const updatedMessages = camera.audioSettings.voiceMessages.filter((m) => m.id !== messageId);

      if (updatedMessages.length === camera.audioSettings.voiceMessages.length) {
        throw new Error(`Voice message not found: ${messageId}`);
      }

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        'audioSettings.voiceMessages': updatedMessages,
        updatedAt: new Date(),
      });

      logger.info(`Voice message deleted: ${messageId}`, { cameraId });
    } catch (error) {
      logger.error('Failed to delete voice message', { error, cameraId, messageId });
      throw new Error(`Failed to delete voice message: ${(error as Error).message}`);
    }
  }

  /**
   * Get all voice messages for a camera
   */
  async getVoiceMessages(cameraId: string): Promise<VoiceMessage[]> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      return camera.audioSettings.voiceMessages || [];
    } catch (error) {
      logger.error('Failed to get voice messages', { error, cameraId });
      throw new Error(`Failed to get voice messages: ${(error as Error).message}`);
    }
  }

  // ============================================
  // QUICK MESSAGES (GLOBAL)
  // ============================================

  /**
   * Create quick message
   */
  async createQuickMessage(message: Omit<QuickMessage, 'id'>): Promise<QuickMessage> {
    try {
      const docRef = this.db.collection(CameraCollections.QUICK_MESSAGES).doc();

      const quickMessage: QuickMessage = {
        ...message,
        id: docRef.id,
      };

      await docRef.set(quickMessage);

      logger.info(`Quick message created: ${quickMessage.id}`, { text: quickMessage.text });

      return quickMessage;
    } catch (error) {
      logger.error('Failed to create quick message', { error, message });
      throw new Error(`Failed to create quick message: ${(error as Error).message}`);
    }
  }

  /**
   * List quick messages
   */
  async listQuickMessages(category?: QuickMessage['category']): Promise<QuickMessage[]> {
    try {
      let query: FirebaseFirestore.Query = this.db.collection(CameraCollections.QUICK_MESSAGES);

      if (category) {
        query = query.where('category', '==', category);
      }

      const snapshot = await query.get();
      return snapshot.docs.map((doc) => doc.data() as QuickMessage);
    } catch (error) {
      logger.error('Failed to list quick messages', { error, category });
      throw new Error(`Failed to list quick messages: ${(error as Error).message}`);
    }
  }

  /**
   * Delete quick message
   */
  async deleteQuickMessage(messageId: string): Promise<void> {
    try {
      await this.db.collection(CameraCollections.QUICK_MESSAGES).doc(messageId).delete();
      logger.info(`Quick message deleted: ${messageId}`);
    } catch (error) {
      logger.error('Failed to delete quick message', { error, messageId });
      throw new Error(`Failed to delete quick message: ${(error as Error).message}`);
    }
  }

  // ============================================
  // CAMERA EVENT LOGGING AND RETRIEVAL
  // ============================================

  /**
   * Log camera event
   */
  async logEvent(eventData: Omit<CameraEvent, 'id'>): Promise<CameraEvent> {
    try {
      const docRef = this.db.collection(CameraCollections.CAMERA_EVENTS).doc();

      const event: CameraEvent = {
        ...eventData,
        id: docRef.id,
      };

      await docRef.set(this.serializeForFirestore(event));

      logger.info(`Camera event logged: ${event.id}`, {
        cameraId: event.cameraId,
        type: event.type,
        severity: event.severity,
      });

      return event;
    } catch (error) {
      logger.error('Failed to log camera event', { error, eventData });
      throw new Error(`Failed to log camera event: ${(error as Error).message}`);
    }
  }

  /**
   * Get camera events with filtering and pagination
   */
  async getEvents(options: EventQueryOptions = {}): Promise<PaginatedResult<CameraEvent>> {
    try {
      const {
        cameraId,
        siteId,
        organizationId,
        type,
        severity,
        startDate,
        endDate,
        isAcknowledged,
        page = 1,
        pageSize = 50,
      } = options;

      let query: FirebaseFirestore.Query = this.db.collection(CameraCollections.CAMERA_EVENTS);

      if (cameraId) {
        query = query.where('cameraId', '==', cameraId);
      }
      if (siteId) {
        query = query.where('siteId', '==', siteId);
      }
      if (organizationId) {
        query = query.where('organizationId', '==', organizationId);
      }
      if (type) {
        query = query.where('type', '==', type);
      }
      if (severity) {
        query = query.where('severity', '==', severity);
      }
      if (isAcknowledged !== undefined) {
        query = query.where('isAcknowledged', '==', isAcknowledged);
      }
      if (startDate) {
        query = query.where('timestamp', '>=', startDate);
      }
      if (endDate) {
        query = query.where('timestamp', '<=', endDate);
      }

      // Get total count
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Apply pagination and ordering
      query = query.orderBy('timestamp', 'desc').limit(pageSize).offset((page - 1) * pageSize);

      const snapshot = await query.get();
      const events = snapshot.docs.map((doc) =>
        this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as CameraEvent
      );

      return {
        data: events,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      };
    } catch (error) {
      logger.error('Failed to get camera events', { error, options });
      throw new Error(`Failed to get camera events: ${(error as Error).message}`);
    }
  }

  /**
   * Get event by ID
   */
  async getEventById(eventId: string): Promise<CameraEvent | null> {
    try {
      const doc = await this.db.collection(CameraCollections.CAMERA_EVENTS).doc(eventId).get();

      if (!doc.exists) {
        return null;
      }

      return this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as CameraEvent;
    } catch (error) {
      logger.error('Failed to get event', { error, eventId });
      throw new Error(`Failed to get event: ${(error as Error).message}`);
    }
  }

  /**
   * Acknowledge event
   */
  async acknowledgeEvent(eventId: string, userId: string, notes?: string): Promise<CameraEvent> {
    try {
      const event = await this.getEventById(eventId);
      if (!event) {
        throw new Error(`Event not found: ${eventId}`);
      }

      const updates = {
        isAcknowledged: true,
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
        notes: notes || event.notes,
      };

      await this.db.collection(CameraCollections.CAMERA_EVENTS).doc(eventId).update(updates);

      logger.info(`Event acknowledged: ${eventId}`, { userId });

      return { ...event, ...updates };
    } catch (error) {
      logger.error('Failed to acknowledge event', { error, eventId, userId });
      throw new Error(`Failed to acknowledge event: ${(error as Error).message}`);
    }
  }

  /**
   * Batch acknowledge events
   */
  async acknowledgeEvents(eventIds: string[], userId: string): Promise<void> {
    try {
      const batch = this.db.batch();
      const now = new Date();

      for (const eventId of eventIds) {
        const docRef = this.db.collection(CameraCollections.CAMERA_EVENTS).doc(eventId);
        batch.update(docRef, {
          isAcknowledged: true,
          acknowledgedBy: userId,
          acknowledgedAt: now,
        });
      }

      await batch.commit();

      logger.info(`Events batch acknowledged`, { count: eventIds.length, userId });
    } catch (error) {
      logger.error('Failed to batch acknowledge events', { error, eventIds, userId });
      throw new Error(`Failed to batch acknowledge events: ${(error as Error).message}`);
    }
  }

  // ============================================
  // RECORDING MANAGEMENT
  // ============================================

  /**
   * Create recording entry
   */
  async createRecording(recordingData: Omit<Recording, 'id' | 'createdAt'>): Promise<Recording> {
    try {
      const docRef = this.db.collection(CameraCollections.RECORDINGS).doc();

      const recording: Recording = {
        ...recordingData,
        id: docRef.id,
        createdAt: new Date(),
      };

      await docRef.set(this.serializeForFirestore(recording));

      logger.info(`Recording created: ${recording.id}`, {
        cameraId: recording.cameraId,
        type: recording.type,
      });

      return recording;
    } catch (error) {
      logger.error('Failed to create recording', { error, recordingData });
      throw new Error(`Failed to create recording: ${(error as Error).message}`);
    }
  }

  /**
   * Update recording
   */
  async updateRecording(recordingId: string, updates: Partial<Recording>): Promise<Recording> {
    try {
      const doc = await this.db.collection(CameraCollections.RECORDINGS).doc(recordingId).get();

      if (!doc.exists) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      const existingRecording = this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as Recording;
      const updatedRecording: Recording = {
        ...existingRecording,
        ...updates,
        id: recordingId,
      };

      await this.db
        .collection(CameraCollections.RECORDINGS)
        .doc(recordingId)
        .update(this.serializeForFirestore(updates));

      logger.info(`Recording updated: ${recordingId}`, { updates: Object.keys(updates) });

      return updatedRecording;
    } catch (error) {
      logger.error('Failed to update recording', { error, recordingId, updates });
      throw new Error(`Failed to update recording: ${(error as Error).message}`);
    }
  }

  /**
   * Get recordings with filtering and pagination
   */
  async getRecordings(options: RecordingQueryOptions = {}): Promise<PaginatedResult<Recording>> {
    try {
      const { cameraId, type, startDate, endDate, status, page = 1, pageSize = 50 } = options;

      let query: FirebaseFirestore.Query = this.db.collection(CameraCollections.RECORDINGS);

      if (cameraId) {
        query = query.where('cameraId', '==', cameraId);
      }
      if (type) {
        query = query.where('type', '==', type);
      }
      if (status) {
        query = query.where('status', '==', status);
      }
      if (startDate) {
        query = query.where('startTime', '>=', startDate);
      }
      if (endDate) {
        query = query.where('startTime', '<=', endDate);
      }

      // Get total count
      const countSnapshot = await query.count().get();
      const total = countSnapshot.data().count;

      // Apply pagination
      query = query.orderBy('startTime', 'desc').limit(pageSize).offset((page - 1) * pageSize);

      const snapshot = await query.get();
      const recordings = snapshot.docs.map((doc) =>
        this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as Recording
      );

      return {
        data: recordings,
        total,
        page,
        pageSize,
        hasMore: page * pageSize < total,
      };
    } catch (error) {
      logger.error('Failed to get recordings', { error, options });
      throw new Error(`Failed to get recordings: ${(error as Error).message}`);
    }
  }

  /**
   * Delete recording
   */
  async deleteRecording(recordingId: string): Promise<void> {
    try {
      const doc = await this.db.collection(CameraCollections.RECORDINGS).doc(recordingId).get();

      if (!doc.exists) {
        throw new Error(`Recording not found: ${recordingId}`);
      }

      const recording = doc.data() as Recording;

      // TODO: Delete actual file from storage
      // const storage = getStorage();
      // await storage.bucket().file(recording.fileUrl).delete();

      await this.db.collection(CameraCollections.RECORDINGS).doc(recordingId).delete();

      logger.info(`Recording deleted: ${recordingId}`, { cameraId: recording.cameraId });
    } catch (error) {
      logger.error('Failed to delete recording', { error, recordingId });
      throw new Error(`Failed to delete recording: ${(error as Error).message}`);
    }
  }

  /**
   * Get recording by event ID
   */
  async getRecordingByEventId(eventId: string): Promise<Recording | null> {
    try {
      const snapshot = await this.db
        .collection(CameraCollections.RECORDINGS)
        .where('eventId', '==', eventId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return this.deserializeFromFirestore(snapshot.docs[0].data() as Record<string, unknown>) as Recording;
    } catch (error) {
      logger.error('Failed to get recording by event ID', { error, eventId });
      throw new Error(`Failed to get recording by event ID: ${(error as Error).message}`);
    }
  }

  // ============================================
  // PTZ CONTROL
  // ============================================

  /**
   * Execute PTZ command
   */
  async executePTZCommand(command: PTZCommand): Promise<void> {
    try {
      const camera = await this.getCameraById(command.cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${command.cameraId}`);
      }

      if (!camera.capabilities.hasPTZ) {
        throw new Error(`Camera does not support PTZ: ${command.cameraId}`);
      }

      // TODO: Integrate with actual camera PTZ control via ONVIF or proprietary protocol
      // This would typically involve sending commands to the camera hardware

      logger.info(`PTZ command executed`, {
        cameraId: command.cameraId,
        action: command.action,
        pan: command.pan,
        tilt: command.tilt,
        zoom: command.zoom,
      });
    } catch (error) {
      logger.error('Failed to execute PTZ command', { error, command });
      throw new Error(`Failed to execute PTZ command: ${(error as Error).message}`);
    }
  }

  /**
   * Save PTZ preset
   */
  async savePTZPreset(cameraId: string, preset: Omit<PTZPreset, 'id'>): Promise<PTZPreset> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      if (!camera.capabilities.hasPTZ) {
        throw new Error(`Camera does not support PTZ: ${cameraId}`);
      }

      // Generate unique preset ID
      const existingPresets = await this.getPTZPresets(cameraId);
      const maxId = existingPresets.reduce((max, p) => Math.max(max, p.id), 0);

      const newPreset: PTZPreset = {
        ...preset,
        id: maxId + 1,
      };

      await this.db.collection(CameraCollections.PTZ_PRESETS).add({
        cameraId,
        ...newPreset,
      });

      logger.info(`PTZ preset saved`, { cameraId, presetId: newPreset.id, presetName: newPreset.name });

      return newPreset;
    } catch (error) {
      logger.error('Failed to save PTZ preset', { error, cameraId, preset });
      throw new Error(`Failed to save PTZ preset: ${(error as Error).message}`);
    }
  }

  /**
   * Get PTZ presets for camera
   */
  async getPTZPresets(cameraId: string): Promise<PTZPreset[]> {
    try {
      const snapshot = await this.db
        .collection(CameraCollections.PTZ_PRESETS)
        .where('cameraId', '==', cameraId)
        .orderBy('id')
        .get();

      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: data.id,
          name: data.name,
          pan: data.pan,
          tilt: data.tilt,
          zoom: data.zoom,
        } as PTZPreset;
      });
    } catch (error) {
      logger.error('Failed to get PTZ presets', { error, cameraId });
      throw new Error(`Failed to get PTZ presets: ${(error as Error).message}`);
    }
  }

  /**
   * Delete PTZ preset
   */
  async deletePTZPreset(cameraId: string, presetId: number): Promise<void> {
    try {
      const snapshot = await this.db
        .collection(CameraCollections.PTZ_PRESETS)
        .where('cameraId', '==', cameraId)
        .where('id', '==', presetId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error(`PTZ preset not found: ${presetId}`);
      }

      await snapshot.docs[0].ref.delete();

      logger.info(`PTZ preset deleted`, { cameraId, presetId });
    } catch (error) {
      logger.error('Failed to delete PTZ preset', { error, cameraId, presetId });
      throw new Error(`Failed to delete PTZ preset: ${(error as Error).message}`);
    }
  }

  /**
   * Go to PTZ preset
   */
  async goToPTZPreset(cameraId: string, presetId: number): Promise<void> {
    try {
      const presets = await this.getPTZPresets(cameraId);
      const preset = presets.find((p) => p.id === presetId);

      if (!preset) {
        throw new Error(`PTZ preset not found: ${presetId}`);
      }

      await this.executePTZCommand({
        cameraId,
        action: 'preset',
        presetId,
        presetName: preset.name,
      });

      logger.info(`Moving to PTZ preset`, { cameraId, presetId, presetName: preset.name });
    } catch (error) {
      logger.error('Failed to go to PTZ preset', { error, cameraId, presetId });
      throw new Error(`Failed to go to PTZ preset: ${(error as Error).message}`);
    }
  }

  // ============================================
  // TWO-WAY AUDIO SESSION MANAGEMENT
  // ============================================

  /**
   * Start talkback session
   */
  async startTalkbackSession(cameraId: string, userId: string): Promise<TalkBackSession> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      if (!camera.capabilities.hasSpeaker) {
        throw new Error(`Camera does not support audio output: ${cameraId}`);
      }

      // Check for active sessions
      const activeSessions = await this.getActiveTalkbackSessions(cameraId);
      if (activeSessions.length > 0) {
        throw new Error(`Camera already has an active talkback session`);
      }

      const docRef = this.db.collection(CameraCollections.TALKBACK_SESSIONS).doc();

      const session: TalkBackSession = {
        id: docRef.id,
        cameraId,
        userId,
        startTime: new Date(),
      };

      await docRef.set(this.serializeForFirestore(session));

      logger.info(`Talkback session started`, { sessionId: session.id, cameraId, userId });

      return session;
    } catch (error) {
      logger.error('Failed to start talkback session', { error, cameraId, userId });
      throw new Error(`Failed to start talkback session: ${(error as Error).message}`);
    }
  }

  /**
   * End talkback session
   */
  async endTalkbackSession(sessionId: string): Promise<TalkBackSession> {
    try {
      const doc = await this.db.collection(CameraCollections.TALKBACK_SESSIONS).doc(sessionId).get();

      if (!doc.exists) {
        throw new Error(`Talkback session not found: ${sessionId}`);
      }

      const session = this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as TalkBackSession;
      const endTime = new Date();
      const duration = Math.floor((endTime.getTime() - session.startTime.getTime()) / 1000);

      const updates = {
        endTime,
        duration,
      };

      await this.db.collection(CameraCollections.TALKBACK_SESSIONS).doc(sessionId).update(updates);

      logger.info(`Talkback session ended`, { sessionId, duration });

      return { ...session, ...updates };
    } catch (error) {
      logger.error('Failed to end talkback session', { error, sessionId });
      throw new Error(`Failed to end talkback session: ${(error as Error).message}`);
    }
  }

  /**
   * Get active talkback sessions for camera
   */
  async getActiveTalkbackSessions(cameraId: string): Promise<TalkBackSession[]> {
    try {
      const snapshot = await this.db
        .collection(CameraCollections.TALKBACK_SESSIONS)
        .where('cameraId', '==', cameraId)
        .where('endTime', '==', null)
        .get();

      return snapshot.docs.map((doc) =>
        this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as TalkBackSession
      );
    } catch (error) {
      logger.error('Failed to get active talkback sessions', { error, cameraId });
      throw new Error(`Failed to get active talkback sessions: ${(error as Error).message}`);
    }
  }

  /**
   * Play quick message through camera speaker
   */
  async playQuickMessage(cameraId: string, messageId: string, userId: string): Promise<TalkBackSession> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const messageDoc = await this.db.collection(CameraCollections.QUICK_MESSAGES).doc(messageId).get();
      if (!messageDoc.exists) {
        throw new Error(`Quick message not found: ${messageId}`);
      }

      const message = messageDoc.data() as QuickMessage;

      const docRef = this.db.collection(CameraCollections.TALKBACK_SESSIONS).doc();
      const now = new Date();

      const session: TalkBackSession = {
        id: docRef.id,
        cameraId,
        userId,
        startTime: now,
        endTime: new Date(now.getTime() + message.duration * 1000),
        duration: message.duration,
        quickMessageId: messageId,
      };

      await docRef.set(this.serializeForFirestore(session));

      // TODO: Actually play the audio through the camera speaker

      logger.info(`Quick message played`, {
        sessionId: session.id,
        cameraId,
        messageId,
        messageText: message.text,
      });

      return session;
    } catch (error) {
      logger.error('Failed to play quick message', { error, cameraId, messageId });
      throw new Error(`Failed to play quick message: ${(error as Error).message}`);
    }
  }

  /**
   * Get talkback session history
   */
  async getTalkbackHistory(
    cameraId: string,
    startDate?: Date,
    endDate?: Date,
    limit: number = 50
  ): Promise<TalkBackSession[]> {
    try {
      let query: FirebaseFirestore.Query = this.db
        .collection(CameraCollections.TALKBACK_SESSIONS)
        .where('cameraId', '==', cameraId);

      if (startDate) {
        query = query.where('startTime', '>=', startDate);
      }
      if (endDate) {
        query = query.where('startTime', '<=', endDate);
      }

      query = query.orderBy('startTime', 'desc').limit(limit);

      const snapshot = await query.get();

      return snapshot.docs.map((doc) =>
        this.deserializeFromFirestore(doc.data() as Record<string, unknown>) as TalkBackSession
      );
    } catch (error) {
      logger.error('Failed to get talkback history', { error, cameraId });
      throw new Error(`Failed to get talkback history: ${(error as Error).message}`);
    }
  }

  // ============================================
  // CAMERA STATISTICS AGGREGATION
  // ============================================

  /**
   * Get camera statistics for a period
   */
  async getCameraStatistics(cameraId: string, startDate: Date, endDate: Date): Promise<CameraStatistics> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      // Get events for the period
      const eventsResult = await this.getEvents({
        cameraId,
        startDate,
        endDate,
        pageSize: 10000, // Get all events
      });

      const events = eventsResult.data;

      // Calculate statistics
      const eventsByType: Record<CameraEventType, number> = {} as Record<CameraEventType, number>;
      const eventsBySeverity: Record<string, number> = {};
      const zoneIntrusions: Record<string, number> = {};
      let totalPersonDetections = 0;
      let audioKeywordsDetected = 0;

      for (const event of events) {
        // Count by type
        eventsByType[event.type] = (eventsByType[event.type] || 0) + 1;

        // Count by severity
        eventsBySeverity[event.severity] = (eventsBySeverity[event.severity] || 0) + 1;

        // Count person detections
        if (event.type === CameraEventType.PERSON_DETECTED) {
          totalPersonDetections++;
        }

        // Count zone intrusions
        if (event.type === CameraEventType.ZONE_INTRUSION && event.detection?.zoneId) {
          zoneIntrusions[event.detection.zoneId] = (zoneIntrusions[event.detection.zoneId] || 0) + 1;
        }

        // Count audio keywords
        if (event.type === CameraEventType.AUDIO_KEYWORD) {
          audioKeywordsDetected++;
        }
      }

      // Get talkback sessions count
      const talkbackHistory = await this.getTalkbackHistory(cameraId, startDate, endDate, 10000);
      const voiceMessagesPlayed = talkbackHistory.filter((s) => s.quickMessageId).length;

      // Calculate uptime (simplified - would need actual status history)
      const periodMs = endDate.getTime() - startDate.getTime();
      const offlineEvents = events.filter((e) => e.type === CameraEventType.CAMERA_OFFLINE);
      const estimatedDowntime = offlineEvents.length * 300; // Assume 5 min average downtime per event
      const uptimePercentage = Math.max(0, 100 - (estimatedDowntime / (periodMs / 1000)) * 100);

      const statistics: CameraStatistics = {
        cameraId,
        period: {
          start: startDate,
          end: endDate,
        },
        totalPersonDetections,
        uniquePersons: 0, // Would require tracking analysis
        averageDwellTime: 0, // Would require tracking analysis
        peakOccupancy: 0, // Would require tracking analysis
        peakOccupancyTime: startDate,
        totalEvents: events.length,
        eventsByType,
        eventsBySeverity,
        zoneIntrusions,
        audioKeywordsDetected,
        voiceMessagesPlayed,
        uptimePercentage,
        totalDowntime: estimatedDowntime,
      };

      return statistics;
    } catch (error) {
      logger.error('Failed to get camera statistics', { error, cameraId, startDate, endDate });
      throw new Error(`Failed to get camera statistics: ${(error as Error).message}`);
    }
  }

  /**
   * Get aggregated statistics for multiple cameras
   */
  async getAggregatedStatistics(
    cameraIds: string[],
    startDate: Date,
    endDate: Date
  ): Promise<CameraStatistics> {
    try {
      const allStats = await Promise.all(cameraIds.map((id) => this.getCameraStatistics(id, startDate, endDate)));

      // Aggregate statistics
      const aggregated: CameraStatistics = {
        cameraId: 'aggregated',
        period: {
          start: startDate,
          end: endDate,
        },
        totalPersonDetections: 0,
        uniquePersons: 0,
        averageDwellTime: 0,
        peakOccupancy: 0,
        peakOccupancyTime: startDate,
        totalEvents: 0,
        eventsByType: {} as Record<CameraEventType, number>,
        eventsBySeverity: {},
        zoneIntrusions: {},
        audioKeywordsDetected: 0,
        voiceMessagesPlayed: 0,
        uptimePercentage: 0,
        totalDowntime: 0,
      };

      for (const stats of allStats) {
        aggregated.totalPersonDetections += stats.totalPersonDetections;
        aggregated.totalEvents += stats.totalEvents;
        aggregated.audioKeywordsDetected += stats.audioKeywordsDetected;
        aggregated.voiceMessagesPlayed += stats.voiceMessagesPlayed;
        aggregated.totalDowntime += stats.totalDowntime;

        // Aggregate event types
        for (const [type, count] of Object.entries(stats.eventsByType)) {
          const eventType = type as CameraEventType;
          aggregated.eventsByType[eventType] = (aggregated.eventsByType[eventType] || 0) + count;
        }

        // Aggregate severity counts
        for (const [severity, count] of Object.entries(stats.eventsBySeverity)) {
          aggregated.eventsBySeverity[severity] = (aggregated.eventsBySeverity[severity] || 0) + count;
        }

        // Aggregate zone intrusions
        for (const [zoneId, count] of Object.entries(stats.zoneIntrusions)) {
          aggregated.zoneIntrusions[zoneId] = (aggregated.zoneIntrusions[zoneId] || 0) + count;
        }

        // Track peak occupancy
        if (stats.peakOccupancy > aggregated.peakOccupancy) {
          aggregated.peakOccupancy = stats.peakOccupancy;
          aggregated.peakOccupancyTime = stats.peakOccupancyTime;
        }
      }

      // Calculate average uptime
      aggregated.uptimePercentage = allStats.reduce((sum, s) => sum + s.uptimePercentage, 0) / allStats.length;

      return aggregated;
    } catch (error) {
      logger.error('Failed to get aggregated statistics', { error, cameraIds, startDate, endDate });
      throw new Error(`Failed to get aggregated statistics: ${(error as Error).message}`);
    }
  }

  /**
   * Store statistics snapshot (for historical queries)
   */
  async storeStatisticsSnapshot(statistics: CameraStatistics): Promise<void> {
    try {
      await this.db.collection(CameraCollections.CAMERA_STATISTICS).add({
        ...this.serializeForFirestore(statistics),
        createdAt: new Date(),
      });

      logger.debug(`Statistics snapshot stored`, {
        cameraId: statistics.cameraId,
        period: statistics.period,
      });
    } catch (error) {
      logger.error('Failed to store statistics snapshot', { error, statistics });
      throw new Error(`Failed to store statistics snapshot: ${(error as Error).message}`);
    }
  }

  // ============================================
  // AI DETECTION SETTINGS
  // ============================================

  /**
   * Update AI settings for camera
   */
  async updateAISettings(cameraId: string, settings: Partial<CameraAISettings>): Promise<CameraAISettings> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const updatedSettings: CameraAISettings = {
        ...camera.aiSettings,
        ...settings,
      };

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        aiSettings: updatedSettings,
        updatedAt: new Date(),
      });

      logger.info(`AI settings updated for camera ${cameraId}`, {
        updates: Object.keys(settings),
      });

      return updatedSettings;
    } catch (error) {
      logger.error('Failed to update AI settings', { error, cameraId, settings });
      throw new Error(`Failed to update AI settings: ${(error as Error).message}`);
    }
  }

  /**
   * Get AI settings for camera
   */
  async getAISettings(cameraId: string): Promise<CameraAISettings> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      return camera.aiSettings;
    } catch (error) {
      logger.error('Failed to get AI settings', { error, cameraId });
      throw new Error(`Failed to get AI settings: ${(error as Error).message}`);
    }
  }

  /**
   * Enable/disable specific AI detection feature
   */
  async toggleAIFeature(
    cameraId: string,
    feature: keyof CameraAISettings,
    enabled: boolean
  ): Promise<void> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const updatePath = `aiSettings.${feature}`;

      if (typeof camera.aiSettings[feature] === 'boolean') {
        await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
          [updatePath]: enabled,
          updatedAt: new Date(),
        });
      } else if (typeof camera.aiSettings[feature] === 'object') {
        await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
          [`${updatePath}.enabled`]: enabled,
          updatedAt: new Date(),
        });
      }

      logger.info(`AI feature toggled`, { cameraId, feature, enabled });
    } catch (error) {
      logger.error('Failed to toggle AI feature', { error, cameraId, feature, enabled });
      throw new Error(`Failed to toggle AI feature: ${(error as Error).message}`);
    }
  }

  /**
   * Update recording settings
   */
  async updateRecordingSettings(cameraId: string, settings: Partial<RecordingSettings>): Promise<RecordingSettings> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const updatedSettings: RecordingSettings = {
        ...camera.recordingSettings,
        ...settings,
      };

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        recordingSettings: updatedSettings,
        updatedAt: new Date(),
      });

      logger.info(`Recording settings updated for camera ${cameraId}`);

      return updatedSettings;
    } catch (error) {
      logger.error('Failed to update recording settings', { error, cameraId, settings });
      throw new Error(`Failed to update recording settings: ${(error as Error).message}`);
    }
  }

  /**
   * Update audio settings
   */
  async updateAudioSettings(cameraId: string, settings: Partial<AudioSettings>): Promise<AudioSettings> {
    try {
      const camera = await this.getCameraById(cameraId);
      if (!camera) {
        throw new Error(`Camera not found: ${cameraId}`);
      }

      const updatedSettings: AudioSettings = {
        ...camera.audioSettings,
        ...settings,
        voiceMessages: settings.voiceMessages || camera.audioSettings.voiceMessages,
      };

      await this.db.collection(CameraCollections.CAMERAS).doc(cameraId).update({
        audioSettings: updatedSettings,
        updatedAt: new Date(),
      });

      logger.info(`Audio settings updated for camera ${cameraId}`);

      return updatedSettings;
    } catch (error) {
      logger.error('Failed to update audio settings', { error, cameraId, settings });
      throw new Error(`Failed to update audio settings: ${(error as Error).message}`);
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return this.db.collection('_').doc().id;
  }

  /**
   * Validate polygon points
   */
  private validatePolygon(points: Point[]): void {
    if (points.length < 3) {
      throw new Error('Polygon must have at least 3 points');
    }

    for (const point of points) {
      if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
        throw new Error('Polygon points must be normalized (0-1)');
      }
    }
  }

  /**
   * Encrypt sensitive data (password)
   */
  private encryptSensitiveData(camera: Camera): Camera {
    // TODO: Implement proper encryption using a library like crypto-js
    // For now, we'll use base64 encoding as a placeholder
    if (camera.connection?.password) {
      const encrypted = Buffer.from(camera.connection.password).toString('base64');
      return {
        ...camera,
        connection: {
          ...camera.connection,
          password: encrypted,
        },
      };
    }
    return camera;
  }

  /**
   * Decrypt sensitive data (password)
   */
  private decryptSensitiveData(camera: Camera): Camera {
    // TODO: Implement proper decryption
    if (camera.connection?.password) {
      try {
        const decrypted = Buffer.from(camera.connection.password, 'base64').toString('utf-8');
        return {
          ...camera,
          connection: {
            ...camera.connection,
            password: decrypted,
          },
        };
      } catch {
        // If decryption fails, return as-is
        return camera;
      }
    }
    return camera;
  }

  /**
   * Serialize dates and other objects for Firestore
   */
  private serializeForFirestore(data: Record<string, unknown> | object): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value instanceof Date) {
        serialized[key] = value;
      } else if (Array.isArray(value)) {
        serialized[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? this.serializeForFirestore(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        serialized[key] = this.serializeForFirestore(value);
      } else {
        serialized[key] = value;
      }
    }

    return serialized;
  }

  /**
   * Deserialize Firestore data to proper types
   */
  private deserializeFromFirestore(data: Record<string, unknown>): Record<string, unknown> {
    const deserialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
        // Firestore Timestamp
        deserialized[key] = (value as FirebaseFirestore.Timestamp).toDate();
      } else if (Array.isArray(value)) {
        deserialized[key] = value.map((item) =>
          typeof item === 'object' && item !== null ? this.deserializeFromFirestore(item as Record<string, unknown>) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        deserialized[key] = this.deserializeFromFirestore(value as Record<string, unknown>);
      } else {
        deserialized[key] = value;
      }
    }

    return deserialized;
  }
}

// Export singleton instance
export const cameraService = new CameraService();
