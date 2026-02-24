import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../../../theme';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ title, children }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textTertiary,
    marginBottom: 8,
  },
  content: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    overflow: 'hidden',
  },
});
