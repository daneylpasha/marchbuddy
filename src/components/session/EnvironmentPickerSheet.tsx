import React, { useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
  BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

export type SessionEnvironment = 'indoor' | 'outdoor';

interface Props {
  onSelect: (env: SessionEnvironment) => void;
}

const EnvironmentPickerSheet = React.forwardRef<BottomSheetModal, Props>(
  ({ onSelect }, ref) => {
    const snapPoints = useMemo(() => ['42%'], []);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
      ),
      [],
    );

    return (
      <BottomSheetModal
        ref={ref}
        snapPoints={snapPoints}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handle}
        backdropComponent={renderBackdrop}
      >
        <BottomSheetView style={styles.container}>
          <Text style={styles.title}>WHERE ARE YOU RUNNING?</Text>
          <View style={styles.options}>
            <Pressable
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={() => onSelect('outdoor')}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="sunny-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.optionLabel}>Outdoor</Text>
              <Text style={styles.optionSub}>Road, trail, or track</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              onPress={() => onSelect('indoor')}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="fitness-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.optionLabel}>Indoor</Text>
              <Text style={styles.optionSub}>Treadmill or gym</Text>
            </Pressable>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

export default EnvironmentPickerSheet;

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: colors.surfaceElevated,
  },
  handle: {
    backgroundColor: colors.textTertiary,
    width: 36,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 20,
  },
  options: {
    flexDirection: 'row',
    gap: 12,
  },
  option: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  optionPressed: {
    opacity: 0.7,
    borderColor: colors.primary,
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
  optionLabel: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  optionSub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});
