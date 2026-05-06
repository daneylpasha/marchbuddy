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
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RouteMap } from '../../components/session/RouteMap';
import { formatDuration } from '../../utils/sessionUtils';
import { colors, fonts, spacing } from '../../theme';
import type { RunStackParamList } from '../../navigation/RunNavigator';

type Props = NativeStackScreenProps<RunStackParamList, 'ShareSession'>;

// Card dimensions chosen so 3x device pixel ratio captures at ~1020×1530 —
// a 2:3 portrait that crops cleanly for both Instagram feed (4:5) and stories
// (9:16). Wider than this and the card overflows narrow phones.
const CARD_WIDTH = 340;
const CARD_HEIGHT = 510;
const MAP_HEIGHT = 240;

function formatPace(minutesPerKm: number | null): string {
  if (minutesPerKm == null || !isFinite(minutesPerKm) || minutesPerKm <= 0) {
    return '—';
  }
  const m = Math.floor(minutesPerKm);
  const s = Math.round((minutesPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function ShareSessionScreen({ navigation, route }: Props) {
  const { session } = route.params;
  const shareCardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isOutdoor = session.environment !== 'indoor';
  const hasRoute = isOutdoor && session.route && session.route.length >= 2;
  const durationSeconds = session.actualDurationMinutes * 60;
  const paceStr = formatPace(session.pacePerKm);

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
      const uri = await capture();
      if (!uri) {
        Alert.alert('Error', 'Could not generate share card.');
        return;
      }
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share your MarchBuddy session',
        });
      } else {
        Alert.alert('Sharing not available on this device');
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

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Share card (this is what gets captured) ─────────────────────── */}
        <View style={styles.cardShadow}>
          <View
            ref={shareCardRef}
            collapsable={false}
            style={styles.shareCard}
          >
            {/* Top brand strip */}
            <View style={styles.cardHeader}>
              <View style={styles.brandRow}>
                <View style={styles.brandDot} />
                <Text style={styles.brandWordmark}>MARCHBUDDY</Text>
              </View>
              <Text style={styles.cardDate}>{formatDate(session.completedAt)}</Text>
            </View>

            {/* Map / fallback */}
            <View style={styles.mapBlock}>
              {hasRoute ? (
                <RouteMap
                  route={session.route!}
                  height={MAP_HEIGHT}
                  style={styles.mapStyleOverride}
                />
              ) : (
                <View style={[styles.mapFallback, { height: MAP_HEIGHT }]}>
                  <Ionicons
                    name={isOutdoor ? 'navigate-outline' : 'home-outline'}
                    size={48}
                    color={colors.primary}
                  />
                  <Text style={styles.mapFallbackText}>
                    {isOutdoor ? 'Route not recorded' : 'Indoor session'}
                  </Text>
                </View>
              )}
            </View>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Text style={styles.statValue}>
                  {session.actualDistanceKm > 0
                    ? session.actualDistanceKm.toFixed(2)
                    : '—'}
                </Text>
                <Text style={styles.statLabel}>Distance · km</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{formatDuration(durationSeconds)}</Text>
                <Text style={styles.statLabel}>Duration</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statValue}>{paceStr}</Text>
                <Text style={styles.statLabel}>Pace · /km</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.cardFooterLeft}>
                <Text style={styles.cardPlan} numberOfLines={1}>
                  {session.planTitle}
                </Text>
                <Text style={styles.cardLevel}>Level {session.planLevel}</Text>
              </View>
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={styles.completedBadgeText}>Completed</Text>
              </View>
            </View>
          </View>
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
              <Ionicons name="share-social-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
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
              <Ionicons name="download-outline" size={18} color={colors.textPrimary} style={{ marginRight: 8 }} />
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

  // ── Card ────────────────────────────────────────────────────────────────
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 12,
  },
  shareCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#0E1410',
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(6,138,21,0.35)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  brandWordmark: {
    fontFamily: fonts.bold,
    fontSize: 13,
    letterSpacing: 2,
    color: '#fff',
  },
  cardDate: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.4,
    color: 'rgba(255,255,255,0.6)',
  },

  mapBlock: {
    paddingHorizontal: 14,
  },
  mapStyleOverride: {
    borderRadius: 14,
  },
  mapFallback: {
    borderRadius: 14,
    backgroundColor: 'rgba(6,138,21,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(6,138,21,0.2)',
  },
  mapFallbackText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
  },

  statsRow: {
    flexDirection: 'row',
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: '#fff',
    letterSpacing: 0.4,
  },
  statLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 14,
    marginTop: 'auto',
  },
  cardFooterLeft: { flex: 1, gap: 2 },
  cardPlan: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: '#fff',
    letterSpacing: 0.3,
  },
  cardLevel: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  completedBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.6,
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
