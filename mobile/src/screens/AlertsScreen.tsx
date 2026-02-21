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
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { alertsApi } from '../services/api';

const severityColors: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#06b6d4',
  low: '#64748b',
};

export default function AlertsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const alertsRes = await alertsApi.getAll({ limit: 50 });
      setAlerts(alertsRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
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

  const handleMarkAsRead = async (alertId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await alertsApi.markAsRead(alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isRead: true } : a))
      );
    } catch (error) {
      console.error('Failed to mark alert as read:', error);
    }
  };

  const styles = createStyles(isDark);

  const renderAlert = ({ item: alert }: { item: any }) => {
    const color = severityColors[alert.severity] || severityColors.low;

    return (
      <TouchableOpacity
        style={[styles.alertCard, !alert.isRead && styles.unreadCard]}
        onPress={() => handleMarkAsRead(alert.id)}
        activeOpacity={0.7}
      >
        <View style={[styles.severityIndicator, { backgroundColor: color }]} />
        <View style={styles.alertContent}>
          <View style={styles.alertHeader}>
            <View style={[styles.severityBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.severityText, { color }]}>
                {alert.severity.toUpperCase()}
              </Text>
            </View>
            {!alert.isRead && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.alertTitle}>{alert.title}</Text>
          <Text style={styles.alertMessage} numberOfLines={2}>
            {alert.message}
          </Text>
          <Text style={styles.alertTime}>
            {new Date(alert.createdAt).toLocaleString('pt-BR')}
          </Text>
        </View>
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
        data={alerts}
        renderItem={renderAlert}
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
            <Ionicons name="notifications-off-outline" size={64} color="#64748b" />
            <Text style={styles.emptyTitle}>Nenhum alerta</Text>
            <Text style={styles.emptyText}>
              Todos os sistemas estão funcionando normalmente
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
    alertCard: {
      flexDirection: 'row',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      marginBottom: 12,
      overflow: 'hidden',
    },
    unreadCard: {
      borderLeftWidth: 3,
      borderLeftColor: '#10b981',
    },
    severityIndicator: {
      width: 4,
    },
    alertContent: {
      flex: 1,
      padding: 16,
    },
    alertHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    severityBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    severityText: {
      fontSize: 10,
      fontWeight: 'bold',
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#10b981',
    },
    alertTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 4,
    },
    alertMessage: {
      fontSize: 14,
      color: '#64748b',
      marginBottom: 8,
    },
    alertTime: {
      fontSize: 12,
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
