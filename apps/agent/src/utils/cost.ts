import { logger } from './logger'
import { sendTelegram } from './telegram'

// Sonnet pricing (per million tokens)
const INPUT_COST_PER_MTOK = 3
const OUTPUT_COST_PER_MTOK = 15

const MAX_COST_ALERT = parseFloat(process.env.MAX_COST_ALERT_USD ?? '2.00')

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export class CostTracker {
  private totalInput = 0
  private totalOutput = 0

  add(usage: TokenUsage): void {
    this.totalInput += usage.inputTokens
    this.totalOutput += usage.outputTokens
  }

  get totalTokens(): number {
    return this.totalInput + this.totalOutput
  }

  get costUsd(): number {
    const inputCost = (this.totalInput / 1_000_000) * INPUT_COST_PER_MTOK
    const outputCost = (this.totalOutput / 1_000_000) * OUTPUT_COST_PER_MTOK
    return Math.round((inputCost + outputCost) * 1000) / 1000
  }

  get summary(): { inputTokens: number; outputTokens: number; totalTokens: number; costUsd: number } {
    return {
      inputTokens: this.totalInput,
      outputTokens: this.totalOutput,
      totalTokens: this.totalTokens,
      costUsd: this.costUsd,
    }
  }

  async checkAlert(): Promise<void> {
    if (this.costUsd >= MAX_COST_ALERT) {
      const msg = `💰 Cost alert: run exceeded $${this.costUsd.toFixed(2)} (limit: $${MAX_COST_ALERT.toFixed(2)})`
      logger.warn({ phase: 'cost', ...this.summary })
      await sendTelegram(msg)
    }
  }
}
