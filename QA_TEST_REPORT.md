# JobDraftly Phase 9 Quality Assurance Report

Date: 11 November 2026  
Environment: local development, MySQL 8, Next.js production build  
Scope: implemented public, administrator, ingestion, monitoring, extraction-contract, database, and responsive flows

## Outcome

The implemented platform builds successfully and its automated suites pass. QA records were created only with clearly labelled development data and were removed after the tests. The final database audit contains zero jobs, companies, and administrators.

This report does not mark unimplemented public announcement features or an unconfigured OCR/AI service as passing.

## Automated results

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript and generated route types | Passed |
| Prisma schema validation | Passed |
| Production build | Passed |
| Vitest unit/API/database suite | 42 passed across 11 files |
| Playwright browser suite | 19 passed |
| npm dependency audit | 0 known vulnerabilities |
| Desktop public/admin routes | Passed for implemented routes |
| Mobile viewport, 390 x 844 | Passed; no horizontal document overflow on homepage or jobs page |
| Tablet viewport, 768 x 1024 | Passed; no horizontal document overflow on homepage or jobs page |

## Public website coverage

Passed:

- Homepage and main navigation.
- Job index, keyword/company fields, city/category/employment/experience/workplace/salary filters, sorting, pagination parsing, and shareable query parameters.
- Filtered result noindex metadata.
- Province, city, category, remote, government, and internship pages.
- Companies, about, and contact pages.
- Populated government-category listing, search result, job detail, and verified external Apply link using temporary QA records.
- Published/non-expired visibility rules through unit and database tests.
- Missing job responses now return HTTP 404 with a branded noindex page.
- Mobile and tablet overflow checks.

Not testable as product flows because they are not implemented:

- Public department pages and filters.
- A distinct private-jobs filter.
- Newspaper job pages or classification.
- Public career announcement pages.
- Public results and merit-list pages.

## Administrator coverage

Passed:

- Invalid-login rejection.
- Super-administrator login and logout.
- Server-side protected-page redirection after logout.
- Company creation.
- Job creation, publication, editing, and public visibility.
- Authenticated company-logo upload and cleanup.
- Editor source-management read-only enforcement.
- Source configuration authorization for ADMIN and SUPER_ADMIN.
- CSV parsing, validation, duplicate detection, staging, source attribution, pending-review status, and cleanup.
- Expiry processing.
- Monitoring change classification for deadline extensions, corrections, cancellations, and restored records.
- Scheduler, import-upload, and logo-upload endpoints reject unauthenticated requests.

Partially covered or unavailable:

- Announcement creation does not exist.
- Manual recruitment-document upload does not exist; only company-logo and CSV upload endpoints are implemented.
- OCR and AI extraction cannot be run because no real extraction endpoint is configured.
- Verification/approval and monitoring review logic have unit/database coverage, but no real imported vacancy exists after cleanup.
- No authorized real source is monitoring-enabled, so real-source update and cancellation behavior remains unverified.

## Bugs discovered and fixed

### P9-01: Missing job pages bypassed the branded 404

The slug proxy rewrote missing vacancies to Next.js's generic error page. A pass-through attempt rendered the branded page but returned HTTP 200. Missing job slugs now rewrite to a dedicated noindex presentation with an explicit HTTP 404 status. Historical redirects remain intact.

### P9-02: Deadline corrigenda could not apply deadline changes

A notice containing both `corrigendum` and a later deadline was classified as a generic correction. Reviewed deadline application only accepts `DEADLINE_CHANGED`, so extensions could not update their linked jobs. A genuine later deadline now takes priority over the generic correction label.

### P9-03: Editors could see and invoke privileged source controls

The source page displayed permission, monitoring, and activation controls to editors. Source creation and source activation also accepted every administrator role. Editors now receive a read-only source view, while source permission/configuration mutations require ADMIN or SUPER_ADMIN.

### P9-04: AI extraction accepted arbitrary objects

The extraction webhook accepted any JSON record, which prevented reliable field evaluation and allowed undocumented extra fields. It now requires a canonical, strict vacancy structure. Missing or blank fields normalize to null, application URLs must be HTTP(S), and multiple vacancies remain separate records.

### P9-05: Automated browser tests were mixed into Vitest

The initial QA runner collected Playwright specifications as Vitest files. Runner scopes are now separated, and direct server-route integration tests use a Node-only `server-only` test shim without weakening production boundaries.

## Remaining known issues

1. Department, newspaper, private-job, announcement, result, and merit-list public content models/routes are absent.
2. Announcement creation and manual recruitment-document upload are absent from the administrator dashboard.
3. OCR/AI extraction is an optional webhook adapter and is currently unconfigured; no real accuracy percentage is available.
4. No configured source has completed a real authorized scan. Operational connector count remains zero.
5. Company logos are written to local disk. Production on multiple or ephemeral instances requires durable object storage and malware/content validation appropriate to that service.
6. The development database contains no genuine vacancies after QA cleanup, so production-like volume, pagination load, and query performance were not measured.
7. Responsive tests use Chromium viewports, not physical iOS or Android devices.
8. The Playwright package could not download its matching browser because the system temporary drive ran out of space. Tests passed against an existing installed Playwright Chromium; CI should install the package-matched browser.
9. The public contact form remains disabled until `NEXT_PUBLIC_CONTACT_EMAIL` is configured.

## Recommendations before production

1. Do not launch announcement-focused pages until real normalized models, editorial workflows, and canonical URLs exist.
2. Configure an authorized OCR/AI endpoint and run the full evaluation dataset. Set per-field acceptance thresholds and require zero hallucinations for unknown fields.
3. Test each authorized source against the real endpoint before marking it operational.
4. Move uploads to durable object storage with server-side image decoding, size/dimension limits, malware scanning, and retention rules.
5. Add production-like anonymized load data in an isolated staging database and test pagination, full-text search, monitoring concurrency, and sitemap generation.
6. Run Playwright with its matching browser in CI on every release, plus at least one physical-device accessibility pass.
7. Configure production Auth.js URL/secrets, cron secret, contact email, backups, monitoring alerts, and deployment health checks.

## Commands

```text
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit
npm run db:audit
```
