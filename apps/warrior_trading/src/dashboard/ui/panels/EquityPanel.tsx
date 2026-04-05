import { useRef, useEffect } from 'react';
import { createChart, CrosshairMode, LineStyle, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { colors } from '@evil-empire/ui';
import { useDashboardState } from '../context/DashboardContext';

function ts(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function EquityPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);
  const baselineRef = useRef<any>(null);
  const startingRef = useRef<number | null>(null);

  const { latestEquity, startingEquity, connected } = useDashboardState();
  const prevConnectedRef = useRef(connected);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { type: 'solid', color: colors['background-card'] }, textColor: colors['text-secondary'] },
      grid: { vertLines: { color: colors.border }, horzLines: { color: colors.border } },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: true },
      crosshair: { mode: CrosshairMode.Normal },
    });
    chartRef.current = chart;

    seriesRef.current = chart.addAreaSeries({
      topColor: 'rgba(34,197,94,0.3)',
      bottomColor: 'rgba(239,68,68,0.05)',
      lineColor: colors.success,
      lineWidth: 2,
    });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Clear on reconnect
  useEffect(() => {
    const reconnected = connected && !prevConnectedRef.current;
    prevConnectedRef.current = connected;
    if (reconnected) {
      seriesRef.current?.setData([]);
      try {
        if (baselineRef.current) seriesRef.current?.removePriceLine(baselineRef.current);
      } catch { /* ignore */ }
      baselineRef.current = null;
      startingRef.current = null;
    }
  }, [connected]);

  // Update equity data
  useEffect(() => {
    if (!latestEquity || !seriesRef.current) return;
    const time = ts(latestEquity.timestamp) as any;

    try {
      seriesRef.current.update({ time, value: latestEquity.equity });
    } catch { return; }

    // Set baseline on first data point
    if (startingRef.current == null && startingEquity != null) {
      startingRef.current = startingEquity;
      baselineRef.current = seriesRef.current.createPriceLine({
        price: startingEquity,
        color: colors['text-secondary'],
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: 'Start',
      });
    }

    // Dynamic coloring
    if (startingRef.current != null) {
      if (latestEquity.equity >= startingRef.current) {
        seriesRef.current.applyOptions({
          topColor: 'rgba(34,197,94,0.3)',
          bottomColor: 'rgba(34,197,94,0.02)',
          lineColor: colors.success,
        });
      } else {
        seriesRef.current.applyOptions({
          topColor: 'rgba(239,68,68,0.05)',
          bottomColor: 'rgba(239,68,68,0.3)',
          lineColor: colors.destructive,
        });
      }
    }

    chartRef.current?.timeScale().scrollToRealTime();
  }, [latestEquity, startingEquity]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: colors['background-card'], overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
