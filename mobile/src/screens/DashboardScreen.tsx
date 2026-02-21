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

import { useAuthStore } from '../store/auth.store';
import { systemsApi, alertsApi, telemetryApi } from '../services/api';
import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuthStore();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<any>(null);
  const [systems, setSystems] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, any>>({});

  const fetchData = useCallback(async () => {
    try {
      const [overviewRes, systemsRes, alertsRes] = await Promise.all([
        systemsApi.getOverview(),
        systemsApi.getAll({ limit: 5 }),
        alertsApi.getAll({ limit: 5 }),
      ]);

      setOverview(overviewRes.data.data);
      setSystems(systemsRes.data.data || []);
      setAlerts(alertsRes.data.data || []);

      // Fetch telemetry for each system
      const telemetry: Record<string, any> = {};
      for (const system of systemsRes.data.data || []) {
        try {
          const telRes = await telemetryApi.getCurrent(system.id);
          if (telRes.data.data) {
            telemetry[system.id] = telRes.data.data;
          }
        } catch {
          // Ignore individual errors
        }
      }
      setTelemetryMap(telemetry);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
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

  const handleSystemPress = (systemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('SystemDetail', { systemId });
  };

  const handleScanQR = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('QRScanner');
  };

  const handleMap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('Map');
  };

  const styles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';

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
          <View>
            <Text style={styles.greeting}>{greeting}, {user?.name?.split(' ')[0]}!</Text>
            <Text style={styles.subtitle}>Visão geral dos seus sistemas</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerButton} onPress={handleScanQR}>
              <Ionicons name="qr-code-outline" size={22} color={isDark ? '#f8fafc' : '#0f172a'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerButton} onPress={handleMap}>
              <Ionicons name="map-outline" size={22} color={isDark ? '#f8fafc' : '#0f172a'} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="battery-charging"
            title="Online"
            value={overview?.online || 0}
            total={overview?.total}
            color="#10b981"
            isDark={isDark}
          />
          <StatCard
            icon="trending-up"
            title="Carregando"
            value={overview?.charging || 0}
            color="#06b6d4"
            isDark={isDark}
          />
          <StatCard
            icon="trending-down"
            title="Descarregando"
            value={overview?.discharging || 0}
            color="#f59e0b"
            isDark={isDark}
          />
          <StatCard
            icon="alert-circle"
            title="Alertas"
            value={alerts.length}
            color="#ef4444"
            isDark={isDark}
          />
        </View>

        {/* Systems List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Sistemas</Text>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Ver todos</Text>
            </TouchableOpacity>
          </View>

          {systems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="battery-dead-outline" size={48} color="#64748b" />
              <Text style={styles.emptyText}>Nenhum sistema cadastrado</Text>
            </View>
          ) : (
            systems.map((system) => {
              const telemetry = telemetryMap[system.id];
              return (
                <TouchableOpacity
                  key={system.id}
                  style={styles.systemCard}
                  onPress={() => handleSystemPress(system.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.systemInfo}>
                    <View style={[
                      styles.systemIcon,
                      { backgroundColor: system.connectionStatus === 'online' ? '#10b981' + '20' : '#64748b' + '20' }
                    ]}>
                      <Ionicons
                        name={system.connectionStatus === 'online' ? 'battery-charging' : 'battery-dead'}
                        size={24}
                        color={system.connectionStatus === 'online' ? '#10b981' : '#64748b'}
                      />
                    </View>
                    <View style={styles.systemDetails}>
                      <Text style={styles.systemName}>{system.name}</Text>
                      <Text style={styles.systemModel}>{system.model}</Text>
                    </View>
                  </View>
                  {telemetry && (
                    <View style={styles.systemStats}>
                      <Text style={styles.socValue}>{Math.round(telemetry.soc || 0)}%</Text>
                      <Text style={styles.socLabel}>SOC</Text>
                    </View>
                  )}
                  <Ionicons name="chevron-forward" size={20} color="#64748b" />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Recent Alerts */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alertas Recentes</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>Ver todos</Text>
              </TouchableOpacity>
            </View>

            {alerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <View style={[
                  styles.alertDot,
                  { backgroundColor: alert.severity === 'critical' ? '#ef4444' : '#f59e0b' }
                ]} />
                <View style={styles.alertInfo}>
                  <Text style={styles.alertTitle}>{alert.title}</Text>
                  <Text style={styles.alertMessage} numberOfLines={1}>{alert.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Stat Card Component
function StatCard({
  icon,
  title,
  value,
  total,
  color,
  isDark,
}: {
  icon: string;
  title: string;
  value: number;
  total?: number;
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
        {total !== undefined && <Text style={statStyles.total}>/{total}</Text>}
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
  total: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#64748b',
  },
  title: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
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
    greeting: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    subtitle: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4,
    },
    headerActions: {
      flexDirection: 'row',
      gap: 12,
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
    seeAllText: {
      fontSize: 14,
      color: '#10b981',
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
    systemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      marginBottom: 12,
    },
    systemInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    systemIcon: {
      width: 48,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    systemDetails: {
      flex: 1,
    },
    systemName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    systemModel: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
    systemStats: {
      alignItems: 'center',
      marginRight: 12,
    },
    socValue: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#10b981',
    },
    socLabel: {
      fontSize: 10,
      color: '#64748b',
    },
    alertCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      marginBottom: 8,
    },
    alertDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginRight: 12,
    },
    alertInfo: {
      flex: 1,
    },
    alertTitle: {
      fontSize: 14,
      fontWeight: '500',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    alertMessage: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
  });
