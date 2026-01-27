/**
 * Camera & AI Vision Types for Lifo4 EMS
 * IP Camera integration with AI detection capabilities
 */

// ============================================
// CAMERA CONFIGURATION
// ============================================

export interface Camera {
  id: string;
  siteId: string;
  organizationId: string;
  name: string;
  description?: string;

  // Connection Settings
  connection: CameraConnection;

  // Capabilities
  capabilities: CameraCapabilities;

  // Status
  status: CameraStatus;
  lastSeen?: Date;

  // AI Settings
  aiSettings: CameraAISettings;

  // Recording Settings
  recordingSettings: RecordingSettings;

  // Security Zones
  securityZones: SecurityZone[];

  // Audio Settings
  audioSettings: AudioSettings;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CameraConnection {
  protocol: 'rtsp' | 'onvif' | 'http';
  host: string;
  port: number;
  username: string;
  password: string;                    // encrypted in storage

  // Stream URLs
  mainStreamUrl: string;               // high quality
  subStreamUrl?: string;               // low quality for preview

  // ONVIF specific
  onvifPath?: string;
  profileToken?: string;
}

export interface CameraCapabilities {
  hasPTZ: boolean;
  hasAudio: boolean;
  hasMicrophone: boolean;
  hasSpeaker: boolean;
  hasInfrared: boolean;
  hasMotionDetection: boolean;

  maxResolution: {
    width: number;
    height: number;
  };

  supportedCodecs: ('H.264' | 'H.265' | 'MJPEG')[];
}

export interface CameraStatus {
  state: 'online' | 'offline' | 'recording' | 'alert' | 'error';
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  lastError?: string;
  lastErrorTime?: Date;
  uptime?: number;                     // seconds
  currentFps?: number;
  bitrate?: number;                    // kbps
}

// ============================================
// AI DETECTION SETTINGS
// ============================================

export interface CameraAISettings {
  // Person Detection (YOLOv8)
  personDetection: PersonDetectionSettings;

  // Audio Analysis (Whisper)
  audioAnalysis: AudioAnalysisSettings;

  // Advanced Detection
  smokeFireDetection: boolean;
  vehicleDetection: boolean;
  faceDetection: boolean;
  faceBluringEnabled: boolean;         // LGPD compliance
  ppeDetection: boolean;               // Helmet, vest, gloves
  objectAbandonedDetection: boolean;
  behaviorAnalysis: boolean;

  // Processing Settings
  processingInterval: number;          // seconds between AI frames
  confidenceThreshold: number;         // 0-1 for detections
  useGpu: boolean;
}

export interface PersonDetectionSettings {
  enabled: boolean;
  minConfidence: number;               // 0-1
  trackingEnabled: boolean;
  countingEnabled: boolean;
  distanceEstimation: boolean;

  // Calibration for distance
  cameraHeight?: number;               // meters
  focalLength?: number;                // mm
  sensorSize?: number;                 // mm

  // Alerts
  maxPersonsAlert: number;             // 0 = no limit
  dwellTimeAlert: number;              // seconds (0 = disabled)
}

export interface AudioAnalysisSettings {
  enabled: boolean;

  // Speech Recognition (Whisper)
  speechRecognition: {
    enabled: boolean;
    language: 'pt' | 'en' | 'es' | 'auto';
    keywords: KeywordAlert[];
  };

  // Sound Detection
  soundDetection: {
    enabled: boolean;
    detectExplosion: boolean;
    detectGlassBreak: boolean;
    detectAlarm: boolean;
    detectScream: boolean;
    detectAbnormalHum: boolean;
  };

  // Ambient Settings
  ambientNoiseThreshold: number;       // dB
  volumeAlertThreshold: number;        // dB
}

export interface KeywordAlert {
  keyword: string;
  language: 'pt' | 'en' | 'es';
  severity: 'critical' | 'high' | 'medium' | 'low';
  action: AlertAction[];
}

// ============================================
// SECURITY ZONES
// ============================================

export interface SecurityZone {
  id: string;
  name: string;
  type: 'danger' | 'warning' | 'restricted' | 'safe';
  color: string;                       // hex color for display

  // Polygon coordinates (relative to frame 0-1)
  polygon: Point[];

  // Rules
  rules: ZoneRule[];

  isActive: boolean;
}

export interface Point {
  x: number;                           // 0-1 relative to frame width
  y: number;                           // 0-1 relative to frame height
}

export interface ZoneRule {
  type: 'person_enter' | 'person_dwell' | 'max_persons' | 'time_restriction' | 'movement';
  threshold?: number;                  // seconds for dwell, count for max_persons
  schedule?: ZoneSchedule;
  actions: AlertAction[];
}

export interface ZoneSchedule {
  enabled: boolean;
  // More restrictive during these hours
  restrictedHours: {
    start: string;                     // HH:mm
    end: string;
  };
  daysOfWeek: number[];                // 0-6
}

export interface AlertAction {
  type: 'notification' | 'voice_warning' | 'record' | 'snapshot' | 'system_action';
  target?: string;                     // notification channel, voice message ID, system command
  delay?: number;                      // seconds before action
  repeat?: number;                     // repeat count (for voice warnings)
  repeatInterval?: number;             // seconds between repeats
}

// ============================================
// RECORDING SETTINGS
// ============================================

export interface RecordingSettings {
  // Continuous Recording
  continuousRecording: {
    enabled: boolean;
    quality: 'high' | 'medium' | 'low';
    retentionDays: number;             // rolling storage
  };

  // Event Recording
  eventRecording: {
    enabled: boolean;
    preEventBuffer: number;            // seconds before event
    postEventBuffer: number;           // seconds after event
    retentionDays: number;
  };

  // Storage
  storageLocation: 'local' | 'cloud' | 'both';
  cloudStorage?: {
    provider: 'firebase' | 's3' | 'gcs';
    bucket: string;
  };

  // Compression
  compression: 'h264' | 'h265';
  adaptiveQuality: boolean;            // reduce quality on low bandwidth
}

// ============================================
// AUDIO / TEXT-TO-SPEECH SETTINGS
// ============================================

export interface AudioSettings {
  // Speaker Settings
  speaker: {
    enabled: boolean;
    volume: number;                    // 0-100
    testAudioUrl?: string;
  };

  // Microphone Settings
  microphone: {
    enabled: boolean;
    sensitivity: number;               // 0-100
    noiseReduction: boolean;
  };

  // Voice Messages
  voiceMessages: VoiceMessage[];

  // Text-to-Speech Settings
  tts: {
    provider: 'google' | 'amazon' | 'local';
    voice: string;                     // voice ID
    language: 'pt-BR' | 'en-US' | 'es-ES';
    speed: number;                     // 0.5-2.0
    pitch: number;                     // -20 to +20
  };
}

export interface VoiceMessage {
  id: string;
  name: string;
  text: string;
  language: 'pt-BR' | 'en-US' | 'es-ES';
  audioUrl?: string;                   // pre-generated audio
  triggers: VoiceMessageTrigger[];
  isActive: boolean;
}

export interface VoiceMessageTrigger {
  event: 'zone_intrusion' | 'high_temperature' | 'maintenance' | 'unauthorized' | 'keyword_detected' | 'manual';
  conditions?: Record<string, unknown>;
  delay?: number;                      // seconds before playing
}

// ============================================
// CAMERA EVENTS & RECORDINGS
// ============================================

export interface CameraEvent {
  id: string;
  cameraId: string;
  siteId: string;
  organizationId: string;

  timestamp: Date;
  type: CameraEventType;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';

  // Detection Details
  detection?: {
    type: 'person' | 'vehicle' | 'fire' | 'smoke' | 'sound' | 'face' | 'other';
    confidence: number;
    boundingBox?: BoundingBox;
    trackId?: string;                  // for tracking
    zoneId?: string;
  };

  // Audio Details
  audio?: {
    transcription?: string;
    keyword?: string;
    soundType?: string;
    volume?: number;
  };

  // Media
  snapshotUrl?: string;
  videoClipUrl?: string;
  videoClipDuration?: number;          // seconds

  // Metadata
  metadata?: Record<string, unknown>;

  // Resolution
  isAcknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  notes?: string;
}

export enum CameraEventType {
  PERSON_DETECTED = 'person_detected',
  ZONE_INTRUSION = 'zone_intrusion',
  PERSON_DWELL = 'person_dwell',
  CROWD_DETECTED = 'crowd_detected',
  FIRE_DETECTED = 'fire_detected',
  SMOKE_DETECTED = 'smoke_detected',
  AUDIO_KEYWORD = 'audio_keyword',
  ABNORMAL_SOUND = 'abnormal_sound',
  MOTION_DETECTED = 'motion_detected',
  CAMERA_OFFLINE = 'camera_offline',
  CAMERA_TAMPER = 'camera_tamper',
  SYSTEM_INTEGRATION = 'system_integration',  // combined with BESS alert
}

export interface BoundingBox {
  x: number;                           // top-left x (0-1)
  y: number;                           // top-left y (0-1)
  width: number;                       // box width (0-1)
  height: number;                      // box height (0-1)
}

export interface Recording {
  id: string;
  cameraId: string;
  type: 'continuous' | 'event';
  startTime: Date;
  endTime?: Date;
  duration?: number;                   // seconds
  fileUrl: string;
  fileSize: number;                    // bytes
  thumbnailUrl?: string;

  // Associated event (for event recordings)
  eventId?: string;

  // Status
  status: 'recording' | 'completed' | 'processing' | 'failed' | 'deleted';

  createdAt: Date;
}

// ============================================
// CAMERA STATISTICS
// ============================================

export interface CameraStatistics {
  cameraId: string;
  period: {
    start: Date;
    end: Date;
  };

  // Detection Stats
  totalPersonDetections: number;
  uniquePersons: number;               // based on tracking
  averageDwellTime: number;            // seconds
  peakOccupancy: number;
  peakOccupancyTime: Date;

  // Event Stats
  totalEvents: number;
  eventsByType: Record<CameraEventType, number>;
  eventsBySeverity: Record<string, number>;

  // Zone Stats
  zoneIntrusions: Record<string, number>;  // zoneId -> count

  // Heatmap Data
  heatmapData?: HeatmapCell[];

  // Audio Stats
  audioKeywordsDetected: number;
  voiceMessagesPlayed: number;

  // Uptime
  uptimePercentage: number;
  totalDowntime: number;               // seconds
}

export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number;                   // normalized 0-1
}

// ============================================
// PTZ CONTROL
// ============================================

export interface PTZCommand {
  cameraId: string;
  action: 'move' | 'zoom' | 'preset' | 'stop';

  // For move
  pan?: number;                        // -1 to 1 (left to right)
  tilt?: number;                       // -1 to 1 (down to up)
  speed?: number;                      // 0-1

  // For zoom
  zoom?: number;                       // -1 to 1 (out to in)

  // For preset
  presetId?: number;
  presetName?: string;
}

export interface PTZPreset {
  id: number;
  name: string;
  pan: number;
  tilt: number;
  zoom: number;
}

// ============================================
// TWO-WAY AUDIO
// ============================================

export interface TalkBackSession {
  id: string;
  cameraId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;

  // Quick message used (if any)
  quickMessageId?: string;

  // Recording (if enabled)
  recordingUrl?: string;
}

export interface QuickMessage {
  id: string;
  text: string;
  audioUrl: string;
  language: string;
  duration: number;                    // seconds
  category: 'security' | 'maintenance' | 'general';
}
