import { Link } from 'react-router-dom';
import { Home, ArrowLeft, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        {/* 404 Number */}
        <div className="relative mb-8">
          <span className="text-[150px] font-bold text-surface leading-none">404</span>
          <div className="absolute inset-0 flex items-center justify-center">
            <Search className="w-20 h-20 text-primary animate-pulse" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-foreground mb-4">
          Página não encontrada
        </h1>
        <p className="text-foreground-muted mb-8">
          A página que você está procurando não existe ou foi movida para outro endereço.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary hover:bg-primary-600 text-white font-medium rounded-lg transition-colors"
          >
            <Home className="w-5 h-5" />
            Ir para o Dashboard
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-surface hover:bg-surface-hover text-foreground font-medium rounded-lg border border-border transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
