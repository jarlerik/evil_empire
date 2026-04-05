import { View, StyleSheet } from 'react-native';
import { Text } from '../../primitives/Text';
import { colors, radius } from '../../theme/tokens';

export interface SystemStatusProps {
  status: 'online' | 'offline' | 'degraded';
  uptime?: string;
  stats?: Record<string, string | number>;
}

const statusConfig = {
  online: { color: colors.success, label: 'SYSTEM ONLINE' },
  offline: { color: colors.destructive, label: 'SYSTEM OFFLINE' },
  degraded: { color: colors.warning, label: 'SYSTEM DEGRADED' },
};

export function SystemStatus({ status, uptime, stats }: SystemStatusProps) {
  const config = statusConfig[status];
  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: config.color }]} />
        <Text variant="caption" color={config.color}>{config.label}</Text>
      </View>
      {uptime && (
        <Text variant="body-sm" color={colors['text-muted']} style={styles.stat}>
          UPTIME: {uptime}
        </Text>
      )}
      {stats && Object.entries(stats).map(([key, val]) => (
        <Text key={key} variant="body-sm" color={colors['text-muted']} style={styles.stat}>
          {key.toUpperCase()}: {String(val)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
    backgroundColor: colors['background-card'],
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  stat: { marginTop: 2 },
});
