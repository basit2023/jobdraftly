# Job aggregation and import operations

Phase 4 adds a staged import pipeline for genuine Pakistan vacancies. No connector, CSV upload, or manual entry publishes a job automatically.

## Supported paths

- **CSV:** upload a UTF-8 CSV (maximum 2 MB and 1,000 rows), map columns, review validation and duplicate results, then confirm valid rows.
- **Approved API:** fetch a public HTTPS JSON endpoint only after its `JobSource` permission is approved. The payload may be a root array or `{ "jobs": [] }`.
- **Permitted RSS / Atom:** fetch an approved public HTTPS feed and retain its source URL and identifiers.
- **Manual:** use the existing job form at `/admin/jobs/new`.

API and feed requests block embedded credentials, redirects, local/private IP destinations, responses over 2 MB, and requests longer than 10 seconds. The system does not implement web scraping and must never bypass authentication, paywalls, CAPTCHAs, robots restrictions, or access controls.

## CSV columns

Required mappings are job title, company, description, city, category, source URL, and application URL. Employment type, experience level, salary, publication date, deadline, and source job identifier are optional. Category and city values must match active database records.

The repository fixture at `tests/fixtures/job-import.sample.csv` is development-only. It uses a reserved `.invalid` hostname and must never be published or used as production vacancy data.

## Review and publication

1. A source is created with `PENDING_REVIEW` permission.
2. An `ADMIN` or `SUPER_ADMIN` documents its terms URL and permission evidence, then approves it.
3. Uploaded or fetched rows are stored in `job_import_rows`; no `jobs` rows exist yet.
4. Column mapping and validation mark each row `VALID`, `DUPLICATE`, or `INVALID`.
5. Confirmation creates only valid rows as `PENDING_REVIEW` and `UNVERIFIED`.
6. An administrator inspects source and application links. Approve changes the job to `DRAFT` and records its verifier.
7. Publishing is a separate action. An imported job cannot publish while unverified.

Reject and Expire are explicit review actions and are written to the audit log. JobDraftly never labels a vacancy verified merely because it was imported.

## Duplicate protection

Preview checks source plus original job identifier, canonical source URL, normalized title/company/location, and duplicates within the current batch. Database unique constraints remain the final concurrency-safe protection.

## Scheduled expiration

`POST /api/cron/expire-jobs` expires published jobs whose explicit expiration date or application deadline has passed. It never changes or extends a deadline. Send `Authorization: Bearer <CRON_SECRET>` and keep the long random secret in the deployment secret manager. Schedule a daily authenticated POST using the deployment platform or a trusted scheduler. Missing or incorrect credentials return HTTP 401. Each run handles up to 1,000 jobs and writes a system audit record.

## Manual test

1. Create a source at `/admin/sources` with a real terms URL and permission notes, then approve it.
2. Open `/admin/imports/new`, upload an authorized CSV, and map its columns.
3. Verify invalid and duplicate rows are excluded in preview.
4. Confirm and check that new jobs appear only in Pending Review.
5. Inspect original and application URLs, approve the job, then publish it from Jobs.
6. Send an authenticated POST to `/api/cron/expire-jobs` and confirm only due published jobs become `EXPIRED`.
