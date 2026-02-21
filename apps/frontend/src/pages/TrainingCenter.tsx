import { useState, useMemo } from 'react';
import {
  GraduationCap,
  BookOpen,
  Video,
  FileText,
  Award,
  Clock,
  CheckCircle,
  Play,
  Lock,
  Users,
  TrendingUp,
  Calendar,
  Star,
  ChevronRight,
  Download,
} from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  duration: number;
  modules: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
  certificate: boolean;
  mandatory: boolean;
}

interface Certification {
  id: string;
  name: string;
  issueDate: string;
  expiryDate: string;
  status: 'valid' | 'expiring' | 'expired';
  courseId: string;
}

export default function TrainingCenter() {
  const [activeTab, setActiveTab] = useState<'courses' | 'certifications' | 'progress' | 'resources'>('courses');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const courses: Course[] = useMemo(() => [
    {
      id: '1',
      title: 'Fundamentos de BESS',
      description: 'Introducao aos sistemas de armazenamento de energia com baterias',
      category: 'Fundamentos',
      duration: 4,
      modules: 8,
      level: 'beginner',
      progress: 100,
      status: 'completed',
      certificate: true,
      mandatory: true,
    },
    {
      id: '2',
      title: 'Operacao do EMS Lifo4',
      description: 'Operacao basica do sistema de gerenciamento de energia',
      category: 'Operacao',
      duration: 6,
      modules: 12,
      level: 'beginner',
      progress: 100,
      status: 'completed',
      certificate: true,
      mandatory: true,
    },
    {
      id: '3',
      title: 'Seguranca em Sistemas de Bateria',
      description: 'Protocolos de seguranca e procedimentos de emergencia',
      category: 'Seguranca',
      duration: 3,
      modules: 6,
      level: 'intermediate',
      progress: 75,
      status: 'in_progress',
      certificate: true,
      mandatory: true,
    },
    {
      id: '4',
      title: 'Manutencao Preventiva',
      description: 'Tecnicas de manutencao preventiva para BESS',
      category: 'Manutencao',
      duration: 5,
      modules: 10,
      level: 'intermediate',
      progress: 40,
      status: 'in_progress',
      certificate: true,
      mandatory: false,
    },
    {
      id: '5',
      title: 'Diagnostico Avancado',
      description: 'Troubleshooting e diagnostico de falhas',
      category: 'Manutencao',
      duration: 8,
      modules: 15,
      level: 'advanced',
      progress: 0,
      status: 'not_started',
      certificate: true,
      mandatory: false,
    },
    {
      id: '6',
      title: 'Integracao com Rede Eletrica',
      description: 'Normas e procedimentos para conexao a rede',
      category: 'Operacao',
      duration: 4,
      modules: 8,
      level: 'advanced',
      progress: 0,
      status: 'not_started',
      certificate: true,
      mandatory: false,
    },
    {
      id: '7',
      title: 'NR-10 Eletricidade',
      description: 'Seguranca em instalacoes e servicos em eletricidade',
      category: 'Seguranca',
      duration: 8,
      modules: 16,
      level: 'intermediate',
      progress: 100,
      status: 'completed',
      certificate: true,
      mandatory: true,
    },
    {
      id: '8',
      title: 'Mercado de Energia',
      description: 'Funcionamento do mercado livre e regulado de energia',
      category: 'Negocios',
      duration: 3,
      modules: 6,
      level: 'beginner',
      progress: 0,
      status: 'not_started',
      certificate: false,
      mandatory: false,
    },
  ], []);

  const certifications: Certification[] = useMemo(() => [
    { id: '1', name: 'Operador BESS Nivel 1', issueDate: '2024-06-15', expiryDate: '2026-06-15', status: 'valid', courseId: '1' },
    { id: '2', name: 'Operador EMS Lifo4', issueDate: '2024-08-20', expiryDate: '2026-08-20', status: 'valid', courseId: '2' },
    { id: '3', name: 'NR-10 Basico', issueDate: '2024-03-10', expiryDate: '2025-03-10', status: 'expiring', courseId: '7' },
  ], []);

  const categories = useMemo(() => {
    const cats = new Set(courses.map(c => c.category));
    return ['all', ...Array.from(cats)];
  }, [courses]);

  const filteredCourses = useMemo(() => {
    if (categoryFilter === 'all') return courses;
    return courses.filter(c => c.category === categoryFilter);
  }, [courses, categoryFilter]);

  const stats = useMemo(() => {
    const completed = courses.filter(c => c.status === 'completed').length;
    const inProgress = courses.filter(c => c.status === 'in_progress').length;
    const totalHours = courses.filter(c => c.status === 'completed').reduce((sum, c) => sum + c.duration, 0);
    const mandatoryCompleted = courses.filter(c => c.mandatory && c.status === 'completed').length;
    const mandatoryTotal = courses.filter(c => c.mandatory).length;
    return { completed, inProgress, totalHours, mandatoryCompleted, mandatoryTotal, total: courses.length };
  }, [courses]);

  const getLevelBadge = (level: Course['level']) => {
    switch (level) {
      case 'beginner':
        return <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Iniciante</span>;
      case 'intermediate':
        return <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Intermediario</span>;
      case 'advanced':
        return <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Avancado</span>;
    }
  };

  const getStatusIcon = (status: Course['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'in_progress':
        return <Play className="w-5 h-5 text-primary" />;
      default:
        return <Lock className="w-5 h-5 text-foreground-muted" />;
    }
  };

  const getCertStatusBadge = (status: Certification['status']) => {
    switch (status) {
      case 'valid':
        return <span className="px-2 py-1 text-xs rounded-full bg-success-500/20 text-success-500">Valido</span>;
      case 'expiring':
        return <span className="px-2 py-1 text-xs rounded-full bg-warning-500/20 text-warning-500">Expirando</span>;
      case 'expired':
        return <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Expirado</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Centro de Treinamento</h1>
          <p className="text-foreground-muted">Capacitacao e certificacao de operadores</p>
        </div>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            <Play className="w-4 h-4" />
            Continuar Treinamento
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-500/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Concluidos</p>
              <p className="text-xl font-bold text-foreground">{stats.completed}/{stats.total}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Play className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Em Andamento</p>
              <p className="text-xl font-bold text-foreground">{stats.inProgress}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-500/20 rounded-lg">
              <Clock className="w-5 h-5 text-warning-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Horas de Treino</p>
              <p className="text-xl font-bold text-foreground">{stats.totalHours}h</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-danger-500/20 rounded-lg">
              <Star className="w-5 h-5 text-danger-500" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Obrigatorios</p>
              <p className="text-xl font-bold text-foreground">{stats.mandatoryCompleted}/{stats.mandatoryTotal}</p>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/20 rounded-lg">
              <Award className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Certificados</p>
              <p className="text-xl font-bold text-foreground">{certifications.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border overflow-x-auto">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'courses'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          Cursos
        </button>
        <button
          onClick={() => setActiveTab('certifications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'certifications'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <Award className="w-4 h-4 inline mr-2" />
          Certificacoes
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'progress'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <TrendingUp className="w-4 h-4 inline mr-2" />
          Meu Progresso
        </button>
        <button
          onClick={() => setActiveTab('resources')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'resources'
              ? 'border-primary text-primary'
              : 'border-transparent text-foreground-muted hover:text-foreground'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Recursos
        </button>
      </div>

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  categoryFilter === cat
                    ? 'bg-primary text-white'
                    : 'bg-surface border border-border text-foreground hover:bg-surface-hover'
                }`}
              >
                {cat === 'all' ? 'Todos' : cat}
              </button>
            ))}
          </div>

          {/* Course Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCourses.map((course) => (
              <div
                key={course.id}
                className={`bg-surface rounded-xl border p-4 transition-all hover:border-primary/50 ${
                  course.status === 'completed' ? 'border-success-500/30' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(course.status)}
                    <span className="text-xs text-foreground-muted">{course.category}</span>
                  </div>
                  {course.mandatory && (
                    <span className="px-2 py-1 text-xs rounded-full bg-danger-500/20 text-danger-500">Obrigatorio</span>
                  )}
                </div>

                <h3 className="font-semibold text-foreground mb-2">{course.title}</h3>
                <p className="text-sm text-foreground-muted mb-4 line-clamp-2">{course.description}</p>

                <div className="flex items-center gap-4 mb-4 text-xs text-foreground-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {course.duration}h
                  </span>
                  <span className="flex items-center gap-1">
                    <BookOpen className="w-3 h-3" /> {course.modules} modulos
                  </span>
                  {getLevelBadge(course.level)}
                </div>

                {/* Progress Bar */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-xs">
                    <span className="text-foreground-muted">Progresso</span>
                    <span className="text-foreground">{course.progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-surface-hover rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        course.progress === 100 ? 'bg-success-500' : 'bg-primary'
                      }`}
                      style={{ width: `${course.progress}%` }}
                    />
                  </div>
                </div>

                <button
                  className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                    course.status === 'completed'
                      ? 'bg-success-500/10 text-success-500 hover:bg-success-500/20'
                      : course.status === 'in_progress'
                      ? 'bg-primary text-white hover:bg-primary/90'
                      : 'bg-surface-hover text-foreground hover:bg-primary/10'
                  }`}
                >
                  {course.status === 'completed' ? (
                    <>
                      <CheckCircle className="w-4 h-4" /> Concluido
                    </>
                  ) : course.status === 'in_progress' ? (
                    <>
                      <Play className="w-4 h-4" /> Continuar
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" /> Iniciar
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Certifications Tab */}
      {activeTab === 'certifications' && (
        <div className="space-y-4">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {certifications.map((cert) => (
              <div key={cert.id} className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-primary/20 rounded-xl">
                    <Award className="w-8 h-8 text-primary" />
                  </div>
                  {getCertStatusBadge(cert.status)}
                </div>
                <h3 className="font-semibold text-foreground mb-2">{cert.name}</h3>
                <div className="space-y-1 text-sm text-foreground-muted mb-4">
                  <p>Emitido: {new Date(cert.issueDate).toLocaleDateString('pt-BR')}</p>
                  <p>Valido ate: {new Date(cert.expiryDate).toLocaleDateString('pt-BR')}</p>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-surface border border-border rounded-lg text-sm hover:bg-surface-hover transition-colors">
                    <Download className="w-4 h-4" /> Download
                  </button>
                  {cert.status === 'expiring' && (
                    <button className="flex-1 px-3 py-2 bg-warning-500 text-white rounded-lg text-sm hover:bg-warning-500/90 transition-colors">
                      Renovar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Available Certifications */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Certificacoes Disponiveis</h3>
            <div className="space-y-3">
              {courses.filter(c => c.certificate && c.status !== 'completed').map((course) => (
                <div key={course.id} className="flex items-center justify-between p-3 bg-surface-hover rounded-lg">
                  <div className="flex items-center gap-3">
                    <Award className="w-5 h-5 text-foreground-muted" />
                    <div>
                      <p className="font-medium text-foreground">{course.title}</p>
                      <p className="text-xs text-foreground-muted">Complete o curso para obter</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-foreground-muted">{course.progress}% completo</span>
                    <ChevronRight className="w-4 h-4 text-foreground-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Progress Tab */}
      {activeTab === 'progress' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Learning Path */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Trilha de Aprendizado</h3>
            <div className="space-y-4">
              {courses.filter(c => c.mandatory).map((course, index) => (
                <div key={course.id} className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      course.status === 'completed' ? 'bg-success-500' :
                      course.status === 'in_progress' ? 'bg-primary' : 'bg-surface-hover'
                    }`}>
                      {course.status === 'completed' ? (
                        <CheckCircle className="w-5 h-5 text-white" />
                      ) : (
                        <span className="text-sm font-semibold text-foreground">{index + 1}</span>
                      )}
                    </div>
                    {index < courses.filter(c => c.mandatory).length - 1 && (
                      <div className={`w-0.5 h-12 ${
                        course.status === 'completed' ? 'bg-success-500' : 'bg-border'
                      }`} />
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <h4 className="font-medium text-foreground">{course.title}</h4>
                    <p className="text-sm text-foreground-muted">{course.duration}h - {course.modules} modulos</p>
                    {course.status === 'in_progress' && (
                      <div className="mt-2 w-full h-1.5 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${course.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-surface rounded-xl border border-border p-6">
            <h3 className="text-lg font-semibold text-foreground mb-4">Atividade Recente</h3>
            <div className="space-y-4">
              {[
                { action: 'Completou modulo', course: 'Seguranca em Sistemas de Bateria', module: 'Modulo 5', date: '2025-01-25' },
                { action: 'Iniciou', course: 'Manutencao Preventiva', module: 'Modulo 4', date: '2025-01-24' },
                { action: 'Completou quiz', course: 'Seguranca em Sistemas de Bateria', module: 'Quiz 4', date: '2025-01-23' },
                { action: 'Assistiu video', course: 'Manutencao Preventiva', module: 'Aula 3.2', date: '2025-01-22' },
              ].map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-surface-hover rounded-lg">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Play className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{activity.action}</span> - {activity.module}
                    </p>
                    <p className="text-xs text-foreground-muted">{activity.course}</p>
                  </div>
                  <span className="text-xs text-foreground-muted">
                    {new Date(activity.date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Manual do Operador BESS', type: 'PDF', size: '2.5 MB', icon: FileText },
            { title: 'Guia Rapido EMS', type: 'PDF', size: '1.2 MB', icon: FileText },
            { title: 'Videos de Treinamento', type: 'Playlist', size: '15 videos', icon: Video },
            { title: 'Procedimentos de Emergencia', type: 'PDF', size: '850 KB', icon: FileText },
            { title: 'Glossario Tecnico', type: 'PDF', size: '500 KB', icon: BookOpen },
            { title: 'FAQ - Perguntas Frequentes', type: 'HTML', size: 'Online', icon: FileText },
          ].map((resource, index) => (
            <div key={index} className="bg-surface rounded-xl border border-border p-4">
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-primary/20 rounded-lg">
                  <resource.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground">{resource.title}</h3>
                  <p className="text-xs text-foreground-muted">{resource.type} - {resource.size}</p>
                </div>
              </div>
              <button className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-surface-hover hover:bg-primary/10 rounded-lg text-sm transition-colors">
                <Download className="w-4 h-4" /> Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
