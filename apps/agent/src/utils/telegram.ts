import { logger } from './logger'

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHAT_ID = process.env.TELEGRAM_CHAT_ID

export async function sendTelegram(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    logger.warn({ phase: 'telegram', message: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID, skipping notification' })
    return
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      logger.error({ phase: 'telegram', error: `HTTP ${response.status}: ${body}` })
    }
  } catch (error) {
    logger.error({ phase: 'telegram', error: String(error) })
  }
}
