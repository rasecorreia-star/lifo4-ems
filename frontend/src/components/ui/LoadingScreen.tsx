import { Battery } from 'lucide-react';

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <Battery className="w-16 h-16 text-primary animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-6 bg-primary/30 rounded-sm animate-pulse" />
          </div>
        </div>
        <div className="text-foreground-muted text-sm">Carregando...</div>
        <div className="w-48 h-1 bg-surface rounded-full overflow-hidden">
          <div className="h-full bg-primary animate-pulse rounded-full" style={{ width: '60%' }} />
        </div>
      </div>
    </div>
  );
}
