import { cors } from 'hono/cors';
import type { MiddlewareHandler } from 'hono';

import { env } from '../env';

// CORS allowlist resolution:
//   1. Production web origin (and any extras) come from CORS_ALLOWED_ORIGINS.
//   2. In dev (NODE_ENV !== 'prod' and !== 'staging'), localhost / null /
//      capacitor://localhost are always allowed so the local Vite dev
//      server and an installed Capacitor build can talk to a local Lambda
//      runner (`pnpm dev:api`).
//   3. Expo Go on a physical phone resolves to the developer's LAN IP
//      (e.g., http://192.168.1.42:8081). Add that IP to CORS_ALLOWED_ORIGINS
//      in the developer's local env — no code change needed.
//
// CORS is browser hygiene; the actual security boundary is JWT verification
// in middleware/jwt.ts. Mobile in production uses native fetch (no CORS
// preflight) so it doesn't need a matching origin entry.

const DEV_DEFAULTS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://127.0.0.1:5173',
  'null',
  'capacitor://localhost',
];

function parseAllowlist(): string[] {
  const fromEnv = env.CORS_ALLOWED_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const isDev = env.NODE_ENV !== 'prod' && env.NODE_ENV !== 'staging';
  return isDev ? [...new Set([...fromEnv, ...DEV_DEFAULTS])] : fromEnv;
}

export const corsMiddleware: MiddlewareHandler = (c, next) => {
  const allowlist = parseAllowlist();
  const handler = cors({
    origin: (origin) => {
      if (!origin) return undefined;
      return allowlist.includes(origin) ? origin : undefined;
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    credentials: false,
    maxAge: 600,
  });
  return handler(c, next);
};
