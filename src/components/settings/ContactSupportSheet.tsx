import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, spacing } from '../../theme';

const SUPPORT_EMAIL = 'support@marchbuddy.com';

export interface ContactSupportSheetRef {
  present: () => void;
}

const ContactSupportSheet = forwardRef<ContactSupportSheetRef>((_, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);

  const snapPoints = useMemo(() => ['42%'], []);

  useImperativeHandle(ref, () => ({
    present: () => modalRef.current?.present(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    [],
  );

  const handleOpenMail = async () => {
    const url = `mailto:${SUPPORT_EMAIL}`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert(
          'No email app found',
          `Please email us directly at ${SUPPORT_EMAIL}.`,
        );
        return;
      }
      await Linking.openURL(url);
      modalRef.current?.dismiss();
    } catch {
      Alert.alert('Could not open email app', `Please email us at ${SUPPORT_EMAIL}.`);
    }
  };

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handle}
      backdropComponent={renderBackdrop}
    >
      <BottomSheetView style={styles.container}>
        <View style={styles.iconWrap}>
          <Ionicons name="mail-outline" size={28} color={colors.primary} />
        </View>

        <Text style={styles.title}>Need help?</Text>
        <Text style={styles.subtitle}>
          Send us your question, issue, or feedback at the email below — we read every message.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.emailBox, pressed && styles.emailBoxPressed]}
          onLongPress={() => {
            // Native long-press will reveal the system "Copy" action on the
            // selectable text inside. No-op here is intentional.
          }}
          onPress={handleOpenMail}
        >
          <Text selectable style={styles.emailText}>
            {SUPPORT_EMAIL}
          </Text>
          <Ionicons name="open-outline" size={16} color={colors.textTertiary} />
        </Pressable>

        <Text style={styles.hint}>Tap to open your email app, or long-press to copy.</Text>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

ContactSupportSheet.displayName = 'ContactSupportSheet';

export default ContactSupportSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.surfaceElevated,
  },
  handle: {
    backgroundColor: colors.textTertiary,
    width: 36,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: 'center',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    maxWidth: 320,
  },
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 22,
  },
  emailBoxPressed: {
    opacity: 0.85,
  },
  emailText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 14,
    textAlign: 'center',
  },
});
