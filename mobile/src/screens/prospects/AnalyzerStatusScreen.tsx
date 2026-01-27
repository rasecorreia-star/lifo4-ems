import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  useColorScheme,
  ActivityIndicator,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { prospectsApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'AnalyzerStatus'>;

interface AnalyzerData {
  kitId: string;
  status: 'pending' | 'installing' | 'active' | 'completed' | 'failed';
  installationDate?: string;
  daysElapsed: number;
  totalDays: number;
  dataQuality: {
    overall: number;
    completeness: number;
    accuracy: number;
    consistency: number;
  };
  realtimeData?: {
    power: number;
    voltage: number;
    current: number;
    consumptionPattern: 'low' | 'medium' | 'high' | 'peak';
    lastUpdate: string;
  };
  measurements?: {
    totalReadings: number;
    averagePower: number;
    peakPower: number;
    minPower: number;
    totalEnergy: number;
  };
  prospect?: {
    id: string;
    name: string;
    company: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Pendente', color: '#f59e0b', icon: 'time-outline' },
  installing: { label: 'Instalando', color: '#3b82f6', icon: 'construct-outline' },
  active: { label: 'Ativo', color: '#10b981', icon: 'pulse-outline' },
  completed: { label: 'Concluido', color: '#8b5cf6', icon: 'checkmark-circle-outline' },
  failed: { label: 'Falhou', color: '#ef4444', icon: 'close-circle-outline' },
};

const PATTERN_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Baixo', color: '#10b981' },
  medium: { label: 'Medio', color: '#3b82f6' },
  high: { label: 'Alto', color: '#f59e0b' },
  peak: { label: 'Pico', color: '#ef4444' },
};

export default function AnalyzerStatusScreen() {
  const route = useRoute<RouteParams>();
  const { prospectId, kitId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzerData, setAnalyzerData] = useState<AnalyzerData | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await prospectsApi.getAnalysis(prospectId);
      setAnalyzerData(response.data.data);
    } catch (error) {
      console.error('Failed to fetch analyzer data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [prospectId]);

  useEffect(() => {
    fetchData();
    // Poll for updates every 30 seconds when active
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const styles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!analyzerData) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Dados do analisador nao encontrados</Text>
      </View>
    );
  }

  const statusConfig = STATUS_CONFIG[analyzerData.status] || STATUS_CONFIG.pending;
  const progressPercent = (analyzerData.daysElapsed / analyzerData.totalDays) * 100;

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
      {/* Kit ID and Status Header */}
      <View style={styles.headerCard}>
        <View style={styles.kitIdContainer}>
          <Ionicons name="hardware-chip" size={32} color="#06b6d4" />
          <View style={styles.kitIdInfo}>
            <Text style={styles.kitIdLabel}>Kit Analisador</Text>
            <Text style={styles.kitIdValue}>{analyzerData.kitId}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
          <Ionicons name={statusConfig.icon as any} size={16} color={statusConfig.color} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Installation Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status da Instalacao</Text>
        <View style={styles.installationCard}>
          {analyzerData.installationDate && (
            <View style={styles.installationRow}>
              <Ionicons name="calendar-outline" size={20} color="#64748b" />
              <View style={styles.installationInfo}>
                <Text style={styles.installationLabel}>Data de Instalacao</Text>
                <Text style={styles.installationValue}>
                  {new Date(analyzerData.installationDate).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Measurement Progress */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progresso da Medicao</Text>
        <View style={styles.progressCard}>
          <View style={styles.progressCircleContainer}>
            <View style={styles.progressCircle}>
              <Text style={styles.progressValue}>{analyzerData.daysElapsed}</Text>
              <Text style={styles.progressLabel}>dias</Text>
            </View>
            <View style={styles.progressDivider}>
              <Text style={styles.progressDividerText}>de</Text>
            </View>
            <View style={styles.progressTotal}>
              <Text style={styles.progressTotalValue}>{analyzerData.totalDays}</Text>
              <Text style={styles.progressTotalLabel}>dias</Text>
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${Math.min(progressPercent, 100)}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{Math.round(progressPercent)}% concluido</Text>
          </View>
        </View>
      </View>

      {/* Real-time Data Preview */}
      {analyzerData.realtimeData && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Dados em Tempo Real</Text>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>AO VIVO</Text>
            </View>
          </View>
          <View style={styles.realtimeGrid}>
            <RealtimeCard
              icon="flash"
              label="Potencia"
              value={`${analyzerData.realtimeData.power.toFixed(1)} W`}
              isDark={isDark}
            />
            <RealtimeCard
              icon="speedometer"
              label="Tensao"
              value={`${analyzerData.realtimeData.voltage.toFixed(1)} V`}
              isDark={isDark}
            />
            <RealtimeCard
              icon="pulse"
              label="Corrente"
              value={`${analyzerData.realtimeData.current.toFixed(2)} A`}
              isDark={isDark}
            />
            <View style={[styles.realtimeCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
              <Ionicons name="trending-up" size={24} color="#10b981" />
              <Text style={[styles.realtimeValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {PATTERN_CONFIG[analyzerData.realtimeData.consumptionPattern].label}
              </Text>
              <Text style={styles.realtimeLabel}>Padrao de Consumo</Text>
              <View
                style={[
                  styles.patternBadge,
                  { backgroundColor: PATTERN_CONFIG[analyzerData.realtimeData.consumptionPattern].color + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.patternText,
                    { color: PATTERN_CONFIG[analyzerData.realtimeData.consumptionPattern].color },
                  ]}
                >
                  {PATTERN_CONFIG[analyzerData.realtimeData.consumptionPattern].label}
                </Text>
              </View>
            </View>
          </View>
          <Text style={styles.lastUpdate}>
            Ultima atualizacao: {new Date(analyzerData.realtimeData.lastUpdate).toLocaleTimeString('pt-BR')}
          </Text>
        </View>
      )}

      {/* Data Quality Indicators */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Qualidade dos Dados</Text>
        <View style={styles.qualityCard}>
          <View style={styles.qualityOverall}>
            <View style={styles.qualityCircle}>
              <Text style={styles.qualityValue}>{analyzerData.dataQuality.overall}%</Text>
            </View>
            <Text style={styles.qualityLabel}>Qualidade Geral</Text>
          </View>
          <View style={styles.qualityMetrics}>
            <QualityBar
              label="Completude"
              value={analyzerData.dataQuality.completeness}
              isDark={isDark}
            />
            <QualityBar
              label="Precisao"
              value={analyzerData.dataQuality.accuracy}
              isDark={isDark}
            />
            <QualityBar
              label="Consistencia"
              value={analyzerData.dataQuality.consistency}
              isDark={isDark}
            />
          </View>
        </View>
      </View>

      {/* Measurement Summary */}
      {analyzerData.measurements && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Resumo das Medicoes</Text>
          <View style={styles.measurementCard}>
            <MeasurementRow
              icon="analytics-outline"
              label="Total de Leituras"
              value={analyzerData.measurements.totalReadings.toLocaleString('pt-BR')}
              isDark={isDark}
            />
            <MeasurementRow
              icon="trending-up-outline"
              label="Potencia Media"
              value={`${analyzerData.measurements.averagePower.toFixed(1)} W`}
              isDark={isDark}
            />
            <MeasurementRow
              icon="arrow-up-outline"
              label="Potencia Maxima"
              value={`${analyzerData.measurements.peakPower.toFixed(1)} W`}
              isDark={isDark}
            />
            <MeasurementRow
              icon="arrow-down-outline"
              label="Potencia Minima"
              value={`${analyzerData.measurements.minPower.toFixed(1)} W`}
              isDark={isDark}
            />
            <MeasurementRow
              icon="battery-charging-outline"
              label="Energia Total"
              value={`${analyzerData.measurements.totalEnergy.toFixed(2)} kWh`}
              isDark={isDark}
              isLast
            />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

// Realtime Card Component
function RealtimeCard({
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
    <View style={[realtimeStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <Ionicons name={icon as any} size={24} color="#10b981" />
      <Text style={[realtimeStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]}>{value}</Text>
      <Text style={realtimeStyles.label}>{label}</Text>
    </View>
  );
}

const realtimeStyles = StyleSheet.create({
  card: {
    width: '48%',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  value: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  label: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
});

// Quality Bar Component
function QualityBar({
  label,
  value,
  isDark,
}: {
  label: string;
  value: number;
  isDark: boolean;
}) {
  const getColor = (v: number) => {
    if (v >= 80) return '#10b981';
    if (v >= 60) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <View style={qualityStyles.container}>
      <View style={qualityStyles.header}>
        <Text style={qualityStyles.label}>{label}</Text>
        <Text style={[qualityStyles.value, { color: getColor(value) }]}>{value}%</Text>
      </View>
      <View style={[qualityStyles.bar, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
        <View
          style={[qualityStyles.fill, { width: `${value}%`, backgroundColor: getColor(value) }]}
        />
      </View>
    </View>
  );
}

const qualityStyles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
  },
  bar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});

// Measurement Row Component
function MeasurementRow({
  icon,
  label,
  value,
  isDark,
  isLast = false,
}: {
  icon: string;
  label: string;
  value: string;
  isDark: boolean;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        measurementStyles.row,
        !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? '#334155' : '#e2e8f0' },
      ]}
    >
      <View style={measurementStyles.left}>
        <Ionicons name={icon as any} size={20} color="#64748b" />
        <Text style={measurementStyles.label}>{label}</Text>
      </View>
      <Text style={[measurementStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
        {value}
      </Text>
    </View>
  );
}

const measurementStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  label: {
    fontSize: 14,
    color: '#64748b',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
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
    headerCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
    },
    kitIdContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    kitIdInfo: {
      gap: 2,
    },
    kitIdLabel: {
      fontSize: 12,
      color: '#64748b',
    },
    kitIdValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      gap: 6,
    },
    statusText: {
      fontSize: 14,
      fontWeight: '600',
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
      marginBottom: 12,
    },
    liveIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    liveDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ef4444',
    },
    liveText: {
      fontSize: 10,
      fontWeight: 'bold',
      color: '#ef4444',
    },
    installationCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
    },
    installationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    installationInfo: {
      gap: 2,
    },
    installationLabel: {
      fontSize: 12,
      color: '#64748b',
    },
    installationValue: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    progressCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 20,
    },
    progressCircleContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 24,
    },
    progressCircle: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: '#06b6d4' + '20',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: '#06b6d4',
    },
    progressValue: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#06b6d4',
    },
    progressLabel: {
      fontSize: 12,
      color: '#64748b',
    },
    progressDivider: {
      marginHorizontal: 16,
    },
    progressDividerText: {
      fontSize: 16,
      color: '#64748b',
    },
    progressTotal: {
      alignItems: 'center',
    },
    progressTotalValue: {
      fontSize: 32,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    progressTotalLabel: {
      fontSize: 12,
      color: '#64748b',
    },
    progressBarContainer: {
      alignItems: 'center',
    },
    progressBar: {
      width: '100%',
      height: 8,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 4,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#06b6d4',
      borderRadius: 4,
    },
    progressPercent: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 8,
    },
    realtimeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    realtimeCard: {
      width: '48%',
      padding: 16,
      borderRadius: 16,
      alignItems: 'center',
    },
    realtimeValue: {
      fontSize: 20,
      fontWeight: 'bold',
      marginTop: 8,
    },
    realtimeLabel: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 4,
    },
    patternBadge: {
      marginTop: 8,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    patternText: {
      fontSize: 12,
      fontWeight: '600',
    },
    lastUpdate: {
      textAlign: 'center',
      fontSize: 12,
      color: '#64748b',
      marginTop: 12,
    },
    qualityCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 20,
    },
    qualityOverall: {
      alignItems: 'center',
      marginBottom: 24,
    },
    qualityCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#10b981' + '20',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      borderColor: '#10b981',
    },
    qualityValue: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#10b981',
    },
    qualityLabel: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 8,
    },
    qualityMetrics: {
      gap: 8,
    },
    measurementCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
    },
  });
