# JobDraftly database design

## Overview

JobDraftly uses MySQL 8 through Prisma ORM. The schema is normalized around vacancies, companies, classifications, locations, sources, and import batches. String CUID primary keys avoid exposing sequential record counts and work cleanly in Next.js responses.

No employer or candidate identity tables exist. `Admin` stores only protected administrator identities and bcrypt password hashes; Auth.js sessions are encrypted JWT cookies.

## Relationships

Monitoring adds these relationships:

- JobSource has many SourceMonitorRun and SourceDiscovery records.
- SourceDiscovery belongs to one source, may relate to one existing Job, and has many immutable SourceDiscoveryVersion and SourceDocument records.
- SourceDiscoveryVersion may reference the monitor run that observed the change.
- AdminNotification stores review alerts without exposing them publicly.

Monitoring records never imply publication or verification. A discovery reaches Jobs only through the staged import and administrator review workflow.

| Parent | Child | Cardinality | Delete behavior |
| --- | --- | --- | --- |
| Company | Job | One-to-many | Restricted while jobs exist |
| JobLocation city | Company | One-to-many, optional on Company | Location deletion sets `locationId` to null |
| JobCategory | Job | One-to-many | Restricted while jobs exist |
| JobCategory | JobCategory | Optional hierarchy | Parent deletion restricted |
| JobLocation | Job | One-to-many | Restricted while jobs exist |
| JobLocation province | JobLocation city | One-to-many | Province deletion restricted |
| JobSource | Job | One-to-many, optional on Job | Source deletion sets `sourceId` to null |
| JobSource | JobImport | One-to-many | Source deletion restricted |
| Admin | JobImport | One-to-many, optional | Admin deletion preserves import and nulls uploader |
| Admin | AuditLog | One-to-many, optional | Admin deletion preserves audit history and nulls administrator |
| JobImport | Job | One-to-many, optional on Job | Import deletion preserves jobs and nulls batch reference |
| Job | JobTag | Many-to-many through JobTagAssignment | Join rows cascade on either parent deletion |

## Job lifecycle

`Job.status` supports `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `REJECTED`, `EXPIRED`, and `CLOSED`. Publication, deadline, and expiration timestamps are nullable so drafts can be created before lifecycle dates are known.

Public search paths are backed by compound indexes for status with publication date, category, location, company, employment/workplace type, featured state, and expiration.

The administrator dashboard archives jobs as `CLOSED`; it does not hard-delete vacancy records. Imported jobs are surfaced in the review queue while `jobImportId` is set and status is `PENDING_REVIEW`. Publication is an explicit audited administrator action.

## Audit history

`AuditLog` records successful sign-ins and important create, update, archive, publish, unpublish, feature, unfeature, and upload actions. It stores the acting administrator when available, entity type and ID, a concise summary, optional structured metadata, and an immutable creation timestamp. Indexes support recent activity, administrator history, and entity history queries.

## Duplicate protection

Imported vacancy identity is enforced in three layers:

1. `sourceId + sourceExternalId` is unique when a source supplies a stable vacancy identifier.
2. `sourceId + sourceUrlHash` is unique after canonicalizing the source URL and removing common tracking parameters.
3. `deduplicationKey` is globally unique. It is generated from the source identifier first, then the canonical URL, and finally normalized title/company/location/deadline values.

The application computes these values with `src/lib/services/job-identity.ts`. Database unique constraints remain the final concurrency-safe protection. Import review should treat unique-constraint conflicts as duplicate rows rather than retrying inserts blindly.

## Phase 4 staging and verification

`JobImport` records its method (`CSV`, `API`, or `RSS`), source endpoint, selected column mapping, progress counts, and completion state. `JobImportRow` owns the original row JSON, normalized preview JSON, row number, validation errors, duplicate job reference, and staging status. Staging rows cascade-delete with their batch; duplicate references are set null if the matched job is later removed.

`JobSource.permissionStatus` prevents use until terms and permission evidence are reviewed. API/RSS endpoints and attribution text remain attached to the source. `Job.originalPublishedAt` preserves the source publication date separately from JobDraftly publication, while `verificationStatus`, `verifiedAt`, and `verifiedById` record an explicit administrator check.

Imported jobs relate to `JobImport` and are created as `PENDING_REVIEW` / `UNVERIFIED`. The verifier relation is optional and uses `SET NULL`. The scheduled expiry process changes only already-published, due rows to `EXPIRED`; it never extends source dates.

## Phase 5 SEO integrity

`Job.salaryPeriod` is nullable and accepts only `HOUR`, `DAY`, `WEEK`, `MONTH`, or `YEAR`. Structured salary is omitted unless numeric visible salary and this genuine period are both present. `JobSlugRedirect` stores a unique historical slug related to one job and cascades on job deletion. Public redirect lookup also applies the normal published/non-expired eligibility predicate, so historical URLs never resurrect closed vacancies.

## Slug strategy

Job slugs use normalized title and company text plus a random ten-character suffix, for example `senior-react-developer-company-name-a1b2c3d4e5`. The database has a unique slug constraint. A rare unique violation must be handled by regenerating the suffix and retrying once.

Company, category, location, source, and tag slugs are human-managed stable unique values.

## Salary and integrity rules

Salary values use `DECIMAL(12,2)` and ISO-style three-character currencies, defaulting to `PKR`. The migration adds database checks requiring non-negative salary values and `salaryMin <= salaryMax` when both are provided.

## Seed policy

The development seed is blocked when `NODE_ENV=production`. It creates only reference data:

- Pakistani provinces/territories and major cities
- Job categories
- The JobDraftly manual-entry source

It never creates jobs, companies, candidates, employers, administrator credentials, or application links. Production reference data must be loaded through an explicitly reviewed production process.
