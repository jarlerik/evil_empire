import { logger } from './logger'
import { sendTelegram } from './telegram'
import { getState } from './state'

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

export function writeWeeklyCostSummary(workDir: string): void {
  const { mkdirSync, writeFileSync } = require('node:fs')
  const { join } = require('node:path')

  const state = getState()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisWeek = state.runs.filter((r) => new Date(r.timestamp) >= weekAgo)

  if (thisWeek.length === 0) return

  const totalTokens = thisWeek.reduce((sum, r) => sum + r.tokensUsed, 0)
  const totalCost = thisWeek.reduce((sum, r) => sum + r.costUsd, 0)
  const successes = thisWeek.filter((r) => r.status === 'success').length
  const failures = thisWeek.filter((r) => r.status === 'failed').length

  const weekEnd = now.toISOString().split('T')[0]
  const weekStart = weekAgo.toISOString().split('T')[0]

  const content = `# Weekly Cost Summary\n\n**Period:** ${weekStart} — ${weekEnd}\n\n| Metric | Value |\n|---|---|\n| Runs | ${thisWeek.length} |\n| Successes | ${successes} |\n| Failures | ${failures} |\n| Total tokens | ${totalTokens.toLocaleString()} |\n| Total cost | $${totalCost.toFixed(2)} |\n| Avg cost/run | $${(totalCost / thisWeek.length).toFixed(2)} |\n`

  const logDir = join(workDir, 'docs', 'agent-log')
  mkdirSync(logDir, { recursive: true })
  writeFileSync(join(logDir, 'cost-summary.md'), content, 'utf-8')
  logger.info({ phase: 'cost', action: 'weekly_summary', totalCost, runs: thisWeek.length })
}
