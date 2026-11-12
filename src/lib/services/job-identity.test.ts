import { describe, expect, it } from "vitest";

import {
  canonicalizeJobUrl,
  createJobDeduplicationKey,
  createJobSlug,
  createSourceUrlHash,
} from "./job-identity";

describe("job identity utilities", () => {
  it("creates stable canonical URLs without tracking parameters", () => {
    expect(
      canonicalizeJobUrl(
        "https://EXAMPLE.com/jobs/123/?utm_source=google&department=tech#apply",
      ),
    ).toBe("https://example.com/jobs/123?department=tech");
  });

  it("creates identical URL hashes for tracking variants", () => {
    expect(
      createSourceUrlHash("https://example.com/job/1?utm_medium=email"),
    ).toBe(createSourceUrlHash("https://example.com/job/1"));
  });

  it("prioritizes a source external identifier for deduplication", () => {
    const base = {
      sourceId: "source-1",
      sourceExternalId: " Vacancy-42 ",
      title: "Software Engineer",
      companyId: "company-1",
      locationId: "lahore",
    };

    expect(createJobDeduplicationKey(base)).toBe(
      createJobDeduplicationKey({ ...base, title: "Changed title" }),
    );
  });

  it("adds a collision-resistant suffix to readable slugs", () => {
    expect(createJobSlug("Senior React Developer", "Acme Ltd", "abc123"))
      .toBe("senior-react-developer-acme-ltd-abc123");
  });
});
