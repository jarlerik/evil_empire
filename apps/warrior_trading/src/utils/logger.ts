type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";

let minLevel: LogLevel = "info";

export function setLogLevel(level: LogLevel) {
  minLevel = level;
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function log(level: LogLevel, module: string, message: string, data?: Record<string, unknown>) {
  if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[minLevel]) return;

  const color = LEVEL_COLOR[level];
  const prefix = `${formatTimestamp()} ${color}[${level.toUpperCase()}]${RESET} [${module}]`;

  if (data) {
    console.log(`${prefix} ${message}`, JSON.stringify(data));
  } else {
    console.log(`${prefix} ${message}`);
  }
}

export function createLogger(module: string) {
  return {
    debug: (msg: string, data?: Record<string, unknown>) => log("debug", module, msg, data),
    info: (msg: string, data?: Record<string, unknown>) => log("info", module, msg, data),
    warn: (msg: string, data?: Record<string, unknown>) => log("warn", module, msg, data),
    error: (msg: string, data?: Record<string, unknown>) => log("error", module, msg, data),
  };
}
