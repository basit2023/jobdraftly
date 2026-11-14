# JobDraftly architecture

## Approach

JobDraftly is a modular monolith: one Next.js application with clear feature and infrastructure boundaries. App Router Server Components render public pages and query server-only services. Client Components are limited to interactive navigation, error recovery, and search submission feedback.

## Directory responsibilities

```text
src/
|-- app/
|   |-- (public)/        Public pages, shared layout, loading, error, and not-found states
|   |-- admin/           Public login plus server-protected administrator route group
|   `-- api/             Auth.js and protected administrator upload handlers
|-- components/
|   |-- companies/       Company presentation
|   |-- admin/           Administrator shell, forms, controls, and upload UI
|   |-- jobs/            Job cards, listing composition, empty states, and pagination
|   |-- layout/          Public navigation and footer
|   |-- search/          Search and filter forms
|   `-- ui/              Reusable UI primitives
|-- lib/
|   |-- auth/            Auth.js options and database-backed authorization helpers
|   |-- db/              Prisma client and data-access infrastructure
|   |-- seo/             Metadata and structured-data helpers
|   |-- services/        Server-only application queries
|   `-- validations/     Zod-backed input parsing
|-- hooks/               Reusable client hooks
|-- types/               Shared TypeScript types
`-- generated/prisma/    Generated Prisma client
prisma/
|-- migrations/          Reviewed MySQL migrations
`-- schema.prisma        Normalized relational schema
public/                  Static assets
```

## Public request flow

1. An App Router page receives route and search parameters.
2. `parseJobSearchParams` normalizes, bounds, and allow-lists public filter input.
3. `public-jobs.ts` builds Prisma queries and applies the shared publication predicate.
4. Server Components render database results into reusable presentation components.
5. Filter and pagination links preserve shareable URL search state.

The shared publication predicate requires a job to be published, already released, not expired, and connected to active company, category, and location records. Company profiles are public only when active and verified. Application links are shown only when their stored URL uses HTTP or HTTPS.

## Search and relevance

MySQL full-text indexing covers job title, description, and skills. Keyword searches combine safe text matching with full-text relevance ordering; newest ordering uses publication date and a stable identifier tie-breaker. Structured filters cover company, city, category, employment type, experience level, workplace type, and salary bounds. Results use server-side pagination with 12 jobs per page.

## Administrator security boundary

`/admin/login` is the only public administrator page. Every operational page lives under the `(protected)` route group, whose server layout resolves the Auth.js session and rechecks that the administrator remains active in MySQL. This is intentionally a database authorization check rather than frontend-only navigation protection.

Every Server Action calls `requireAdmin()` again before reading mutation input. Zod schemas validate and normalize every submitted field, Prisma constraints remain the concurrency-safe boundary, and important changes create `AuditLog` rows. The custom company-logo endpoint separately checks the authenticated administrator, same-origin requests, file size, and image magic bytes before writing a random filename.

Credentials authentication uses bcrypt password verification and encrypted Auth.js JWT cookies. Administrator accounts are created only by the environment-backed setup script; credentials are not present in source code or seed data.

Jobs are never hard-deleted through the dashboard. Archive changes status to `CLOSED` and removes featured placement. Company archive deactivates and unverifies the profile. These choices preserve source history and relational integrity.

## Dependency rules

- Routes compose services and features; reusable query logic does not live in page files.
- UI components never access Prisma directly.
- Database access remains server-only under `src/lib/db` and `src/lib/services`.
- Untrusted search input is validated and bounded before reaching Prisma.
- Admin pages, Server Actions, and custom administrator handlers independently enforce authorization.
- External vacancies retain source attribution and the verified original application URL.
- No fake jobs, companies, or application destinations are introduced for presentation.

## Data and delivery boundaries

MySQL is the single primary database. Prisma manages schema evolution through committed migrations and generates its client into `src/generated/prisma`. The development-safe singleton in `src/lib/db/client.ts` uses Prisma's MySQL-compatible driver adapter.

Phase 4 changes are local only. They do not modify or deploy the existing live website, production database, or production environment variables.

## Phase 4 import boundary

The import subsystem lives under `src/lib/imports`. Parsers and normalizers are deterministic and do not access the network. `network.ts` is the single outbound connector boundary and enforces HTTPS, public destinations, response-size limits, redirect refusal, and timeouts. `staging.ts` is the database orchestration boundary.

CSV upload uses the authenticated route handler at `POST /api/admin/imports/csv`. Mapping, confirmation, connector sync, and review mutations are server actions that each repeat administrator authorization. Third-party connectors additionally require an active source with `APPROVED` permission. Scheduled expiration uses a separate bearer-secret boundary at `POST /api/cron/expire-jobs` because it has no administrator browser session.

The state flow is `source permission → staged JobImportRow → validation / duplicate preview → confirmed PENDING_REVIEW Job → explicit verification → explicit publication`. CSV and connector imports never write public jobs directly.

## AI publishing boundary

`src/lib/monitoring/publisher.ts` turns source discoveries into jobs. For each new discovery it fetches the advert (web page, PDF or image), asks OpenAI (`src/lib/ai/job-extractor.ts`) for structured fields, maps location and category to existing records, and creates the job. A job is published automatically only when its source is marked **Trusted: auto-publish** by an administrator *and* the extraction is confident and complete (`autoPublishBlockers`); every other job is created as `PENDING_REVIEW` with the reasons recorded. Jobs without a stated deadline get `expiresAt = now + AI_DEFAULT_LISTING_DAYS`, so every automated listing is eventually removed. `syncJobsWithSources` closes jobs whose source advert is removed or cancelled and applies deadline extensions. Images the advert links to are re-hosted through `storePublicObject`, which uses Cloudinary when configured. Connector credentials are not accepted in URLs or stored in the database, and this phase includes no general-purpose scraper.

## Phase 5 SEO boundary

SEO primitives live under `src/lib/seo` and `src/components/seo`. Structured data is generated from the same cached Prisma job object used for visible rendering, preventing a second source of truth. Public job lookup applies status, publication time, explicit expiration, and application-deadline eligibility before either HTML or JSON-LD is rendered.

The root sitemap is an index of bounded, database-backed child sitemaps. Job URLs require an application destination; category and city URLs require at least two current vacancies. Filter/search parameters are shareable for users but noindexed for crawlers. Historical job slugs are stored relationally and resolved only when their target remains publicly eligible.

## Phase 8 authorized monitoring boundary

SourceMonitorRun records source health, SourceDiscovery stores current discovered state, SourceDiscoveryVersion provides immutable change history, SourceDocument tracks extraction, and AdminNotification surfaces review events. The CRON-secret-protected monitor route runs due sources, while per-source leases prevent overlapping scans.

Approved API, RSS, and explicitly permitted web-page modes are supported. Web-page mode checks robots.txt before the configured path. Scans write review records only; public Job records remain behind staged import, duplicate validation, administrator verification, and separate publication.

OCR/AI processing is an optional outbound webhook adapter because no extraction engine existed in the repository. Its absence is represented explicitly as NOT_CONFIGURED.
