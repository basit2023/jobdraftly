import { z } from "zod";

export const importFields = [
  "title",
  "company",
  "description",
  "city",
  "category",
  "employmentType",
  "experienceLevel",
  "salary",
  "sourceUrl",
  "applicationUrl",
  "publicationDate",
  "deadline",
  "sourceExternalId",
] as const;

export type ImportField = (typeof importFields)[number];
export type ColumnMapping = Partial<Record<ImportField, string>>;

export const requiredImportFields = [
  "title",
  "company",
  "description",
  "city",
  "category",
  "sourceUrl",
  "applicationUrl",
] as const satisfies readonly ImportField[];

export const importFieldLabels: Record<ImportField, string> = {
  title: "Job title",
  company: "Company",
  description: "Description",
  city: "City",
  category: "Category",
  employmentType: "Employment type",
  experienceLevel: "Experience level",
  salary: "Salary",
  sourceUrl: "Source URL",
  applicationUrl: "Application URL",
  publicationDate: "Publication date",
  deadline: "Deadline",
  sourceExternalId: "Source job identifier",
};

const aliases: Record<ImportField, string[]> = {
  title: ["title", "job title", "position"],
  company: ["company", "company name", "employer"],
  description: ["description", "job description", "details"],
  city: ["city", "location", "job location"],
  category: ["category", "job category", "department"],
  employmentType: ["employment type", "employment_type", "job type", "type"],
  experienceLevel: ["experience level", "experience_level", "experience"],
  salary: ["salary", "salary range", "compensation"],
  sourceUrl: ["source url", "source_url", "original url", "job url"],
  applicationUrl: ["application url", "application_url", "apply url", "apply link"],
  publicationDate: ["publication date", "publication_date", "published at", "published"],
  deadline: ["deadline", "application deadline", "application_deadline", "closing date"],
  sourceExternalId: ["source job id", "source_job_id", "external id", "external_id", "id"],
};

function normalizeHeader(value: string) {
  return value.trim().toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, " ").trim();
}

export function guessColumnMapping(headers: string[]): ColumnMapping {
  const normalized = new Map(headers.map((header) => [normalizeHeader(header), header]));
  return Object.fromEntries(
    importFields.flatMap((field) => {
      const match = aliases[field].map(normalizeHeader).find((alias) => normalized.has(alias));
      return match ? [[field, normalized.get(match)!]] : [];
    }),
  );
}

export const columnMappingSchema = z.object(
  Object.fromEntries(importFields.map((field) => [field, z.string().trim().max(191).optional()])) as Record<ImportField, z.ZodOptional<z.ZodString>>,
).superRefine((mapping, context) => {
  for (const field of requiredImportFields) {
    if (!mapping[field]) context.addIssue({ code: "custom", path: [field], message: `${importFieldLabels[field]} must be mapped` });
  }
  const selected = Object.values(mapping).filter(Boolean);
  if (new Set(selected).size !== selected.length) {
    context.addIssue({ code: "custom", message: "Each CSV column can only be mapped once" });
  }
});

