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
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { systemsApi, telemetryApi, controlApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'SystemDetail'>;

export default function SystemDetailScreen() {
  const route = useRoute<RouteParams>();
  const { systemId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [system, setSystem] = useState<any>(null);
  const [telemetry, setTelemetry] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      const [systemRes, telemetryRes] = await Promise.all([
        systemsApi.getById(systemId),
        telemetryApi.getCurrent(systemId),
      ]);

      setSystem(systemRes.data.data);
      setTelemetry(telemetryRes.data.data);
    } catch (error) {
      console.error('Failed to fetch system data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [systemId]);

  useEffect(() => {
    fetchData();
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleEmergencyStop = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    try {
      await controlApi.emergencyStop(systemId, 'Emergency stop from mobile app');
      fetchData();
    } catch (error) {
      console.error('Emergency stop failed:', error);
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

  if (!system) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Sistema não encontrado</Text>
      </View>
    );
  }

  const isOnline = system.connectionStatus === 'online';
  const soc = telemetry?.soc || 0;

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
      {/* SOC Display */}
      <View style={styles.socContainer}>
        <View style={styles.socCircle}>
          <Text style={styles.socValue}>{Math.round(soc)}%</Text>
          <Text style={styles.socLabel}>SOC</Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: isOnline ? '#10b981' + '20' : '#64748b' + '20' }
          ]}>
            <View style={[
              styles.statusDot,
              { backgroundColor: isOnline ? '#10b981' : '#64748b' }
            ]} />
            <Text style={[
              styles.statusText,
              { color: isOnline ? '#10b981' : '#64748b' }
            ]}>
              {isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
          {telemetry?.isCharging && (
            <View style={[styles.statusBadge, { backgroundColor: '#06b6d4' + '20' }]}>
              <Ionicons name="flash" size={12} color="#06b6d4" />
              <Text style={[styles.statusText, { color: '#06b6d4' }]}>Carregando</Text>
            </View>
          )}
          {telemetry?.isDischarging && (
            <View style={[styles.statusBadge, { backgroundColor: '#f59e0b' + '20' }]}>
              <Ionicons name="flash" size={12} color="#f59e0b" />
              <Text style={[styles.statusText, { color: '#f59e0b' }]}>Descarregando</Text>
            </View>
          )}
        </View>
      </View>

      {/* Telemetry Grid */}
      {telemetry && (
        <View style={styles.telemetryGrid}>
          <TelemetryCard
            icon="speedometer-outline"
            label="Tensão"
            value={`${(telemetry.totalVoltage || 0).toFixed(1)}V`}
            isDark={isDark}
          />
          <TelemetryCard
            icon="flash-outline"
            label="Corrente"
            value={`${(telemetry.current || 0).toFixed(1)}A`}
            isDark={isDark}
          />
          <TelemetryCard
            icon="thermometer-outline"
            label="Temperatura"
            value={`${(telemetry.temperature?.average || 0).toFixed(1)}°C`}
            isDark={isDark}
          />
          <TelemetryCard
            icon="pulse-outline"
            label="Potência"
            value={`${(telemetry.power || 0).toFixed(0)}W`}
            isDark={isDark}
          />
          <TelemetryCard
            icon="heart-outline"
            label="SOH"
            value={`${Math.round(telemetry.soh || 100)}%`}
            isDark={isDark}
          />
          <TelemetryCard
            icon="repeat-outline"
            label="Ciclos"
            value={`${telemetry.cycleCount || 0}`}
            isDark={isDark}
          />
        </View>
      )}

      {/* System Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Informações do Sistema</Text>
        <InfoRow label="Nome" value={system.name} isDark={isDark} />
        <InfoRow label="Modelo" value={system.model} isDark={isDark} />
        <InfoRow label="Fabricante" value={system.manufacturer} isDark={isDark} />
        <InfoRow label="Número de Série" value={system.serialNumber} isDark={isDark} />
        <InfoRow label="Capacidade" value={`${system.batterySpec?.energyCapacity || 0} kWh`} isDark={isDark} />
        <InfoRow label="Química" value={system.batterySpec?.chemistry || 'N/A'} isDark={isDark} />
      </View>

      {/* Emergency Stop Button */}
      {isOnline && (
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={handleEmergencyStop}
          activeOpacity={0.8}
        >
          <Ionicons name="stop-circle" size={24} color="#ffffff" />
          <Text style={styles.emergencyText}>Parada de Emergência</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

// Telemetry Card Component
function TelemetryCard({
  icon,
  label,
  value,
  isDark,
}: {
  icon: string;
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <View style={[cardStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <Ionicons name={icon as any} size={20} color="#10b981" />
      <Text style={[cardStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{value}</Text>
      <Text style={cardStyles.label}>{label}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: '31%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  value: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 4,
  },
});

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
    borderBottomColor: '#334155' + '30',
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
    socContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    socCircle: {
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
      borderWidth: 8,
      borderColor: '#10b981',
    },
    socValue: {
      fontSize: 48,
      fontWeight: 'bold',
      color: '#10b981',
    },
    socLabel: {
      fontSize: 14,
      color: '#64748b',
    },
    statusContainer: {
      flexDirection: 'row',
      gap: 8,
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
    telemetryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 24,
    },
    infoCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 8,
    },
    emergencyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#ef4444',
      padding: 16,
      borderRadius: 16,
    },
    emergencyText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
