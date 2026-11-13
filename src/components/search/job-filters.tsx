import Form from "next/form";
import { RotateCcw } from "lucide-react";
import Link from "next/link";

import type { JobSearchFilters } from "@/lib/validations/job-search";

import { SearchButton } from "./search-button";

type Option = { name: string; slug: string };
type ProvinceOption = Option & { cities: Option[] };

export const postedLabels = { "1": "Last 24 hours", "3": "Last 3 days", "7": "Last 7 days", "30": "Last 30 days" } as const;

const employmentOptions = [
  ["FULL_TIME", "Full-time"],
  ["PART_TIME", "Part-time"],
  ["CONTRACT", "Contract"],
  ["TEMPORARY", "Temporary"],
  ["INTERNSHIP", "Internship"],
  ["FREELANCE", "Freelance"],
] as const;

const experienceOptions = [
  ["ENTRY_LEVEL", "Entry level"],
  ["JUNIOR", "Junior"],
  ["MID_LEVEL", "Mid level"],
  ["SENIOR", "Senior"],
  ["LEAD", "Lead"],
  ["MANAGER", "Manager"],
  ["DIRECTOR", "Director"],
  ["EXECUTIVE", "Executive"],
] as const;

export function JobFilters({
  action,
  filters,
  categories,
  provinces,
  majorCities,
  lockCategory = false,
  lockCity = false,
  lockProvince = false,
  lockEmploymentType = false,
  lockWorkplaceType = false,
}: {
  action: string;
  filters: JobSearchFilters;
  categories: Option[];
  provinces: ProvinceOption[];
  majorCities: Option[];
  lockCategory?: boolean;
  lockCity?: boolean;
  lockProvince?: boolean;
  lockEmploymentType?: boolean;
  lockWorkplaceType?: boolean;
}) {
  const inputClass =
    "min-h-11 w-full rounded-md border border-line bg-white px-3 text-sm text-ink outline-none transition-colors placeholder:text-muted focus:border-brand";

  return (
    <aside className="rounded-lg border border-line bg-white p-5 lg:sticky lg:top-24">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink">
          Filters
        </h2>
        <Link
          className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          href={action}
        >
          <RotateCcw aria-hidden="true" className="size-3.5" />
          Clear all
        </Link>
      </div>

      <Form action={action} className="space-y-4">
        <Field label="Keywords">
          <input
            className={inputClass}
            defaultValue={filters.q}
            name="q"
            placeholder="Title, skill or keyword"
            type="search"
          />
        </Field>

        <Field label="Company">
          <input
            className={inputClass}
            defaultValue={filters.company}
            name="company"
            placeholder="Company name"
            type="search"
          />
        </Field>

        {!lockProvince && !lockCity ? (
          <Field label="Province">
            <select className={inputClass} defaultValue={filters.province} name="province">
              <option value="">All of Pakistan</option>
              {provinces.map((province) => (
                <option key={province.slug} value={province.slug}>
                  {province.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {!lockCity ? (
          <Field label="City">
            <select className={inputClass} defaultValue={filters.city} name="city">
              <option value="">All cities</option>
              {!lockProvince && majorCities.length ? (
                <optgroup label="Major cities">
                  {majorCities.map((city) => (
                    <option key={`major-${city.slug}`} value={city.slug}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
              {provinces.map((province) => (
                <optgroup key={province.slug} label={province.name}>
                  {province.cities.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        ) : null}

        {!lockCategory ? (
          <Field label="Category">
            <select
              className={inputClass}
              defaultValue={filters.category}
              name="category"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        {!lockEmploymentType ? (
          <Field label="Employment type">
            <select
              className={inputClass}
              defaultValue={filters.employmentType}
              name="employmentType"
            >
              <option value="">Any</option>
              {employmentOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}

        <Field label="Experience level">
          <select
            className={inputClass}
            defaultValue={filters.experienceLevel}
            name="experienceLevel"
          >
            <option value="">Any</option>
            {experienceOptions.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {!lockWorkplaceType ? (
          <Field label="Work arrangement">
            <select
              className={inputClass}
              defaultValue={filters.workplaceType}
              name="workplaceType"
            >
              <option value="">Any</option>
              <option value="ONSITE">On-site</option>
              <option value="HYBRID">Hybrid</option>
              <option value="REMOTE">Remote</option>
            </select>
          </Field>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Min salary (PKR)">
            <input
              className={inputClass}
              defaultValue={filters.salaryMin}
              min="0"
              name="salaryMin"
              placeholder="Any"
              step="1000"
              type="number"
            />
          </Field>
          <Field label="Max salary (PKR)">
            <input
              className={inputClass}
              defaultValue={filters.salaryMax}
              min="0"
              name="salaryMax"
              placeholder="Any"
              step="1000"
              type="number"
            />
          </Field>
        </div>

        <Field label="Date posted">
          <select className={inputClass} defaultValue={filters.postedWithin} name="posted">
            <option value="">Any time</option>
            {Object.entries(postedLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Sort by">
          <select className={inputClass} defaultValue={filters.sort} name="sort">
            <option value="relevance">Best match</option>
            <option value="newest">Newest first</option>
            <option value="deadline">Closing soon</option>
          </select>
        </Field>

        <div className="pt-1">
          <SearchButton className="w-full" label="Show results" />
        </div>
      </Form>
    </aside>
  );
}

function Field({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-body">{label}</span>
      {children}
    </label>
  );
}
