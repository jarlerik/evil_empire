import Anthropic from '@anthropic-ai/sdk'
import type { ParsedIssue } from './poller'
import { logger } from './utils/logger'
import { CostTracker } from './utils/cost'
import { getRepoTree, push } from './utils/git'
import { readFile, writeFile, listDirectory } from './tools/files'
import { runCommand } from './tools/bash'
import { createPr, addIssueComment } from './tools/github'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const WORK_DIR = process.env.WORK_DIR ?? '/tmp/agent-workspace'
const TOKEN_BUDGET = parseInt(process.env.MAX_TOKENS_PER_RUN ?? '500000', 10)
const MAX_ITERATIONS = 50

const SECRET_PATTERNS = ['sk_', 'pk_', 'ghp_', 'xoxb-', 'AKIA', '-----BEGIN', '.env']

const tools: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file. Path is relative to the workspace root.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'File path relative to workspace' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file. Path is relative to the workspace root.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: { type: 'string', description: 'File path relative to workspace' },
        content: { type: 'string', description: 'File content to write' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and directories at a path. Path is relative to the workspace root.',
    input_schema: {
      type: 'object' as const,
      properties: { path: { type: 'string', description: 'Directory path relative to workspace' } },
      required: ['path'],
    },
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the workspace. Only allowlisted commands are permitted (bun, pnpm, npm, git status/add/commit/diff/log/branch/checkout, gh, ls, cat, echo, mkdir, cp, mv, tsc, eslint, prettier, find, grep). No pipes, redirects, or chaining.',
    input_schema: {
      type: 'object' as const,
      properties: { command: { type: 'string', description: 'Shell command to execute' } },
      required: ['command'],
    },
  },
  {
    name: 'push_branch',
    description: 'Push the current branch to the remote. Only works on feature branches — cannot push to main or develop.',
    input_schema: {
      type: 'object' as const,
      properties: {
        branch: { type: 'string', description: 'Branch name to push' },
      },
      required: ['branch'],
    },
  },
  {
    name: 'create_pr',
    description: 'Create a pull request against the develop branch. The branch must be pushed first using push_branch.',
    input_schema: {
      type: 'object' as const,
      properties: {
        branch: { type: 'string', description: 'Source branch name' },
        title: { type: 'string', description: 'PR title' },
        body: { type: 'string', description: 'PR body (markdown)' },
      },
      required: ['branch', 'title', 'body'],
    },
  },
  {
    name: 'add_issue_comment',
    description: 'Add a comment to a GitHub issue.',
    input_schema: {
      type: 'object' as const,
      properties: {
        issue_number: { type: 'number', description: 'Issue number' },
        comment: { type: 'string', description: 'Comment body' },
      },
      required: ['issue_number', 'comment'],
    },
  },
]

function scanForSecrets(content: string): boolean {
  return SECRET_PATTERNS.some((pattern) => content.includes(pattern))
}

async function handleToolCall(name: string, input: Record<string, unknown>): Promise<string> {
  switch (name) {
    case 'read_file':
      return readFile(input.path as string)
    case 'write_file':
      writeFile(input.path as string, input.content as string)
      return 'File written successfully.'
    case 'list_directory':
      return listDirectory(input.path as string).join('\n')
    case 'run_command': {
      const command = input.command as string
      // Pre-commit secret scan
      if (command.startsWith('git commit')) {
        const diffProc = Bun.spawn(['sh', '-c', 'git diff --cached'], { cwd: WORK_DIR, stdout: 'pipe', stderr: 'pipe' })
        const diff = await new Response(diffProc.stdout).text()
        if (scanForSecrets(diff)) {
          return 'ERROR: Secrets detected in staged files. Commit aborted. Remove secrets before committing.'
        }
      }
      const result = await runCommand(command)
      return `Exit code: ${result.exitCode}\nStdout:\n${result.stdout}\nStderr:\n${result.stderr}`
    }
    case 'push_branch': {
      await push(input.branch as string)
      return `Branch ${input.branch} pushed to origin.`
    }
    case 'create_pr':
      return await createPr(input.branch as string, input.title as string, input.body as string)
    case 'add_issue_comment': {
      await addIssueComment(input.issue_number as number, input.comment as string)
      return 'Comment added.'
    }
    default:
      return `Unknown tool: ${name}`
  }
}

export async function runAgent(issue: ParsedIssue): Promise<{ prUrl?: string; costTracker: CostTracker }> {
  const client = new Anthropic()
  const costTracker = new CostTracker()

  // Build system prompt
  let claudeMd = ''
  try {
    claudeMd = readFileSync(join(WORK_DIR, 'CLAUDE.md'), 'utf-8')
  } catch {
    claudeMd = readFileSync(join(import.meta.dir, '..', 'CLAUDE.md'), 'utf-8')
  }

  const repoTree = await getRepoTree()

  const systemPrompt = `You are an autonomous coding agent working on the evil_empire monorepo.

## Project Conventions
${claudeMd}

## Repository Structure
${repoTree}

## Standing Rules
- NEVER push to main or develop directly
- ALWAYS write a docs/agent-log entry when done
- ALWAYS run tests before creating a PR
- If tests fail, fix them before proceeding
- Keep changes minimal and focused on the issue
- After committing, use push_branch to push, then create_pr to open the PR
- Do NOT try to use git push via run_command — it is blocked. Use the push_branch tool instead.`

  const userPrompt = `## Issue #${issue.number}: ${issue.title}

### Task
${issue.task}

### Acceptance Criteria
${issue.acceptanceCriteria.length > 0 ? issue.acceptanceCriteria.map((c) => `- ${c}`).join('\n') : 'None specified'}

### Files Likely Involved
${issue.filesLikely.length > 0 ? issue.filesLikely.map((f) => `- ${f}`).join('\n') : 'None specified'}

### Constraints
${issue.constraints.length > 0 ? issue.constraints.map((c) => `- ${c}`).join('\n') : 'None specified'}

${issue.rawBody.includes('Previous attempt feedback') ? `### Previous Attempt Feedback\nThis is a RETRY. A previous attempt was rejected. Pay close attention to the feedback below and avoid making the same mistakes.\n${issue.rawBody.split('## Previous attempt feedback')[1] ?? ''}\n` : ''}
Complete this task. Create a branch, make changes, run tests, and open a PR against develop with "Closes #${issue.number}" in the body.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userPrompt }]

  let prUrl: string | undefined
  let iterations = 0

  while (iterations < MAX_ITERATIONS) {
    iterations++
    logger.info({ phase: 'agent', iteration: iterations, totalTokens: costTracker.totalTokens })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8096,
      system: systemPrompt,
      tools,
      messages,
    })

    costTracker.add({
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    })

    // Check token budget
    if (costTracker.totalTokens >= TOKEN_BUDGET) {
      throw new Error(`Token budget exceeded: ${costTracker.totalTokens} tokens used (budget: ${TOKEN_BUDGET})`)
    }

    // Process response
    if (response.stop_reason === 'end_turn') {
      logger.info({ phase: 'agent', action: 'complete', iterations, ...costTracker.summary })
      break
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.MessageParam = {
        role: 'user',
        content: [],
      }

      for (const block of response.content) {
        if (block.type === 'tool_use') {
          logger.info({ phase: 'agent', tool: block.name, input: block.input })
          try {
            const result = await handleToolCall(block.name, block.input as Record<string, unknown>)
            if (block.name === 'create_pr' && !result.startsWith('ERROR')) {
              prUrl = result
            }
            ;(toolResults.content as Anthropic.ToolResultBlockParam[]).push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: result,
            })
          } catch (error) {
            ;(toolResults.content as Anthropic.ToolResultBlockParam[]).push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              is_error: true,
            })
          }
        }
      }

      messages.push({ role: 'assistant', content: response.content })
      messages.push(toolResults)
    }
  }

  if (iterations >= MAX_ITERATIONS) {
    throw new Error(`Max iterations reached: ${MAX_ITERATIONS}`)
  }

  return { prUrl, costTracker }
}
