import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  icon,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.card} onPress={() => {}}>
          {icon && (
            <View
              style={[
                styles.iconWrap,
                destructive && { backgroundColor: 'rgba(239,68,68,0.12)' },
              ]}
            >
              <Ionicons
                name={icon}
                size={26}
                color={destructive ? colors.danger : colors.primary}
              />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.cancelBtn,
                pressed && { opacity: 0.85 },
              ]}
              onPress={onCancel}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                destructive ? styles.destructiveBtn : styles.confirmBtnSecondary,
                pressed && { opacity: 0.85 },
              ]}
              onPress={onConfirm}
            >
              <Text
                style={destructive ? styles.destructiveText : styles.confirmTextSecondary}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.screenPadding,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
    gap: 8,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 19,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
  },
  destructiveBtn: {
    backgroundColor: colors.danger,
  },
  destructiveText: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: '#fff',
  },
  confirmBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  confirmTextSecondary: {
    fontFamily: fonts.semiBold,
    fontSize: 15,
    color: colors.textPrimary,
  },
});
