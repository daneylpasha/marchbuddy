import React from 'react';
import { Text, type TextProps, type TextStyle, StyleSheet } from 'react-native';
import { colors, fonts } from '../../theme';

interface BebasTextProps extends TextProps {
  size?: number;
}

export default function BebasText({ style, size, ...rest }: BebasTextProps) {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const fontSize = size ?? flat?.fontSize ?? 34;
  const letterSpacing = fontSize * 0.02;

  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fonts.titleRegular,
          fontSize,
          letterSpacing,
          textTransform: 'uppercase',
          color: colors.textPrimary,
        },
        style,
      ]}
    />
  );
}
