import { logger } from '../utils/logger'

const WORK_DIR = process.env.WORK_DIR ?? '/tmp/agent-workspace'
const REPO = process.env.GITHUB_REPO ?? 'jarlerik/evil_empire'

async function gh(args: string[], cwd?: string): Promise<string> {
  const proc = Bun.spawn(['gh', ...args], {
    cwd: cwd ?? process.env.HOME ?? '/tmp',
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    throw new Error(`gh ${args.join(' ')} failed (exit ${exitCode}): ${stderr.trim()}`)
  }

  return stdout.trim()
}

export async function createPr(branch: string, title: string, body: string): Promise<string> {
  // Never create PR against main
  logger.info({ phase: 'github', action: 'create_pr', branch, title })
  const result = await gh(
    ['pr', 'create', '--repo', REPO, '--base', 'develop', '--head', branch, '--title', title, '--body', body],
    WORK_DIR
  )
  return result // returns PR URL
}

export async function addIssueComment(issueNumber: number, comment: string): Promise<void> {
  logger.info({ phase: 'github', action: 'comment', issueNumber })
  await gh(['issue', 'comment', String(issueNumber), '--repo', REPO, '--body', comment])
}

export async function addLabel(issueNumber: number, label: string): Promise<void> {
  await gh(['issue', 'edit', String(issueNumber), '--repo', REPO, '--add-label', label])
}

export async function removeLabel(issueNumber: number, label: string): Promise<void> {
  await gh(['issue', 'edit', String(issueNumber), '--repo', REPO, '--remove-label', label])
}

export interface ClosedPr {
  number: number
  title: string
  body: string
  headRefName: string
}

export async function findRejectedPrs(): Promise<ClosedPr[]> {
  // Find PRs opened by the agent that were closed without merging
  const result = await gh(
    ['pr', 'list', '--repo', REPO, '--state', 'closed', '--label', 'agent-done', '--json', 'number,title,body,headRefName,mergedAt', '--limit', '20']
  )
  const prs = JSON.parse(result) as Array<ClosedPr & { mergedAt: string }>
  // Closed but not merged = rejected
  return prs.filter((pr) => !pr.mergedAt)
}

export async function getPrReviewComments(prNumber: number): Promise<string> {
  const result = await gh(
    ['pr', 'view', String(prNumber), '--repo', REPO, '--json', 'reviews,comments', '--jq', '[.reviews[].body, .comments[].body] | join("\\n---\\n")']
  )
  return result || 'No review comments found.'
}

export async function createRetryIssue(originalTitle: string, originalBody: string, feedback: string): Promise<number> {
  const title = `[RETRY] ${originalTitle.replace(/^\[RETRY\]\s*/, '')}`
  const body = `${originalBody}\n\n---\n\n## Previous attempt feedback\n\n${feedback}`

  const result = await gh(
    ['issue', 'create', '--repo', REPO, '--title', title, '--label', 'agent-todo', '--label', 'agent-retry', '--body', body]
  )
  // gh issue create returns the URL, extract issue number
  const match = result.match(/\/issues\/(\d+)/)
  return match ? parseInt(match[1], 10) : 0
}

export async function closePrLabel(prNumber: number): Promise<void> {
  // Remove agent-done so we don't process this PR again
  await gh(['pr', 'edit', String(prNumber), '--repo', REPO, '--remove-label', 'agent-done', '--add-label', 'agent-rejected'])
}
