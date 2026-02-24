import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useFeedbackStore } from '../../../store/feedbackStore';
import { useCoachSetupStore } from '../../../store/coachSetupStore';
import { colors, fonts } from '../../../theme';

export const CoachChatBanner: React.FC = () => {
  const dismissed = useFeedbackStore((s) => s.coachBannerDismissed);
  const dismiss = useFeedbackStore((s) => s.dismissCoachBanner);
  const completedAt = useCoachSetupStore((s) => s.setupData.completedAt);

  if (dismissed || !completedAt) return null;

  // Only show during the first 7 days after onboarding
  const onboarded = new Date(completedAt);
  const now = new Date();
  onboarded.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((now.getTime() - onboarded.getTime()) / (1000 * 60 * 60 * 24));
  if (daysSince > 7) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>💬</Text>
      <Text style={styles.text}>
        Tell your coach anything — feedback, complaints, ideas. We're listening.
      </Text>
      <TouchableOpacity
        onPress={dismiss}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={18} color={colors.textTertiary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  icon: {
    fontSize: 16,
  },
  text: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
