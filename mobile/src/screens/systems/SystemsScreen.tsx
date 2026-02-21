import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
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

import { systemsApi, telemetryApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function SystemsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systems, setSystems] = useState<any[]>([]);
  const [telemetryMap, setTelemetryMap] = useState<Record<string, any>>({});

  const fetchData = useCallback(async () => {
    try {
      const systemsRes = await systemsApi.getAll();
      setSystems(systemsRes.data.data || []);

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
      console.error('Failed to fetch systems:', error);
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

  const styles = createStyles(isDark);

  const renderSystem = ({ item: system }: { item: any }) => {
    const telemetry = telemetryMap[system.id];
    const isOnline = system.connectionStatus === 'online';

    return (
      <TouchableOpacity
        style={styles.systemCard}
        onPress={() => handleSystemPress(system.id)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.systemIcon,
          { backgroundColor: isOnline ? '#10b981' + '20' : '#64748b' + '20' }
        ]}>
          <Ionicons
            name={isOnline ? 'battery-charging' : 'battery-dead'}
            size={28}
            color={isOnline ? '#10b981' : '#64748b'}
          />
        </View>

        <View style={styles.systemInfo}>
          <View style={styles.systemHeader}>
            <Text style={styles.systemName}>{system.name}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: isOnline ? '#10b981' + '20' : '#64748b' + '20' }
            ]}>
              <Text style={[
                styles.statusText,
                { color: isOnline ? '#10b981' : '#64748b' }
              ]}>
                {isOnline ? 'Online' : 'Offline'}
              </Text>
            </View>
          </View>
          <Text style={styles.systemModel}>{system.model}</Text>

          {telemetry && isOnline && (
            <View style={styles.telemetryRow}>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryValue}>{Math.round(telemetry.soc || 0)}%</Text>
                <Text style={styles.telemetryLabel}>SOC</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryValue}>{(telemetry.totalVoltage || 0).toFixed(1)}V</Text>
                <Text style={styles.telemetryLabel}>Tensão</Text>
              </View>
              <View style={styles.telemetryItem}>
                <Text style={styles.telemetryValue}>{(telemetry.temperature?.average || 0).toFixed(1)}°C</Text>
                <Text style={styles.telemetryLabel}>Temp</Text>
              </View>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </TouchableOpacity>
    );
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
      <FlatList
        data={systems}
        renderItem={renderSystem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="battery-dead-outline" size={64} color="#64748b" />
            <Text style={styles.emptyTitle}>Nenhum sistema encontrado</Text>
            <Text style={styles.emptyText}>
              Adicione um sistema escaneando o QR code
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

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
    listContent: {
      padding: 16,
    },
    systemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      marginBottom: 12,
    },
    systemIcon: {
      width: 56,
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    systemInfo: {
      flex: 1,
    },
    systemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    systemName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    statusBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    statusText: {
      fontSize: 10,
      fontWeight: '600',
    },
    systemModel: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 4,
    },
    telemetryRow: {
      flexDirection: 'row',
      marginTop: 12,
      gap: 16,
    },
    telemetryItem: {
      alignItems: 'center',
    },
    telemetryValue: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    telemetryLabel: {
      fontSize: 10,
      color: '#64748b',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: 64,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginTop: 16,
    },
    emptyText: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 8,
      textAlign: 'center',
    },
  });
