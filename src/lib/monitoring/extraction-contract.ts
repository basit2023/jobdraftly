import { z } from "zod";

const nullableText = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.string().trim().max(10_000).nullable().default(null),
);

const nullableUrl = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? null : value,
  z.url().refine((value) => ["http:", "https:"].includes(new URL(value).protocol)).nullable().default(null),
);

const nullableVacancyCount = z.preprocess(
  (value) => value === "" || value === undefined ? null : value,
  z.coerce.number().int().min(0).max(1_000_000).nullable().default(null),
);

/**
 * Canonical fields accepted from the external OCR/AI adapter. Missing and blank
 * values become null so the adapter cannot replace an unknown with prose.
 */
export const extractedVacancySchema = z.object({
  jobTitle: nullableText,
  department: nullableText,
  vacancyCount: nullableVacancyCount,
  education: nullableText,
  experience: nullableText,
  ageLimit: nullableText,
  bps: nullableText,
  location: nullableText,
  domicile: nullableText,
  quota: nullableText,
  applicationDeadline: nullableText,
  applicationUrl: nullableUrl,
}).strict();

export const canonicalExtractionSchema = z.object({
  announcementType: z.enum([
    "JOB",
    "CORRIGENDUM",
    "DEADLINE_EXTENSION",
    "CANCELLATION",
    "TEST_INTERVIEW",
    "RESULT_MERIT_LIST",
    "UNKNOWN",
  ]).default("UNKNOWN"),
  sourceLanguage: z.enum(["ENGLISH", "URDU", "MIXED", "UNKNOWN"]).default("UNKNOWN"),
  vacancies: z.array(extractedVacancySchema).max(100).default([]),
}).strict();

export type ExtractedVacancy = z.infer<typeof extractedVacancySchema>;
export type CanonicalExtraction = z.infer<typeof canonicalExtractionSchema>;

export const evaluatedExtractionFields = [
  "jobTitle",
  "department",
  "vacancyCount",
  "education",
  "experience",
  "ageLimit",
  "bps",
  "location",
  "domicile",
  "quota",
  "applicationDeadline",
  "applicationUrl",
] as const satisfies readonly (keyof ExtractedVacancy)[];

function comparable(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return String(value);
  return String(value)
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}

export function evaluateVacancyExtraction(expected: ExtractedVacancy, actual: ExtractedVacancy) {
  const fields = evaluatedExtractionFields.map((field) => {
    const expectedValue = comparable(expected[field]);
    const actualValue = comparable(actual[field]);
    return {
      field,
      correct: expectedValue === actualValue,
      expected: expectedValue,
      actual: actualValue,
      hallucinated: expectedValue === null && actualValue !== null,
    };
  });
  const correct = fields.filter((field) => field.correct).length;
  return {
    accuracy: correct / fields.length,
    correct,
    total: fields.length,
    hallucinations: fields.filter((field) => field.hallucinated).length,
    fields,
  };
}
