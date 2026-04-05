import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { colors, typography } from '../theme/tokens';

export type TextVariant = keyof typeof typography;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: string;
}

export function Text({ variant = 'body', color, style, ...props }: TextProps) {
  const typo = typography[variant];
  return (
    <RNText
      style={[
        {
          color: color ?? colors.text,
          fontSize: typo.size,
          fontWeight: typo.weight,
          lineHeight: typo.size * typo.lineHeight,
        },
        variant === 'mono' && styles.mono,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  mono: {
    fontFamily: 'monospace',
  },
});
