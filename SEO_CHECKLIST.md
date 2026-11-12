# JobDraftly technical SEO checklist

Updated: 9 November 2026

## Implemented

- [x] Unique job title and description metadata generated from visible database content.
- [x] Self-referencing canonical URLs for jobs and primary public pages.
- [x] Open Graph and Twitter metadata plus a generated 1200×630 social image.
- [x] Visible breadcrumbs and `BreadcrumbList` JSON-LD on job, company, category, city, and major discovery pages.
- [x] `JobPosting` JSON-LD only on a single published, non-expired vacancy with a usable application URL.
- [x] Original publication date, valid-through date, employment type, hiring organization, and Pakistan location represented from visible fields.
- [x] `TELECOMMUTE` and Pakistan applicant eligibility emitted only for jobs explicitly marked fully remote.
- [x] `baseSalary` emitted only when visible numeric salary and an administrator-confirmed period are both present.
- [x] `Organization` JSON-LD on reviewed company profiles.
- [x] Root sitemap index at `/sitemap.xml` with pages, jobs, categories, and cities child sitemaps.
- [x] Job sitemap contains only current canonical jobs with application destinations.
- [x] Category/city sitemaps and metadata require at least two current jobs, avoiding empty/thin index pages.
- [x] Filtered/search URLs are `noindex,follow` and canonicalize to their clean landing page.
- [x] Admin and API routes use both metadata/header noindex controls and robots crawl exclusions.
- [x] Expired, closed, rejected, draft, removed, and unpublished jobs return 404 from the public vacancy route and are absent from structured data/sitemaps.
- [x] A narrow server-side Proxy checks direct vacancy URLs before rendering, preserves permanent historical-slug redirects, and returns a genuine 404 for removed jobs.
- [x] Historical job slugs permanently redirect to the current canonical slug after an administrator changes title/company identity.
- [x] Job cards select only fields needed for list rendering; count and page queries run concurrently on the common pagination path.
- [x] Local uploaded logos use `next/image`; external logos have explicit dimensions, lazy loading, and async decoding.
- [x] The system font stack creates no render-blocking font download.
- [x] Automated representative tests cover onsite salary, remote location requirements, missing apply URL, canonical metadata, breadcrumbs, and sitemap XML.

## Before production launch

- [ ] Set the final production origin to `https://www.jobdraftly.com` and verify HTTPS/canonical redirects at the edge.
- [ ] Validate at least one real published vacancy with Google Rich Results Test.
- [ ] Submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- [ ] Configure Google Indexing API credentials only through a reviewed production secret process if rapid job update/removal notifications are desired.
- [ ] Verify uploaded employer logos meet Google’s job-logo aspect-ratio guidance before including them in JobPosting markup. JobDraftly currently omits them from JobPosting to avoid an unsupported claim.
- [ ] Run Lighthouse on homepage, `/jobs`, one job detail, and one company page using production-like data and hosting.
- [ ] Monitor Search Console Job posting enhancement reports after launch and after template changes.
- [ ] Confirm the secure daily expiration scheduler is running and inspect its audit records.

## Representative manual test

1. Publish a genuine onsite job with a verified external application URL, original publication date, deadline, location, and complete description.
2. Inspect page source and confirm one `JobPosting` and one `BreadcrumbList`; all structured values must be visible on the page.
3. Add genuine salary values and a period; confirm `baseSalary` appears. Remove the period; confirm it disappears.
4. Publish a genuinely fully remote job; confirm `jobLocationType: TELECOMMUTE` and Pakistan `applicantLocationRequirements`, with no invented physical location.
5. Change a test job’s title through the admin UI; confirm the old URL returns 308 to the new canonical URL.
6. Expire the job; confirm both old and current URLs stop exposing a live job, the current URL returns 404, and the job leaves `/sitemaps/jobs.xml`.
7. Confirm empty category/city pages have `noindex` and are absent from their sitemaps.

## Primary references

- [Google JobPosting structured data](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
- [Google robots meta and X-Robots-Tag specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Google robots.txt guide](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)

