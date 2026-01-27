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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { prospectsApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Pipeline stage types and colors
type PipelineStage = 'lead' | 'qualified' | 'analysis' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string }> = {
  lead: { label: 'Lead', color: '#64748b' },
  qualified: { label: 'Qualificado', color: '#3b82f6' },
  analysis: { label: 'Analise', color: '#06b6d4' },
  proposal: { label: 'Proposta', color: '#8b5cf6' },
  negotiation: { label: 'Negociacao', color: '#f59e0b' },
  closed_won: { label: 'Fechado', color: '#10b981' },
  closed_lost: { label: 'Perdido', color: '#ef4444' },
};

const FILTER_OPTIONS: { value: PipelineStage | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'lead', label: 'Leads' },
  { value: 'qualified', label: 'Qualificados' },
  { value: 'analysis', label: 'Em Analise' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'negotiation', label: 'Negociacao' },
  { value: 'closed_won', label: 'Fechados' },
];

interface Prospect {
  id: string;
  name: string;
  company: string;
  phone?: string;
  email?: string;
  stage: PipelineStage;
  analyzerKit?: {
    id: string;
    status: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface Statistics {
  total: number;
  inAnalysis: number;
  proposalsSent: number;
  byStage: Record<PipelineStage, number>;
}

export default function ProspectsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [filteredProspects, setFilteredProspects] = useState<Prospect[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<PipelineStage | 'all'>('all');

  const fetchData = useCallback(async () => {
    try {
      const [prospectsRes, statsRes] = await Promise.all([
        prospectsApi.getAll(),
        prospectsApi.getStatistics(),
      ]);

      setProspects(prospectsRes.data.data || []);
      setStatistics(statsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch prospects data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter prospects based on search and stage filter
  useEffect(() => {
    let filtered = prospects;

    // Apply stage filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter((p) => p.stage === selectedFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.company.toLowerCase().includes(query) ||
          p.email?.toLowerCase().includes(query) ||
          p.phone?.includes(query)
      );
    }

    setFilteredProspects(filtered);
  }, [prospects, searchQuery, selectedFilter]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleProspectPress = (prospectId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.navigate('ProspectDetail', { prospectId });
  };

  const handleFilterPress = (filter: PipelineStage | 'all') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedFilter(filter);
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
          <Text style={styles.title}>Prospectos</Text>
          <Text style={styles.subtitle}>Pipeline de pre-vendas</Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="people"
            title="Total"
            value={statistics?.total || 0}
            color="#3b82f6"
            isDark={isDark}
          />
          <StatCard
            icon="analytics"
            title="Em Analise"
            value={statistics?.inAnalysis || 0}
            color="#06b6d4"
            isDark={isDark}
          />
          <StatCard
            icon="document-text"
            title="Propostas"
            value={statistics?.proposalsSent || 0}
            color="#8b5cf6"
            isDark={isDark}
          />
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search-outline" size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nome, empresa, email..."
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#64748b" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterContainer}
          contentContainerStyle={styles.filterContent}
        >
          {FILTER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.filterPill,
                selectedFilter === option.value && styles.filterPillActive,
              ]}
              onPress={() => handleFilterPress(option.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === option.value && styles.filterTextActive,
                ]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Prospects List */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {filteredProspects.length} prospecto{filteredProspects.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {filteredProspects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={48} color="#64748b" />
              <Text style={styles.emptyText}>Nenhum prospecto encontrado</Text>
            </View>
          ) : (
            filteredProspects.map((prospect) => (
              <TouchableOpacity
                key={prospect.id}
                style={styles.prospectCard}
                onPress={() => handleProspectPress(prospect.id)}
                activeOpacity={0.7}
              >
                <View style={styles.prospectInfo}>
                  <View style={styles.prospectIcon}>
                    <Ionicons name="person" size={24} color="#10b981" />
                  </View>
                  <View style={styles.prospectDetails}>
                    <Text style={styles.prospectName}>{prospect.name}</Text>
                    <Text style={styles.prospectCompany}>{prospect.company}</Text>
                    <View style={styles.prospectMeta}>
                      <StageBadge stage={prospect.stage} />
                      {prospect.analyzerKit && (
                        <View style={styles.analyzerBadge}>
                          <Ionicons name="hardware-chip-outline" size={12} color="#06b6d4" />
                          <Text style={styles.analyzerText}>Kit</Text>
                        </View>
                      )}
                    </View>
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

// Stage Badge Component
function StageBadge({ stage }: { stage: PipelineStage }) {
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.lead;

  return (
    <View style={[badgeStyles.badge, { backgroundColor: config.color + '20' }]}>
      <View style={[badgeStyles.dot, { backgroundColor: config.color }]} />
      <Text style={[badgeStyles.text, { color: config.color }]}>{config.label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: '600',
  },
});

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
    minWidth: '30%',
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
      fontSize: 28,
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
      gap: 12,
      marginBottom: 24,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
      gap: 12,
    },
    searchInput: {
      flex: 1,
      fontSize: 16,
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    filterContainer: {
      marginBottom: 16,
    },
    filterContent: {
      gap: 8,
    },
    filterPill: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      marginRight: 8,
    },
    filterPillActive: {
      backgroundColor: '#10b981',
    },
    filterText: {
      fontSize: 14,
      color: '#64748b',
      fontWeight: '500',
    },
    filterTextActive: {
      color: '#ffffff',
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
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
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
    prospectCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      marginBottom: 12,
    },
    prospectInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    prospectIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: '#10b981' + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    prospectDetails: {
      flex: 1,
    },
    prospectName: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    prospectCompany: {
      fontSize: 13,
      color: '#64748b',
      marginTop: 2,
    },
    prospectMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 8,
      gap: 8,
    },
    analyzerBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#06b6d4' + '20',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    analyzerText: {
      fontSize: 10,
      fontWeight: '600',
      color: '#06b6d4',
    },
  });
