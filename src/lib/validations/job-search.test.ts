import { describe, expect, it } from "vitest";

import { parseJobSearchParams } from "./job-search";

describe("parseJobSearchParams", () => {
  it("parses a complete shareable filter set", () => {
    expect(
      parseJobSearchParams({
        q: "  software engineer  ",
        company: "Acme",
        city: "lahore",
        category: "engineering",
        employmentType: "FULL_TIME",
        experienceLevel: "MID_LEVEL",
        workplaceType: "HYBRID",
        salaryMin: "50000",
        salaryMax: "250000",
        sort: "newest",
        page: "3",
      }),
    ).toEqual({
      q: "software engineer",
      company: "Acme",
      province: "",
      city: "lahore",
      category: "engineering",
      employmentType: "FULL_TIME",
      experienceLevel: "MID_LEVEL",
      workplaceType: "HYBRID",
      salaryMin: 50000,
      salaryMax: 250000,
      postedWithin: "",
      sort: "newest",
      page: 3,
    });
  });

  it("uses safe defaults for invalid values", () => {
    const result = parseJobSearchParams({
      employmentType: "PERMANENT",
      experienceLevel: "EXPERT",
      workplaceType: "ANYWHERE",
      salaryMin: "-1",
      salaryMax: "not-a-number",
      sort: "oldest",
      page: "0",
    });

    expect(result).toMatchObject({
      employmentType: "",
      experienceLevel: "",
      workplaceType: "",
      salaryMin: undefined,
      salaryMax: undefined,
      sort: "relevance",
      page: 1,
    });
  });

  it("treats blank salary fields as unset and reads the first repeated value", () => {
    const result = parseJobSearchParams({
      q: ["designer", "ignored"],
      salaryMin: " ",
      salaryMax: "",
      page: ["2", "10"],
    });

    expect(result.q).toBe("designer");
    expect(result.salaryMin).toBeUndefined();
    expect(result.salaryMax).toBeUndefined();
    expect(result.page).toBe(2);
  });

  it("limits free-text values before they reach the database query", () => {
    const result = parseJobSearchParams({ q: "a".repeat(200) });

    expect(result.q).toHaveLength(120);
  });
});
