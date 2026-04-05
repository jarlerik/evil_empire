import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const STATE_PATH = join(homedir(), '.agent-state.json')
const MAX_RECORDS = 100

export interface RunRecord {
  timestamp: string
  issueNumber: number
  status: 'success' | 'failed'
  prNumber?: number
  tokensUsed: number
  costUsd: number
  attempts: number
}

interface AgentState {
  runs: RunRecord[]
}

export function getState(): AgentState {
  if (!existsSync(STATE_PATH)) {
    return { runs: [] }
  }
  const raw = readFileSync(STATE_PATH, 'utf-8')
  return JSON.parse(raw) as AgentState
}

export function appendRun(record: RunRecord): void {
  const state = getState()
  state.runs.push(record)
  // Trim to last N records
  if (state.runs.length > MAX_RECORDS) {
    state.runs = state.runs.slice(-MAX_RECORDS)
  }
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8')
}
