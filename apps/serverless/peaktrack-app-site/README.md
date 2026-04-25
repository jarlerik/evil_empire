# @peaktrack/app-site

Static-site SAM wrapper for `@evil-empire/web-app`. Provisions S3 + CloudFront
with SPA fallback (`403/404 → /index.html`) so TanStack Router's
client-side routes resolve cleanly. Near-verbatim clone of
`apps/serverless/getpeaktrack-site` — only the description and the source it
deploys differ.

## Stacks

- `peaktrack-app-site-staging` — default CloudFront domain, no custom DNS.
- `peaktrack-app-site-prod` — PR 8 wires `app.getpeaktrack.com` + ACM cert
  via `parameter_overrides` in `samconfig.toml`.

## Commands

```bash
# Full deploy: build web + build infra + deploy + sync + invalidate
pnpm deploy:staging
pnpm deploy:prod

# App-only deploy: skip sam build/deploy, just rebuild web and sync to S3
pnpm deploy:app:staging
pnpm deploy:app:prod
```

The `deploy:app:*` shortcut is the common case once the stack exists — much
faster than re-running `sam build`/`sam deploy` when only the web app
changed.
