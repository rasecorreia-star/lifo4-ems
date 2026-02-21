/**
 * Help Center Page
 * In-app documentation, FAQ, and support resources
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  AlertTriangle,
  TrendingUp,
  Shield,
  Wrench,
  Users,
  PlayCircle,
  X,
  CheckCircle,
  Loader2,
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
  articles: Array<{ title: string; content: string }>;
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
    answer: 'Alertas criticos incluem: sobrecorrente, sobretemperatura (>45C), subtensao de celula (<2.5V), sobretensao (>3.65V) e falha de comunicacao prolongada. Esses alertas podem acionar parada de emergencia.',
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
      { title: 'Introducao ao Sistema', content: 'O Lifo4 EMS e uma plataforma completa para gerenciamento de sistemas de armazenamento de energia. Este guia ajudara voce a dar os primeiros passos no sistema, desde o cadastro ate a configuracao inicial do seu primeiro BESS.' },
      { title: 'Cadastrando seu Primeiro Sistema', content: 'Para cadastrar um novo sistema BESS: 1) Acesse o menu Sistemas; 2) Clique em "Novo Sistema"; 3) Siga o assistente de 6 passos preenchendo informacoes do BMS, baterias, inversores e conexao; 4) Teste a comunicacao e finalize.' },
      { title: 'Navegando pelo Dashboard', content: 'O Dashboard apresenta uma visao geral de todos os seus sistemas. Os cards mostram SOC, potencia atual, temperatura e status. Use os filtros para encontrar sistemas especificos e clique em qualquer card para ver detalhes.' },
      { title: 'Entendendo as Metricas', content: 'SOC (State of Charge): nivel de carga da bateria (0-100%). SOH (State of Health): saude da bateria. Potencia: W/kW positivo = descarga, negativo = carga. Temperatura: deve ficar entre 15-35C para operacao ideal.' },
    ],
  },
  {
    id: 'systems',
    title: 'Gerenciamento de Sistemas',
    description: 'Configure e monitore seus sistemas BESS',
    icon: Battery,
    articles: [
      { title: 'Configuracao do BMS', content: 'O BMS (Battery Management System) e o cerebro do sistema. Configure: tipo de comunicacao (Modbus TCP/RTU), enderecos de registradores, limites de tensao/corrente, e parametros de balanceamento de celulas.' },
      { title: 'Parametros de Protecao', content: 'Configure limites de seguranca: tensao maxima/minima por celula, corrente maxima de carga/descarga, temperatura maxima/minima, delta de tensao entre celulas. O sistema acionara alarmes e protecoes automaticamente.' },
      { title: 'Conexao Modbus', content: 'Modbus TCP: IP do BMS, porta (padrao 502), Unit ID. Modbus RTU: porta serial, baudrate, paridade, bits de parada. Teste a conexao antes de salvar para garantir comunicacao estavel.' },
      { title: 'Diagnostico de Celulas', content: 'Monitore cada celula individualmente: tensao, temperatura, resistencia interna. Identifique celulas desbalanceadas ou com degradacao. O sistema alerta automaticamente sobre anomalias.' },
    ],
  },
  {
    id: 'optimization',
    title: 'Otimizacao de Energia',
    description: 'Maximize economia e eficiencia',
    icon: TrendingUp,
    articles: [
      { title: 'Modos de Operacao', content: 'Manual: controle total do operador. Automatico: IA decide baseado em tarifas e previsoes. Peak Shaving: reduz picos de demanda. Backup: reserva energia para emergencias. Arbitragem: compra/vende conforme precos.' },
      { title: 'Agendamentos Inteligentes', content: 'Crie regras automaticas: carregar durante tarifa baixa (madrugada), descarregar no horario de ponta, manter SOC minimo para backup. Combine multiplas condicoes com operadores AND/OR.' },
      { title: 'Integracao com Tarifas', content: 'Configure sua estrutura tarifaria: horarios de ponta/fora-ponta, bandeiras tarifarias, demanda contratada. O sistema otimiza automaticamente para minimizar custos com energia.' },
      { title: 'Peak Shaving', content: 'Reduza multas por ultrapassagem de demanda. Configure o limite desejado e o sistema automaticamente descarrega a bateria quando o consumo se aproxima do limite contratado.' },
    ],
  },
  {
    id: 'alerts',
    title: 'Alertas e Notificacoes',
    description: 'Configure monitoramento proativo',
    icon: AlertTriangle,
    articles: [
      { title: 'Tipos de Alertas', content: 'Critico (vermelho): requer acao imediata - falhas de seguranca, temperaturas extremas. Alerta (amarelo): atencao necessaria - desvios de parametros. Info (azul): informativo - mudancas de estado, eventos programados.' },
      { title: 'Configurando Notificacoes', content: 'Acesse Configuracoes > Notificacoes. Escolha canais: email, WhatsApp, push, Telegram. Defina quais severidades notificar em cada canal. Configure horario de silencio para alertas nao-criticos.' },
      { title: 'Resolucao de Problemas', content: 'Cada alerta inclui: descricao do problema, timestamp, sistema afetado, acoes recomendadas. Use o historico para identificar padroes. Alertas criticos sao arquivados para auditoria.' },
      { title: 'Logs e Auditoria', content: 'Todos os eventos sao registrados: comandos, alteracoes de configuracao, alertas, acoes de usuarios. Exporte logs em CSV/PDF para auditorias. Retencao configuravel de 30 dias a 5 anos.' },
    ],
  },
  {
    id: 'integration',
    title: 'Integracoes',
    description: 'Conecte com outros sistemas',
    icon: Zap,
    articles: [
      { title: 'API REST', content: 'Documentacao completa em /api-keys. Autenticacao via Bearer Token. Endpoints: GET /systems (listar), GET /telemetry (dados), POST /control (comandos). Rate limit: 1000 req/min.' },
      { title: 'Webhooks', content: 'Receba notificacoes em tempo real. Configure URL de destino, eventos de interesse (alertas, mudancas de estado), e formato (JSON/XML). Retry automatico em caso de falha.' },
      { title: 'SCADA e Modbus', content: 'O EMS pode atuar como escravo Modbus TCP, expondo dados para sistemas SCADA. Configure: porta de escuta, mapa de registradores, permissoes de leitura/escrita.' },
      { title: 'Inversores Solares', content: 'Suporte a principais fabricantes: Fronius, SMA, Huawei, Growatt. Configure via Modbus ou API proprietaria. Dados de geracao solar sao integrados na otimizacao automatica.' },
    ],
  },
  {
    id: 'maintenance',
    title: 'Manutencao',
    description: 'Mantenha seu sistema saudavel',
    icon: Wrench,
    articles: [
      { title: 'Manutencao Preventiva', content: 'Checklist mensal: inspecao visual, limpeza de filtros, verificacao de conexoes. Trimestral: teste de isolamento, reaperto de terminais. Anual: calibracao de sensores, teste de capacidade.' },
      { title: 'Atualizacao de Firmware', content: 'Mantenha BMS e inversores atualizados. O EMS notifica sobre novas versoes. Agende atualizacoes para horarios de baixa demanda. Sempre faca backup das configuracoes antes.' },
      { title: 'Calibracao de SOC', content: 'SOC pode perder precisao ao longo do tempo. Procedimento: descarregue ate corte por baixa tensao, carregue completamente ate corte por alta tensao. O BMS recalibra automaticamente.' },
      { title: 'Vida Util da Bateria', content: 'LiFePO4: 3000-5000 ciclos. NMC: 1000-2000 ciclos. Fatores que aceleram degradacao: temperaturas extremas, DOD alto, carga rapida frequente. O EMS estima vida restante baseado no uso.' },
    ],
  },
];

const videoTutorials = [
  { id: 'v1', title: 'Tour Completo do Dashboard', duration: '5:30', thumbnail: '', youtubeId: 'demo1' },
  { id: 'v2', title: 'Configurando um Novo Sistema', duration: '8:45', thumbnail: '', youtubeId: 'demo2' },
  { id: 'v3', title: 'Otimizacao com Tarifa Branca', duration: '6:20', thumbnail: '', youtubeId: 'demo3' },
  { id: 'v4', title: 'Diagnostico de Problemas', duration: '10:15', thumbnail: '', youtubeId: 'demo4' },
];

export default function HelpCenter() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'faq' | 'docs' | 'videos' | 'contact'>('faq');
  const [selectedArticle, setSelectedArticle] = useState<{ title: string; content: string } | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<typeof videoTutorials[0] | null>(null);

  // Contact form state
  const [contactForm, setContactForm] = useState({ name: '', email: '', subject: 'Suporte Tecnico', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const categories = ['all', ...Array.from(new Set(faqItems.map((f) => f.category)))];

  const filteredFAQ = faqItems.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');

    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      setSubmitError('Preencha todos os campos obrigatorios');
      return;
    }

    setIsSubmitting(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setSubmitSuccess(true);
      setContactForm({ name: '', email: '', subject: 'Suporte Tecnico', message: '' });
      setTimeout(() => setSubmitSuccess(false), 5000);
    } catch (error) {
      setSubmitError('Erro ao enviar mensagem. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickLink = (linkType: string) => {
    switch (linkType) {
      case 'api':
        navigate('/api-keys');
        break;
      case 'status':
        navigate('/dashboard');
        break;
      case 'news':
        navigate('/notifications');
        break;
      case 'community':
        window.open('https://github.com/lifo4/ems-community', '_blank');
        break;
    }
  };

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
                    <button
                      onClick={() => setSelectedArticle(article)}
                      className="flex items-center gap-2 text-sm text-foreground-muted hover:text-primary transition-colors w-full text-left"
                    >
                      <ChevronRight className="w-4 h-4" />
                      {article.title}
                    </button>
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
              onClick={() => setSelectedVideo(video)}
              className="bg-surface rounded-xl border border-border p-4 hover:border-primary/50 transition-colors text-left group"
            >
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-lg mb-3 flex items-center justify-center relative">
                <Video className="w-12 h-12 text-primary/50" />
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

            {submitSuccess && (
              <div className="mb-4 p-4 bg-success-500/10 border border-success-500/30 rounded-lg flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-success-500" />
                <span className="text-success-500">Mensagem enviada com sucesso! Entraremos em contato em breve.</span>
              </div>
            )}

            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Nome *</label>
                  <input
                    type="text"
                    value={contactForm.name}
                    onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
                <div>
                  <label className="block text-sm text-foreground-muted mb-1">Email *</label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Assunto</label>
                <select
                  value={contactForm.subject}
                  onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option>Suporte Tecnico</option>
                  <option>Duvida sobre Funcionalidade</option>
                  <option>Problema de Conexao</option>
                  <option>Solicitacao de Recurso</option>
                  <option>Outro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-foreground-muted mb-1">Mensagem *</label>
                <textarea
                  rows={4}
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              </div>
              {submitError && <p className="text-sm text-danger-500">{submitError}</p>}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Mensagem'
                )}
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
            { label: 'Documentacao da API', icon: FileText, action: 'api' },
            { label: 'Status do Sistema', icon: Shield, action: 'status' },
            { label: 'Novidades', icon: Zap, action: 'news' },
            { label: 'Comunidade', icon: Users, action: 'community' },
          ].map((link) => (
            <button
              key={link.label}
              onClick={() => handleQuickLink(link.action)}
              className="flex items-center gap-2 px-4 py-2 bg-surface-hover hover:bg-surface-active text-foreground-muted hover:text-foreground rounded-lg transition-colors"
            >
              <link.icon className="w-4 h-4" />
              {link.label}
              <ExternalLink className="w-3 h-3" />
            </button>
          ))}
        </div>
      </div>

      {/* Article Modal */}
      {selectedArticle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{selectedArticle.title}</h3>
              <button
                onClick={() => setSelectedArticle(null)}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto">
              <p className="text-foreground-muted leading-relaxed whitespace-pre-line">
                {selectedArticle.content}
              </p>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedArticle(null)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {selectedVideo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface rounded-xl border border-border w-full max-w-3xl overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-foreground">{selectedVideo.title}</h3>
              <button
                onClick={() => setSelectedVideo(null)}
                className="p-2 hover:bg-surface-hover rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-foreground-muted" />
              </button>
            </div>
            <div className="aspect-video bg-black flex items-center justify-center">
              <div className="text-center">
                <Video className="w-16 h-16 text-foreground-muted mx-auto mb-4" />
                <p className="text-foreground-muted">Video em breve disponivel</p>
                <p className="text-sm text-foreground-subtle mt-2">Duracao: {selectedVideo.duration}</p>
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end">
              <button
                onClick={() => setSelectedVideo(null)}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
