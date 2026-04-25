import { streamHandle } from 'hono/aws-lambda';

import { createApp } from './app';

// Lambda entrypoint. The Function URL is configured with
// InvokeMode: RESPONSE_STREAM in template.yaml so PR 7's coach endpoint
// can stream SSE back to the client. `streamHandle` wraps
// awslambda.streamifyResponse and works for non-streaming routes too,
// so we use it uniformly here rather than mixing handlers.
const app = createApp();
export const handler = streamHandle(app);
