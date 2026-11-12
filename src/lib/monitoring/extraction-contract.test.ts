import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  canonicalExtractionSchema,
  evaluateVacancyExtraction,
  extractedVacancySchema,
} from "./extraction-contract";

type DatasetCase = { id: string; expected: Record<string, unknown> };
const dataset = JSON.parse(readFileSync("tests/fixtures/ai-extraction/dataset.json", "utf8")) as DatasetCase[];

describe("AI extraction contract and evaluation", () => {
  it("validates every expected dataset record and represents unknown fields as null", () => {
    expect(dataset).toHaveLength(8);
    for (const testCase of dataset) {
      const parsed = extractedVacancySchema.parse(testCase.expected);
      expect(Object.values(parsed).some((value) => value === undefined), testCase.id).toBe(false);
    }
  });

  it("normalizes missing and blank fields to null", () => {
    const parsed = extractedVacancySchema.parse({
      jobTitle: "QA Analyst",
      department: "",
    });
    expect(parsed.department).toBeNull();
    expect(parsed.applicationUrl).toBeNull();
    expect(parsed.vacancyCount).toBeNull();
  });

  it("rejects invented extra fields and non-http application URLs", () => {
    expect(extractedVacancySchema.safeParse({ jobTitle: "QA", inventedSalary: "100000" }).success).toBe(false);
    expect(extractedVacancySchema.safeParse({ jobTitle: "QA", applicationUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("penalizes hallucinated values for fields that are unknown in the advert", () => {
    const expected = extractedVacancySchema.parse(dataset.find((item) => item.id === "low-quality-image")!.expected);
    const actual = extractedVacancySchema.parse({ ...expected, ageLimit: "18-25", quota: "Punjab" });
    const result = evaluateVacancyExtraction(expected, actual);
    expect(result.hallucinations).toBe(2);
    expect(result.correct).toBe(10);
    expect(result.total).toBe(12);
  });

  it("supports multiple vacancies without merging them into one record", () => {
    const first = extractedVacancySchema.parse(dataset.find((item) => item.id === "multiple-vacancies")!.expected);
    const parsed = canonicalExtractionSchema.parse({
      announcementType: "JOB",
      sourceLanguage: "ENGLISH",
      vacancies: [first, { jobTitle: "Office Assistant", vacancyCount: 1, education: "BA", location: "Faisalabad", applicationDeadline: "2026-12-22" }],
    });
    expect(parsed.vacancies).toHaveLength(2);
    expect(parsed.vacancies[1]?.jobTitle).toBe("Office Assistant");
  });
});
