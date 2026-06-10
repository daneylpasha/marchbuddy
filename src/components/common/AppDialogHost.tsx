import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAppDialogStore, type AppDialogButton } from '../../services/appDialog';
import { colors, fonts, spacing } from '../../theme';

// Mounted once at the app root. Reads the active dialog from the global
// store and renders it. Stays empty (no-op) while no dialog is queued.
export default function AppDialogHost() {
  const visible = useAppDialogStore((s) => s.visible);
  const title = useAppDialogStore((s) => s.title);
  const message = useAppDialogStore((s) => s.message);
  const buttons = useAppDialogStore((s) => s.buttons);
  const hide = useAppDialogStore((s) => s.hide);

  const handlePress = (btn: AppDialogButton) => {
    hide();
    // Defer the callback so the modal's exit animation isn't interrupted
    // by whatever the press handler does (navigation, another dialog, etc.).
    setTimeout(() => btn.onPress?.(), 0);
  };

  const hasCancel = buttons.some((b) => b.style === 'cancel');
  const onBackdrop = () => {
    const cancelBtn = buttons.find((b) => b.style === 'cancel');
    if (cancelBtn) handlePress(cancelBtn);
    else if (buttons.length === 1) handlePress(buttons[0]);
    // If there's no cancel and multiple buttons, ignore backdrop tap — force
    // an explicit choice, same as Alert.alert with multiple non-cancel actions.
  };

  // Stack vertically when any label is long enough to risk wrapping in a row.
  const stackVertical =
    buttons.length > 2 || buttons.some((b) => b.text.length > 14) || (buttons.length === 2 && !hasCancel);

  // Visual contract MUST mirror common/ConfirmDialog so the entire app uses
  // one dialog look. ConfirmDialog's pattern:
  //   • Cancel  → filled brand-green (the prominent, safer choice)
  //   • Confirm → outlined / secondary
  //   • Destructive → filled danger red (replaces the confirm slot)
  //   • Single button → filled brand-green
  const buttonVisual = (
    btn: AppDialogButton,
  ): { container: object; text: object } => {
    if (btn.style === 'destructive') {
      return { container: styles.destructiveBtn, text: styles.destructiveText };
    }
    if (btn.style === 'cancel') {
      return { container: styles.primaryBtn, text: styles.primaryText };
    }
    // 'default' (or no style). If there's a cancel sibling, render this as
    // the outlined secondary (so cancel stays the prominent one, matching
    // ConfirmDialog). Otherwise this is a single OK-style button — make it
    // the prominent filled.
    return hasCancel
      ? { container: styles.secondaryBtn, text: styles.secondaryText }
      : { container: styles.primaryBtn, text: styles.primaryText };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onBackdrop}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onBackdrop}>
        <Pressable style={styles.card} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={[styles.buttonRow, stackVertical && styles.buttonStack]}>
            {buttons.map((btn, idx) => {
              const visual = buttonVisual(btn);
              return (
                <Pressable
                  key={`${btn.text}-${idx}`}
                  onPress={() => handlePress(btn)}
                  style={({ pressed }) => [
                    styles.button,
                    stackVertical ? styles.buttonStacked : styles.buttonRowItem,
                    visual.container,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={visual.text}>{btn.text}</Text>
                </Pressable>
              );
            })}
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
    marginTop: 4,
  },
  // column-reverse so primary action sits on top when stacked (Apple HIG)
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
  buttonRowItem: { flex: 1 },
  buttonStacked: { width: '100%' },
  // Filled brand-green — prominent slot. Matches ConfirmDialog.cancelBtn.
  primaryBtn: { backgroundColor: colors.primary },
  primaryText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#fff',
  },
  // Outlined — secondary slot. Matches ConfirmDialog.confirmBtnSecondary.
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  secondaryText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textPrimary,
  },
  // Filled danger red — destructive slot. Matches ConfirmDialog.destructiveBtn.
  destructiveBtn: { backgroundColor: colors.danger },
  destructiveText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: '#fff',
  },
});
