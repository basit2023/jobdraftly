import { z } from "zod";

import type { ColumnMapping } from "./fields";
import type { RawImportRow } from "./csv";

const httpUrl = z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol));

type NormalizedEmploymentType = "FULL_TIME" | "PART_TIME" | "CONTRACT" | "TEMPORARY" | "INTERNSHIP" | "FREELANCE" | "OTHER";
type NormalizedExperienceLevel = "NOT_SPECIFIED" | "ENTRY_LEVEL" | "JUNIOR" | "MID_LEVEL" | "SENIOR" | "LEAD" | "MANAGER" | "DIRECTOR" | "EXECUTIVE";

const employmentTypes = new Map<string, NormalizedEmploymentType>([
  ["full time", "FULL_TIME"], ["fulltime", "FULL_TIME"], ["part time", "PART_TIME"],
  ["contract", "CONTRACT"], ["temporary", "TEMPORARY"], ["internship", "INTERNSHIP"],
  ["freelance", "FREELANCE"], ["other", "OTHER"],
] as const);

const experienceLevels = new Map<string, NormalizedExperienceLevel>([
  ["not specified", "NOT_SPECIFIED"], ["entry level", "ENTRY_LEVEL"], ["entry", "ENTRY_LEVEL"],
  ["junior", "JUNIOR"], ["mid level", "MID_LEVEL"], ["mid", "MID_LEVEL"], ["senior", "SENIOR"],
  ["lead", "LEAD"], ["manager", "MANAGER"], ["director", "DIRECTOR"], ["executive", "EXECUTIVE"],
] as const);

function key(value: string) {
  return value.trim().toLocaleLowerCase("en").replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function optionalDate(value: string | undefined, label: string, errors: string[]) {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? `${trimmed}T23:59:59.999+05:00` : trimmed);
  if (Number.isNaN(date.getTime())) {
    errors.push(`${label} is not a valid date.`);
    return null;
  }
  return date.toISOString();
}

function parseSalary(value: string | undefined) {
  if (!value?.trim()) return { salaryMin: null, salaryMax: null, salaryVisibility: "HIDDEN" as const };
  const numbers = value.match(/\d[\d,]*(?:\.\d+)?/g)?.map((number) => Number(number.replaceAll(",", ""))) ?? [];
  if (!numbers.length || numbers.some((number) => !Number.isFinite(number))) {
    return { salaryMin: null, salaryMax: null, salaryVisibility: "NEGOTIABLE" as const };
  }
  return {
    salaryMin: numbers[0],
    salaryMax: numbers[1] ?? numbers[0],
    salaryVisibility: numbers.length > 1 ? "RANGE" as const : "EXACT" as const,
  };
}

export type NormalizedImportRow = {
  title: string;
  company: string;
  description: string;
  city: string;
  category: string;
  employmentType: NormalizedEmploymentType;
  experienceLevel: NormalizedExperienceLevel;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryVisibility: "HIDDEN" | "NEGOTIABLE" | "RANGE" | "EXACT";
  sourceUrl: string;
  applicationUrl: string;
  publicationDate: string | null;
  deadline: string | null;
  sourceExternalId: string | null;
};

export function normalizeImportRow(raw: RawImportRow, mapping: ColumnMapping) {
  const read = (field: keyof ColumnMapping) => mapping[field] ? raw[mapping[field]!]?.trim() : undefined;
  const errors: string[] = [];
  const required = (field: keyof ColumnMapping, label: string) => {
    const value = read(field);
    if (!value) errors.push(`${label} is required.`);
    return value ?? "";
  };
  const sourceUrl = required("sourceUrl", "Source URL");
  const applicationUrl = required("applicationUrl", "Application URL");
  if (sourceUrl && !httpUrl.safeParse(sourceUrl).success) errors.push("Source URL must be an HTTP or HTTPS URL.");
  if (applicationUrl && !httpUrl.safeParse(applicationUrl).success) errors.push("Application URL must be an HTTP or HTTPS URL.");
  const employmentValue = read("employmentType");
  const experienceValue = read("experienceLevel");
  const employmentType = employmentValue ? employmentTypes.get(key(employmentValue)) : "OTHER";
  const experienceLevel = experienceValue ? experienceLevels.get(key(experienceValue)) : "NOT_SPECIFIED";
  if (employmentValue && !employmentType) errors.push(`Unsupported employment type: ${employmentValue}.`);
  if (experienceValue && !experienceLevel) errors.push(`Unsupported experience level: ${experienceValue}.`);
  const publicationDate = optionalDate(read("publicationDate"), "Publication date", errors);
  const deadline = optionalDate(read("deadline"), "Deadline", errors);
  if (publicationDate && deadline && new Date(deadline) < new Date(publicationDate)) errors.push("Deadline cannot be before publication date.");
  const data: NormalizedImportRow = {
    title: required("title", "Job title").slice(0, 191),
    company: required("company", "Company").slice(0, 191),
    description: required("description", "Description"),
    city: required("city", "City").slice(0, 120),
    category: required("category", "Category").slice(0, 120),
    employmentType: employmentType ?? "OTHER",
    experienceLevel: experienceLevel ?? "NOT_SPECIFIED",
    ...parseSalary(read("salary")),
    sourceUrl,
    applicationUrl,
    publicationDate,
    deadline,
    sourceExternalId: read("sourceExternalId")?.slice(0, 191) || null,
  };
  if (data.title.length < 3) errors.push("Job title must contain at least 3 characters.");
  if (data.description.length < 20) errors.push("Description must contain at least 20 characters.");
  return { data, errors };
}

