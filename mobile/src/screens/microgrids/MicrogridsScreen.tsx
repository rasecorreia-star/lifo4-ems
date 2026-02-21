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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { microgridsApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Operating mode colors
const MODE_COLORS = {
  'grid-connected': '#10b981',  // Green
  'islanded': '#f59e0b',        // Orange
  'black-start': '#06b6d4',     // Blue
  'fault': '#ef4444',           // Red
  'transitioning': '#8b5cf6',   // Purple
};

const MODE_LABELS: Record<string, string> = {
  'grid-connected': 'Conectado',
  'islanded': 'Ilhado',
  'black-start': 'Black Start',
  'fault': 'Falha',
  'transitioning': 'Em Transicao',
};

interface Microgrid {
  id: string;
  name: string;
  location?: string;
  operatingMode: keyof typeof MODE_COLORS;
  status: string;
  powerBalance: {
    generation: number;
    consumption: number;
    gridExchange: number;
    storage: number;
  };
  componentsCount: {
    bess: number;
    solar: number;
    loads: number;
  };
  gridConnection: {
    connected: boolean;
    frequency?: number;
    voltage?: number;
  };
}

export default function MicrogridsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [microgrids, setMicrogrids] = useState<Microgrid[]>([]);
  const [summary, setSummary] = useState({
    total: 0,
    gridConnected: 0,
    islanded: 0,
    fault: 0,
  });

  const fetchData = useCallback(async () => {
    try {
      const response = await microgridsApi.getAll();
      const data = response.data.data || [];
      setMicrogrids(data);

      // Calculate summary
      const newSummary = data.reduce(
        (acc: typeof summary, mg: Microgrid) => {
          acc.total++;
          if (mg.operatingMode === 'grid-connected') acc.gridConnected++;
          else if (mg.operatingMode === 'islanded') acc.islanded++;
          else if (mg.operatingMode === 'fault') acc.fault++;
          return acc;
        },
        { total: 0, gridConnected: 0, islanded: 0, fault: 0 }
      );
      setSummary(newSummary);
    } catch (error) {
      console.error('Failed to fetch microgrids:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleMicrogridPress = (microgridId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('MicrogridDetail', { microgridId });
  };

  const styles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Microrredes</Text>
          <Text style={styles.subtitle}>Gerenciamento de energia distribuida</Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <SummaryCard
            icon="grid-outline"
            title="Total"
            value={summary.total}
            color="#64748b"
            isDark={isDark}
          />
          <SummaryCard
            icon="link-outline"
            title="Conectadas"
            value={summary.gridConnected}
            color={MODE_COLORS['grid-connected']}
            isDark={isDark}
          />
          <SummaryCard
            icon="cloudy-outline"
            title="Ilhadas"
            value={summary.islanded}
            color={MODE_COLORS['islanded']}
            isDark={isDark}
          />
          <SummaryCard
            icon="warning-outline"
            title="Em Falha"
            value={summary.fault}
            color={MODE_COLORS['fault']}
            isDark={isDark}
          />
        </View>

        {/* Microgrids List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Todas as Microrredes</Text>

          {microgrids.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="grid-outline" size={48} color="#64748b" />
              <Text style={styles.emptyText}>Nenhuma microrrede cadastrada</Text>
            </View>
          ) : (
            microgrids.map((microgrid) => (
              <MicrogridCard
                key={microgrid.id}
                microgrid={microgrid}
                onPress={() => handleMicrogridPress(microgrid.id)}
                isDark={isDark}
              />
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Summary Card Component
function SummaryCard({
  icon,
  title,
  value,
  color,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  value: number;
  color: string;
  isDark: boolean;
}) {
  return (
    <View style={[summaryStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <View style={[summaryStyles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={[summaryStyles.value, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
        {value}
      </Text>
      <Text style={summaryStyles.title}>{title}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
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

// Microgrid Card Component
function MicrogridCard({
  microgrid,
  onPress,
  isDark,
}: {
  microgrid: Microgrid;
  onPress: () => void;
  isDark: boolean;
}) {
  const modeColor = MODE_COLORS[microgrid.operatingMode] || '#64748b';
  const modeLabel = MODE_LABELS[microgrid.operatingMode] || microgrid.operatingMode;

  const netPower = microgrid.powerBalance.generation - microgrid.powerBalance.consumption;
  const isExporting = netPower > 0;

  return (
    <TouchableOpacity
      style={[cardStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Header Row */}
      <View style={cardStyles.header}>
        <View style={cardStyles.titleRow}>
          <View style={[cardStyles.modeIndicator, { backgroundColor: modeColor }]} />
          <View style={cardStyles.titleContainer}>
            <Text style={[cardStyles.name, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              {microgrid.name}
            </Text>
            {microgrid.location && (
              <Text style={cardStyles.location}>{microgrid.location}</Text>
            )}
          </View>
        </View>
        <View style={[cardStyles.modeBadge, { backgroundColor: modeColor + '20' }]}>
          <Text style={[cardStyles.modeText, { color: modeColor }]}>{modeLabel}</Text>
        </View>
      </View>

      {/* Power Balance */}
      <View style={cardStyles.powerSection}>
        <View style={cardStyles.powerRow}>
          <PowerIndicator
            icon="sunny-outline"
            label="Geracao"
            value={microgrid.powerBalance.generation}
            unit="kW"
            color="#f59e0b"
            isDark={isDark}
          />
          <PowerIndicator
            icon="flash-outline"
            label="Consumo"
            value={microgrid.powerBalance.consumption}
            unit="kW"
            color="#ef4444"
            isDark={isDark}
          />
          <PowerIndicator
            icon="swap-horizontal-outline"
            label="Rede"
            value={Math.abs(microgrid.powerBalance.gridExchange)}
            unit="kW"
            color={microgrid.powerBalance.gridExchange > 0 ? '#10b981' : '#06b6d4'}
            isDark={isDark}
            suffix={microgrid.powerBalance.gridExchange > 0 ? 'Exp' : 'Imp'}
          />
        </View>
      </View>

      {/* Status Row */}
      <View style={cardStyles.statusRow}>
        <View style={cardStyles.statusItem}>
          <Ionicons
            name={microgrid.gridConnection.connected ? 'link' : 'unlink'}
            size={14}
            color={microgrid.gridConnection.connected ? '#10b981' : '#f59e0b'}
          />
          <Text style={cardStyles.statusText}>
            {microgrid.gridConnection.connected ? 'Conectado' : 'Desconectado'}
          </Text>
        </View>
        <View style={cardStyles.componentsInfo}>
          <Text style={cardStyles.componentsText}>
            {microgrid.componentsCount.bess} BESS | {microgrid.componentsCount.solar} Solar | {microgrid.componentsCount.loads} Cargas
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>
    </TouchableOpacity>
  );
}

// Power Indicator Component
function PowerIndicator({
  icon,
  label,
  value,
  unit,
  color,
  isDark,
  suffix,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  unit: string;
  color: string;
  isDark: boolean;
  suffix?: string;
}) {
  return (
    <View style={cardStyles.powerIndicator}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[cardStyles.powerValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
        {value.toFixed(1)} {unit}
        {suffix && <Text style={[cardStyles.powerSuffix, { color }]}> {suffix}</Text>}
      </Text>
      <Text style={cardStyles.powerLabel}>{label}</Text>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modeIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  titleContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  location: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  powerSection: {
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#33415530',
  },
  powerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  powerIndicator: {
    alignItems: 'center',
    flex: 1,
  },
  powerValue: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  powerSuffix: {
    fontSize: 10,
    fontWeight: '500',
  },
  powerLabel: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#33415530',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
  },
  componentsInfo: {
    flex: 1,
    marginLeft: 12,
  },
  componentsText: {
    fontSize: 10,
    color: '#64748b',
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
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 24,
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
  });
