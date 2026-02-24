import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import { useCoachSetupStore } from '../../store/coachSetupStore';
import { colors, fonts, spacing } from '../../theme';

export default function EditNameScreen() {
  const navigation = useNavigation();
  const currentName = useCoachSetupStore((s) => s.setupData.userName);
  const setUserName = useCoachSetupStore((s) => s.setUserName);

  const [name, setName] = useState(currentName || '');
  const isValid = name.trim().length > 0;

  const handleSave = () => {
    if (isValid) {
      setUserName(name.trim());
      navigation.goBack();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit Name</Text>
          <Pressable style={styles.saveButton} onPress={handleSave} disabled={!isValid}>
            <Text style={[styles.saveText, !isValid && styles.saveTextDisabled]}>Save</Text>
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.label}>YOUR NAME</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            placeholderTextColor={colors.textTertiary}
            autoFocus
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <Text style={styles.hint}>This is how your coach will address you.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.textPrimary,
  },
  saveButton: {
    padding: 4,
  },
  saveText: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.primary,
  },
  saveTextDisabled: {
    color: colors.textTertiary,
  },
  content: {
    padding: spacing.screenPadding,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 12,
    padding: 16,
    fontFamily: fonts.regular,
    fontSize: 18,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
  },
});
