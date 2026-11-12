# JobDraftly Production Readiness Report

Audit date: 11 November 2026  
Scope: Phase 10 security, performance, and reliability audit of the local application and development MySQL database. No production system, live credentials, or live website was accessed or changed.

## Executive assessment

The application is suitable for a controlled staging deployment after its deployment environment is configured. The code-level baseline is strong: authorization is enforced on the server, database access is through Prisma, public and administrator datasets are paginated or deliberately bounded, uploads are constrained, background endpoints require a separate secret, and the test/build gates pass.

Production launch is **not yet approved**. The deployment owner must close or explicitly accept the remaining infrastructure risks below—most importantly durable private file storage, a distributed rate limiter for multi-instance hosting, an external log/error sink, TLS and backup verification, and real production load testing.

## Security audit

| Area | Result | Evidence and implementation |
| --- | --- | --- |
| Administrator authentication | Pass | Auth.js Credentials provider, bcrypt cost 12, generic invalid-login behavior, dummy-hash comparison, encrypted JWT session with an eight-hour lifetime, active account recheck against MySQL on protected requests, and login throttling by IP/email. |
| Role authorization | Pass | Protected layout and every mutation reauthorize on the server. Source configuration and monitoring mutations require `ADMIN` or `SUPER_ADMIN`; editors retain the documented limited access. |
| Input validation | Pass | Zod schemas validate server actions and domain records. Upload/import handlers perform explicit type, size, source, and origin validation. |
| SQL injection | Pass | Application queries use Prisma's parameterized query API. No application raw SQL query was found. |
| XSS | Pass with residual | React renders job/company content as text. JSON-LD escapes `<`. A site-wide CSP, anti-framing policy, MIME sniffing protection, and restrictive browser permissions are configured. The CSP permits inline scripts/styles for Next.js compatibility; nonce-based CSP remains a future hardening item. |
| CSRF | Pass | Auth.js protects its authentication POST endpoints. Next.js Server Actions enforce same-origin behavior. Both custom cookie-authenticated admin upload endpoints now independently reject cross-origin requests. |
| Rate limiting | Pass for single instance | Bounded in-memory throttles protect administrator login, CSV/logo uploads, and cron endpoints. The store hashes keys, caps memory usage, returns `429`/`Retry-After` on API limits, and never stores raw credentials. A shared limiter is required before horizontal scaling. |
| File uploads | Pass with residual | Logos are limited to 2 MB, PNG/JPEG/WebP only, MIME must match decoded signature, dimensions are parsed and limited to 4096 px/16 MP, generated names use exclusive creation, and SVG is rejected. Malware scanning and durable object storage are not configured. |
| Private documents | Not applicable/current gap | JobDraftly does not currently accept or serve private newspaper document uploads. Discovered documents remain external references visible in the authenticated review area. If private uploads are introduced, they must use private object storage and an authorized download handler; `/public` must not be used. |
| Secrets | Pass in code | Runtime secrets are read from environment variables, local environment files are ignored, example values are placeholders, and structured logging redacts secret-like keys. No credential is intentionally exposed through `NEXT_PUBLIC_*`. Deployment secret-manager configuration was not available to audit. |
| Background endpoints | Pass | Cron routes use a separate `CRON_SECRET`, constant-time comparison, POST only, throttling, generic errors, and no-store API behavior. Source fetches retain HTTPS, redirect, DNS/SSRF, robots, size, and timeout protections. |
| Dependency scan | Pass | `npm audit --omit=dev --audit-level=moderate` reported zero known production dependency vulnerabilities on the audit date. |

## Security fixes implemented

- Added site-wide CSP, HSTS in production, Referrer-Policy, anti-framing, MIME-sniffing, browser-permissions, and cross-origin opener headers.
- Added bounded rate limiting to administrator authentication, sensitive admin uploads, and cron endpoints.
- Added reusable same-origin enforcement and applied it to CSV import as well as logo upload.
- Upgraded logo inspection from a short magic-byte check to format/MIME, structure, decoded-dimension, and pixel-count validation.
- Added structured JSON logging with key-based redaction and production-safe error serialization.
- Registered Next.js server error instrumentation so uncaught render, route, action, and proxy errors enter the structured log stream.

## Performance report

### Existing strengths

- Public job search is server-rendered, URL-driven, and paginated. Job, company, import, discovery, and activity views use database-side limits.
- MySQL indexes cover publication, taxonomy, company, featured, expiry, verification, source scheduling, discovery status, notification, and audit access paths. Unique constraints cover slugs and duplicate-import identities; job search has a MySQL full-text index.
- Public queries select card/detail projections instead of serializing full records. Sitemaps are split and cached. Static informational pages are prerendered.
- Images use explicit dimensions and lazy loading; priority is reserved for appropriate above-the-fold logos. Unknown remote logo domains intentionally avoid a permissive Next image allowlist.
- Background source processing is sequential and capped per invocation, document extraction is capped, network requests have byte/time limits, and database leases prevent duplicate source scans.

### Improvements implemented

- Source-monitor comparison now selects only fields needed for matching/removal rather than loading complete JSON extraction payloads and relations.
- Failed source checks now use capped exponential backoff (up to 30 days) while successful scans return to the configured interval.
- Liveness and database-readiness probes allow the platform to remove unhealthy instances from service quickly.
- Security and cron logs now include durations/counts suitable for latency and throughput dashboards.

### Performance limits and recommendations

- No representative production dataset or traffic profile was available, so query plans, p95 latency, memory, and concurrency limits have not been measured. Load-test a sanitized production-sized database before launch.
- Category, location, and source administration views are reference-data screens and are currently unpaginated. Add pagination if these datasets grow beyond a few hundred rows.
- The monitor compares all discoveries for one source in memory. Split this into keyed/batched lookups before enabling a source with tens of thousands of discoveries.
- Job expiration processes at most 1,000 records per invocation. Schedule it frequently and alert when the batch remains saturated, or convert it to a cursor loop with a platform execution deadline.
- Redis is not part of the approved/current stack and no Redis code exists to monitor. Introduce Redis only if a concrete multi-instance cache/queue/limiter requirement is approved; then add connection, memory, eviction, latency, and queue-depth alerts.

## Reliability implementation

- `GET /api/health/live` reports process liveness without touching dependencies.
- `GET /api/health/ready` verifies MySQL with a three-second deadline and returns `503` plus `Retry-After` when unavailable. Neither probe returns connection details.
- Structured newline-delimited JSON logs include timestamp, level, service, event, duration/count context, and sanitized errors.
- Next.js `onRequestError` captures unhandled server errors. Cron, import, health, and monitoring failure paths emit named events.
- Source monitoring already uses a five-minute database lease and records every run. Failures persist diagnostics, create administrator notifications, release the lease, and now back off exponentially.
- Extraction failures remain reviewable/retriable and never publish content automatically.
- There is no persistent in-process worker: scheduled jobs are bounded HTTP invocations, so worker shutdown does not leave a resident consumer to drain. Database mutations use transactions where related state must change atomically.

## Remaining production risks

| Severity | Risk | Required action before launch |
| --- | --- | --- |
| High | Uploaded logos use local public disk and have no malware scanner. This is unsafe for ephemeral/multi-instance hosting. | Move uploads to durable object storage, scan before release, and serve with immutable safe content headers. |
| High | No production TLS, reverse-proxy, firewall, MySQL backup/restore, least-privilege DB user, or secret-manager configuration was available for verification. | Complete an infrastructure security review and a timed restore drill. |
| High for multi-instance | Rate limits are per Node.js process. | Use a trusted shared limiter/edge gateway before running multiple instances. |
| Medium | Logs have no configured external retention, alerting, or incident tracker. | Route stdout/stderr to the production logging provider; alert on readiness failures, repeated auth/cron failures, extraction failures, and monitor saturation. Add an error tracker if required. |
| Medium | CSP still allows inline scripts and styles for framework compatibility. | Evaluate a nonce-based CSP with Next.js proxy support and re-run full browser tests before enforcing it. |
| Medium | Private newspaper file storage is not implemented. | Keep private documents out of `/public`; design authenticated object storage before adding the feature. |
| Medium | No production-scale load/soak test or MySQL `EXPLAIN ANALYZE` evidence exists. | Test representative search, sitemap, admin, monitoring, and expiration workloads. |
| Medium | No real monitoring connector is enabled, and OCR/AI extraction remains optional/unconfigured in the audited database. | Enable only permission-approved sources and validate each connector/service in staging. |

## Deployment checklist

1. Set strong, distinct `NEXTAUTH_SECRET`, `CRON_SECRET`, database credentials, and optional extraction credentials through a deployment secret manager; do not copy development values.
2. Set the canonical HTTPS `NEXTAUTH_URL`; terminate TLS; verify HSTS only after all subdomains support HTTPS.
3. Run `npx prisma migrate deploy` with a backup and rollback window. Do not run development seed or `prisma migrate dev` in production.
4. Create the first administrator with the one-time environment-backed command, then remove the temporary `ADMIN_*` values.
5. Configure health probes, structured-log collection, alerts, cron schedules, database backups, and retention policies.
6. Run smoke tests for login/RBAC, one genuine reviewed job, application URL/source attribution, search, upload, cron authentication, sitemap/robots, and error/health alerts.

## Verification evidence

- TypeScript: passed (`npm run typecheck`).
- ESLint: passed (`npm run lint`).
- Unit/integration/evaluation tests: 46 passed across 13 files (`npm test`).
- Browser E2E: 19 passed, including authentication, CRUD/RBAC, public routes, filters, 404, responsive overflow, and protected APIs (`npm run test:e2e`).
- Production build: passed (`npm run build`).
- Prisma schema: valid (`npm run db:validate`).
- Database audit: passed; development data remains reference-only with zero jobs, companies, and administrators after test cleanup (`npm run db:audit`).
- Production dependency audit: zero known vulnerabilities at the configured threshold.
