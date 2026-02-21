import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { microgridsApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'MicrogridControl'>;

// Operating mode colors
const MODE_COLORS = {
  'grid-connected': '#10b981',  // Green
  'islanded': '#f59e0b',        // Orange
  'black-start': '#06b6d4',     // Blue
  'fault': '#ef4444',           // Red
  'transitioning': '#8b5cf6',   // Purple
};

interface BlackStartStep {
  id: number;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress?: number;
}

interface LoadSheddingTier {
  id: number;
  name: string;
  description: string;
  power: number;
  priority: number;
  active: boolean;
}

interface MicrogridStatus {
  operatingMode: keyof typeof MODE_COLORS;
  gridConnection: {
    connected: boolean;
    frequency: number;
    voltage: number;
    syncReady: boolean;
  };
  blackStartProgress?: {
    active: boolean;
    currentStep: number;
    steps: BlackStartStep[];
  };
  loadShedding: {
    active: boolean;
    tiers: LoadSheddingTier[];
  };
}

export default function MicrogridControlScreen() {
  const route = useRoute<RouteParams>();
  const { microgridId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<MicrogridStatus | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await microgridsApi.getStatus(microgridId);
      setStatus(response.data.data);
    } catch (error) {
      console.error('Failed to fetch microgrid status:', error);
    } finally {
      setIsLoading(false);
    }
  }, [microgridId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const confirmAction = (
    title: string,
    message: string,
    onConfirm: () => void,
    destructive = false
  ) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ]
    );
  };

  const handleInitiateIslanding = () => {
    confirmAction(
      'Iniciar Ilhamento',
      'ATENCAO: Esta acao ira desconectar a microrrede da rede eletrica principal.\n\n' +
      'A microrrede passara a operar de forma autonoma usando recursos locais de geracao e armazenamento.\n\n' +
      'Deseja continuar?',
      async () => {
        setActionInProgress('islanding');
        try {
          await microgridsApi.initiateIslanding(microgridId, 'Manual islanding from mobile app');
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchData();
        } catch (error) {
          console.error('Islanding failed:', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Erro', 'Falha ao iniciar ilhamento. Verifique os logs do sistema.');
        } finally {
          setActionInProgress(null);
        }
      },
      true
    );
  };

  const handleReconnectToGrid = () => {
    const syncReady = status?.gridConnection.syncReady;

    confirmAction(
      'Reconectar a Rede',
      syncReady
        ? 'A microrrede esta sincronizada e pronta para reconexao.\n\nDeseja reconectar a rede eletrica principal?'
        : 'ATENCAO: A microrrede ainda nao esta totalmente sincronizada.\n\n' +
          'Frequencia: ' + status?.gridConnection.frequency.toFixed(2) + ' Hz\n' +
          'Tensao: ' + status?.gridConnection.voltage.toFixed(0) + ' V\n\n' +
          'Deseja forcar a reconexao?',
      async () => {
        setActionInProgress('reconnect');
        try {
          await microgridsApi.reconnectToGrid(microgridId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchData();
        } catch (error) {
          console.error('Reconnection failed:', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Erro', 'Falha ao reconectar a rede. Verifique a sincronizacao.');
        } finally {
          setActionInProgress(null);
        }
      },
      !syncReady
    );
  };

  const handleInitiateBlackStart = () => {
    confirmAction(
      'Iniciar Black Start',
      'ATENCAO: O procedimento de Black Start sera iniciado.\n\n' +
      'Este processo ira:\n' +
      '1. Verificar recursos de geracao disponiveis\n' +
      '2. Iniciar geradores de partida\n' +
      '3. Estabilizar frequencia e tensao\n' +
      '4. Reconectar cargas gradualmente\n\n' +
      'Este procedimento pode levar varios minutos. Deseja continuar?',
      async () => {
        setActionInProgress('blackstart');
        try {
          await microgridsApi.initiateBlackStart(microgridId);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          fetchData();
        } catch (error) {
          console.error('Black start failed:', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          Alert.alert('Erro', 'Falha ao iniciar Black Start. Verifique os recursos disponiveis.');
        } finally {
          setActionInProgress(null);
        }
      },
      true
    );
  };

  const handleToggleLoadTier = async (tierId: number, activate: boolean) => {
    const tier = status?.loadShedding.tiers.find(t => t.id === tierId);
    if (!tier) return;

    const action = activate ? 'reconectar' : 'desconectar';
    confirmAction(
      `${activate ? 'Reconectar' : 'Desconectar'} Carga`,
      `Deseja ${action} "${tier.name}" (${tier.power.toFixed(1)} kW)?`,
      async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
          // This would be a specific API call to toggle load tier
          // For now, we'll just refresh the data
          fetchData();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.error('Load tier toggle failed:', error);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
      },
      !activate
    );
  };

  const styles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!status) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Falha ao carregar status</Text>
      </View>
    );
  }

  const modeColor = MODE_COLORS[status.operatingMode] || '#64748b';
  const isIslanded = status.operatingMode === 'islanded';
  const isBlackStartActive = status.blackStartProgress?.active;
  const isGridConnected = status.operatingMode === 'grid-connected';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Current Status Banner */}
      <View style={[styles.statusBanner, { backgroundColor: modeColor + '20', borderColor: modeColor }]}>
        <View style={styles.statusBannerContent}>
          <View style={[styles.statusIndicator, { backgroundColor: modeColor }]} />
          <Text style={[styles.statusText, { color: modeColor }]}>
            {status.operatingMode === 'grid-connected' && 'Conectado a Rede'}
            {status.operatingMode === 'islanded' && 'Operando Ilhado'}
            {status.operatingMode === 'black-start' && 'Black Start em Progresso'}
            {status.operatingMode === 'fault' && 'Falha no Sistema'}
            {status.operatingMode === 'transitioning' && 'Em Transicao'}
          </Text>
        </View>
        {!status.gridConnection.connected && (
          <Text style={styles.statusSubtext}>Rede eletrica indisponivel</Text>
        )}
      </View>

      {/* Islanding Control */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Controle de Ilhamento</Text>
        <View style={[styles.controlCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.controlInfo}>
            <View style={[styles.controlIconContainer, { backgroundColor: '#f59e0b20' }]}>
              <Ionicons name="cloudy" size={28} color="#f59e0b" />
            </View>
            <View style={styles.controlTextContainer}>
              <Text style={[styles.controlTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Ilhamento Manual
              </Text>
              <Text style={styles.controlDescription}>
                Desconectar da rede e operar de forma autonoma
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isIslanded ? '#64748b' : '#f59e0b' },
              actionInProgress === 'islanding' && styles.actionButtonDisabled,
            ]}
            onPress={handleInitiateIslanding}
            disabled={isIslanded || actionInProgress !== null}
          >
            {actionInProgress === 'islanding' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="log-out" size={18} color="#ffffff" />
                <Text style={styles.actionButtonText}>
                  {isIslanded ? 'Ja Ilhado' : 'Ilhar'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Grid Reconnection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reconexao a Rede</Text>
        <View style={[styles.controlCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.controlInfo}>
            <View style={[styles.controlIconContainer, { backgroundColor: '#10b98120' }]}>
              <Ionicons name="link" size={28} color="#10b981" />
            </View>
            <View style={styles.controlTextContainer}>
              <Text style={[styles.controlTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Reconectar a Rede
              </Text>
              <Text style={styles.controlDescription}>
                Sincronizar e reconectar a rede eletrica principal
              </Text>
            </View>
          </View>

          {/* Sync Status */}
          <View style={styles.syncStatusRow}>
            <View style={styles.syncMetric}>
              <Text style={styles.syncLabel}>Frequencia</Text>
              <Text style={[styles.syncValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {status.gridConnection.frequency.toFixed(2)} Hz
              </Text>
            </View>
            <View style={styles.syncMetric}>
              <Text style={styles.syncLabel}>Tensao</Text>
              <Text style={[styles.syncValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {status.gridConnection.voltage.toFixed(0)} V
              </Text>
            </View>
            <View style={styles.syncMetric}>
              <Text style={styles.syncLabel}>Sincronismo</Text>
              <View style={[
                styles.syncBadge,
                { backgroundColor: status.gridConnection.syncReady ? '#10b98120' : '#f59e0b20' }
              ]}>
                <Text style={[
                  styles.syncBadgeText,
                  { color: status.gridConnection.syncReady ? '#10b981' : '#f59e0b' }
                ]}>
                  {status.gridConnection.syncReady ? 'Pronto' : 'Aguardando'}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isGridConnected ? '#64748b' : '#10b981' },
              actionInProgress === 'reconnect' && styles.actionButtonDisabled,
            ]}
            onPress={handleReconnectToGrid}
            disabled={isGridConnected || actionInProgress !== null || !status.gridConnection.connected}
          >
            {actionInProgress === 'reconnect' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="log-in" size={18} color="#ffffff" />
                <Text style={styles.actionButtonText}>
                  {isGridConnected ? 'Ja Conectado' : 'Reconectar'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Black Start Sequence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Black Start</Text>
        <View style={[styles.controlCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.controlInfo}>
            <View style={[styles.controlIconContainer, { backgroundColor: '#06b6d420' }]}>
              <Ionicons name="flash" size={28} color="#06b6d4" />
            </View>
            <View style={styles.controlTextContainer}>
              <Text style={[styles.controlTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                Sequencia de Black Start
              </Text>
              <Text style={styles.controlDescription}>
                Partida do sistema sem auxilio da rede externa
              </Text>
            </View>
          </View>

          {/* Black Start Steps */}
          {isBlackStartActive && status.blackStartProgress && (
            <View style={styles.blackStartSteps}>
              {status.blackStartProgress.steps.map((step, index) => (
                <View key={step.id} style={styles.stepRow}>
                  <View style={[
                    styles.stepIndicator,
                    {
                      backgroundColor:
                        step.status === 'completed' ? '#10b981' :
                        step.status === 'in-progress' ? '#06b6d4' :
                        step.status === 'failed' ? '#ef4444' : '#64748b40',
                    }
                  ]}>
                    {step.status === 'completed' && (
                      <Ionicons name="checkmark" size={12} color="#ffffff" />
                    )}
                    {step.status === 'in-progress' && (
                      <ActivityIndicator size="small" color="#ffffff" />
                    )}
                    {step.status === 'failed' && (
                      <Ionicons name="close" size={12} color="#ffffff" />
                    )}
                    {step.status === 'pending' && (
                      <Text style={styles.stepNumber}>{index + 1}</Text>
                    )}
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={[
                      styles.stepName,
                      { color: isDark ? '#f8fafc' : '#0f172a' },
                      step.status === 'pending' && styles.stepNamePending,
                    ]}>
                      {step.name}
                    </Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                    {step.status === 'in-progress' && step.progress !== undefined && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${step.progress}%` }]} />
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: isBlackStartActive ? '#64748b' : '#06b6d4' },
              actionInProgress === 'blackstart' && styles.actionButtonDisabled,
            ]}
            onPress={handleInitiateBlackStart}
            disabled={isBlackStartActive || isGridConnected || actionInProgress !== null}
          >
            {actionInProgress === 'blackstart' ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="play" size={18} color="#ffffff" />
                <Text style={styles.actionButtonText}>
                  {isBlackStartActive ? 'Em Progresso' : 'Iniciar Black Start'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Load Shedding Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Controle de Cargas</Text>
        <View style={[styles.loadSheddingCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.loadSheddingHeader}>
            <Text style={[styles.loadSheddingTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              Gerenciamento de Demanda
            </Text>
            <View style={[
              styles.loadSheddingBadge,
              { backgroundColor: status.loadShedding.active ? '#f59e0b20' : '#10b98120' }
            ]}>
              <Text style={[
                styles.loadSheddingBadgeText,
                { color: status.loadShedding.active ? '#f59e0b' : '#10b981' }
              ]}>
                {status.loadShedding.active ? 'Ativo' : 'Normal'}
              </Text>
            </View>
          </View>

          {status.loadShedding.tiers.map((tier) => (
            <View key={tier.id} style={styles.tierRow}>
              <View style={styles.tierInfo}>
                <View style={styles.tierPriority}>
                  <Text style={styles.tierPriorityText}>P{tier.priority}</Text>
                </View>
                <View style={styles.tierDetails}>
                  <Text style={[styles.tierName, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {tier.name}
                  </Text>
                  <Text style={styles.tierDescription}>{tier.description}</Text>
                  <Text style={styles.tierPower}>{tier.power.toFixed(1)} kW</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.tierToggle,
                  { backgroundColor: tier.active ? '#10b981' : '#64748b40' }
                ]}
                onPress={() => handleToggleLoadTier(tier.id, !tier.active)}
              >
                <View style={[
                  styles.tierToggleKnob,
                  { alignSelf: tier.active ? 'flex-end' : 'flex-start' }
                ]} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.loadSheddingInfo}>
            <Ionicons name="information-circle-outline" size={16} color="#64748b" />
            <Text style={styles.loadSheddingInfoText}>
              Desative cargas de menor prioridade para reduzir demanda em situacoes de emergencia.
            </Text>
          </View>
        </View>
      </View>

      {/* Safety Warning */}
      <View style={[styles.safetyWarning, { backgroundColor: '#ef444420' }]}>
        <Ionicons name="warning" size={24} color="#ef4444" />
        <View style={styles.safetyWarningContent}>
          <Text style={styles.safetyWarningTitle}>Atencao</Text>
          <Text style={styles.safetyWarningText}>
            Estas acoes podem afetar o fornecimento de energia.
            Execute apenas sob orientacao de pessoal qualificado.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

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
    statusBanner: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      marginBottom: 24,
    },
    statusBannerContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statusIndicator: {
      width: 10,
      height: 10,
      borderRadius: 5,
      marginRight: 10,
    },
    statusText: {
      fontSize: 16,
      fontWeight: '600',
    },
    statusSubtext: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 4,
      marginLeft: 20,
    },
    section: {
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 12,
    },
    controlCard: {
      borderRadius: 16,
      padding: 16,
    },
    controlInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    controlIconContainer: {
      width: 56,
      height: 56,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    controlTextContainer: {
      flex: 1,
    },
    controlTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    controlDescription: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
    syncStatusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 12,
      marginBottom: 12,
      borderTopWidth: 1,
      borderTopColor: '#33415530',
    },
    syncMetric: {
      alignItems: 'center',
    },
    syncLabel: {
      fontSize: 10,
      color: '#64748b',
      marginBottom: 4,
    },
    syncValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    syncBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 8,
    },
    syncBadgeText: {
      fontSize: 12,
      fontWeight: '600',
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 12,
    },
    actionButtonDisabled: {
      opacity: 0.6,
    },
    actionButtonText: {
      color: '#ffffff',
      fontSize: 14,
      fontWeight: '600',
    },
    blackStartSteps: {
      marginBottom: 16,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: '#33415530',
    },
    stepRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    stepIndicator: {
      width: 24,
      height: 24,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    stepNumber: {
      fontSize: 12,
      fontWeight: '600',
      color: '#64748b',
    },
    stepContent: {
      flex: 1,
    },
    stepName: {
      fontSize: 14,
      fontWeight: '600',
    },
    stepNamePending: {
      opacity: 0.5,
    },
    stepDescription: {
      fontSize: 11,
      color: '#64748b',
      marginTop: 2,
    },
    progressBar: {
      height: 4,
      backgroundColor: '#33415530',
      borderRadius: 2,
      marginTop: 8,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: '#06b6d4',
      borderRadius: 2,
    },
    loadSheddingCard: {
      borderRadius: 16,
      padding: 16,
    },
    loadSheddingHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    loadSheddingTitle: {
      fontSize: 16,
      fontWeight: '600',
    },
    loadSheddingBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    loadSheddingBadgeText: {
      fontSize: 11,
      fontWeight: '600',
    },
    tierRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: '#33415530',
    },
    tierInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    tierPriority: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#33415530',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    tierPriorityText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#64748b',
    },
    tierDetails: {
      flex: 1,
    },
    tierName: {
      fontSize: 14,
      fontWeight: '500',
    },
    tierDescription: {
      fontSize: 11,
      color: '#64748b',
      marginTop: 1,
    },
    tierPower: {
      fontSize: 11,
      color: '#64748b',
      marginTop: 2,
    },
    tierToggle: {
      width: 48,
      height: 28,
      borderRadius: 14,
      padding: 2,
      justifyContent: 'center',
    },
    tierToggleKnob: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: '#ffffff',
    },
    loadSheddingInfo: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingTop: 16,
      marginTop: 8,
      borderTopWidth: 1,
      borderTopColor: '#33415530',
      gap: 8,
    },
    loadSheddingInfoText: {
      flex: 1,
      fontSize: 11,
      color: '#64748b',
      lineHeight: 16,
    },
    safetyWarning: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: 16,
      borderRadius: 12,
      marginBottom: 24,
      gap: 12,
    },
    safetyWarningContent: {
      flex: 1,
    },
    safetyWarningTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#ef4444',
    },
    safetyWarningText: {
      fontSize: 12,
      color: '#ef4444',
      marginTop: 4,
      lineHeight: 18,
    },
  });
