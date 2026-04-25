import { Hono } from 'hono';
import { logger } from 'hono/logger';

import { corsMiddleware } from './middleware/cors';
import { healthRoute } from './routes/health';
import { coachRoutes } from './coach';

// Single Hono instance shared by:
//   * src/server.ts — local dev via @hono/node-server
//   * src/index.ts  — Lambda Function URL adapter (RESPONSE_STREAM mode)

export function createApp() {
  const app = new Hono();

  app.use('*', logger());
  app.use('*', corsMiddleware);

  app.route('/health', healthRoute);
  app.route('/api/coach', coachRoutes);

  app.notFound((c) => c.json({ error: 'not_found' }, 404));
  app.onError((err, c) => {
    // Lambda CloudWatch will catch the throw via the runtime; we still
    // return a structured body so callers don't see a generic 502.
    console.error('Unhandled error:', err);
    return c.json({ error: 'internal_error' }, 500);
  });

  return app;
}
