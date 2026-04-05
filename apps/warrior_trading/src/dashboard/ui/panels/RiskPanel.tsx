import { View, StyleSheet } from 'react-native';
import { Text, Card, StatRow, Badge, colors } from '@evil-empire/ui';
import { useDashboardState } from '../context/DashboardContext';

function fmtDollar(n: number | null): string {
  if (n == null || isNaN(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pnlVariant(n: number): 'success' | 'danger' | 'default' {
  return n > 0 ? 'success' : n < 0 ? 'danger' : 'default';
}

export function RiskPanel() {
  const { dailyPnL, equity, tradesWon, tradesCompleted, winRate, consecutiveLosses, isHalted } = useDashboardState();

  const wr = winRate != null ? (winRate * 100).toFixed(0) + '%' : '--';
  const winRateStr = `${tradesWon} / ${tradesCompleted} (${wr})`;

  const lossVariant = consecutiveLosses >= 3 ? 'danger' : consecutiveLosses >= 2 ? 'danger' : 'default';

  return (
    <Card variant="bordered" padding={12}>
      <Text variant="caption" color={colors['text-muted']} style={styles.title}>RISK STATUS</Text>
      <StatRow label="Daily P&L" value={fmtDollar(dailyPnL)} variant={pnlVariant(dailyPnL)} />
      <StatRow label="Equity" value={'$' + equity.toLocaleString('en-US', { minimumFractionDigits: 2 })} />
      <StatRow label="Win Rate" value={winRateStr} />
      <StatRow label="Consec. Losses" value={String(consecutiveLosses)} variant={lossVariant} />
      {isHalted && (
        <View style={styles.haltedWrap}>
          <Badge label="HALTED" variant="destructive" size="sm" />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  haltedWrap: {
    marginTop: 6,
  },
});
