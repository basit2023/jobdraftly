import { z } from "zod";

const employmentTypes = [
  "FULL_TIME",
  "PART_TIME",
  "CONTRACT",
  "TEMPORARY",
  "INTERNSHIP",
  "FREELANCE",
  "OTHER",
] as const;

const experienceLevels = [
  "NOT_SPECIFIED",
  "ENTRY_LEVEL",
  "JUNIOR",
  "MID_LEVEL",
  "SENIOR",
  "LEAD",
  "MANAGER",
  "DIRECTOR",
  "EXECUTIVE",
] as const;

const workplaceTypes = ["ONSITE", "HYBRID", "REMOTE"] as const;

export type RawSearchParams = Record<
  string,
  string | string[] | undefined
>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function text(value: string | string[] | undefined, max = 120): string {
  return first(value)?.trim().slice(0, max) ?? "";
}

function enumValue<T extends readonly [string, ...string[]]>(
  values: T,
  value: string | string[] | undefined,
): T[number] | "" {
  const result = z.enum(values).safeParse(first(value));
  return result.success ? result.data : "";
}

function optionalMoney(value: string | string[] | undefined): number | undefined {
  const raw = first(value)?.trim();

  if (!raw) {
    return undefined;
  }

  const result = z.coerce.number().min(0).max(100_000_000).safeParse(raw);
  return result.success ? result.data : undefined;
}

export function parseJobSearchParams(params: RawSearchParams) {
  const pageResult = z.coerce.number().int().min(1).max(10_000).safeParse(first(params.page));

  return {
    q: text(params.q),
    company: text(params.company),
    city: text(params.city, 191),
    category: text(params.category, 191),
    employmentType: enumValue(employmentTypes, params.employmentType),
    experienceLevel: enumValue(experienceLevels, params.experienceLevel),
    workplaceType: enumValue(workplaceTypes, params.workplaceType),
    salaryMin: optionalMoney(params.salaryMin),
    salaryMax: optionalMoney(params.salaryMax),
    sort: first(params.sort) === "newest" ? "newest" : "relevance",
    page: pageResult.success ? pageResult.data : 1,
  } as const;
}

export type JobSearchFilters = ReturnType<typeof parseJobSearchParams>;
