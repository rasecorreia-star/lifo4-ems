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
  Alert,
  Animated,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { evChargersApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'ChargingSession'>;

// Status colors
const STATUS_COLORS = {
  available: '#10b981',
  charging: '#06b6d4',
  occupied: '#f59e0b',
  faulted: '#ef4444',
  offline: '#64748b',
};

interface ChargingSession {
  id: string;
  chargerId: string;
  chargerName: string;
  connectorId: number;
  connectorType: string;
  startTime: string;
  endTime?: string;
  energyDelivered: number;
  averagePower: number;
  currentPower: number;
  maxPower: number;
  duration: number;
  cost: number;
  pricePerKwh: number;
  status: 'active' | 'completed' | 'stopped' | 'error';
  vehicleInfo?: {
    id: string;
    name: string;
    batteryCapacity: number;
    estimatedSoc?: number;
  };
  meterStart: number;
  meterStop?: number;
}

export default function ChargingSessionScreen() {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation();
  const { chargerId, sessionId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [session, setSession] = useState<ChargingSession | null>(null);
  const [isControlling, setIsControlling] = useState(false);

  // Animation for charging pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (session?.status === 'active') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [session?.status, pulseAnim]);

  const fetchData = useCallback(async () => {
    try {
      const response = await evChargersApi.getSession(chargerId, sessionId);
      setSession(response.data.data);
    } catch (error) {
      console.error('Falha ao buscar dados da sessao:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [chargerId, sessionId]);

  useEffect(() => {
    fetchData();
    // Poll for updates every 5 seconds when active
    const interval = setInterval(() => {
      if (session?.status === 'active') {
        fetchData();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchData, session?.status]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleStopCharging = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Parar Carregamento',
      'Deseja parar o carregamento em andamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Parar',
          style: 'destructive',
          onPress: async () => {
            setIsControlling(true);
            try {
              await evChargersApi.stopCharging(chargerId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchData();
            } catch (error) {
              console.error('Falha ao parar carregamento:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Erro', 'Falha ao parar o carregamento. Tente novamente.');
            } finally {
              setIsControlling(false);
            }
          },
        },
      ]
    );
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
    }
    return `${minutes}min ${secs.toString().padStart(2, '0')}s`;
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatDateTime = (dateString: string): string => {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'active':
        return 'Em Andamento';
      case 'completed':
        return 'Concluido';
      case 'stopped':
        return 'Interrompido';
      case 'error':
        return 'Erro';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return STATUS_COLORS.charging;
      case 'completed':
        return STATUS_COLORS.available;
      case 'stopped':
        return STATUS_COLORS.occupied;
      case 'error':
        return STATUS_COLORS.faulted;
      default:
        return STATUS_COLORS.offline;
    }
  };

  const styles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!session) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Sessao nao encontrada</Text>
      </View>
    );
  }

  const isActive = session.status === 'active';
  const statusColor = getStatusColor(session.status);
  const progressPercent = session.vehicleInfo?.batteryCapacity
    ? Math.min((session.energyDelivered / session.vehicleInfo.batteryCapacity) * 100, 100)
    : Math.min((session.energyDelivered / 50) * 100, 100);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#10b981"
        />
      }
    >
      {/* Charging Animation / Status */}
      <View style={styles.statusSection}>
        <Animated.View
          style={[
            styles.chargingCircle,
            {
              borderColor: statusColor,
              transform: [{ scale: isActive ? pulseAnim : 1 }],
            },
          ]}
        >
          <Ionicons
            name={isActive ? 'flash' : 'checkmark-circle'}
            size={56}
            color={statusColor}
          />
        </Animated.View>

        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>
            {getStatusLabel(session.status)}
          </Text>
        </View>

        <Text style={styles.chargerName}>{session.chargerName}</Text>
        <Text style={styles.connectorInfo}>
          Conector {session.connectorId} - {session.connectorType}
        </Text>
      </View>

      {/* Main Metrics */}
      <View style={styles.mainMetricsCard}>
        {/* Energy */}
        <View style={styles.mainMetric}>
          <Text style={styles.mainMetricValue}>
            {session.energyDelivered.toFixed(2)}
          </Text>
          <Text style={styles.mainMetricUnit}>kWh</Text>
          <Text style={styles.mainMetricLabel}>Energia Entregue</Text>
        </View>

        {/* Divider */}
        <View style={styles.metricDivider} />

        {/* Cost */}
        <View style={styles.mainMetric}>
          <Text style={styles.mainMetricValue}>
            {formatCurrency(session.cost)}
          </Text>
          <Text style={styles.mainMetricLabel}>Custo Total</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progresso do Carregamento</Text>
          <Text style={styles.progressPercent}>{progressPercent.toFixed(0)}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${progressPercent}%`, backgroundColor: statusColor }
            ]}
          />
        </View>
        {session.vehicleInfo?.estimatedSoc !== undefined && (
          <Text style={styles.socEstimate}>
            SOC Estimado: {session.vehicleInfo.estimatedSoc.toFixed(0)}%
          </Text>
        )}
      </View>

      {/* Detailed Metrics Grid */}
      <View style={styles.metricsGrid}>
        <MetricCard
          icon="speedometer-outline"
          label="Potencia Atual"
          value={`${session.currentPower.toFixed(1)} kW`}
          highlight={isActive}
          isDark={isDark}
        />
        <MetricCard
          icon="trending-up-outline"
          label="Potencia Maxima"
          value={`${session.maxPower.toFixed(1)} kW`}
          isDark={isDark}
        />
        <MetricCard
          icon="analytics-outline"
          label="Potencia Media"
          value={`${session.averagePower.toFixed(1)} kW`}
          isDark={isDark}
        />
        <MetricCard
          icon="time-outline"
          label="Duracao"
          value={formatDuration(session.duration)}
          isDark={isDark}
        />
        <MetricCard
          icon="pricetag-outline"
          label="Preco/kWh"
          value={formatCurrency(session.pricePerKwh)}
          isDark={isDark}
        />
        <MetricCard
          icon="receipt-outline"
          label="Medidor Inicio"
          value={`${session.meterStart.toFixed(2)} kWh`}
          isDark={isDark}
        />
      </View>

      {/* Session Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Informacoes da Sessao</Text>
        <InfoRow label="ID da Sessao" value={session.id} isDark={isDark} />
        <InfoRow label="Inicio" value={formatDateTime(session.startTime)} isDark={isDark} />
        {session.endTime && (
          <InfoRow label="Fim" value={formatDateTime(session.endTime)} isDark={isDark} />
        )}
        {session.meterStop !== undefined && (
          <InfoRow label="Medidor Fim" value={`${session.meterStop.toFixed(2)} kWh`} isDark={isDark} />
        )}
      </View>

      {/* Vehicle Info */}
      {session.vehicleInfo && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Informacoes do Veiculo</Text>
          <InfoRow label="Veiculo" value={session.vehicleInfo.name} isDark={isDark} />
          <InfoRow
            label="Capacidade Bateria"
            value={`${session.vehicleInfo.batteryCapacity} kWh`}
            isDark={isDark}
          />
          {session.vehicleInfo.estimatedSoc !== undefined && (
            <InfoRow
              label="SOC Estimado"
              value={`${session.vehicleInfo.estimatedSoc.toFixed(0)}%`}
              isDark={isDark}
            />
          )}
        </View>
      )}

      {/* Stop Button (if active) */}
      {isActive && (
        <TouchableOpacity
          style={styles.stopButton}
          onPress={handleStopCharging}
          disabled={isControlling}
          activeOpacity={0.8}
        >
          {isControlling ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="stop-circle" size={24} color="#ffffff" />
              <Text style={styles.stopButtonText}>Parar Carregamento</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Completed Summary */}
      {!isActive && (
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons
              name={session.status === 'completed' ? 'checkmark-circle' : 'close-circle'}
              size={24}
              color={statusColor}
            />
            <Text style={[styles.summaryTitle, { color: statusColor }]}>
              Carregamento {getStatusLabel(session.status)}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{session.energyDelivered.toFixed(2)} kWh</Text>
              <Text style={styles.summaryLabel}>Energia</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatDuration(session.duration)}</Text>
              <Text style={styles.summaryLabel}>Duracao</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatCurrency(session.cost)}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// Metric Card Component
function MetricCard({
  icon,
  label,
  value,
  highlight = false,
  isDark,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
  isDark: boolean;
}) {
  return (
    <View style={[
      metricStyles.card,
      { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
      highlight && { borderColor: STATUS_COLORS.charging, borderWidth: 1 },
    ]}>
      <Ionicons
        name={icon as any}
        size={18}
        color={highlight ? STATUS_COLORS.charging : '#64748b'}
      />
      <Text style={[
        metricStyles.value,
        { color: highlight ? STATUS_COLORS.charging : (isDark ? '#f8fafc' : '#0f172a') }
      ]}>
        {value}
      </Text>
      <Text style={metricStyles.label}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  card: {
    width: '31%',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  value: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 6,
    textAlign: 'center',
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
});

// Info Row Component
function InfoRow({ label, value, isDark }: { label: string; value: string; isDark: boolean }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#334155' + '30',
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
    marginLeft: 16,
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
    statusSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    chargingCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      marginBottom: 16,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 8,
      marginBottom: 12,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
    },
    chargerName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      textAlign: 'center',
    },
    connectorInfo: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4,
    },
    mainMetricsCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
    },
    mainMetric: {
      flex: 1,
      alignItems: 'center',
    },
    mainMetricValue: {
      fontSize: 32,
      fontWeight: 'bold',
      color: STATUS_COLORS.charging,
    },
    mainMetricUnit: {
      fontSize: 16,
      color: '#64748b',
      marginTop: 2,
    },
    mainMetricLabel: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 8,
    },
    metricDivider: {
      width: 1,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      marginHorizontal: 16,
    },
    progressSection: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    progressLabel: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    progressPercent: {
      fontSize: 14,
      fontWeight: 'bold',
      color: STATUS_COLORS.charging,
    },
    progressBar: {
      height: 8,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      borderRadius: 4,
    },
    socEstimate: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 8,
      textAlign: 'center',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 8,
      marginBottom: 16,
    },
    infoCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 8,
    },
    stopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: STATUS_COLORS.faulted,
      padding: 16,
      borderRadius: 16,
      marginBottom: 16,
    },
    stopButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    summaryCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    },
    summaryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 20,
    },
    summaryTitle: {
      fontSize: 18,
      fontWeight: '600',
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    summaryItem: {
      flex: 1,
      alignItems: 'center',
    },
    summaryValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    summaryLabel: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 4,
    },
    summaryDivider: {
      width: 1,
      height: 40,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
    },
  });
