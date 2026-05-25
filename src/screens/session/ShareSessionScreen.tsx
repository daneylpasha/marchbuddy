import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';
import { shareCelebrationCard } from '../../utils/shareCelebrationCard';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import ShareCard, { CARD_WIDTH, CARD_HEIGHT } from '../../components/session/ShareCard';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';
import { analytics, EVENTS } from '../../services/analytics';
import type { PersonalRecord } from '../../types/personalRecord';

type Props = NativeStackScreenProps<RunStackParamList, 'ShareSession'>;

// Card dimensions chosen so 3x device pixel ratio captures at ~1020×1530 —
// a 2:3 portrait that crops cleanly for both Instagram feed (4:5) and stories
export default function ShareSessionScreen({ navigation, route }: Props) {
  const { session, prs } = route.params;
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const featuredPr: PersonalRecord | null = prs?.[0] ?? null;

  const capture = async (): Promise<string | null> => {
    if (!shareCardRef.current) return null;
    try {
      // Default device pixel ratio captures the card at ~3x for retina screens,
      // giving a sharp ~1020×1530 PNG without us doing any manual scaling.
      return await captureRef(shareCardRef, { format: 'png', quality: 1 });
    } catch (err) {
      console.error('captureRef error:', err);
      return null;
    }
  };

  const handleShare = async () => {
    setIsSharing(true);
    try {
      await shareCelebrationCard(shareCardRef, 'Share your MarchBuddy session', 'session');
      // Keep pr_shared for backward compat with existing PostHog dashboards.
      // Fires only when a PR badge is on the card.
      if (featuredPr) {
        analytics.track(EVENTS.pr_shared, {
          pr_id: featuredPr.id,
          pr_type: featuredPr.pr_type,
          pr_subtype: featuredPr.pr_subtype ?? null,
          share_destination: 'system_sheet',
        });
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveToGallery = async () => {
    setIsSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow photo library access to save images.');
        return;
      }
      const uri = await capture();
      if (!uri) {
        Alert.alert('Error', 'Could not generate share card.');
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved!', 'Share card saved to your gallery.');
    } catch (err) {
      console.error('Save to gallery error:', err);
      Alert.alert('Error', 'Could not save the image.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>SHARE</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Share card (this is what gets captured) ─────────────────────── */}
        <View style={styles.cardShadow}>
          <ShareCard ref={shareCardRef} session={session} prs={prs} />
        </View>

        {/* Hint */}
        <Text style={styles.hint}>
          Tap share to post to Instagram, WhatsApp, or save to your gallery.
        </Text>
      </ScrollView>

      {/* ── Actions (not captured) ──────────────────────────────────────── */}
      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [
            styles.shareButton,
            (isSharing || isSaving) && styles.buttonDisabled,
            pressed && !isSharing && !isSaving && styles.buttonPressed,
          ]}
          onPress={handleShare}
          disabled={isSharing || isSaving}
        >
          {isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons
                name="share-social-outline"
                size={20}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={styles.shareButtonText}>Share</Text>
            </>
          )}
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            (isSharing || isSaving) && styles.buttonDisabled,
            pressed && !isSharing && !isSaving && { opacity: 0.7 },
          ]}
          onPress={handleSaveToGallery}
          disabled={isSharing || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.textPrimary} />
          ) : (
            <>
              <Ionicons
                name="download-outline"
                size={18}
                color={colors.textPrimary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.saveButtonText}>Save to Gallery</Text>
            </>
          )}
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.screenPadding,
    paddingVertical: 12,
  },
  backBtn: { width: 36, alignItems: 'flex-start' },
  headerTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 2,
    color: colors.textSecondary,
  },
  scroll: {
    paddingTop: 12,
    paddingBottom: 24,
    alignItems: 'center',
  },
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },

  // ── Hint + actions ──────────────────────────────────────────────────────
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 18,
    paddingHorizontal: 32,
    lineHeight: 17,
  },
  actions: {
    paddingHorizontal: spacing.screenPadding,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 10,
  },
  shareButton: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    fontFamily: fonts.semiBold,
    fontSize: 16,
    color: '#fff',
    letterSpacing: 0.3,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceElevated,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  saveButtonText: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { opacity: 0.85 },
});
