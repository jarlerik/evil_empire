import { logger } from '../utils/logger'

const WORK_DIR = process.env.WORK_DIR ?? '/tmp/agent-workspace'
const REPO = process.env.GITHUB_REPO ?? 'jarlerik/evil_empire'

async function gh(args: string): Promise<string> {
  const proc = Bun.spawn(['sh', '-c', `gh ${args}`], {
    cwd: WORK_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env },
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    throw new Error(`gh ${args} failed (exit ${exitCode}): ${stderr.trim()}`)
  }

  return stdout.trim()
}

export async function createPr(branch: string, title: string, body: string): Promise<string> {
  // Never create PR against main
  logger.info({ phase: 'github', action: 'create_pr', branch, title })
  const result = await gh(
    `pr create --repo ${REPO} --base develop --head ${branch} --title "${title.replace(/"/g, '\\"')}" --body "${body.replace(/"/g, '\\"')}"`
  )
  return result // returns PR URL
}

export async function addIssueComment(issueNumber: number, comment: string): Promise<void> {
  logger.info({ phase: 'github', action: 'comment', issueNumber })
  await gh(`issue comment ${issueNumber} --repo ${REPO} --body "${comment.replace(/"/g, '\\"')}"`)
}

export async function addLabel(issueNumber: number, label: string): Promise<void> {
  await gh(`issue edit ${issueNumber} --repo ${REPO} --add-label "${label}"`)
}

export async function removeLabel(issueNumber: number, label: string): Promise<void> {
  await gh(`issue edit ${issueNumber} --repo ${REPO} --remove-label "${label}"`)
}
