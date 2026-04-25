---
title: Plan - Extract PeakTrack Services Package
type: note
permalink: evil-empire/plans/plan-extract-peak-track-services-package
tags:
- plan
- architecture
- services
- monorepo
---

# Plan: Extract Services into @evil-empire/peaktrack-services

## Status
Planning - reviewed and approved by user on 2026-04-11

## Summary
Move PeakTrack service layer from `apps/mobile/PeakTrack/services/` into `packages/peaktrack-services/` so multiple consumers (mobile app, future Bun/Hono API for coaches, React web client) can share the same database access logic.

## Key Design Decisions
- Package name: `@evil-empire/peaktrack-services`
- Client pattern: factory with `initSupabaseClient(options)` / `getSupabaseClient()` (throws if not initialized)
- Remove all `if (!supabase)` null guards from service functions since getter throws
- Platform-agnostic: no React Native dependencies in the package
- Consumers configure the Supabase client for their platform at startup
- `date-fns` stays as package dependency (workout naming is business logic)

## Phases
1. Package scaffold (tsup, dual ESM/CJS)
2. Platform-agnostic Supabase client factory
3. Move types (ServiceResult, RepetitionMaximum, UserSettingsRow)
4. Move 7 service files, update imports
5. Rewire mobile app (~10 consumer files)
6. Build & verify (typecheck, lint, test, smoke test)

## Links
- [Full plan details](docs/evil_empire/plan-extract-services-package.md)
- relates_to [[PeakTrack Architecture]]
- enables [[Coaches Platform]]
