import { logger } from './logger'

const WORK_DIR = process.env.WORK_DIR ?? '/tmp/agent-workspace'
const REPO = process.env.GITHUB_REPO ?? 'jarlerik/evil_empire'

async function run(command: string, cwd?: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(['sh', '-c', command], {
    cwd: cwd ?? WORK_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode }
}

export async function cloneOrPull(): Promise<void> {
  const { existsSync } = await import('node:fs')
  if (existsSync(`${WORK_DIR}/.git`)) {
    logger.info({ phase: 'git', action: 'pull' })
    await run('git fetch origin && git checkout develop && git reset --hard origin/develop')
  } else {
    logger.info({ phase: 'git', action: 'clone' })
    const { mkdirSync } = await import('node:fs')
    mkdirSync(WORK_DIR, { recursive: true })
    await run(`git clone https://github.com/${REPO}.git .`, WORK_DIR)
    await run('git checkout develop')
  }
}

export async function checkoutDevelop(): Promise<void> {
  await run('git checkout develop && git pull origin develop')
}

export async function createBranch(issueNumber: number, title: string): Promise<string> {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  const branch = `issue-${issueNumber}/${slug}`
  await run(`git checkout -b ${branch}`)
  logger.info({ phase: 'git', action: 'branch', branch })
  return branch
}

export async function commitAll(message: string): Promise<void> {
  await run('git add -A')
  await run(`git commit -m "${message.replace(/"/g, '\\"')}"`)
}

export async function push(branch: string): Promise<void> {
  // Hard check: never push to main or develop
  if (branch === 'main' || branch === 'develop') {
    throw new Error(`Refusing to push to protected branch: ${branch}`)
  }
  await run(`git push origin ${branch}`)
}

export async function cleanup(): Promise<void> {
  const { rmSync } = await import('node:fs')
  rmSync(WORK_DIR, { recursive: true, force: true })
}

export async function getRepoTree(depth = 3): Promise<string> {
  const { stdout } = await run(`find . -maxdepth ${depth} -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/.turbo/*' | sort`)
  return stdout
}
