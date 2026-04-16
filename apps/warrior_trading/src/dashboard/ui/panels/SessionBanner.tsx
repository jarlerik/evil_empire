import { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Badge, StatusIndicator, colors } from '@evil-empire/ui';
import { useDashboardState } from '../context/DashboardContext';
import type { SessionPhase } from '../../types';

const phaseToStatus: Record<SessionPhase, 'online' | 'offline' | 'warning' | 'danger'> = {
  'pre-market': 'warning',
  'open': 'online',
  'midday': 'online',
  'close': 'online',
  'after-hours': 'offline',
  'closed': 'offline',
};

function ETClock() {
  const [time, setTime] = useState('--:--:--');
  useEffect(() => {
    function tick() {
      try {
        setTime(
          new Date().toLocaleTimeString('en-US', {
            timeZone: 'America/New_York',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
          })
        );
      } catch { /* timezone not supported */ }
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return <Text variant="mono" color={colors['text-secondary']}>{time} ET</Text>;
}

export function SessionBanner() {
  const { mode, phase, backtestProgress, connected } = useDashboardState();

  return (
    <View style={styles.banner}>
      <Badge
        label={mode.toUpperCase()}
        variant={mode === 'live' ? 'success' : 'primary'}
        size="sm"
      />
      <StatusIndicator
        status={phaseToStatus[phase] || 'offline'}
        label={phase.replace('-', ' ')}
      />
      {mode === 'backtest' && backtestProgress != null && (
        <View style={styles.progressWrap}>
          <View style={[styles.progressBar, { width: `${Math.round(backtestProgress * 1000) / 10}%` }]} />
        </View>
      )}
      {!connected && (
        <Badge label="DISCONNECTED" variant="destructive" size="sm" />
      )}
      <View style={styles.spacer} />
      <ETClock />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    height: 40,
    backgroundColor: colors['background-card'],
  },
  progressWrap: {
    flex: 1,
    maxWidth: 300,
    height: 6,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  spacer: { flex: 1 },
});
