import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, StatRow, colors } from '@evil-empire/ui';
import { useDashboardState, useDashboardDispatch } from '../context/DashboardContext';

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '--';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDollar(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '--';
  const sign = n >= 0 ? '+' : '';
  return sign + '$' + fmt(Math.abs(n));
}

function pnlVariant(n: number | null | undefined): 'success' | 'danger' | 'default' {
  if (n == null) return 'default';
  return n > 0 ? 'success' : n < 0 ? 'danger' : 'default';
}

export function PositionPanel() {
  const { position, positionFlash, closedPnL } = useDashboardState();
  const dispatch = useDashboardDispatch();

  useEffect(() => {
    if (positionFlash) {
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_FLASH' }), 600);
      return () => clearTimeout(timer);
    }
  }, [positionFlash, dispatch]);

  useEffect(() => {
    if (closedPnL) {
      const timer = setTimeout(() => dispatch({ type: 'CLEAR_CLOSED_PNL' }), 2000);
      return () => clearTimeout(timer);
    }
  }, [closedPnL, dispatch]);

  return (
    <Card
      variant="bordered"
      padding={12}
      style={positionFlash ? styles.flash : undefined}
    >
      <Text variant="caption" color={colors['text-muted']} style={styles.title}>POSITION</Text>
      {!position && !closedPnL && (
        <Text variant="body-sm" color={colors['text-muted']} style={styles.empty}>No position</Text>
      )}
      {!position && closedPnL && (
        <Text
          variant="body-sm"
          color={closedPnL.value >= 0 ? colors.success : colors.destructive}
        >
          {fmtDollar(closedPnL.value)} {closedPnL.reason}
        </Text>
      )}
      {position && (
        <View>
          <StatRow label="Symbol" value={position.symbol} />
          <StatRow label="Strategy" value={position.strategy} />
          <StatRow label="Entry" value={'$' + fmt(position.entryPrice)} />
          <StatRow label="Shares" value={String(position.shares)} />
          <StatRow label="Current" value={'$' + fmt(position.currentPrice)} />
          <StatRow
            label="Unrealized"
            value={fmtDollar(position.unrealizedPnL)}
            variant={pnlVariant(position.unrealizedPnL)}
          />
          <StatRow label="Stop" value={'$' + fmt(position.stopPrice)} />
          <StatRow label="Target" value={'$' + fmt(position.targetPrice)} />
          <StatRow label="Trailing Stop" value={position.trailingStop != null ? '$' + fmt(position.trailingStop) : '--'} />
          <StatRow label="Bars Held" value={String(position.barsHeld ?? '--')} />
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
  empty: {
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  flash: {
    backgroundColor: 'rgba(34,197,94,0.15)',
  },
});
