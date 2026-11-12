# Production environment

## Runtime topology

```text
Internet -> DNS/TLS -> Apache reverse proxy -> Next.js 127.0.0.1:3000
                                      |-> managed MySQL 8
                                      |-> managed Redis (TLS)
                                      |-> S3-compatible object storage
Windows service supervisor -> Next.js app + background worker
External monitor -> live/ready/worker health endpoints
```

Apache is selected because it already exists on the inspected host. Next.js should bind only to loopback. Follow the staged configuration in `ops/apache`; do not expose port 3000 publicly.

## Environment variables

The canonical, secret-free template is `.env.production.example`. Required groups are:

- Application: `NODE_ENV`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `CRON_SECRET`, `APP_RELEASE`.
- Public origin/analytics: `NEXT_PUBLIC_SITE_URL`, optional `NEXT_PUBLIC_GA_MEASUREMENT_ID`, and Search Console verification after ownership approval.
- MySQL: `DATABASE_URL` using a dedicated least-privilege account. Runtime permissions should cover the application schema only. Use a separate migration/backup account where feasible.
- Redis: `REDIS_URL` with `rediss://` for remote service and a unique `REDIS_KEY_PREFIX` per environment.
- Worker: `WORKER_POLL_INTERVAL_MS` and `MONITOR_SOURCE_BATCH_SIZE`.
- Object storage: endpoint, region, bucket, scoped access key, secret, public asset base URL, and path-style setting.
- Backup: MySQL binary directory, backup directory outside releases, retention days, and optional failure webhook.
- Optional extraction/contact/Search Console settings remain empty until their real services are approved.

Generate secrets with a cryptographically secure password manager. Never reuse the Auth.js, cron, Redis, MySQL, storage, or webhook credentials. Never prefix server secrets with `NEXT_PUBLIC_`.

Run production validation after the build:

```powershell
node --env-file=C:\JobDraftly\shared\jobdraftly.production.env scripts\production-preflight.mjs
```

The preflight validates presence and safe shape without printing values. It rejects non-HTTPS application/storage URLs, remote non-TLS Redis, short/reused secrets, root-like database users, leftover setup passwords, missing build output, and missing backup tools.

## MySQL

Provision MySQL 8 with `utf8mb4`; enable automated provider snapshots and binary logging if point-in-time recovery is required. Limit network access to application/worker and administration sources. Set connection/session limits from measured staging load. Apply only committed migrations with `prisma migrate deploy` after a successful backup.

The inspected WAMP server is MySQL 9.1, not the approved MySQL 8 target. Do not call the local server production-compatible without a complete MySQL 8 staging test.

## Redis

Redis stores rate-limit counters, the singleton worker lease, hourly expiry lease, and worker heartbeat. It is not the system of record. Configure authentication, TLS, private networking/firewall rules, an eviction policy appropriate for ephemeral keys, memory alerts, and provider persistence only if operational policy requires it. Loss of Redis stops production readiness and worker coordination but must not corrupt MySQL.

## Object storage

Company logos are written to S3-compatible storage in production; local public-disk fallback is development-only. Scope credentials to the configured bucket and write/read operations required by the app. Allow only intended public logo objects through the public asset domain, enable versioning/lifecycle policy, and deny bucket listing.

Private newspaper/source documents are not implemented. If added later, use a separate private bucket, malware scanning, encryption, retention rules, and short-lived authorized downloads. Never store private documents in `public/` or the public-logo bucket.

## Domain and HTTPS

Keep `www.jobdraftly.com` on its existing Vercel deployment. Add only an isolated staging record after ownership approval. Terminate HTTPS at Apache or an approved managed edge, pass the original host and `X-Forwarded-Proto`, and validate redirects, HSTS, certificate renewal, TLS versions, and streaming before launch.
