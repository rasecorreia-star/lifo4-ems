/**
 * Assistant Page
 * Full-page virtual assistant with chat and voice interface
 * Using Tailwind CSS + Lucide Icons
 */

import React, { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Bot,
  Mic,
  History,
  Lightbulb,
  Settings,
  Battery,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  Cpu,
  Brain,
  RefreshCw
} from 'lucide-react';
import ChatInterface, { ChatMessage, QuickCommand } from '../components/assistant/ChatInterface';
import VoiceInput from '../components/assistant/VoiceInput';

// Quick commands for the assistant
const quickCommands: QuickCommand[] = [
  { icon: <Battery className="w-4 h-4" />, label: 'Status bateria', command: 'qual o status da bateria?' },
  { icon: <TrendingUp className="w-4 h-4" />, label: 'Eficiencia', command: 'como esta a eficiencia do sistema?' },
  { icon: <AlertTriangle className="w-4 h-4" />, label: 'Alertas', command: 'existem alertas ativos?' },
  { icon: <Settings className="w-4 h-4" />, label: 'Configuracoes', command: 'mostrar configuracoes atuais' },
  { icon: <HelpCircle className="w-4 h-4" />, label: 'Ajuda', command: 'o que voce pode fazer?' }
];

// Conversation history item
interface ConversationItem {
  id: string;
  title: string;
  timestamp: Date;
  messageCount: number;
}

const Assistant: React.FC = () => {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [pendingVoiceText, setPendingVoiceText] = useState<string | null>(null);

  // Mock conversation history
  const [conversationHistory] = useState<ConversationItem[]>([
    { id: '1', title: 'Status do sistema', timestamp: new Date(Date.now() - 3600000), messageCount: 5 },
    { id: '2', title: 'Alertas e manutencao', timestamp: new Date(Date.now() - 86400000), messageCount: 8 },
    { id: '3', title: 'Otimizacao de carga', timestamp: new Date(Date.now() - 172800000), messageCount: 12 }
  ]);

  // Handle voice transcript
  const handleVoiceTranscript = useCallback((text: string) => {
    setPendingVoiceText(text);
    setIsListening(false);
  }, []);

  // Handle voice input toggle
  const handleVoiceToggle = () => {
    setIsListening(!isListening);
  };

  // Mock API call for chat
  const handleSendMessage = async (message: string): Promise<ChatMessage> => {
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));

    const responses: Record<string, string> = {
      status: 'O sistema BESS-001 esta operando normalmente com SOC de 78% e potencia de saida de 125 kW.',
      alerta: 'Ha 2 alertas ativos: temperatura elevada no modulo 3 e tensao baixa na celula B12.',
      eficiencia: 'A eficiencia atual e de 94.5%, acima da media mensal de 93.2%.',
      default: 'Entendi sua solicitacao. O sistema esta processando as informacoes.'
    };

    const lowerMessage = message.toLowerCase();
    let responseContent = responses.default;

    if (lowerMessage.includes('status') || lowerMessage.includes('bateria')) {
      responseContent = responses.status;
    } else if (lowerMessage.includes('alerta')) {
      responseContent = responses.alerta;
    } else if (lowerMessage.includes('eficiencia')) {
      responseContent = responses.eficiencia;
    }

    return {
      id: `msg_${Date.now()}`,
      role: 'assistant',
      content: responseContent,
      timestamp: new Date()
    };
  };

  return (
    <div className="p-6 h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-7 h-7 text-primary" />
            Assistente Virtual
          </h1>
          <p className="text-sm text-foreground-muted">
            Assistente inteligente com processamento de linguagem natural
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Voz</span>
          </label>
          <button className="p-2 hover:bg-surface-hover rounded-lg transition-colors">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-80px)]">
        {/* Main Chat Area */}
        <div className="lg:col-span-2 h-full">
          <ChatInterface
            onSendMessage={handleSendMessage}
            onVoiceInput={handleVoiceToggle}
            isVoiceEnabled={voiceEnabled}
            isListening={isListening}
            quickCommands={quickCommands}
            maxHeight="100%"
            welcomeMessage="Ola! Sou o assistente virtual do EMS BESS. Posso ajudar com informacoes sobre o sistema, status das baterias, alertas, otimizacoes e muito mais. Como posso ajudar?"
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4 overflow-y-auto">
          {/* Voice Input Panel */}
          {voiceEnabled && (
            <div className="bg-surface border border-border rounded-lg p-4">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Mic className="w-5 h-5 text-primary" />
                Entrada de Voz
              </h3>
              <VoiceInput
                onTranscript={handleVoiceTranscript}
                onStart={() => setIsListening(true)}
                onStop={() => setIsListening(false)}
                language="pt-BR"
                showWaveform
                autoSubmit={false}
                variant="full"
                size="medium"
              />
              {pendingVoiceText && (
                <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
                  <p className="text-sm">
                    <span className="font-medium">Texto reconhecido:</span> "{pendingVoiceText}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* AI Capabilities */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Capacidades da IA
            </h3>
            <div className="space-y-2">
              {[
                { icon: <Battery className="w-4 h-4" />, title: 'Monitoramento de sistemas', desc: 'Status em tempo real' },
                { icon: <AlertTriangle className="w-4 h-4" />, title: 'Gestao de alertas', desc: 'Notificacoes inteligentes' },
                { icon: <TrendingUp className="w-4 h-4" />, title: 'Analise de performance', desc: 'Metricas e tendencias' },
                { icon: <Lightbulb className="w-4 h-4" />, title: 'Recomendacoes', desc: 'Otimizacoes sugeridas' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 p-2 hover:bg-surface-hover rounded-lg transition-colors">
                  <div className="text-primary mt-0.5">{item.icon}</div>
                  <div>
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-foreground-muted">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Conversation History */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              Historico
            </h3>
            <div className="space-y-2">
              {conversationHistory.map(conv => (
                <button
                  key={conv.id}
                  className="w-full text-left p-3 bg-surface-hover hover:bg-surface-active rounded-lg transition-colors"
                >
                  <p className="text-sm font-medium">{conv.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-foreground-muted">
                      {conv.timestamp.toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded">
                      {conv.messageCount} msgs
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Model Info */}
          <div className="bg-surface border border-border rounded-lg p-4">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-primary" />
              Info do Modelo
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-foreground-muted">Modelo NLP</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">BERT-PT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Intents</span>
                <span>50+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Precisao</span>
                <span>94.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-muted">Latencia</span>
                <span>~120ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Assistant;
