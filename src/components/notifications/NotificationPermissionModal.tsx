import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../theme';

interface Props {
  visible: boolean;
  onAllow: () => void;
  onSkip: () => void;
}

export default function NotificationPermissionModal({
  visible,
  onAllow,
  onSkip,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons name="notifications-outline" size={40} color={colors.primary} />
          </View>

          <Text style={styles.title}>Stay on track</Text>
          <Text style={styles.body}>
            Get reminders for scheduled sessions and gentle nudges when you've
            been away. We'll never spam you.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.allowButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={onAllow}
          >
            <Text style={styles.allowButtonText}>Enable Notifications</Text>
          </Pressable>

          <Pressable style={styles.skipButton} onPress={onSkip}>
            <Text style={styles.skipButtonText}>Maybe Later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 22,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  allowButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  allowButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingVertical: 8,
  },
  skipButtonText: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textTertiary,
  },
});
