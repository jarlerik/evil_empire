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
