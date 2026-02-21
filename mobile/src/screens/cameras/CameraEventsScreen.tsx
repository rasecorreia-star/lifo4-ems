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
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { camerasApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'CameraEvents'>;

// Event types
type EventType = 'motion' | 'person' | 'zone' | 'offline' | 'alert' | 'all';

interface CameraEvent {
  id: string;
  cameraId: string;
  cameraName: string;
  type: Exclude<EventType, 'all'>;
  title: string;
  description?: string;
  timestamp: string;
  thumbnailUrl?: string;
  severity?: 'low' | 'medium' | 'high';
  acknowledged?: boolean;
}

// Filter Button Component
function FilterButton({
  label,
  icon,
  isActive,
  color,
  onPress,
  isDark,
}: {
  label: string;
  icon: string;
  isActive: boolean;
  color: string;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        filterStyles.button,
        { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
        isActive && { backgroundColor: color + '20', borderColor: color, borderWidth: 1 },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name={icon as any}
        size={16}
        color={isActive ? color : '#64748b'}
      />
      <Text
        style={[
          filterStyles.label,
          { color: isActive ? color : '#64748b' },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

// Event Card Component
function EventCard({
  event,
  isDark,
  onPress,
}: {
  event: CameraEvent;
  isDark: boolean;
  onPress: () => void;
}) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'motion':
        return 'walk-outline';
      case 'person':
        return 'person-outline';
      case 'zone':
        return 'location-outline';
      case 'offline':
        return 'cloud-offline-outline';
      case 'alert':
        return 'warning-outline';
      default:
        return 'information-outline';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'motion':
        return '#06b6d4';
      case 'person':
        return '#8b5cf6';
      case 'zone':
        return '#f59e0b';
      case 'offline':
        return '#64748b';
      case 'alert':
        return '#ef4444';
      default:
        return '#64748b';
    }
  };

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'motion':
        return 'Movimento';
      case 'person':
        return 'Pessoa';
      case 'zone':
        return 'Zona';
      case 'offline':
        return 'Offline';
      case 'alert':
        return 'Alerta';
      default:
        return 'Evento';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#64748b';
    }
  };

  const formatDateTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
      return `Hoje, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isYesterday) {
      return `Ontem, ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    }

    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const eventColor = getEventColor(event.type);

  return (
    <TouchableOpacity
      style={[
        eventStyles.card,
        { backgroundColor: isDark ? '#1e293b' : '#ffffff' },
        !event.acknowledged && eventStyles.unacknowledged,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Thumbnail */}
      <View style={eventStyles.thumbnailContainer}>
        {event.thumbnailUrl ? (
          <Image
            source={{ uri: event.thumbnailUrl }}
            style={eventStyles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={[eventStyles.thumbnailPlaceholder, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
            <Ionicons name={getEventIcon(event.type) as any} size={24} color={eventColor} />
          </View>
        )}

        {/* Event Type Badge */}
        <View style={[eventStyles.typeBadge, { backgroundColor: eventColor }]}>
          <Ionicons name={getEventIcon(event.type) as any} size={12} color="#ffffff" />
        </View>
      </View>

      {/* Event Info */}
      <View style={eventStyles.infoContainer}>
        <View style={eventStyles.headerRow}>
          <Text style={[eventStyles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]} numberOfLines={1}>
            {event.title}
          </Text>
          {event.severity && (
            <View style={[eventStyles.severityDot, { backgroundColor: getSeverityColor(event.severity) }]} />
          )}
        </View>

        <Text style={eventStyles.cameraName} numberOfLines={1}>
          {event.cameraName}
        </Text>

        {event.description && (
          <Text style={eventStyles.description} numberOfLines={2}>
            {event.description}
          </Text>
        )}

        <View style={eventStyles.footerRow}>
          <View style={[eventStyles.typeLabel, { backgroundColor: eventColor + '20' }]}>
            <Text style={[eventStyles.typeLabelText, { color: eventColor }]}>
              {getEventTypeLabel(event.type)}
            </Text>
          </View>
          <Text style={eventStyles.timestamp}>{formatDateTime(event.timestamp)}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={20} color="#64748b" />
    </TouchableOpacity>
  );
}

// Date Header Component
function DateHeader({ date, isDark }: { date: string; isDark: boolean }) {
  return (
    <View style={[dateStyles.container, { backgroundColor: isDark ? '#0f172a' : '#f8fafc' }]}>
      <Text style={[dateStyles.text, { color: isDark ? '#94a3b8' : '#64748b' }]}>{date}</Text>
    </View>
  );
}

export default function CameraEventsScreen() {
  const route = useRoute<RouteParams>();
  const cameraId = route.params?.cameraId;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<CameraEvent[]>([]);
  const [activeFilter, setActiveFilter] = useState<EventType>('all');
  const [selectedEvent, setSelectedEvent] = useState<CameraEvent | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const params: any = { limit: 50 };
      if (cameraId) {
        params.cameraId = cameraId;
      }
      if (activeFilter !== 'all') {
        params.type = activeFilter;
      }

      const response = await camerasApi.getAllEvents(params);
      setEvents(response.data.data || []);
    } catch (error) {
      console.error('Falha ao carregar eventos:', error);
      // Mock data for development
      const mockEvents: CameraEvent[] = [
        {
          id: '1',
          cameraId: '1',
          cameraName: 'Entrada Principal',
          type: 'person',
          title: 'Pessoa detectada na entrada',
          description: 'Movimento detectado na area de acesso principal.',
          timestamp: new Date().toISOString(),
          severity: 'medium',
          acknowledged: false,
        },
        {
          id: '2',
          cameraId: '1',
          cameraName: 'Entrada Principal',
          type: 'motion',
          title: 'Movimento detectado',
          timestamp: new Date(Date.now() - 300000).toISOString(),
          acknowledged: true,
        },
        {
          id: '3',
          cameraId: '2',
          cameraName: 'Estacionamento',
          type: 'zone',
          title: 'Alerta de zona restrita',
          description: 'Acesso nao autorizado detectado na zona B.',
          timestamp: new Date(Date.now() - 600000).toISOString(),
          severity: 'high',
          acknowledged: false,
        },
        {
          id: '4',
          cameraId: '3',
          cameraName: 'Sala de Baterias',
          type: 'alert',
          title: 'Alerta de seguranca',
          description: 'Temperatura elevada detectada na area.',
          timestamp: new Date(Date.now() - 1200000).toISOString(),
          severity: 'high',
          acknowledged: false,
        },
        {
          id: '5',
          cameraId: '4',
          cameraName: 'Corredor Norte',
          type: 'offline',
          title: 'Camera offline',
          description: 'Conexao perdida com o dispositivo.',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          acknowledged: true,
        },
        {
          id: '6',
          cameraId: '1',
          cameraName: 'Entrada Principal',
          type: 'person',
          title: 'Pessoa detectada',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          acknowledged: true,
        },
        {
          id: '7',
          cameraId: '2',
          cameraName: 'Estacionamento',
          type: 'motion',
          title: 'Movimento no estacionamento',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          acknowledged: true,
        },
        {
          id: '8',
          cameraId: '3',
          cameraName: 'Sala de Baterias',
          type: 'person',
          title: 'Pessoa na sala tecnica',
          timestamp: new Date(Date.now() - 86400000 - 3600000).toISOString(),
          severity: 'low',
          acknowledged: true,
        },
      ];

      // Filter mock data
      const filtered = activeFilter === 'all'
        ? mockEvents
        : mockEvents.filter((e) => e.type === activeFilter);

      setEvents(filtered);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [cameraId, activeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    fetchData();
  }, [fetchData]);

  const handleFilterPress = (filter: EventType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilter(filter);
  };

  const handleEventPress = (event: CameraEvent) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedEvent(event);
    setShowEventModal(true);
  };

  const handleAcknowledge = async () => {
    if (!selectedEvent) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await camerasApi.acknowledgeEvent(selectedEvent.id);
      // Update local state
      setEvents((prev) =>
        prev.map((e) =>
          e.id === selectedEvent.id ? { ...e, acknowledged: true } : e
        )
      );
      setShowEventModal(false);
    } catch (error) {
      console.error('Falha ao confirmar evento:', error);
    }
  };

  const screenStyles = createStyles(isDark);

  // Group events by date
  const groupedEvents = events.reduce((acc, event) => {
    const date = new Date(event.timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let dateKey: string;
    if (date.toDateString() === today.toDateString()) {
      dateKey = 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      dateKey = 'Ontem';
    } else {
      dateKey = date.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      });
    }

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(event);
    return acc;
  }, {} as Record<string, CameraEvent[]>);

  const flatData = Object.entries(groupedEvents).flatMap(([date, items]) => [
    { type: 'header' as const, date },
    ...items.map((item) => ({ type: 'event' as const, ...item })),
  ]);

  if (isLoading) {
    return (
      <View style={screenStyles.loadingContainer}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <SafeAreaView style={screenStyles.container} edges={['left', 'right']}>
      {/* Filters */}
      <View style={screenStyles.filtersContainer}>
        <Text style={[screenStyles.filtersTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
          Filtrar por tipo
        </Text>
        <View style={screenStyles.filtersRow}>
          <FilterButton
            label="Todos"
            icon="apps"
            isActive={activeFilter === 'all'}
            color="#10b981"
            onPress={() => handleFilterPress('all')}
            isDark={isDark}
          />
          <FilterButton
            label="Pessoa"
            icon="person-outline"
            isActive={activeFilter === 'person'}
            color="#8b5cf6"
            onPress={() => handleFilterPress('person')}
            isDark={isDark}
          />
          <FilterButton
            label="Movimento"
            icon="walk-outline"
            isActive={activeFilter === 'motion'}
            color="#06b6d4"
            onPress={() => handleFilterPress('motion')}
            isDark={isDark}
          />
        </View>
        <View style={screenStyles.filtersRow}>
          <FilterButton
            label="Zona"
            icon="location-outline"
            isActive={activeFilter === 'zone'}
            color="#f59e0b"
            onPress={() => handleFilterPress('zone')}
            isDark={isDark}
          />
          <FilterButton
            label="Alerta"
            icon="warning-outline"
            isActive={activeFilter === 'alert'}
            color="#ef4444"
            onPress={() => handleFilterPress('alert')}
            isDark={isDark}
          />
          <FilterButton
            label="Offline"
            icon="cloud-offline-outline"
            isActive={activeFilter === 'offline'}
            color="#64748b"
            onPress={() => handleFilterPress('offline')}
            isDark={isDark}
          />
        </View>
      </View>

      {/* Events List */}
      {events.length === 0 ? (
        <View style={screenStyles.emptyState}>
          <Ionicons name="calendar-outline" size={64} color="#64748b" />
          <Text style={screenStyles.emptyTitle}>Nenhum evento encontrado</Text>
          <Text style={screenStyles.emptySubtitle}>
            Nao ha eventos {activeFilter !== 'all' ? `do tipo "${activeFilter}"` : ''} registrados.
          </Text>
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item, index) =>
            item.type === 'header' ? `header-${item.date}` : `event-${(item as any).id}`
          }
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <DateHeader date={item.date} isDark={isDark} />;
            }
            return (
              <EventCard
                event={item as CameraEvent}
                isDark={isDark}
                onPress={() => handleEventPress(item as CameraEvent)}
              />
            );
          }}
          contentContainerStyle={screenStyles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#10b981"
            />
          }
        />
      )}

      {/* Event Detail Modal */}
      <Modal
        visible={showEventModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEventModal(false)}
      >
        <View style={modalStyles.overlay}>
          <View style={[modalStyles.container, { backgroundColor: isDark ? '#1e293b' : '#ffffff' }]}>
            {selectedEvent && (
              <>
                {/* Modal Header */}
                <View style={modalStyles.header}>
                  <Text style={[modalStyles.title, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    Detalhes do Evento
                  </Text>
                  <TouchableOpacity onPress={() => setShowEventModal(false)}>
                    <Ionicons name="close" size={24} color={isDark ? '#f8fafc' : '#0f172a'} />
                  </TouchableOpacity>
                </View>

                {/* Thumbnail */}
                {selectedEvent.thumbnailUrl ? (
                  <Image
                    source={{ uri: selectedEvent.thumbnailUrl }}
                    style={modalStyles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[modalStyles.thumbnailPlaceholder, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}>
                    <Ionicons name="image-outline" size={48} color="#64748b" />
                  </View>
                )}

                {/* Event Info */}
                <View style={modalStyles.infoSection}>
                  <Text style={[modalStyles.eventTitle, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                    {selectedEvent.title}
                  </Text>
                  <Text style={modalStyles.eventCamera}>{selectedEvent.cameraName}</Text>
                  {selectedEvent.description && (
                    <Text style={[modalStyles.eventDescription, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                      {selectedEvent.description}
                    </Text>
                  )}
                  <Text style={modalStyles.eventTime}>
                    {new Date(selectedEvent.timestamp).toLocaleString('pt-BR')}
                  </Text>
                </View>

                {/* Actions */}
                <View style={modalStyles.actions}>
                  {!selectedEvent.acknowledged && (
                    <TouchableOpacity
                      style={modalStyles.acknowledgeButton}
                      onPress={handleAcknowledge}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
                      <Text style={modalStyles.acknowledgeText}>Confirmar Leitura</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[modalStyles.closeButton, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
                    onPress={() => setShowEventModal(false)}
                  >
                    <Text style={[modalStyles.closeText, { color: isDark ? '#f8fafc' : '#0f172a' }]}>
                      Fechar
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const filterStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});

const eventStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  unacknowledged: {
    borderLeftWidth: 3,
    borderLeftColor: '#10b981',
  },
  thumbnailContainer: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 12,
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  severityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cameraName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  typeLabel: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  typeLabelText: {
    fontSize: 10,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 10,
    color: '#64748b',
  },
});

const dateStyles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  thumbnail: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  thumbnailPlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  infoSection: {
    marginBottom: 24,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  eventCamera: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
  eventTime: {
    fontSize: 12,
    color: '#64748b',
  },
  actions: {
    gap: 12,
  },
  acknowledgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 16,
  },
  acknowledgeText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
  },
  closeText: {
    fontSize: 16,
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
    filtersContainer: {
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#334155' : '#e2e8f0',
    },
    filtersTitle: {
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 12,
    },
    filtersRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 8,
    },
    listContent: {
      paddingVertical: 8,
    },
    emptyState: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginTop: 16,
    },
    emptySubtitle: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 8,
      textAlign: 'center',
    },
  });
