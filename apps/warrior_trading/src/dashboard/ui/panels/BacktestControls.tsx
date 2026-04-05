import { useEffect, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Text, colors } from '@evil-empire/ui';
import { useDashboardState, useDashboardDispatch } from '../context/DashboardContext';
import type { TradeEntry } from '../context/DashboardContext';

const SPEED_LEVELS = [1, 5, 25, 100, 0] as const;
const SPEED_LABELS: Record<number, string> = { 1: '1x', 5: '5x', 25: '25x', 100: '100x', 0: 'Max' };

interface BacktestControlsProps {
  sendPlayback: (action: 'play' | 'pause' | 'step' | 'speed', speed?: number) => void;
}

function exportCSV(trades: TradeEntry[]) {
  if (trades.length === 0) return;
  const headers = ['#', 'Time', 'Symbol', 'Strategy', 'Entry', 'Exit', 'Shares', 'P&L', 'R-Multiple', 'Bars', 'Exit Reason'];
  const rows = trades.map(t => [
    t.num, t.time, t.symbol, t.strategy,
    t.entry != null ? t.entry.toFixed(2) : '',
    t.exit != null ? t.exit.toFixed(2) : '',
    t.shares,
    t.pnl != null ? t.pnl.toFixed(2) : '',
    t.rMult != null ? t.rMult.toFixed(2) : '',
    t.bars != null ? t.bars : '',
    t.reason || '',
  ]);
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'trades_' + new Date().toISOString().slice(0, 10) + '.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function BacktestControls({ sendPlayback }: BacktestControlsProps) {
  const { mode, isPaused, currentSpeed, trades } = useDashboardState();
  const dispatch = useDashboardDispatch();

  const cycleSpeed = useCallback((dir: number) => {
    const idx = SPEED_LEVELS.indexOf(currentSpeed as (typeof SPEED_LEVELS)[number]);
    const next = Math.max(0, Math.min(SPEED_LEVELS.length - 1, idx + dir));
    const speed = SPEED_LEVELS[next];
    dispatch({ type: 'SET_SPEED', speed });
    sendPlayback('speed', speed);
  }, [currentSpeed, dispatch, sendPlayback]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (mode !== 'backtest') return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          if (isPaused) {
            dispatch({ type: 'SET_PAUSED', paused: false });
            sendPlayback('play');
          } else {
            dispatch({ type: 'SET_PAUSED', paused: true });
            sendPlayback('pause');
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          sendPlayback('step');
          break;
        case '+': case '=':
          e.preventDefault();
          cycleSpeed(1);
          break;
        case '-':
          e.preventDefault();
          cycleSpeed(-1);
          break;
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mode, isPaused, cycleSpeed, dispatch, sendPlayback]);

  if (mode !== 'backtest') return null;

  return (
    <View style={styles.bar}>
      <Button
        title={'\u23F8'}
        variant="outline"
        size="sm"
        onPress={() => { dispatch({ type: 'SET_PAUSED', paused: true }); sendPlayback('pause'); }}
      />
      <Button
        title={'\u25B6'}
        variant="outline"
        size="sm"
        onPress={() => { dispatch({ type: 'SET_PAUSED', paused: false }); sendPlayback('play'); }}
      />
      <Button
        title={'\u23ED Step'}
        variant="outline"
        size="sm"
        onPress={() => sendPlayback('step')}
      />
      <View style={styles.speedGroup}>
        {SPEED_LEVELS.map((spd) => (
          <Button
            key={spd}
            title={SPEED_LABELS[spd]}
            variant={currentSpeed === spd ? 'primary' : 'outline'}
            size="sm"
            onPress={() => {
              dispatch({ type: 'SET_SPEED', speed: spd });
              sendPlayback('speed', spd);
            }}
          />
        ))}
      </View>
      <View style={styles.spacer} />
      <Button
        title="Export CSV"
        variant="ghost"
        size="sm"
        onPress={() => exportCSV(trades)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    height: 44,
    backgroundColor: colors['background-card'],
  },
  speedGroup: {
    flexDirection: 'row',
    gap: 2,
    marginLeft: 10,
  },
  spacer: { flex: 1 },
});
