import { View, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { Text } from '../../primitives/Text';
import { Card } from '../card';
import { colors } from '../../theme/tokens';

export type StatCardTrendDirection = 'up' | 'down' | 'neutral';

export interface StatCardProps {
  value: string | number;
  label: string;
  trend?: string;
  trendDirection?: StatCardTrendDirection;
  icon?: React.ReactNode;
  valueStyle?: StyleProp<TextStyle>;
  labelStyle?: StyleProp<TextStyle>;
}

function inferDirection(trend: string): StatCardTrendDirection {
  const trimmed = trend.trim();
  if (trimmed.startsWith('+')) return 'up';
  if (trimmed.startsWith('-') || trimmed.startsWith('−')) return 'down';
  return 'neutral';
}

function trendColor(direction: StatCardTrendDirection): string {
  switch (direction) {
    case 'up':
      return colors.success;
    case 'down':
      return colors.destructive;
    case 'neutral':
    default:
      return colors['text-secondary'];
  }
}

export function StatCard({
  value,
  label,
  trend,
  trendDirection,
  icon,
  valueStyle,
  labelStyle,
}: StatCardProps) {
  const direction = trend ? (trendDirection ?? inferDirection(trend)) : 'neutral';
  return (
    <Card variant="bordered" padding={16}>
      <View style={styles.row}>
        {icon && <View style={styles.icon}>{icon}</View>}
        <View style={styles.content}>
          <Text variant="display" style={[styles.value, valueStyle]}>{String(value)}</Text>
          <Text variant="body-sm" color={colors['text-secondary']} style={labelStyle}>{label}</Text>
        </View>
        {trend && (
          <Text variant="caption" color={trendColor(direction)}>{trend}</Text>
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
