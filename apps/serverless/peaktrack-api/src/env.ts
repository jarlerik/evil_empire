// Centralised env-var access. Throws at startup if a required var is missing
// so a misconfigured Lambda fails on cold-start instead of returning 500s
// from inside route handlers. The web app and mobile clients hit a healthy
// API or a clear deploy failure — never a half-configured one.

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  // Supabase project URL. Required: middleware/jwt.ts derives the JWKS
  // discovery URL from this (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`).
  // Form: https://<project-ref>.supabase.co (no trailing slash).
  SUPABASE_URL: required('SUPABASE_URL'),

  // Comma-separated origin allowlist for CORS. Production web origin first;
  // additional dev origins (e.g., http://192.168.1.42:8081 for Expo Go on a
  // physical phone) are added per-developer in their Lambda env without code
  // changes. localhost / null / capacitor://localhost are always allowed in
  // dev mode (see middleware/cors.ts).
  CORS_ALLOWED_ORIGINS: optional('CORS_ALLOWED_ORIGINS'),

  // PR 7 will require this to be set; PR 1 leaves it optional so a fresh
  // deploy of the skeleton doesn't fail health checks.
  ANTHROPIC_API_KEY: optional('ANTHROPIC_API_KEY'),

  // 'development' | 'staging' | 'prod'. Drives CORS dev defaults.
  NODE_ENV: optional('NODE_ENV', 'development'),
};

export type Env = typeof env;
