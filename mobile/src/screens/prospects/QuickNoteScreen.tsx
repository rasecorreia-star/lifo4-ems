import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { prospectsApi } from '../../services/api';
import { RootStackParamList } from '../../navigation/RootNavigator';

type RouteParams = RouteProp<RootStackParamList, 'QuickNote'>;

type NoteCategory = 'call' | 'visit' | 'email' | 'other';

interface CategoryOption {
  value: NoteCategory;
  label: string;
  icon: string;
  color: string;
}

const CATEGORIES: CategoryOption[] = [
  { value: 'call', label: 'Ligacao', icon: 'call-outline', color: '#3b82f6' },
  { value: 'visit', label: 'Visita', icon: 'walk-outline', color: '#10b981' },
  { value: 'email', label: 'Email', icon: 'mail-outline', color: '#8b5cf6' },
  { value: 'other', label: 'Outro', icon: 'document-text-outline', color: '#64748b' },
];

export default function QuickNoteScreen() {
  const route = useRoute<RouteParams>();
  const navigation = useNavigation();
  const { prospectId } = route.params;
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [noteContent, setNoteContent] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NoteCategory>('call');
  const [isSaving, setIsSaving] = useState(false);

  const handleCategorySelect = (category: NoteCategory) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedCategory(category);
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  };

  const handleSave = async () => {
    if (!noteContent.trim()) {
      Alert.alert('Atencao', 'Por favor, digite o conteudo da nota.');
      return;
    }

    setIsSaving(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      await prospectsApi.addNote(prospectId, noteContent.trim(), selectedCategory);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.goBack();
    } catch (error) {
      console.error('Failed to save note:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro', 'Nao foi possivel salvar a nota. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const styles = createStyles(isDark);
  const selectedCategoryData = CATEGORIES.find((c) => c.value === selectedCategory);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Nova Nota</Text>
            <Text style={styles.subtitle}>Registre informacoes sobre o prospecto</Text>
          </View>

          {/* Category Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Categoria</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category.value;
                return (
                  <TouchableOpacity
                    key={category.value}
                    style={[
                      styles.categoryCard,
                      isSelected && { borderColor: category.color, borderWidth: 2 },
                    ]}
                    onPress={() => handleCategorySelect(category.value)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.categoryIcon,
                        { backgroundColor: category.color + '20' },
                        isSelected && { backgroundColor: category.color + '40' },
                      ]}
                    >
                      <Ionicons
                        name={category.icon as any}
                        size={24}
                        color={category.color}
                      />
                    </View>
                    <Text
                      style={[
                        styles.categoryLabel,
                        isSelected && { color: category.color, fontWeight: '600' },
                      ]}
                    >
                      {category.label}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkmark, { backgroundColor: category.color }]}>
                        <Ionicons name="checkmark" size={12} color="#ffffff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Note Content */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Conteudo da Nota</Text>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Digite sua nota aqui..."
                placeholderTextColor="#64748b"
                value={noteContent}
                onChangeText={setNoteContent}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{noteContent.length} caracteres</Text>
            </View>
          </View>

          {/* Preview */}
          {noteContent.trim().length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Pre-visualizacao</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <View
                    style={[
                      styles.previewCategoryBadge,
                      { backgroundColor: selectedCategoryData?.color + '20' },
                    ]}
                  >
                    <Ionicons
                      name={selectedCategoryData?.icon as any}
                      size={14}
                      color={selectedCategoryData?.color}
                    />
                    <Text
                      style={[
                        styles.previewCategoryText,
                        { color: selectedCategoryData?.color },
                      ]}
                    >
                      {selectedCategoryData?.label}
                    </Text>
                  </View>
                  <Text style={styles.previewDate}>
                    {new Date().toLocaleDateString('pt-BR')}
                  </Text>
                </View>
                <Text style={styles.previewContent}>{noteContent}</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleCancel}
            activeOpacity={0.8}
            disabled={isSaving}
          >
            <Ionicons name="close" size={20} color={isDark ? '#f8fafc' : '#0f172a'} />
            <Text style={styles.cancelButtonText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.saveButton,
              !noteContent.trim() && styles.saveButtonDisabled,
            ]}
            onPress={handleSave}
            activeOpacity={0.8}
            disabled={!noteContent.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#ffffff" />
                <Text style={styles.saveButtonText}>Salvar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0f172a' : '#f8fafc',
    },
    keyboardView: {
      flex: 1,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 16,
    },
    header: {
      marginBottom: 24,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    subtitle: {
      fontSize: 14,
      color: '#64748b',
      marginTop: 4,
    },
    section: {
      marginBottom: 24,
    },
    sectionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
      marginBottom: 12,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    categoryCard: {
      width: '47%',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
      position: 'relative',
    },
    categoryIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 8,
    },
    categoryLabel: {
      fontSize: 14,
      color: '#64748b',
    },
    checkmark: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textInputContainer: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
    },
    textInput: {
      fontSize: 16,
      color: isDark ? '#f8fafc' : '#0f172a',
      minHeight: 120,
    },
    charCount: {
      fontSize: 12,
      color: '#64748b',
      textAlign: 'right',
      marginTop: 8,
    },
    previewCard: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderRadius: 16,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: '#10b981',
    },
    previewHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    previewCategoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
    },
    previewCategoryText: {
      fontSize: 12,
      fontWeight: '600',
    },
    previewDate: {
      fontSize: 12,
      color: '#64748b',
    },
    previewContent: {
      fontSize: 14,
      lineHeight: 20,
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    actionContainer: {
      flexDirection: 'row',
      padding: 16,
      gap: 12,
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderTopWidth: 1,
      borderTopColor: isDark ? '#334155' : '#e2e8f0',
    },
    cancelButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: isDark ? '#334155' : '#e2e8f0',
      gap: 8,
    },
    cancelButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#f8fafc' : '#0f172a',
    },
    saveButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      borderRadius: 12,
      backgroundColor: '#10b981',
      gap: 8,
    },
    saveButtonDisabled: {
      backgroundColor: '#64748b',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#ffffff',
    },
  });
