import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve, relative } from 'node:path'

const WORK_DIR = process.env.WORK_DIR ?? '/tmp/agent-workspace'

const SECRET_PATTERNS = ['.env', '.env.local', '.env.production']

function assertSafePath(filePath: string): string {
  const resolved = resolve(WORK_DIR, filePath)
  const rel = relative(WORK_DIR, resolved)

  if (rel.startsWith('..') || resolve(resolved) !== resolved.replace(/\/$/, '')) {
    throw new Error(`Path traversal blocked: ${filePath}`)
  }

  const basename = resolved.split('/').pop() ?? ''
  if (SECRET_PATTERNS.some((p) => basename === p || basename.startsWith('.env'))) {
    throw new Error(`Access to secret file blocked: ${filePath}`)
  }

  return resolved
}

export function readFile(path: string): string {
  const safePath = assertSafePath(path)
  if (!existsSync(safePath)) {
    throw new Error(`File not found: ${path}`)
  }
  return readFileSync(safePath, 'utf-8')
}

export function writeFile(path: string, content: string): void {
  const safePath = assertSafePath(path)
  const dir = safePath.substring(0, safePath.lastIndexOf('/'))
  mkdirSync(dir, { recursive: true })
  writeFileSync(safePath, content, 'utf-8')
}

export function listDirectory(path: string): string[] {
  const safePath = assertSafePath(path)
  if (!existsSync(safePath)) {
    throw new Error(`Directory not found: ${path}`)
  }
  return readdirSync(safePath, { withFileTypes: true }).map((entry) =>
    entry.isDirectory() ? `${entry.name}/` : entry.name
  )
}

export function fileExists(path: string): boolean {
  const safePath = assertSafePath(path)
  return existsSync(safePath)
}
