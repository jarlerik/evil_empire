import { View, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors } from '../../theme/tokens';

export interface StatRowProps {
  label: string;
  value: string | number;
  variant?: 'default' | 'success' | 'danger';
}

const variantColors = {
  default: colors.text,
  success: colors.success,
  danger: colors.destructive,
};

export function StatRow({ label, value, variant = 'default' }: StatRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.dot}>
        <View style={[styles.dotInner, { backgroundColor: variantColors[variant] }]} />
      </View>
      <Text variant="body" color={colors['text-secondary']} style={styles.label}>{label}</Text>
      <Text variant="body" color={variantColors[variant]}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  dot: { marginRight: 8 },
  dotInner: { width: 8, height: 8, borderRadius: 4 },
  label: { flex: 1 },
});
