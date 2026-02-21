import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Calendar, Zap, TrendingDown } from 'lucide-react';

interface DegradationPrediction {
  currentSoh: number;
  predictedSoh: {
    oneYear: number;
    threeYears: number;
    fiveYears: number;
  };
  remainingLife: {
    cycles: number;
    years: number;
    eolDate: string;
  };
  degradationRatePerYear: number;
  primaryStressor: string;
  recommendations: string[];
  confidence: number;
}

interface PredictionChartsProps {
  prediction: DegradationPrediction;
}

export function PredictionCharts({ prediction }: PredictionChartsProps) {
  // Generate trajectory data
  const trajectoryData = useMemo(() => {
    const data = [];
    const currentSoh = prediction.currentSoh;
    const rate = prediction.degradationRatePerYear / 100;

    for (let year = 0; year <= 10; year++) {
      const soh = Math.max(0, currentSoh - rate * year);
      data.push({
        year,
        soh: soh * 100,
        eolThreshold: 80,
        confidence: soh > 0.8 ? 90 : soh > 0.7 ? 75 : 60,
      });
    }
    return data;
  }, [prediction]);

  // Format EOL date
  const eolDate = new Date(prediction.remainingLife.eolDate);
  const formattedEolDate = eolDate.toLocaleDateString('pt-BR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  // Determine health status
  const getHealthStatus = (soh: number) => {
    if (soh >= 90) return { label: 'Excellent', color: 'bg-green-500' };
    if (soh >= 80) return { label: 'Good', color: 'bg-blue-500' };
    if (soh >= 70) return { label: 'Fair', color: 'bg-yellow-500' };
    return { label: 'Poor', color: 'bg-red-500' };
  };

  const healthStatus = getHealthStatus(prediction.currentSoh);

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Zap className="w-4 h-4" />
              Current SOH
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold">{prediction.currentSoh.toFixed(1)}%</span>
              <Badge className={healthStatus.color}>{healthStatus.label}</Badge>
            </div>
            <Progress value={prediction.currentSoh} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4" />
              Degradation Rate
            </div>
            <div className="text-3xl font-bold">{prediction.degradationRatePerYear.toFixed(2)}%</div>
            <div className="text-sm text-muted-foreground">per year</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              Remaining Life
            </div>
            <div className="text-3xl font-bold">{prediction.remainingLife.years.toFixed(1)}</div>
            <div className="text-sm text-muted-foreground">years ({prediction.remainingLife.cycles.toLocaleString()} cycles)</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <AlertTriangle className="w-4 h-4" />
              EOL Date
            </div>
            <div className="text-2xl font-bold">{formattedEolDate}</div>
            <div className="text-sm text-muted-foreground">at 80% SOH threshold</div>
          </CardContent>
        </Card>
      </div>

      {/* SOH Trajectory Chart */}
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trajectoryData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="year"
              label={{ value: 'Years from Now', position: 'insideBottom', offset: -5 }}
            />
            <YAxis
              domain={[60, 100]}
              label={{ value: 'SOH (%)', angle: -90, position: 'insideLeft' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'soh') return [`${value.toFixed(1)}%`, 'Predicted SOH'];
                if (name === 'eolThreshold') return [`${value}%`, 'EOL Threshold'];
                return [value, name];
              }}
              labelFormatter={(year) => `Year ${year}`}
            />
            <Legend />
            <ReferenceLine
              y={80}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{ value: 'EOL (80%)', position: 'right' }}
            />
            <Area
              type="monotone"
              dataKey="soh"
              stroke="#2563eb"
              fill="#2563eb"
              fillOpacity={0.2}
              strokeWidth={2}
              name="Predicted SOH"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Future Predictions */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">1 Year</div>
            <div className="text-2xl font-bold text-blue-600">
              {prediction.predictedSoh.oneYear.toFixed(1)}%
            </div>
            <Progress
              value={prediction.predictedSoh.oneYear}
              className="mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">3 Years</div>
            <div className="text-2xl font-bold text-yellow-600">
              {prediction.predictedSoh.threeYears.toFixed(1)}%
            </div>
            <Progress
              value={prediction.predictedSoh.threeYears}
              className="mt-2"
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <div className="text-sm text-muted-foreground mb-1">5 Years</div>
            <div className={`text-2xl font-bold ${prediction.predictedSoh.fiveYears >= 80 ? 'text-green-600' : 'text-red-600'}`}>
              {prediction.predictedSoh.fiveYears.toFixed(1)}%
            </div>
            <Progress
              value={prediction.predictedSoh.fiveYears}
              className="mt-2"
            />
          </CardContent>
        </Card>
      </div>

      {/* Primary Stressor */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Primary Degradation Factor</div>
              <div className="text-xl font-semibold capitalize">
                {prediction.primaryStressor.replace('_', ' ')}
              </div>
            </div>
            <Badge variant="outline" className="text-lg">
              {prediction.confidence.toFixed(0)}% confidence
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
