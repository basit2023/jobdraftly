import type { Metadata } from "next";
import { ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import { CompanyLogo } from "@/components/companies/company-logo";
import { JobViewEvent } from "@/components/analytics/client-events";
import { TrackedApplicationLink } from "@/components/analytics/tracked-application-link";
import { JobCard } from "@/components/jobs/job-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import {
  employmentTypeLabel,
  experienceLevelLabel,
  formatDate,
  formatSalary,
  splitList,
  workplaceTypeLabel,
} from "@/lib/formatters";
import {
  getPublishedJobBySlug,
  getPublishedJobRedirect,
  getRelatedPublishedJobs,
} from "@/lib/services/public-jobs";
import { pageMetadata } from "@/lib/seo/site";
import { buildBreadcrumbList, buildJobPosting } from "@/lib/seo/structured-data";
import { ApplyForm } from "@/components/jobs/apply-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function trustedHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const job = await getPublishedJobBySlug(slug);

  if (!job) {
    const redirect = await getPublishedJobRedirect(slug);
    if (redirect) permanentRedirect(`/jobs/${redirect.job.slug}`);
    notFound();
  }
  return pageMetadata({
    title: `${job.title} at ${job.company.name}`,
    description: `${job.title} at ${job.company.name} in ${job.location.name}. ${job.description}`,
    path: `/jobs/${job.slug}`,
    type: "article",
    image: trustedHttpUrl(job.imageUrl),
  });
}

export default async function JobDetailPage({ params }: Props) {
  const { slug } = await params;
  const job = await getPublishedJobBySlug(slug);
  if (!job) {
    const redirect = await getPublishedJobRedirect(slug);
    if (redirect) permanentRedirect(`/jobs/${redirect.job.slug}`);
    notFound();
  }
  const relatedJobs = await getRelatedPublishedJobs(job.id, job.categoryId, job.locationId);

  const salary = formatSalary(job);
  const applicationUrl = trustedHttpUrl(job.applicationUrl);
  const sourceUrl = trustedHttpUrl(job.sourceUrl);
  const skills = splitList(job.skills);
  const breadcrumbs = [
    { name: "Home", path: "/" },
    { name: "Jobs", path: "/jobs" },
    { name: job.category.name, path: `/jobs/category/${job.category.slug}` },
    { name: job.title, path: `/jobs/${job.slug}` },
  ];

  const facts = [
    { label: "Location", value: job.location.name },
    ...(job.workplaceStreetAddress || job.workplacePostalCode ? [{ label: "Workplace address", value: [job.workplaceStreetAddress, job.workplacePostalCode].filter(Boolean).join(", ") }] : []),
    { label: "Job type", value: employmentTypeLabel(job.employmentType) },
    { label: "Work arrangement", value: workplaceTypeLabel(job.workplaceType) },
    { label: "Experience", value: experienceLevelLabel(job.experienceLevel) },
    ...(salary ? [{ label: "Salary", value: salary }] : []),
    ...(job.education ? [{ label: "Education", value: job.education }] : []),
  ];
  const postedOn = formatDate(job.originalPublishedAt ?? job.publishedAt);
  const deadline = formatDate(job.applicationDeadline);
  const validThrough = !job.applicationDeadline ? formatDate(job.expiresAt) : null;
  const sourceName = job.source?.attributionText ?? job.source?.name ?? null;

  return (
    <>
      <JobViewEvent jobId={job.id} slug={job.slug} />
      <JsonLd data={buildJobPosting(job)} />
      <JsonLd data={buildBreadcrumbList(breadcrumbs)} />

      <section className="border-b border-line bg-white pb-8 pt-6 sm:pb-10">
        <Container>
          <Breadcrumbs items={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))} />

          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-start">
            <CompanyLogo logoUrl={job.company.logoUrl} name={job.company.name} priority size="md" />
            <div className="min-w-0 flex-1">
              <h1 className="text-balance text-3xl font-bold leading-tight text-ink sm:text-4xl">
                {job.title}
              </h1>
              <p className="mt-2 text-base text-body">
                <Link
                  className="font-medium text-ink underline-offset-4 hover:underline"
                  href={`/companies/${job.company.slug}`}
                >
                  {job.company.name}
                </Link>
                <span aria-hidden="true" className="mx-2 text-line">|</span>
                {job.location.name}
                {postedOn ? (
                  <>
                    <span aria-hidden="true" className="mx-2 text-line">|</span>
                    Posted {postedOn}
                  </>
                ) : null}
              </p>
              {job.isFeatured ? (
                <span className="mt-3 inline-block rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                  Featured
                </span>
              ) : null}
            </div>
          </div>

          {/* On mobile the sidebar sits below a long description, so show Apply up top. */}
          {applicationUrl ? (
            <div className="mt-6 lg:hidden">
              <TrackedApplicationLink href={applicationUrl} jobId={job.id} slug={job.slug} />
            </div>
          ) : null}
        </Container>
      </section>

      <section className="py-8 sm:py-12">
        <Container>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
            <article className="min-w-0">
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3">
                {facts.map((fact) => (
                  <div className="bg-white p-4" key={fact.label}>
                    <dt className="text-xs text-muted">{fact.label}</dt>
                    <dd className="mt-1 text-sm font-medium text-ink">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <ContentSection title="About the role">
                <p className="whitespace-pre-line">{job.description}</p>
              </ContentSection>

              {trustedHttpUrl(job.imageUrl) ? (
                <figure className="mt-10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary image with unknown dimensions */}
                  <img
                    alt={`Original advert for ${job.title} at ${job.company.name}`}
                    className="w-full rounded-lg border border-line bg-white"
                    decoding="async"
                    loading="lazy"
                    src={trustedHttpUrl(job.imageUrl)!}
                  />
                  <figcaption className="mt-2 text-xs text-muted">Original advert</figcaption>
                </figure>
              ) : null}

              {job.responsibilities ? (
                <ContentSection title="What you'll do">
                  <p className="whitespace-pre-line">{job.responsibilities}</p>
                </ContentSection>
              ) : null}

              {job.requirements ? (
                <ContentSection title="What they're looking for">
                  <p className="whitespace-pre-line">{job.requirements}</p>
                </ContentSection>
              ) : null}

              {skills.length ? (
                <ContentSection title="Skills">
                  <ul className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <li
                        className="rounded border border-line bg-white px-2.5 py-1 text-sm text-body"
                        key={skill}
                      >
                        {skill}
                      </li>
                    ))}
                  </ul>
                </ContentSection>
              ) : null}

              {sourceName || sourceUrl ? (
                <p className="mt-10 border-t border-line pt-5 text-sm text-muted">
                  Source: {sourceName ?? "Original listing"}
                  {sourceUrl ? (
                    <>
                      {" · "}
                      <a
                        className="inline-flex items-center gap-1 text-body underline underline-offset-2 hover:text-ink"
                        href={sourceUrl}
                        rel="nofollow noopener noreferrer"
                        target="_blank"
                      >
                        View original listing
                        <ExternalLink aria-hidden="true" className="size-3.5" />
                      </a>
                    </>
                  ) : null}
                </p>
              ) : null}
            </article>

            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-lg border border-line bg-white p-5">
                {job.applicationMethod === "ON_SITE" ? (
                  <ApplyForm companyName={job.company.name} jobId={job.id} jobTitle={job.title} />
                ) : applicationUrl ? (
                  <TrackedApplicationLink href={applicationUrl} jobId={job.id} slug={job.slug} />
                ) : (
                  <p className="rounded-md bg-amber-50 p-3 text-sm leading-6 text-amber-900">
                    This listing doesn&apos;t include an application link. Check the
                    original listing or the employer&apos;s website.
                  </p>
                )}

                {sourceUrl && sourceUrl !== applicationUrl ? (
                  <a
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-line px-4 text-sm font-medium text-ink hover:border-ink/30"
                    href={sourceUrl}
                    rel="nofollow noopener noreferrer"
                    target="_blank"
                  >
                    View original advert
                    <ExternalLink aria-hidden="true" className="size-4" />
                  </a>
                ) : null}
                {sourceUrl ? (
                  <p className="mt-2 text-center text-xs text-muted">
                    Posted on {new URL(sourceUrl).hostname.replace(/^www\./, "")}
                    {sourceName ? ` · ${sourceName}` : ""}
                  </p>
                ) : null}

                <dl className="mt-5 space-y-3 text-sm">
                  <OverviewRow label="Apply by" value={deadline ?? "Not specified"} />
                  {validThrough ? <OverviewRow label="Listing open until" value={validThrough} /> : null}
                  <OverviewRow label="Category" value={job.category.name} />
                </dl>

                <p className="mt-5 flex gap-2 border-t border-line pt-4 text-xs leading-5 text-muted">
                  <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
                  Never pay a fee to apply for a job. If you&apos;re asked to, please let us know.
                </p>
              </div>

              <nav aria-label="More jobs like this" className="rounded-lg border border-line bg-white p-5">
                <h2 className="text-sm font-semibold text-ink">More like this</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>
                    <Link className="text-body hover:text-brand" href={`/companies/${job.company.slug}`}>
                      All jobs at {job.company.name}
                    </Link>
                  </li>
                  <li>
                    <Link className="text-body hover:text-brand" href={`/jobs/category/${job.category.slug}`}>
                      {job.category.name} jobs
                    </Link>
                  </li>
                  <li>
                    <Link
                      className="text-body hover:text-brand"
                      href={`/jobs/${job.location.type === "PROVINCE" ? "province" : "city"}/${job.location.slug}`}
                    >
                      Jobs in {job.location.name}
                    </Link>
                  </li>
                  {job.location.type === "CITY" && job.location.province ? (
                    <li>
                      <Link
                        className="text-body hover:text-brand"
                        href={`/jobs/province/${job.location.province.slug}`}
                      >
                        Jobs in {job.location.province.name}
                      </Link>
                    </li>
                  ) : null}
                </ul>
              </nav>
            </aside>
          </div>

          {relatedJobs.length ? (
            <section aria-labelledby="related-jobs-heading" className="mt-16">
              <h2 className="text-2xl font-bold text-ink" id="related-jobs-heading">
                Similar jobs
              </h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {relatedJobs.map((relatedJob) => (
                  <JobCard job={relatedJob} key={relatedJob.id} />
                ))}
              </div>
            </section>
          ) : null}
        </Container>
      </section>
    </>
  );
}

function ContentSection({
  title,
  children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold text-ink">{title}</h2>
      <div className="mt-3 text-[15px] leading-7 text-body">{children}</div>
    </section>
  );
}

function OverviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
