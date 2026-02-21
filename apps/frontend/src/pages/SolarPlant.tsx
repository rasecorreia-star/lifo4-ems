/**
 * Solar Plant Dashboard
 * Comprehensive view of solar-BESS hybrid system
 *
 * TODO: [FASE 1] This page exists but is not routed in App.tsx.
 * Decision pending: Add route, keep for future use, or remove.
 */

import { useState, useEffect } from 'react';
import {
  Sun,
  Battery,
  Power,
  Gauge,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  TrendingUp,
  Cloud,
  Thermometer,
  Zap,
  Play,
  Square,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// Types
interface PlantOverview {
  totalCapacityKW: number;
  solarCapacityKW: number;
  bessCapacityKW: number;
  bessCapacityKWh: number;
  currentGenerationKW: number;
  currentStorageKW: number;
  currentLoadKW: number;
  gridExportKW: number;
  gridImportKW: number;
  solarAvailableKW: number;
  bessSOC: number;
  efficiency: number;
}

interface InverterTelemetry {
  inverterId: string;
  status: string;
  acPowerKW: number;
  dcPowerKW: number;
  efficiency: number;
  temperatureC: number;
  energyTodayKWh: number;
}

interface PowerForecast {
  timestamp: string;
  powerKW: number;
  confidenceLow: number;
  confidenceHigh: number;
  cloudCover: number;
}

interface CurtailmentStatus {
  isActive: boolean;
  currentCurtailmentKW: number;
  currentCurtailmentPercent: number;
  reason: string | null;
}

// Color palette
const COLORS = {
  solar: '#FFA726',
  battery: '#42A5F5',
  grid: '#66BB6A',
  load: '#EF5350',
  curtailment: '#AB47BC'
};

// Mock data generation
const generateMockData = () => {
  const now = new Date();
  const hour = now.getHours();
  const solarFactor = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));

  const overview: PlantOverview = {
    totalCapacityKW: 2000,
    solarCapacityKW: 1500,
    bessCapacityKW: 500,
    bessCapacityKWh: 1000,
    currentGenerationKW: 1500 * solarFactor * (0.8 + Math.random() * 0.2),
    currentStorageKW: (Math.random() - 0.5) * 200,
    currentLoadKW: 300 + Math.random() * 200,
    gridExportKW: 0,
    gridImportKW: 0,
    solarAvailableKW: 1500 * solarFactor,
    bessSOC: 50 + Math.random() * 30,
    efficiency: 94 + Math.random() * 4
  };

  const net = overview.currentGenerationKW - overview.currentStorageKW - overview.currentLoadKW;
  if (net > 0) {
    overview.gridExportKW = net;
  } else {
    overview.gridImportKW = -net;
  }

  return overview;
};

const generateForecastData = (): PowerForecast[] => {
  const forecast: PowerForecast[] = [];
  const now = new Date();

  for (let h = 0; h < 24; h++) {
    const time = new Date(now);
    time.setHours(h, 0, 0, 0);
    const hour = h;
    const solarFactor = Math.max(0, Math.sin((hour - 6) * Math.PI / 12));
    const cloudCover = 20 + Math.random() * 40;
    const power = 1500 * solarFactor * (1 - cloudCover / 200);

    forecast.push({
      timestamp: time.toISOString(),
      powerKW: Math.max(0, power),
      confidenceLow: Math.max(0, power * 0.8),
      confidenceHigh: Math.max(0, power * 1.2),
      cloudCover
    });
  }

  return forecast;
};

const generateInverterData = (): InverterTelemetry[] => {
  const inverters: InverterTelemetry[] = [];
  const statuses = ['running', 'running', 'running', 'standby', 'fault'];

  for (let i = 1; i <= 5; i++) {
    const status = statuses[i - 1];
    const isRunning = status === 'running';

    inverters.push({
      inverterId: `INV-${String(i).padStart(3, '0')}`,
      status,
      acPowerKW: isRunning ? 200 + Math.random() * 100 : 0,
      dcPowerKW: isRunning ? 210 + Math.random() * 100 : 0,
      efficiency: isRunning ? 95 + Math.random() * 3 : 0,
      temperatureC: 30 + Math.random() * 20,
      energyTodayKWh: 500 + Math.random() * 300
    });
  }

  return inverters;
};

// Components
const StatCard = ({
  title,
  value,
  unit,
  icon: Icon,
  color,
  progress
}: {
  title: string;
  value: string | number;
  unit: string;
  icon: React.ElementType;
  color: string;
  progress?: number;
}) => (
  <Card>
    <CardContent className="pt-6">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-foreground-muted mb-1">{title}</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold" style={{ color }}>
              {typeof value === 'number' ? value.toFixed(1) : value}
            </span>
            <span className="text-sm text-foreground-muted">{unit}</span>
          </div>
        </div>
        <div style={{ color }} className="opacity-80">
          <Icon className="w-8 h-8" />
        </div>
      </div>
      {progress !== undefined && (
        <div className="mt-4">
          <Progress value={progress} className="h-2" indicatorClassName={`bg-[${color}]`} />
        </div>
      )}
    </CardContent>
  </Card>
);

const PowerFlowDiagram = ({ overview }: { overview: PlantOverview }) => {
  const pieData = [
    { name: 'Solar', value: overview.currentGenerationKW, color: COLORS.solar },
    { name: 'Battery', value: Math.abs(overview.currentStorageKW), color: COLORS.battery },
    { name: 'Grid', value: overview.gridExportKW || overview.gridImportKW, color: COLORS.grid }
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Power Flow</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5" style={{ color: COLORS.solar }} />
              <span>Solar: {overview.currentGenerationKW.toFixed(0)} kW</span>
            </div>
            <div className="flex items-center gap-2">
              <Battery className="w-5 h-5" style={{ color: COLORS.battery }} />
              <span>
                Battery: {overview.currentStorageKW > 0 ? 'Charging' : 'Discharging'}{' '}
                {Math.abs(overview.currentStorageKW).toFixed(0)} kW
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5" style={{ color: COLORS.grid }} />
              <span>
                Grid: {overview.gridExportKW > 0 ? 'Export' : 'Import'}{' '}
                {(overview.gridExportKW || overview.gridImportKW).toFixed(0)} kW
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Power className="w-5 h-5" style={{ color: COLORS.load }} />
              <span>Load: {overview.currentLoadKW.toFixed(0)} kW</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ForecastChart = ({ forecast }: { forecast: PowerForecast[] }) => {
  const chartData = forecast.map(f => ({
    time: new Date(f.timestamp).getHours() + ':00',
    power: f.powerKW,
    low: f.confidenceLow,
    high: f.confidenceHigh,
    clouds: f.cloudCover
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Power Forecast (24h)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <RechartsTooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="high"
              stroke={COLORS.solar}
              fill={COLORS.solar}
              fillOpacity={0.1}
              name="Confidence High"
            />
            <Area
              type="monotone"
              dataKey="power"
              stroke={COLORS.solar}
              fill={COLORS.solar}
              fillOpacity={0.6}
              name="Forecast"
            />
            <Area
              type="monotone"
              dataKey="low"
              stroke={COLORS.solar}
              fill="white"
              name="Confidence Low"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};

const InverterTable = ({ inverters }: { inverters: InverterTelemetry[] }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" />Running</Badge>;
      case 'standby':
        return <Badge variant="warning">Standby</Badge>;
      case 'fault':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />Fault</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inverter Fleet</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-2 font-medium">Inverter</th>
                <th className="text-left py-3 px-2 font-medium">Status</th>
                <th className="text-right py-3 px-2 font-medium">AC Power</th>
                <th className="text-right py-3 px-2 font-medium">Efficiency</th>
                <th className="text-right py-3 px-2 font-medium">Temperature</th>
                <th className="text-right py-3 px-2 font-medium">Energy Today</th>
              </tr>
            </thead>
            <tbody>
              {inverters.map(inv => (
                <tr key={inv.inverterId} className="border-b border-border/50">
                  <td className="py-3 px-2">{inv.inverterId}</td>
                  <td className="py-3 px-2">{getStatusBadge(inv.status)}</td>
                  <td className="text-right py-3 px-2">{inv.acPowerKW.toFixed(1)} kW</td>
                  <td className="text-right py-3 px-2">{inv.efficiency.toFixed(1)}%</td>
                  <td className="text-right py-3 px-2">
                    <span className={cn("flex items-center justify-end gap-1", inv.temperatureC > 50 && "text-danger-500")}>
                      <Thermometer className="w-4 h-4" />
                      {inv.temperatureC.toFixed(1)}°C
                    </span>
                  </td>
                  <td className="text-right py-3 px-2">{inv.energyTodayKWh.toFixed(0)} kWh</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

const ControlPanelComponent = ({
  curtailment,
  onCurtailmentChange,
}: {
  curtailment: CurtailmentStatus;
  onCurtailmentChange: (value: number) => void;
}) => {
  const [curtailmentSlider, setCurtailmentSlider] = useState([0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plant Control</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Curtailment Control</h4>
            {curtailment.isActive && (
              <div className="bg-warning-500/10 border border-warning-500/30 text-warning-500 p-3 rounded-lg mb-4 text-sm">
                Active Curtailment: {curtailment.currentCurtailmentKW.toFixed(0)} kW ({curtailment.currentCurtailmentPercent.toFixed(1)}%)
                {curtailment.reason && ` - ${curtailment.reason}`}
              </div>
            )}
            <p className="text-sm text-foreground-muted mb-2">Manual Curtailment: {curtailmentSlider[0]}%</p>
            <Slider
              value={curtailmentSlider}
              onValueChange={setCurtailmentSlider}
              onValueCommit={(value) => onCurtailmentChange(value[0])}
              max={100}
              step={1}
              className="mb-4"
            />
            <div className="flex justify-between text-xs text-foreground-muted">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium mb-3">Quick Actions</h4>
            <div className="flex flex-wrap gap-2">
              <Button variant="default" size="sm" className="gap-1 bg-success-500 hover:bg-success-600">
                <Play className="w-4 h-4" />
                Start All
              </Button>
              <Button variant="destructive" size="sm" className="gap-1">
                <Square className="w-4 h-4" />
                Stop All
              </Button>
              <Button variant="outline" size="sm" className="gap-1">
                <RefreshCw className="w-4 h-4" />
                Reset Faults
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Component
const SolarPlant = () => {
  const [overview, setOverview] = useState<PlantOverview>(generateMockData());
  const [forecast, setForecast] = useState<PowerForecast[]>(generateForecastData());
  const [inverters, setInverters] = useState<InverterTelemetry[]>(generateInverterData());
  const [curtailment, setCurtailment] = useState<CurtailmentStatus>({
    isActive: false,
    currentCurtailmentKW: 0,
    currentCurtailmentPercent: 0,
    reason: null
  });

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setOverview(generateMockData());
      setInverters(generateInverterData());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleCurtailmentChange = (value: number) => {
    if (value > 0) {
      setCurtailment({
        isActive: true,
        currentCurtailmentKW: overview.currentGenerationKW * (value / 100),
        currentCurtailmentPercent: value,
        reason: 'manual'
      });
    } else {
      setCurtailment({
        isActive: false,
        currentCurtailmentKW: 0,
        currentCurtailmentPercent: 0,
        reason: null
      });
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning-500/10">
            <Sun className="w-6 h-6 text-warning-500" />
          </div>
          <h1 className="text-2xl font-bold">Solar Plant Dashboard</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => setOverview(generateMockData())}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Solar Generation"
          value={overview.currentGenerationKW}
          unit="kW"
          icon={Sun}
          color={COLORS.solar}
          progress={(overview.currentGenerationKW / overview.solarCapacityKW) * 100}
        />
        <StatCard
          title="Battery SOC"
          value={overview.bessSOC}
          unit="%"
          icon={Battery}
          color={COLORS.battery}
          progress={overview.bessSOC}
        />
        <StatCard
          title="Grid Export"
          value={overview.gridExportKW}
          unit="kW"
          icon={Zap}
          color={COLORS.grid}
        />
        <StatCard
          title="System Efficiency"
          value={overview.efficiency}
          unit="%"
          icon={Gauge}
          color="#9C27B0"
          progress={overview.efficiency}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="inverters">Inverters</TabsTrigger>
          <TabsTrigger value="control">Control</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PowerFlowDiagram overview={overview} />
            <Card>
              <CardHeader>
                <CardTitle>Plant Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-foreground-muted">Total Capacity</p>
                  <p className="text-2xl font-bold">{overview.totalCapacityKW} kW</p>
                </div>
                <hr className="border-border" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-foreground-muted">Solar Capacity</p>
                    <p className="text-xl font-semibold">{overview.solarCapacityKW} kW</p>
                  </div>
                  <div>
                    <p className="text-sm text-foreground-muted">BESS Capacity</p>
                    <p className="text-xl font-semibold">{overview.bessCapacityKW} kW / {overview.bessCapacityKWh} kWh</p>
                  </div>
                </div>
                <hr className="border-border" />
                <div>
                  <p className="text-sm text-foreground-muted">Current Load</p>
                  <p className="text-xl font-semibold">{overview.currentLoadKW.toFixed(0)} kW</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="forecast">
          <div className="grid grid-cols-1 gap-6">
            <ForecastChart forecast={forecast} />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cloud className="w-5 h-5" />
                    Weather Conditions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Temperature</span>
                    <span>28°C</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Cloud Cover</span>
                    <span>35%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Humidity</span>
                    <span>65%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Wind Speed</span>
                    <span>12 km/h</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inverters">
          <InverterTable inverters={inverters} />
        </TabsContent>

        <TabsContent value="control">
          <ControlPanelComponent
            curtailment={curtailment}
            onCurtailmentChange={handleCurtailmentChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SolarPlant;
