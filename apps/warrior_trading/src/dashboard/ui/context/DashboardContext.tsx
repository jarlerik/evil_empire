import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react';
import type {
  BarEvent,
  IndicatorEvent,
  SignalEvent,
  PositionOpenEvent,
  PositionUpdateEvent,
  PositionCloseEvent,
  RiskEvent,
  EquityEvent,
  SessionEvent,
  ScannerEvent,
  InitEvent,
  SessionPhase,
  DashboardEvent,
} from '../../types';

// ── State shape ──────────────────────────────────────
export interface PositionState {
  symbol: string;
  strategy: string;
  entryPrice: number;
  shares: number;
  stopPrice: number;
  targetPrice: number;
  timestamp: string;
  currentPrice?: number;
  unrealizedPnL?: number;
  barsHeld?: number;
  trailingStop?: number;
}

export interface TradeEntry {
  num: number;
  time: string;
  symbol: string;
  strategy: string;
  entry: number | null;
  exit: number | null;
  shares: number | string;
  pnl: number;
  rMult: number | null;
  bars: number | null;
  reason: string;
}

export interface ScannerCandidate {
  symbol: string;
  gapPct: number;
  price: number;
  relativeVolume: number;
  hasCatalyst: boolean;
  headline: string | null;
  score: number;
}

export interface DashboardState {
  mode: 'live' | 'backtest';
  phase: SessionPhase;
  backtestProgress: number | null;
  symbol: string;
  connected: boolean;

  // Risk
  dailyPnL: number;
  equity: number;
  tradesWon: number;
  tradesCompleted: number;
  winRate: number | null;
  consecutiveLosses: number;
  isHalted: boolean;

  // Position
  position: PositionState | null;
  positionFlash: boolean;
  closedPnL: { value: number; reason: string } | null;

  // Scanner
  candidates: ScannerCandidate[];

  // Trade log
  trades: TradeEntry[];
  totalPnl: number;
  totalR: number;

  // Signals
  latestSignal: SignalEvent | null;

  // Chart data is managed via refs, but we track bar/indicator/equity events for forwarding
  latestBar: BarEvent | null;
  latestIndicators: IndicatorEvent | null;
  latestEquity: EquityEvent | null;
  startingEquity: number | null;

  // Playback
  isPaused: boolean;
  currentSpeed: number;
}

const initialState: DashboardState = {
  mode: 'backtest',
  phase: 'closed',
  backtestProgress: null,
  symbol: '',
  connected: false,
  dailyPnL: 0,
  equity: 0,
  tradesWon: 0,
  tradesCompleted: 0,
  winRate: null,
  consecutiveLosses: 0,
  isHalted: false,
  position: null,
  positionFlash: false,
  closedPnL: null,
  candidates: [],
  trades: [],
  totalPnl: 0,
  totalR: 0,
  latestSignal: null,
  latestBar: null,
  latestIndicators: null,
  latestEquity: null,
  startingEquity: null,
  isPaused: false,
  currentSpeed: 1,
};

// ── Actions ──────────────────────────────────────────
type Action =
  | { type: 'WS_CONNECTED' }
  | { type: 'WS_DISCONNECTED' }
  | { type: 'INIT'; payload: InitEvent }
  | { type: 'BAR'; payload: BarEvent }
  | { type: 'INDICATORS'; payload: IndicatorEvent }
  | { type: 'SIGNAL'; payload: SignalEvent }
  | { type: 'POSITION_OPEN'; payload: PositionOpenEvent }
  | { type: 'POSITION_UPDATE'; payload: PositionUpdateEvent }
  | { type: 'POSITION_CLOSE'; payload: PositionCloseEvent }
  | { type: 'RISK'; payload: RiskEvent }
  | { type: 'EQUITY'; payload: EquityEvent }
  | { type: 'SESSION'; payload: SessionEvent }
  | { type: 'SCANNER'; payload: ScannerEvent }
  | { type: 'CLEAR_FLASH' }
  | { type: 'CLEAR_CLOSED_PNL' }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'SET_SPEED'; speed: number };

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  } catch {
    return '--';
  }
}

function reducer(state: DashboardState, action: Action): DashboardState {
  switch (action.type) {
    case 'WS_CONNECTED':
      return { ...state, connected: true };

    case 'WS_DISCONNECTED':
      return { ...state, connected: false };

    case 'INIT': {
      const startEq = action.payload.config?.startingEquity ?? 0;
      return {
        ...initialState,
        connected: true,
        mode: action.payload.mode || 'backtest',
        phase: action.payload.phase ?? initialState.phase,
        symbol: action.payload.symbol || '',
        startingEquity: startEq || null,
        equity: startEq,
      };
    }

    case 'BAR':
      return { ...state, latestBar: action.payload };

    case 'INDICATORS':
      return { ...state, latestIndicators: action.payload };

    case 'SIGNAL':
      return { ...state, latestSignal: action.payload };

    case 'POSITION_OPEN': {
      const p = action.payload;
      return {
        ...state,
        position: {
          symbol: p.symbol,
          strategy: p.strategy,
          entryPrice: p.entryPrice,
          shares: p.shares,
          stopPrice: p.stopPrice,
          targetPrice: p.targetPrice,
          timestamp: p.timestamp,
        },
        positionFlash: true,
        closedPnL: null,
      };
    }

    case 'POSITION_UPDATE':
      if (!state.position) return state;
      return {
        ...state,
        position: {
          ...state.position,
          currentPrice: action.payload.currentPrice,
          unrealizedPnL: action.payload.unrealizedPnL,
          barsHeld: action.payload.barsHeld,
          trailingStop: action.payload.trailingStop ?? state.position.trailingStop,
        },
      };

    case 'POSITION_CLOSE': {
      const close = action.payload;
      const entry = state.position;
      const pnl = close.pnl || 0;
      let rMult: number | null = null;

      if (entry && entry.stopPrice && entry.entryPrice && entry.shares) {
        const riskPerShare = Math.abs(entry.entryPrice - entry.stopPrice);
        if (riskPerShare > 0) {
          rMult = pnl / (riskPerShare * entry.shares);
        }
      }

      const trade: TradeEntry = {
        num: state.trades.length + 1,
        time: fmtTime(close.timestamp),
        symbol: close.symbol || entry?.symbol || '--',
        strategy: entry?.strategy || '--',
        entry: entry?.entryPrice ?? null,
        exit: close.exitPrice,
        shares: entry?.shares ?? '--',
        pnl,
        rMult,
        bars: close.barsHeld ?? null,
        reason: close.exitReason || '--',
      };

      return {
        ...state,
        position: null,
        positionFlash: false,
        closedPnL: { value: pnl, reason: close.exitReason || '' },
        trades: [trade, ...state.trades],
        totalPnl: state.totalPnl + pnl,
        totalR: state.totalR + (rMult ?? 0),
      };
    }

    case 'RISK':
      return {
        ...state,
        dailyPnL: action.payload.dailyPnL,
        equity: action.payload.equity,
        tradesWon: action.payload.tradesWon ?? 0,
        tradesCompleted: action.payload.tradesCompleted ?? 0,
        winRate: action.payload.winRate ?? null,
        consecutiveLosses: action.payload.consecutiveLosses || 0,
        isHalted: action.payload.isHalted,
      };

    case 'EQUITY': {
      const eq = action.payload;
      return {
        ...state,
        latestEquity: eq,
        startingEquity: state.startingEquity ?? eq.equity,
      };
    }

    case 'SESSION':
      return {
        ...state,
        phase: action.payload.phase ?? state.phase,
        mode: action.payload.mode ?? state.mode,
        backtestProgress: action.payload.backtestProgress ?? state.backtestProgress,
      };

    case 'SCANNER':
      return { ...state, candidates: action.payload.candidates || [] };

    case 'CLEAR_FLASH':
      return { ...state, positionFlash: false };

    case 'CLEAR_CLOSED_PNL':
      return { ...state, closedPnL: null };

    case 'SET_PAUSED':
      return { ...state, isPaused: action.paused };

    case 'SET_SPEED':
      return { ...state, currentSpeed: action.speed };

    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────
const DashboardStateContext = createContext<DashboardState>(initialState);
const DashboardDispatchContext = createContext<Dispatch<Action>>(() => {});

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <DashboardStateContext.Provider value={state}>
      <DashboardDispatchContext.Provider value={dispatch}>
        {children}
      </DashboardDispatchContext.Provider>
    </DashboardStateContext.Provider>
  );
}

export function useDashboardState() {
  return useContext(DashboardStateContext);
}

export function useDashboardDispatch() {
  return useContext(DashboardDispatchContext);
}

export function dispatchDashboardEvent(dispatch: Dispatch<Action>, event: DashboardEvent) {
  switch (event.type) {
    case 'init': dispatch({ type: 'INIT', payload: event }); break;
    case 'bar': dispatch({ type: 'BAR', payload: event }); break;
    case 'indicators': dispatch({ type: 'INDICATORS', payload: event }); break;
    case 'signal': dispatch({ type: 'SIGNAL', payload: event }); break;
    case 'position:open': dispatch({ type: 'POSITION_OPEN', payload: event }); break;
    case 'position:update': dispatch({ type: 'POSITION_UPDATE', payload: event }); break;
    case 'position:close': dispatch({ type: 'POSITION_CLOSE', payload: event }); break;
    case 'risk': dispatch({ type: 'RISK', payload: event }); break;
    case 'equity': dispatch({ type: 'EQUITY', payload: event }); break;
    case 'session': dispatch({ type: 'SESSION', payload: event }); break;
    case 'scanner': dispatch({ type: 'SCANNER', payload: event }); break;
  }
}
