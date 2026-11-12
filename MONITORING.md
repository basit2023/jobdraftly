# Authorized source monitoring

Phase 8 adds unattended discovery for sources that are active, explicitly approved, and individually enabled by an administrator. A public website is not treated as permission to scrape.

## Supported monitoring modes

- Approved JSON API: one HTTPS endpoint request per scheduled scan.
- Permitted RSS or Atom: one HTTPS feed request per scheduled scan.
- Permitted web page: checks robots.txt first, then inspects recruitment-related links on the configured page. This mode is allowed only for employer website, job board, or government portal source records with documented permission.

CSV and manual sources cannot be monitored. Requests reject embedded credentials, private or loopback destinations, redirects, responses above 5 MB, and timeouts. Web-page monitoring stops when robots policy cannot be verified or disallows the configured path. Authentication, CAPTCHAs, paywalls, and access controls are never bypassed.

## Configuration

1. Create the source in Admin > Sources.
2. Record its terms URL and permission evidence.
3. Approve and activate the source.
4. Configure an HTTPS feed or monitored-page URL.
5. Select the matching monitoring mode, interval, and rate limit.
6. Enable monitoring and run one authorized check manually.
7. Treat a connector as operational only after that real check succeeds and the discovered data is reviewed.

The scheduled endpoint is POST /api/cron/monitor-sources with Authorization: Bearer CRON_SECRET. Schedule it with a trusted platform scheduler. MONITOR_SOURCE_BATCH_SIZE controls how many due sources a run processes, capped internally at 25.

## Review and change detection

Each scan creates a durable run record. New and changed items are stored with source URL, source identifier, first and last seen timestamps, fingerprint, publication date, deadline, raw payload, related job, and a version snapshot. The monitor detects deadline changes, cancellation/correction wording, possible existing jobs, restored links, and documents.

Web-page links missing from two consecutive successful scans are marked removed. RSS and API items are not automatically marked removed because many feeds are rolling windows; an absent old feed item is not reliable proof of cancellation.

Nothing is published automatically. A job discovery can be staged into the existing mapping and import workflow, where it remains subject to validation, duplicate checks, human verification, and separate publication. Announcements, tests, interviews, results, merit lists, corrections, and removals remain review records.

## OCR and AI extraction adapter

The repository did not contain an OCR or AI pipeline. Phase 8 therefore provides an optional webhook adapter rather than pretending extraction exists. Configure both AI_EXTRACTION_WEBHOOK_URL and AI_EXTRACTION_WEBHOOK_SECRET.

The endpoint receives document ID, public document URL, MIME type, source name, source URL, and discovery time. It must return JSON containing confidence (0 to 1), extractedData (an object), and an optional documentReference. Documents remain NOT_CONFIGURED until both settings exist. A configured adapter is still not operational until a real authorized document succeeds.

## Tests and safety

Run npm test, npm run lint, npm run typecheck, npm run build, and npx prisma validate. Tests cover API normalization, page-document discovery, announcement classification, URL canonicalization, and robots precedence.

Keep secrets in the deployment secret manager. Never approve a source without documented authority, enter credentials in a URL, bypass access controls, or auto-extend a public job deadline.

## Production infrastructure monitoring

### Health endpoints

- `/api/health/live`: process liveness only; alert after two consecutive failures.
- `/api/health/ready`: MySQL and Redis readiness; remove the instance from traffic on failure and page after two minutes.
- `/api/health/worker`: Redis-backed worker heartbeat; alert when missing/stale or HTTP 503 for more than three minutes.

Probe the staging/production HTTPS hostname externally every minute. Do not place credentials or verbose dependency errors in public probe responses.

### Required dashboards and alerts

| Component | Signals | Suggested alert |
| --- | --- | --- |
| Website | HTTPS status, certificate expiry, p50/p95 latency | 2 failures; certificate under 21 days |
| Application | structured `error` events, request failures, restart count | sustained error increase or restart loop |
| MySQL | availability, connections, slow queries, storage, replication/backup status | over 80% connections/storage or backup failure |
| Redis | ping, latency, memory, evictions, connections | unavailable, eviction, or over 80% memory |
| Worker | heartbeat age, cycle duration/failure, service restart | heartbeat over 180 seconds or repeated cycle failures |
| Ingestion | failed source runs, extraction failures, pending review growth | three consecutive source failures or queue growth |
| Object storage | capacity/cost, 4xx/5xx, replication/versioning | write failure or replication lag |
| Host | CPU, available memory, disk free, service state | CPU over 85% for 10 min; memory/disk under 15% |
| Backups | last success, archive size, retention, restore test | no daily backup or monthly restore test failure |

Collect stdout/stderr from both WinSW services as newline-delimited JSON and ship it off-host. Redact at the collector as defense in depth. Retain security/audit logs according to the approved privacy policy, and test alerts in staging before cutover.

Redis is now used for distributed rate-limit counters and worker coordination/heartbeat; it is not a job payload database. MySQL remains the primary system of record.
