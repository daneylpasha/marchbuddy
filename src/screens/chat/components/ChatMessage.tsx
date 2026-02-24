import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { ChatMessage as ChatMessageType } from '../../../types/chat';
import { colors, fonts } from '../../../theme';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isCoach = message.role === 'coach';

  if (message.role === 'system') {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>{message.content}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, isCoach ? styles.coachContainer : styles.userContainer]}>
      {message.imageUri && (
        <Image source={{ uri: message.imageUri }} style={styles.image} resizeMode="cover" />
      )}

      <View style={[styles.bubble, isCoach ? styles.coachBubble : styles.userBubble]}>
        <Text style={[styles.text, isCoach ? styles.coachText : styles.userText]}>
          {message.content}
        </Text>
      </View>

      <Text style={[styles.timestamp, isCoach ? styles.timestampLeft : styles.timestampRight]}>
        {formatTime(message.timestamp)}
      </Text>
    </View>
  );
};

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 6,
    maxWidth: '82%',
  },
  coachContainer: {
    alignSelf: 'flex-start',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  bubble: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  coachBubble: {
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  text: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 23,
  },
  coachText: {
    color: colors.textPrimary,
  },
  userText: {
    color: '#FFFFFF',
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 16,
    marginBottom: 8,
  },
  timestamp: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textTertiary,
    marginTop: 4,
  },
  timestampLeft: {
    textAlign: 'left',
  },
  timestampRight: {
    textAlign: 'right',
  },
  systemContainer: {
    alignSelf: 'center',
    marginVertical: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(6,138,21,0.12)',
  },
  systemText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
  },
});
