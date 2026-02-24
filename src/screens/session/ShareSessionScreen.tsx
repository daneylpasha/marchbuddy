import React, { useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { formatDuration } from '../../utils/sessionUtils';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type Props = NativeStackScreenProps<RunStackParamList, 'ShareSession'>;

export default function ShareSessionScreen({ navigation, route }: Props) {
  const { session } = route.params;
  const shareCardRef = useRef<View>(null);

  const capture = async (): Promise<string | null> => {
    if (!shareCardRef.current) return null;
    try {
      return await captureRef(shareCardRef, { format: 'png', quality: 1 });
    } catch (err) {
      console.error('captureRef error:', err);
      return null;
    }
  };

  const handleShare = async () => {
    const uri = await capture();
    if (!uri) return;

    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: 'Share your session',
      });
    } else {
      Alert.alert('Sharing not available on this device');
    }
  };

  const handleSaveToGallery = async () => {
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to save images.');
      return;
    }

    const uri = await capture();
    if (!uri) return;

    try {
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Image saved to your gallery.');
    } catch (err) {
      console.error('Save to gallery error:', err);
      Alert.alert('Error', 'Could not save the image.');
    }
  };

  const durationSeconds = session.actualDurationMinutes * 60;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={styles.title}>SHARE YOUR SESSION</Text>

        {/* Share card */}
        <View style={styles.cardWrapper}>
          <View ref={shareCardRef} style={styles.shareCard} collapsable={false}>
            <Text style={styles.cardBrand}>MARCHBUDDY</Text>

            <View style={styles.cardStats}>
              <View style={styles.cardStat}>
                <Text style={styles.cardStatValue}>{formatDuration(durationSeconds)}</Text>
                <Text style={styles.cardStatLabel}>Duration</Text>
              </View>
              <View style={styles.cardStatDivider} />
              <View style={styles.cardStat}>
                <Text style={styles.cardStatValue}>
                  {session.actualDistanceKm.toFixed(2)} km
                </Text>
                <Text style={styles.cardStatLabel}>Distance</Text>
              </View>
            </View>

            <View style={styles.cardFooter}>
              <Text style={styles.cardLevel}>Level {session.planLevel}</Text>
              <Text style={styles.cardPlan}>{session.planTitle}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.shareButton, pressed && { opacity: 0.85 }]}
            onPress={handleShare}
          >
            <Text style={styles.shareButtonText}>Share</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && { opacity: 0.75 }]}
            onPress={handleSaveToGallery}
          >
            <Text style={styles.saveButtonText}>Save to Gallery</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.skipRow}>
        <Pressable onPress={() => navigation.popToTop()}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 28,
    alignItems: 'center',
  },
  title: {
    fontFamily: fonts.titleRegular,
    fontSize: 30,
    color: '#fff',
    letterSpacing: 1.2,
    marginBottom: 32,
  },
  cardWrapper: {
    marginBottom: 36,
    // Shadow for card preview
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  shareCard: {
    width: 300,
    backgroundColor: colors.primary,
    borderRadius: 20,
    padding: 24,
  },
  cardBrand: {
    fontFamily: fonts.bold,
    fontSize: 12,
    letterSpacing: 2,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 24,
  },
  cardStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  cardStat: {
    flex: 1,
    alignItems: 'center',
  },
  cardStatValue: {
    fontFamily: fonts.bold,
    fontSize: 26,
    color: '#fff',
  },
  cardStatLabel: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },
  cardStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginVertical: 6,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
    paddingTop: 16,
    alignItems: 'center',
    gap: 4,
  },
  cardLevel: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
  },
  cardPlan: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: '#fff',
  },
  actions: {
    width: '100%',
    gap: 12,
  },
  shareButton: {
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 14,
    alignItems: 'center',
  },
  shareButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
  },
  saveButton: {
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textPrimary,
  },
  skipRow: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  skipText: {
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textTertiary,
  },
});
