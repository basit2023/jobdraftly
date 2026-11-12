# Backup and restore

## Policy

- Run a logical MySQL backup daily and immediately before every migration/cutover.
- Default local retention is 14 daily archives. Production should additionally retain 8 weekly and 12 monthly encrypted off-host copies through the backup provider.
- Keep backups outside application release directories and outside the web root. Encrypt storage, restrict access, and record immutable/audited deletion events.
- Enable managed MySQL snapshots and binary logs when the recovery point objective requires point-in-time recovery.
- Configure `BACKUP_FAILURE_WEBHOOK_URL` for a trusted operations endpoint. The notification contains only the event, generic failure message, and timestamp.
- Public asset storage should use versioning and cross-account/region replication as appropriate. Private document backup is not applicable until private document storage exists.

## Automated backup

Run under the dedicated backup identity:

```powershell
node --env-file=C:\JobDraftly\shared\jobdraftly.production.env scripts\backup-mysql.mjs
```

The script uses `mysqldump --single-transaction --quick`, includes routines/events/triggers, writes with `--result-file` to avoid PowerShell UTF-16 corruption, compresses the result, validates a minimum size, applies bounded retention, keeps the password in the child environment, and sends a failure notification when configured.

Schedule daily with Windows Task Scheduler using “Run whether user is logged on or not”, the least-privilege backup account, an explicit working directory, and failure/retry settings. Monitor the task exit code, archive age, size anomaly, and off-host copy status.

## Restore test

The safe automated test creates a uniquely named `jobdraftly_restore_test_YYYYMMDDHHMMSS` database, restores a fresh backup, compares migration/category/location/job/company counts, and drops only that validated test database name:

```powershell
node --env-file=C:\JobDraftly\shared\jobdraftly.production.env scripts\test-backup-restore.mjs
```

Run it monthly and after MySQL/client upgrades. The account needs temporary create/drop database permission for this test; preferably run against a separate restore-test MySQL instance rather than granting those privileges to the runtime account.

## Disaster restore procedure

1. Declare the incident, stop application/worker writes, and preserve logs.
2. Select the latest verified archive meeting the recovery point. Verify its checksum and provenance from the backup system.
3. Provision a clean MySQL 8 instance with compatible character set/collation. Never restore over the only production copy.
4. Decompress and import into the new instance using a dedicated restore account.
5. Run `prisma migrate status`, database audit, referential/count checks, representative job/search/admin queries, and application smoke tests against the restored instance.
6. If point-in-time recovery is enabled, replay binary logs only to the approved timestamp and repeat validation.
7. Update the protected database connection secret, restart app/worker, verify health, then reopen traffic.
8. Document recovery point, recovery time, data gap, validation, and follow-up actions.

## Current restore evidence

Phase 11 runs the automated procedure against the local development database. Record the exact successful archive and verification output in the phase report. This validates the scripts and logical contents on MySQL 9.1; a second restore test on the approved MySQL 8 staging instance remains a production cutover requirement.
