import { logger } from './utils/logger'
import { addIssueComment, addLabel, removeLabel } from './tools/github'

const REPO = process.env.GITHUB_REPO ?? 'jarlerik/evil_empire'

export interface ParsedIssue {
  number: number
  title: string
  task: string
  acceptanceCriteria: string[]
  filesLikely: string[]
  constraints: string[]
  rawBody: string
}

export async function pollForIssue(): Promise<ParsedIssue | null> {
  logger.info({ phase: 'poll', action: 'start' })

  const proc = Bun.spawn(
    [
      'sh', '-c',
      `gh issue list --repo ${REPO} --label agent-todo --json number,title,body,labels --search "sort:created-asc" --limit 10`,
    ],
    { stdout: 'pipe', stderr: 'pipe' }
  )

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    throw new Error(`gh issue list failed: ${stderr.trim()}`)
  }

  const issues = JSON.parse(stdout.trim()) as Array<{
    number: number
    title: string
    body: string
    labels: Array<{ name: string }>
  }>

  // Skip issues already in progress
  const available = issues.filter(
    (issue) => !issue.labels.some((l) => l.name === 'agent-in-progress')
  )

  if (available.length === 0) {
    logger.info({ phase: 'poll', action: 'no_issues' })
    return null
  }

  const issue = available[0]
  logger.info({ phase: 'poll', action: 'found', issueNumber: issue.number, title: issue.title })

  return parseIssue(issue.number, issue.title, issue.body)
}

function parseIssue(number: number, title: string, body: string): ParsedIssue {
  // Try structured parsing first
  const taskMatch = body.match(/## What to do\s*\n([\s\S]*?)(?=\n## |$)/)
  const criteriaMatch = body.match(/## Acceptance criteria\s*\n([\s\S]*?)(?=\n## |$)/)
  const filesMatch = body.match(/## Files likely involved\s*\n([\s\S]*?)(?=\n## |$)/)
  const constraintsMatch = body.match(/## Notes \/ constraints\s*\n([\s\S]*?)(?=\n## |$)/)

  const extractList = (text: string | undefined): string[] => {
    if (!text) return []
    return text
      .split('\n')
      .map((line) => line.replace(/^[-*\[\] x]+/, '').trim())
      .filter(Boolean)
  }

  return {
    number,
    title,
    task: taskMatch?.[1]?.trim() ?? body,
    acceptanceCriteria: extractList(criteriaMatch?.[1]),
    filesLikely: extractList(filesMatch?.[1]),
    constraints: extractList(constraintsMatch?.[1]),
    rawBody: body,
  }
}

export async function markInProgress(issueNumber: number): Promise<void> {
  await removeLabel(issueNumber, 'agent-todo')
  await addLabel(issueNumber, 'agent-in-progress')
}

export async function markDone(issueNumber: number): Promise<void> {
  await removeLabel(issueNumber, 'agent-in-progress')
  await addLabel(issueNumber, 'agent-done')
}

export async function markFailed(issueNumber: number, reason: string): Promise<void> {
  await removeLabel(issueNumber, 'agent-in-progress')
  await addLabel(issueNumber, 'agent-failed')
  await addIssueComment(issueNumber, `🤖 Agent failed: ${reason}`)
}

export async function markTodo(issueNumber: number): Promise<void> {
  await removeLabel(issueNumber, 'agent-in-progress')
  await addLabel(issueNumber, 'agent-todo')
}
