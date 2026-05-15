import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts } from '../../../theme';

interface ChatInputProps {
  onSend: (text: string, imageUri?: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    if (text.trim()) {
      onSend(text.trim());
      setText('');
    }
  };

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, isFocused && styles.inputFocused]}
          value={text}
          onChangeText={setText}
          placeholder="Message your coach..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={500}
          editable={!disabled}
          selectionColor={colors.primary}
          cursorColor={Platform.OS === 'android' ? colors.primary : undefined}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />

        <TouchableOpacity
          style={[styles.sendButton, canSend && styles.sendButtonActive]}
          onPress={handleSend}
          disabled={!canSend}
          activeOpacity={0.8}
        >
          <Ionicons name="send" size={16} color={canSend ? colors.textPrimary : colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    backgroundColor: colors.background,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  input: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.divider,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 1,
  },
  sendButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
