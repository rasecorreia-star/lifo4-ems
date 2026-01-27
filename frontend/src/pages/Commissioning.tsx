import { useState, useMemo } from 'react';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Battery,
  Zap,
  ThermometerSun,
  Gauge,
  Shield,
  Network,
  FileText,
  ChevronRight,
  RefreshCw,
  Download,
  Upload,
} from 'lucide-react';

interface CommissioningStep {
  id: string;
  name: string;
  description: string;
  category: 'pre-check' | 'electrical' | 'communication' | 'battery' | 'safety' | 'final';
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  duration?: number;
  result?: string;
  mandatory: boolean;
}

interface CommissioningProject {
  id: string;
  systemName: string;
  location: string;
  capacity: string;
  startDate: string;
  status: 'not_started' | 'in_progress' | 'completed' | 'on_hold';
  progress: number;
  technician: string;
}

export default function Commissioning() {
  const [activeProject, setActiveProject] = useState<string | null>('1');
  const [runningTest, setRunningTest] = useState<string | null>(null);

  const projects: CommissioningProject[] = useMemo(() => [
    {
      id: '1',
      systemName: 'BESS Parnaiba Sul',
      location: 'Parnaiba, PI',
      capacity: '2 MWh / 500 kW',
      startDate: '2025-01-20',
      status: 'in_progress',
      progress: 45,
      technician: 'Carlos Silva',
    },
    {
      id: '2',
      systemName: 'BESS Teresina Norte',
      location: 'Teresina, PI',
      capacity: '5 MWh / 1.25 MW',
      startDate: '2025-02-01',
      status: 'not_started',
      progress: 0,
      technician: 'Ana Santos',
    },
    {
      id: '3',
      systemName: 'BESS Floriano Centro',
      location: 'Floriano, PI',
      capacity: '1 MWh / 250 kW',
      startDate: '2025-01-05',
      status: 'completed',
      progress: 100,
      technician: 'Roberto Lima',
    },
  ], []);

  const [steps, setSteps] = useState<CommissioningStep[]>([
    // Pre-check
    { id: '1', name: 'Verificacao Visual', description: 'Inspecao visual de todos os componentes e conexoes', category: 'pre-check', status: 'passed', duration: 45, result: 'Todas conexoes OK', mandatory: true },
    { id: '2', name: 'Documentacao', description: 'Verificar manuais, diagramas e certificados', category: 'pre-check', status: 'passed', duration: 30, result: 'Documentacao completa', mandatory: true },
    { id: '3', name: 'Ferramentas e EPIs', description: 'Confirmar disponibilidade de ferramentas e equipamentos de seguranca', category: 'pre-check', status: 'passed', duration: 15, result: 'Todos EPIs presentes', mandatory: true },

    // Electrical
    { id: '4', name: 'Teste de Isolamento', description: 'Medir resistencia de isolamento de todos os circuitos', category: 'electrical', status: 'passed', duration: 60, result: '> 1 MOhm em todos circuitos', mandatory: true },
    { id: '5', name: 'Teste de Continuidade', description: 'Verificar continuidade de aterramento e conexoes', category: 'electrical', status: 'passed', duration: 45, result: '< 0.5 Ohm aterramento', mandatory: true },
    { id: '6', name: 'Sequencia de Fases', description: 'Confirmar sequencia correta das fases CA', category: 'electrical', status: 'running', duration: undefined, mandatory: true },
    { id: '7', name: 'Teste de Tensao', description: 'Verificar niveis de tensao em todos os barramentos', category: 'electrical', status: 'pending', mandatory: true },

    // Communication
    { id: '8', name: 'Conectividade de Rede', description: 'Testar conexao ethernet e comunicacao com servidor', category: 'communication', status: 'pending', mandatory: true },
    { id: '9', name: 'Modbus RTU', description: 'Verificar comunicacao Modbus com BMS e inversores', category: 'communication', status: 'pending', mandatory: true },
    { id: '10', name: 'Teste SCADA', description: 'Validar integracao com sistema SCADA', category: 'communication', status: 'pending', mandatory: false },

    // Battery
    { id: '11', name: 'Balanceamento Inicial', description: 'Verificar tensao de todas as celulas e balance', category: 'battery', status: 'pending', mandatory: true },
    { id: '12', name: 'Teste de Carga', description: 'Ciclo de carga ate 100% SOC', category: 'battery', status: 'pending', mandatory: true },
    { id: '13', name: 'Teste de Descarga', description: 'Ciclo de descarga ate 10% SOC', category: 'battery', status: 'pending', mandatory: true },
    { id: '14', name: 'Teste de Eficiencia', description: 'Medir eficiencia round-trip do sistema', category: 'battery', status: 'pending', mandatory: true },

    // Safety
    { id: '15', name: 'Sistema de Incendio', description: 'Testar detectores de fumaca e sistema de supressao', category: 'safety', status: 'pending', mandatory: true },
    { id: '16', name: 'Parada de Emergencia', description: 'Validar funcionamento de todos os botoes de emergencia', category: 'safety', status: 'pending', mandatory: true },
    { id: '17', name: 'Alarmes e Interlocks', description: 'Testar todos os alarmes e interlocks de seguranca', category: 'safety', status: 'pending', mandatory: true },
    { id: '18', name: 'Ventilacao e Climatizacao', description: 'Verificar sistema HVAC e sensores de temperatura', category: 'safety', status: 'pending', mandatory: true },

    // Final
    { id: '19', name: 'Teste de Integracao', description: 'Operacao completa do sistema por 24h', category: 'final', status: 'pending', mandatory: true },
    { id: '20', name: 'Documentacao Final', description: 'Completar relatorio de comissionamento', category: 'final', status: 'pending', mandatory: true },
    { id: '21', name: 'Treinamento Operador', description: 'Capacitar equipe local de operacao', category: 'final', status: 'pending', mandatory: false },
  ]);

  const categories = [
    { id: 'pre-check', name: 'Pre-Check', icon: FileText },
    { id: 'electrical', name: 'Eletrico', icon: Zap },
    { id: 'communication', name: 'Comunicacao', icon: Network },
    { id: 'battery', name: 'Bateria', icon: Battery },
    { id: 'safety', name: 'Seguranca', icon: Shield },
    { id: 'final', name: 'Final', icon: CheckCircle },
  ];

  const currentProject = projects.find(p => p.id === activeProject);

  const categoryProgress = useMemo(() => {
    return categories.map(cat => {
      const catSteps = steps.filter(s => s.category === cat.id);
      const passed = catSteps.filter(s => s.status === 'passed').length;
      return {
        ...cat,
        total: catSteps.length,
        passed,
        progress: catSteps.length > 0 ? (passed / catSteps.length) * 100 : 0,
      };
    });
  }, [steps]);

  const overallProgress = useMemo(() => {
    const mandatory = steps.filter(s => s.mandatory);
    const passed = mandatory.filter(s => s.status === 'passed').length;
    return (passed / mandatory.length) * 100;
  }, [steps]);

  const runTest = (stepId: string) => {
    setRunningTest(stepId);
    setSteps(prev => prev.map(s =>
      s.id === stepId ? { ...s, status: 'running' } : s
    ));

    // Simulate test execution
    setTimeout(() => {
      const success = Math.random() > 0.1;
      setSteps(prev => prev.map(s =>
        s.id === stepId ? {
          ...s,
          status: success ? 'passed' : 'failed',
          duration: Math.floor(Math.random() * 60) + 30,
          result: success ? 'Teste aprovado' : 'Falha detectada - verificar logs',
        } : s
      ));
      setRunningTest(null);
    }, 3000);
  };

  const getStatusIcon = (status: CommissioningStep['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-danger-500" />;
      case 'running':
        return <RefreshCw className="w-5 h-5 text-primary animate-spin" />;
      case 'skipped':
        return <AlertTriangle className="w-5 h-5 text-warning-500" />;
      default:
        return <Clock className="w-5 h-5 text-foreground-muted" />;
    }
  };

  const getProjectStatusBadge = (status: CommissioningProject['status']) => {
    switch (status) {
      case 'completed':
        return <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Concluido</span>;
      case 'in_progress':
        return <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">Em Andamento</span>;
      case 'on_hold':
        return <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Pausado</span>;
      default:
        return <span className="px-2 py-1 text-xs rounded-full bg-surface-hover text-foreground-muted">Nao Iniciado</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Comissionamento</h1>
          <p className="text-foreground-muted">Gerenciamento de implantacao de novos sistemas</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
            <Download className="w-4 h-4" />
            Exportar Relatorio
          </button>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <Upload className="w-4 h-4" />
            Novo Projeto
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Projects List */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Projetos</h2>
          <div className="space-y-3">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveProject(project.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  activeProject === project.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border hover:bg-surface-hover'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">{project.systemName}</h3>
                  {getProjectStatusBadge(project.status)}
                </div>
                <p className="text-sm text-foreground-muted mb-2">{project.location}</p>
                <p className="text-xs text-foreground-muted mb-3">{project.capacity}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-muted">Progresso</span>
                    <span className="text-foreground">{project.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        project.progress === 100 ? 'bg-success-500' : 'bg-primary'
                      }`}
                      style={{ width: `${project.progress}%` }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <span className="text-xs text-foreground-muted">{project.technician}</span>
                  <span className="text-xs text-foreground-muted">
                    {new Date(project.startDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Commissioning Steps */}
        <div className="lg:col-span-2 space-y-6">
          {currentProject ? (
            <>
              {/* Project Header */}
              <div className="bg-surface rounded-xl border border-border p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-foreground">{currentProject.systemName}</h2>
                    <p className="text-foreground-muted">{currentProject.location} - {currentProject.capacity}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{overallProgress.toFixed(0)}%</p>
                    <p className="text-sm text-foreground-muted">Progresso Geral</p>
                  </div>
                </div>

                {/* Category Progress */}
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  {categoryProgress.map((cat) => (
                    <div key={cat.id} className="text-center">
                      <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                        cat.progress === 100 ? 'bg-success-500/20' :
                        cat.progress > 0 ? 'bg-primary/20' : 'bg-surface-hover'
                      }`}>
                        <cat.icon className={`w-6 h-6 ${
                          cat.progress === 100 ? 'text-success-500' :
                          cat.progress > 0 ? 'text-primary' : 'text-foreground-muted'
                        }`} />
                      </div>
                      <p className="text-xs font-medium text-foreground">{cat.name}</p>
                      <p className="text-xs text-foreground-muted">{cat.passed}/{cat.total}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps by Category */}
              {categories.map((category) => {
                const catSteps = steps.filter(s => s.category === category.id);
                if (catSteps.length === 0) return null;

                return (
                  <div key={category.id} className="bg-surface rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-3 bg-surface-hover border-b border-border flex items-center gap-3">
                      <category.icon className="w-5 h-5 text-primary" />
                      <h3 className="font-semibold text-foreground">{category.name}</h3>
                      <span className="text-xs text-foreground-muted">
                        {catSteps.filter(s => s.status === 'passed').length}/{catSteps.length} concluidos
                      </span>
                    </div>
                    <div className="divide-y divide-border">
                      {catSteps.map((step) => (
                        <div
                          key={step.id}
                          className={`p-4 flex items-center gap-4 ${
                            step.status === 'running' ? 'bg-primary/5' :
                            step.status === 'failed' ? 'bg-danger-500/5' : ''
                          }`}
                        >
                          {getStatusIcon(step.status)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{step.name}</p>
                              {step.mandatory && (
                                <span className="text-xs text-danger-500">*</span>
                              )}
                            </div>
                            <p className="text-sm text-foreground-muted truncate">{step.description}</p>
                            {step.result && (
                              <p className={`text-xs mt-1 ${
                                step.status === 'passed' ? 'text-success-500' : 'text-danger-500'
                              }`}>
                                {step.result}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            {step.duration && (
                              <span className="text-sm text-foreground-muted">
                                {step.duration} min
                              </span>
                            )}
                            {step.status === 'pending' && (
                              <button
                                onClick={() => runTest(step.id)}
                                disabled={runningTest !== null}
                                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                <Play className="w-4 h-4" />
                                Executar
                              </button>
                            )}
                            {step.status === 'failed' && (
                              <button
                                onClick={() => runTest(step.id)}
                                disabled={runningTest !== null}
                                className="flex items-center gap-2 px-3 py-1.5 bg-warning-500 text-white text-sm rounded-lg hover:bg-warning-500/90 disabled:opacity-50 transition-colors"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Repetir
                              </button>
                            )}
                            {step.status === 'running' && (
                              <span className="text-sm text-primary animate-pulse">
                                Executando...
                              </span>
                            )}
                            {step.status === 'passed' && (
                              <CheckCircle className="w-5 h-5 text-success-500" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Final Actions */}
              <div className="flex justify-end gap-3">
                <button className="px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface-hover transition-colors">
                  Salvar Progresso
                </button>
                <button
                  disabled={overallProgress < 100}
                  className="flex items-center gap-2 px-4 py-2 bg-success-500 text-white rounded-lg hover:bg-success-500/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Finalizar Comissionamento
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-96 bg-surface rounded-xl border border-border">
              <div className="text-center">
                <Battery className="w-12 h-12 text-foreground-muted mx-auto mb-4" />
                <p className="text-foreground-muted">Selecione um projeto para ver os detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
