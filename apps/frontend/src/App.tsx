import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth.store';
import { useEffect } from 'react';

// Layouts
import MainLayout from './components/layout/MainLayout';
import AuthLayout from './components/layout/AuthLayout';

// Pages
import Dashboard from './pages/Dashboard';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import SystemDetail from './pages/systems/SystemDetail';
import SystemList from './pages/systems/SystemList';
import SystemSettings from './pages/systems/SystemSettings';
import SystemSchedules from './pages/systems/SystemSchedules';
import BMSConfig from './pages/systems/BMSConfig';
import HardwareConfig from './pages/systems/HardwareConfig';
import BatteryDiagnostics from './pages/systems/BatteryDiagnostics';
import SystemComparison from './pages/SystemComparison';
import SystemsMap from './pages/SystemsMap';
import Analytics from './pages/Analytics';
import Optimization from './pages/Optimization';
import GridIntegration from './pages/GridIntegration';
import BlackStart from './pages/BlackStart';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import EventLog from './pages/EventLog';
import NotificationSettings from './pages/NotificationSettings';
import FirmwareManagement from './pages/FirmwareManagement';
import ApiKeys from './pages/ApiKeys';
import DataExport from './pages/DataExport';
import AuditLog from './pages/AuditLog';
import HelpCenter from './pages/HelpCenter';
import LoadProfile from './pages/LoadProfile';
import EnergyCosts from './pages/EnergyCosts';
import WeatherIntegration from './pages/WeatherIntegration';
import BatteryHealth from './pages/BatteryHealth';
import CarbonFootprint from './pages/CarbonFootprint';
import DemandResponse from './pages/DemandResponse';
import EnergyTrading from './pages/EnergyTrading';
import TradingDashboard from './pages/TradingDashboard';
import AlarmConfiguration from './pages/AlarmConfiguration';
import Assistant from './pages/Assistant';
import ControlPanel from './pages/ControlPanel';
import PredictiveMaintenance from './pages/PredictiveMaintenance';
import Maintenance from './pages/Maintenance';
import Benchmarking from './pages/Benchmarking';
import Gamification from './pages/Gamification';
import Warranties from './pages/Warranties';
import Inventory from './pages/Inventory';
import Commissioning from './pages/Commissioning';
import Compliance from './pages/Compliance';
import VirtualPowerPlant from './pages/VirtualPowerPlant';
import CustomerPortal from './pages/CustomerPortal';
import Simulation from './pages/Simulation';
import MultiSiteDashboard from './pages/MultiSiteDashboard';
import Dashboard2 from './pages/Dashboard2';
import RemoteDiagnostics from './pages/RemoteDiagnostics';
import IntegrationHub from './pages/IntegrationHub';
import SLADashboard from './pages/SLADashboard';
import TrainingCenter from './pages/TrainingCenter';
import DocumentationCenter from './pages/DocumentationCenter';
import SupportTickets from './pages/SupportTickets';
import BackupManagement from './pages/BackupManagement';
import LicenseManagement from './pages/LicenseManagement';
import SessionManagement from './pages/SessionManagement';
import SystemLogs from './pages/SystemLogs';
import NetworkConfig from './pages/NetworkConfig';
import ScheduledTasks from './pages/ScheduledTasks';
import ContractManagement from './pages/ContractManagement';
import WorkOrders from './pages/WorkOrders';
import AssetManagement from './pages/AssetManagement';
import NotificationTemplates from './pages/NotificationTemplates';
import DataImport from './pages/DataImport';
import DigitalTwin from './pages/DigitalTwin';
import CameraList from './pages/cameras/CameraList';
import CameraDetail from './pages/cameras/CameraDetail';
import CameraEvents from './pages/cameras/CameraEvents';
import ThermalMonitoring from './pages/cameras/ThermalMonitoring';
import MicrogridDashboard from './pages/microgrids/MicrogridDashboard';
import MicrogridDetail from './pages/microgrids/MicrogridDetail';
import EVChargerList from './pages/ev-chargers/EVChargerList';
import EVChargerDetail from './pages/ev-chargers/EVChargerDetail';
import ChargingSessions from './pages/ev-chargers/ChargingSessions';
import SmartCharging from './pages/ev-chargers/SmartCharging';
import EVChargerConfig from './pages/ev-chargers/EVChargerConfig';
import CPMSDashboard from './pages/ev-chargers/CPMSDashboard';
import CPMSBilling from './pages/ev-chargers/CPMSBilling';
import CPMSEnergyManagement from './pages/ev-chargers/CPMSEnergyManagement';
import CPMSUsers from './pages/ev-chargers/CPMSUsers';
import Settings from './pages/Settings';
import Profile from './pages/Profile';
import Users from './pages/Users';
import NotFound from './pages/NotFound';
import ProspectList from './pages/prospects/ProspectList';
import ProspectDetail from './pages/prospects/ProspectDetail';
import LoadAnalysis from './pages/prospects/LoadAnalysis';
import SystemRecommendations from './pages/prospects/SystemRecommendations';
import SimpleDashboard from './pages/SimpleDashboard';
import ROICalculator from './pages/ROICalculator';
import Changelog from './pages/Changelog';
import EnergyForecasting from './pages/EnergyForecasting';
import SolarPlant from './pages/SolarPlant';
import GridServices from './pages/microgrids/GridServices';
import IslandingControl from './pages/microgrids/IslandingControl';
import SecurityZones from './pages/cameras/SecurityZones';
import VoiceMessages from './pages/cameras/VoiceMessages';
import OptimizationDashboard from './pages/OptimizationDashboard';
import FinancialDashboard from './pages/FinancialDashboard';
import MicrogridEnergyTrading from './pages/microgrids/EnergyTrading';

// Components
import LoadingScreen from './components/ui/LoadingScreen';
import ProtectedRoute from './components/auth/ProtectedRoute';

function App() {
  const { isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      {/* Protected Routes */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/dashboard2" element={<Dashboard2 />} />
        <Route path="/systems" element={<SystemList />} />
        <Route path="/systems/:systemId" element={<SystemDetail />} />
        <Route path="/systems/:systemId/control" element={<ControlPanel />} />
        <Route path="/systems/:systemId/settings" element={<SystemSettings />} />
        <Route path="/systems/:systemId/schedules" element={<SystemSchedules />} />
        <Route path="/systems/:systemId/bms-config" element={<BMSConfig />} />
        <Route path="/systems/:systemId/hardware" element={<HardwareConfig />} />
        <Route path="/systems/:systemId/diagnostics" element={<BatteryDiagnostics />} />
        <Route path="/systems/compare" element={<SystemComparison />} />
        <Route path="/systems/map" element={<SystemsMap />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/benchmarking" element={<Benchmarking />} />
        <Route path="/gamification" element={<Gamification />} />
        <Route path="/battery-health" element={<BatteryHealth />} />
        <Route path="/load-profile" element={<LoadProfile />} />
        <Route path="/energy-costs" element={<EnergyCosts />} />
        <Route path="/weather" element={<WeatherIntegration />} />
        <Route path="/optimization" element={<Optimization />} />
        <Route path="/grid" element={<GridIntegration />} />
        <Route path="/grid/:systemId" element={<GridIntegration />} />
        <Route path="/demand-response" element={<DemandResponse />} />
        <Route path="/trading" element={<EnergyTrading />} />
        <Route path="/trading-dashboard" element={<TradingDashboard />} />
        <Route path="/blackstart" element={<BlackStart />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/alarm-config" element={<AlarmConfiguration />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/carbon" element={<CarbonFootprint />} />
        <Route path="/warranties" element={<Warranties />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/commissioning" element={<Commissioning />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/vpp" element={<VirtualPowerPlant />} />
        <Route path="/my-system" element={<CustomerPortal />} />
        <Route path="/simulation" element={<Simulation />} />
        <Route path="/digital-twin" element={<DigitalTwin />} />
        <Route path="/digital-twin/:systemId" element={<DigitalTwin />} />
        <Route path="/multi-site" element={<MultiSiteDashboard />} />
        <Route path="/remote-diagnostics" element={<RemoteDiagnostics />} />
        <Route path="/integrations" element={<IntegrationHub />} />
        <Route path="/sla" element={<SLADashboard />} />
        <Route path="/predictive" element={<PredictiveMaintenance />} />
        <Route path="/maintenance" element={<Maintenance />} />
        <Route path="/events" element={<EventLog />} />
        <Route path="/notifications" element={<NotificationSettings />} />
        <Route path="/firmware" element={<FirmwareManagement />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/export" element={<DataExport />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/users" element={<Users />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/help" element={<HelpCenter />} />
        <Route path="/training" element={<TrainingCenter />} />
        <Route path="/docs" element={<DocumentationCenter />} />
        <Route path="/support" element={<SupportTickets />} />
        <Route path="/backup" element={<BackupManagement />} />
        <Route path="/license" element={<LicenseManagement />} />
        <Route path="/sessions" element={<SessionManagement />} />
        <Route path="/logs" element={<SystemLogs />} />
        <Route path="/network" element={<NetworkConfig />} />
        <Route path="/tasks" element={<ScheduledTasks />} />
        <Route path="/contracts" element={<ContractManagement />} />
        <Route path="/work-orders" element={<WorkOrders />} />
        <Route path="/assets" element={<AssetManagement />} />
        <Route path="/notification-templates" element={<NotificationTemplates />} />
        <Route path="/data-import" element={<DataImport />} />

        {/* Prospects Routes */}
        <Route path="/prospects" element={<ProspectList />} />
        <Route path="/prospects/:prospectId" element={<ProspectDetail />} />
        <Route path="/prospects/:prospectId/load-analysis" element={<LoadAnalysis />} />
        <Route path="/prospects/:prospectId/recommendations" element={<SystemRecommendations />} />

        {/* Additional Pages */}
        <Route path="/simple-dashboard" element={<SimpleDashboard />} />
        <Route path="/roi" element={<ROICalculator />} />
        <Route path="/financial/:systemId?" element={<FinancialDashboard />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/energy-forecasting" element={<EnergyForecasting />} />
        <Route path="/solar" element={<SolarPlant />} />
        <Route path="/optimization-dashboard" element={<OptimizationDashboard />} />

        {/* Microgrid Additional Routes */}
        <Route path="/microgrids/grid-services" element={<GridServices />} />
        <Route path="/microgrids/islanding" element={<IslandingControl />} />
        <Route path="/microgrids/energy-trading" element={<MicrogridEnergyTrading />} />

        {/* Camera Routes */}
        <Route path="/cameras" element={<CameraList />} />
        <Route path="/cameras/thermal" element={<ThermalMonitoring />} />
        <Route path="/cameras/events" element={<CameraEvents />} />
        <Route path="/cameras/security-zones" element={<SecurityZones />} />
        <Route path="/cameras/voice-messages" element={<VoiceMessages />} />
        <Route path="/cameras/:id" element={<CameraDetail />} />

        {/* Microgrid Routes */}
        <Route path="/microgrids" element={<MicrogridDashboard />} />
        <Route path="/microgrids/detail" element={<MicrogridDetail />} />
        <Route path="/microgrids/:microgridId" element={<MicrogridDetail />} />

        {/* EV Chargers / CPMS Routes */}
        <Route path="/ev-chargers" element={<EVChargerList />} />
        <Route path="/ev-chargers/dashboard" element={<CPMSDashboard />} />
        <Route path="/ev-chargers/sessions" element={<ChargingSessions />} />
        <Route path="/ev-chargers/smart-charging" element={<SmartCharging />} />
        <Route path="/ev-chargers/billing" element={<CPMSBilling />} />
        <Route path="/ev-chargers/energy" element={<CPMSEnergyManagement />} />
        <Route path="/ev-chargers/users" element={<CPMSUsers />} />
        <Route path="/ev-chargers/config" element={<EVChargerConfig />} />
        <Route path="/ev-chargers/:chargerId" element={<EVChargerDetail />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
