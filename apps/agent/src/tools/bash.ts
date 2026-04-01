import { logger } from '../utils/logger'

const WORK_DIR = process.env.WORK_DIR ?? '/tmp/agent-workspace'
const COMMAND_TIMEOUT = 5 * 60 * 1000 // 5 minutes

const ALLOWED_PREFIXES = [
  'bun ', 'pnpm ', 'npm ', 'npx ',
  'git status', 'git add', 'git commit', 'git diff', 'git log', 'git branch', 'git checkout',
  'gh ',
  'ls ', 'ls',
  'cat ', 'echo ', 'mkdir ', 'cp ', 'mv ',
  'tsc ', 'eslint ', 'prettier ',
  'find ', 'grep ',
]

const INJECTION_PATTERNS = ['|', '&&', '||', ';', '`', '$(', '>(', '<(', '>>', '2>', '>']

function validateCommand(command: string): void {
  const trimmed = command.trim()

  // Check for shell injection vectors first
  for (const pattern of INJECTION_PATTERNS) {
    if (trimmed.includes(pattern)) {
      throw new Error(`Blocked shell injection pattern "${pattern}" in command: ${trimmed}`)
    }
  }

  // Check allowlist
  const allowed = ALLOWED_PREFIXES.some((prefix) => trimmed.startsWith(prefix))
  if (!allowed) {
    throw new Error(`Command not in allowlist: ${trimmed}`)
  }
}

export interface CommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

export async function runCommand(command: string): Promise<CommandResult> {
  validateCommand(command)

  logger.info({ phase: 'bash', command })

  const proc = Bun.spawn(['sh', '-c', command], {
    cwd: WORK_DIR,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, HOME: process.env.HOME },
  })

  const timeout = setTimeout(() => {
    proc.kill()
  }, COMMAND_TIMEOUT)

  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited

  clearTimeout(timeout)

  const result: CommandResult = {
    stdout: stdout.trim(),
    stderr: stderr.trim(),
    exitCode,
  }

  if (exitCode !== 0) {
    logger.warn({ phase: 'bash', command, exitCode, stderr: result.stderr })
  }

  return result
}
