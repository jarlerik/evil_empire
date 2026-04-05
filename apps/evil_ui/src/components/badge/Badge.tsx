import { View, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors, radius } from '../../theme/tokens';

export interface BadgeProps {
  label: string;
  variant?: 'default' | 'primary' | 'success' | 'destructive';
  size?: 'sm' | 'md';
}

const variantStyles = {
  default: { bg: colors['background-elevated'], text: colors['text-secondary'] },
  primary: { bg: colors['primary-muted'], text: colors['primary-foreground'] },
  success: { bg: colors['success-muted'], text: colors.success },
  destructive: { bg: colors['destructive-muted'], text: colors.destructive },
};

export function Badge({ label, variant = 'default', size = 'md' }: BadgeProps) {
  const v = variantStyles[variant];
  return (
    <View style={[styles.base, { backgroundColor: v.bg }, size === 'sm' && styles.sm]}>
      <Text variant={size === 'sm' ? 'caption' : 'body-sm'} color={v.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  sm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
