---
title: React context state race in ProgramsContext preloaded-programs optimization
type: note
permalink: evil-empire/lessons/react-context-state-race-in-programs-context-preloaded-programs-optimization
tags:
- react
- performance
- context
- effect-ordering
- peaktrack
---

# Lesson: Context state reads inside async callbacks must be safe across every effect ordering window

## The bug

I optimized `ProgramsContext.fetchSessionsForRange` to pass its `programs` state into the service (saving one ~220ms round-trip) and gated it behind `loading === false` to avoid the obvious "not loaded yet" case. On hard refresh, virtual program sessions silently disappeared — but reappeared after navigating away and back.

## Root cause

The `loading` signal has a stale-false window during auth transitions:

1. Before sign-in, `ProgramsContext` takes the no-user branch: `programs=[]`, `loading=false`.
2. User signs in. `useEffect([user])` queues `reloadPrograms()`, but effects run after commit.
3. Re-render fires `fetchSessionsForRange` (re-memoized because `user` changed). It captures context state *right now*: `user=<new>`, `loading=false` (stale from step 1), `programs=[]`.
4. Service receives `preloadedPrograms=[]`, returns empty, caches empty under the date-range key.
5. `reloadPrograms` completes later; the cache gets cleared. `useFocusEffect` re-fires.
6. **But the dedup guard** (`loadingPromiseRef`) swallows the refire because the first `loadData` is still in flight — it resolves with the stale empty result.

## How to recognize this pattern

- An optimization reads context state (`useState` values) inside an async callback.
- The callback is exposed via `useCallback` whose deps include that state.
- A React effect ordering window exists where the captured state is inconsistent — one value has updated, another is stale from a previous code path.
- Local testing catches the steady state but misses the transient. The bug shows up only on cold loads or state transitions.

## How to avoid it

1. **Don't gate reads on `loading` alone if `loading` can be set false by *any* code path other than "load complete."** In this case, the no-user branch sets `loading=false` even though no load has happened.
2. **Prefer an affirmative "has completed initial load for current user" marker.** A ref or state like `loadedForUserIdRef.current === user.id` distinguishes "no programs exist" from "haven't loaded for this user yet."
3. **Before shipping a context-read optimization, mentally simulate every ordering** of `useEffect` fires across the relevant providers — don't trust `loading`-style booleans to be sufficient.
4. **If a dedup guard is in play**, the first call's data becomes the answer for all concurrent callers. A bug in the first call propagates to all of them. Treat dedup as an amplifier of correctness bugs.

## The fix

Reverted the preloaded-programs optimization in `ProgramsContext.fetchSessionsForRange`. Kept the service signature (optional param) backward-compatible. Kept the dedup guard because all calls now fetch fresh data.

## Related commits

- Introduced: `4b6048d` (PR 2 in perf/home-page-cache-and-dedup branch)
- First attempted fix (insufficient): `c45c552` — gated on `loading`, missed the stale-false window
- Actual fix: `4bfced4` — reverted the optimization

## Keywords for future retrieval

react context race, programs context, loading state stale, preloaded programs, effect ordering, useFocusEffect dedup, virtual session missing