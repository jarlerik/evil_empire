import type { AlpacaClient } from "./client.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("alpaca:orders");

export interface OrderRequest {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit";
  timeInForce: "day" | "gtc" | "opg" | "ioc" | "fok";
  limitPrice?: number;
  stopPrice?: number;
}

export interface BracketOrderRequest {
  symbol: string;
  qty: number;
  side: "buy" | "sell";
  type: "market" | "limit";
  timeInForce: "day" | "gtc";
  limitPrice?: number;
  takeProfitPrice: number;
  stopLossPrice: number;
  stopLossLimitPrice?: number;
}

export interface OrderResult {
  id: string;
  clientOrderId: string;
  symbol: string;
  qty: string;
  side: string;
  type: string;
  status: string;
  filledQty: string;
  filledAvgPrice: string | null;
  createdAt: string;
  legs?: OrderResult[];
}

// Market hours for US equities (ET)
const PRE_MARKET_OPEN_HOUR = 4; // 4:00 AM ET
const MARKET_CLOSE_HOUR = 20; // 8:00 PM ET (post-market close)

function isWithinTradingHours(): boolean {
  const now = new Date();
  // Convert to ET
  const et = new Date(
    now.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
  const hour = et.getHours();
  return hour >= PRE_MARKET_OPEN_HOUR && hour < MARKET_CLOSE_HOUR;
}

function assertTradingHours() {
  if (!isWithinTradingHours()) {
    throw new Error(
      "Order rejected: outside trading hours (pre-market 4AM - post-market 8PM ET)"
    );
  }
}

export async function placeOrder(
  client: AlpacaClient,
  req: OrderRequest
): Promise<OrderResult> {
  assertTradingHours();

  log.info("Placing order", {
    symbol: req.symbol,
    side: req.side,
    qty: req.qty,
    type: req.type,
  });

  const order = await client.createOrder({
    symbol: req.symbol,
    qty: req.qty,
    side: req.side,
    type: req.type,
    time_in_force: req.timeInForce,
    ...(req.limitPrice && { limit_price: req.limitPrice }),
    ...(req.stopPrice && { stop_price: req.stopPrice }),
  });

  return normalizeOrder(order);
}

export async function placeBracketOrder(
  client: AlpacaClient,
  req: BracketOrderRequest
): Promise<OrderResult> {
  assertTradingHours();

  log.info("Placing bracket order", {
    symbol: req.symbol,
    side: req.side,
    qty: req.qty,
    takeProfit: req.takeProfitPrice,
    stopLoss: req.stopLossPrice,
  });

  const order = await client.createOrder({
    symbol: req.symbol,
    qty: req.qty,
    side: req.side,
    type: req.type,
    time_in_force: req.timeInForce,
    order_class: "bracket",
    ...(req.limitPrice && { limit_price: req.limitPrice }),
    take_profit: { limit_price: String(req.takeProfitPrice) },
    stop_loss: {
      stop_price: String(req.stopLossPrice),
      ...(req.stopLossLimitPrice && {
        limit_price: String(req.stopLossLimitPrice),
      }),
    },
  });

  return normalizeOrder(order);
}

export async function cancelOrder(
  client: AlpacaClient,
  orderId: string
): Promise<void> {
  log.info("Cancelling order", { orderId });
  await client.cancelOrder({ order_id: orderId });
}

export async function getOrder(
  client: AlpacaClient,
  orderId: string
): Promise<OrderResult> {
  const order = await client.getOrder({ order_id: orderId });
  return normalizeOrder(order);
}

// Poll until order reaches a terminal state or timeout
const FILL_POLL_INTERVAL_MS = 500;
const FILL_TIMEOUT_MS = 30_000;

type TerminalStatus = "filled" | "canceled" | "expired" | "rejected";

const TERMINAL_STATUSES = new Set<string>([
  "filled",
  "canceled",
  "expired",
  "rejected",
]);

export async function waitForFill(
  client: AlpacaClient,
  orderId: string,
  timeoutMs = FILL_TIMEOUT_MS
): Promise<OrderResult> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const order = await getOrder(client, orderId);

    if (TERMINAL_STATUSES.has(order.status)) {
      log.info("Order reached terminal state", {
        orderId,
        status: order.status,
        filledQty: order.filledQty,
        filledAvgPrice: order.filledAvgPrice,
      });
      return order;
    }

    await Bun.sleep(FILL_POLL_INTERVAL_MS);
  }

  log.warn("Order fill timeout — cancelling", { orderId, timeoutMs });
  await cancelOrder(client, orderId);
  return getOrder(client, orderId);
}

export async function closePosition(
  client: AlpacaClient,
  symbol: string
): Promise<OrderResult> {
  log.info("Closing position", { symbol });
  const order = await client.closePosition({ symbol_or_asset_id: symbol });
  return normalizeOrder(order);
}

export async function closeAllPositions(
  client: AlpacaClient
): Promise<void> {
  log.info("Closing all positions");
  await client.closePositions();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOrder(raw: any): OrderResult {
  return {
    id: raw.id,
    clientOrderId: raw.client_order_id,
    symbol: raw.symbol,
    qty: raw.qty,
    side: raw.side,
    type: raw.type,
    status: raw.status,
    filledQty: raw.filled_qty,
    filledAvgPrice: raw.filled_avg_price,
    createdAt: raw.created_at,
    legs: raw.legs?.map(normalizeOrder),
  };
}
