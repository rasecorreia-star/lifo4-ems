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

import { microgridsApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'MicrogridDetail'>;
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
  'grid-connected': 'Conectado a Rede',
  'islanded': 'Modo Ilhado',
  'black-start': 'Black Start',
  'fault': 'Em Falha',
  'transitioning': 'Em Transicao',
};

const MODE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'grid-connected': 'link',
  'islanded': 'cloudy',
  'black-start': 'flash',
  'fault': 'warning',
  'transitioning': 'sync',
};

interface MicrogridComponent {
  id: string;
  type: 'bess' | 'solar' | 'grid' | 'load' | 'generator';
  name: string;
  status: string;
  power: number;
  capacity?: number;
  soc?: number;
}

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
    netPower: number;
  };
  gridConnection: {
    connected: boolean;
    frequency: number;
    voltage: number;
    syncStatus: string;
  };
  components: MicrogridComponent[];
}

export default function MicrogridDetailScreen() {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation<NavigationProp>();
  const { microgridId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [microgrid, setMicrogrid] = useState<Microgrid | null>(null);
  const [changingMode, setChangingMode] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, componentsRes] = await Promise.all([
        microgridsApi.getStatus(microgridId),
        microgridsApi.getComponents(microgridId),
      ]);

      setMicrogrid({
        ...statusRes.data.data,
        components: componentsRes.data.data || [],
      });
    } catch (error) {
      console.error('Failed to fetch microgrid data:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [microgridId]);

  useEffect(() => {
    fetchData();
    // Poll for updates every 10 seconds
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleModeChange = (newMode: string) => {
    if (!microgrid) return;

    const modeLabel = MODE_LABELS[newMode] || newMode;
    const currentModeLabel = MODE_LABELS[microgrid.operatingMode] || microgrid.operatingMode;

    let warningMessage = `Deseja alterar o modo de operacao de "${currentModeLabel}" para "${modeLabel}"?`;

    if (newMode === 'islanded') {
      warningMessage += '\n\nATENCAO: O ilhamento desconectara a microrrede da rede principal.';
    } else if (newMode === 'black-start') {
      warningMessage += '\n\nATENCAO: O Black Start iniciara uma sequencia de partida sem a rede.';
    }

    Alert.alert(
      'Confirmar Alteracao de Modo',
      warningMessage,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          style: newMode === 'islanded' || newMode === 'black-start' ? 'destructive' : 'default',
          onPress: async () => {
            setChangingMode(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            try {
              await microgridsApi.setMode(microgridId, newMode);
              fetchData();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error) {
              console.error('Mode change failed:', error);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              Alert.alert('Erro', 'Falha ao alterar o modo de operacao.');
            } finally {
              setChangingMode(false);
            }
          },
        },
      ]
    );
  };

  const handleControlPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('MicrogridControl', { microgridId });
  };

  const styles = createStyles(isDark);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  if (!microgrid) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#ef4444" />
        <Text style={styles.errorText}>Microrrede nao encontrada</Text>
      </View>
    );
  }

  const modeColor = MODE_COLORS[microgrid.operatingMode] || '#64748b';
  const modeLabel = MODE_LABELS[microgrid.operatingMode] || microgrid.operatingMode;
  const modeIcon = MODE_ICONS[microgrid.operatingMode] || 'help-outline';

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
      {/* Mode Display */}
      <View style={styles.modeContainer}>
        <View style={[styles.modeCircle, { borderColor: modeColor }]}>
          <Ionicons name={modeIcon} size={48} color={modeColor} />
        </View>
        <View style={[styles.modeBadge, { backgroundColor: modeColor + '20' }]}>
          <Text style={[styles.modeLabel, { color: modeColor }]}>{modeLabel}</Text>
        </View>
        <Text style={styles.microgridName}>{microgrid.name}</Text>
        {microgrid.location && (
          <Text style={styles.microgridLocation}>{microgrid.location}</Text>
        )}
      </View>

      {/* Power Flow Diagram (Simplified) */}
      <View style={styles.powerFlowSection}>
        <Text style={styles.sectionTitle}>Fluxo de Potencia</Text>
        <View style={[styles.powerFlowCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.powerFlowRow}>
            {/* Generation */}
            <View style={styles.powerNode}>
              <View style={[styles.powerNodeIcon, { backgroundColor: '#f59e0b20' }]}>
                <Ionicons name="sunny" size={24} color="#f59e0b" />
              </View>
              <Text style={[styles.powerNodeValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {microgrid.powerBalance.generation.toFixed(1)} kW
              </Text>
              <Text style={styles.powerNodeLabel}>Geracao</Text>
            </View>

            {/* Arrow */}
            <View style={styles.powerArrow}>
              <Ionicons name="arrow-forward" size={20} color="#64748b" />
            </View>

            {/* Central Hub */}
            <View style={styles.powerHub}>
              <View style={[styles.hubCircle, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                <Ionicons name="git-network" size={28} color={modeColor} />
              </View>
              <Text style={[styles.hubLabel, { color: modeColor }]}>
                {microgrid.powerBalance.netPower >= 0 ? '+' : ''}
                {microgrid.powerBalance.netPower.toFixed(1)} kW
              </Text>
            </View>

            {/* Arrow */}
            <View style={styles.powerArrow}>
              <Ionicons name="arrow-forward" size={20} color="#64748b" />
            </View>

            {/* Consumption */}
            <View style={styles.powerNode}>
              <View style={[styles.powerNodeIcon, { backgroundColor: '#ef444420' }]}>
                <Ionicons name="flash" size={24} color="#ef4444" />
              </View>
              <Text style={[styles.powerNodeValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {microgrid.powerBalance.consumption.toFixed(1)} kW
              </Text>
              <Text style={styles.powerNodeLabel}>Consumo</Text>
            </View>
          </View>

          {/* Bottom Row - Grid & Storage */}
          <View style={styles.powerFlowBottomRow}>
            {/* Grid */}
            <View style={styles.powerNodeSmall}>
              <View style={[styles.powerNodeIconSmall, { backgroundColor: '#10b98120' }]}>
                <Ionicons
                  name={microgrid.gridConnection.connected ? 'link' : 'unlink'}
                  size={18}
                  color={microgrid.gridConnection.connected ? '#10b981' : '#64748b'}
                />
              </View>
              <Text style={[styles.powerNodeValueSmall, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {microgrid.powerBalance.gridExchange > 0 ? '+' : ''}
                {microgrid.powerBalance.gridExchange.toFixed(1)} kW
              </Text>
              <Text style={styles.powerNodeLabelSmall}>
                Rede {microgrid.powerBalance.gridExchange > 0 ? '(Exp)' : '(Imp)'}
              </Text>
            </View>

            {/* Storage */}
            <View style={styles.powerNodeSmall}>
              <View style={[styles.powerNodeIconSmall, { backgroundColor: '#06b6d420' }]}>
                <Ionicons name="battery-charging" size={18} color="#06b6d4" />
              </View>
              <Text style={[styles.powerNodeValueSmall, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {microgrid.powerBalance.storage > 0 ? '+' : ''}
                {microgrid.powerBalance.storage.toFixed(1)} kW
              </Text>
              <Text style={styles.powerNodeLabelSmall}>
                Armazenamento {microgrid.powerBalance.storage > 0 ? '(Carga)' : '(Desc)'}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Grid Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conexao com a Rede</Text>
        <View style={[styles.gridStatusCard, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
          <View style={styles.gridStatusHeader}>
            <View style={[
              styles.connectionIndicator,
              { backgroundColor: microgrid.gridConnection.connected ? '#10b981' : '#64748b' }
            ]} />
            <Text style={[styles.connectionStatus, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
              {microgrid.gridConnection.connected ? 'Conectado a Rede' : 'Desconectado da Rede'}
            </Text>
          </View>

          <View style={styles.gridMetrics}>
            <View style={styles.gridMetric}>
              <Ionicons name="pulse" size={18} color="#06b6d4" />
              <Text style={[styles.gridMetricValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {microgrid.gridConnection.frequency.toFixed(2)} Hz
              </Text>
              <Text style={styles.gridMetricLabel}>Frequencia</Text>
            </View>
            <View style={styles.gridMetric}>
              <Ionicons name="speedometer" size={18} color="#f59e0b" />
              <Text style={[styles.gridMetricValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {microgrid.gridConnection.voltage.toFixed(0)} V
              </Text>
              <Text style={styles.gridMetricLabel}>Tensao</Text>
            </View>
            <View style={styles.gridMetric}>
              <Ionicons name="sync" size={18} color="#8b5cf6" />
              <Text style={[styles.gridMetricValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                {microgrid.gridConnection.syncStatus === 'synced' ? 'Sincronizado' : 'Dessincronizado'}
              </Text>
              <Text style={styles.gridMetricLabel}>Sincronismo</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Components List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Componentes</Text>
        {microgrid.components.map((component) => (
          <ComponentCard
            key={component.id}
            component={component}
            isDark={isDark}
          />
        ))}
      </View>

      {/* Mode Controls */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Controle de Modo</Text>
        <View style={styles.modeButtonsRow}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              {
                backgroundColor: microgrid.operatingMode === 'grid-connected'
                  ? MODE_COLORS['grid-connected']
                  : isDark ? '#1e293b' : '#ffffff',
                borderColor: MODE_COLORS['grid-connected'],
              }
            ]}
            onPress={() => handleModeChange('grid-connected')}
            disabled={changingMode || microgrid.operatingMode === 'grid-connected'}
          >
            <Ionicons
              name="link"
              size={20}
              color={microgrid.operatingMode === 'grid-connected' ? '#ffffff' : MODE_COLORS['grid-connected']}
            />
            <Text style={[
              styles.modeButtonText,
              { color: microgrid.operatingMode === 'grid-connected' ? '#ffffff' : MODE_COLORS['grid-connected'] }
            ]}>
              Conectar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.modeButton,
              {
                backgroundColor: microgrid.operatingMode === 'islanded'
                  ? MODE_COLORS['islanded']
                  : isDark ? '#1e293b' : '#ffffff',
                borderColor: MODE_COLORS['islanded'],
              }
            ]}
            onPress={() => handleModeChange('islanded')}
            disabled={changingMode || microgrid.operatingMode === 'islanded'}
          >
            <Ionicons
              name="cloudy"
              size={20}
              color={microgrid.operatingMode === 'islanded' ? '#ffffff' : MODE_COLORS['islanded']}
            />
            <Text style={[
              styles.modeButtonText,
              { color: microgrid.operatingMode === 'islanded' ? '#ffffff' : MODE_COLORS['islanded'] }
            ]}>
              Ilhar
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Control Panel Button */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={handleControlPress}
        activeOpacity={0.8}
      >
        <Ionicons name="settings" size={24} color="#ffffff" />
        <Text style={styles.controlButtonText}>Painel de Controle Avancado</Text>
        <Ionicons name="chevron-forward" size={20} color="#ffffff" />
      </TouchableOpacity>
    </ScrollView>
  );
}

// Component Card
function ComponentCard({
  component,
  isDark,
}: {
  component: MicrogridComponent;
  isDark: boolean;
}) {
  const getComponentIcon = (): keyof typeof Ionicons.glyphMap => {
    switch (component.type) {
      case 'bess': return 'battery-charging';
      case 'solar': return 'sunny';
      case 'grid': return 'git-network';
      case 'load': return 'flash';
      case 'generator': return 'construct';
      default: return 'cube';
    }
  };

  const getComponentColor = () => {
    switch (component.type) {
      case 'bess': return '#06b6d4';
      case 'solar': return '#f59e0b';
      case 'grid': return '#10b981';
      case 'load': return '#ef4444';
      case 'generator': return '#8b5cf6';
      default: return '#64748b';
    }
  };

  const color = getComponentColor();
  const isOnline = component.status === 'online' || component.status === 'active';

  return (
    <View style={[componentStyles.card, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
      <View style={[componentStyles.iconContainer, { backgroundColor: color + '20' }]}>
        <Ionicons name={getComponentIcon()} size={20} color={color} />
      </View>
      <View style={componentStyles.info}>
        <Text style={[componentStyles.name, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
          {component.name}
        </Text>
        <View style={componentStyles.statusRow}>
          <View style={[componentStyles.statusDot, { backgroundColor: isOnline ? '#10b981' : '#64748b' }]} />
          <Text style={componentStyles.statusText}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>
      </View>
      <View style={componentStyles.powerInfo}>
        <Text style={[componentStyles.powerValue, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
          {component.power.toFixed(1)} kW
        </Text>
        {component.soc !== undefined && (
          <Text style={componentStyles.socText}>{component.soc}% SOC</Text>
        )}
      </View>
    </View>
  );
}

const componentStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  statusText: {
    fontSize: 11,
    color: '#64748b',
  },
  powerInfo: {
    alignItems: 'flex-end',
  },
  powerValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  socText: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
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
    modeContainer: {
      alignItems: 'center',
      marginBottom: 24,
    },
    modeCircle: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 4,
      marginBottom: 16,
    },
    modeBadge: {
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 20,
      marginBottom: 8,
    },
    modeLabel: {
      fontSize: 14,
      fontWeight: '600',
      textTransform: 'uppercase',
    },
    microgridName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginTop: 8,
    },
    microgridLocation: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4,
    },
    powerFlowSection: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 12,
    },
    powerFlowCard: {
      borderRadius: 16,
      padding: 20,
    },
    powerFlowRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    powerNode: {
      alignItems: 'center',
      flex: 1,
    },
    powerNodeIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    powerNodeValue: {
      fontSize: 14,
      fontWeight: '600',
      marginTop: 8,
    },
    powerNodeLabel: {
      fontSize: 10,
      color: '#64748b',
      marginTop: 2,
    },
    powerArrow: {
      paddingHorizontal: 4,
    },
    powerHub: {
      alignItems: 'center',
      flex: 1,
    },
    hubCircle: {
      width: 60,
      height: 60,
      borderRadius: 30,
      justifyContent: 'center',
      alignItems: 'center',
    },
    hubLabel: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 8,
    },
    powerFlowBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: '#33415530',
    },
    powerNodeSmall: {
      alignItems: 'center',
    },
    powerNodeIconSmall: {
      width: 36,
      height: 36,
      borderRadius: 18,
      justifyContent: 'center',
      alignItems: 'center',
    },
    powerNodeValueSmall: {
      fontSize: 12,
      fontWeight: '600',
      marginTop: 6,
    },
    powerNodeLabelSmall: {
      fontSize: 9,
      color: '#64748b',
      marginTop: 2,
    },
    section: {
      marginBottom: 24,
    },
    gridStatusCard: {
      borderRadius: 16,
      padding: 16,
    },
    gridStatusHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    connectionIndicator: {
      width: 12,
      height: 12,
      borderRadius: 6,
      marginRight: 10,
    },
    connectionStatus: {
      fontSize: 16,
      fontWeight: '600',
    },
    gridMetrics: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    gridMetric: {
      alignItems: 'center',
      flex: 1,
    },
    gridMetricValue: {
      fontSize: 14,
      fontWeight: '600',
      marginTop: 6,
    },
    gridMetricLabel: {
      fontSize: 10,
      color: '#64748b',
      marginTop: 2,
    },
    modeButtonsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    modeButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 12,
      borderWidth: 2,
    },
    modeButtonText: {
      fontSize: 14,
      fontWeight: '600',
    },
    controlButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#10b981',
      padding: 16,
      borderRadius: 16,
      marginBottom: 24,
    },
    controlButtonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
      flex: 1,
    },
  });
