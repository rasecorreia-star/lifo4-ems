import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Animated,
  Dimensions,
  Alert,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { camerasApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'CameraDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = (SCREEN_WIDTH * 9) / 16; // 16:9 aspect ratio

// Camera status colors
const STATUS_COLORS = {
  online: '#10b981',
  recording: '#ef4444',
  offline: '#64748b',
  alert: '#f59e0b',
};

interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'recording' | 'offline' | 'alert';
  streamUrl?: string;
  model?: string;
  manufacturer?: string;
  resolution?: string;
  fps?: number;
  ptzEnabled?: boolean;
  hasAudio?: boolean;
  lastSeen?: string;
}

interface CameraEvent {
  id: string;
  type: 'motion' | 'person' | 'zone' | 'offline' | 'alert';
  title: string;
  timestamp: string;
  thumbnailUrl?: string;
}

// PTZ Control Component
function PTZControls({
  isDark,
  enabled,
  onPan,
  onTilt,
  onZoom,
}: {
  isDark: boolean;
  enabled: boolean;
  onPan: (direction: 'left' | 'right') => void;
  onTilt: (direction: 'up' | 'down') => void;
  onZoom: (direction: 'in' | 'out') => void;
}) {
  const handlePress = (action: () => void) => {
    if (!enabled) {
      Alert.alert('PTZ Indisponivel', 'Esta camera nao suporta controles PTZ.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    action();
  };

  return (
    <View style={[ptzStyles.container, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <Text style={[ptzStyles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
        Controles PTZ
      </Text>

      <View style={ptzStyles.controlsRow}>
        {/* Directional Controls */}
        <View style={ptzStyles.dPad}>
          {/* Up */}
          <TouchableOpacity
            style={[ptzStyles.dPadButton, ptzStyles.dPadUp, !enabled && ptzStyles.disabled]}
            onPress={() => handlePress(() => onTilt('up'))}
          >
            <Ionicons name="chevron-up" size={24} color={enabled ? '#10b981' : '#64748b'} />
          </TouchableOpacity>

          {/* Left */}
          <TouchableOpacity
            style={[ptzStyles.dPadButton, ptzStyles.dPadLeft, !enabled && ptzStyles.disabled]}
            onPress={() => handlePress(() => onPan('left'))}
          >
            <Ionicons name="chevron-back" size={24} color={enabled ? '#10b981' : '#64748b'} />
          </TouchableOpacity>

          {/* Center */}
          <View style={[ptzStyles.dPadCenter, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <Ionicons name="radio-button-on" size={16} color="#64748b" />
          </View>

          {/* Right */}
          <TouchableOpacity
            style={[ptzStyles.dPadButton, ptzStyles.dPadRight, !enabled && ptzStyles.disabled]}
            onPress={() => handlePress(() => onPan('right'))}
          >
            <Ionicons name="chevron-forward" size={24} color={enabled ? '#10b981' : '#64748b'} />
          </TouchableOpacity>

          {/* Down */}
          <TouchableOpacity
            style={[ptzStyles.dPadButton, ptzStyles.dPadDown, !enabled && ptzStyles.disabled]}
            onPress={() => handlePress(() => onTilt('down'))}
          >
            <Ionicons name="chevron-down" size={24} color={enabled ? '#10b981' : '#64748b'} />
          </TouchableOpacity>
        </View>

        {/* Zoom Controls */}
        <View style={ptzStyles.zoomControls}>
          <TouchableOpacity
            style={[ptzStyles.zoomButton, !enabled && ptzStyles.disabled]}
            onPress={() => handlePress(() => onZoom('in'))}
          >
            <Ionicons name="add" size={24} color={enabled ? '#10b981' : '#64748b'} />
          </TouchableOpacity>
          <Text style={ptzStyles.zoomLabel}>Zoom</Text>
          <TouchableOpacity
            style={[ptzStyles.zoomButton, !enabled && ptzStyles.disabled]}
            onPress={() => handlePress(() => onZoom('out'))}
          >
            <Ionicons name="remove" size={24} color={enabled ? '#10b981' : '#64748b'} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// Recording Pulse Animation
function RecordingPulse({ isRecording }: { isRecording: boolean }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isRecording, pulseAnim]);

  if (!isRecording) return null;

  return (
    <View style={videoStyles.recordingContainer}>
      <Animated.View style={[videoStyles.recordingDot, { opacity: pulseAnim }]} />
      <Text style={videoStyles.recordingText}>REC</Text>
    </View>
  );
}

// Event Card Component
function EventCard({ event, isDark }: { event: CameraEvent; isDark: boolean }) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'motion':
        return 'walk-outline';
      case 'person':
        return 'person-outline';
      case 'zone':
        return 'location-outline';
      case 'offline':
        return 'cloud-offline-outline';
      case 'alert':
        return 'warning-outline';
      default:
        return 'information-outline';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'motion':
        return '#06b6d4';
      case 'person':
        return '#8b5cf6';
      case 'zone':
        return '#f59e0b';
      case 'offline':
        return '#64748b';
      case 'alert':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[eventStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <View style={[eventStyles.iconContainer, { backgroundColor: getEventColor(event.type) + '20' }]}>
        <Ionicons name={getEventIcon(event.type) as any} size={20} color={getEventColor(event.type)} />
      </View>
      <View style={eventStyles.info}>
        <Text style={[eventStyles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
          {event.title}
        </Text>
        <Text style={eventStyles.time}>{formatTime(event.timestamp)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </View>
  );
}

export default function CameraDetailScreen() {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation();
  const { cameraId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [events, setEvents] = useState<CameraEvent[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cameraRes, eventsRes] = await Promise.all([
        camerasApi.getById(cameraId),
        camerasApi.getEvents(cameraId, { limit: 10 }),
      ]);

      setCamera(cameraRes.data.data);
      setEvents(eventsRes.data.data || []);
    } catch (error) {
      console.error('Falha ao carregar dados da camera:', error);
      // Mock data for development
      setCamera({
        id: cameraId,
        name: 'Entrada Principal',
        location: 'Portaria A',
        status: 'recording',
        model: 'Hikvision DS-2CD2385G1-I',
        manufacturer: 'Hikvision',
        resolution: '4K (3840x2160)',
        fps: 30,
        ptzEnabled: true,
        hasAudio: true,
        streamUrl: 'rtsp://camera.example.com/stream',
      });
      setEvents([
        {
          id: '1',
          type: 'person',
          title: 'Pessoa detectada',
          timestamp: new Date().toISOString(),
        },
        {
          id: '2',
          type: 'motion',
          title: 'Movimento detectado',
          timestamp: new Date(Date.now() - 300000).toISOString(),
        },
        {
          id: '3',
          type: 'zone',
          title: 'Zona de alerta ativada',
          timestamp: new Date(Date.now() - 600000).toISOString(),
        },
        {
          id: '4',
          type: 'person',
          title: 'Pessoa detectada',
          timestamp: new Date(Date.now() - 1200000).toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [cameraId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleSnapshot = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await camerasApi.takeSnapshot(cameraId);
      Alert.alert('Sucesso', 'Captura de tela salva com sucesso!');
    } catch (error) {
      console.error('Falha ao capturar tela:', error);
      Alert.alert('Erro', 'Nao foi possivel capturar a tela.');
    }
  };

  const handleStartRecording = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await camerasApi.startRecording(cameraId);
    } catch (error) {
      console.error('Falha ao iniciar gravacao:', error);
    }
  };

  const handlePTZPan = (direction: 'left' | 'right') => {
    camerasApi.ptzControl(cameraId, { pan: direction });
  };

  const handlePTZTilt = (direction: 'up' | 'down') => {
    camerasApi.ptzControl(cameraId, { tilt: direction });
  };

  const handlePTZZoom = (direction: 'in' | 'out') => {
    camerasApi.ptzControl(cameraId, { zoom: direction });
  };

  const handleViewAllEvents = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CameraEvents' as never, { cameraId } as never);
  };

  const screenStyles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={screenStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!camera) {
    return (
      <View style={screenStyles.errorContainer}>
        <Ionicons name="videocam-off-outline" size={64} color="#ef4444" />
        <Text style={screenStyles.errorText}>Camera nao encontrada</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[camera.status];
  const isRecording = camera.status === 'recording';

  return (
    <ScrollView
      style={screenStyles.container}
      contentContainerStyle={screenStyles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#10b981"
        />
      }
    >
      {/* Video Player Placeholder */}
      <View style={[videoStyles.container, { backgroundColor: isDark ? '#1e293b' : '#000000' }]}>
        <View style={videoStyles.placeholder}>
          <Ionicons name="videocam-outline" size={64} color="#64748b" />
          <Text style={videoStyles.placeholderText}>Stream ao vivo</Text>
          <Text style={videoStyles.placeholderSubtext}>
            Use expo-av ou react-native-video
          </Text>
        </View>

        {/* Overlays */}
        <RecordingPulse isRecording={isRecording} />

        {/* Video Controls */}
        <View style={videoStyles.controls}>
          <TouchableOpacity style={videoStyles.controlButton} onPress={handleSnapshot}>
            <Ionicons name="camera-outline" size={24} color="#ffffff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={videoStyles.controlButton}
            onPress={() => setIsFullscreen(!isFullscreen)}
          >
            <Ionicons
              name={isFullscreen ? 'contract-outline' : 'expand-outline'}
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>
          <TouchableOpacity style={videoStyles.controlButton} onPress={handleStartRecording}>
            <Ionicons
              name={isRecording ? 'stop-circle' : 'radio-button-on'}
              size={24}
              color={isRecording ? '#ef4444' : '#ffffff'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Status Badge */}
      <View style={screenStyles.statusRow}>
        <View style={[screenStyles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[screenStyles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[screenStyles.statusText, { color: statusColor }]}>
            {camera.status === 'online' && 'Online'}
            {camera.status === 'recording' && 'Gravando'}
            {camera.status === 'offline' && 'Offline'}
            {camera.status === 'alert' && 'Alerta'}
          </Text>
        </View>

        {camera.hasAudio && (
          <View style={[screenStyles.statusBadge, { backgroundColor: '#64748b20' }]}>
            <Ionicons name="mic" size={14} color="#64748b" />
            <Text style={[screenStyles.statusText, { color: '#64748b' }]}>Audio</Text>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={screenStyles.actionsRow}>
        <TouchableOpacity
          style={[screenStyles.actionButton, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}
          onPress={handleSnapshot}
        >
          <Ionicons name="camera-outline" size={24} color="#10b981" />
          <Text style={[screenStyles.actionText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Capturar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[screenStyles.actionButton, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}
          onPress={handleStartRecording}
        >
          <Ionicons
            name={isRecording ? 'stop-circle' : 'radio-button-on'}
            size={24}
            color={isRecording ? '#ef4444' : '#10b981'}
          />
          <Text style={[screenStyles.actionText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            {isRecording ? 'Parar' : 'Gravar'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[screenStyles.actionButton, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}
          onPress={handleViewAllEvents}
        >
          <Ionicons name="list-outline" size={24} color="#10b981" />
          <Text style={[screenStyles.actionText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
            Eventos
          </Text>
        </TouchableOpacity>
      </View>

      {/* PTZ Controls */}
      <PTZControls
        isDark={isDark}
        enabled={camera.ptzEnabled || false}
        onPan={handlePTZPan}
        onTilt={handlePTZTilt}
        onZoom={handlePTZZoom}
      />

      {/* Recent Events */}
      <View style={screenStyles.section}>
        <View style={screenStyles.sectionHeader}>
          <Text style={screenStyles.sectionTitle}>Eventos Recentes</Text>
          <TouchableOpacity onPress={handleViewAllEvents}>
            <Text style={screenStyles.seeAllText}>Ver todos</Text>
          </TouchableOpacity>
        </View>

        {events.length === 0 ? (
          <View style={screenStyles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color="#64748b" />
            <Text style={screenStyles.emptyText}>Nenhum evento recente</Text>
          </View>
        ) : (
          events.map((event) => (
            <EventCard key={event.id} event={event} isDark={isDark} />
          ))
        )}
      </View>

      {/* Camera Info */}
      <View style={[screenStyles.infoCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
        <Text style={[screenStyles.infoTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
          Informacoes da Camera
        </Text>
        <InfoRow label="Nome" value={camera.name} isDark={isDark} />
        <InfoRow label="Localizacao" value={camera.location} isDark={isDark} />
        <InfoRow label="Modelo" value={camera.model || 'N/A'} isDark={isDark} />
        <InfoRow label="Fabricante" value={camera.manufacturer || 'N/A'} isDark={isDark} />
        <InfoRow label="Resolucao" value={camera.resolution || 'N/A'} isDark={isDark} />
        <InfoRow label="FPS" value={camera.fps ? `${camera.fps} fps` : 'N/A'} isDark={isDark} />
        <InfoRow label="PTZ" value={camera.ptzEnabled ? 'Disponivel' : 'Indisponivel'} isDark={isDark} />
        <InfoRow label="Audio" value={camera.hasAudio ? 'Ativado' : 'Desativado'} isDark={isDark} />
      </View>
    </ScrollView>
  );
}

// Info Row Component
function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#33415530',
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
});

const videoStyles = StyleSheet.create({
  container: {
    width: '100%',
    height: VIDEO_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    position: 'relative',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 16,
    marginTop: 12,
  },
  placeholderSubtext: {
    color: '#475569',
    fontSize: 12,
    marginTop: 4,
  },
  recordingContainer: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 8,
  },
  recordingText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  controls: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

const ptzStyles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  dPad: {
    width: 140,
    height: 140,
    position: 'relative',
  },
  dPadButton: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10b98120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dPadUp: {
    top: 0,
    left: 48,
  },
  dPadDown: {
    bottom: 0,
    left: 48,
  },
  dPadLeft: {
    left: 0,
    top: 48,
  },
  dPadRight: {
    right: 0,
    top: 48,
  },
  dPadCenter: {
    position: 'absolute',
    top: 48,
    left: 48,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  zoomControls: {
    alignItems: 'center',
    gap: 8,
  },
  zoomButton: {
    width: 56,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#10b98120',
    justifyContent: 'center',
    alignItems: 'center',
  },
  zoomLabel: {
    fontSize: 12,
    color: '#64748b',
    marginVertical: 4,
  },
});

const eventStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
  },
  time: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    content: {
      padding: 16,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    errorText: {
      fontSize: 16,
      color: '#ef4444',
      marginTop: 16,
    },
    statusRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 24,
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      padding: 16,
      borderRadius: 16,
      gap: 8,
    },
    actionText: {
      fontSize: 12,
      fontWeight: '500',
    },
    section: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    seeAllText: {
      fontSize: 14,
      color: '#10b981',
    },
    emptyState: {
      alignItems: 'center',
      padding: 24,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
    },
    emptyText: {
      color: '#64748b',
      marginTop: 8,
    },
    infoCard: {
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 8,
    },
  });
