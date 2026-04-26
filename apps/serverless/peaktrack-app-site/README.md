# @peaktrack/app-site

Static-site SAM wrapper for `@evil-empire/web-app`. Provisions S3 + CloudFront
with SPA fallback (`403/404 → /index.html`) so TanStack Router's
client-side routes resolve cleanly. Near-verbatim clone of
`apps/serverless/getpeaktrack-site` — only the description and the source it
deploys differ.

## Stacks

- `peaktrack-app-site-staging` — default CloudFront domain, no custom DNS.
- `peaktrack-app-site-prod` — `app.getpeaktrack.com` + ACM cert + Route 53
  alias, all wired via `parameter_overrides` in `samconfig.toml`.

## Prod custom-domain setup (one-time, before first prod deploy)

`samconfig.toml` is `.gitignore`d, so the operator owns these values locally.
The `[prod.deploy.parameters]` block needs a `parameter_overrides` line of
the form:

```
parameter_overrides = "DomainName=app.getpeaktrack.com CertificateArn=<acm-arn> HostedZoneId=<route53-zone-id>"
```

Steps:

1. Create an ACM certificate for `app.getpeaktrack.com` **in us-east-1**
   (CloudFront only reads ACM certs from us-east-1). Use DNS validation
   against the existing `getpeaktrack.com` Route 53 hosted zone.
2. Note the Route 53 hosted zone ID for `getpeaktrack.com` (shared with the
   apex / `www` records). The SAM template creates an A-alias for the
   subdomain; CloudFront's alias target hosted zone (`Z2FDTNDATAQYW2`) is
   already hard-coded in the template.
3. Paste the ACM ARN and hosted zone ID into the `parameter_overrides` line.
4. `pnpm deploy:prod`.

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
