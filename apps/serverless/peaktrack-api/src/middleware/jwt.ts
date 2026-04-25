import type { Context, MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { env } from '../env';

// Asymmetric verification against Supabase's JWKS endpoint.
// Supabase migrated this project from the legacy HS256 shared secret to
// asymmetric JWT signing keys; the Lambda now holds only public verification
// material. The private signing key never leaves Supabase, so a Lambda
// compromise no longer means tokens can be forged. Key rotation is also
// handled transparently — Supabase publishes a new `kid` in JWKS, jose's
// remote-set cache picks it up on the next miss, and verification keeps
// working without redeploy.
//
// Both web and mobile clients carry tokens issued by the same Supabase
// project, so one verification path serves both.

export interface SupabaseJwtClaims extends JWTPayload {
  sub: string;
  email?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  role?: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: SupabaseJwtClaims;
  }
}

// jose caches the remote JWKS in-process and refreshes on a `kid` cache miss
// (typical key rotation path). Cold Lambda invocations pay one fetch; warm
// invocations reuse the cached set.
const JWKS = createRemoteJWKSet(
  new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

function unauthorized(c: Context, reason: string) {
  return c.json({ error: 'unauthorized', reason }, 401);
}

export const requireSupabaseJwt: MiddlewareHandler = async (c, next) => {
  const header = c.req.header('authorization') ?? c.req.header('Authorization');
  if (!header) {
    return unauthorized(c, 'missing authorization header');
  }
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return unauthorized(c, 'expected Bearer token');
  }
  const token = match[1].trim();
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      // Supabase access tokens are issued with aud='authenticated'.
      audience: 'authenticated',
    });
    c.set('user', payload as SupabaseJwtClaims);
    return next();
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'invalid token';
    return unauthorized(c, reason);
  }
};
