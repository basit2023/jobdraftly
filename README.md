# JobDraftly

JobDraftly is a Pakistan-focused job discovery platform built with Next.js, TypeScript, MySQL, Prisma, Tailwind CSS, and Auth.js. It includes a permission-gated monitoring queue for approved APIs, RSS feeds, and explicitly permitted recruitment pages. Monitoring never publishes automatically; discoveries, changes, documents, and possible duplicates enter administrator review.

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- MySQL 8 or newer

## Local setup

1. Install packages with `npm install`.
2. Copy `.env.example` to `.env.local` and enter local-only credentials.
3. Create a MySQL database named `jobdraftly` with `utf8mb4` character support.
4. Apply committed migrations with `npx prisma migrate deploy`.
5. Load development reference data with `npm run db:seed` if it is not already present.
6. Start the application with `npm run dev` and open `http://localhost:3000`.

The development seed creates Pakistani provinces, cities, job categories, and a manual source only. It is blocked in production and never creates jobs, companies, administrators, or application links.

## Public routes

The public site includes the homepage, job search, category and city landing pages, remote, government, and internship discovery pages, company directory and profiles, and the About, Contact, Privacy Policy, and Terms pages.

Job search state is represented in the URL. Supported query parameters are `q`, `company`, `city`, `category`, `employmentType`, `experienceLevel`, `workplaceType`, `salaryMin`, `salaryMax`, `sort`, and `page`. Only active, published, non-expired vacancies from active companies and taxonomies are returned.

Because the development database intentionally contains no fake jobs, job and company sections show accessible empty states until reviewed records are added in a later admin phase.

Set `NEXT_PUBLIC_CONTACT_EMAIL` to a verified mailbox to enable the Contact page's email form. When it is unset or invalid, the page shows a configuration notice instead of inventing a destination.

## Administrator setup

1. Set a random `NEXTAUTH_SECRET` of at least 32 bytes in `.env.local`.
2. Supply `ADMIN_NAME`, `ADMIN_EMAIL`, and a strong `ADMIN_PASSWORD` as temporary process environment variables through a trusted local shell or secret manager.
3. Run `npm run admin:create` once.
4. Remove the three `ADMIN_*` variables immediately after the command succeeds.
5. Open `/admin/login` and sign in.

The setup command hashes the password with bcrypt cost 12, refuses to overwrite an existing email, and never prints the password. The normal development seed never creates administrators.

All protected pages repeat authorization on the server. Server Actions and administrator upload endpoints also perform their own authorization and validation. Administrator sessions use encrypted Auth.js JWT cookies with an eight-hour lifetime, while active account status is rechecked against MySQL on every protected request.

Company-logo uploads accept validated PNG, JPEG, or WebP content up to 2 MB and use generated filenames. The current local filesystem storage is suitable for the local/WAMP deployment target. Before deploying to an ephemeral or multi-instance host, replace it with durable object storage during deployment preparation.

Production probes are available at `GET /api/health/live` (process liveness) and `GET /api/health/ready` (MySQL readiness). Both are non-cacheable and disclose no credentials. Server logs are newline-delimited JSON with sensitive field redaction; configure the hosting platform to retain and alert on `error` records. See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) before deployment.

## Administrator routes

The administrator area provides dashboard statistics, job and company CRUD, category/location/source management, imported-job review, audit history, secure image uploads, loading and error states, filters, and pagination. Imported vacancies remain in `PENDING_REVIEW` until an administrator inspects their source data and explicitly publishes them.

Create and document real sources at `/admin/sources`, then use `/admin/imports/new` for CSV or an approved connector. The importer never publishes automatically. Configure `CRON_SECRET` and schedule an authenticated daily `POST /api/cron/expire-jobs` to expire due vacancies. See [IMPORTS.md](IMPORTS.md) for mapping, permission, review, duplicate, and scheduler operations.

## Automated job posting

1. Add `ANTHROPIC_API_KEY` and the Cloudinary values (`CLOUDINARY_URL`, or the three separate keys) to `.env.local`. See `.env.example`.
2. In `/admin/sources`, create a source with its feed or page URL, document its terms and permission, and approve it.
3. Under the source, choose a monitoring mode and frequency, tick **Enabled**, and tick **Trusted: auto-publish AI jobs** only for sources you trust.
4. Run `npm run worker:dev` in a second terminal while `npm run dev` is running. Every minute it checks due sources, has Claude extract new adverts, publishes or queues them, closes jobs whose advert was removed, and every 15 minutes expires jobs past their deadline.
5. Review held-back jobs under `/admin/jobs` (status *Pending review*); the reasons are in the admin notifications.

`npm run jobs:run-once` runs the same pipeline once and prints a summary, which is handy for testing or for Windows Task Scheduler. In production, run `npm run worker` with `REDIS_URL` set, or call the authenticated `POST /api/cron/monitor-sources` and `POST /api/cron/expire-jobs` endpoints from a scheduler.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Generate Next route types and run TypeScript checks |
| `npm test` | Run the Vitest suite |
| `npm run test:e2e` | Run Playwright browser, responsive, and administrator workflow tests |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:migrate -- --name <name>` | Create and apply a development migration |
| `npx prisma migrate deploy` | Apply committed migrations |
| `npm run db:seed` | Seed development reference data only |
| `npm run db:audit` | Run a read-only database record and constraint audit |
| `npm run db:validate` | Validate the Prisma schema |
| `npm run db:format` | Format the Prisma schema |
| `npm run admin:create` | Create one environment-backed administrator securely |
| `npm run worker:dev` | Run the scheduler locally (no Redis needed) |
| `npm run jobs:run-once` | Run scan → AI publish → sync → expiry once |

Never use production credentials locally or apply unreviewed migrations to production. The existing live website is not modified or deployed by this project.

See [ARCHITECTURE.md](ARCHITECTURE.md) for application boundaries and [DATABASE_DESIGN.md](DATABASE_DESIGN.md) for relationships, indexes, duplicate prevention, and seed policy.

See [SEO_CHECKLIST.md](SEO_CHECKLIST.md) for implemented controls, representative tests, and production/Search Console checks.

See [QA_TEST_REPORT.md](QA_TEST_REPORT.md) and [AI_EXTRACTION_ACCURACY.md](AI_EXTRACTION_ACCURACY.md) for Phase 9 results, fixed defects, remaining limitations, and the extraction evaluation status.

See [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) for the Phase 10 security audit, performance findings, reliability controls, deployment checklist, and unresolved production risks.

See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) and [LAUNCH_REPORT.md](LAUNCH_REPORT.md) for the Phase 12 no-go decision, analytics implementation, evidence, and remaining launch gates.
