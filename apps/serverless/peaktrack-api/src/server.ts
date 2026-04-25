import { serve } from '@hono/node-server';

import { createApp } from './app';

// Local dev runner. `pnpm dev:api` runs this via tsx watch — fast reload,
// real Node, accurate Hono behaviour. `sam local start-invoke` is reserved
// for pre-deploy smoke testing of the actual Lambda packaging (slow, only
// invoked manually via `pnpm smoke`).
const port = Number(process.env.PORT ?? 3001);

const app = createApp();

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`peaktrack-api listening on http://localhost:${info.port}`);
});
