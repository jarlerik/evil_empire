import type { TradeRecord, EquityPoint, AggregateStats, StrategyBreakdown } from "./types.js";

export function computeStats(
  trades: TradeRecord[],
  equity: EquityPoint[]
): AggregateStats {
  if (trades.length === 0) {
    return emptyStats();
  }

  const winners = trades.filter((t) => t.pnl > 0);
  const losers = trades.filter((t) => t.pnl <= 0);

  const grossProfit = winners.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losers.reduce((s, t) => s + t.pnl, 0));
  const totalCommissions = trades.reduce((s, t) => s + t.commission, 0);
  const totalPnL = trades.reduce((s, t) => s + t.pnl, 0);

  // Max drawdown from equity curve
  const { maxDrawdown, maxDrawdownPct } = computeDrawdown(equity);

  // Sharpe ratio (annualized, daily returns)
  const sharpeRatio = computeSharpe(equity);

  // Trading days
  const tradingDays = new Set(
    trades.map((t) => t.entryTime.toISOString().slice(0, 10))
  ).size;

  // Strategy breakdown
  const strategyBreakdown = computeStrategyBreakdown(trades);

  return {
    totalTrades: trades.length,
    winners: winners.length,
    losers: losers.length,
    winRate: winners.length / trades.length,
    avgWin: winners.length > 0 ? grossProfit / winners.length : 0,
    avgLoss: losers.length > 0 ? -(grossLoss / losers.length) : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    totalPnL: grossProfit - grossLoss,
    totalCommissions,
    netPnL: totalPnL,
    avgRMultiple: trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length,
    maxDrawdown,
    maxDrawdownPct,
    sharpeRatio,
    avgBarsHeld: trades.reduce((s, t) => s + t.barsHeld, 0) / trades.length,
    tradesPerDay: tradingDays > 0 ? trades.length / tradingDays : 0,
    strategyBreakdown,
  };
}

function computeDrawdown(equity: EquityPoint[]): {
  maxDrawdown: number;
  maxDrawdownPct: number;
} {
  if (equity.length === 0) return { maxDrawdown: 0, maxDrawdownPct: 0 };

  let peak = equity[0].equity;
  let maxDD = 0;
  let maxDDPct = 0;

  for (const point of equity) {
    if (point.equity > peak) peak = point.equity;
    const dd = peak - point.equity;
    const ddPct = peak > 0 ? dd / peak : 0;
    if (dd > maxDD) maxDD = dd;
    if (ddPct > maxDDPct) maxDDPct = ddPct;
  }

  return { maxDrawdown: maxDD, maxDrawdownPct: maxDDPct * 100 };
}

function computeSharpe(equity: EquityPoint[]): number {
  // Group equity by day, take end-of-day values
  const dailyEquity = new Map<string, number>();
  for (const point of equity) {
    const day = point.timestamp.toISOString().slice(0, 10);
    dailyEquity.set(day, point.equity);
  }

  const values = Array.from(dailyEquity.values());
  if (values.length < 2) return 0;

  // Daily returns
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    returns.push((values[i] - values[i - 1]) / values[i - 1]);
  }

  if (returns.length === 0) return 0;

  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance =
    returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
  const std = Math.sqrt(variance);

  if (std === 0) return 0;

  // Annualize: multiply by sqrt(252)
  return (mean / std) * Math.sqrt(252);
}

function computeStrategyBreakdown(
  trades: TradeRecord[]
): Record<string, StrategyBreakdown> {
  const groups = new Map<string, TradeRecord[]>();

  for (const trade of trades) {
    const list = groups.get(trade.strategy) ?? [];
    list.push(trade);
    groups.set(trade.strategy, list);
  }

  const result: Record<string, StrategyBreakdown> = {};

  for (const [name, group] of groups) {
    const wins = group.filter((t) => t.pnl > 0);
    result[name] = {
      trades: group.length,
      winRate: wins.length / group.length,
      avgR: group.reduce((s, t) => s + t.rMultiple, 0) / group.length,
      totalPnL: group.reduce((s, t) => s + t.pnl, 0),
    };
  }

  return result;
}

function emptyStats(): AggregateStats {
  return {
    totalTrades: 0,
    winners: 0,
    losers: 0,
    winRate: 0,
    avgWin: 0,
    avgLoss: 0,
    profitFactor: 0,
    totalPnL: 0,
    totalCommissions: 0,
    netPnL: 0,
    avgRMultiple: 0,
    maxDrawdown: 0,
    maxDrawdownPct: 0,
    sharpeRatio: 0,
    avgBarsHeld: 0,
    tradesPerDay: 0,
    strategyBreakdown: {},
  };
}

export function formatStats(stats: AggregateStats): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(`  Total trades:     ${stats.totalTrades}`);
  lines.push(
    `  Winners:          ${stats.winners} (${(stats.winRate * 100).toFixed(1)}%)`
  );
  lines.push(
    `  Losers:           ${stats.losers} (${((1 - stats.winRate) * 100).toFixed(1)}%)`
  );
  lines.push(`  Avg win:          $${stats.avgWin.toFixed(2)}`);
  lines.push(`  Avg loss:         $${stats.avgLoss.toFixed(2)}`);
  lines.push(
    `  Profit factor:    ${stats.profitFactor === Infinity ? "Inf" : stats.profitFactor.toFixed(2)}`
  );
  lines.push(`  Net P&L:          $${stats.netPnL.toFixed(2)}`);
  lines.push(`  Total commission: $${stats.totalCommissions.toFixed(2)}`);
  lines.push(`  Avg R-multiple:   ${stats.avgRMultiple.toFixed(2)}`);
  lines.push(
    `  Max drawdown:     $${stats.maxDrawdown.toFixed(2)} (${stats.maxDrawdownPct.toFixed(1)}%)`
  );
  lines.push(`  Sharpe ratio:     ${stats.sharpeRatio.toFixed(2)}`);
  lines.push(`  Avg bars held:    ${stats.avgBarsHeld.toFixed(1)}`);
  lines.push(`  Trades/day:       ${stats.tradesPerDay.toFixed(2)}`);

  // Strategy breakdown
  const strategies = Object.entries(stats.strategyBreakdown);
  if (strategies.length > 0) {
    lines.push("");
    lines.push("  Strategy breakdown:");
    for (const [name, b] of strategies.sort((a, b) => b[1].totalPnL - a[1].totalPnL)) {
      lines.push(
        `    ${name.padEnd(18)} ${String(b.trades).padStart(3)} trades  ${(b.winRate * 100).toFixed(0)}% win  avg R ${b.avgR.toFixed(2)}  $${b.totalPnL.toFixed(2)}`
      );
    }
  }

  return lines.join("\n");
}

export function tradesToCSV(equity: EquityPoint[]): string {
  const lines = ["timestamp,equity"];
  for (const point of equity) {
    lines.push(`${point.timestamp.toISOString()},${point.equity.toFixed(2)}`);
  }
  return lines.join("\n");
}

export function tradesToJSON(trades: TradeRecord[]): string {
  return JSON.stringify(
    trades.map((t) => ({
      ...t,
      entryTime: t.entryTime.toISOString(),
      exitTime: t.exitTime.toISOString(),
    })),
    null,
    2
  );
}
