import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, RefreshCw, Download, AlertTriangle, CheckCircle } from 'lucide-react';
import { SimulationControls } from '@/components/digital-twin/SimulationControls';
import { PredictionCharts } from '@/components/digital-twin/PredictionCharts';

interface SimulationConfig {
  nominalCapacity: number;
  nominalVoltage: number;
  cellsInSeries: number;
  cellsInParallel: number;
  initialSoc: number;
  temperature: number;
  cRate: number;
  simulationTime: number;
  timeStep: number;
}

interface SimulationResult {
  time: number[];
  voltage: number[];
  current: number[];
  soc: number[];
  temperature: number[];
  power: number[];
}

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

export default function DigitalTwin() {
  const { systemId } = useParams<{ systemId: string }>();
  const [activeTab, setActiveTab] = useState('simulation');
  const [isLoading, setIsLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [degradationPrediction, setDegradationPrediction] = useState<DegradationPrediction | null>(null);
  const [comparisonMetrics, setComparisonMetrics] = useState<{
    voltageError: number;
    accuracy: number;
    modelValid: boolean;
  } | null>(null);

  const [config, setConfig] = useState<SimulationConfig>({
    nominalCapacity: 100,
    nominalVoltage: 51.2,
    cellsInSeries: 16,
    cellsInParallel: 1,
    initialSoc: 0.5,
    temperature: 25,
    cRate: 0.5,
    simulationTime: 3600,
    timeStep: 60,
  });

  const [degradationFactors, setDegradationFactors] = useState({
    avgDod: 0.8,
    avgCRateCharge: 0.5,
    avgCRateDischarge: 0.5,
    avgTemperature: 25,
    maxTemperature: 35,
    minTemperature: 15,
    timeAtHighSoc: 0.1,
    timeAtLowSoc: 0.1,
    calendarDays: 365,
    cycleCount: 300,
  });

  const runSimulation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/digital-twin/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemId: systemId || 'default', config }),
      });
      const data = await response.json();
      if (data.success) {
        setSimulationResult(data.result);
      }
    } catch (error) {
      console.error('Simulation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const predictDegradation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/v1/digital-twin/degradation/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ systemId: systemId || 'default', factors: degradationFactors }),
      });
      const data = await response.json();
      if (data.success) {
        setDegradationPrediction(data.prediction);
      }
    } catch (error) {
      console.error('Prediction failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const runComparison = async () => {
    setIsLoading(true);
    try {
      // In real implementation, this would fetch real telemetry data
      const response = await fetch(`/api/v1/digital-twin/compare/${systemId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config,
          realData: {
            time: Array.from({ length: 60 }, (_, i) => i * 60),
            voltage: Array.from({ length: 60 }, () => 51.2 + Math.random() * 2 - 1),
            current: Array.from({ length: 60 }, () => Math.random() * 50 - 25),
            soc: Array.from({ length: 60 }, (_, i) => 0.5 + i * 0.005 + Math.random() * 0.01),
          },
        }),
      });
      const data = await response.json();
      if (data.success) {
        setComparisonMetrics({
          voltageError: data.comparison.voltage.mae,
          accuracy: data.comparison.overallAccuracy * 100,
          modelValid: data.comparison.modelValid,
        });
      }
    } catch (error) {
      console.error('Comparison failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Digital Twin</h1>
          <p className="text-muted-foreground">
            Battery simulation and predictive analytics
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="text-sm">
            System: {systemId || 'Default'}
          </Badge>
          {comparisonMetrics && (
            <Badge variant={comparisonMetrics.modelValid ? 'default' : 'destructive'}>
              {comparisonMetrics.modelValid ? (
                <><CheckCircle className="w-3 h-3 mr-1" /> Model Valid</>
              ) : (
                <><AlertTriangle className="w-3 h-3 mr-1" /> Model Needs Calibration</>
              )}
            </Badge>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="simulation">Simulation</TabsTrigger>
          <TabsTrigger value="state">State Estimation</TabsTrigger>
          <TabsTrigger value="degradation">Degradation</TabsTrigger>
          <TabsTrigger value="comparison">Model Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="simulation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Simulation Parameters</CardTitle>
                <CardDescription>Configure battery simulation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nominal Capacity (Ah)</Label>
                  <Input
                    type="number"
                    value={config.nominalCapacity}
                    onChange={(e) => setConfig({ ...config, nominalCapacity: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Initial SOC: {(config.initialSoc * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[config.initialSoc * 100]}
                    onValueChange={([v]) => setConfig({ ...config, initialSoc: v / 100 })}
                    max={100}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temperature (°C)</Label>
                  <Input
                    type="number"
                    value={config.temperature}
                    onChange={(e) => setConfig({ ...config, temperature: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>C-Rate: {config.cRate}C</Label>
                  <Slider
                    value={[config.cRate * 10]}
                    onValueChange={([v]) => setConfig({ ...config, cRate: v / 10 })}
                    max={20}
                    step={1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Simulation Time</Label>
                  <Select
                    value={String(config.simulationTime)}
                    onValueChange={(v) => setConfig({ ...config, simulationTime: Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1800">30 minutes</SelectItem>
                      <SelectItem value="3600">1 hour</SelectItem>
                      <SelectItem value="7200">2 hours</SelectItem>
                      <SelectItem value="14400">4 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={runSimulation} disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run Simulation
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Simulation Results</CardTitle>
                <CardDescription>Time-series output from digital twin</CardDescription>
              </CardHeader>
              <CardContent>
                {simulationResult ? (
                  <SimulationControls data={simulationResult} />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Run a simulation to see results
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="state" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>State of Charge</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-blue-600">78.5%</div>
                <p className="text-sm text-muted-foreground">Estimated via Kalman Filter</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>State of Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-green-600">94.2%</div>
                <p className="text-sm text-muted-foreground">Based on capacity fade</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>State of Power</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  <span className="text-green-600">+45 kW</span>
                  <span className="mx-2">/</span>
                  <span className="text-red-600">-90 kW</span>
                </div>
                <p className="text-sm text-muted-foreground">Charge / Discharge limits</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="degradation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Usage Parameters</CardTitle>
                <CardDescription>Historical usage patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Average DOD: {(degradationFactors.avgDod * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[degradationFactors.avgDod * 100]}
                    onValueChange={([v]) => setDegradationFactors({ ...degradationFactors, avgDod: v / 100 })}
                    max={100}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Average Temperature (°C)</Label>
                  <Input
                    type="number"
                    value={degradationFactors.avgTemperature}
                    onChange={(e) => setDegradationFactors({ ...degradationFactors, avgTemperature: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Calendar Days</Label>
                  <Input
                    type="number"
                    value={degradationFactors.calendarDays}
                    onChange={(e) => setDegradationFactors({ ...degradationFactors, calendarDays: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cycle Count</Label>
                  <Input
                    type="number"
                    value={degradationFactors.cycleCount}
                    onChange={(e) => setDegradationFactors({ ...degradationFactors, cycleCount: Number(e.target.value) })}
                  />
                </div>
                <Button onClick={predictDegradation} disabled={isLoading} className="w-full">
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Predict Degradation
                </Button>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Degradation Prediction</CardTitle>
                <CardDescription>SOH trajectory and remaining life</CardDescription>
              </CardHeader>
              <CardContent>
                {degradationPrediction ? (
                  <PredictionCharts prediction={degradationPrediction} />
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Run prediction to see degradation analysis
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {degradationPrediction && (
            <Card>
              <CardHeader>
                <CardTitle>Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {degradationPrediction.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-1 flex-shrink-0" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Validation</CardTitle>
              <CardDescription>Compare digital twin predictions with real telemetry</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button onClick={runComparison} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 mr-2" />
                  )}
                  Run Comparison
                </Button>
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
              </div>

              {comparisonMetrics && (
                <div className="grid grid-cols-3 gap-4 mt-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {comparisonMetrics.accuracy.toFixed(1)}%
                      </div>
                      <p className="text-sm text-muted-foreground">Overall Accuracy</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {(comparisonMetrics.voltageError * 1000).toFixed(1)} mV
                      </div>
                      <p className="text-sm text-muted-foreground">Voltage MAE</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-2xl font-bold">
                        {comparisonMetrics.modelValid ? (
                          <span className="text-green-600">Valid</span>
                        ) : (
                          <span className="text-red-600">Needs Tuning</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Model Status</p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
