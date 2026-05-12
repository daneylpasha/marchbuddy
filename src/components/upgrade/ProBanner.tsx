import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../theme';

type BannerVariant = 'next_level' | 'chat_limit' | 'level_locked' | 'general';

interface Props {
  variant: BannerVariant;
  onPress: () => void;
  nextLevel?: number;
}

const CONFIG: Record<
  BannerVariant,
  { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; sub: string; cta: string }
> = {
  next_level: {
    icon: 'rocket-outline',
    title: 'Your next level is waiting',
    sub: 'Upgrade to Pro to keep the momentum going.',
    cta: 'Unlock Now',
  },
  chat_limit: {
    icon: 'chatbubble-outline',
    title: "You've used today's free messages",
    sub: 'Go unlimited — chat with your coach anytime.',
    cta: 'Get Unlimited Chat',
  },
  level_locked: {
    icon: 'lock-closed-outline',
    title: 'This level is Pro territory',
    sub: "You've earned it. Keep going with MarchBuddy Pro.",
    cta: 'Upgrade to Continue',
  },
  general: {
    icon: 'flash-outline',
    title: 'Get the most out of FitTransformAI',
    sub: 'Unlock all 16 levels, unlimited coaching & more.',
    cta: 'See MarchBuddy Pro',
  },
};

export function ProBanner({ variant, onPress, nextLevel }: Props) {
  const config = CONFIG[variant];
  const title =
    variant === 'next_level' && nextLevel ? `Level ${nextLevel} is waiting` : config.title;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.iconWrap}>
        <Ionicons name={config.icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.textBlock}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>{config.sub}</Text>
      </View>
      <View style={styles.ctaChip}>
        <Text style={styles.ctaText}>{config.cta}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.primaryDim,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.25)',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(16,185,129,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: fonts.semiBold,
    fontSize: 13,
    color: colors.textPrimary,
    letterSpacing: 0.2,
  },
  sub: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    letterSpacing: 0.1,
  },
  ctaChip: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  ctaText: {
    fontFamily: fonts.bold,
    fontSize: 11,
    color: '#fff',
    letterSpacing: 0.4,
  },
});
