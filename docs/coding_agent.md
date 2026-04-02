# Coding Agent — Build Task List (v2)

A self-hosted autonomous coding agent using Bun and the Anthropic TypeScript SDK.
Runs on the Hetzner VPS as a systemd timer, polls GitHub issues, and opens PRs autonomously.

---

## Architecture Overview

```
systemd timer (every 15min)
  → check lock file — exit if another run is active
  → poll GitHub issues via gh CLI (label: agent-todo)
  → mark issue as agent-in-progress
  → clone repo / pull latest develop
  → inject CLAUDE.md + repo tree snapshot into system prompt
  → run Claude agent with tools: read, write, sandboxed bash, gh CLI
  → token budget as hard stop (not just iteration count)
  → tests pass → open PR against develop
  → mark issue as agent-done
  → send Telegram notification
  → release lock file
```

---

## Key Design Decisions

- **gh CLI only** — no Octokit, one auth mechanism, fewer dependencies
- **One issue at a time** — lock file prevents parallel runs
- **Retry logic** — up to 3 attempts before marking `agent-failed`
- **Branch from develop** — never from main
- **Token budget as hard stop** — wired directly into the agent loop
- **Sandboxed bash** — allowlist approach, not blocklist
- **Guardrails built in from day one** — not bolted on later
- **CLAUDE.md aware** — agent reads project conventions before starting
- **Focused context** — repo tree snapshot, not full repo dump

---

## Phase 1 — Monorepo Setup

- [x] Create `apps/agent` directory in the monorepo
- [x] Initialize Bun project:
  ```bash
  cd apps/agent && bun init
  ```
- [x] Create `package.json` with name `@evil-empire/agent`
- [x] Add to `turbo.json` pipeline
- [x] Add `apps/agent` to root `pnpm-workspace.yaml`
- [x] Create folder structure:
  ```
  apps/agent/
    src/
      index.ts            # entry point, lock file, retry loop
      poller.ts           # gh CLI issue polling
      agent.ts            # Claude agent loop with token budget
      tools/
        bash.ts           # sandboxed shell execution (allowlist)
        files.ts          # read/write files (path restricted)
        github.ts         # gh CLI wrapper (PR, labels, comments)
      utils/
        logger.ts         # structured JSON logging
        git.ts            # git operations
        lock.ts           # PID lock file management
        cost.ts           # token tracking and budget alerting
        telegram.ts       # notification helper
        state.ts          # persistent run history (~/.agent-state.json)
    CLAUDE.md             # project conventions for the agent
    .env.example
    README.md
  ```
- [x] Install dependencies:
  ```bash
  bun add @anthropic-ai/sdk zod
  ```
  No Octokit — use `gh` CLI for all GitHub operations
- [x] Create `.env.example`:
  ```
  ANTHROPIC_API_KEY=
  GITHUB_TOKEN=
  GITHUB_REPO=jarlerik/evil_empire
  TELEGRAM_BOT_TOKEN=
  TELEGRAM_CHAT_ID=
  WORK_DIR=/tmp/agent-workspace
  MAX_TOKENS_PER_RUN=200000
  MAX_COST_ALERT_USD=2.00
  MAX_RETRIES=3
  ```
- [x] Add `.env` to `.gitignore`
- [x] Create `CLAUDE.md` with project conventions:
  ```markdown
  # Project Conventions

  ## Stack
  - Turbo monorepo, Bun, TypeScript
  - All packages under apps/ or packages/

  ## Branching
  - Always branch from develop
  - Never push to main or develop directly
  - Branch naming: issue-{n}/{short-slug}

  ## Code style
  - TypeScript strict mode
  - No any types
  - Tests required for new functionality

  ## Core Principles
  - Simplicity First: Make every change as simple as possible. Impact minimal code.
  - No Laziness: Find root causes. No temporary fixes. Senior developer standards.
  - Minimal Impact: Changes should only touch what's necessary. Avoid introducing bugs.
  - Verify Before Done: Never mark a task complete without proving it works. Run tests, check logs, demonstrate correctness.
  - No Over-Engineering: Skip elegance for simple, obvious fixes. Don't add features beyond what was asked.

  ## PRs
  - Title: concise description of change
  - Body: what, why, and "Closes #N"
  - Always include a docs/agent-log entry
  ```

---

## Phase 2 — Lock File & Retry Logic

Build these before anything else — they protect every subsequent phase.

- [x] Implement `src/utils/lock.ts`:
  - [x] `acquireLock()` — write PID to `~/.agent.lock`, fail if already exists
  - [x] `releaseLock()` — delete lock file
  - [x] `isStale(lock)` — check if PID in lock file is still running, clean up stale locks
  - [x] Always release lock in a `finally` block

- [x] Implement retry logic and SIGTERM handler in `src/index.ts`:
  - [x] **SIGTERM/SIGINT handler** in index.ts (not lock.ts — it needs access to poller + logger):
    ```typescript
    process.on('SIGTERM', async () => {
      logger.info({ phase: 'shutdown', reason: 'SIGTERM' })
      if (currentIssue) await markTodo(currentIssue) // re-queue for next run
      releaseLock()
      process.exit(0)
    })
    ```
  - [x] Wrap the full run in a retry loop (max 3 attempts, configurable via `MAX_RETRIES`)
  - [x] Exponential backoff between retries (30s, 60s, 120s)
  - [x] Only mark `agent-failed` after all retries exhausted
  - [x] Log each retry attempt with reason for failure
  - [x] Different retry behaviour per error type:
    - API timeout → retry
    - Token budget exceeded → do not retry, mark failed
    - Git conflict → do not retry, mark failed with explanation
    - Network error → retry

---

## Phase 3 — GitHub Issue Poller

- [x] Implement `src/poller.ts` using `gh` CLI only (no Octokit):
  ```bash
  gh issue list --repo jarlerik/evil_empire \
    --label agent-todo \
    --json number,title,body,labels \
    --limit 1
  ```
- [x] Return oldest issue first (FIFO — use `--search "sort:created-asc"`)
- [x] Skip issues already labeled `agent-in-progress`
- [ ] Handle `gh` CLI not authenticated gracefully

- [x] Issue parsing — use Claude to extract intent:
  - [x] If issue follows the template, parse sections directly
  - [ ] If issue is freeform, send raw body to Claude Haiku with prompt:
    *"Extract: task description, acceptance criteria, files likely involved, constraints"*
  - [ ] Use a separate small token budget for parsing (not deducted from implementation budget)
  - [x] Return a structured object regardless of input format:
    ```typescript
    interface ParsedIssue {
      task: string
      acceptanceCriteria: string[]
      filesLikely: string[]
      constraints: string[]
      rawBody: string
    }
    ```

- [x] Label management via `gh` CLI:
  - [x] `markInProgress(n)` — remove `agent-todo`, add `agent-in-progress`
  - [x] `markDone(n)` — remove `agent-in-progress`, add `agent-done`
  - [x] `markFailed(n, reason)` — remove `agent-in-progress`, add `agent-failed`, post comment with reason

---

## Phase 4 — Git Operations

- [x] Implement `src/utils/git.ts`:
  - [x] `cloneOrPull(repo, workDir)` — clone if not exists, pull if it does
  - [x] `checkoutDevelop()` — always start from latest develop
  - [x] `createBranch(issueNumber, title)` — `issue-{n}/{slug}` from develop
  - [x] `commitAll(message)` — stage all and commit
  - [x] `push(branch)` — push to origin
  - [x] `cleanup(workDir)` — remove workspace after done
  - [x] `getRepoTree(depth)` — generate directory tree snapshot for context injection
- [ ] Handle dirty workspace from previous failed run
- [x] Never allow push to `main` or `develop` — hard check before any push

---

## Phase 5 — Tools (with guardrails from day one)

### files.ts
- [x] Implement with path restriction baked in from the start:
  - [x] All paths resolved relative to `WORK_DIR`
  - [x] Reject any path that resolves outside `WORK_DIR` (path traversal protection)
  - [x] `read_file(path)` — read file contents
  - [x] `write_file(path, content)` — write/overwrite file
  - [x] `list_directory(path)` — list files
  - [x] `file_exists(path)` — check existence
  - [x] Never allow reading `.env` files or files containing secrets

### bash.ts
- [x] Use **allowlist** approach, not blocklist:
  ```typescript
  const ALLOWED_PREFIXES = [
    'bun ', 'pnpm ', 'npm ', 'npx ',
    'git status', 'git add', 'git commit', 'git diff', 'git log', 'git branch', 'git checkout',
    'gh ',
    'ls ', 'cat ', 'echo ', 'mkdir ', 'cp ', 'mv ',
    'tsc ', 'eslint ', 'prettier ',
    'find ', 'grep ',
  ]
  ```
  - `git push` is NOT in the allowlist — only the agent's own `push()` function can push
  - `sed` removed — agent should use `write_file` instead
  Reject any command that doesn't start with an allowed prefix
- [x] **Reject shell injection vectors** before checking prefix:
  - [x] Block commands containing `|`, `&&`, `||`, `;`, backticks, `$()`, `>(`, `<(`, `>`, `>>`, `2>`
  - [x] Parse the raw command string for these patterns before execution
  - [x] Log rejected commands with the reason
- [x] Set working directory to `WORK_DIR` always
- [x] Timeout: 5 minutes per command
- [x] Capture stdout, stderr, exit code
- [x] Log every command executed with timestamp
- [ ] Never allow commands that write outside `WORK_DIR`

### github.ts
- [x] All operations via `gh` CLI:
  - [x] `create_pr(branch, title, body)` — PR against develop
  - [x] `add_issue_comment(n, comment)` — post progress update
  - [x] PR body always includes `Closes #N`
  - [x] Never create PR against main

---

## Phase 6 — Claude Agent with Token Budget

- [x] Implement `src/agent.ts`:
  - [x] Initialize Anthropic client
  - [x] Build system prompt:
    ```
    1. Read CLAUDE.md (project conventions)
    2. Read repo tree snapshot (not full repo)
    3. Parsed issue content
    4. Standing rules (never push to main/develop, always write docs entry)
    ```
  - [x] Wire token budget directly into the agent loop:
    ```typescript
    let totalTokensUsed = 0
    const TOKEN_BUDGET = parseInt(process.env.MAX_TOKENS_PER_RUN)

    // After each API call:
    totalTokensUsed += response.usage.input_tokens + response.usage.output_tokens
    if (totalTokensUsed >= TOKEN_BUDGET) {
      throw new Error(`Token budget exceeded: ${totalTokensUsed} tokens`)
    }
    ```
  - [x] Max iterations as secondary stop (50) — token budget is primary
  - [x] Register tools: `read_file`, `write_file`, `list_directory`, `run_command`, `create_pr`, `add_issue_comment`
  - [x] Handle tool call responses in the agentic loop
  - [x] **Pre-commit secret scan** before any `git commit`:
    - [x] Grep staged files for patterns: `sk_`, `pk_`, `ghp_`, `xoxb-`, `AKIA`, `-----BEGIN`, `.env`
    - [x] Abort commit and log warning if secrets detected
  - [ ] On completion, write `docs/agent-log/YYYY-MM-DD.md` entry

- [x] Implement `src/utils/cost.ts`:
  - [x] Track input/output tokens per run
  - [x] Calculate cost (Sonnet: $3/MTok in, $15/MTok out)
  - [x] Log cost per run to structured log
  - [x] Alert via Telegram if single run exceeds `MAX_COST_ALERT_USD`
  - [ ] Write weekly cost summary to `docs/agent-log/cost-summary.md`

---

## Phase 7 — PR Review Feedback Loop

- [ ] When a PR is closed without merging (rejected):
  - [ ] Check for closed-unmerged PRs in the same polling loop (no webhooks needed)
  - [ ] Read PR review comments via `gh pr view --comments`
  - [ ] Create a new issue automatically with label `agent-todo`:
    - Title: `[RETRY] {original title}`
    - Body: original issue body + section "Previous attempt feedback: {review comments}"
  - [ ] Agent picks it up on next cron tick with full context of what went wrong

- [ ] Agent reads existing PR comments before starting if issue has `agent-retry` label
- [ ] Add `agent-retry` label to issues that have been attempted before
- [ ] **Cap retry depth at 2** — if issue title already contains `[RETRY]`, do not create another retry issue; mark as `agent-failed` with comment "Max retry depth reached"

---

## Phase 8 — systemd Timer (not bare cron)

- [ ] Create systemd service file:
  ```bash
  sudo nano /etc/systemd/system/coding-agent.service
  ```
  ```ini
  [Unit]
  Description=Coding Agent — GitHub Issue Worker
  After=network.target

  [Service]
  Type=oneshot
  User=openclaw
  WorkingDirectory=/home/openclaw/evil_empire
  EnvironmentFile=/home/openclaw/evil_empire/apps/agent/.env
  ExecStart=/home/openclaw/.bun/bin/bun run apps/agent/src/index.ts
  StandardOutput=journal
  StandardError=journal
  ```

- [ ] Create systemd timer file:
  ```bash
  sudo nano /etc/systemd/system/coding-agent.timer
  ```
  ```ini
  [Unit]
  Description=Run Coding Agent every 15 minutes

  [Timer]
  OnBootSec=2min
  OnUnitActiveSec=15min
  Persistent=true

  [Install]
  WantedBy=timers.target
  ```

- [ ] Enable and start the timer:
  ```bash
  sudo systemctl daemon-reload
  sudo systemctl enable coding-agent.timer
  sudo systemctl start coding-agent.timer
  sudo systemctl list-timers | grep coding-agent
  ```

- [ ] View logs via journald:
  ```bash
  journalctl -u coding-agent.service -f
  ```

---

## Phase 9 — Observability

- [x] Structured JSON logging in `src/utils/logger.ts`:
  ```typescript
  logger.info({ issueNumber, phase: 'start', tokens: 0 })
  logger.info({ issueNumber, phase: 'pr_opened', prUrl, tokens: 1234, costUsd: 0.02 })
  logger.error({ issueNumber, phase: 'failed', error, attempt: 2 })
  ```

- [ ] Logs via journald only (no separate log file — avoids dual-destination confusion):
  ```bash
  # View recent logs
  journalctl -u coding-agent.service --since "1 hour ago"
  # Follow live
  journalctl -u coding-agent.service -f
  # Export as JSON
  journalctl -u coding-agent.service -o json --since today
  ```
  journald handles rotation automatically via `/etc/systemd/journald.conf`

- [x] Implement `src/utils/state.ts` — persistent run history at `~/.agent-state.json`:
  ```typescript
  interface RunRecord {
    timestamp: string
    issueNumber: number
    status: 'success' | 'failed'
    prNumber?: number
    tokensUsed: number
    costUsd: number
    attempts: number
  }
  interface AgentState {
    runs: RunRecord[]  // append-only, trim to last 100
  }
  ```
  - [x] `appendRun(record)` — read file, push record, write back
  - [x] `getState()` — read and return current state
  - [x] Create file if it doesn't exist on first run

- [x] Add `--status` flag to index.ts (reads from `~/.agent-state.json`):
  ```bash
  bun run apps/agent/src/index.ts --status
  ```
  Output:
  ```
  Last run: 2026-03-27 21:00 (success)
  Issues processed this week: 4
  PRs opened: 4
  PRs merged: 3
  PRs rejected: 1
  Total tokens this week: 142,000
  Estimated cost this week: $0.68
  ```

- [x] Telegram notifications:
  - [x] `🤖 Picked up issue #N: {title}`
  - [x] `✅ PR #N opened: {url}`
  - [x] `❌ Issue #N failed after 3 attempts: {reason}`
  - [x] `💰 Cost alert: run exceeded $X`

---

## Phase 10 — First Real Issue

- [ ] Verify end-to-end with the pipeline test issue first
- [ ] Create a simple real task (e.g. add a utility function with tests)
- [ ] Watch the full flow in journald:
  ```bash
  journalctl -u coding-agent.service -f
  ```
- [ ] Review the PR — check code quality, test coverage, docs entry
- [ ] If rejected, verify the feedback loop creates a retry issue
- [ ] Merge to develop if acceptable
- [ ] Iterate on system prompt and CLAUDE.md based on what you observe

---

## Environment Variables Reference

| Variable | Description | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Anthropic API key | required |
| `GITHUB_TOKEN` | GitHub PAT (repo scope only) | required |
| `GITHUB_REPO` | Target repo | `jarlerik/evil_empire` |
| `TELEGRAM_BOT_TOKEN` | Bot token | required |
| `TELEGRAM_CHAT_ID` | Your numeric Telegram ID | required |
| `WORK_DIR` | Temp workspace directory | `/tmp/agent-workspace` |
| `MAX_TOKENS_PER_RUN` | Hard token budget per run | `200000` |
| `MAX_COST_ALERT_USD` | Alert threshold per run | `2.00` |
| `MAX_RETRIES` | Retry attempts before fail | `3` |

---

*Start with Phase 1 → Phase 2 (lock + retry) → Phase 3 (poller). Get issues polling correctly before touching the agent.*