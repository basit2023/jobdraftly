# JobDraftly production launch checklist

Status date: 11 November 2026  
Overall status: **NO-GO — not launched**

The checklist is evidence-based. A configured code path is not marked operational until it succeeds against the real staging/production dependency.

## Critical pre-launch gates

| Gate | Status | Evidence / required action |
| --- | --- | --- |
| Production build | Pass | `npm run build` completed and emitted all public, admin, analytics, health, sitemap, and robots routes. |
| TypeScript, ESLint, Prisma validation | Pass | All three checks completed successfully. |
| Full automated test suite | **Fail/blocking** | 44 non-database tests passed, including analytics privacy/semantics. Four database integration tests were skipped after setup/cleanup hooks timed out because WAMP MySQL is stopped. Restart MySQL, apply migration `20261111120000_add_analytics_events`, then rerun all tests and E2E. |
| Production dependency vulnerabilities | Pass | `npm audit --omit=dev --audit-level=moderate` returned zero findings. |
| Major security issues | **Blocked** | Code audit is strong, but Phase 10 high infrastructure risks remain: production TLS/firewall/secret manager/least-privilege MySQL/object scanning/shared services have not been verified on a staging host. |
| Administrator access and RBAC | **Blocked** | Last clean database audit contained zero administrators. MySQL is now unavailable, so real login/logout/RBAC cannot be retested. Create a staging administrator from protected environment variables and run the E2E workflow. |
| AI extraction and human review | **Blocked** | No real OCR/AI webhook is configured or operational. Contract/evaluation tests exist, but one authorized real document must succeed and be reviewed without invented fields. |
| Source permissions | **Blocked** | Last audit showed one approved manual source, zero monitored sources, and zero operational connectors. Each production source requires recorded permission and a successful real scan. |
| Verified application links | **Blocked** | Last audit contained zero jobs. Add one genuine reviewed staging vacancy and verify the employer URL, attribution, outbound behavior, and expiry. |
| Expired job handling | Partial | Expiration logic, eligible public-query rules, and scheduler exist. Rerun database and browser checks with genuine staging fixtures and worker active. |
| Sitemap and robots | Partial | Routes build successfully and automated SEO tests previously passed. Runtime URLs still default to the configured site URL; set the approved staging domain and validate every XML response before submission. |
| Mobile/tablet layouts | Partial | Phase 9 Playwright checks passed at mobile/tablet widths. Rerun against the final HTTPS staging deployment after analytics/CSP changes. |
| Backup and restore | Pass locally; staging required | A fresh logical backup was restored into an isolated temporary database; migration/category/location/job/company counts matched and the test database was removed. Repeat on approved MySQL 8 staging and verify off-host retention/alerts. |
| Redis/worker/object storage | **Blocked** | Code and health checks exist, but no real Redis or S3-compatible credentials/service were supplied. Worker heartbeat and production upload must pass in staging. |

## Analytics gates

| Item | Code status | Operational status |
| --- | --- | --- |
| GA4 | Loader and event mapping implemented | Blocked until a real `NEXT_PUBLIC_GA_MEASUREMENT_ID` and consent/privacy approval are supplied. |
| Search Console | Verification metadata implemented | Blocked until verification token, domain ownership, and approved production hostname exist. |
| Job views | First-party privacy-minimized event implemented | Migration not applied because MySQL is stopped. |
| Application-link clicks | Implemented as `APPLICATION_LINK_CLICK` | Explicitly an outbound click, never a confirmed application. Requires staging job/link test. |
| Search/filter usage | Implemented without raw keyword storage | Migration/runtime verification pending. GA4 sends only aggregate filter/location/category/result signals. |
| Admin ingestion analytics | Dashboard aggregates imports, monitor failures, extraction outcomes, source health | Runtime verification pending. |

## Final staging acceptance

Before launch, all must be checked by a named owner:

- [ ] MySQL 8, Redis TLS, object storage, worker, app, Apache/TLS, and external monitors are healthy.
- [ ] Latest committed migrations apply successfully after a verified backup.
- [ ] Full unit/integration/evaluation/E2E suites pass with no skipped critical tests.
- [ ] Admin sign-in/logout and each role boundary pass.
- [ ] One authorized source scan, document extraction, review, approval, publish, deadline update, and expiry lifecycle passes.
- [ ] A genuine job page exposes the correct employer, source, dates, visible details, structured data, and application link.
- [ ] No expired/closed/unverified imported job is public or present in eligible job sitemaps/schema.
- [ ] Responsive and accessibility smoke tests pass on final HTTPS staging.
- [ ] GA4 DebugView receives job view/search/filter/outbound-link events without a confirmed-application event.
- [ ] Search Console ownership succeeds; robots and all sitemap files return valid canonical HTTPS URLs.
- [ ] Backup alerting and a MySQL 8 restore drill pass; storage versioning/retention are verified.
- [ ] Logs/alerts are watched during the launch window and the rollback owner confirms the previous release.

## Launch actions — only after GO approval

1. Freeze the approved release and take the final database backup.
2. Deploy the already-tested release and apply migrations.
3. Switch only the approved jobs hostname; do not overwrite the existing Vercel `www` product without explicit migration approval.
4. Verify HTTPS, all three health endpoints, admin access, genuine application link, structured data, robots, and sitemaps.
5. Submit canonical eligible sitemaps in Search Console and monitor coverage/indexing; submission does not guarantee indexing.
6. Watch 404/5xx, application, worker, database, Redis, ingestion, storage, and backup alerts.
7. Roll back the application release immediately if critical smoke checks fail; do not automatically reverse migrations.
