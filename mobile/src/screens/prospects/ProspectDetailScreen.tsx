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
  Linking,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { prospectsApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'ProspectDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Pipeline stage types and colors
type PipelineStage = 'lead' | 'qualified' | 'analysis' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; icon: string }> = {
  lead: { label: 'Lead', color: '#64748b', icon: 'person-add-outline' },
  qualified: { label: 'Qualificado', color: '#3b82f6', icon: 'checkmark-circle-outline' },
  analysis: { label: 'Analise', color: '#06b6d4', icon: 'analytics-outline' },
  proposal: { label: 'Proposta', color: '#8b5cf6', icon: 'document-text-outline' },
  negotiation: { label: 'Negociacao', color: '#f59e0b', icon: 'swap-horizontal-outline' },
  closed_won: { label: 'Fechado', color: '#10b981', icon: 'trophy-outline' },
  closed_lost: { label: 'Perdido', color: '#ef4444', icon: 'close-circle-outline' },
};

const PIPELINE_STAGES: PipelineStage[] = ['lead', 'qualified', 'analysis', 'proposal', 'negotiation', 'closed_won'];

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
    installationDate?: string;
    daysElapsed?: number;
    totalDays?: number;
  };
  address?: string;
  notes?: Note[];
  activities?: Activity[];
  createdAt: string;
  updatedAt: string;
}

interface Note {
  id: string;
  content: string;
  category: 'call' | 'visit' | 'email' | 'other';
  createdAt: string;
  createdBy?: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user?: string;
}

export default function ProspectDetailScreen() {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const { prospectId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [prospect, setProspect] = useState<Prospect | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const [prospectRes, notesRes, activitiesRes] = await Promise.all([
        prospectsApi.getById(prospectId),
        prospectsApi.getNotes(prospectId),
        prospectsApi.getActivities(prospectId),
      ]);

      setProspect(prospectRes.data.data);
      setNotes(notesRes.data.data || []);
      setActivities(activitiesRes.data.data || []);
    } catch (error) {
      console.error('Failed to fetch prospect data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [prospectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleCall = () => {
    if (prospect?.phone) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Linking.openURL(`tel:${prospect.phone}`);
    }
  };

  const handleEmail = () => {
    if (prospect?.email) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Linking.openURL(`mailto:${prospect.email}`);
    }
  };

  const handleAddNote = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('QuickNote', { prospectId });
  };

  const handleViewAnalyzer = () => {
    if (prospect?.analyzerKit) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      navigation.navigate('AnalyzerStatus', { prospectId, kitId: prospect.analyzerKit.id });
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

  if (!prospect) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Prospecto nao encontrado</Text>
      </View>
    );
  }

  const currentStageIndex = PIPELINE_STAGES.indexOf(prospect.stage);

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
      {/* Contact Info Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>
            {prospect.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
          </Text>
        </View>
        <Text style={styles.prospectName}>{prospect.name}</Text>
        <Text style={styles.prospectCompany}>{prospect.company}</Text>

        {/* Contact Details */}
        <View style={styles.contactInfo}>
          {prospect.phone && (
            <View style={styles.contactRow}>
              <Ionicons name="call-outline" size={16} color="#64748b" />
              <Text style={styles.contactText}>{prospect.phone}</Text>
            </View>
          )}
          {prospect.email && (
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={16} color="#64748b" />
              <Text style={styles.contactText}>{prospect.email}</Text>
            </View>
          )}
          {prospect.address && (
            <View style={styles.contactRow}>
              <Ionicons name="location-outline" size={16} color="#64748b" />
              <Text style={styles.contactText}>{prospect.address}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Pipeline Stage */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estagio do Pipeline</Text>
        <View style={styles.pipelineCard}>
          <View style={styles.pipelineStages}>
            {PIPELINE_STAGES.map((stage, index) => {
              const isActive = index <= currentStageIndex;
              const isCurrent = stage === prospect.stage;
              const config = STAGE_CONFIG[stage];

              return (
                <View key={stage} style={styles.stageItem}>
                  <View
                    style={[
                      styles.stageCircle,
                      isActive && { backgroundColor: config.color },
                      !isActive && { backgroundColor: isDark ? '#334155' : '#e2e8f0' },
                    ]}
                  >
                    {isCurrent ? (
                      <Ionicons name={config.icon as any} size={16} color="#ffffff" />
                    ) : isActive ? (
                      <Ionicons name="checkmark" size={14} color="#ffffff" />
                    ) : null}
                  </View>
                  {index < PIPELINE_STAGES.length - 1 && (
                    <View
                      style={[
                        styles.stageLine,
                        isActive && { backgroundColor: config.color },
                        !isActive && { backgroundColor: isDark ? '#334155' : '#e2e8f0' },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.currentStage}>
            <View
              style={[
                styles.currentStageBadge,
                { backgroundColor: STAGE_CONFIG[prospect.stage].color + '20' },
              ]}
            >
              <Ionicons
                name={STAGE_CONFIG[prospect.stage].icon as any}
                size={20}
                color={STAGE_CONFIG[prospect.stage].color}
              />
              <Text
                style={[
                  styles.currentStageText,
                  { color: STAGE_CONFIG[prospect.stage].color },
                ]}
              >
                {STAGE_CONFIG[prospect.stage].label}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Analyzer Kit Status */}
      {prospect.analyzerKit && (
        <TouchableOpacity
          style={styles.analyzerCard}
          onPress={handleViewAnalyzer}
          activeOpacity={0.7}
        >
          <View style={styles.analyzerHeader}>
            <View style={styles.analyzerIconContainer}>
              <Ionicons name="hardware-chip" size={24} color="#06b6d4" />
            </View>
            <View style={styles.analyzerInfo}>
              <Text style={styles.analyzerTitle}>Kit Analisador</Text>
              <Text style={styles.analyzerSubtitle}>ID: {prospect.analyzerKit.id}</Text>
            </View>
            <View style={[
              styles.analyzerStatus,
              { backgroundColor: prospect.analyzerKit.status === 'active' ? '#10b981' + '20' : '#f59e0b' + '20' }
            ]}>
              <Text style={[
                styles.analyzerStatusText,
                { color: prospect.analyzerKit.status === 'active' ? '#10b981' : '#f59e0b' }
              ]}>
                {prospect.analyzerKit.status === 'active' ? 'Ativo' : 'Pendente'}
              </Text>
            </View>
          </View>
          {prospect.analyzerKit.daysElapsed !== undefined && prospect.analyzerKit.totalDays && (
            <View style={styles.analyzerProgress}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(prospect.analyzerKit.daysElapsed / prospect.analyzerKit.totalDays) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {prospect.analyzerKit.daysElapsed} de {prospect.analyzerKit.totalDays} dias
              </Text>
            </View>
          )}
          <View style={styles.analyzerAction}>
            <Text style={styles.analyzerActionText}>Ver detalhes do analisador</Text>
            <Ionicons name="chevron-forward" size={16} color="#06b6d4" />
          </View>
        </TouchableOpacity>
      )}

      {/* Notes Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notas</Text>
          <TouchableOpacity onPress={handleAddNote}>
            <Ionicons name="add-circle" size={24} color="#10b981" />
          </TouchableOpacity>
        </View>
        {notes.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={32} color="#64748b" />
            <Text style={styles.emptyText}>Nenhuma nota registrada</Text>
          </View>
        ) : (
          notes.slice(0, 3).map((note) => (
            <NoteCard key={note.id} note={note} isDark={isDark} />
          ))
        )}
      </View>

      {/* Activities Timeline */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Atividades</Text>
        {activities.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color="#64748b" />
            <Text style={styles.emptyText}>Nenhuma atividade registrada</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {activities.slice(0, 5).map((activity, index) => (
              <ActivityItem
                key={activity.id}
                activity={activity}
                isLast={index === Math.min(activities.length, 5) - 1}
                isDark={isDark}
              />
            ))}
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleAddNote}
          activeOpacity={0.8}
        >
          <Ionicons name="create-outline" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>Nota</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.callButton]}
          onPress={handleCall}
          activeOpacity={0.8}
          disabled={!prospect.phone}
        >
          <Ionicons name="call" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>Ligar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.emailButton]}
          onPress={handleEmail}
          activeOpacity={0.8}
          disabled={!prospect.email}
        >
          <Ionicons name="mail" size={20} color="#ffffff" />
          <Text style={styles.actionButtonText}>Email</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Note Card Component
function NoteCard({ note, isDark }: { note: Note; isDark: boolean }) {
  const categoryIcons: Record<string, string> = {
    call: 'call-outline',
    visit: 'walk-outline',
    email: 'mail-outline',
    other: 'document-text-outline',
  };

  const categoryLabels: Record<string, string> = {
    call: 'Ligacao',
    visit: 'Visita',
    email: 'Email',
    other: 'Outro',
  };

  return (
    <View style={[noteStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <View style={noteStyles.header}>
        <View style={noteStyles.category}>
          <Ionicons
            name={categoryIcons[note.category] as any}
            size={14}
            color="#64748b"
          />
          <Text style={noteStyles.categoryText}>{categoryLabels[note.category]}</Text>
        </View>
        <Text style={noteStyles.date}>
          {new Date(note.createdAt).toLocaleDateString('pt-BR')}
        </Text>
      </View>
      <Text style={[noteStyles.content, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
        {note.content}
      </Text>
    </View>
  );
}

const noteStyles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  category: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    color: '#64748b',
  },
  date: {
    fontSize: 12,
    color: '#64748b',
  },
  content: {
    fontSize: 14,
    lineHeight: 20,
  },
});

// Activity Item Component
function ActivityItem({
  activity,
  isLast,
  isDark,
}: {
  activity: Activity;
  isLast: boolean;
  isDark: boolean;
}) {
  return (
    <View style={activityStyles.item}>
      <View style={activityStyles.timeline}>
        <View style={activityStyles.dot} />
        {!isLast && <View style={activityStyles.line} />}
      </View>
      <View style={[activityStyles.content, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
        <Text style={[activityStyles.description, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
          {activity.description}
        </Text>
        <Text style={activityStyles.timestamp}>
          {new Date(activity.timestamp).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

const activityStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
  },
  timeline: {
    width: 24,
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981',
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: '#10b981' + '40',
    marginVertical: 4,
  },
  content: {
    flex: 1,
    marginLeft: 12,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
  },
  description: {
    fontSize: 14,
  },
  timestamp: {
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
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
    },
    avatarContainer: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#10b981',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#ffffff',
    },
    prospectName: {
      fontSize: 22,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    prospectCompany: {
      fontSize: 16,
      color: '#64748b',
      marginTop: 4,
    },
    contactInfo: {
      marginTop: 16,
      width: '100%',
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
    },
    contactText: {
      fontSize: 14,
      color: isDark ? '#f8fafc' : '#0f172a',
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
    pipelineCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 20,
    },
    pipelineStages: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    stageItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    stageCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stageLine: {
      width: 24,
      height: 3,
      borderRadius: 1.5,
    },
    currentStage: {
      alignItems: 'center',
    },
    currentStageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 8,
    },
    currentStageText: {
      fontSize: 16,
      fontWeight: '600',
    },
    analyzerCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: '#06b6d4' + '40',
    },
    analyzerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    analyzerIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 12,
      backgroundColor: '#06b6d4' + '20',
      justifyContent: 'center',
      alignItems: 'center',
    },
    analyzerInfo: {
      flex: 1,
      marginLeft: 12,
    },
    analyzerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    analyzerSubtitle: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
    analyzerStatus: {
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
    },
    analyzerStatusText: {
      fontSize: 12,
      fontWeight: '600',
    },
    analyzerProgress: {
      marginTop: 16,
    },
    progressBar: {
      height: 6,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#06b6d4',
      borderRadius: 3,
    },
    progressText: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 8,
      textAlign: 'center',
    },
    analyzerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#e2e8f0',
    },
    analyzerActionText: {
      fontSize: 14,
      color: '#06b6d4',
      fontWeight: '500',
    },
    emptyState: {
      alignItems: 'center',
      padding: 24,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 12,
    },
    emptyText: {
      color: '#64748b',
      marginTop: 8,
      fontSize: 14,
    },
    timeline: {
      marginTop: 4,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 32,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10b981',
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    callButton: {
      backgroundColor: '#3b82f6',
    },
    emailButton: {
      backgroundColor: '#8b5cf6',
    },
    actionButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
  });
