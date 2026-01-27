import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { camerasApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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
  thumbnailUrl?: string;
  lastSeen?: string;
  hasMotion?: boolean;
  alertCount?: number;
}

// Pulsing Recording Indicator Component
function RecordingIndicator({ isRecording }: { isRecording: boolean }) {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

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
    <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]}>
      <View style={styles.recordingInner} />
    </Animated.View>
  );
}

// Camera Card Component
function CameraCard({
  camera,
  isDark,
  onPress,
}: {
  camera: Camera;
  isDark: boolean;
  onPress: () => void;
}) {
  const statusColor = STATUS_COLORS[camera.status];
  const isRecording = camera.status === 'recording';
  const hasAlert = camera.status === 'alert';

  return (
    <TouchableOpacity
      style={[
        styles.cameraCard,
        { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
        hasAlert && styles.alertBorder,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {camera.thumbnailUrl ? (
          <Image
            source={{ uri: camera.thumbnailUrl }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumbnailPlaceholder, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <Ionicons name="videocam-off-outline" size={32} color="#64748b" />
          </View>
        )}

        {/* Status Overlay */}
        <View style={styles.statusOverlay}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <RecordingIndicator isRecording={isRecording} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {camera.status === 'online' && 'Online'}
              {camera.status === 'recording' && 'Gravando'}
              {camera.status === 'offline' && 'Offline'}
              {camera.status === 'alert' && 'Alerta'}
            </Text>
          </View>
        </View>

        {/* Alert Badge */}
        {camera.alertCount && camera.alertCount > 0 && (
          <View style={styles.alertBadge}>
            <Text style={styles.alertBadgeText}>{camera.alertCount}</Text>
          </View>
        )}

        {/* Motion Indicator */}
        {camera.hasMotion && (
          <View style={styles.motionIndicator}>
            <Ionicons name="walk-outline" size={16} color="#ffffff" />
          </View>
        )}
      </View>

      {/* Camera Info */}
      <View style={styles.cameraInfo}>
        <Text style={[styles.cameraName, { color: isDark ? '#f8fafc' : '#0f172a' }]} numberOfLines={1}>
          {camera.name}
        </Text>
        <Text style={styles.cameraLocation} numberOfLines={1}>
          {camera.location}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CamerasScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    online: 0,
    recording: 0,
    offline: 0,
    alerts: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const [camerasRes, statsRes] = await Promise.all([
        camerasApi.getAll(),
        camerasApi.getStats(),
      ]);

      setCameras(camerasRes.data.data || []);
      setStats(statsRes.data.data || {
        total: 0,
        online: 0,
        recording: 0,
        offline: 0,
        alerts: 0,
      });
    } catch (error) {
      console.error('Falha ao carregar cameras:', error);
      // Mock data for development
      setCameras([
        {
          id: '1',
          name: 'Entrada Principal',
          location: 'Portaria A',
          status: 'recording',
          hasMotion: true,
          alertCount: 2,
        },
        {
          id: '2',
          name: 'Estacionamento',
          location: 'Bloco B',
          status: 'online',
        },
        {
          id: '3',
          name: 'Sala de Baterias',
          location: 'Sala Tecnica 01',
          status: 'alert',
          alertCount: 5,
          hasMotion: true,
        },
        {
          id: '4',
          name: 'Corredor Norte',
          location: 'Andar 2',
          status: 'offline',
        },
        {
          id: '5',
          name: 'Deposito',
          location: 'Subsolo',
          status: 'online',
        },
        {
          id: '6',
          name: 'Area de Carga',
          location: 'Dock 1',
          status: 'recording',
        },
      ]);
      setStats({
        total: 6,
        online: 2,
        recording: 2,
        offline: 1,
        alerts: 1,
      });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refresh thumbnails every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleCameraPress = (cameraId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('CameraDetail', { cameraId });
  };

  const handleEventsPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('CameraEvents', {});
  };

  const screenStyles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={screenStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={screenStyles.container} edges={['left', 'right']}>
      <ScrollView
        style={screenStyles.scrollView}
        contentContainerStyle={screenStyles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
      >
        {/* Header */}
        <View style={screenStyles.header}>
          <View>
            <Text style={screenStyles.title}>Cameras</Text>
            <Text style={screenStyles.subtitle}>Monitoramento de seguranca</Text>
          </View>
          <TouchableOpacity style={screenStyles.headerButton} onPress={handleEventsPress}>
            <Ionicons name="list-outline" size={22} color={isDark ? '#f8fafc' : '#0f172a'} />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={screenStyles.statsGrid}>
          <StatCard
            icon="videocam"
            title="Total"
            value={stats.total}
            color="#10b981"
            isDark={isDark}
          />
          <StatCard
            icon="radio-button-on"
            title="Gravando"
            value={stats.recording}
            color="#ef4444"
            isDark={isDark}
          />
          <StatCard
            icon="checkmark-circle"
            title="Online"
            value={stats.online}
            color="#06b6d4"
            isDark={isDark}
          />
          <StatCard
            icon="alert-circle"
            title="Alertas"
            value={stats.alerts}
            color="#f59e0b"
            isDark={isDark}
          />
        </View>

        {/* Cameras Grid */}
        <View style={screenStyles.section}>
          <View style={screenStyles.sectionHeader}>
            <Text style={screenStyles.sectionTitle}>Todas as Cameras</Text>
            <Text style={screenStyles.cameraCount}>{cameras.length} cameras</Text>
          </View>

          {cameras.length === 0 ? (
            <View style={screenStyles.emptyState}>
              <Ionicons name="videocam-off-outline" size={48} color="#64748b" />
              <Text style={screenStyles.emptyText}>Nenhuma camera cadastrada</Text>
            </View>
          ) : (
            <View style={screenStyles.camerasGrid}>
              {cameras.map((camera) => (
                <CameraCard
                  key={camera.id}
                  camera={camera}
                  isDark={isDark}
                  onPress={() => handleCameraPress(camera.id)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Stat Card Component
function StatCard({
  icon,
  title,
  value,
  color,
  isDark,
}: {
  icon: string;
  title: string;
  value: number;
  color: string;
  isDark: boolean;
}) {
  return (
    <View style={[statStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <View style={[statStyles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={[statStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
        {value}
      </Text>
      <Text style={statStyles.title}>{title}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    minWidth: '48%',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  value: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});

const styles = StyleSheet.create({
  cameraCard: {
    width: '48%',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  alertBorder: {
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  thumbnailContainer: {
    height: 120,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusOverlay: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  recordingDot: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordingInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ef4444',
  },
  alertBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  alertBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  motionIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 4,
    borderRadius: 8,
  },
  cameraInfo: {
    padding: 12,
  },
  cameraName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cameraLocation: {
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    subtitle: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4,
    },
    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
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
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    cameraCount: {
      fontSize: 14,
      color: '#64748b',
    },
    emptyState: {
      alignItems: 'center',
      padding: 32,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
    },
    emptyText: {
      color: '#64748b',
      marginTop: 12,
    },
    camerasGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
  });
