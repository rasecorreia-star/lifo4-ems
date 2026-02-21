import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Volume2,
  VolumeX,
  Plus,
  Trash2,
  Edit2,
  Play,
  Pause,
  Square,
  Upload,
  Mic,
  Download,
  Camera,
  RefreshCw,
  AlertTriangle,
  Search,
  Clock,
  Check,
  X,
  Settings,
  Send,
  Radio,
} from 'lucide-react';
import { cn, formatDate, formatRelativeTime } from '@/lib/utils';
import api from '@/services/api';

// Types
interface VoiceMessage {
  id: string;
  name: string;
  description?: string;
  duration: number; // seconds
  fileUrl: string;
  fileSize: number; // bytes
  format: 'mp3' | 'wav' | 'ogg';
  category: 'warning' | 'greeting' | 'instruction' | 'emergency' | 'custom';
  isDefault: boolean;
  usageCount: number;
  lastUsed?: string;
  createdAt: string;
  updatedAt: string;
}

interface CameraOption {
  id: string;
  name: string;
  location: string;
  hasTalkback: boolean;
}

interface PlaybackLog {
  id: string;
  messageId: string;
  messageName: string;
  cameraId: string;
  cameraName: string;
  playedAt: string;
  playedBy: string;
}

const CATEGORIES = [
  { value: 'warning', label: 'Aviso', color: 'bg-warning-500' },
  { value: 'greeting', label: 'Saudacao', color: 'bg-success-500' },
  { value: 'instruction', label: 'Instrucao', color: 'bg-primary' },
  { value: 'emergency', label: 'Emergencia', color: 'bg-danger-500' },
  { value: 'custom', label: 'Personalizado', color: 'bg-secondary' },
];

export default function VoiceMessages() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [cameras, setCameras] = useState<CameraOption[]>([]);
  const [playbackLogs, setPlaybackLogs] = useState<PlaybackLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Playback state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<VoiceMessage | null>(null);
  const [selectedCameras, setSelectedCameras] = useState<string[]>([]);

  // Create/Edit form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>('custom');
  const [formFile, setFormFile] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await api.get('/cameras/voice-messages');
      setMessages(response.data.data || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
      setError('Falha ao carregar mensagens.');

      // Mock data
      const mockMessages: VoiceMessage[] = [
        {
          id: 'msg-001',
          name: 'Aviso de Area Restrita',
          description: 'Mensagem padrao para areas de acesso restrito',
          duration: 8,
          fileUrl: '/api/voice-messages/msg-001/audio',
          fileSize: 128000,
          format: 'mp3',
          category: 'warning',
          isDefault: true,
          usageCount: 45,
          lastUsed: new Date(Date.now() - 3600000).toISOString(),
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-15T15:30:00Z',
        },
        {
          id: 'msg-002',
          name: 'Boas-vindas',
          description: 'Mensagem de saudacao para visitantes',
          duration: 5,
          fileUrl: '/api/voice-messages/msg-002/audio',
          fileSize: 80000,
          format: 'mp3',
          category: 'greeting',
          isDefault: true,
          usageCount: 120,
          lastUsed: new Date(Date.now() - 1800000).toISOString(),
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-12T09:00:00Z',
        },
        {
          id: 'msg-003',
          name: 'Alerta de Emergencia',
          description: 'Mensagem de evacuacao de emergencia',
          duration: 15,
          fileUrl: '/api/voice-messages/msg-003/audio',
          fileSize: 240000,
          format: 'mp3',
          category: 'emergency',
          isDefault: true,
          usageCount: 3,
          lastUsed: new Date(Date.now() - 86400000 * 7).toISOString(),
          createdAt: '2024-01-10T10:00:00Z',
          updatedAt: '2024-01-10T10:00:00Z',
        },
        {
          id: 'msg-004',
          name: 'Instrucoes de Estacionamento',
          description: 'Orientacoes para uso do estacionamento',
          duration: 12,
          fileUrl: '/api/voice-messages/msg-004/audio',
          fileSize: 192000,
          format: 'mp3',
          category: 'instruction',
          isDefault: false,
          usageCount: 28,
          lastUsed: new Date(Date.now() - 7200000).toISOString(),
          createdAt: '2024-01-20T14:00:00Z',
          updatedAt: '2024-01-20T14:00:00Z',
        },
      ];
      setMessages(mockMessages);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch cameras with talkback
  const fetchCameras = useCallback(async () => {
    try {
      const response = await api.get('/cameras');
      const camerasData = response.data.data || [];
      setCameras(
        camerasData
          .filter((c: CameraOption) => c.hasTalkback)
          .map((c: CameraOption) => ({
            id: c.id,
            name: c.name,
            location: c.location,
            hasTalkback: c.hasTalkback,
          }))
      );
    } catch (err) {
      // Mock data
      setCameras([
        { id: 'cam-001', name: 'Entrada Principal', location: 'Portao Frontal', hasTalkback: true },
        { id: 'cam-004', name: 'Sala de Controle', location: 'Interior - Sala Tecnica', hasTalkback: true },
      ]);
    }
  }, []);

  // Fetch playback logs
  const fetchPlaybackLogs = useCallback(async () => {
    try {
      const response = await api.get('/cameras/voice-messages/logs', { params: { limit: 10 } });
      setPlaybackLogs(response.data.data || []);
    } catch (err) {
      // Mock data
      setPlaybackLogs([
        {
          id: 'log-001',
          messageId: 'msg-002',
          messageName: 'Boas-vindas',
          cameraId: 'cam-001',
          cameraName: 'Entrada Principal',
          playedAt: new Date(Date.now() - 1800000).toISOString(),
          playedBy: 'admin@lifo4.com',
        },
        {
          id: 'log-002',
          messageId: 'msg-001',
          messageName: 'Aviso de Area Restrita',
          cameraId: 'cam-001',
          cameraName: 'Entrada Principal',
          playedAt: new Date(Date.now() - 3600000).toISOString(),
          playedBy: 'operador@lifo4.com',
        },
      ]);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
    fetchCameras();
    fetchPlaybackLogs();
  }, [fetchMessages, fetchCameras, fetchPlaybackLogs]);

  // Filter messages
  const filteredMessages = messages.filter((message) => {
    const matchesSearch =
      message.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      message.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = categoryFilter === 'all' || message.category === categoryFilter;

    return matchesSearch && matchesCategory;
  });

  // Play message preview
  const handlePlayPreview = (message: VoiceMessage) => {
    if (!audioRef.current) return;

    if (playingMessageId === message.id && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = message.fileUrl;
      audioRef.current.play();
      setPlayingMessageId(message.id);
      setIsPlaying(true);
    }
  };

  // Handle audio events
  const handleAudioEnded = () => {
    setIsPlaying(false);
    setPlayingMessageId(null);
  };

  // Broadcast message to cameras
  const handleBroadcast = async () => {
    if (!selectedMessage || selectedCameras.length === 0) return;

    try {
      await api.post('/cameras/voice-messages/broadcast', {
        messageId: selectedMessage.id,
        cameraIds: selectedCameras,
      });

      // Update usage count
      setMessages((prev) =>
        prev.map((m) =>
          m.id === selectedMessage.id
            ? { ...m, usageCount: m.usageCount + selectedCameras.length, lastUsed: new Date().toISOString() }
            : m
        )
      );

      setIsBroadcastModalOpen(false);
      setSelectedMessage(null);
      setSelectedCameras([]);

      // Refresh logs
      fetchPlaybackLogs();
    } catch (err) {
      console.error('Failed to broadcast message:', err);
      // For demo, update anyway
      setMessages((prev) =>
        prev.map((m) =>
          m.id === selectedMessage.id
            ? { ...m, usageCount: m.usageCount + selectedCameras.length, lastUsed: new Date().toISOString() }
            : m
        )
      );
      setIsBroadcastModalOpen(false);
      setSelectedMessage(null);
      setSelectedCameras([]);
    }
  };

  // Start recording
  const handleStartRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedBlob(blob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      alert('Nao foi possivel acessar o microfone. Verifique as permissoes.');
    }
  };

  // Stop recording
  const handleStopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  // Handle file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormFile(file);
      setRecordedBlob(null);
    }
  };

  // Save message
  const handleSaveMessage = async () => {
    if (!formName || (!formFile && !recordedBlob)) return;

    try {
      const formData = new FormData();
      formData.append('name', formName);
      formData.append('description', formDescription);
      formData.append('category', formCategory);

      if (formFile) {
        formData.append('audio', formFile);
      } else if (recordedBlob) {
        formData.append('audio', recordedBlob, 'recording.webm');
      }

      const response = await api.post('/cameras/voice-messages', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newMessage = response.data.data || {
        id: `msg-${Date.now()}`,
        name: formName,
        description: formDescription,
        duration: 10,
        fileUrl: URL.createObjectURL(formFile || recordedBlob!),
        fileSize: formFile?.size || recordedBlob?.size || 0,
        format: 'mp3',
        category: formCategory,
        isDefault: false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setMessages((prev) => [newMessage, ...prev]);
      resetForm();
      setIsCreateModalOpen(false);
    } catch (err) {
      console.error('Failed to save message:', err);
      // For demo, add mock message
      const newMessage: VoiceMessage = {
        id: `msg-${Date.now()}`,
        name: formName,
        description: formDescription,
        duration: 10,
        fileUrl: formFile ? URL.createObjectURL(formFile) : recordedBlob ? URL.createObjectURL(recordedBlob) : '',
        fileSize: formFile?.size || recordedBlob?.size || 0,
        format: 'mp3',
        category: formCategory as VoiceMessage['category'],
        isDefault: false,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setMessages((prev) => [newMessage, ...prev]);
      resetForm();
      setIsCreateModalOpen(false);
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId: string) => {
    const message = messages.find((m) => m.id === messageId);
    if (message?.isDefault) {
      alert('Mensagens padrao nao podem ser excluidas.');
      return;
    }

    if (!confirm('Tem certeza que deseja excluir esta mensagem?')) return;

    try {
      await api.delete(`/cameras/voice-messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error('Failed to delete message:', err);
      // For demo, remove anyway
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }
  };

  // Reset form
  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('custom');
    setFormFile(null);
    setRecordedBlob(null);
    setIsRecording(false);
    setMediaRecorder(null);
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hidden audio element */}
      <audio ref={audioRef} onEnded={handleAudioEnded} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mensagens de Voz</h1>
          <p className="text-foreground-muted text-sm">
            Gerencie mensagens pre-gravadas para reproducao nas cameras
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/cameras"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-surface hover:bg-surface-hover border border-border text-foreground font-medium rounded-lg transition-colors"
          >
            <Camera className="w-5 h-5" />
            Cameras
          </Link>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nova Mensagem
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Volume2 className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{messages.length}</p>
              <p className="text-sm text-foreground-muted">Total de Mensagens</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Radio className="w-8 h-8 text-secondary" />
            <div>
              <p className="text-2xl font-bold text-foreground">{cameras.length}</p>
              <p className="text-sm text-foreground-muted">Cameras com Talkback</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Play className="w-8 h-8 text-success-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">
                {messages.reduce((acc, m) => acc + m.usageCount, 0)}
              </p>
              <p className="text-sm text-foreground-muted">Total de Reproducoes</p>
            </div>
          </div>
        </div>
        <div className="bg-surface rounded-lg border border-border p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-warning-500" />
            <div>
              <p className="text-2xl font-bold text-foreground">
                {formatDuration(messages.reduce((acc, m) => acc + m.duration, 0))}
              </p>
              <p className="text-sm text-foreground-muted">Duracao Total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Messages List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar mensagens..."
                className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2.5 bg-surface border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">Todas categorias</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>{cat.label}</option>
              ))}
            </select>
          </div>

          {/* Messages */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <MessageSkeleton key={i} />
              ))}
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="bg-surface rounded-xl border border-border p-12 text-center">
              <Volume2 className="w-16 h-16 mx-auto mb-4 text-foreground-subtle opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-2">Nenhuma mensagem encontrada</h3>
              <p className="text-foreground-muted mb-6">
                {searchQuery || categoryFilter !== 'all'
                  ? 'Tente ajustar os filtros de busca'
                  : 'Crie sua primeira mensagem de voz'}
              </p>
              {!searchQuery && categoryFilter === 'all' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Nova Mensagem
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMessages.map((message) => {
                const category = CATEGORIES.find((c) => c.value === message.category);
                const isCurrentlyPlaying = playingMessageId === message.id && isPlaying;

                return (
                  <div
                    key={message.id}
                    className="bg-surface rounded-xl border border-border p-4 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      {/* Play Button */}
                      <button
                        onClick={() => handlePlayPreview(message)}
                        className={cn(
                          'w-12 h-12 rounded-full flex items-center justify-center shrink-0 transition-colors',
                          isCurrentlyPlaying
                            ? 'bg-primary text-white'
                            : 'bg-surface-hover hover:bg-surface-active text-foreground'
                        )}
                      >
                        {isCurrentlyPlaying ? (
                          <Pause className="w-5 h-5" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5" />
                        )}
                      </button>

                      {/* Message Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{message.name}</h3>
                          {message.isDefault && (
                            <span className="px-2 py-0.5 text-2xs rounded-full bg-primary/20 text-primary">
                              Padrao
                            </span>
                          )}
                        </div>

                        {message.description && (
                          <p className="text-sm text-foreground-muted mb-2 line-clamp-1">
                            {message.description}
                          </p>
                        )}

                        <div className="flex items-center gap-3 text-xs text-foreground-subtle">
                          <span className={cn(
                            'px-2 py-0.5 rounded-full text-white',
                            category?.color || 'bg-secondary'
                          )}>
                            {category?.label || message.category}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDuration(message.duration)}
                          </span>
                          <span>{formatFileSize(message.fileSize)}</span>
                          <span>|</span>
                          <span>{message.usageCount} reproducoes</span>
                          {message.lastUsed && (
                            <>
                              <span>|</span>
                              <span>Ultima: {formatRelativeTime(message.lastUsed)}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setSelectedMessage(message);
                            setSelectedCameras([]);
                            setIsBroadcastModalOpen(true);
                          }}
                          className="flex items-center gap-1 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm transition-colors"
                          title="Reproduzir nas cameras"
                        >
                          <Send className="w-4 h-4" />
                          Enviar
                        </button>
                        <a
                          href={message.fileUrl}
                          download={`${message.name}.${message.format}`}
                          className="p-2 bg-surface-hover hover:bg-surface-active rounded-lg text-foreground-muted transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                        {!message.isDefault && (
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="p-2 bg-surface-hover hover:bg-danger-500/20 rounded-lg text-foreground-muted hover:text-danger-500 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Recent Playbacks */}
          <div className="bg-surface border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Reproducoes Recentes</h3>
            </div>
            {playbackLogs.length === 0 ? (
              <div className="p-4 text-center text-foreground-muted">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma reproducao recente</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {playbackLogs.map((log) => (
                  <div key={log.id} className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Volume2 className="w-4 h-4 text-primary" />
                      <span className="font-medium text-foreground text-sm">{log.messageName}</span>
                    </div>
                    <div className="text-xs text-foreground-muted">
                      <p>{log.cameraName}</p>
                      <p className="flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(log.playedAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cameras with Talkback */}
          <div className="bg-surface border border-border rounded-xl">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">Cameras com Talkback</h3>
            </div>
            {cameras.length === 0 ? (
              <div className="p-4 text-center text-foreground-muted">
                <VolumeX className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma camera com talkback</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cameras.map((camera) => (
                  <div key={camera.id} className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-success-500/20 flex items-center justify-center">
                      <Mic className="w-4 h-4 text-success-500" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{camera.name}</p>
                      <p className="text-xs text-foreground-muted">{camera.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="font-semibold text-foreground mb-3">Categorias</h3>
            <div className="space-y-2">
              {CATEGORIES.map((cat) => {
                const count = messages.filter((m) => m.category === cat.value).length;
                return (
                  <div
                    key={cat.value}
                    className="flex items-center justify-between p-2 bg-surface-hover rounded-lg cursor-pointer hover:bg-surface-active transition-colors"
                    onClick={() => setCategoryFilter(cat.value === categoryFilter ? 'all' : cat.value)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('w-3 h-3 rounded-full', cat.color)} />
                      <span className="text-sm text-foreground">{cat.label}</span>
                    </div>
                    <span className="text-sm text-foreground-muted">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Create Message Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Nova Mensagem de Voz</h3>
              <button
                onClick={() => {
                  resetForm();
                  setIsCreateModalOpen(false);
                }}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-2">
                  Nome da Mensagem *
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ex: Aviso de Manutencao"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-2">
                  Descricao (opcional)
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Descreva quando usar esta mensagem..."
                  rows={2}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-2">
                  Categoria
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              {/* Audio Source */}
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-2">
                  Audio *
                </label>
                <div className="space-y-3">
                  {/* Upload */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                      formFile ? 'border-success-500 bg-success-500/10' : 'border-border hover:border-foreground-subtle'
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {formFile ? (
                      <div className="flex items-center justify-center gap-2 text-success-500">
                        <Check className="w-5 h-5" />
                        <span>{formFile.name}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormFile(null);
                          }}
                          className="p-1 hover:bg-success-500/20 rounded"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mx-auto mb-2 text-foreground-muted" />
                        <p className="text-sm text-foreground">Arraste um arquivo ou clique para upload</p>
                        <p className="text-xs text-foreground-muted mt-1">MP3, WAV ou OGG (max 10MB)</p>
                      </>
                    )}
                  </div>

                  {/* Or divider */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-sm text-foreground-muted">ou</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>

                  {/* Record */}
                  <div className="flex items-center justify-center gap-3">
                    {isRecording ? (
                      <button
                        onClick={handleStopRecording}
                        className="flex items-center gap-2 px-4 py-2 bg-danger-500 hover:bg-danger-600 text-white rounded-lg transition-colors"
                      >
                        <Square className="w-4 h-4" />
                        Parar Gravacao
                      </button>
                    ) : recordedBlob ? (
                      <div className="flex items-center gap-2">
                        <span className="text-success-500 flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Gravacao salva
                        </span>
                        <button
                          onClick={() => setRecordedBlob(null)}
                          className="p-1 hover:bg-surface-hover rounded text-foreground-muted"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleStartRecording}
                        className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground rounded-lg transition-colors"
                      >
                        <Mic className="w-4 h-4" />
                        Gravar do Microfone
                      </button>
                    )}
                  </div>

                  {isRecording && (
                    <div className="flex items-center justify-center gap-2 text-danger-500">
                      <span className="w-3 h-3 rounded-full bg-danger-500 animate-pulse" />
                      Gravando...
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => {
                  resetForm();
                  setIsCreateModalOpen(false);
                }}
                className="px-4 py-2 text-foreground-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMessage}
                disabled={!formName || (!formFile && !recordedBlob)}
                className="px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Salvar Mensagem
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Broadcast Modal */}
      {isBroadcastModalOpen && selectedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-surface border border-border rounded-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-semibold text-foreground">Reproduzir Mensagem</h3>
              <button
                onClick={() => {
                  setIsBroadcastModalOpen(false);
                  setSelectedMessage(null);
                  setSelectedCameras([]);
                }}
                className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
              >
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Selected Message */}
              <div className="bg-surface-hover rounded-lg p-3">
                <p className="font-medium text-foreground">{selectedMessage.name}</p>
                <p className="text-sm text-foreground-muted">
                  Duracao: {formatDuration(selectedMessage.duration)}
                </p>
              </div>

              {/* Camera Selection */}
              <div>
                <label className="block text-sm font-medium text-foreground-muted mb-2">
                  Selecione as cameras
                </label>
                {cameras.length === 0 ? (
                  <p className="text-sm text-foreground-muted">Nenhuma camera com talkback disponivel</p>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => {
                        if (selectedCameras.length === cameras.length) {
                          setSelectedCameras([]);
                        } else {
                          setSelectedCameras(cameras.map((c) => c.id));
                        }
                      }}
                      className="text-sm text-primary hover:underline"
                    >
                      {selectedCameras.length === cameras.length ? 'Desmarcar todas' : 'Selecionar todas'}
                    </button>
                    {cameras.map((camera) => (
                      <label
                        key={camera.id}
                        className="flex items-center gap-3 p-3 bg-surface-hover rounded-lg cursor-pointer hover:bg-surface-active transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedCameras.includes(camera.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCameras((prev) => [...prev, camera.id]);
                            } else {
                              setSelectedCameras((prev) => prev.filter((id) => id !== camera.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-border bg-background text-primary focus:ring-primary"
                        />
                        <div>
                          <p className="font-medium text-foreground">{camera.name}</p>
                          <p className="text-xs text-foreground-muted">{camera.location}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
              <button
                onClick={() => {
                  setIsBroadcastModalOpen(false);
                  setSelectedMessage(null);
                  setSelectedCameras([]);
                }}
                className="px-4 py-2 text-foreground-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleBroadcast}
                disabled={selectedCameras.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="w-4 h-4" />
                Reproduzir ({selectedCameras.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Skeleton Component
function MessageSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-4 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-surface-hover shrink-0" />
        <div className="flex-1">
          <div className="h-5 w-48 bg-surface-hover rounded mb-2" />
          <div className="h-4 w-64 bg-surface-hover rounded mb-2" />
          <div className="h-3 w-40 bg-surface-hover rounded" />
        </div>
        <div className="flex gap-2">
          <div className="w-20 h-8 bg-surface-hover rounded" />
          <div className="w-8 h-8 bg-surface-hover rounded" />
        </div>
      </div>
    </div>
  );
}
