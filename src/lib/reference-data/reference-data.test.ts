import { describe, expect, it } from "vitest";

import { parseJobSearchParams } from "@/lib/validations/job-search";

import { JOB_CATEGORIES, MAJOR_CITY_SLUGS, PROVINCES, majorCityRank } from "./locations";

describe("reference data", () => {
  const cities = PROVINCES.flatMap((province) => province.cities.map(([name, slug]) => ({ name, slug, province: province.name })));
  const slugs = [...cities.map((city) => city.slug), ...PROVINCES.map((province) => province.slug)];

  it("covers all provinces and territories with over 100 cities", () => {
    expect(PROVINCES).toHaveLength(7);
    expect(cities.length).toBeGreaterThan(100);
  });

  it("never reuses a slug (slugs are public URLs)", () => {
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(JOB_CATEGORIES.map(([, slug]) => slug)).size).toBe(JOB_CATEGORIES.length);
  });

  it("uses URL-safe slugs", () => {
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("keeps the original city slugs live (existing URLs must not break)", () => {
    for (const slug of ["lahore", "karachi", "islamabad", "mirpur-ajk", "dera-ismail-khan", "mingora"]) expect(slugs).toContain(slug);
  });

  it("lists every major city in the data, biggest first", () => {
    for (const slug of MAJOR_CITY_SLUGS) expect(slugs).toContain(slug);
    expect(majorCityRank("karachi")).toBeLessThan(majorCityRank("lahore"));
    expect(majorCityRank("chiniot")).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe("job search parameters", () => {
  it("reads the new province, date posted and sort filters", () => {
    expect(parseJobSearchParams({ province: "punjab", posted: "7", sort: "deadline" })).toMatchObject({ province: "punjab", postedWithin: "7", sort: "deadline" });
  });

  it("ignores values that aren't offered", () => {
    expect(parseJobSearchParams({ posted: "999", sort: "salary" })).toMatchObject({ postedWithin: "", sort: "relevance" });
  });
});
