import { useState } from 'react';
import { Zap, Thermometer, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';
import { cn, formatVoltage } from '@/lib/utils';
import { CellData } from '@/types';

interface CellGridProps {
  cells: CellData[];
  nominalVoltage?: number;
  showDetails?: boolean;
  onCellClick?: (cellIndex: number) => void;
}

export default function CellGrid({
  cells,
  nominalVoltage: _nominalVoltage = 3.2,
  showDetails = true,
  onCellClick
}: CellGridProps) {
  const [selectedCell, setSelectedCell] = useState<number | null>(null);

  // Calculate statistics
  const voltages = cells.map(c => c.voltage);
  const minVoltage = Math.min(...voltages);
  const maxVoltage = Math.max(...voltages);
  const avgVoltage = voltages.reduce((a, b) => a + b, 0) / voltages.length;
  const deltaVoltage = maxVoltage - minVoltage;
  const totalVoltage = voltages.reduce((a, b) => a + b, 0);

  const minCellIndex = voltages.indexOf(minVoltage);
  const maxCellIndex = voltages.indexOf(maxVoltage);

  const balancingCount = cells.filter(c => c.isBalancing).length;
  const criticalCount = cells.filter(c => c.status === 'critical').length;
  const attentionCount = cells.filter(c => c.status === 'attention').length;

  const handleCellClick = (index: number) => {
    setSelectedCell(selectedCell === index ? null : index);
    onCellClick?.(index);
  };

  const getCellColor = (cell: CellData, index: number) => {
    if (cell.isBalancing) {
      return 'bg-secondary/30 border-secondary ring-2 ring-secondary/50';
    }

    switch (cell.status) {
      case 'critical':
        return 'bg-danger-500/30 border-danger-500 ring-2 ring-danger-500/50 animate-pulse';
      case 'attention':
        return 'bg-warning-500/30 border-warning-500';
      case 'normal':
      default:
        // Highlight min/max cells
        if (index === minCellIndex) {
          return 'bg-blue-500/20 border-blue-500';
        }
        if (index === maxCellIndex) {
          return 'bg-orange-500/20 border-orange-500';
        }
        return 'bg-success-500/20 border-success-500/50';
    }
  };

  const getVoltageBarWidth = (voltage: number) => {
    const minV = 2.5; // LiFePO4 min
    const maxV = 3.65; // LiFePO4 max
    const percent = ((voltage - minV) / (maxV - minV)) * 100;
    return Math.max(0, Math.min(100, percent));
  };

  const getVoltageBarColor = (voltage: number) => {
    if (voltage >= 3.6) return 'bg-danger-500';
    if (voltage >= 3.5) return 'bg-warning-500';
    if (voltage <= 2.8) return 'bg-danger-500';
    if (voltage <= 3.0) return 'bg-warning-500';
    return 'bg-success-500';
  };

  return (
    <div className="space-y-4">
      {/* Statistics Header */}
      {showDetails && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label="Tensao Total"
            value={formatVoltage(totalVoltage)}
            icon={Zap}
            color="primary"
          />
          <StatCard
            label="Delta"
            value={`${(deltaVoltage * 1000).toFixed(1)}mV`}
            icon={deltaVoltage > 0.05 ? AlertTriangle : TrendingUp}
            color={deltaVoltage > 0.1 ? 'danger' : deltaVoltage > 0.05 ? 'warning' : 'success'}
          />
          <StatCard
            label="Min (C{minCellIndex + 1})"
            value={formatVoltage(minVoltage)}
            icon={TrendingDown}
            color="secondary"
          />
          <StatCard
            label="Max (C{maxCellIndex + 1})"
            value={formatVoltage(maxVoltage)}
            icon={TrendingUp}
            color="warning"
          />
        </div>
      )}

      {/* Cell Grid 4x4 */}
      <div className="bg-background rounded-xl p-4 border border-border">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {cells.map((cell, index) => (
            <button
              key={index}
              onClick={() => handleCellClick(index)}
              className={cn(
                'relative p-2 sm:p-3 rounded-lg border-2 transition-all hover:scale-105 cursor-pointer',
                getCellColor(cell, index),
                selectedCell === index && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
              )}
            >
              {/* Cell Number */}
              <div className="absolute -top-2 -left-2 w-5 h-5 bg-surface rounded-full flex items-center justify-center text-2xs font-bold text-foreground-muted border border-border">
                {index + 1}
              </div>

              {/* Balancing Indicator */}
              {cell.isBalancing && (
                <div className="absolute -top-1 -right-1">
                  <Zap className="w-4 h-4 text-secondary animate-pulse" />
                </div>
              )}

              {/* Voltage */}
              <div className="text-center">
                <p className="text-sm sm:text-lg font-bold text-foreground">
                  {cell.voltage.toFixed(3)}
                </p>
                <p className="text-2xs text-foreground-muted">V</p>
              </div>

              {/* Voltage Bar */}
              <div className="mt-2 h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', getVoltageBarColor(cell.voltage))}
                  style={{ width: `${getVoltageBarWidth(cell.voltage)}%` }}
                />
              </div>

              {/* Temperature (if available) */}
              {cell.temperature !== undefined && (
                <div className="mt-1 flex items-center justify-center gap-1 text-2xs text-foreground-muted">
                  <Thermometer className="w-3 h-3" />
                  {cell.temperature.toFixed(0)}°C
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-foreground-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-success-500/50 border border-success-500" />
          <span>Normal (3.0-3.5V)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-warning-500/50 border border-warning-500" />
          <span>Atencao</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-danger-500/50 border border-danger-500" />
          <span>Critico</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-secondary/50 border border-secondary" />
          <span>Balanceando</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500/30 border border-blue-500" />
          <span>Menor</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500/30 border border-orange-500" />
          <span>Maior</span>
        </div>
      </div>

      {/* Status Summary */}
      {showDetails && (
        <div className="flex items-center justify-center gap-6 text-sm">
          {balancingCount > 0 && (
            <div className="flex items-center gap-2 text-secondary">
              <Zap className="w-4 h-4" />
              <span>{balancingCount} balanceando</span>
            </div>
          )}
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 text-danger-500">
              <AlertTriangle className="w-4 h-4" />
              <span>{criticalCount} criticas</span>
            </div>
          )}
          {attentionCount > 0 && (
            <div className="flex items-center gap-2 text-warning-500">
              <AlertTriangle className="w-4 h-4" />
              <span>{attentionCount} atencao</span>
            </div>
          )}
          {criticalCount === 0 && attentionCount === 0 && balancingCount === 0 && (
            <div className="text-success-500">Todas as celulas normais</div>
          )}
        </div>
      )}

      {/* Selected Cell Details */}
      {selectedCell !== null && cells[selectedCell] && (
        <div className="bg-surface rounded-lg border border-border p-4 animate-fade-in">
          <h4 className="font-semibold text-foreground mb-3">
            Celula {selectedCell + 1} - Detalhes
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-foreground-muted">Tensao</p>
              <p className="text-lg font-bold text-foreground">
                {cells[selectedCell].voltage.toFixed(3)}V
              </p>
            </div>
            <div>
              <p className="text-xs text-foreground-muted">Status</p>
              <p className={cn(
                'text-lg font-bold capitalize',
                cells[selectedCell].status === 'normal' && 'text-success-500',
                cells[selectedCell].status === 'attention' && 'text-warning-500',
                cells[selectedCell].status === 'critical' && 'text-danger-500'
              )}>
                {cells[selectedCell].status === 'normal' ? 'Normal' :
                 cells[selectedCell].status === 'attention' ? 'Atencao' : 'Critico'}
              </p>
            </div>
            {cells[selectedCell].temperature !== undefined && (
              <div>
                <p className="text-xs text-foreground-muted">Temperatura</p>
                <p className="text-lg font-bold text-foreground">
                  {cells[selectedCell].temperature?.toFixed(1)}°C
                </p>
              </div>
            )}
            <div>
              <p className="text-xs text-foreground-muted">Balanceamento</p>
              <p className={cn(
                'text-lg font-bold',
                cells[selectedCell].isBalancing ? 'text-secondary' : 'text-foreground-muted'
              )}>
                {cells[selectedCell].isBalancing ? 'Ativo' : 'Inativo'}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs text-foreground-muted">
              Desvio da media: {((cells[selectedCell].voltage - avgVoltage) * 1000).toFixed(1)}mV
              {cells[selectedCell].voltage > avgVoltage ? ' acima' : ' abaixo'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Stat Card Component
interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
}

function StatCard({ label, value, icon: Icon, color }: StatCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success-500 bg-success-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    danger: 'text-danger-500 bg-danger-500/10',
    secondary: 'text-secondary bg-secondary/10',
  };

  return (
    <div className="bg-surface rounded-lg border border-border p-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('p-1 rounded', colorClasses[color])}>
          <Icon className="w-3 h-3" />
        </div>
        <span className="text-xs text-foreground-muted">{label}</span>
      </div>
      <p className={cn('text-lg font-bold', colorClasses[color].split(' ')[0])}>
        {value}
      </p>
    </div>
  );
}
