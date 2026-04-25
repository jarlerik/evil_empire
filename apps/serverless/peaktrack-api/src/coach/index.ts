import { Hono } from 'hono';

import { requireSupabaseJwt } from '../middleware/jwt';

// PR 7 fills in the body of POST /api/coach/prompt:
//   - forwards the prompt to the AI provider with a server-held secret
//     (env.ANTHROPIC_API_KEY),
//   - streams the response back to the client as SSE,
//   - persists nothing in v1 (no schema change).
// PR 1 ships only the route shell + the 401-without-JWT path so the auth
// boundary is real today, not aspirational.
//
// Module hygiene: the coach lives in its own self-contained folder
// (`src/coach/`) from day one. If we ever split it into its own service
// (decision criteria in the plan), it's a folder move, not a rewrite.

const stub = new Hono();

stub.post('/prompt', requireSupabaseJwt, (c) => {
  // Placeholder until PR 7. Returning 501 makes it obvious to anyone
  // hitting this route that the body isn't implemented yet, while still
  // proving JWT verification ran (we got past the middleware).
  return c.json(
    { error: 'not_implemented', message: 'coach/prompt body lands in PR 7' },
    501,
  );
});

export const coachRoutes = stub;
