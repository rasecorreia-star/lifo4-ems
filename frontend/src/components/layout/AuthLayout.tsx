import { Outlet, Navigate } from 'react-router-dom';
import { Zap, Battery } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export default function AuthLayout() {
  const { isAuthenticated } = useAuthStore();

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-900 via-primary-800 to-background relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-primary rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-center w-full p-12">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center backdrop-blur">
              <Zap className="w-10 h-10 text-primary" />
            </div>
            <div>
              <span className="text-4xl font-bold text-white">Lifo4</span>
              <span className="text-4xl font-semibold text-primary ml-2">EMS</span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-4">
            Energy Management System
          </h1>
          <p className="text-lg text-foreground-muted text-center max-w-md mb-12">
            Plataforma profissional para monitoramento, controle e otimização de sistemas de baterias LiFePO4.
          </p>

          {/* Features */}
          <div className="grid grid-cols-2 gap-6 max-w-lg">
            <FeatureCard
              icon="battery"
              title="Monitoramento"
              description="Telemetria em tempo real"
            />
            <FeatureCard
              icon="shield"
              title="Proteção"
              description="Alarmes e diagnósticos"
            />
            <FeatureCard
              icon="zap"
              title="Controle"
              description="Operação remota"
            />
            <FeatureCard
              icon="chart"
              title="Relatórios"
              description="Análise de desempenho"
            />
          </div>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex flex-col justify-center items-center p-8">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Zap className="w-7 h-7 text-primary" />
          </div>
          <div>
            <span className="text-2xl font-bold text-foreground">Lifo4</span>
            <span className="text-2xl font-semibold text-primary ml-1">EMS</span>
          </div>
        </div>

        <Outlet />

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-foreground-muted">
          <p>&copy; {new Date().getFullYear()} Lifo4 Energia LTDA</p>
          <p className="mt-1">Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="bg-white/5 backdrop-blur rounded-xl p-4 border border-white/10">
      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-3">
        {icon === 'battery' && <Battery className="w-5 h-5 text-primary" />}
        {icon === 'shield' && (
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        )}
        {icon === 'zap' && <Zap className="w-5 h-5 text-primary" />}
        {icon === 'chart' && (
          <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        )}
      </div>
      <h3 className="text-white font-medium mb-1">{title}</h3>
      <p className="text-foreground-muted text-sm">{description}</p>
    </div>
  );
}
