import { colors } from '@evil-empire/ui';
import { useWebSocket } from './hooks/use-websocket';
import { useDashboardState } from './context/DashboardContext';
import { SessionBanner } from './panels/SessionBanner';
import { ChartPanel } from './panels/ChartPanel';
import { RiskPanel } from './panels/RiskPanel';
import { PositionPanel } from './panels/PositionPanel';
import { ScannerPanel } from './panels/ScannerPanel';
import { EquityPanel } from './panels/EquityPanel';
import { TradeLog } from './panels/TradeLog';
import { BacktestControls } from './panels/BacktestControls';
import { ToastContainer } from './components/Toast';

export function DashboardGrid() {
  const { sendPlayback } = useWebSocket();
  const { mode, symbol, connected } = useDashboardState();

  return (
    <>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div style={gridStyles.root}>
        {/* Row 1: Session Banner */}
        <div style={gridStyles.banner}>
          <SessionBanner />
        </div>

        {/* Row 2-3: Chart + Sidebar */}
        <div style={gridStyles.chart}>
          <ChartPanel />
          <ToastContainer />
        </div>

        <div style={gridStyles.sidebar}>
          <RiskPanel />
          <PositionPanel />
          <ScannerPanel />
        </div>

        {/* Row 4: Equity Curve */}
        <div style={gridStyles.equity}>
          <EquityPanel />
        </div>

        {/* Row 5: Trade Log */}
        <div style={gridStyles.tradeLog}>
          <TradeLog />
        </div>

        {/* Row 6: Backtest Controls */}
        {mode === 'backtest' && (
          <div style={gridStyles.controls}>
            <BacktestControls sendPlayback={sendPlayback} />
          </div>
        )}
      </div>
    </>
  );
}

const gridStyles: Record<string, React.CSSProperties> = {
  root: {
    display: 'grid',
    gridTemplateColumns: '1fr 300px',
    gridTemplateRows: '40px 1fr 200px auto 44px',
    height: '100vh',
    gap: 1,
    background: colors.border,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    minWidth: 1200,
    overflow: 'hidden',
  },
  banner: {
    gridColumn: '1 / -1',
  },
  chart: {
    position: 'relative',
    overflow: 'hidden',
  },
  sidebar: {
    gridColumn: '2',
    gridRow: '2 / 4',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    background: colors.border,
    overflowY: 'auto',
  },
  equity: {
    overflow: 'hidden',
  },
  tradeLog: {
    gridColumn: '1 / -1',
    overflow: 'auto',
  },
  controls: {
    gridColumn: '1 / -1',
  },
};
