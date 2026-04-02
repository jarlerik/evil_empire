import { createClient } from "@alpacahq/typescript-sdk";
import { type Config } from "../config.js";
import { createLogger } from "../utils/logger.js";

const log = createLogger("alpaca:client");

export type AlpacaClient = ReturnType<typeof createClient>;

export function createAlpacaClient(config: Config): AlpacaClient {
  const client = createClient({
    key: config.alpaca.keyId,
    secret: config.alpaca.secretKey,
    paper: config.alpaca.paper,
    tokenBucket: { capacity: 200, fillRate: 60 },
  });

  log.info("Alpaca REST client initialized", {
    paper: config.alpaca.paper,
  });

  return client;
}

// -- WebSocket streaming client with auto-reconnect --

interface WSCallbacks {
  onBar?: (symbol: string, bar: RawWSBar) => void;
  onQuote?: (symbol: string, quote: RawWSQuote) => void;
  onError?: (error: Error) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export interface RawWSBar {
  T: "b";
  S: string; // symbol
  o: number; // open
  h: number; // high
  l: number; // low
  c: number; // close
  v: number; // volume
  t: string; // timestamp
  n: number; // trade count
  vw: number; // vwap
}

export interface RawWSQuote {
  T: "q";
  S: string;
  bp: number; // bid price
  bs: number; // bid size
  ap: number; // ask price
  as: number; // ask size
  t: string;
}

type WSMessage =
  | { T: "success"; msg: string }
  | { T: "error"; msg: string; code: number }
  | { T: "subscription"; bars: string[]; quotes: string[] }
  | RawWSBar
  | RawWSQuote;

const WS_BASE = "wss://stream.data.alpaca.markets/v2/iex";
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;

export class AlpacaStream {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private subscribedBars = new Set<string>();
  private subscribedQuotes = new Set<string>();
  private intentionalClose = false;
  private authenticated = false;

  constructor(
    private config: Config,
    private callbacks: WSCallbacks
  ) {}

  connect(): void {
    this.intentionalClose = false;
    this.authenticated = false;
    log.info("Connecting to Alpaca WebSocket", { url: WS_BASE });

    this.ws = new WebSocket(WS_BASE);

    this.ws.onopen = () => {
      log.info("WebSocket connected, authenticating...");
      this.send({
        action: "auth",
        key: this.config.alpaca.keyId,
        secret: this.config.alpaca.secretKey,
      });
    };

    this.ws.onmessage = (event) => {
      let messages: WSMessage[];
      try {
        messages = JSON.parse(event.data as string);
      } catch (err) {
        log.error("Failed to parse WebSocket message", {
          error: String(err),
          data: String(event.data).slice(0, 200),
        });
        return;
      }
      for (const msg of messages) {
        this.handleMessage(msg);
      }
    };

    this.ws.onerror = (event) => {
      log.error("WebSocket error", { error: String(event) });
      this.callbacks.onError?.(new Error("WebSocket error"));
    };

    this.ws.onclose = () => {
      this.authenticated = false;
      this.callbacks.onDisconnected?.();
      if (!this.intentionalClose) {
        this.reconnect();
      }
    };
  }

  private handleMessage(msg: WSMessage) {
    switch (msg.T) {
      case "success":
        if (msg.msg === "authenticated") {
          log.info("WebSocket authenticated");
          this.authenticated = true;
          this.reconnectAttempts = 0;
          this.resubscribe();
          this.callbacks.onConnected?.();
        }
        break;
      case "error":
        log.error("WebSocket auth/subscription error", {
          msg: msg.msg,
          code: msg.code,
        });
        this.callbacks.onError?.(new Error(`WS error ${msg.code}: ${msg.msg}`));
        break;
      case "subscription":
        log.debug("Subscription confirmed", {
          bars: msg.bars,
          quotes: msg.quotes,
        });
        break;
      case "b":
        this.callbacks.onBar?.(msg.S, msg);
        break;
      case "q":
        this.callbacks.onQuote?.(msg.S, msg);
        break;
    }
  }

  subscribeBars(symbols: string[]): void {
    for (const s of symbols) this.subscribedBars.add(s);
    if (this.authenticated) {
      this.send({ action: "subscribe", bars: symbols });
    }
  }

  subscribeQuotes(symbols: string[]): void {
    for (const s of symbols) this.subscribedQuotes.add(s);
    if (this.authenticated) {
      this.send({ action: "subscribe", quotes: symbols });
    }
  }

  unsubscribeBars(symbols: string[]): void {
    for (const s of symbols) this.subscribedBars.delete(s);
    if (this.authenticated) {
      this.send({ action: "unsubscribe", bars: symbols });
    }
  }

  unsubscribeQuotes(symbols: string[]): void {
    for (const s of symbols) this.subscribedQuotes.delete(s);
    if (this.authenticated) {
      this.send({ action: "unsubscribe", quotes: symbols });
    }
  }

  private resubscribe(): void {
    const bars = [...this.subscribedBars];
    const quotes = [...this.subscribedQuotes];
    if (bars.length > 0) {
      this.send({ action: "subscribe", bars });
    }
    if (quotes.length > 0) {
      this.send({ action: "subscribe", quotes });
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      log.error("Max reconnection attempts reached — giving up", {
        attempts: this.reconnectAttempts,
      });
      this.callbacks.onError?.(
        new Error(
          `WebSocket permanently disconnected after ${MAX_RECONNECT_ATTEMPTS} attempts`
        )
      );
      return;
    }

    const delay = Math.min(
      BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts),
      30_000
    );
    this.reconnectAttempts++;

    log.warn("Reconnecting WebSocket", {
      attempt: this.reconnectAttempts,
      delayMs: delay,
    });

    setTimeout(() => this.connect(), delay);
  }

  private send(data: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect(): void {
    this.intentionalClose = true;
    this.ws?.close();
    this.ws = null;
    log.info("WebSocket disconnected intentionally");
  }

  get isConnected(): boolean {
    return this.authenticated && this.ws?.readyState === WebSocket.OPEN;
  }
}
