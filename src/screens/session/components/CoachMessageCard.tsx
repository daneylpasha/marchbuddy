import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../theme';

interface CoachMessageCardProps {
  message: string;
}

export const CoachMessageCard: React.FC<CoachMessageCardProps> = ({ message }) => (
  <View style={styles.container}>
    <Text style={styles.label}>COACH</Text>
    <Text style={styles.message}>{message}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    padding: 20,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
    color: colors.primary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 24,
    color: colors.textPrimary,
  },
});
