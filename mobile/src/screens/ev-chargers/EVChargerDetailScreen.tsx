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
  Alert,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { evChargersApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'EVChargerDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Status colors
const STATUS_COLORS = {
  available: '#10b981',
  charging: '#06b6d4',
  occupied: '#f59e0b',
  faulted: '#ef4444',
  offline: '#64748b',
};

// Status labels in Portuguese
const STATUS_LABELS: Record<string, string> = {
  available: 'Disponivel',
  charging: 'Carregando',
  occupied: 'Ocupado',
  faulted: 'Com Falha',
  offline: 'Offline',
};

// Connector state labels
const CONNECTOR_STATES: Record<string, string> = {
  Available: 'Disponivel',
  Preparing: 'Preparando',
  Charging: 'Carregando',
  SuspendedEVSE: 'Suspenso (EVSE)',
  SuspendedEV: 'Suspenso (EV)',
  Finishing: 'Finalizando',
  Reserved: 'Reservado',
  Unavailable: 'Indisponivel',
  Faulted: 'Com Falha',
};

interface EVCharger {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  serialNumber: string;
  status: keyof typeof STATUS_COLORS;
  ocppVersion: string;
  firmwareVersion: string;
  connectors: Connector[];
  location?: {
    name: string;
    address?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  currentSession?: ChargingSession;
  lastHeartbeat?: string;
}

interface Connector {
  id: number;
  type: string;
  maxPower: number;
  status: string;
}

interface ChargingSession {
  id: string;
  startTime: string;
  energyDelivered: number;
  duration: number;
  power: number;
  cost: number;
  vehicleId?: string;
  userId?: string;
}

export default function EVChargerDetailScreen() {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const { chargerId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [charger, setCharger] = useState<EVCharger | null>(null);
  const [isControlling, setIsControlling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await evChargersApi.getById(chargerId);
      setCharger(response.data.data);
    } catch (error) {
      console.error('Falha ao buscar dados do carregador:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [chargerId]);

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds when charging
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleStartCharging = async (connectorId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Alert.alert(
      'Iniciar Carregamento',
      'Deseja iniciar o carregamento neste conector?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Iniciar',
          onPress: async () => {
            setIsControlling(true);
            try {
              await evChargersApi.startCharging(chargerId, connectorId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              fetchData();
            } catch (error) {
              console.error('Falha ao iniciar carregamento:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Erro', 'Falha ao iniciar o carregamento. Tente novamente.');
            } finally {
              setIsControlling(false);
            }
          },
        },
      ]
    );
  };

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

  const handleViewSession = () => {
    if (charger?.currentSession) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      navigation.navigate('ChargingSession', {
        chargerId,
        sessionId: charger.currentSession.id,
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  const formatCurrency = (value: number): string => {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const styles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!charger) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Carregador nao encontrado</Text>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[charger.status];
  const isCharging = charger.status === 'charging';
  const isAvailable = charger.status === 'available';

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
      {/* Status Display */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusCircle, { borderColor: statusColor }]}>
          <Ionicons
            name={isCharging ? 'flash' : isAvailable ? 'checkmark-circle' : 'close-circle'}
            size={48}
            color={statusColor}
          />
        </View>
        <View style={styles.statusInfo}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: statusColor + '20' }
          ]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {STATUS_LABELS[charger.status]}
            </Text>
          </View>
          <Text style={styles.chargerName}>{charger.name}</Text>
          {charger.location && (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={14} color="#64748b" />
              <Text style={styles.locationText}>{charger.location.name}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Current Session (if charging) */}
      {isCharging && charger.currentSession && (
        <TouchableOpacity
          style={styles.sessionCard}
          onPress={handleViewSession}
          activeOpacity={0.7}
        >
          <View style={styles.sessionHeader}>
            <View style={styles.sessionTitleRow}>
              <Ionicons name="flash" size={20} color={STATUS_COLORS.charging} />
              <Text style={styles.sessionTitle}>Sessao em Andamento</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </View>

          <View style={styles.sessionGrid}>
            <SessionMetric
              icon="flash-outline"
              label="Energia"
              value={`${charger.currentSession.energyDelivered.toFixed(2)} kWh`}
              isDark={isDark}
            />
            <SessionMetric
              icon="speedometer-outline"
              label="Potencia"
              value={`${charger.currentSession.power.toFixed(1)} kW`}
              isDark={isDark}
            />
            <SessionMetric
              icon="time-outline"
              label="Duracao"
              value={formatDuration(charger.currentSession.duration)}
              isDark={isDark}
            />
            <SessionMetric
              icon="cash-outline"
              label="Custo"
              value={formatCurrency(charger.currentSession.cost)}
              isDark={isDark}
            />
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((charger.currentSession.energyDelivered / 50) * 100, 100)}%` }
                ]}
              />
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Control Buttons */}
      <View style={styles.controlsContainer}>
        {isCharging ? (
          <TouchableOpacity
            style={[styles.controlButton, styles.stopButton]}
            onPress={handleStopCharging}
            disabled={isControlling}
            activeOpacity={0.8}
          >
            {isControlling ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="stop-circle" size={24} color="#ffffff" />
                <Text style={styles.controlButtonText}>Parar Carregamento</Text>
              </>
            )}
          </TouchableOpacity>
        ) : isAvailable ? (
          <TouchableOpacity
            style={[styles.controlButton, styles.startButton]}
            onPress={() => handleStartCharging(1)}
            disabled={isControlling}
            activeOpacity={0.8}
          >
            {isControlling ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="play-circle" size={24} color="#ffffff" />
                <Text style={styles.controlButtonText}>Iniciar Carregamento</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <View style={[styles.controlButton, styles.disabledButton]}>
            <Ionicons name="close-circle" size={24} color="#ffffff" />
            <Text style={styles.controlButtonText}>
              {charger.status === 'faulted' ? 'Carregador com Falha' : 'Indisponivel'}
            </Text>
          </View>
        )}
      </View>

      {/* Connectors */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conectores</Text>
        {charger.connectors.map((connector) => (
          <View key={connector.id} style={styles.connectorCard}>
            <View style={styles.connectorIcon}>
              <Ionicons name="git-commit-outline" size={24} color="#10b981" />
            </View>
            <View style={styles.connectorInfo}>
              <Text style={styles.connectorName}>
                Conector {connector.id} - {connector.type}
              </Text>
              <Text style={styles.connectorPower}>
                Potencia maxima: {connector.maxPower} kW
              </Text>
            </View>
            <View style={[
              styles.connectorStatus,
              { backgroundColor: getConnectorStatusColor(connector.status) + '20' }
            ]}>
              <Text style={[
                styles.connectorStatusText,
                { color: getConnectorStatusColor(connector.status) }
              ]}>
                {CONNECTOR_STATES[connector.status] || connector.status}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Charger Info */}
      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Informacoes do Carregador</Text>
        <InfoRow label="Modelo" value={`${charger.manufacturer} ${charger.model}`} isDark={isDark} />
        <InfoRow label="Numero de Serie" value={charger.serialNumber} isDark={isDark} />
        <InfoRow label="Versao OCPP" value={charger.ocppVersion} isDark={isDark} />
        <InfoRow label="Firmware" value={charger.firmwareVersion} isDark={isDark} />
        {charger.lastHeartbeat && (
          <InfoRow
            label="Ultimo Heartbeat"
            value={new Date(charger.lastHeartbeat).toLocaleString('pt-BR')}
            isDark={isDark}
          />
        )}
      </View>

      {/* Location Info */}
      {charger.location && (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Localizacao</Text>
          <InfoRow label="Nome" value={charger.location.name} isDark={isDark} />
          {charger.location.address && (
            <InfoRow label="Endereco" value={charger.location.address} isDark={isDark} />
          )}
          {charger.location.coordinates && (
            <TouchableOpacity
              style={styles.mapButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                // Open in maps app
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="map-outline" size={20} color="#10b981" />
              <Text style={styles.mapButtonText}>Ver no Mapa</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function getConnectorStatusColor(status: string): string {
  switch (status) {
    case 'Available':
      return STATUS_COLORS.available;
    case 'Charging':
    case 'Preparing':
    case 'Finishing':
      return STATUS_COLORS.charging;
    case 'SuspendedEVSE':
    case 'SuspendedEV':
    case 'Reserved':
      return STATUS_COLORS.occupied;
    case 'Faulted':
    case 'Unavailable':
      return STATUS_COLORS.faulted;
    default:
      return STATUS_COLORS.offline;
  }
}

// Session Metric Component
function SessionMetric({
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
    <View style={metricStyles.container}>
      <Ionicons name={icon as any} size={16} color="#64748b" />
      <Text style={[metricStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
        {value}
      </Text>
      <Text style={metricStyles.label}>{label}</Text>
    </View>
  );
}

const metricStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
  },
  value: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
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
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
    },
    statusCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      marginRight: 16,
    },
    statusInfo: {
      flex: 1,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
      alignSelf: 'flex-start',
      marginBottom: 8,
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
    chargerName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 4,
    },
    locationText: {
      fontSize: 13,
      color: '#64748b',
    },
    sessionCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: STATUS_COLORS.charging + '40',
    },
    sessionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sessionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sessionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    sessionGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    progressContainer: {
      marginTop: 8,
    },
    progressBar: {
      height: 6,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: STATUS_COLORS.charging,
      borderRadius: 3,
    },
    controlsContainer: {
      marginBottom: 24,
    },
    controlButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      borderRadius: 16,
    },
    startButton: {
      backgroundColor: STATUS_COLORS.available,
    },
    stopButton: {
      backgroundColor: STATUS_COLORS.faulted,
    },
    disabledButton: {
      backgroundColor: STATUS_COLORS.offline,
    },
    controlButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 12,
    },
    connectorCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      marginBottom: 8,
    },
    connectorIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: '#10b981' + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    connectorInfo: {
      flex: 1,
    },
    connectorName: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    connectorPower: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
    connectorStatus: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    connectorStatusText: {
      fontSize: 11,
      fontWeight: '600',
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
    mapButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: 12,
      paddingVertical: 12,
      borderRadius: 12,
      backgroundColor: '#10b981' + '20',
    },
    mapButtonText: {
      color: '#10b981',
      fontSize: 14,
      fontWeight: '600',
    },
  });
