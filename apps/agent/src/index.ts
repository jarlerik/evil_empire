import { logger } from './utils/logger'
import { acquireLock, releaseLock } from './utils/lock'
import { pollForIssue, markInProgress, markDone, markFailed, markTodo } from './poller'
import { cloneOrPull, createBranch, commitAll, push, ensureAgentLogEntry } from './utils/git'
import { sendTelegram } from './utils/telegram'
import { appendRun, getState } from './utils/state'
import { runAgent } from './agent'
import { findRejectedPrs, getPrReviewComments, createRetryIssue, closePrLabel } from './tools/github'

const MAX_RETRIES = parseInt(process.env.MAX_RETRIES ?? '3', 10)
const BACKOFF_MS = [30_000, 60_000, 120_000]

// Errors that should not be retried
const NO_RETRY_ERRORS = ['Token budget exceeded', 'Max iterations reached', 'git conflict', 'not_found_error']

let currentIssueNumber: number | null = null

// --- SIGTERM / SIGINT handler ---
async function shutdown(signal: string) {
  logger.info({ phase: 'shutdown', reason: signal })
  if (currentIssueNumber) {
    try {
      await markTodo(currentIssueNumber)
    } catch {
      // Best effort
    }
  }
  releaseLock()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// --- Status command ---
if (process.argv.includes('--status')) {
  const state = getState()
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const thisWeek = state.runs.filter((r) => new Date(r.timestamp) >= weekAgo)

  const lastRun = state.runs.at(-1)
  const successes = thisWeek.filter((r) => r.status === 'success')
  const failures = thisWeek.filter((r) => r.status === 'failed')
  const totalTokens = thisWeek.reduce((sum, r) => sum + r.tokensUsed, 0)
  const totalCost = thisWeek.reduce((sum, r) => sum + r.costUsd, 0)

  console.log(`Last run: ${lastRun ? `${lastRun.timestamp} (${lastRun.status})` : 'never'}`)
  console.log(`Issues processed this week: ${thisWeek.length}`)
  console.log(`PRs opened: ${successes.filter((r) => r.prNumber).length}`)
  console.log(`Successes: ${successes.length}`)
  console.log(`Failures: ${failures.length}`)
  console.log(`Total tokens this week: ${totalTokens.toLocaleString()}`)
  console.log(`Estimated cost this week: $${totalCost.toFixed(2)}`)
  process.exit(0)
}

// --- Feedback loop: process rejected PRs ---
async function processRejectedPrs(): Promise<void> {
  try {
    const rejectedPrs = await findRejectedPrs()
    for (const pr of rejectedPrs) {
      // Cap retry depth: if title already has [RETRY], don't retry again
      if (pr.title.includes('[RETRY]')) {
        logger.info({ phase: 'feedback', action: 'max_depth', prNumber: pr.number, title: pr.title })
        await closePrLabel(pr.number)
        continue
      }

      logger.info({ phase: 'feedback', action: 'processing_rejected', prNumber: pr.number })
      const feedback = await getPrReviewComments(pr.number)
      const issueNumber = await createRetryIssue(pr.title, pr.body, feedback)
      await closePrLabel(pr.number)

      if (issueNumber > 0) {
        logger.info({ phase: 'feedback', action: 'retry_created', prNumber: pr.number, newIssue: issueNumber })
        await sendTelegram(`🔄 PR #${pr.number} was rejected. Created retry issue #${issueNumber}`)
      }
    }
  } catch (error) {
    // Don't let feedback loop errors block the main polling
    logger.error({ phase: 'feedback', error: String(error) })
  }
}

// --- Main run ---
async function main() {
  if (!acquireLock()) {
    logger.info({ phase: 'start', action: 'skipped', reason: 'lock_held' })
    return
  }

  try {
    // --- Phase 7: Check for rejected PRs and create retry issues ---
    await processRejectedPrs()

    const issue = await pollForIssue()
    if (!issue) {
      logger.info({ phase: 'start', action: 'idle' })
      return
    }

    currentIssueNumber = issue.number
    await markInProgress(issue.number)
    await sendTelegram(`🤖 Picked up issue #${issue.number}: ${issue.title}`)

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        logger.info({ phase: 'run', issueNumber: issue.number, attempt })

        // Git setup
        await cloneOrPull()
        const branch = await createBranch(issue.number, issue.title)

        // Run agent
        const { prUrl, costTracker } = await runAgent(issue)
        await costTracker.checkAlert()

        // Ensure agent-log entry exists (if agent didn't write one)
        await ensureAgentLogEntry(issue.number, issue.title, costTracker.totalTokens, costTracker.costUsd)

        // Record success
        appendRun({
          timestamp: new Date().toISOString(),
          issueNumber: issue.number,
          status: 'success',
          prNumber: prUrl ? parseInt(prUrl.split('/').pop() ?? '0', 10) : undefined,
          tokensUsed: costTracker.totalTokens,
          costUsd: costTracker.costUsd,
          attempts: attempt,
        })

        await markDone(issue.number)
        if (prUrl) {
          await sendTelegram(`✅ PR opened for issue #${issue.number}: ${prUrl}`)
        }

        logger.info({ phase: 'complete', issueNumber: issue.number, prUrl, ...costTracker.summary })
        return
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        logger.error({ phase: 'run', issueNumber: issue.number, attempt, error: lastError.message })

        // Check if this error type should not be retried
        const shouldNotRetry = NO_RETRY_ERRORS.some((pattern) => lastError!.message.includes(pattern))
        if (shouldNotRetry) {
          break
        }

        // Wait before retry (unless this was the last attempt)
        if (attempt < MAX_RETRIES) {
          const backoff = BACKOFF_MS[attempt - 1] ?? BACKOFF_MS.at(-1)!
          logger.info({ phase: 'retry', issueNumber: issue.number, nextAttempt: attempt + 1, backoffMs: backoff })
          await Bun.sleep(backoff)
        }
      }
    }

    // All retries exhausted
    const reason = lastError?.message ?? 'Unknown error'
    await markFailed(issue.number, reason)
    await sendTelegram(`❌ Issue #${issue.number} failed after ${MAX_RETRIES} attempts: ${reason}`)

    appendRun({
      timestamp: new Date().toISOString(),
      issueNumber: issue.number,
      status: 'failed',
      tokensUsed: 0,
      costUsd: 0,
      attempts: MAX_RETRIES,
    })
  } finally {
    currentIssueNumber = null
    releaseLock()
  }
}

main().catch((error) => {
  logger.error({ phase: 'fatal', error: String(error) })
  releaseLock()
  process.exit(1)
})
