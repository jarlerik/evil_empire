import { Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors, radius } from '../../theme/tokens';

export interface ButtonProps {
  title: string;
  variant?: 'primary' | 'ghost' | 'outline' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

export function Button({ title, variant = 'primary', size = 'md', loading, disabled, onPress }: ButtonProps) {
  const bg = variant === 'primary' ? colors.primary
    : variant === 'destructive' ? colors.destructive
    : 'transparent';
  const textColor = variant === 'ghost' || variant === 'outline' ? colors.primary : colors['primary-foreground'];
  const paddingV = size === 'sm' ? 6 : size === 'lg' ? 14 : 10;
  const paddingH = size === 'sm' ? 12 : size === 'lg' ? 24 : 16;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, paddingVertical: paddingV, paddingHorizontal: paddingH },
        variant === 'outline' && styles.outline,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <Text variant="heading-sm" color={textColor}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
