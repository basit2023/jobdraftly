# Production troubleshooting

## Application will not start

1. Run `node --env-file=<protected-env> scripts/production-preflight.mjs`.
2. Check the WinSW app log and Windows Event Viewer; do not paste environment values into tickets.
3. Confirm Node 22+, `.next/BUILD_ID`, current release junction, and port 3000 availability.
4. Confirm `/api/health/live` locally. If local works but public does not, validate Apache modules/config with `httpd.exe -t`, certificate state, firewall, and proxy logs.

## Readiness returns 503

The readiness endpoint intentionally groups dependency failure details. Check structured logs for `health.readiness_failed`, then test MySQL and Redis from the service account/network. Confirm TLS Redis URL, credentials, firewall, connection limits, and provider status. Do not weaken readiness to hide an unavailable dependency.

## Worker unhealthy

Check the worker service/log for `worker.fatal`, `worker.cycle_failed`, Redis errors, or database failures. Confirm the heartbeat key prefix matches the web app. Restart once after the dependency is healthy; repeated restarts require investigation. Do not enable cron scheduling simultaneously as an unreviewed workaround.

## Imports or monitoring fail

Review the source run, permission status, robots result, response size/timeout, extraction adapter, and administrator notifications. Never bypass CAPTCHA, authentication, robots, or rate limits. Retry only after the cause is understood.

## Upload fails

Confirm S3 endpoint/bucket/region, scoped credentials, public base URL, clock synchronization, CORS/CDN policy, and object-store availability. Production intentionally refuses local-disk fallback. Validate that the file is PNG/JPEG/WebP, under 2 MB, and within dimension/pixel limits.

## Backup fails

Check task exit code, protected environment access, `MYSQL_BIN_DIR`, backup-account privileges, free space, directory ACLs, archive retention, and webhook delivery. A deployment must stop if its pre-migration backup fails. Do not delete recent backups to force a deployment; extend storage safely.

## High CPU, memory, or database load

Correlate WinSW/app/worker logs, Windows processor/working-set counters, MySQL connections/slow queries, Redis latency/memory/evictions, request latency, and source monitor batch sizes. Reduce monitoring batch size or disable a failing approved connector rather than scaling blindly. Capture MySQL query plans on staging before adding indexes.

## Rollback

Follow `DEPLOYMENT.md`: stop services, repoint only the verified `current` junction to the prior release, restart, and smoke test. Never run `prisma migrate reset`, overwrite production environment files, restore directly over the only database, or change `www` DNS during incident response.
