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
import { experienceLevelLabel, employmentTypeLabel, workplaceTypeLabel } from "@/lib/formatters";

import { FilterPanel } from "../search/filter-panel";
import { JobFilters, postedLabels } from "../search/job-filters";
import { ActiveFilters, type ActiveFilter } from "../search/active-filters";

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
  const options = await getSearchOptions();
  const parsed = parseJobSearchParams(searchParams);
  // Ignore slugs that don't exist (old or mistyped links) instead of showing zero jobs.
  const known = (items: { slug: string }[], slug: string) => (items.some((item) => item.slug === slug) ? slug : "");
  const filters = {
    ...parsed,
    province: known(options.provinces, parsed.province),
    city: known(options.cities, parsed.city),
    category: known(options.categories, parsed.category),
  };
  const results = await searchPublishedJobs(filters, fixed);
  // On a province page only that province's cities are offered.
  const provinces = fixed.provinceSlug
    ? options.provinces.filter((province) => province.slug === fixed.provinceSlug)
    : options.provinces;
  const nameOf = (items: { name: string; slug: string }[], slug: string) => items.find((item) => item.slug === slug)?.name ?? slug;
  const money = (value: number) => `PKR ${value.toLocaleString("en-PK")}`;
  const active: ActiveFilter[] = [
    filters.q ? { param: "q", label: `“${filters.q}”` } : null,
    filters.company ? { param: "company", label: `Company: ${filters.company}` } : null,
    filters.province && !fixed.provinceSlug ? { param: "province", label: nameOf(options.provinces, filters.province) } : null,
    filters.city && !fixed.citySlug ? { param: "city", label: nameOf(options.cities, filters.city) } : null,
    filters.category && !fixed.categorySlug ? { param: "category", label: nameOf(options.categories, filters.category) } : null,
    filters.employmentType && !fixed.employmentType ? { param: "employmentType", label: employmentTypeLabel(filters.employmentType) } : null,
    filters.experienceLevel ? { param: "experienceLevel", label: experienceLevelLabel(filters.experienceLevel) } : null,
    filters.workplaceType && !fixed.workplaceType ? { param: "workplaceType", label: workplaceTypeLabel(filters.workplaceType) } : null,
    filters.salaryMin !== undefined ? { param: "salaryMin", label: `From ${money(filters.salaryMin)}` } : null,
    filters.salaryMax !== undefined ? { param: "salaryMax", label: `Up to ${money(filters.salaryMax)}` } : null,
    filters.postedWithin ? { param: "posted", label: postedLabels[filters.postedWithin] } : null,
  ].filter((item): item is ActiveFilter => item !== null);
  const filterCount = active.filter((item) => item.param !== "q").length;

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
                filters={filters}
                lockCategory={Boolean(fixed.categorySlug)}
                lockCity={Boolean(fixed.citySlug)}
                lockProvince={Boolean(fixed.provinceSlug)}
                majorCities={options.majorCities}
                provinces={provinces}
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

              <ActiveFilters basePath={basePath} filters={active} params={serializableParams(searchParams)} />

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
