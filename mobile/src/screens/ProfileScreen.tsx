import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { useAuthStore } from '../store/auth.store';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const {
    user,
    logout,
    biometricsEnabled,
    biometricsAvailable,
    enableBiometrics,
    disableBiometrics,
  } = useAuthStore();

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await logout();
          },
        },
      ]
    );
  };

  const handleToggleBiometrics = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (biometricsEnabled) {
      disableBiometrics();
    } else {
      await enableBiometrics();
    }
  };

  const styles = createStyles(isDark);

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </Text>
          </View>
          <Text style={styles.userName}>{user?.name}</Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>
              {user?.role === 'user' ? 'Usuário Final' : user?.role?.toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Segurança</Text>

          {biometricsAvailable && (
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="finger-print" size={22} color="#10b981" />
                <View style={styles.settingText}>
                  <Text style={styles.settingLabel}>Login Biométrico</Text>
                  <Text style={styles.settingDescription}>
                    Use Face ID ou digital para entrar
                  </Text>
                </View>
              </View>
              <Switch
                value={biometricsEnabled}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: '#334155', true: '#10b981' + '60' }}
                thumbColor={biometricsEnabled ? '#10b981' : '#64748b'}
              />
            </View>
          )}

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="lock-closed-outline" size={22} color="#64748b" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Alterar Senha</Text>
                <Text style={styles.settingDescription}>
                  Atualize sua senha de acesso
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="shield-checkmark-outline" size={22} color="#64748b" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Autenticação em 2 Etapas</Text>
                <Text style={styles.settingDescription}>
                  {user?.twoFactorEnabled ? 'Habilitada' : 'Desabilitada'}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notificações</Text>

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="notifications-outline" size={22} color="#64748b" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Configurar Alertas</Text>
                <Text style={styles.settingDescription}>
                  Personalize suas notificações
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* App Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="information-circle-outline" size={22} color="#64748b" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Versão do App</Text>
                <Text style={styles.settingDescription}>1.0.0</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Ionicons name="help-circle-outline" size={22} color="#64748b" />
              <View style={styles.settingText}>
                <Text style={styles.settingLabel}>Suporte</Text>
                <Text style={styles.settingDescription}>
                  Entre em contato conosco
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          <Ionicons name="log-out-outline" size={22} color="#ef4444" />
          <Text style={styles.logoutText}>Sair da Conta</Text>
        </TouchableOpacity>

        {/* Footer */}
        <Text style={styles.footer}>
          Lifo4 Energia - Soluções em Armazenamento
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    profileHeader: {
      alignItems: 'center',
      paddingVertical: 24,
      marginBottom: 16,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: '#10b981' + '20',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#10b981',
    },
    userName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    userEmail: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4,
    },
    roleBadge: {
      backgroundColor: '#10b981' + '20',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 12,
    },
    roleText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#10b981',
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#64748b',
      marginBottom: 12,
      textTransform: 'uppercase',
    },
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      padding: 16,
      borderRadius: 12,
      marginBottom: 8,
    },
    settingInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    settingText: {
      marginLeft: 12,
      flex: 1,
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '500',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    settingDescription: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#ef4444' + '15',
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ef4444',
    },
    footer: {
      textAlign: 'center',
      color: '#64748b',
      fontSize: 12,
      marginTop: 32,
      marginBottom: 16,
    },
  });
