import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../../theme';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  imageUri?: string;
  timestamp?: string;
  onImagePress?: (uri: string) => void;
}

export default function ChatBubble({ role, content, imageUri, timestamp, onImagePress }: ChatBubbleProps) {
  const isUser = role === 'user';
  return (
    <View style={[styles.row, isUser && styles.rowUser]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
        {imageUri && (
          <Pressable onPress={() => onImagePress?.(imageUri)}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
          </Pressable>
        )}
        {content ? (
          <Text style={[styles.text, isUser ? styles.textUser : styles.textAi]}>{content}</Text>
        ) : null}
        {timestamp && (
          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAi]}>
            {timestamp}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '80%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  bubbleAi: {
    backgroundColor: colors.surfaceElevated,
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  text: {
    fontSize: 15,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    lineHeight: 22,
  },
  textAi: {
    color: colors.textPrimary,
  },
  textUser: {
    color: '#fff',
  },
  image: {
    width: 200,
    height: 150,
    borderRadius: 12,
    marginBottom: 6,
  },
  timestamp: {
    fontSize: 11,
    fontFamily: fonts.regular,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  timestampAi: {
    color: colors.textTertiary,
  },
  timestampUser: {
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
