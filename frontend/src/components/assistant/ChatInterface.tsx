/**
 * Chat Interface Component
 * Full-featured chat interface for the NLP virtual assistant
 * Using Tailwind CSS + Lucide Icons
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Send,
  Mic,
  MicOff,
  Bot,
  User,
  Copy,
  Check,
  Trash2,
  History,
  Lightbulb,
  Battery,
  TrendingUp,
  AlertTriangle,
  Settings,
  HelpCircle,
  Loader2
} from 'lucide-react';

// Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  intent?: string;
  entities?: Record<string, string | number>;
  actions?: ChatAction[];
  isTyping?: boolean;
}

export interface ChatAction {
  label: string;
  action: string;
  params?: Record<string, unknown>;
}

export interface QuickCommand {
  icon: React.ReactNode;
  label: string;
  command: string;
}

interface ChatInterfaceProps {
  onSendMessage?: (message: string) => Promise<ChatMessage>;
  onVoiceInput?: () => void;
  isVoiceEnabled?: boolean;
  isListening?: boolean;
  placeholder?: string;
  welcomeMessage?: string;
  quickCommands?: QuickCommand[];
  maxHeight?: number | string;
}

// Default quick commands
const defaultQuickCommands: QuickCommand[] = [
  { icon: <Battery className="w-4 h-4" />, label: 'Status bateria', command: 'qual o status da bateria?' },
  { icon: <TrendingUp className="w-4 h-4" />, label: 'Eficiencia', command: 'como esta a eficiencia do sistema?' },
  { icon: <AlertTriangle className="w-4 h-4" />, label: 'Alertas', command: 'existem alertas ativos?' },
  { icon: <Settings className="w-4 h-4" />, label: 'Configuracoes', command: 'mostrar configuracoes atuais' },
  { icon: <HelpCircle className="w-4 h-4" />, label: 'Ajuda', command: 'o que voce pode fazer?' }
];

// Utility functions
const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

// Mock AI response function (replace with actual API call)
const mockAIResponse = async (userMessage: string): Promise<ChatMessage> => {
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1500));

  const responses: Record<string, { content: string; intent: string; actions?: ChatAction[] }> = {
    'status': {
      content: 'O sistema BESS-001 esta operando normalmente. SOC atual: 78%, potencia de saida: 125 kW. Temperatura dentro dos parametros normais.',
      intent: 'query_status',
      actions: [
        { label: 'Ver detalhes', action: 'navigate', params: { path: '/systems/BESS-001' } },
        { label: 'Historico', action: 'navigate', params: { path: '/analytics' } }
      ]
    },
    'alerta': {
      content: 'Existem 2 alertas ativos: 1) Temperatura elevada no modulo 3 (45.2C) - severidade media. 2) Tensao baixa na celula B12 - severidade baixa.',
      intent: 'query_alerts',
      actions: [
        { label: 'Ver alertas', action: 'navigate', params: { path: '/alerts' } }
      ]
    },
    'eficiencia': {
      content: 'A eficiencia atual do sistema e de 94.5%, acima da media mensal de 93.2%. O round-trip efficiency esta em 91.8%.',
      intent: 'query_efficiency'
    },
    'ajuda': {
      content: 'Posso ajudar com: consultar status do sistema, verificar alertas, mostrar metricas de eficiencia, otimizar operacoes, gerar relatorios e muito mais. Experimente perguntar sobre qualquer aspecto do seu sistema BESS!',
      intent: 'help'
    },
    'default': {
      content: 'Entendi sua solicitacao. Estou processando as informacoes do sistema para fornecer uma resposta precisa.',
      intent: 'general'
    }
  };

  const lowerMessage = userMessage.toLowerCase();
  let response = responses['default'];

  if (lowerMessage.includes('status') || lowerMessage.includes('bateria')) {
    response = responses['status'];
  } else if (lowerMessage.includes('alerta') || lowerMessage.includes('aviso')) {
    response = responses['alerta'];
  } else if (lowerMessage.includes('eficiencia') || lowerMessage.includes('desempenho')) {
    response = responses['eficiencia'];
  } else if (lowerMessage.includes('ajuda') || lowerMessage.includes('fazer')) {
    response = responses['ajuda'];
  }

  return {
    id: generateId(),
    role: 'assistant',
    content: response.content,
    timestamp: new Date(),
    intent: response.intent,
    actions: response.actions
  };
};

// Components
const MessageBubble: React.FC<{
  message: ChatMessage;
  onCopy?: () => void;
  onActionClick?: (action: ChatAction) => void;
}> = ({ message, onActionClick }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isSystem) {
    return (
      <div className="text-center my-4">
        <span className="inline-block px-3 py-1 text-xs bg-surface-hover rounded-full text-foreground-muted">
          {message.content}
        </span>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2 mb-4', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
        isUser ? 'bg-secondary' : 'bg-primary'
      )}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      <div className="max-w-[70%]">
        <div className={cn(
          'p-3 rounded-lg',
          isUser
            ? 'bg-primary text-white rounded-tr-none'
            : 'bg-surface border border-border rounded-tl-none'
        )}>
          {message.isTyping ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Digitando...</span>
            </div>
          ) : (
            <>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {message.intent && !isUser && (
                <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded">
                  {message.intent}
                </span>
              )}

              {message.actions && message.actions.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {message.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={() => onActionClick?.(action)}
                      className={cn(
                        'px-3 py-1 text-xs rounded border transition-colors',
                        isUser
                          ? 'border-white/50 text-white hover:bg-white/10'
                          : 'border-primary text-primary hover:bg-primary/10'
                      )}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 px-1">
          <span className="text-xs text-foreground-muted">
            {formatTimestamp(message.timestamp)}
          </span>
          {!isUser && !message.isTyping && (
            <button
              onClick={handleCopy}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
              title={copied ? 'Copiado!' : 'Copiar'}
            >
              {copied ? (
                <Check className="w-3 h-3 text-success-500" />
              ) : (
                <Copy className="w-3 h-3 text-foreground-muted" />
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const QuickCommandsPanel: React.FC<{
  commands: QuickCommand[];
  onSelect: (command: string) => void;
  visible: boolean;
}> = ({ commands, onSelect, visible }) => {
  if (!visible) return null;

  return (
    <div className="mb-4 p-3 bg-surface border border-border rounded-lg">
      <div className="flex items-center gap-2 text-xs text-foreground-muted mb-2">
        <Lightbulb className="w-3 h-3" />
        <span>Comandos rapidos</span>
      </div>
      <div className="space-y-1">
        {commands.map((cmd, index) => (
          <button
            key={index}
            onClick={() => onSelect(cmd.command)}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left hover:bg-surface-hover rounded-lg transition-colors"
          >
            <span className="text-primary">{cmd.icon}</span>
            <div>
              <div className="font-medium">{cmd.label}</div>
              <div className="text-xs text-foreground-muted">{cmd.command}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Main Component
const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  onVoiceInput,
  isVoiceEnabled = true,
  isListening = false,
  placeholder = 'Digite sua mensagem...',
  welcomeMessage = 'Ola! Sou o assistente virtual do EMS. Como posso ajudar?',
  quickCommands = defaultQuickCommands,
  maxHeight = 500
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: generateId(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showQuickCommands, setShowQuickCommands] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowQuickCommands(false);
    setIsLoading(true);

    // Add typing indicator
    const typingMessage: ChatMessage = {
      id: 'typing',
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isTyping: true
    };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const response = onSendMessage
        ? await onSendMessage(userMessage.content)
        : await mockAIResponse(userMessage.content);

      setMessages(prev => prev.filter(m => m.id !== 'typing').concat(response));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== 'typing').concat({
        id: generateId(),
        role: 'assistant',
        content: 'Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente.',
        timestamp: new Date()
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickCommand = (command: string) => {
    setInput(command);
    inputRef.current?.focus();
  };

  const handleClearChat = () => {
    setMessages([{
      id: generateId(),
      role: 'assistant',
      content: welcomeMessage,
      timestamp: new Date()
    }]);
    setShowQuickCommands(true);
  };

  const handleActionClick = (action: ChatAction) => {
    console.log('Action clicked:', action);
    if (action.action === 'navigate' && action.params?.path) {
      window.location.href = action.params.path as string;
    }
  };

  return (
    <div
      className="flex flex-col bg-surface border border-border rounded-xl overflow-hidden shadow-lg"
      style={{ height: '100%', maxHeight }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-primary text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-dark flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">Assistente EMS</h3>
            <p className="text-xs opacity-80">
              {isLoading ? 'Processando...' : 'Online'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Historico"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={handleClearChat}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Limpar conversa"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 bg-background">
        <QuickCommandsPanel
          commands={quickCommands}
          onSelect={handleQuickCommand}
          visible={showQuickCommands && messages.length <= 1}
        />

        {messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            onActionClick={handleActionClick}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface border-t border-border">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            className="flex-1 px-4 py-2 text-sm bg-background border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            disabled={isLoading}
            rows={1}
            style={{ maxHeight: '120px' }}
          />

          {isVoiceEnabled && (
            <button
              onClick={onVoiceInput}
              className={cn(
                'p-3 rounded-xl transition-colors',
                isListening
                  ? 'bg-danger-500 text-white'
                  : 'bg-surface-hover hover:bg-surface-active'
              )}
              title={isListening ? 'Parar gravacao' : 'Entrada de voz'}
            >
              {isListening ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
          )}

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-3 rounded-xl transition-colors',
              input.trim() && !isLoading
                ? 'bg-primary text-white hover:bg-primary-dark'
                : 'bg-surface-hover text-foreground-muted cursor-not-allowed'
            )}
            title="Enviar"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
