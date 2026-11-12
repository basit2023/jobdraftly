import { Container } from "@/components/ui/container";
import { SearchEvents } from "@/components/analytics/client-events";
import { Breadcrumbs } from "@/components/seo/breadcrumbs";
import {
  type FixedJobFilters,
  getSearchOptions,
  searchPublishedJobs,
} from "@/lib/services/public-jobs";
import {
  parseJobSearchParams,
  type RawSearchParams,
} from "@/lib/validations/job-search";

import { EmptyJobs } from "./empty-jobs";
import { JobCard } from "./job-card";
import { Pagination } from "./pagination";
import { FilterPanel } from "../search/filter-panel";
import { JobFilters } from "../search/job-filters";

function serializableParams(params: RawSearchParams): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}

export async function JobsIndex({
  title,
  description,
  searchParams,
  basePath = "/jobs",
  fixed = {},
  breadcrumbs = [],
  intro,
}: {
  title: string;
  description: string;
  searchParams: RawSearchParams;
  basePath?: string;
  fixed?: FixedJobFilters;
  breadcrumbs?: { name: string; href: string }[];
  intro?: string;
}) {
  const filters = parseJobSearchParams(searchParams);
  const [results, options] = await Promise.all([
    searchPublishedJobs(filters, fixed),
    getSearchOptions(),
  ]);
  const filterCount = [filters.company, filters.city, filters.category, filters.employmentType, filters.experienceLevel, filters.workplaceType, filters.salaryMin, filters.salaryMax]
    .filter((value) => value !== "" && value !== undefined).length;

  return (
    <>
      <SearchEvents
        categorySlug={filters.category || fixed.categorySlug}
        filterCount={filterCount}
        hasKeyword={Boolean(filters.q)}
        locationSlug={filters.city || fixed.citySlug || fixed.provinceSlug}
        path={basePath}
        resultCount={results.total}
      />
      <section className="border-b border-line bg-white pb-8 pt-6 sm:pb-10">
        <Container>
          {breadcrumbs.length ? <Breadcrumbs items={breadcrumbs} /> : null}
          <h1 className="mt-5 text-balance text-3xl font-bold text-ink sm:text-4xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-base leading-7 text-body">{description}</p>
        </Container>
      </section>

      <section className="py-8 sm:py-10">
        <Container>
          <div className="grid gap-6 lg:grid-cols-[272px_1fr] lg:gap-8">
            <FilterPanel activeCount={filterCount}>
              <JobFilters
                action={basePath}
                categories={options.categories}
                cities={options.cities}
                filters={filters}
                lockCategory={Boolean(fixed.categorySlug)}
                lockCity={Boolean(fixed.citySlug)}
                lockEmploymentType={Boolean(fixed.employmentType)}
                lockWorkplaceType={Boolean(fixed.workplaceType)}
              />
            </FilterPanel>

            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <p aria-live="polite" className="text-sm text-body">
                  <span className="font-semibold text-ink">{results.total.toLocaleString("en-PK")}</span>{" "}
                  {results.total === 1 ? "job" : "jobs"}
                  {filters.q ? <> for &ldquo;{filters.q}&rdquo;</> : null}
                </p>
                {results.totalPages > 1 ? (
                  <p className="text-xs text-muted">
                    Page {results.page} of {results.totalPages}
                  </p>
                ) : null}
              </div>

              {results.jobs.length ? (
                <div className="grid gap-3 xl:grid-cols-2">
                  {results.jobs.map((job) => (
                    <JobCard job={job} key={job.id} />
                  ))}
                </div>
              ) : (
                <EmptyJobs />
              )}

              <Pagination
                basePath={basePath}
                page={results.page}
                params={serializableParams(searchParams)}
                totalPages={results.totalPages}
              />

              {intro ? (
                <aside className="mt-12 max-w-3xl border-t border-line pt-6 text-sm leading-7 text-body">
                  {intro}
                </aside>
              ) : null}
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
