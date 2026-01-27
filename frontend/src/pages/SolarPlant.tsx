/**
 * Solar Plant Dashboard
 * Comprehensive view of solar-BESS hybrid system
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel,
  Slider,
  Button,
  Stack,
  Divider
} from '@mui/material';
import {
  WbSunny as SunIcon,
  Battery80 as BatteryIcon,
  Power as PowerIcon,
  Speed as GaugeIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Cloud as CloudIcon,
  Thermostat as TempIcon,
  ElectricalServices as GridIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon
} from '@mui/icons-material';
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
const StatCard: React.FC<{
  title: string;
  value: string | number;
  unit: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
}> = ({ title, value, unit, icon, color, progress }) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" component="div" sx={{ color }}>
            {typeof value === 'number' ? value.toFixed(1) : value}
            <Typography variant="body1" component="span" sx={{ ml: 0.5 }}>
              {unit}
            </Typography>
          </Typography>
        </Box>
        <Box sx={{ color, opacity: 0.8 }}>
          {icon}
        </Box>
      </Stack>
      {progress !== undefined && (
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            mt: 2,
            height: 8,
            borderRadius: 4,
            backgroundColor: `${color}20`,
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
              borderRadius: 4
            }
          }}
        />
      )}
    </CardContent>
  </Card>
);

const PowerFlowDiagram: React.FC<{ overview: PlantOverview }> = ({ overview }) => {
  const pieData = [
    { name: 'Solar', value: overview.currentGenerationKW, color: COLORS.solar },
    { name: 'Battery', value: Math.abs(overview.currentStorageKW), color: COLORS.battery },
    { name: 'Grid', value: overview.gridExportKW || overview.gridImportKW, color: COLORS.grid }
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Power Flow</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
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
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SunIcon sx={{ color: COLORS.solar }} />
                <Typography>Solar: {overview.currentGenerationKW.toFixed(0)} kW</Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BatteryIcon sx={{ color: COLORS.battery }} />
                <Typography>
                  Battery: {overview.currentStorageKW > 0 ? 'Charging' : 'Discharging'}{' '}
                  {Math.abs(overview.currentStorageKW).toFixed(0)} kW
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <GridIcon sx={{ color: COLORS.grid }} />
                <Typography>
                  Grid: {overview.gridExportKW > 0 ? 'Export' : 'Import'}{' '}
                  {(overview.gridExportKW || overview.gridImportKW).toFixed(0)} kW
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PowerIcon sx={{ color: COLORS.load }} />
                <Typography>Load: {overview.currentLoadKW.toFixed(0)} kW</Typography>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

const ForecastChart: React.FC<{ forecast: PowerForecast[] }> = ({ forecast }) => {
  const chartData = forecast.map(f => ({
    time: new Date(f.timestamp).getHours() + ':00',
    power: f.powerKW,
    low: f.confidenceLow,
    high: f.confidenceHigh,
    clouds: f.cloudCover
  }));

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Power Forecast (24h)
        </Typography>
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

const InverterTable: React.FC<{ inverters: InverterTelemetry[] }> = ({ inverters }) => {
  const getStatusChip = (status: string) => {
    switch (status) {
      case 'running':
        return <Chip label="Running" color="success" size="small" icon={<CheckIcon />} />;
      case 'standby':
        return <Chip label="Standby" color="warning" size="small" />;
      case 'fault':
        return <Chip label="Fault" color="error" size="small" icon={<WarningIcon />} />;
      default:
        return <Chip label={status} size="small" />;
    }
  };

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Inverter Fleet</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Inverter</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">AC Power</TableCell>
                <TableCell align="right">Efficiency</TableCell>
                <TableCell align="right">Temperature</TableCell>
                <TableCell align="right">Energy Today</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inverters.map(inv => (
                <TableRow key={inv.inverterId}>
                  <TableCell>{inv.inverterId}</TableCell>
                  <TableCell>{getStatusChip(inv.status)}</TableCell>
                  <TableCell align="right">{inv.acPowerKW.toFixed(1)} kW</TableCell>
                  <TableCell align="right">{inv.efficiency.toFixed(1)}%</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <TempIcon sx={{ fontSize: 16, mr: 0.5, color: inv.temperatureC > 50 ? 'error.main' : 'text.secondary' }} />
                      {inv.temperatureC.toFixed(1)}°C
                    </Box>
                  </TableCell>
                  <TableCell align="right">{inv.energyTodayKWh.toFixed(0)} kWh</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>
    </Card>
  );
};

const ControlPanel: React.FC<{
  curtailment: CurtailmentStatus;
  onCurtailmentChange: (value: number) => void;
}> = ({ curtailment, onCurtailmentChange }) => {
  const [curtailmentSlider, setCurtailmentSlider] = useState(0);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>Plant Control</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>Curtailment Control</Typography>
            {curtailment.isActive && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Active Curtailment: {curtailment.currentCurtailmentKW.toFixed(0)} kW ({curtailment.currentCurtailmentPercent.toFixed(1)}%)
                {curtailment.reason && ` - ${curtailment.reason}`}
              </Alert>
            )}
            <Typography gutterBottom>Manual Curtailment: {curtailmentSlider}%</Typography>
            <Slider
              value={curtailmentSlider}
              onChange={(_, value) => setCurtailmentSlider(value as number)}
              onChangeCommitted={(_, value) => onCurtailmentChange(value as number)}
              valueLabelDisplay="auto"
              marks={[
                { value: 0, label: '0%' },
                { value: 50, label: '50%' },
                { value: 100, label: '100%' }
              ]}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" gutterBottom>Quick Actions</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="contained"
                color="success"
                startIcon={<PlayIcon />}
                size="small"
              >
                Start All
              </Button>
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                size="small"
              >
                Stop All
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                size="small"
              >
                Reset Faults
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};

// Main Component
const SolarPlant: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
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
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h4">
          <SunIcon sx={{ mr: 1, verticalAlign: 'middle', color: COLORS.solar }} />
          Solar Plant Dashboard
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={() => setOverview(generateMockData())}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Solar Generation"
            value={overview.currentGenerationKW}
            unit="kW"
            icon={<SunIcon fontSize="large" />}
            color={COLORS.solar}
            progress={(overview.currentGenerationKW / overview.solarCapacityKW) * 100}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Battery SOC"
            value={overview.bessSOC}
            unit="%"
            icon={<BatteryIcon fontSize="large" />}
            color={COLORS.battery}
            progress={overview.bessSOC}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Grid Export"
            value={overview.gridExportKW}
            unit="kW"
            icon={<GridIcon fontSize="large" />}
            color={COLORS.grid}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="System Efficiency"
            value={overview.efficiency}
            unit="%"
            icon={<GaugeIcon fontSize="large" />}
            color="#9C27B0"
            progress={overview.efficiency}
          />
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Overview" />
          <Tab label="Forecast" />
          <Tab label="Inverters" />
          <Tab label="Control" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <PowerFlowDiagram overview={overview} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Plant Summary</Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">Total Capacity</Typography>
                    <Typography variant="h5">{overview.totalCapacityKW} kW</Typography>
                  </Box>
                  <Divider />
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">Solar Capacity</Typography>
                      <Typography variant="h6">{overview.solarCapacityKW} kW</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="body2" color="text.secondary">BESS Capacity</Typography>
                      <Typography variant="h6">{overview.bessCapacityKW} kW / {overview.bessCapacityKWh} kWh</Typography>
                    </Grid>
                  </Grid>
                  <Divider />
                  <Box>
                    <Typography variant="body2" color="text.secondary">Current Load</Typography>
                    <Typography variant="h6">{overview.currentLoadKW.toFixed(0)} kW</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <ForecastChart forecast={forecast} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  <CloudIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Weather Conditions
                </Typography>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Temperature</Typography>
                    <Typography>28°C</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Cloud Cover</Typography>
                    <Typography>35%</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Humidity</Typography>
                    <Typography>65%</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography>Wind Speed</Typography>
                    <Typography>12 km/h</Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 2 && (
        <InverterTable inverters={inverters} />
      )}

      {tabValue === 3 && (
        <ControlPanel
          curtailment={curtailment}
          onCurtailmentChange={handleCurtailmentChange}
        />
      )}
    </Box>
  );
};

export default SolarPlant;
