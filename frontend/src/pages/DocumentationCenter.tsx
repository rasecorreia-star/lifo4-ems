import { useMemo, useState } from 'react';
import {
  FileText,
  Search,
  Book,
  Video,
  Download,
  ExternalLink,
  Clock,
  Eye,
  Star,
  ChevronRight,
  FolderOpen,
  File,
  Play,
  Bookmark,
  ThumbsUp,
} from 'lucide-react';

interface Document {
  id: string;
  title: string;
  description: string;
  category: string;
  type: 'manual' | 'guide' | 'video' | 'whitepaper' | 'faq';
  version: string;
  lastUpdated: string;
  views: number;
  rating: number;
  downloadUrl?: string;
  videoUrl?: string;
  size?: string;
  duration?: string;
  tags: string[];
  bookmarked: boolean;
}

interface Category {
  name: string;
  count: number;
  icon: React.ElementType;
}

export default function DocumentationCenter() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [bookmarkedDocs, setBookmarkedDocs] = useState<Set<string>>(new Set(['doc-1', 'doc-5']));

  const documents = useMemo<Document[]>(() => [
    {
      id: 'doc-1',
      title: 'Manual de Operacao BESS',
      description: 'Guia completo de operacao do sistema de armazenamento de energia por baterias',
      category: 'Operacao',
      type: 'manual',
      version: '3.2',
      lastUpdated: '2025-01-15',
      views: 1234,
      rating: 4.8,
      downloadUrl: '#',
      size: '15.2 MB',
      tags: ['operacao', 'bess', 'manual'],
      bookmarked: true,
    },
    {
      id: 'doc-2',
      title: 'Guia de Instalacao Rapida',
      description: 'Procedimentos para instalacao e comissionamento inicial do sistema',
      category: 'Instalacao',
      type: 'guide',
      version: '2.1',
      lastUpdated: '2025-01-10',
      views: 856,
      rating: 4.5,
      downloadUrl: '#',
      size: '8.4 MB',
      tags: ['instalacao', 'comissionamento', 'setup'],
      bookmarked: false,
    },
    {
      id: 'doc-3',
      title: 'Tutorial: Configuracao BMS',
      description: 'Video tutorial sobre configuracao do sistema de gerenciamento de baterias',
      category: 'Configuracao',
      type: 'video',
      version: '1.0',
      lastUpdated: '2025-01-08',
      views: 2341,
      rating: 4.9,
      videoUrl: '#',
      duration: '25:30',
      tags: ['bms', 'configuracao', 'tutorial'],
      bookmarked: false,
    },
    {
      id: 'doc-4',
      title: 'Whitepaper: Otimizacao Energetica',
      description: 'Estudo tecnico sobre algoritmos de otimizacao para BESS',
      category: 'Tecnico',
      type: 'whitepaper',
      version: '1.2',
      lastUpdated: '2024-12-20',
      views: 567,
      rating: 4.7,
      downloadUrl: '#',
      size: '3.8 MB',
      tags: ['otimizacao', 'algoritmos', 'tecnico'],
      bookmarked: false,
    },
    {
      id: 'doc-5',
      title: 'FAQ - Perguntas Frequentes',
      description: 'Respostas para as duvidas mais comuns sobre o sistema EMS',
      category: 'Suporte',
      type: 'faq',
      version: '4.0',
      lastUpdated: '2025-01-20',
      views: 3456,
      rating: 4.6,
      tags: ['faq', 'suporte', 'duvidas'],
      bookmarked: true,
    },
    {
      id: 'doc-6',
      title: 'Manual de Manutencao Preventiva',
      description: 'Procedimentos e cronogramas para manutencao preventiva do sistema',
      category: 'Manutencao',
      type: 'manual',
      version: '2.5',
      lastUpdated: '2025-01-05',
      views: 789,
      rating: 4.4,
      downloadUrl: '#',
      size: '12.1 MB',
      tags: ['manutencao', 'preventiva', 'procedimentos'],
      bookmarked: false,
    },
    {
      id: 'doc-7',
      title: 'Tutorial: Integracao com Rede',
      description: 'Video sobre integracao do BESS com a rede eletrica',
      category: 'Integracao',
      type: 'video',
      version: '1.1',
      lastUpdated: '2025-01-12',
      views: 1123,
      rating: 4.8,
      videoUrl: '#',
      duration: '32:15',
      tags: ['integracao', 'rede', 'grid'],
      bookmarked: false,
    },
    {
      id: 'doc-8',
      title: 'Guia de Seguranca',
      description: 'Normas e procedimentos de seguranca para operacao do sistema',
      category: 'Seguranca',
      type: 'guide',
      version: '3.0',
      lastUpdated: '2025-01-18',
      views: 2100,
      rating: 4.9,
      downloadUrl: '#',
      size: '6.7 MB',
      tags: ['seguranca', 'normas', 'procedimentos'],
      bookmarked: false,
    },
    {
      id: 'doc-9',
      title: 'API Reference',
      description: 'Documentacao completa da API REST do sistema EMS',
      category: 'Tecnico',
      type: 'manual',
      version: '2.0',
      lastUpdated: '2025-01-22',
      views: 445,
      rating: 4.3,
      downloadUrl: '#',
      size: '2.3 MB',
      tags: ['api', 'rest', 'integracao', 'desenvolvedores'],
      bookmarked: false,
    },
    {
      id: 'doc-10',
      title: 'Tutorial: Alarmes e Alertas',
      description: 'Como configurar e gerenciar alarmes no sistema',
      category: 'Configuracao',
      type: 'video',
      version: '1.0',
      lastUpdated: '2025-01-14',
      views: 987,
      rating: 4.6,
      videoUrl: '#',
      duration: '18:45',
      tags: ['alarmes', 'alertas', 'configuracao'],
      bookmarked: false,
    },
  ], []);

  const categories = useMemo<Category[]>(() => {
    const cats: Record<string, number> = {};
    documents.forEach(doc => {
      cats[doc.category] = (cats[doc.category] || 0) + 1;
    });
    return Object.entries(cats).map(([name, count]) => ({
      name,
      count,
      icon: FolderOpen,
    }));
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      const matchesType = selectedType === 'all' || doc.type === selectedType;
      const matchesSearch = searchTerm === '' ||
        doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCategory && matchesType && matchesSearch;
    });
  }, [documents, selectedCategory, selectedType, searchTerm]);

  const recentDocs = useMemo(() => {
    return [...documents]
      .sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
      .slice(0, 5);
  }, [documents]);

  const popularDocs = useMemo(() => {
    return [...documents]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5);
  }, [documents]);

  const toggleBookmark = (docId: string) => {
    setBookmarkedDocs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const getTypeIcon = (type: Document['type']) => {
    switch (type) {
      case 'manual': return FileText;
      case 'guide': return Book;
      case 'video': return Video;
      case 'whitepaper': return File;
      case 'faq': return FileText;
      default: return File;
    }
  };

  const getTypeColor = (type: Document['type']) => {
    switch (type) {
      case 'manual': return 'text-blue-500 bg-blue-500/20';
      case 'guide': return 'text-green-500 bg-green-500/20';
      case 'video': return 'text-red-500 bg-red-500/20';
      case 'whitepaper': return 'text-purple-500 bg-purple-500/20';
      case 'faq': return 'text-amber-500 bg-amber-500/20';
      default: return 'text-gray-500 bg-gray-500/20';
    }
  };

  const getTypeLabel = (type: Document['type']) => {
    switch (type) {
      case 'manual': return 'Manual';
      case 'guide': return 'Guia';
      case 'video': return 'Video';
      case 'whitepaper': return 'Whitepaper';
      case 'faq': return 'FAQ';
      default: return type;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Documentacao</h1>
          <p className="text-foreground-muted">Manuais, guias, tutoriais e recursos tecnicos</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-surface rounded-lg border border-border p-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground-muted" />
            <input
              type="text"
              placeholder="Buscar documentos, tutoriais, guias..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <option value="all">Todos os Tipos</option>
            <option value="manual">Manuais</option>
            <option value="guide">Guias</option>
            <option value="video">Videos</option>
            <option value="whitepaper">Whitepapers</option>
            <option value="faq">FAQs</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - Categories */}
        <div className="lg:col-span-1 space-y-4">
          {/* Categories */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3">Categorias</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedCategory === 'all'
                    ? 'bg-primary/20 text-primary'
                    : 'text-foreground-muted hover:bg-surface-hover'
                }`}
              >
                <span>Todos</span>
                <span className="text-xs">{documents.length}</span>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat.name
                      ? 'bg-primary/20 text-primary'
                      : 'text-foreground-muted hover:bg-surface-hover'
                  }`}
                >
                  <span>{cat.name}</span>
                  <span className="text-xs">{cat.count}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Bookmarked */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-primary" />
              Favoritos
            </h3>
            <div className="space-y-2">
              {documents.filter(d => bookmarkedDocs.has(d.id)).map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover cursor-pointer"
                >
                  {(() => {
                    const Icon = getTypeIcon(doc.type);
                    return <Icon className="w-4 h-4 text-foreground-muted" />;
                  })()}
                  <span className="text-sm text-foreground truncate">{doc.title}</span>
                </div>
              ))}
              {documents.filter(d => bookmarkedDocs.has(d.id)).length === 0 && (
                <p className="text-sm text-foreground-muted">Nenhum favorito</p>
              )}
            </div>
          </div>

          {/* Recent */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-foreground-muted" />
              Atualizados Recentemente
            </h3>
            <div className="space-y-2">
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover cursor-pointer"
                >
                  {(() => {
                    const Icon = getTypeIcon(doc.type);
                    return <Icon className="w-4 h-4 text-foreground-muted" />;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{doc.title}</p>
                    <p className="text-xs text-foreground-muted">v{doc.version}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Popular */}
          <div className="bg-surface rounded-lg border border-border p-4">
            <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-foreground-muted" />
              Mais Populares
            </h3>
            <div className="space-y-2">
              {popularDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-surface-hover cursor-pointer"
                >
                  {(() => {
                    const Icon = getTypeIcon(doc.type);
                    return <Icon className="w-4 h-4 text-foreground-muted" />;
                  })()}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{doc.title}</p>
                    <p className="text-xs text-foreground-muted">{doc.views.toLocaleString()} views</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content - Documents */}
        <div className="lg:col-span-3">
          <div className="bg-surface rounded-lg border border-border">
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">
                  Documentos ({filteredDocuments.length})
                </h3>
                <div className="flex items-center gap-2 text-sm text-foreground-muted">
                  {selectedCategory !== 'all' && (
                    <span className="px-2 py-1 bg-primary/20 text-primary rounded-full text-xs">
                      {selectedCategory}
                    </span>
                  )}
                  {selectedType !== 'all' && (
                    <span className="px-2 py-1 bg-primary/20 text-primary rounded-full text-xs">
                      {getTypeLabel(selectedType as Document['type'])}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="divide-y divide-border">
              {filteredDocuments.map((doc) => {
                const TypeIcon = getTypeIcon(doc.type);
                return (
                  <div
                    key={doc.id}
                    className="p-4 hover:bg-surface-hover transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${getTypeColor(doc.type)}`}>
                        <TypeIcon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="font-medium text-foreground">{doc.title}</h4>
                            <p className="text-sm text-foreground-muted mt-1">{doc.description}</p>
                          </div>
                          <button
                            onClick={() => toggleBookmark(doc.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              bookmarkedDocs.has(doc.id)
                                ? 'text-primary bg-primary/20'
                                : 'text-foreground-muted hover:bg-surface-hover'
                            }`}
                          >
                            <Bookmark className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(doc.type)}`}>
                            {getTypeLabel(doc.type)}
                          </span>
                          <span className="text-xs text-foreground-muted">
                            v{doc.version}
                          </span>
                          <span className="text-xs text-foreground-muted flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(doc.lastUpdated).toLocaleDateString('pt-BR')}
                          </span>
                          <span className="text-xs text-foreground-muted flex items-center gap-1">
                            <Eye className="w-3 h-3" />
                            {doc.views.toLocaleString()}
                          </span>
                          <span className="text-xs text-foreground-muted flex items-center gap-1">
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                            {doc.rating}
                          </span>
                          {doc.size && (
                            <span className="text-xs text-foreground-muted">
                              {doc.size}
                            </span>
                          )}
                          {doc.duration && (
                            <span className="text-xs text-foreground-muted flex items-center gap-1">
                              <Play className="w-3 h-3" />
                              {doc.duration}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          {doc.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-background rounded text-xs text-foreground-muted"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                          {doc.downloadUrl && (
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors">
                              <Download className="w-4 h-4" />
                              Download
                            </button>
                          )}
                          {doc.videoUrl && (
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
                              <Play className="w-4 h-4" />
                              Assistir
                            </button>
                          )}
                          <button className="flex items-center gap-2 px-3 py-1.5 border border-border text-foreground rounded-lg text-sm hover:bg-surface-hover transition-colors">
                            <ExternalLink className="w-4 h-4" />
                            Ver Detalhes
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredDocuments.length === 0 && (
                <div className="p-8 text-center">
                  <FileText className="w-12 h-12 mx-auto text-foreground-muted mb-3" />
                  <p className="text-foreground-muted">Nenhum documento encontrado</p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-surface rounded-lg border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Book className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Guia de Inicio Rapido</h4>
                  <p className="text-xs text-foreground-muted">Comece aqui</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted ml-auto" />
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <Video className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Video Tutoriais</h4>
                  <p className="text-xs text-foreground-muted">Aprenda assistindo</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted ml-auto" />
              </div>
            </div>

            <div className="bg-surface rounded-lg border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <FileText className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <h4 className="font-medium text-foreground">Release Notes</h4>
                  <p className="text-xs text-foreground-muted">Novidades</p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground-muted ml-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
