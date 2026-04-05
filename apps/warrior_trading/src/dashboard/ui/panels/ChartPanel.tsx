import { useRef, useEffect } from 'react';
import { createChart, CrosshairMode, LineStyle, type IChartApi, type ISeriesApi } from 'lightweight-charts';
import { colors } from '@evil-empire/ui';
import { useDashboardState } from '../context/DashboardContext';

function ts(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

export function ChartPanel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const ema9Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const vwapRef = useRef<ISeriesApi<'Line'> | null>(null);
  const stopLineRef = useRef<any>(null);
  const targetLineRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const lastBarTimeRef = useRef<number>(0);

  const { latestBar, latestIndicators, position, symbol, connected } = useDashboardState();
  const prevPositionRef = useRef(position);
  const prevSymbolRef = useRef(symbol);
  const prevConnectedRef = useRef(connected);

  // Init chart
  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: { background: { type: 'solid', color: colors['background-card'] }, textColor: colors['text-secondary'] },
      grid: { vertLines: { color: colors.border }, horzLines: { color: colors.border } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: colors.border },
      timeScale: { borderColor: colors.border, timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    candleRef.current = chart.addCandlestickSeries({
      upColor: colors.success, downColor: colors.destructive,
      borderUpColor: colors.success, borderDownColor: colors.destructive,
      wickUpColor: colors.success, wickDownColor: colors.destructive,
    });

    volumeRef.current = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    ema9Ref.current = chart.addLineSeries({ color: colors.primary, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ema20Ref.current = chart.addLineSeries({ color: colors.warning, lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    vwapRef.current = chart.addLineSeries({ color: colors['text-secondary'], lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false });

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  // Clear chart on init (symbol change or reconnect)
  useEffect(() => {
    const symbolChanged = symbol !== prevSymbolRef.current;
    const reconnected = connected && !prevConnectedRef.current;
    prevSymbolRef.current = symbol;
    prevConnectedRef.current = connected;

    if (symbolChanged || reconnected) {
      candleRef.current?.setData([]);
      volumeRef.current?.setData([]);
      ema9Ref.current?.setData([]);
      ema20Ref.current?.setData([]);
      vwapRef.current?.setData([]);
      markersRef.current = [];
      candleRef.current?.setMarkers([]);
      try {
        if (stopLineRef.current) candleRef.current?.removePriceLine(stopLineRef.current);
        if (targetLineRef.current) candleRef.current?.removePriceLine(targetLineRef.current);
      } catch { /* ignore */ }
      stopLineRef.current = null;
      targetLineRef.current = null;
      lastBarTimeRef.current = 0;
    }
  }, [symbol, connected]);

  // Update bars
  useEffect(() => {
    if (!latestBar || !candleRef.current || !volumeRef.current) return;
    const time = ts(latestBar.timestamp);
    // Skip out-of-order bars
    if (time < lastBarTimeRef.current) return;
    lastBarTimeRef.current = time;

    try {
      candleRef.current.update({ time: time as any, open: latestBar.open, high: latestBar.high, low: latestBar.low, close: latestBar.close });
      const volColor = latestBar.close >= latestBar.open ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)';
      volumeRef.current.update({ time: time as any, value: latestBar.volume, color: volColor });
      chartRef.current?.timeScale().scrollToRealTime();
    } catch { /* ignore update errors */ }
  }, [latestBar]);

  // Update indicators
  useEffect(() => {
    if (!latestIndicators?.timestamp) return;
    const time = ts(latestIndicators.timestamp) as any;
    try {
      if (latestIndicators.ema9 != null) ema9Ref.current?.update({ time, value: latestIndicators.ema9 });
      if (latestIndicators.ema20 != null) ema20Ref.current?.update({ time, value: latestIndicators.ema20 });
      if (latestIndicators.vwap != null) vwapRef.current?.update({ time, value: latestIndicators.vwap });
    } catch { /* ignore */ }
  }, [latestIndicators]);

  // Position price lines + markers
  useEffect(() => {
    const prev = prevPositionRef.current;
    prevPositionRef.current = position;
    const candle = candleRef.current;
    if (!candle) return;

    function removeLines() {
      try {
        if (stopLineRef.current) { candle!.removePriceLine(stopLineRef.current); stopLineRef.current = null; }
        if (targetLineRef.current) { candle!.removePriceLine(targetLineRef.current); targetLineRef.current = null; }
      } catch { /* ignore */ }
    }

    if (position && !prev) {
      removeLines();
      stopLineRef.current = candle.createPriceLine({
        price: position.stopPrice, color: colors.destructive, lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Stop',
      });
      targetLineRef.current = candle.createPriceLine({
        price: position.targetPrice, color: colors.success, lineWidth: 1,
        lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Target',
      });
      if (position.timestamp) {
        markersRef.current.push({
          time: ts(position.timestamp), position: 'belowBar',
          color: colors.success, shape: 'arrowUp', text: 'BUY',
        });
        candle.setMarkers([...markersRef.current].sort((a, b) => a.time - b.time));
      }
    } else if (position && prev) {
      if (position.trailingStop != null && position.trailingStop !== prev.trailingStop) {
        try { if (stopLineRef.current) candle.removePriceLine(stopLineRef.current); } catch {}
        stopLineRef.current = candle.createPriceLine({
          price: position.trailingStop, color: colors.destructive, lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Stop',
        });
      }
    } else if (!position && prev) {
      removeLines();
      if (latestBar) {
        markersRef.current.push({
          time: ts(latestBar.timestamp), position: 'aboveBar',
          color: colors.destructive, shape: 'arrowDown', text: 'SELL',
        });
        candle.setMarkers([...markersRef.current].sort((a, b) => a.time - b.time));
      }
    }
  }, [position, latestBar]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: colors['background-card'], overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
