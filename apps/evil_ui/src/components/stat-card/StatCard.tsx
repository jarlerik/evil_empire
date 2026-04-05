import { View, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { Card } from '../card';
import { colors } from '../../theme/tokens';

export interface StatCardProps {
  value: string | number;
  label: string;
  trend?: string;
  icon?: React.ReactNode;
}

export function StatCard({ value, label, trend, icon }: StatCardProps) {
  return (
    <Card variant="bordered" padding={16}>
      <View style={styles.row}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.content}>
          <Text variant="display" style={styles.value}>{String(value)}</Text>
          <Text variant="body-sm" color={colors['text-secondary']}>{label}</Text>
        </View>
        {trend && (
          <Text variant="caption" color={colors.success}>{trend}</Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { marginRight: 12 },
  content: { flex: 1 },
  value: { marginBottom: 4 },
});
