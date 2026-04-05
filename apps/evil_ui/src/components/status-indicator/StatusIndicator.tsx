import { View, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors } from '../../theme/tokens';

export interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'danger' | 'warning';
  label?: string;
  size?: number;
}

const statusColors = {
  online: colors.success,
  offline: colors['text-muted'],
  danger: colors.destructive,
  warning: colors.warning,
};

export function StatusIndicator({ status, label, size = 8 }: StatusIndicatorProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: statusColors[status] }]} />
      {label && <Text variant="body-sm" color={colors['text-secondary']} style={styles.label}>{label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: {},
  label: { marginLeft: 6 },
});
