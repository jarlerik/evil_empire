import { View, ViewProps, StyleSheet } from 'react-native';
import { colors, radius } from '../../theme/tokens';

export interface CardProps extends ViewProps {
  variant?: 'default' | 'bordered' | 'ghost';
  padding?: number;
}

export function Card({ variant = 'bordered', padding = 16, style, children, ...props }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        { padding },
        variant === 'bordered' && styles.bordered,
        variant === 'ghost' && styles.ghost,
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors['background-card'],
    borderRadius: radius.md,
  },
  bordered: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
});
