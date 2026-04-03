import type { AlpacaClient, AlpacaStream, RawWSBar } from "../alpaca/client.js";
import type { Config } from "../config.js";
import type { Bar } from "../utils/bar.js";
import type { IndicatorSnapshot } from "../strategies/types.js";
import {
  createMultiEMA,
  updateMultiEMA,
  type MultiEMA,
  type MultiEMAValues,
} from "../indicators/ema.js";
import { createVWAP, updateVWAP, resetVWAP, type VWAPState } from "../indicators/vwap.js";
import { createMACD, updateMACD, type MACDState, type MACDValues } from "../indicators/macd.js";
import { createATR, updateATR, type ATRState } from "../indicators/atr.js";
import { getBars } from "../alpaca/market-data.js";
import { createLogger } from "../utils/logger.js";
import type { WatchlistEntry } from "../scanner/index.js";
import { dashboardBus } from "../dashboard/event-bus.js";

const log = createLogger("engine:watchlist");

const MAX_BARS = 50; // keep last N bars in memory

class BarRingBuffer {
  private buf: Bar[];
  private head = 0;
  private count = 0;
  private readonly cap: number;

  constructor(capacity: number) {
    this.cap = capacity;
    this.buf = new Array<Bar>(capacity);
  }

  push(bar: Bar): void {
    const idx = (this.head + this.count) % this.cap;
    this.buf[idx] = bar;
    if (this.count < this.cap) {
      this.count++;
    } else {
      this.head = (this.head + 1) % this.cap;
    }
  }

  get length(): number {
    return this.count;
  }

  /** Return bars in chronological order (oldest first). */
  toArray(): Bar[] {
    const result = new Array<Bar>(this.count);
    for (let i = 0; i < this.count; i++) {
      result[i] = this.buf[(this.head + i) % this.cap];
    }
    return result;
  }
}

interface SymbolState {
  bars: BarRingBuffer;
  ema: MultiEMA;
  emaValues: MultiEMAValues;
  vwap: VWAPState;
  vwapValue: number;
  macd: MACDState;
  macdValues: MACDValues;
  atr: ATRState;
  atrValue: number;
  relativeVolume: number;
  premarketHigh: number;
}

function wsBarToBar(raw: RawWSBar): Bar {
  return {
    timestamp: new Date(raw.t),
    open: raw.o,
    high: raw.h,
    low: raw.l,
    close: raw.c,
    volume: raw.v,
    vwap: raw.vw,
    tradeCount: raw.n,
  };
}

export class Watchlist {
  private symbols = new Map<string, SymbolState>();
  private onBarCallbacks: Array<(symbol: string, snapshot: IndicatorSnapshot) => void> = [];

  constructor(
    private client: AlpacaClient,
    private stream: AlpacaStream,
    private config: Config
  ) {}

  async loadFromScanResults(entries: WatchlistEntry[]): Promise<void> {
    this.symbols.clear();

    for (const entry of entries) {
      const state: SymbolState = {
        bars: new BarRingBuffer(MAX_BARS),
        ema: createMultiEMA(),
        emaValues: { ema9: 0, ema20: 0, ema50: 0, ema200: 0 },
        vwap: createVWAP(),
        vwapValue: 0,
        macd: createMACD(),
        macdValues: { macd: 0, signal: 0, histogram: 0 },
        atr: createATR(),
        atrValue: 0,
        relativeVolume: entry.relativeVolume,
        premarketHigh: entry.price, // current price as premarket high initially
      };

      this.symbols.set(entry.symbol, state);
    }

    // Seed indicators with historical bars
    await this.seedHistoricalBars();

    log.info("Watchlist loaded", {
      symbols: [...this.symbols.keys()],
    });
  }

  private async seedHistoricalBars(): Promise<void> {
    const syms = [...this.symbols.keys()];
    if (syms.length === 0) return;

    try {
      const barsMap = await getBars(this.client, syms, "1Min", { limit: MAX_BARS });

      for (const [symbol, bars] of barsMap) {
        const state = this.symbols.get(symbol);
        if (!state) continue;

        for (const bar of bars) {
          this.processBar(symbol, state, bar);
        }

        // Set premarket high from historical bars
        if (bars.length > 0) {
          state.premarketHigh = Math.max(
            state.premarketHigh,
            Math.max(...bars.map((b) => b.high))
          );
        }

        log.debug("Seeded indicators", {
          symbol,
          bars: bars.length,
          ema9: state.emaValues.ema9.toFixed(2),
          vwap: state.vwapValue.toFixed(2),
        });
      }
    } catch (err) {
      log.warn("Failed to seed historical bars", { error: String(err) });
    }
  }

  startStreaming(): void {
    const syms = [...this.symbols.keys()];
    if (syms.length === 0) return;

    this.stream.subscribeBars(syms);

    // Wire up the bar callback from WebSocket
    // This is set up by the trader when it creates the stream
    log.info("Streaming started for watchlist", { symbols: syms });
  }

  stopStreaming(): void {
    const syms = [...this.symbols.keys()];
    if (syms.length > 0) {
      this.stream.unsubscribeBars(syms);
    }
    log.info("Streaming stopped");
  }

  handleBar(symbol: string, rawBar: RawWSBar): void {
    const state = this.symbols.get(symbol);
    if (!state) return;

    const bar = wsBarToBar(rawBar);
    this.processBar(symbol, state, bar);

    // Update premarket high
    state.premarketHigh = Math.max(state.premarketHigh, bar.high);

    // Broadcast bar data to dashboard
    dashboardBus.broadcast({
      type: "bar",
      symbol,
      timestamp: bar.timestamp.toISOString(),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
    });

    // Broadcast indicator state to dashboard
    const snap = this.getSnapshot(symbol);
    if (snap) {
      dashboardBus.broadcast({
        type: "indicators",
        symbol,
        timestamp: bar.timestamp.toISOString(),
        ema9: snap.ema.ema9,
        ema20: snap.ema.ema20,
        ema50: snap.ema.ema50,
        ema200: snap.ema.ema200,
        vwap: snap.vwap,
        macd: snap.macd.macd,
        macdSignal: snap.macd.signal,
        macdHistogram: snap.macd.histogram,
        atr: snap.atr,
        relativeVolume: snap.relativeVolume,
      });
    }

    // Notify listeners
    const snapshot = this.getSnapshot(symbol);
    if (snapshot) {
      for (const cb of this.onBarCallbacks) {
        cb(symbol, snapshot);
      }
    }
  }

  private processBar(symbol: string, state: SymbolState, bar: Bar): void {
    state.bars.push(bar);

    state.emaValues = updateMultiEMA(state.ema, bar.close);
    state.vwapValue = updateVWAP(state.vwap, bar);
    state.macdValues = updateMACD(state.macd, bar.close);
    state.atrValue = updateATR(state.atr, bar);
  }

  getSnapshot(symbol: string): IndicatorSnapshot | null {
    const state = this.symbols.get(symbol);
    if (!state || state.bars.length === 0) return null;

    return {
      bars: state.bars.toArray(),
      ema: { ...state.emaValues },
      vwap: state.vwapValue,
      macd: { ...state.macdValues },
      atr: state.atrValue,
      relativeVolume: state.relativeVolume,
      premarketHigh: state.premarketHigh,
    };
  }

  onBar(callback: (symbol: string, snapshot: IndicatorSnapshot) => void): void {
    this.onBarCallbacks.push(callback);
  }

  resetForNewDay(): void {
    for (const state of this.symbols.values()) {
      resetVWAP(state.vwap);
      state.vwapValue = 0;
    }
    log.info("Watchlist reset for new day (VWAP cleared)");
  }

  get activeSymbols(): string[] {
    return [...this.symbols.keys()];
  }
}
