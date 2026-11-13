import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { notFound } from "next/navigation";

import { CompanyLogo } from "@/components/companies/company-logo";
import { EmptyJobs } from "@/components/jobs/empty-jobs";
import { JobCard } from "@/components/jobs/job-card";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { Container } from "@/components/ui/container";
import { getPublicCompanyBySlug } from "@/lib/services/public-jobs";
import { pageMetadata } from "@/lib/seo/site";
import { buildBreadcrumbList, buildOrganization } from "@/lib/seo/structured-data";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function publicWebsite(value: string | null): string | null {
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
  const company = await getPublicCompanyBySlug(slug);
  // Resolve 404s here: metadata runs before streaming, so the response gets a real 404 status.
  if (!company) notFound();

  return pageMetadata({
    title: `${company.name} Jobs`,
    description: `Current job openings at ${company.name} in Pakistan, with direct links to apply.`,
    path: `/companies/${company.slug}`,
    index: Boolean(company.jobs.length || company.description),
  });
}

export default async function CompanyPage({ params }: Props) {
  const { slug } = await params;
  const company = await getPublicCompanyBySlug(slug);
  if (!company) notFound();

  const website = publicWebsite(company.websiteUrl);
  const breadcrumbs = [{ name: "Home", path: "/" }, { name: "Companies", path: "/companies" }, { name: company.name, path: `/companies/${company.slug}` }];

  return (
    <>
      <JsonLd data={buildOrganization(company)} />
      <JsonLd data={buildBreadcrumbList(breadcrumbs)} />
      <section className="border-b border-line bg-white pb-8 pt-6 sm:pb-10">
        <Container>
          <Breadcrumbs items={breadcrumbs.map((item) => ({ name: item.name, href: item.path }))} />
          <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
            <CompanyLogo logoUrl={company.logoUrl} name={company.name} priority size="lg" />
            <div className="min-w-0 flex-1">
              <h1 className="text-3xl font-bold text-ink sm:text-4xl">{company.name}</h1>
              <p className="mt-1.5 text-base text-body">
                {company.industry ? `${company.industry} · ` : ""}
                {company.jobs.length} open {company.jobs.length === 1 ? "role" : "roles"}
              </p>
            </div>
            {website ? (
              <a
                className="inline-flex items-center justify-center gap-2 self-start rounded-md border border-line px-4 py-2.5 text-sm font-medium text-ink hover:border-ink/30 sm:self-center"
                href={website}
                rel="nofollow noopener noreferrer"
                target="_blank"
              >
                Visit website
                <ExternalLink aria-hidden="true" className="size-4" />
              </a>
            ) : null}
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-14">
        <Container>
          {company.description ? (
            <div className="mb-14 max-w-3xl">
              <h2 className="text-xl font-bold text-ink">About {company.name}</h2>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-7 text-body">
                {company.description}
              </p>
            </div>
          ) : null}

          <h2 className="text-2xl font-bold text-ink">Open roles</h2>
          <div className="mt-5">
            {company.jobs.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {company.jobs.map((job) => (
                  <JobCard job={job} key={job.id} />
                ))}
              </div>
            ) : (
              <EmptyJobs
                description={`${company.name} isn't advertising any roles on JobDraftly right now.`}
                showReset={false}
                title="No open roles at the moment"
              />
            )}
          </div>
        </Container>
      </section>
    </>
  );
}
