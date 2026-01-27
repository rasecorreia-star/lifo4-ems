import { LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { RootStackParamList } from './RootNavigator';

const prefix = Linking.createURL('/');

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [prefix, 'lifo4ems://', 'https://app.lifo4.com.br'],
  config: {
    screens: {
      Auth: 'login',
      Main: {
        screens: {
          Dashboard: 'dashboard',
          Systems: 'systems',
          Alerts: 'alerts',
          Profile: 'profile',
        },
      },
      SystemDetail: 'system/:systemId',
      QRScanner: 'scan',
      Map: 'map',
    },
  },
};
