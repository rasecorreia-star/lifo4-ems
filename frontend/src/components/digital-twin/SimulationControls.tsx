import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SimulationResult {
  time: number[];
  voltage: number[];
  current: number[];
  soc: number[];
  temperature: number[];
  power: number[];
}

interface SimulationControlsProps {
  data: SimulationResult;
}

export function SimulationControls({ data }: SimulationControlsProps) {
  const [selectedChart, setSelectedChart] = useState('voltage');

  // Transform data for recharts
  const chartData = data.time.map((t, i) => ({
    time: t / 60, // Convert to minutes
    voltage: data.voltage[i],
    current: data.current[i],
    soc: data.soc[i] * 100,
    temperature: data.temperature[i],
    power: data.power[i] / 1000, // Convert to kW
  }));

  const chartConfig = {
    voltage: { color: '#2563eb', unit: 'V', label: 'Voltage' },
    current: { color: '#dc2626', unit: 'A', label: 'Current' },
    soc: { color: '#16a34a', unit: '%', label: 'SOC' },
    temperature: { color: '#ea580c', unit: '°C', label: 'Temperature' },
    power: { color: '#9333ea', unit: 'kW', label: 'Power' },
  };

  const renderChart = (dataKey: string) => {
    const config = chartConfig[dataKey as keyof typeof chartConfig];
    return (
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="time"
            label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
            className="text-xs"
          />
          <YAxis
            label={{ value: `${config.label} (${config.unit})`, angle: -90, position: 'insideLeft' }}
            className="text-xs"
          />
          <Tooltip
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
            formatter={(value: number) => [`${value.toFixed(2)} ${config.unit}`, config.label]}
            labelFormatter={(label) => `Time: ${label.toFixed(1)} min`}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={config.color}
            strokeWidth={2}
            dot={false}
            name={config.label}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  };

  const renderAllChart = () => (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="time"
          label={{ value: 'Time (min)', position: 'insideBottom', offset: -5 }}
          className="text-xs"
        />
        <YAxis yAxisId="left" className="text-xs" />
        <YAxis yAxisId="right" orientation="right" className="text-xs" />
        <Tooltip
          contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
        />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="voltage" stroke="#2563eb" strokeWidth={2} dot={false} name="Voltage (V)" />
        <Line yAxisId="right" type="monotone" dataKey="soc" stroke="#16a34a" strokeWidth={2} dot={false} name="SOC (%)" />
        <Line yAxisId="left" type="monotone" dataKey="current" stroke="#dc2626" strokeWidth={2} dot={false} name="Current (A)" />
      </LineChart>
    </ResponsiveContainer>
  );

  // Summary statistics
  const stats = {
    finalSoc: data.soc[data.soc.length - 1] * 100,
    minVoltage: Math.min(...data.voltage),
    maxVoltage: Math.max(...data.voltage),
    avgCurrent: data.current.reduce((a, b) => a + b, 0) / data.current.length,
    maxPower: Math.max(...data.power.map(Math.abs)) / 1000,
    avgTemp: data.temperature.reduce((a, b) => a + b, 0) / data.temperature.length,
    maxTemp: Math.max(...data.temperature),
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3">
          <div className="text-blue-600 dark:text-blue-400 font-semibold">Final SOC</div>
          <div className="text-2xl font-bold">{stats.finalSoc.toFixed(1)}%</div>
        </div>
        <div className="bg-green-50 dark:bg-green-950 rounded-lg p-3">
          <div className="text-green-600 dark:text-green-400 font-semibold">Voltage Range</div>
          <div className="text-2xl font-bold">{stats.minVoltage.toFixed(1)}-{stats.maxVoltage.toFixed(1)}V</div>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950 rounded-lg p-3">
          <div className="text-purple-600 dark:text-purple-400 font-semibold">Max Power</div>
          <div className="text-2xl font-bold">{stats.maxPower.toFixed(1)} kW</div>
        </div>
        <div className="bg-orange-50 dark:bg-orange-950 rounded-lg p-3">
          <div className="text-orange-600 dark:text-orange-400 font-semibold">Max Temp</div>
          <div className="text-2xl font-bold">{stats.maxTemp.toFixed(1)}°C</div>
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">Overview</TabsTrigger>
          <TabsTrigger value="voltage">Voltage</TabsTrigger>
          <TabsTrigger value="current">Current</TabsTrigger>
          <TabsTrigger value="soc">SOC</TabsTrigger>
          <TabsTrigger value="power">Power</TabsTrigger>
          <TabsTrigger value="temperature">Temp</TabsTrigger>
        </TabsList>
        <TabsContent value="all">{renderAllChart()}</TabsContent>
        <TabsContent value="voltage">{renderChart('voltage')}</TabsContent>
        <TabsContent value="current">{renderChart('current')}</TabsContent>
        <TabsContent value="soc">{renderChart('soc')}</TabsContent>
        <TabsContent value="power">{renderChart('power')}</TabsContent>
        <TabsContent value="temperature">{renderChart('temperature')}</TabsContent>
      </Tabs>
    </div>
  );
}
