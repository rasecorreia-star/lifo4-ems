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

import { evChargersApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

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
  available: 'Disponível',
  charging: 'Carregando',
  occupied: 'Ocupado',
  faulted: 'Com Falha',
  offline: 'Offline',
};

interface EVCharger {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  status: keyof typeof STATUS_COLORS;
  connectorType: string;
  maxPower: number;
  location?: {
    name: string;
    address?: string;
  };
  currentSession?: {
    energyDelivered: number;
    duration: number;
    power: number;
  };
}

export default function EVChargersScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [chargers, setChargers] = useState<EVCharger[]>([]);
  const [filter, setFilter] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await evChargersApi.getAll({ status: filter });
      setChargers(response.data.data || []);
    } catch (error) {
      console.error('Falha ao buscar carregadores:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleChargerPress = (chargerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('EVChargerDetail', { chargerId });
  };

  const handleFilterPress = (status: string | null) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilter(filter === status ? null : status);
  };

  const getStatusIcon = (status: string): keyof typeof Ionicons.glyphMap => {
    switch (status) {
      case 'available':
        return 'checkmark-circle';
      case 'charging':
        return 'flash';
      case 'occupied':
        return 'time';
      case 'faulted':
        return 'warning';
      case 'offline':
        return 'cloud-offline';
      default:
        return 'help-circle';
    }
  };

  const styles = createStyles(isDark);

  // Calculate stats
  const stats = {
    total: chargers.length,
    available: chargers.filter(c => c.status === 'available').length,
    charging: chargers.filter(c => c.status === 'charging').length,
    faulted: chargers.filter(c => c.status === 'faulted' || c.status === 'offline').length,
  };

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
          <Text style={styles.title}>Carregadores EV</Text>
          <Text style={styles.subtitle}>Gerencie seus pontos de recarga</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="car"
            title="Total"
            value={stats.total}
            color="#64748b"
            isDark={isDark}
          />
          <StatCard
            icon="checkmark-circle"
            title="Disponíveis"
            value={stats.available}
            color={STATUS_COLORS.available}
            isDark={isDark}
          />
          <StatCard
            icon="flash"
            title="Carregando"
            value={stats.charging}
            color={STATUS_COLORS.charging}
            isDark={isDark}
          />
          <StatCard
            icon="warning"
            title="Com Falha"
            value={stats.faulted}
            color={STATUS_COLORS.faulted}
            isDark={isDark}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContainer}
        >
          <FilterChip
            label="Todos"
            active={filter === null}
            onPress={() => handleFilterPress(null)}
            isDark={isDark}
          />
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <FilterChip
              key={key}
              label={label}
              active={filter === key}
              color={STATUS_COLORS[key as keyof typeof STATUS_COLORS]}
              onPress={() => handleFilterPress(key)}
              isDark={isDark}
            />
          ))}
        </ScrollView>

        {/* Chargers List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {filter ? STATUS_LABELS[filter] : 'Todos os Carregadores'}
          </Text>

          {chargers.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="car-outline" size={48} color="#64748b" />
              <Text style={styles.emptyText}>Nenhum carregador encontrado</Text>
            </View>
          ) : (
            chargers.map((charger) => (
              <TouchableOpacity
                key={charger.id}
                style={styles.chargerCard}
                onPress={() => handleChargerPress(charger.id)}
                activeOpacity={0.7}
              >
                <View style={styles.chargerInfo}>
                  <View style={[
                    styles.chargerIcon,
                    { backgroundColor: STATUS_COLORS[charger.status] + '20' }
                  ]}>
                    <Ionicons
                      name={getStatusIcon(charger.status)}
                      size={24}
                      color={STATUS_COLORS[charger.status]}
                    />
                  </View>
                  <View style={styles.chargerDetails}>
                    <Text style={styles.chargerName}>{charger.name}</Text>
                    <Text style={styles.chargerModel}>
                      {charger.manufacturer} {charger.model}
                    </Text>
                    {charger.location && (
                      <View style={styles.locationRow}>
                        <Ionicons name="location-outline" size={12} color="#64748b" />
                        <Text style={styles.locationText}>{charger.location.name}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.chargerRight}>
                  {charger.status === 'charging' && charger.currentSession && (
                    <View style={styles.sessionInfo}>
                      <Text style={styles.powerValue}>
                        {charger.currentSession.power.toFixed(1)} kW
                      </Text>
                      <Text style={styles.powerLabel}>Potência</Text>
                    </View>
                  )}
                  <View style={[
                    styles.statusBadge,
                    { backgroundColor: STATUS_COLORS[charger.status] + '20' }
                  ]}>
                    <View style={[
                      styles.statusDot,
                      { backgroundColor: STATUS_COLORS[charger.status] }
                    ]} />
                    <Text style={[
                      styles.statusText,
                      { color: STATUS_COLORS[charger.status] }
                    ]}>
                      {STATUS_LABELS[charger.status]}
                    </Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={20} color="#64748b" />
              </TouchableOpacity>
            ))
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

// Filter Chip Component
function FilterChip({
  label,
  active,
  color,
  onPress,
  isDark,
}: {
  label: string;
  active: boolean;
  color?: string;
  onPress: () => void;
  isDark: boolean;
}) {
  const chipColor = color || '#10b981';

  return (
    <TouchableOpacity
      style={[
        filterStyles.chip,
        {
          backgroundColor: active
            ? chipColor + '20'
            : isDark ? '#1e293b' : '#ffffff',
          borderColor: active ? chipColor : isDark ? '#334155' : '#e2e8f0',
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          filterStyles.chipText,
          { color: active ? chipColor : isDark ? '#f8fafc' : '#64748b' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const filterStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  chipText: {
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
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 16,
    },
    filterScroll: {
      marginBottom: 16,
    },
    filterContainer: {
      paddingVertical: 8,
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
    chargerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      marginBottom: 12,
    },
    chargerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    chargerIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    chargerDetails: {
      flex: 1,
    },
    chargerName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    chargerModel: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
    locationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 4,
      gap: 4,
    },
    locationText: {
      fontSize: 11,
      color: '#64748b',
    },
    chargerRight: {
      alignItems: 'flex-end',
      marginRight: 12,
    },
    sessionInfo: {
      alignItems: 'flex-end',
      marginBottom: 4,
    },
    powerValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: STATUS_COLORS.charging,
    },
    powerLabel: {
      fontSize: 10,
      color: '#64748b',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 6,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '600',
    },
  });
