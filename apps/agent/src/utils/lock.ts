import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const LOCK_PATH = join(homedir(), '.agent.lock')

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function isStale(): boolean {
  if (!existsSync(LOCK_PATH)) return false
  const content = readFileSync(LOCK_PATH, 'utf-8').trim()
  const pid = parseInt(content, 10)
  if (isNaN(pid)) {
    // Corrupt lock file — treat as stale
    unlinkSync(LOCK_PATH)
    return true
  }
  if (!isProcessRunning(pid)) {
    unlinkSync(LOCK_PATH)
    return true
  }
  return false
}

export function acquireLock(): boolean {
  // Clean up stale lock first
  isStale()

  if (existsSync(LOCK_PATH)) {
    return false
  }

  writeFileSync(LOCK_PATH, String(process.pid), 'utf-8')
  return true
}

export function releaseLock(): void {
  try {
    if (existsSync(LOCK_PATH)) {
      const content = readFileSync(LOCK_PATH, 'utf-8').trim()
      const pid = parseInt(content, 10)
      // Only release our own lock
      if (pid === process.pid) {
        unlinkSync(LOCK_PATH)
      }
    }
  } catch {
    // Best effort — don't throw during cleanup
  }
}
