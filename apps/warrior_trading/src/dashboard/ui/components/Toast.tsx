import { useEffect, useState, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Text, colors, radius } from '@evil-empire/ui';
import { useDashboardState } from '../context/DashboardContext';
import type { SignalEvent } from '../../types';

interface ToastItem {
  id: number;
  signal: SignalEvent;
}

let nextId = 0;

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const { latestSignal } = useDashboardState();
  const prevSignalRef = useRef(latestSignal);

  useEffect(() => {
    if (latestSignal && latestSignal !== prevSignalRef.current) {
      prevSignalRef.current = latestSignal;
      const id = ++nextId;
      setToasts(prev => [...prev, { id, signal: latestSignal }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3300);
    }
  }, [latestSignal]);

  return (
    <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
      {toasts.map(t => (
        <ToastItem key={t.id} signal={t.signal} />
      ))}
    </div>
  );
}

function ToastItem({ signal }: { signal: SignalEvent }) {
  const confPct = signal.confidence != null ? (signal.confidence * 100).toFixed(0) + '%' : '';
  const title = (signal.strategy || 'Signal') + (confPct ? ' (' + confPct + ')' : '');

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div
      style={{
        background: `rgba(26,26,26,0.95)`,
        borderLeft: `3px solid ${signal.accepted ? colors.success : colors.warning}`,
        padding: '8px 12px',
        borderRadius: 4,
        maxWidth: 280,
        pointerEvents: 'auto',
        animation: 'toast-in 0.3s ease-out',
      }}
    >
      <Text variant="body-sm" style={{ fontWeight: '700', marginBottom: 2 }}>{title}</Text>
      <Text variant="caption" color={colors['text-secondary']}>Entry: ${fmt(signal.entryPrice)}</Text>
      {!signal.accepted && signal.rejectionReason && (
        <Text variant="caption" color={colors.warning}>Rejected: {signal.rejectionReason}</Text>
      )}
    </div>
  );
}
