import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/companies/company-logo";
import { EmptyJobs } from "@/components/jobs/empty-jobs";
import { JobCard } from "@/components/jobs/job-card";
import { HeroSearch } from "@/components/search/hero-search";
import { Container } from "@/components/ui/container";
import { SectionHeading } from "@/components/ui/section-heading";
import { JsonLd } from "@/components/seo/json-ld";
import { pageMetadata } from "@/lib/seo/site";
import { buildWebsite } from "@/lib/seo/structured-data";
import { getHomepageData } from "@/lib/services/public-jobs";

export const dynamic = "force-dynamic";

export const metadata = pageMetadata({
  title: "JobDraftly – Find Jobs in Pakistan",
  absoluteTitle: true,
  description:
    "Latest jobs in Pakistan: government, private, remote and internship vacancies in Karachi, Lahore, Islamabad and more. Apply directly with the employer.",
  path: "/",
});

const tips = [
  {
    title: "Write your CV for the job, not for every job",
    description:
      "Put the experience that matches the advert first. Recruiters usually decide in under a minute whether to keep reading.",
  },
  {
    title: "Prepare three stories before any interview",
    description:
      "Pick a problem you solved, a time you worked under pressure and a result you're proud of. Most questions lead back to one of them.",
  },
  {
    title: "Never pay to apply",
    description:
      "Real employers don't charge application or training fees. If a listing asks for money, stop and report it to us.",
  },
] as const;

function jobCount(count: number): string {
  return `${count.toLocaleString("en-PK")} ${count === 1 ? "job" : "jobs"}`;
}

export default async function HomePage() {
  const data = await getHomepageData();
  const quickCities = data.cities.slice(0, 5);

  return (
    <>
      <JsonLd data={buildWebsite()} />
      {/* Hero */}
      <section className="border-b border-line bg-white">
        <Container className="py-14 sm:py-20">
          <div className="max-w-3xl">
            <h1 className="text-balance text-4xl font-bold leading-[1.1] text-ink sm:text-5xl">
              Find your next job in Pakistan
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-body">
              Openings from private companies and government departments, with a
              direct link to apply on the employer&apos;s own site.
            </p>
          </div>

          <div className="mt-8 max-w-4xl">
            <HeroSearch cities={data.cities} />
            {quickCities.length ? (
              <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-body">
                <span className="text-muted">Popular:</span>
                {quickCities.map((city) => (
                  <Link
                    className="underline-offset-4 hover:text-ink hover:underline"
                    href={`/jobs/city/${city.slug}`}
                    key={city.id}
                  >
                    Jobs in {city.name}
                  </Link>
                ))}
                <Link
                  className="underline-offset-4 hover:text-ink hover:underline"
                  href="/jobs/remote"
                >
                  Remote
                </Link>
              </p>
            ) : null}
          </div>
        </Container>
      </section>

      {/* Latest jobs */}
      <section className="py-14 sm:py-16">
        <Container>
          <SectionHeading
            link={{ href: "/jobs?sort=newest", label: "See all jobs" }}
            title="Latest jobs"
          />
          {data.latestJobs.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.latestJobs.map((job) => (
                <JobCard job={job} key={job.id} />
              ))}
            </div>
          ) : (
            <EmptyJobs
              description="New listings will appear here as soon as they're posted. In the meantime, try browsing by category or city."
              showReset={false}
              title="No jobs listed yet"
            />
          )}
        </Container>
      </section>

      {/* Featured jobs — only shown when there are some */}
      {data.featuredJobs.length ? (
        <section className="border-y border-line bg-white py-14 sm:py-16">
          <Container>
            <SectionHeading
              description="Selected openings from employers hiring now."
              link={{ href: "/jobs", label: "Browse all" }}
              title="Featured jobs"
            />
            <div className="grid gap-3 md:grid-cols-2">
              {data.featuredJobs.map((job) => (
                <JobCard job={job} key={job.id} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Categories and cities */}
      <section className="py-14 sm:py-16">
        <Container>
          <div className="grid gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-16">
            {data.categories.length ? (
              <div>
                <SectionHeading title="Browse by category" />
                <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-8">
                  {data.categories.map((category) => (
                    <li className="border-b border-line" key={category.id}>
                      <Link
                        className="group flex items-center justify-between gap-4 py-3.5 text-[15px]"
                        href={`/jobs/category/${category.slug}`}
                      >
                        <span className="font-medium text-ink group-hover:text-brand">
                          {category.name}
                        </span>
                        <span className="shrink-0 text-sm text-muted">
                          {jobCount(category._count.jobs)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {data.cities.length ? (
              <div>
                <SectionHeading title="Jobs by city" />
                <ul className="border-t border-line">
                  {data.cities.map((city) => (
                    <li className="border-b border-line" key={city.id}>
                      <Link
                        className="group flex items-center justify-between gap-4 py-3.5 text-[15px]"
                        href={`/jobs/city/${city.slug}`}
                      >
                        <span className="font-medium text-ink group-hover:text-brand">
                          {city.name}
                        </span>
                        <span className="shrink-0 text-sm text-muted">
                          {jobCount(city._count.jobs)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Container>
      </section>

      {/* Companies — only shown when there are some */}
      {data.featuredCompanies.length ? (
        <section className="border-y border-line bg-white py-14 sm:py-16">
          <Container>
            <SectionHeading
              link={{ href: "/companies", label: "All companies" }}
              title="Companies hiring now"
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {data.featuredCompanies.map((company) => (
                <Link
                  className="flex items-center gap-4 rounded-lg border border-line bg-white p-4 transition-colors hover:border-ink/25"
                  href={`/companies/${company.slug}`}
                  key={company.id}
                >
                  <CompanyLogo logoUrl={company.logoUrl} name={company.name} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {company.name}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {company._count.jobs} open {company._count.jobs === 1 ? "role" : "roles"}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Tips */}
      <section className="py-14 sm:py-16" id="tips">
        <Container>
          <SectionHeading title="Job search tips" />
          <ol className="grid gap-8 md:grid-cols-3">
            {tips.map(({ title, description }, index) => (
              <li className="border-t-2 border-ink pt-5" key={title}>
                <p className="font-display text-sm font-bold text-muted">0{index + 1}</p>
                <h3 className="mt-2 text-lg font-semibold leading-snug text-ink">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-body">{description}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Employers */}
      <section className="pb-16 sm:pb-20">
        <Container>
          <div className="flex flex-col gap-6 rounded-lg bg-ink px-6 py-10 text-white sm:px-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold sm:text-[28px]">Hiring in Pakistan?</h2>
              <p className="mt-2 text-[15px] leading-7 text-white/70">
                Send us your vacancy and we&apos;ll list it with a direct link to your
                own application page.
              </p>
            </div>
            <Link
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-ink transition-colors hover:bg-brand-tint"
              href="/contact?topic=employer"
            >
              Post a job
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </Container>
      </section>
    </>
  );
}
