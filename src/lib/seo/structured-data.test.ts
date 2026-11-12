import { describe, expect, it } from "vitest";

import type { PublicJobDetail } from "@/lib/services/public-jobs";

import { pageMetadata } from "./site";
import { buildBreadcrumbList, buildJobPosting } from "./structured-data";
import { renderSitemapIndex, renderUrlSet } from "./sitemap-xml";

function representativeJob(overrides: Partial<PublicJobDetail> = {}): PublicJobDetail {
  return {
    id: "seo-test-job",
    title: "Development Test Engineer",
    slug: "development-test-engineer",
    description: "Development-only representative description with accurate visible details.",
    responsibilities: "Build and test development fixtures.",
    requirements: "Use only in automated tests.",
    skills: "Testing, TypeScript",
    education: "Not specified",
    employmentType: "FULL_TIME",
    experienceLevel: "JUNIOR",
    salaryMin: { toNumber: () => 100_000 } as PublicJobDetail["salaryMin"],
    salaryMax: { toNumber: () => 120_000 } as PublicJobDetail["salaryMax"],
    salaryCurrency: "PKR",
    salaryVisibility: "RANGE",
    salaryPeriod: "MONTH",
    workplaceType: "ONSITE",
    applicationMethod: "EXTERNAL_URL",
    applicationUrl: "https://example.invalid/apply/test",
    sourceId: null,
    sourceUrl: "https://example.invalid/jobs/test",
    sourceExternalId: "SEO-TEST-1",
    sourceUrlHash: null,
    deduplicationKey: "0".repeat(64),
    jobImportId: null,
    originalPublishedAt: new Date("2026-11-01T00:00:00.000Z"),
    verificationStatus: "VERIFIED",
    verifiedAt: new Date("2026-11-01T01:00:00.000Z"),
    verifiedById: null,
    publishedAt: new Date("2026-11-02T00:00:00.000Z"),
    applicationDeadline: new Date("2026-12-01T18:59:59.000Z"),
    expiresAt: null,
    status: "PUBLISHED",
    isFeatured: false,
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-02T00:00:00.000Z"),
    companyId: "company",
    categoryId: "category",
    locationId: "location",
    company: { id: "company", name: "Development Fixture Company", slug: "development-fixture-company", legalName: null, websiteUrl: "https://example.invalid", domain: null, logoUrl: null, description: null, industry: null, locationId: null, isVerified: true, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    category: { id: "category", name: "Information Technology & Software", slug: "information-technology-software", description: null, parentId: null, sortOrder: 0, isActive: true, createdAt: new Date(), updatedAt: new Date() },
    location: { id: "location", name: "Lahore", slug: "lahore", type: "CITY", provinceId: "province", latitude: null, longitude: null, isActive: true, sortOrder: 0, createdAt: new Date(), updatedAt: new Date(), province: { id: "province", name: "Punjab", slug: "punjab", type: "PROVINCE", provinceId: null, latitude: null, longitude: null, isActive: true, sortOrder: 0, createdAt: new Date(), updatedAt: new Date() } },
    source: null,
    tags: [],
    ...overrides,
  } as PublicJobDetail;
}

describe("technical SEO", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");

  it("builds an onsite JobPosting whose salary has a genuine period", () => {
    const schema = buildJobPosting(representativeJob(), now)!;
    expect(schema).toMatchObject({ "@type": "JobPosting", title: "Development Test Engineer", datePosted: "2026-11-01T00:00:00.000Z", employmentType: "FULL_TIME" });
    expect(schema.jobLocation).toMatchObject({ address: { addressLocality: "Lahore", addressRegion: "Punjab", addressCountry: "PK" } });
    expect(schema.baseSalary).toMatchObject({ currency: "PKR", value: { minValue: 100_000, maxValue: 120_000, unitText: "MONTH" } });
  });

  it("marks fully remote jobs for Pakistan and omits salary without a period", () => {
    const schema = buildJobPosting(representativeJob({ workplaceType: "REMOTE", salaryPeriod: null }), now)!;
    expect(schema).toMatchObject({ jobLocationType: "TELECOMMUTE", applicantLocationRequirements: { "@type": "Country", name: "Pakistan" } });
    expect(schema).not.toHaveProperty("jobLocation");
    expect(schema).not.toHaveProperty("baseSalary");
  });

  it("does not emit JobPosting without an application destination", () => {
    expect(buildJobPosting(representativeJob({ applicationUrl: null }), now)).toBeNull();
  });

  it("omits schema for inactive, expired, or unreviewed imported vacancies", () => {
    expect(buildJobPosting(representativeJob({ status: "CLOSED" }), now)).toBeNull();
    expect(buildJobPosting(representativeJob({ expiresAt: new Date("2026-11-09T00:00:00.000Z") }), now)).toBeNull();
    expect(buildJobPosting(representativeJob({ company: { ...representativeJob().company, isActive: false } }), now)).toBeNull();
    expect(buildJobPosting(representativeJob({ jobImportId: "import", verificationStatus: "UNVERIFIED" }), now)).toBeNull();
  });

  it("generates canonical social metadata and valid sitemap XML", () => {
    const metadata = pageMetadata({ title: "Test", description: "Test description", path: "/jobs/test" });
    expect(metadata.alternates?.canonical).toBe("https://www.jobdraftly.com/jobs/test");
    const filteredMetadata = pageMetadata({ title: "Filtered", description: "Filtered results", path: "/jobs", index: false });
    expect(filteredMetadata.robots).toMatchObject({ index: false, follow: true });
    expect(renderUrlSet([{ url: "https://www.jobdraftly.com/jobs/a&b", lastModified: new Date("2026-11-01T00:00:00.000Z") }])).toContain("a&amp;b");
    expect(renderUrlSet([])).toContain("<urlset");
    expect(renderSitemapIndex(["https://www.jobdraftly.com/sitemaps/jobs.xml"])).toContain("<sitemapindex");
    expect(buildBreadcrumbList([{ name: "Home", path: "/" }])).toMatchObject({ "@type": "BreadcrumbList" });
  });
});
