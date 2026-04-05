import { View, ViewProps, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

export interface BoxProps extends ViewProps {
  variant?: 'default' | 'card' | 'elevated';
}

export function Box({ variant = 'default', style, ...props }: BoxProps) {
  return (
    <View
      style={[
        variant === 'card' && styles.card,
        variant === 'elevated' && styles.elevated,
        style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors['background-card'],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  elevated: {
    backgroundColor: colors['background-elevated'],
    borderRadius: 8,
  },
});
