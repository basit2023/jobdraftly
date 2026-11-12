# JobDraftly deployment

## Audited environment and decision

The inspected workstation is Windows 10 build 19045 with Node.js 22.20.0, npm 10.9.3, four logical processors, and WAMP Apache 2.4.62. WAMP runs MySQL Community 9.1 on port 3306 and MariaDB 11.5 on port 3307. Apache listens on port 80. Port 443, the Next.js port 3000, and Redis 6379 are not listening. Redis, Docker, Nginx, WinSW/NSSM/PM2, Certbot, and OpenSSL are not installed or on `PATH`. Apache currently loads `mod_rewrite`, but its proxy, SSL, and headers modules are not active.

The public `www.jobdraftly.com` DNS record points to Vercel and currently serves a separate resume-builder product. This repository has not been deployed there. Therefore:

- Do not change the apex or `www` DNS records.
- Deploy this application first to `jobs-staging.jobdraftly.com` or another approved isolated hostname.
- Use the existing Apache installation as the reverse proxy on this Windows host; Nginx adds no value here.
- Use managed Redis over TLS and S3-compatible object storage because neither service exists locally.
- Provision an approved MySQL 8 production instance. The local MySQL 9.1 server is acceptable only for procedure testing and is not the approved production version.

## Release layout

Use immutable release directories:

```text
C:\JobDraftly\
  current\                  # junction to one tested release
  releases\<timestamp>\     # application source, dependencies, .next build
  shared\
    jobdraftly.production.env
  logs\
```

Restrict `shared\jobdraftly.production.env` to the dedicated service account and administrators. Do not place it in the repository or web root.

## Staging deployment procedure

1. Provision `jobs-staging.jobdraftly.com`, an approved MySQL 8 database/account, managed TLS Redis, and S3-compatible public asset bucket.
2. Create the protected environment file using `.env.production.example`; replace every placeholder and use the staging hostname/bucket/prefix.
3. Obtain a trusted certificate for the staging hostname. Do not use a self-signed certificate for acceptance testing.
4. Install a verified WinSW release into `C:\JobDraftly\services`. Create distinct copies for the app and worker, place the matching XML beside each executable, and run them under a dedicated non-administrator account. WinSW was not present during this phase and was not silently installed.
5. Enable WAMP Apache modules `proxy_module`, `proxy_http_module`, `ssl_module`, `headers_module`, `rewrite_module`, and `socache_shmcb_module`. Include the reviewed staging virtual-host configuration from `ops/apache` and run `httpd.exe -t` before restarting Apache.
6. Prepare a release from a reviewed source snapshot:

```powershell
powershell -ExecutionPolicy Bypass -File ops\windows\deploy-release.ps1 -SourcePath E:\path\to\reviewed-source
```

The script copies into a new release, installs the lockfile, generates Prisma, builds, runs preflight, creates a database backup, and applies committed migrations. It deliberately does not change the `current` junction, restart services, modify DNS, or touch the live Vercel site.

7. Stop the staging app and worker services. Repoint `C:\JobDraftly\current` to the new release using an explicit, verified junction target. Start the app, then worker.
8. Confirm `/api/health/live`, `/api/health/ready`, and `/api/health/worker`. Run authentication/RBAC, genuine-job, application-link, upload, monitoring, sitemap, responsive, and error-alert smoke tests.
9. Observe staging for at least 24 hours, including a scheduled backup and monitor cycle. Approve production only after owners sign off on the restore test, monitoring alerts, source permission status, security review, and content correctness.

## Process supervision and reboot

The templates in `ops/winsw` define automatic delayed start, bounded restart backoff, rolling logs, and graceful stop timeouts. Run app and worker as separate services. The worker uses Redis leases, emits a 180-second heartbeat, and handles `SIGINT`/`SIGTERM` by stopping its polling loop and closing Prisma/Redis connections.

Do not schedule the legacy cron endpoints while the worker is active; they remain authenticated manual/fallback controls. Running both schedulers creates unnecessary duplicate attempts, although database/Redis leases limit damage.

## Rollback plan

1. Stop app and worker services.
2. Repoint `current` to the previously healthy immutable release.
3. Start app and worker, then verify all three health endpoints and primary smoke tests.
4. Do not automatically reverse database migrations. Releases must remain backward compatible with the currently deployed schema. If a migration is destructive, use the separately reviewed migration rollback procedure or restore into a new MySQL instance and switch only after validation.
5. If routing caused the incident, remove only the staging virtual host/DNS record. Never repoint `www` during staging.
6. Preserve failed-release logs and database backup for investigation.

## Production cutover gate

Cutover is blocked until MySQL 8, managed Redis, object storage, TLS, WinSW, external monitoring, off-host backups, and staging acceptance are real and tested. When approved, use a maintenance window, take a final backup, deploy the already-tested release, smoke test, and retain the previous release and backup for immediate rollback.
