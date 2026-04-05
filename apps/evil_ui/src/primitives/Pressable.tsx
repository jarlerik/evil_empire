import { Pressable as RNPressable, PressableProps as RNPressableProps, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';

export interface PressableProps extends RNPressableProps {
  variant?: 'default' | 'highlight';
}

export function Pressable({ variant = 'default', style, ...props }: PressableProps) {
  return (
    <RNPressable
      style={({ pressed }) => [
        variant === 'highlight' && styles.highlight,
        pressed && styles.pressed,
        typeof style === 'function' ? style({ pressed }) : style,
      ]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  highlight: {
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.7,
  },
});
