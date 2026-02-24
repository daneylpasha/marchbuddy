import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts } from '../../../theme';

interface ChatInputProps {
  onSend: (text: string, imageUri?: string) => void;
  disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  const handleSend = () => {
    if (text.trim() || imageUri) {
      onSend(text.trim(), imageUri || undefined);
      setText('');
      setImageUri(null);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const canSend = (text.trim().length > 0 || !!imageUri) && !disabled;

  return (
    <View style={styles.container}>
      {imageUri && (
        <View style={styles.imagePreview}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <TouchableOpacity style={styles.removeImage} onPress={() => setImageUri(null)}>
            <Ionicons name="close-circle" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.iconButton} onPress={handleTakePhoto} disabled={disabled}>
          <Ionicons
            name="camera-outline"
            size={22}
            color={disabled ? colors.textMuted : colors.textTertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.iconButton} onPress={handlePickImage} disabled={disabled}>
          <Ionicons
            name="image-outline"
            size={22}
            color={disabled ? colors.textMuted : colors.textTertiary}
          />
        </TouchableOpacity>

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
          <Ionicons
            name="send"
            size={16}
            color={canSend ? colors.textPrimary : colors.textMuted}
          />
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
  imagePreview: {
    padding: 12,
    paddingBottom: 0,
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 12,
  },
  removeImage: {
    position: 'absolute',
    top: 8,
    left: 96,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  iconButton: {
    padding: 8,
    marginBottom: 2,
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
