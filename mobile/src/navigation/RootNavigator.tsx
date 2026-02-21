import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../store/auth.store';

// Screens
import LoginScreen from '../screens/auth/LoginScreen';
import DashboardScreen from '../screens/DashboardScreen';
import SystemsScreen from '../screens/systems/SystemsScreen';
import SystemDetailScreen from '../screens/systems/SystemDetailScreen';
import AlertsScreen from '../screens/AlertsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import QRScannerScreen from '../screens/QRScannerScreen';
import MapScreen from '../screens/MapScreen';
import EVChargersScreen from '../screens/ev-chargers/EVChargersScreen';
import EVChargerDetailScreen from '../screens/ev-chargers/EVChargerDetailScreen';
import ChargingSessionScreen from '../screens/ev-chargers/ChargingSessionScreen';
import CamerasScreen from '../screens/cameras/CamerasScreen';
import CameraDetailScreen from '../screens/cameras/CameraDetailScreen';
import CameraEventsScreen from '../screens/cameras/CameraEventsScreen';
import ProspectsScreen from '../screens/prospects/ProspectsScreen';
import ProspectDetailScreen from '../screens/prospects/ProspectDetailScreen';
import AnalyzerStatusScreen from '../screens/prospects/AnalyzerStatusScreen';
import QuickNoteScreen from '../screens/prospects/QuickNoteScreen';
import MicrogridsScreen from '../screens/microgrids/MicrogridsScreen';
import MicrogridDetailScreen from '../screens/microgrids/MicrogridDetailScreen';
import MicrogridControlScreen from '../screens/microgrids/MicrogridControlScreen';

// Types
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  SystemDetail: { systemId: string };
  QRScanner: undefined;
  Map: undefined;
  EVChargers: undefined;
  EVChargerDetail: { chargerId: string };
  ChargingSession: { chargerId: string; sessionId: string };
  Cameras: undefined;
  CameraDetail: { cameraId: string };
  CameraEvents: { cameraId?: string };
  Prospects: undefined;
  ProspectDetail: { prospectId: string };
  AnalyzerStatus: { prospectId: string; kitId: string };
  QuickNote: { prospectId: string };
  Microgrids: undefined;
  MicrogridDetail: { microgridId: string };
  MicrogridControl: { microgridId: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Systems: undefined;
  Alerts: undefined;
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Main Tab Navigator
function MainTabs() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Systems':
              iconName = focused ? 'battery-charging' : 'battery-charging-outline';
              break;
            case 'Alerts':
              iconName = focused ? 'notifications' : 'notifications-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: isDark ? '#64748b' : '#94a3b8',
        tabBarStyle: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
          borderTopColor: isDark ? '#334155' : '#e2e8f0',
        },
        headerStyle: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
        },
        headerTintColor: isDark ? '#f8fafc' : '#0f172a',
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Inicio' }}
      />
      <Tab.Screen
        name="Systems"
        component={SystemsScreen}
        options={{ title: 'Sistemas' }}
      />
      <Tab.Screen
        name="Alerts"
        component={AlertsScreen}
        options={{ title: 'Alertas' }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Perfil' }}
      />
    </Tab.Navigator>
  );
}

// Root Navigator
export default function RootNavigator() {
  const { isAuthenticated } = useAuthStore();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: isDark ? '#1e293b' : '#ffffff',
        },
        headerTintColor: isDark ? '#f8fafc' : '#0f172a',
        contentStyle: {
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
        },
      }}
    >
      {!isAuthenticated ? (
        <Stack.Screen
          name="Auth"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SystemDetail"
            component={SystemDetailScreen}
            options={{ title: 'Detalhes do Sistema' }}
          />
          <Stack.Screen
            name="QRScanner"
            component={QRScannerScreen}
            options={{ title: 'Escanear QR Code' }}
          />
          <Stack.Screen
            name="Map"
            component={MapScreen}
            options={{ title: 'Sistemas Proximos' }}
          />
          <Stack.Screen
            name="EVChargers"
            component={EVChargersScreen}
            options={{ title: 'Carregadores EV' }}
          />
          <Stack.Screen
            name="EVChargerDetail"
            component={EVChargerDetailScreen}
            options={{ title: 'Detalhes do Carregador' }}
          />
          <Stack.Screen
            name="ChargingSession"
            component={ChargingSessionScreen}
            options={{ title: 'Sessao de Carregamento' }}
          />
          <Stack.Screen
            name="Cameras"
            component={CamerasScreen}
            options={{ title: 'Cameras' }}
          />
          <Stack.Screen
            name="CameraDetail"
            component={CameraDetailScreen}
            options={{ title: 'Detalhes da Camera' }}
          />
          <Stack.Screen
            name="CameraEvents"
            component={CameraEventsScreen}
            options={{ title: 'Eventos de Seguranca' }}
          />
          <Stack.Screen
            name="Prospects"
            component={ProspectsScreen}
            options={{ title: 'Prospectos' }}
          />
          <Stack.Screen
            name="ProspectDetail"
            component={ProspectDetailScreen}
            options={{ title: 'Detalhes do Prospecto' }}
          />
          <Stack.Screen
            name="AnalyzerStatus"
            component={AnalyzerStatusScreen}
            options={{ title: 'Status do Analisador' }}
          />
          <Stack.Screen
            name="QuickNote"
            component={QuickNoteScreen}
            options={{ title: 'Nova Nota', presentation: 'modal' }}
          />
          <Stack.Screen
            name="Microgrids"
            component={MicrogridsScreen}
            options={{ title: 'Microrredes' }}
          />
          <Stack.Screen
            name="MicrogridDetail"
            component={MicrogridDetailScreen}
            options={{ title: 'Detalhes da Microrrede' }}
          />
          <Stack.Screen
            name="MicrogridControl"
            component={MicrogridControlScreen}
            options={{ title: 'Controle da Microrrede' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
