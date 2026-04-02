interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  [key: string]: unknown
}

function formatEntry(level: LogEntry['level'], data: Record<string, unknown>): string {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    ...data,
  }
  return JSON.stringify(entry)
}

export const logger = {
  info(data: Record<string, unknown>) {
    console.log(formatEntry('info', data))
  },
  warn(data: Record<string, unknown>) {
    console.warn(formatEntry('warn', data))
  },
  error(data: Record<string, unknown>) {
    console.error(formatEntry('error', data))
  },
}
