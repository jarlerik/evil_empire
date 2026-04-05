import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, colors } from '@evil-empire/ui';
import { useDashboardState } from '../context/DashboardContext';

function fmt(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '--';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDollar(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return sign + '$' + fmt(Math.abs(n));
}

const COLUMNS = ['#', 'Time', 'Symbol', 'Strategy', 'Entry', 'Exit', 'Shares', 'P&L', 'R-Mult', 'Bars', 'Exit Reason'];
const COL_WIDTHS = [36, 80, 64, 90, 72, 72, 56, 80, 64, 44, 100];

export function TradeLog() {
  const { trades, totalPnl, totalR } = useDashboardState();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll}>
        {/* Header */}
        <View style={styles.headerRow}>
          {COLUMNS.map((col, i) => (
            <View key={col} style={[styles.cell, { width: COL_WIDTHS[i] }]}>
              <Text variant="caption" color={colors['text-muted']}>{col}</Text>
            </View>
          ))}
        </View>

        {/* Body */}
        {trades.map((t) => (
          <View key={t.num} style={styles.row}>
            <View style={[styles.cell, { width: COL_WIDTHS[0] }]}>
              <Text variant="mono" color={colors['text-secondary']}>{t.num}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[1] }]}>
              <Text variant="mono">{t.time}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[2] }]}>
              <Text variant="mono" style={styles.bold}>{t.symbol}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[3] }]}>
              <Text variant="mono" color={colors['text-secondary']}>{t.strategy}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[4] }]}>
              <Text variant="mono">${fmt(t.entry)}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[5] }]}>
              <Text variant="mono">${fmt(t.exit)}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[6] }]}>
              <Text variant="mono">{String(t.shares)}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[7] }]}>
              <Text variant="mono" color={t.pnl >= 0 ? colors.success : colors.destructive}>
                {fmtDollar(t.pnl)}
              </Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[8] }]}>
              <Text variant="mono">{t.rMult != null ? t.rMult.toFixed(2) + 'R' : '--'}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[9] }]}>
              <Text variant="mono">{t.bars != null ? String(t.bars) : '--'}</Text>
            </View>
            <View style={[styles.cell, { width: COL_WIDTHS[10] }]}>
              <Text variant="mono" color={colors['text-secondary']}>{t.reason}</Text>
            </View>
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footerRow}>
          <View style={[styles.cell, { width: COL_WIDTHS.slice(0, 7).reduce((a, b) => a + b, 0) }]}>
            <Text variant="mono" color={colors['text-secondary']} style={styles.bold}>Totals:</Text>
          </View>
          <View style={[styles.cell, { width: COL_WIDTHS[7] }]}>
            <Text variant="mono" color={totalPnl >= 0 ? colors.success : colors.destructive} style={styles.bold}>
              {fmtDollar(totalPnl)}
            </Text>
          </View>
          <View style={[styles.cell, { width: COL_WIDTHS[8] }]}>
            <Text variant="mono" style={styles.bold}>{totalR !== 0 ? totalR.toFixed(2) + 'R' : '--'}</Text>
          </View>
          <View style={[styles.cell, { width: COL_WIDTHS[9] + COL_WIDTHS[10] }]}>
            <Text variant="mono" color={colors['text-secondary']}>{trades.length} trades</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors['background-card'],
    overflow: 'hidden',
  },
  scroll: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(42,42,42,0.4)',
  },
  footerRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  cell: {
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  bold: {
    fontWeight: '700',
  },
});
