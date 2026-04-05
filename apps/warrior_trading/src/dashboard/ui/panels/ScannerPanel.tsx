import { View, StyleSheet } from 'react-native';
import { Text, Card, Badge, colors } from '@evil-empire/ui';
import { useDashboardState } from '../context/DashboardContext';

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '--';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ScannerPanel() {
  const { candidates } = useDashboardState();

  return (
    <Card variant="bordered" padding={12}>
      <Text variant="caption" color={colors['text-muted']} style={styles.title}>SCANNER</Text>
      {candidates.length === 0 && (
        <Text variant="body-sm" color={colors['text-muted']}>Waiting for scan...</Text>
      )}
      {candidates.map((c) => {
        const gapStr = (c.gapPct >= 0 ? '+' : '') + c.gapPct.toFixed(1) + '%';
        return (
          <View key={c.symbol} style={styles.card}>
            <Text variant="body-sm" style={styles.sym}>{c.symbol}</Text>
            <Badge
              label={gapStr}
              variant={c.gapPct >= 0 ? 'success' : 'destructive'}
              size="sm"
            />
            <Text variant="body-sm">${fmt(c.price)}</Text>
            <Text variant="caption" color={colors['text-secondary']}>
              RVOL {c.relativeVolume != null ? c.relativeVolume.toFixed(1) : '--'}
            </Text>
            {c.hasCatalyst && (
              <Text variant="body-sm" color={colors.warning} style={styles.catalyst}>
                {'\u2605'}
              </Text>
            )}
            <Text variant="caption" color={colors['text-muted']}>
              Score {c.score != null ? c.score.toFixed(0) : '--'}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(13,13,13,0.6)',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  sym: {
    fontWeight: '700',
  },
  catalyst: {
    fontSize: 14,
  },
});
