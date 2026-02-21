import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Alert,
} from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { BarcodeScanningResult } from 'expo-camera';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../navigation/RootNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function QRScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getCameraPermissions = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getCameraPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Parse QR code data
    // Expected format: lifo4://system/{systemId}
    try {
      const url = new URL(data);
      if (url.protocol === 'lifo4:' && url.pathname.startsWith('//system/')) {
        const systemId = url.pathname.replace('//system/', '');
        navigation.replace('SystemDetail', { systemId });
      } else {
        Alert.alert(
          'QR Code Inválido',
          'Este QR code não pertence a um sistema Lifo4.',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
    } catch (error) {
      // Try to parse as just a system ID
      if (data && data.length > 10) {
        navigation.replace('SystemDetail', { systemId: data });
      } else {
        Alert.alert(
          'QR Code Inválido',
          'Não foi possível ler o QR code. Tente novamente.',
          [{ text: 'OK', onPress: () => setScanned(false) }]
        );
      }
    }
  };

  const styles = createStyles(isDark);

  if (hasPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Solicitando permissão da câmera...</Text>
      </View>
    );
  }

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Ionicons name="camera-outline" size={64} color="#64748b" />
        <Text style={styles.text}>Sem acesso à câmera</Text>
        <Text style={styles.subtext}>
          Permita o acesso à câmera para escanear QR codes
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          {/* Top overlay */}
          <View style={styles.overlaySection} />

          {/* Middle section with cutout */}
          <View style={styles.middleSection}>
            <View style={styles.overlaySection} />
            <View style={styles.scanArea}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <View style={styles.overlaySection} />
          </View>

          {/* Bottom overlay */}
          <View style={styles.overlaySection}>
            <Text style={styles.instructionText}>
              Posicione o QR code dentro do quadrado
            </Text>
          </View>
        </View>
      </CameraView>

      {scanned && (
        <TouchableOpacity
          style={styles.rescanButton}
          onPress={() => setScanned(false)}
        >
          <Ionicons name="refresh" size={24} color="#ffffff" />
          <Text style={styles.rescanText}>Escanear novamente</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
      justifyContent: 'center',
      alignItems: 'center',
    },
    text: {
      color: '#ffffff',
      fontSize: 16,
      marginTop: 16,
    },
    subtext: {
      color: '#64748b',
      fontSize: 14,
      marginTop: 8,
      textAlign: 'center',
      paddingHorizontal: 32,
    },
    camera: {
      flex: 1,
      width: '100%',
    },
    overlay: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    overlaySection: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    middleSection: {
      flexDirection: 'row',
    },
    scanArea: {
      width: 250,
      height: 250,
      position: 'relative',
    },
    corner: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderColor: '#10b981',
    },
    topLeft: {
      top: 0,
      left: 0,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderTopLeftRadius: 8,
    },
    topRight: {
      top: 0,
      right: 0,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderTopRightRadius: 8,
    },
    bottomLeft: {
      bottom: 0,
      left: 0,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderBottomLeftRadius: 8,
    },
    bottomRight: {
      bottom: 0,
      right: 0,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderBottomRightRadius: 8,
    },
    instructionText: {
      color: '#ffffff',
      fontSize: 16,
      marginTop: 32,
    },
    rescanButton: {
      position: 'absolute',
      bottom: 48,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#10b981',
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 16,
      gap: 8,
    },
    rescanText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: '600',
    },
  });
