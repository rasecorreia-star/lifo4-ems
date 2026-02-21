/**
 * Power Flow Diagram Component
 * Real-time visualization of Solar + BESS + Grid energy flow
 * with animated energy particles
 */

import React, { useEffect, useRef } from 'react';
import { Battery, Sun, Zap, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PowerFlowData {
  solarPower: number;
  bessPower: number;
  gridPower: number;
  loadPower: number;
  bessSoc: number;
  bessState: 'charging' | 'discharging' | 'idle' | 'standby';
  selfConsumptionRate: number;
  solarEnergyToday: number;
  gridImportToday: number;
  gridExportToday: number;
}

interface PowerFlowDiagramProps {
  data: PowerFlowData | null;
  className?: string;
}

export const PowerFlowDiagram: React.FC<PowerFlowDiagramProps> = ({ data, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  interface Particle {
    x: number;
    y: number;
    targetX: number;
    targetY: number;
    startX: number;
    startY: number;
    progress: number;
    speed: number;
    color: string;
    size: number;
  }

  // Animation loop
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const resizeCanvas = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (rect) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Node positions (relative to canvas)
    const getPositions = () => {
      const w = canvas.width;
      const h = canvas.height;
      return {
        solar: { x: w / 2, y: h * 0.15 },
        grid: { x: w * 0.15, y: h * 0.5 },
        bess: { x: w / 2, y: h * 0.5 },
        load: { x: w * 0.85, y: h * 0.5 },
        center: { x: w / 2, y: h * 0.5 },
      };
    };

    // Create particles based on power flow
    const createParticle = (
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      color: string
    ): Particle => ({
      x: startX,
      y: startY,
      targetX: endX,
      targetY: endY,
      startX,
      startY,
      progress: 0,
      speed: 0.015 + Math.random() * 0.01,
      color,
      size: 3 + Math.random() * 2,
    });

    // Spawn particles based on data
    let lastSpawn = 0;
    const spawnInterval = 300; // ms

    const spawnParticles = (timestamp: number) => {
      if (timestamp - lastSpawn < spawnInterval) return;
      lastSpawn = timestamp;

      const pos = getPositions();

      // Solar to load (if solar is generating)
      if (data.solarPower > 0 && data.loadPower > 0) {
        particlesRef.current.push(
          createParticle(pos.solar.x, pos.solar.y, pos.load.x, pos.load.y, '#FBBF24')
        );
      }

      // Solar to BESS (if charging from solar)
      if (data.solarPower > 0 && data.bessPower < 0) {
        particlesRef.current.push(
          createParticle(pos.solar.x, pos.solar.y, pos.bess.x, pos.bess.y, '#34D399')
        );
      }

      // Solar to grid (exporting)
      if (data.solarPower > 0 && data.gridPower < 0) {
        particlesRef.current.push(
          createParticle(pos.solar.x, pos.solar.y, pos.grid.x, pos.grid.y, '#10B981')
        );
      }

      // BESS to load (discharging)
      if (data.bessPower > 0) {
        particlesRef.current.push(
          createParticle(pos.bess.x, pos.bess.y, pos.load.x, pos.load.y, '#F97316')
        );
      }

      // Grid to load (importing)
      if (data.gridPower > 0) {
        particlesRef.current.push(
          createParticle(pos.grid.x, pos.grid.y, pos.load.x, pos.load.y, '#3B82F6')
        );
      }

      // Grid to BESS (charging from grid)
      if (data.gridPower > 0 && data.bessPower < 0) {
        particlesRef.current.push(
          createParticle(pos.grid.x, pos.grid.y, pos.bess.x, pos.bess.y, '#60A5FA')
        );
      }

      // Limit particles
      if (particlesRef.current.length > 50) {
        particlesRef.current = particlesRef.current.slice(-30);
      }
    };

    // Draw flow lines
    const drawFlowLines = () => {
      const pos = getPositions();
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      // Solar to load
      if (data.solarPower > 0) {
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.3)';
        ctx.beginPath();
        ctx.moveTo(pos.solar.x, pos.solar.y);
        ctx.lineTo(pos.load.x, pos.load.y);
        ctx.stroke();
      }

      // Solar to BESS
      if (data.solarPower > 0 && data.bessPower < 0) {
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.3)';
        ctx.beginPath();
        ctx.moveTo(pos.solar.x, pos.solar.y);
        ctx.lineTo(pos.bess.x, pos.bess.y);
        ctx.stroke();
      }

      // BESS to load
      if (data.bessPower > 0) {
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.3)';
        ctx.beginPath();
        ctx.moveTo(pos.bess.x, pos.bess.y);
        ctx.lineTo(pos.load.x, pos.load.y);
        ctx.stroke();
      }

      // Grid to load or load to grid
      ctx.strokeStyle = data.gridPower > 0
        ? 'rgba(59, 130, 246, 0.3)'
        : 'rgba(16, 185, 129, 0.3)';
      ctx.beginPath();
      ctx.moveTo(pos.grid.x, pos.grid.y);
      ctx.lineTo(pos.load.x, pos.load.y);
      ctx.stroke();

      // Grid to BESS
      if (data.gridPower > 0 && data.bessPower < 0) {
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
        ctx.beginPath();
        ctx.moveTo(pos.grid.x, pos.grid.y);
        ctx.lineTo(pos.bess.x, pos.bess.y);
        ctx.stroke();
      }

      ctx.setLineDash([]);
    };

    // Animation frame
    const animate = (timestamp: number) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw flow lines
      drawFlowLines();

      // Spawn new particles
      spawnParticles(timestamp);

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter((p) => {
        p.progress += p.speed;

        if (p.progress >= 1) return false;

        // Easing function for smooth movement
        const ease = (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        const t = ease(p.progress);

        p.x = p.startX + (p.targetX - p.startX) * t;
        p.y = p.startY + (p.targetY - p.startY) * t;

        // Draw particle with glow
        ctx.beginPath();
        const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        gradient.addColorStop(0, p.color);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();

        // Core
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        return true;
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [data]);

  if (!data) {
    return (
      <div className={cn('bg-surface rounded-xl border border-border p-6', className)}>
        <div className="text-center text-foreground-muted">Carregando dados de fluxo...</div>
      </div>
    );
  }

  const formatPower = (power: number) => {
    if (Math.abs(power) >= 1000) {
      return `${(power / 1000).toFixed(1)} MW`;
    }
    return `${power.toFixed(1)} kW`;
  };

  const formatEnergy = (energy: number) => {
    if (energy >= 1000) {
      return `${(energy / 1000).toFixed(1)} MWh`;
    }
    return `${energy.toFixed(1)} kWh`;
  };

  return (
    <div className={cn('bg-surface rounded-xl border border-border p-6', className)}>
      <h3 className="text-lg font-semibold text-foreground mb-4">Fluxo de Energia em Tempo Real</h3>

      <div className="relative" style={{ height: '320px' }}>
        {/* Canvas for animated particles */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1 }}
        />

        {/* Static node elements */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-4 p-4" style={{ zIndex: 2 }}>
          {/* Solar - Top Center */}
          <div className="col-start-2 row-start-1 flex flex-col items-center justify-center">
            <div className={cn(
              'p-4 rounded-full transition-all duration-300',
              data.solarPower > 0
                ? 'bg-yellow-500/20 ring-2 ring-yellow-500 shadow-lg shadow-yellow-500/20'
                : 'bg-surface-hover'
            )}>
              <Sun className={cn(
                'w-10 h-10 transition-colors',
                data.solarPower > 0 ? 'text-yellow-400' : 'text-foreground-muted'
              )} />
            </div>
            <span className="text-foreground font-medium mt-2">Solar</span>
            <span className={cn(
              'text-sm font-bold',
              data.solarPower > 0 ? 'text-yellow-400' : 'text-foreground-muted'
            )}>
              {formatPower(data.solarPower)}
            </span>
          </div>

          {/* Grid - Left */}
          <div className="col-start-1 row-start-2 flex flex-col items-center justify-center">
            <div className={cn(
              'p-4 rounded-full transition-all duration-300',
              data.gridPower > 0
                ? 'bg-blue-500/20 ring-2 ring-blue-500 shadow-lg shadow-blue-500/20'
                : data.gridPower < 0
                  ? 'bg-green-500/20 ring-2 ring-green-500 shadow-lg shadow-green-500/20'
                  : 'bg-surface-hover'
            )}>
              <Zap className={cn(
                'w-10 h-10 transition-colors',
                data.gridPower > 0
                  ? 'text-blue-400'
                  : data.gridPower < 0
                    ? 'text-green-400'
                    : 'text-foreground-muted'
              )} />
            </div>
            <span className="text-foreground font-medium mt-2">Rede</span>
            <span className={cn(
              'text-sm font-bold',
              data.gridPower > 0 ? 'text-blue-400' : data.gridPower < 0 ? 'text-green-400' : 'text-foreground-muted'
            )}>
              {data.gridPower > 0 ? '+' : ''}{formatPower(data.gridPower)}
            </span>
            <span className="text-xs text-foreground-muted">
              {data.gridPower > 0 ? 'Importando' : data.gridPower < 0 ? 'Exportando' : 'Inativo'}
            </span>
          </div>

          {/* BESS - Center */}
          <div className="col-start-2 row-start-2 flex flex-col items-center justify-center">
            <div className={cn(
              'p-4 rounded-full relative transition-all duration-300',
              data.bessState === 'charging'
                ? 'bg-green-500/20 ring-2 ring-green-500 shadow-lg shadow-green-500/20'
                : data.bessState === 'discharging'
                  ? 'bg-orange-500/20 ring-2 ring-orange-500 shadow-lg shadow-orange-500/20'
                  : 'bg-surface-hover'
            )}>
              <Battery className={cn(
                'w-10 h-10 transition-colors',
                data.bessState === 'charging'
                  ? 'text-green-400'
                  : data.bessState === 'discharging'
                    ? 'text-orange-400'
                    : 'text-foreground-muted'
              )} />
              {/* SOC Badge */}
              <div className="absolute -bottom-1 -right-1 bg-background border border-border rounded-full px-2 py-0.5 text-xs font-bold">
                <span className={cn(
                  data.bessSoc > 50 ? 'text-green-400' : data.bessSoc > 20 ? 'text-yellow-400' : 'text-red-400'
                )}>
                  {data.bessSoc.toFixed(0)}%
                </span>
              </div>
            </div>
            <span className="text-foreground font-medium mt-2">BESS</span>
            <span className={cn(
              'text-sm font-bold',
              data.bessState === 'charging'
                ? 'text-green-400'
                : data.bessState === 'discharging'
                  ? 'text-orange-400'
                  : 'text-foreground-muted'
            )}>
              {formatPower(Math.abs(data.bessPower))}
            </span>
            <span className="text-xs text-foreground-muted">
              {data.bessState === 'charging' ? 'Carregando' :
               data.bessState === 'discharging' ? 'Descarregando' : 'Standby'}
            </span>
          </div>

          {/* Load - Right */}
          <div className="col-start-3 row-start-2 flex flex-col items-center justify-center">
            <div className={cn(
              'p-4 rounded-full transition-all duration-300',
              data.loadPower > 0
                ? 'bg-purple-500/20 ring-2 ring-purple-500 shadow-lg shadow-purple-500/20'
                : 'bg-surface-hover'
            )}>
              <Home className={cn(
                'w-10 h-10 transition-colors',
                data.loadPower > 0 ? 'text-purple-400' : 'text-foreground-muted'
              )} />
            </div>
            <span className="text-foreground font-medium mt-2">Carga</span>
            <span className={cn(
              'text-sm font-bold',
              data.loadPower > 0 ? 'text-purple-400' : 'text-foreground-muted'
            )}>
              {formatPower(data.loadPower)}
            </span>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-border">
        <div className="text-center">
          <div className="text-xl font-bold text-yellow-400">
            {formatEnergy(data.solarEnergyToday)}
          </div>
          <div className="text-xs text-foreground-muted">Solar Hoje</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-blue-400">
            {formatEnergy(data.gridImportToday)}
          </div>
          <div className="text-xs text-foreground-muted">Importado</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-green-400">
            {formatEnergy(data.gridExportToday)}
          </div>
          <div className="text-xs text-foreground-muted">Exportado</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-purple-400">
            {data.selfConsumptionRate.toFixed(0)}%
          </div>
          <div className="text-xs text-foreground-muted">Autoconsumo</div>
        </div>
      </div>
    </div>
  );
};

export default PowerFlowDiagram;
