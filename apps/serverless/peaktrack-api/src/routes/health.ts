import { Hono } from 'hono';

// GET /health — liveness probe used by:
//   * Manual `curl https://.../health` after a deploy.
//   * The merge checklist in PR 1 (returns 200).
// Intentionally does not require a JWT — the whole point is to verify the
// Lambda is up before any auth is configured.

export const healthRoute = new Hono().get('/', (c) =>
  c.json({ ok: true, timestamp: new Date().toISOString() }),
);
