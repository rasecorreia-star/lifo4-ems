/**
 * Help Center Page
 * In-app documentation, FAQ, and support resources
 */

import { useState } from 'react';
import {
  HelpCircle,
  Search,
  Book,
  MessageCircle,
  Video,
  FileText,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Mail,
  Phone,
  Clock,
  Zap,
  Battery,
  Settings,
  AlertTriangle,
  TrendingUp,
  Shield,
  Wrench,
  Users,
  PlayCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
}

interface DocSection {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  articles: Array<{ title: string; url: string }>;
}

const faqItems: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'Geral',
    question: 'O que e o Lifo4 EMS?',
    answer: 'O Lifo4 EMS (Energy Management System) e uma plataforma completa para gerenciamento de sistemas de armazenamento de energia por bateria (BESS). Ele permite monitorar, controlar e otimizar o uso de baterias de litio em aplicacoes residenciais, comerciais e industriais.',
  },
  {
    id: 'faq-2',
    category: 'Geral',
    question: 'Quais tipos de bateria sao suportados?',
    answer: 'O sistema suporta baterias de Litio-Ferro-Fosfato (LiFePO4), Niquel-Manganes-Cobalto (NMC) e Niquel-Cobalto-Aluminio (NCA). A configuracao pode ser adaptada para diferentes quimicas e configuracoes de celulas.',
  },
  {
    id: 'faq-3',
    category: 'Conexao',
    question: 'Como conectar um novo sistema BESS?',
    answer: 'Para conectar um novo sistema: 1) Va em Sistemas > Novo Sistema; 2) Preencha as informacoes do BMS e bateria; 3) Configure a conexao Modbus TCP ou RTU; 4) Teste a comunicacao e salve. O sistema ira sincronizar automaticamente.',
  },
  {
    id: 'faq-4',
    category: 'Conexao',
    question: 'Meu sistema aparece como offline. O que fazer?',
    answer: 'Verifique: 1) Se o BMS esta ligado e funcionando; 2) A conexao de rede (cabo ou WiFi); 3) As configuracoes de IP e porta Modbus; 4) Se o firewall permite a comunicacao. Use a pagina de Hardware para diagnosticar a conexao.',
  },
  {
    id: 'faq-5',
    category: 'Operacao',
    question: 'Como funciona o modo de otimizacao automatica?',
    answer: 'O modo automatico analisa as tarifas de energia, previsao solar e padroes de consumo para decidir quando carregar e descarregar. Ele prioriza: 1) Seguranca da bateria; 2) Maximizacao de economia; 3) Reducao de picos de demanda.',
  },
  {
    id: 'faq-6',
    category: 'Operacao',
    question: 'Posso agendar horarios de carga e descarga?',
    answer: 'Sim! Use a pagina de Agendamentos do sistema. Voce pode criar regras baseadas em horario, dia da semana, tarifa ou nivel de SOC. Os agendamentos sao executados automaticamente pelo BMS.',
  },
  {
    id: 'faq-7',
    category: 'Alertas',
    question: 'Quais alertas sao considerados criticos?',
    answer: 'Alertas criticos incluem: sobrecorrente, sobretemperatura (>45°C), subtensao de celula (<2.5V), sobretensao (>3.65V) e falha de comunicacao prolongada. Esses alertas podem acionar parada de emergencia.',
  },
  {
    id: 'faq-8',
    category: 'Alertas',
    question: 'Como configurar notificacoes?',
    answer: 'Acesse Configuracoes > Notificacoes. Voce pode ativar alertas por email, SMS, push e webhook. Tambem e possivel configurar horario de silencio e filtrar por severidade.',
  },
  {
    id: 'faq-9',
    category: 'Manutencao',
    question: 'Com que frequencia devo fazer manutencao?',
    answer: 'Recomendamos: Inspecao visual mensal, verificacao de conexoes trimestral, calibracao de SOC semestral e manutencao preventiva anual. O sistema gera lembretes automaticos baseados no uso.',
  },
  {
    id: 'faq-10',
    category: 'Manutencao',
    question: 'O que significa SOH (State of Health)?',
    answer: 'SOH indica a saude da bateria em relacao a sua capacidade original. 100% = bateria nova. Abaixo de 80% indica degradacao significativa. O sistema monitora continuamente e preve a vida util restante.',
  },
  {
    id: 'faq-11',
    category: 'Integracao',
    question: 'Como integrar com sistemas SCADA?',
    answer: 'O Lifo4 EMS oferece API REST e suporte a Modbus TCP como escravo. Gere uma chave de API em Configuracoes > API Keys e consulte a documentacao para endpoints disponiveis.',
  },
  {
    id: 'faq-12',
    category: 'Integracao',
    question: 'E possivel integrar com paineis solares?',
    answer: 'Sim! O sistema pode receber dados de inversores solares via Modbus ou API. Configure em Integracao de Rede para otimizar o autoconsumo e armazenamento do excedente solar.',
  },
];

const docSections: DocSection[] = [
  {
    id: 'getting-started',
    title: 'Primeiros Passos',
    description: 'Aprenda o basico do Lifo4 EMS',
    icon: PlayCircle,
    articles: [
      { title: 'Introducao ao Sistema', url: '#' },
      { title: 'Cadastrando seu Primeiro Sistema', url: '#' },
      { title: 'Navegando pelo Dashboard', url: '#' },
      { title: 'Entendendo as Metricas', url: '#' },
    ],
  },
  {
    id: 'systems',
    title: 'Gerenciamento de Sistemas',
    description: 'Configure e monitore seus sistemas BESS',
    icon: Battery,
    articles: [
      { title: 'Configuracao do BMS', url: '#' },
      { title: 'Parametros de Protecao', url: '#' },
      { title: 'Conexao Modbus', url: '#' },
      { title: 'Diagnostico de Celulas', url: '#' },
    ],
  },
  {
    id: 'optimization',
    title: 'Otimizacao de Energia',
    description: 'Maximize economia e eficiencia',
    icon: TrendingUp,
    articles: [
      { title: 'Modos de Operacao', url: '#' },
      { title: 'Agendamentos Inteligentes', url: '#' },
      { title: 'Integracao com Tarifas', url: '#' },
      { title: 'Peak Shaving', url: '#' },
    ],
  },
  {
    id: 'alerts',
    title: 'Alertas e Notificacoes',
    description: 'Configure monitoramento proativo',
    icon: AlertTriangle,
    articles: [
      { title: 'Tipos de Alertas', url: '#' },
      { title: 'Configurando Notificacoes', url: '#' },
      { title: 'Resolucao de Problemas', url: '#' },
      { title: 'Logs e Auditoria', url: '#' },
    ],
  },
  {
    id: 'integration',
    title: 'Integracoes',
    description: 'Conecte com outros sistemas',
    icon: Zap,
    articles: [
      { title: 'API REST', url: '#' },
      { title: 'Webhooks', url: '#' },
      { title: 'SCADA e Modbus', url: '#' },
      { title: 'Inversores Solares', url: '#' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Manutencao',
    description: 'Mantenha seu sistema saudavel',
    icon: Wrench,
    articles: [
      { title: 'Manutencao Preventiva', url: '#' },
      { title: 'Atualizacao de Firmware', url: '#' },
      { title: 'Calibracao de SOC', url: '#' },
      { title: 'Vida Util da Bateria', url: '#' },
    ],
  },
];

const videoTutorials = [
  { id: 'v1', title: 'Tour Completo do Dashboard', duration: '5:30', thumbnail: '🎬' },
  { id: 'v2', title: 'Configurando um Novo Sistema', duration: '8:45', thumbnail: '🎬' },
  { id: 'v3', title: 'Otimizacao com Tarifa Branca', duration: '6:20', thumbnail: '🎬' },
  { id: 'v4', title: 'Diagnostico de Problemas', duration: '10:15', thumbnail: '🎬' },
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faq' | 'docs' | 'videos' | 'contact'>('faq');

  const categories = ['all', ...Array.from(new Set(faqItems.map((f) => f.category)))];

  const filteredFAQ = faqItems.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <HelpCircle className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Central de Ajuda</h1>
        <p className="text-foreground-muted mt-2">
          Encontre respostas, tutoriais e documentacao para usar o Lifo4 EMS
        </p>

        {/* Search */}
        <div className="relative mt-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
          <input
            type="text"
            placeholder="Buscar ajuda..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 text-foreground text-lg"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center gap-2">
        {[
          { id: 'faq', label: 'FAQ', icon: MessageCircle },
          { id: 'docs', label: 'Documentacao', icon: Book },
          { id: 'videos', label: 'Videos', icon: Video },
          { id: 'contact', label: 'Contato', icon: Mail },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg transition-colors',
              activeTab === tab.id
                ? 'bg-primary text-white'
                : 'bg-surface-hover text-foreground-muted hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <div className="max-w-3xl mx-auto">
          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  'px-3 py-1 rounded-full text-sm transition-colors',
                  selectedCategory === cat
                    ? 'bg-primary text-white'
                    : 'bg-surface-hover text-foreground-muted hover:text-foreground'
                )}
              >
                {cat === 'all' ? 'Todas' : cat}
              </button>
            ))}
          </div>

          {/* FAQ List */}
          <div className="space-y-3">
            {filteredFAQ.length === 0 ? (
              <div className="text-center py-12">
                <HelpCircle className="w-12 h-12 mx-auto mb-4 text-foreground-subtle" />
                <p className="text-foreground-muted">Nenhuma pergunta encontrada</p>
              </div>
            ) : (
              filteredFAQ.map((item) => (
                <div
                  key={item.id}
                  className="bg-surface rounded-xl border border-border overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedFAQ(expandedFAQ === item.id ? null : item.id)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full shrink-0">
                        {item.category}
                      </span>
                      <span className="font-medium text-foreground">{item.question}</span>
                    </div>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 text-foreground-muted transition-transform shrink-0',
                        expandedFAQ === item.id && 'rotate-180'
                      )}
                    />
                  </button>
                  {expandedFAQ === item.id && (
                    <div className="px-4 pb-4 pt-0 animate-fade-in">
                      <div className="pl-[72px]">
                        <p className="text-foreground-muted leading-relaxed">{item.answer}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Docs Tab */}
      {activeTab === 'docs' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {docSections.map((section) => (
            <div
              key={section.id}
              className="bg-surface rounded-xl border border-border p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <section.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground">{section.title}</h3>
              </div>
              <p className="text-sm text-foreground-muted mb-4">{section.description}</p>
              <ul className="space-y-2">
                {section.articles.map((article, index) => (
                  <li key={index}>
                    <a
                      href={article.url}
                      className="flex items-center gap-2 text-sm text-foreground-muted hover:text-primary transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                      {article.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Videos Tab */}
      {activeTab === 'videos' && (
        <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {videoTutorials.map((video) => (
            <button
              key={video.id}
              className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-colors text-left group"
            >
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg mb-3 flex items-center justify-center relative">
                <span className="text-4xl">{video.thumbnail}</span>
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg">
                  <div className="w-12 h-12 bg-white/90 rounded-full flex items-center justify-center">
                    <PlayCircle className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </div>
              <h4 className="font-medium text-foreground">{video.title}</h4>
              <p className="text-sm text-foreground-muted flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" />
                {video.duration}
              </p>
            </button>
          ))}
        </div>
      )}

      {/* Contact Tab */}
      {activeTab === 'contact' && (
        <div className="max-w-2xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <div className="bg-surface rounded-xl border border-border p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Email</h3>
              <p className="text-foreground-muted text-sm mb-3">
                Resposta em ate 24 horas uteis
              </p>
              <a
                href="mailto:suporte@lifo4.com.br"
                className="text-primary hover:text-primary-400 font-medium"
              >
                suporte@lifo4.com.br
              </a>
            </div>

            <div className="bg-surface rounded-xl border border-border p-6 text-center">
              <div className="w-12 h-12 bg-success-500/10 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-success-500" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Telefone</h3>
              <p className="text-foreground-muted text-sm mb-3">
                Seg-Sex, 8h as 18h
              </p>
              <a
                href="tel:+558632222222"
                className="text-success-500 hover:text-success-400 font-medium"
              >
                (86) 3222-2222
              </a>
            </div>
          </div>

          {/* Contact Form */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="font-semibold text-foreground mb-4">Enviar Mensagem</h3>
            <form className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Nome</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Assunto</label>
                <select className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50">
                  <option>Suporte Tecnico</option>
                  <option>Duvida sobre Funcionalidade</option>
                  <option>Problema de Conexao</option>
                  <option>Solicitacao de Recurso</option>
                  <option>Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Mensagem</label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors font-medium"
              >
                Enviar Mensagem
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="bg-surface rounded-xl border border-border p-6 max-w-4xl mx-auto">
        <h3 className="font-semibold text-foreground mb-4 text-center">Links Rapidos</h3>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { label: 'Documentacao da API', icon: FileText, url: '#' },
            { label: 'Status do Sistema', icon: Shield, url: '#' },
            { label: 'Novidades', icon: Zap, url: '#' },
            { label: 'Comunidade', icon: Users, url: '#' },
          ].map((link) => (
            <a
              key={link.label}
              href={link.url}
              className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground-muted hover:text-foreground rounded-lg transition-colors"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
