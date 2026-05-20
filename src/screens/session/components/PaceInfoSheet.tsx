import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetView } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useDistanceUnit } from '../../../utils/distanceUtils';
import { colors, fonts, spacing } from '../../../theme';

export interface PaceInfoSheetRef {
  present: () => void;
}

const PaceInfoSheet = forwardRef<PaceInfoSheetRef>((_props, ref) => {
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%'], []);
  const unit = useDistanceUnit();
  const isMiles = unit === 'miles';
  const unitLong = isMiles ? 'mile' : 'kilometre';
  const unitShort = isMiles ? 'mi' : 'km';
  const paceLabel = `/${unitShort}`;
  const exampleHigh = isMiles ? '10:30' : '6:30';
  const walkLow = isMiles ? '14:30' : '9:00';
  const walkHigh = isMiles ? '22:30' : '14:00';

  useImperativeHandle(ref, () => ({
    present: () => modalRef.current?.present(),
  }));

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.6}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Pace (min{paceLabel})</Text>
          <Pressable
            onPress={() => modalRef.current?.dismiss()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>

        <Text style={styles.body}>
          Pace shows how long it takes you to cover one {unitLong} at your current speed.
        </Text>

        <View style={styles.exampleBox}>
          <Text style={styles.exampleLabel}>EXAMPLE</Text>
          <Text style={styles.exampleText}>
            <Text style={styles.exampleHighlight}>
              {exampleHigh} {paceLabel}
            </Text>{' '}
            means you'd cover 1 {unitShort} in {exampleHigh.split(':')[0]} minutes and{' '}
            {exampleHigh.split(':')[1]} seconds.
          </Text>
          <Text style={styles.exampleSub}>Lower number = faster. Higher number = slower.</Text>
        </View>

        <Text style={styles.body}>
          We calculate it live from your GPS — distance ÷ time. The first ~100 metres are skipped
          because GPS readings are unreliable at very short distances.
        </Text>

        <View style={styles.tipRow}>
          <Ionicons name="bulb-outline" size={16} color={colors.primary} />
          <Text style={styles.tipText}>
            For walking, anything between {walkLow} and {walkHigh} {paceLabel} is normal. Don't
            chase a number — focus on showing up.
          </Text>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

PaceInfoSheet.displayName = 'PaceInfoSheet';

export default PaceInfoSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
  },
  content: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 32,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 20,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  closeButton: {
    padding: 4,
  },
  body: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSecondary,
  },
  exampleBox: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    gap: 6,
  },
  exampleLabel: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
  },
  exampleText: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textPrimary,
  },
  exampleHighlight: {
    fontFamily: fonts.bold,
    color: colors.primary,
  },
  exampleSub: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textTertiary,
    marginTop: 4,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: colors.primaryDim,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  tipText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textPrimary,
  },
});
