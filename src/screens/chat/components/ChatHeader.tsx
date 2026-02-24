import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../../theme';

interface ChatHeaderProps {
  onBack: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ onBack }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={onBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={28} color={colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.titleContainer}>
        <View style={styles.avatar}>
          <Ionicons name="fitness" size={18} color="#FFFFFF" />
        </View>
        <View>
          <Text style={styles.title}>Your Coach</Text>
          <Text style={styles.subtitle}>Always here for you</Text>
        </View>
      </View>

      <View style={styles.spacer} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceBorder,
  },
  backButton: {
    padding: 4,
  },
  titleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.textTertiary,
  },
  spacer: {
    width: 36,
  },
});
