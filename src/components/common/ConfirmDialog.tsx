import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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
  // Stack buttons vertically (Apple HIG style: destructive on top, cancel
  // on bottom). Use when either label is too long to fit comfortably on a
  // single line in the horizontal layout, e.g. "Use Existing Account".
  stackButtons?: boolean;
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
  stackButtons = false,
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
              style={[styles.iconWrap, destructive && { backgroundColor: 'rgba(239,68,68,0.12)' }]}
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

          <View style={[styles.buttonRow, stackButtons && styles.buttonStack]}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                stackButtons ? styles.buttonStacked : styles.buttonRowItem,
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
                stackButtons ? styles.buttonStacked : styles.buttonRowItem,
                destructive ? styles.destructiveBtn : styles.confirmBtnSecondary,
                pressed && { opacity: 0.85 },
              ]}
              onPress={onConfirm}
            >
              <Text style={destructive ? styles.destructiveText : styles.confirmTextSecondary}>
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
    maxWidth: 340,
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.18)',
    gap: 6,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 17,
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  // column-reverse → with the JSX order (cancel, confirm), this puts
  // confirm/destructive on TOP and cancel on the BOTTOM. Matches Apple HIG
  // convention for stacked alerts: the primary/destructive action is the
  // most prominent button, the safe out (Cancel) sits underneath.
  buttonStack: {
    flexDirection: 'column-reverse',
    gap: 8,
  },
  button: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  // Row layout: each button takes equal horizontal share.
  buttonRowItem: {
    flex: 1,
  },
  // Stacked layout: each button takes full width and only its natural
  // (padding-driven) height — must NOT use flex:1 here, otherwise the
  // buttons stretch vertically to fill any column space and balloon into
  // huge bars.
  buttonStacked: {
    width: '100%',
  },
  cancelBtn: {
    backgroundColor: colors.primary,
  },
  cancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#fff',
  },
  destructiveBtn: {
    backgroundColor: colors.danger,
  },
  destructiveText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#fff',
  },
  confirmBtnSecondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  confirmTextSecondary: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
});
