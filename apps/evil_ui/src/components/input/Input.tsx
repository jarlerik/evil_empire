import { View, TextInput, TextInputProps, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors, radius } from '../../theme/tokens';
import { useState } from 'react';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  variant?: 'default' | 'filled';
}

export function Input({ label, error, variant = 'default', style, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View>
      {label && <Text variant="caption" color={colors['text-secondary']} style={styles.label}>{label}</Text>}
      <TextInput
        placeholderTextColor={colors['text-muted']}
        onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
        style={[
          styles.input,
          variant === 'filled' && styles.filled,
          focused && styles.focused,
          error ? styles.error : null,
          style,
        ]}
        {...props}
      />
      {error && <Text variant="caption" color={colors.destructive} style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 4 },
  input: {
    backgroundColor: colors['background-input'],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filled: {
    backgroundColor: colors['background-elevated'],
    borderColor: 'transparent',
  },
  focused: {
    borderColor: colors['border-focus'],
  },
  error: {
    borderColor: colors.destructive,
  },
  errorText: { marginTop: 4 },
});
