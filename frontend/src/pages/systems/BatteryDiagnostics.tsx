/**
 * Battery Diagnostics Page
 * Cell-level monitoring, balancing status, and health diagnostics
 */

import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Battery,
  Thermometer,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Download,
  TrendingUp,
  TrendingDown,
  Zap,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CellData {
  id: number;
  voltage: number;
  temperature: number;
  soh: number;
  balancing: boolean;
  status: 'normal' | 'warning' | 'critical';
  deltaVoltage: number;
  cycles: number;
}

interface ModuleData {
  id: number;
  name: string;
  cells: CellData[];
  avgVoltage: number;
  avgTemperature: number;
  avgSoh: number;
  status: 'normal' | 'warning' | 'critical';
}

interface DiagnosticsData {
  systemId: string;
  systemName: string;
  modules: ModuleData[];
  summary: {
    totalCells: number;
    normalCells: number;
    warningCells: number;
    criticalCells: number;
    balancingActive: number;
    avgVoltage: number;
    minVoltage: number;
    maxVoltage: number;
    deltaVoltage: number;
    avgTemperature: number;
    minTemperature: number;
    maxTemperature: number;
    avgSoh: number;
    minSoh: number;
  };
  lastUpdate: Date;
}

// Generate mock cell data
const generateCellData = (cellId: number): CellData => {
  const baseVoltage = 3.2 + Math.random() * 0.4;
  const voltage = Number(baseVoltage.toFixed(3));
  const temperature = 25 + Math.random() * 15;
  const soh = 85 + Math.random() * 15;
  const deltaVoltage = (Math.random() - 0.5) * 0.1;

  let status: 'normal' | 'warning' | 'critical' = 'normal';
  if (voltage < 3.0 || voltage > 3.65 || temperature > 45 || soh < 70) {
    status = 'critical';
  } else if (voltage < 3.1 || voltage > 3.55 || temperature > 38 || soh < 80) {
    status = 'warning';
  }

  return {
    id: cellId,
    voltage,
    temperature: Number(temperature.toFixed(1)),
    soh: Number(soh.toFixed(1)),
    balancing: Math.random() > 0.85,
    status,
    deltaVoltage: Number(deltaVoltage.toFixed(3)),
    cycles: Math.floor(500 + Math.random() * 1500),
  };
};

// Generate mock module data
const generateModuleData = (moduleId: number, cellsPerModule: number = 16): ModuleData => {
  const cells = Array.from({ length: cellsPerModule }, (_, i) =>
    generateCellData(moduleId * 100 + i + 1)
  );

  const avgVoltage = cells.reduce((sum, c) => sum + c.voltage, 0) / cells.length;
  const avgTemperature = cells.reduce((sum, c) => sum + c.temperature, 0) / cells.length;
  const avgSoh = cells.reduce((sum, c) => sum + c.soh, 0) / cells.length;

  const hasCritical = cells.some(c => c.status === 'critical');
  const hasWarning = cells.some(c => c.status === 'warning');

  return {
    id: moduleId,
    name: `Modulo ${moduleId + 1}`,
    cells,
    avgVoltage: Number(avgVoltage.toFixed(3)),
    avgTemperature: Number(avgTemperature.toFixed(1)),
    avgSoh: Number(avgSoh.toFixed(1)),
    status: hasCritical ? 'critical' : hasWarning ? 'warning' : 'normal',
  };
};

// Generate full diagnostics data
const generateDiagnosticsData = (systemId: string): DiagnosticsData => {
  const modules = Array.from({ length: 8 }, (_, i) => generateModuleData(i, 16));
  const allCells = modules.flatMap(m => m.cells);

  const voltages = allCells.map(c => c.voltage);
  const temperatures = allCells.map(c => c.temperature);
  const sohs = allCells.map(c => c.soh);

  return {
    systemId,
    systemName: 'BESS Principal',
    modules,
    summary: {
      totalCells: allCells.length,
      normalCells: allCells.filter(c => c.status === 'normal').length,
      warningCells: allCells.filter(c => c.status === 'warning').length,
      criticalCells: allCells.filter(c => c.status === 'critical').length,
      balancingActive: allCells.filter(c => c.balancing).length,
      avgVoltage: Number((voltages.reduce((a, b) => a + b, 0) / voltages.length).toFixed(3)),
      minVoltage: Math.min(...voltages),
      maxVoltage: Math.max(...voltages),
      deltaVoltage: Number((Math.max(...voltages) - Math.min(...voltages)).toFixed(3)),
      avgTemperature: Number((temperatures.reduce((a, b) => a + b, 0) / temperatures.length).toFixed(1)),
      minTemperature: Number(Math.min(...temperatures).toFixed(1)),
      maxTemperature: Number(Math.max(...temperatures).toFixed(1)),
      avgSoh: Number((sohs.reduce((a, b) => a + b, 0) / sohs.length).toFixed(1)),
      minSoh: Number(Math.min(...sohs).toFixed(1)),
    },
    lastUpdate: new Date(),
  };
};

export default function BatteryDiagnostics() {
  const { systemId } = useParams<{ systemId: string }>();
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    setIsRefreshing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    setData(generateDiagnosticsData(systemId || 'sys-1'));
    setIsRefreshing(false);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [systemId]);

  if (isLoading || !data) {
    return <DiagnosticsSkeleton />;
  }

  const selectedModuleData = selectedModule !== null
    ? data.modules.find(m => m.id === selectedModule)
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/systems/${systemId}`}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Diagnostico de Bateria</h1>
            <p className="text-foreground-muted text-sm">{data.systemName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground"
            title={viewMode === 'grid' ? 'Modo lista' : 'Modo grade'}
          >
            <BarChart3 className="w-5 h-5" />
          </button>
          <button
            onClick={fetchData}
            disabled={isRefreshing}
            className="p-2 hover:bg-surface-hover rounded-lg transition-colors text-foreground-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <SummaryCard
          title="Total de Celulas"
          value={data.summary.totalCells}
          icon={Battery}
          color="primary"
        />
        <SummaryCard
          title="Celulas OK"
          value={data.summary.normalCells}
          icon={CheckCircle}
          color="success"
          subtitle={`${((data.summary.normalCells / data.summary.totalCells) * 100).toFixed(1)}%`}
        />
        <SummaryCard
          title="Alerta"
          value={data.summary.warningCells}
          icon={AlertTriangle}
          color="warning"
          highlight={data.summary.warningCells > 0}
        />
        <SummaryCard
          title="Critico"
          value={data.summary.criticalCells}
          icon={XCircle}
          color="danger"
          highlight={data.summary.criticalCells > 0}
        />
        <SummaryCard
          title="Balanceando"
          value={data.summary.balancingActive}
          icon={Activity}
          color="secondary"
          subtitle="celulas ativas"
        />
      </div>

      {/* Voltage & Temperature Summary */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Voltage Stats */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-foreground">Tensao das Celulas</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Media</span>
              <span className="font-medium text-foreground">{data.summary.avgVoltage}V</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Minima</span>
              <span className="font-medium text-danger-500">{data.summary.minVoltage}V</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Maxima</span>
              <span className="font-medium text-success-500">{data.summary.maxVoltage}V</span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted text-sm">Delta</span>
                <span className={cn(
                  'font-medium',
                  data.summary.deltaVoltage > 0.1 ? 'text-warning-500' :
                  data.summary.deltaVoltage > 0.2 ? 'text-danger-500' : 'text-success-500'
                )}>
                  {data.summary.deltaVoltage}V
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Temperature Stats */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Thermometer className="w-5 h-5 text-warning-500" />
            <h3 className="font-semibold text-foreground">Temperatura das Celulas</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Media</span>
              <span className="font-medium text-foreground">{data.summary.avgTemperature}°C</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Minima</span>
              <span className="font-medium text-blue-400">{data.summary.minTemperature}°C</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Maxima</span>
              <span className={cn(
                'font-medium',
                data.summary.maxTemperature > 45 ? 'text-danger-500' :
                data.summary.maxTemperature > 38 ? 'text-warning-500' : 'text-success-500'
              )}>
                {data.summary.maxTemperature}°C
              </span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-foreground-muted text-sm">Delta</span>
                <span className="font-medium text-foreground">
                  {(data.summary.maxTemperature - data.summary.minTemperature).toFixed(1)}°C
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SOH Stats */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-success-500" />
            <h3 className="font-semibold text-foreground">Estado de Saude (SOH)</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Media</span>
              <span className="font-medium text-foreground">{data.summary.avgSoh}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-foreground-muted text-sm">Minimo</span>
              <span className={cn(
                'font-medium',
                data.summary.minSoh < 70 ? 'text-danger-500' :
                data.summary.minSoh < 80 ? 'text-warning-500' : 'text-success-500'
              )}>
                {data.summary.minSoh}%
              </span>
            </div>
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-sm">
                {data.summary.avgSoh >= 90 ? (
                  <>
                    <TrendingUp className="w-4 h-4 text-success-500" />
                    <span className="text-success-500">Excelente condicao</span>
                  </>
                ) : data.summary.avgSoh >= 80 ? (
                  <>
                    <TrendingDown className="w-4 h-4 text-warning-500" />
                    <span className="text-warning-500">Boa condicao</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 text-danger-500" />
                    <span className="text-danger-500">Requer atencao</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Module Selector */}
      <div className="bg-surface rounded-xl border border-border">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">Modulos</h3>
          <p className="text-sm text-foreground-muted">Selecione um modulo para ver detalhes das celulas</p>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 lg:grid-cols-8 gap-2">
            {data.modules.map((module) => (
              <button
                key={module.id}
                onClick={() => setSelectedModule(selectedModule === module.id ? null : module.id)}
                className={cn(
                  'p-3 rounded-lg border transition-all text-center',
                  selectedModule === module.id
                    ? 'border-primary bg-primary/10'
                    : module.status === 'critical'
                    ? 'border-danger-500/50 bg-danger-500/10 hover:bg-danger-500/20'
                    : module.status === 'warning'
                    ? 'border-warning-500/50 bg-warning-500/10 hover:bg-warning-500/20'
                    : 'border-border hover:border-primary/50 hover:bg-surface-hover'
                )}
              >
                <div className="text-sm font-medium text-foreground">{module.name}</div>
                <div className="text-xs text-foreground-muted mt-1">
                  {module.avgVoltage}V
                </div>
                {module.status !== 'normal' && (
                  <div className={cn(
                    'mt-1 text-2xs font-medium',
                    module.status === 'critical' ? 'text-danger-500' : 'text-warning-500'
                  )}>
                    {module.cells.filter(c => c.status !== 'normal').length} alertas
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cell Details */}
      {selectedModuleData && (
        <div className="bg-surface rounded-xl border border-border animate-fade-in">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-foreground">{selectedModuleData.name} - Celulas</h3>
              <p className="text-sm text-foreground-muted">
                {selectedModuleData.cells.length} celulas | Media: {selectedModuleData.avgVoltage}V | {selectedModuleData.avgTemperature}°C
              </p>
            </div>
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              selectedModuleData.status === 'critical' ? 'bg-danger-500/20 text-danger-500' :
              selectedModuleData.status === 'warning' ? 'bg-warning-500/20 text-warning-500' :
              'bg-success-500/20 text-success-500'
            )}>
              {selectedModuleData.status === 'critical' ? 'Critico' :
               selectedModuleData.status === 'warning' ? 'Alerta' : 'Normal'}
            </div>
          </div>

          {viewMode === 'grid' ? (
            <div className="p-4 grid grid-cols-4 lg:grid-cols-8 gap-2">
              {selectedModuleData.cells.map((cell) => (
                <CellCard key={cell.id} cell={cell} />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {selectedModuleData.cells.map((cell) => (
                <CellRow key={cell.id} cell={cell} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* No Module Selected */}
      {!selectedModuleData && (
        <div className="bg-surface rounded-xl border border-border p-8 text-center">
          <Battery className="w-12 h-12 mx-auto mb-4 text-foreground-subtle" />
          <p className="text-foreground-muted">Selecione um modulo acima para ver os detalhes das celulas</p>
        </div>
      )}
    </div>
  );
}

// Summary Card Component
interface SummaryCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'secondary';
  subtitle?: string;
  highlight?: boolean;
}

function SummaryCard({ title, value, icon: Icon, color, subtitle, highlight }: SummaryCardProps) {
  const colorClasses = {
    primary: 'text-primary bg-primary/10',
    success: 'text-success-500 bg-success-500/10',
    warning: 'text-warning-500 bg-warning-500/10',
    danger: 'text-danger-500 bg-danger-500/10',
    secondary: 'text-secondary bg-secondary/10',
  };

  return (
    <div className={cn(
      'bg-surface rounded-xl p-4 border transition-all',
      highlight ? 'border-danger-500 shadow-glow-red' : 'border-border'
    )}>
      <div className={cn('p-2 rounded-lg w-fit mb-2', colorClasses[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-sm text-foreground-muted">{title}</p>
      {subtitle && (
        <p className="text-xs text-foreground-subtle mt-1">{subtitle}</p>
      )}
    </div>
  );
}

// Cell Card Component (Grid View)
function CellCard({ cell }: { cell: CellData }) {
  return (
    <div className={cn(
      'p-2 rounded-lg border text-center transition-all hover:scale-105',
      cell.status === 'critical' ? 'border-danger-500 bg-danger-500/10' :
      cell.status === 'warning' ? 'border-warning-500 bg-warning-500/10' :
      'border-border bg-surface-hover'
    )}>
      <div className="text-xs text-foreground-muted">#{cell.id % 100}</div>
      <div className={cn(
        'text-sm font-bold',
        cell.status === 'critical' ? 'text-danger-500' :
        cell.status === 'warning' ? 'text-warning-500' : 'text-foreground'
      )}>
        {cell.voltage}V
      </div>
      <div className="text-xs text-foreground-muted">{cell.temperature}°C</div>
      {cell.balancing && (
        <div className="mt-1">
          <span className="px-1.5 py-0.5 bg-secondary/20 text-secondary text-2xs rounded-full">
            BAL
          </span>
        </div>
      )}
    </div>
  );
}

// Cell Row Component (List View)
function CellRow({ cell }: { cell: CellData }) {
  return (
    <div className={cn(
      'flex items-center gap-4 p-4',
      cell.status === 'critical' ? 'bg-danger-500/5' :
      cell.status === 'warning' ? 'bg-warning-500/5' : ''
    )}>
      <div className={cn(
        'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-medium',
        cell.status === 'critical' ? 'bg-danger-500/20 text-danger-500' :
        cell.status === 'warning' ? 'bg-warning-500/20 text-warning-500' :
        'bg-surface-hover text-foreground'
      )}>
        #{cell.id % 100}
      </div>

      <div className="flex-1 grid grid-cols-5 gap-4 text-sm">
        <div>
          <p className="text-foreground-muted text-xs">Tensao</p>
          <p className={cn(
            'font-medium',
            cell.status === 'critical' ? 'text-danger-500' :
            cell.status === 'warning' ? 'text-warning-500' : 'text-foreground'
          )}>
            {cell.voltage}V
          </p>
        </div>
        <div>
          <p className="text-foreground-muted text-xs">Temperatura</p>
          <p className="font-medium text-foreground">{cell.temperature}°C</p>
        </div>
        <div>
          <p className="text-foreground-muted text-xs">SOH</p>
          <p className={cn(
            'font-medium',
            cell.soh < 70 ? 'text-danger-500' :
            cell.soh < 80 ? 'text-warning-500' : 'text-success-500'
          )}>
            {cell.soh}%
          </p>
        </div>
        <div>
          <p className="text-foreground-muted text-xs">Delta V</p>
          <p className={cn(
            'font-medium flex items-center gap-1',
            cell.deltaVoltage > 0 ? 'text-success-500' : 'text-danger-500'
          )}>
            {cell.deltaVoltage > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(cell.deltaVoltage)}V
          </p>
        </div>
        <div>
          <p className="text-foreground-muted text-xs">Ciclos</p>
          <p className="font-medium text-foreground">{cell.cycles}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {cell.balancing && (
          <span className="px-2 py-1 bg-secondary/20 text-secondary text-xs font-medium rounded-full">
            Balanceando
          </span>
        )}
        <span className={cn(
          'px-2 py-1 text-xs font-medium rounded-full',
          cell.status === 'critical' ? 'bg-danger-500/20 text-danger-500' :
          cell.status === 'warning' ? 'bg-warning-500/20 text-warning-500' :
          'bg-success-500/20 text-success-500'
        )}>
          {cell.status === 'critical' ? 'Critico' :
           cell.status === 'warning' ? 'Alerta' : 'Normal'}
        </span>
      </div>
    </div>
  );
}

// Loading Skeleton
function DiagnosticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 bg-surface rounded-lg animate-pulse" />
        <div>
          <div className="h-6 w-48 bg-surface rounded animate-pulse mb-2" />
          <div className="h-4 w-32 bg-surface rounded animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl p-4 border border-border">
            <div className="w-10 h-10 bg-surface-hover rounded-lg mb-3 animate-pulse" />
            <div className="h-8 w-16 bg-surface-hover rounded mb-2 animate-pulse" />
            <div className="h-4 w-24 bg-surface-hover rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-surface rounded-xl border border-border h-48 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
