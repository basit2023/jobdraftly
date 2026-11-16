import { compare, hash } from "bcryptjs";
import { describe, expect, it } from "vitest";

import { initialAdminSchema } from "./admin-auth";
import { companyAdminSchema, jobAdminSchema } from "./admin-forms";

function validJob(overrides: Record<string, unknown> = {}) {
  return {
    title: "Senior Software Engineer",
    companyId: "company-id",
    categoryId: "category-id",
    locationId: "location-id",
    description: "A sufficiently detailed and reviewed vacancy description.",
    responsibilities: "",
    requirements: "",
    skills: "TypeScript, MySQL",
    employmentType: "FULL_TIME",
    experienceLevel: "SENIOR",
    education: "",
    salaryMin: "100000",
    salaryMax: "200000",
    salaryCurrency: "PKR",
    salaryVisibility: "RANGE",
    salaryPeriod: "MONTH",
    workplaceType: "HYBRID",
    applicationMethod: "EXTERNAL_URL",
    applicationUrl: "https://example.com/careers/123",
    sourceId: "",
    sourceUrl: "https://example.com/jobs/123",
    status: "DRAFT",
    applicationDeadline: "2027-01-01T12:00",
    expiresAt: "2027-01-02T12:00",
    isFeatured: "on",
    ...overrides,
  };
}

describe("administrator form validation", () => {
  it("accepts a complete job and normalizes optional values", () => {
    const result = jobAdminSchema.safeParse(validJob());
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.salaryMin).toBe(100000);
      expect(result.data.isFeatured).toBe(true);
      expect(result.data.sourceId).toBeNull();
    }
  });

  it("requires an HTTP application URL for external applications", () => {
    expect(jobAdminSchema.safeParse(validJob({ applicationUrl: "" })).success).toBe(false);
    expect(jobAdminSchema.safeParse(validJob({ applicationUrl: "javascript:alert(1)" })).success).toBe(false);
  });

  it("rejects inverted salary and date ranges", () => {
    const result = jobAdminSchema.safeParse(
      validJob({ salaryMin: "300000", salaryMax: "200000", expiresAt: "2026-12-01T12:00" }),
    );
    expect(result.success).toBe(false);
  });

  it("accepts only the controlled local logo path or an HTTP URL", () => {
    const base = {
      name: "Example Company",
      legalName: "",
      websiteUrl: "",
      domain: "",
      description: "",
      industry: "",
      locationId: "",
      isVerified: "",
      isActive: "on",
    };
    expect(companyAdminSchema.safeParse({ ...base, logoUrl: "/uploads/company-logos/123e4567-e89b-42d3-a456-426614174000.png" }).success).toBe(true);
    expect(companyAdminSchema.safeParse({ ...base, logoUrl: "/uploads/company-logos/../../secret" }).success).toBe(false);
    expect(companyAdminSchema.safeParse({ ...base, logoUrl: "file:///secret" }).success).toBe(false);
  });
});

describe("administrator credentials", () => {
  it("enforces a strong environment-backed initial password", () => {
    expect(initialAdminSchema.safeParse({ name: "Admin", email: "admin@example.com", password: "weakpassword" }).success).toBe(false);
    expect(initialAdminSchema.safeParse({ name: "Admin", email: "admin@example.com", password: "Strong-Password-42!" }).success).toBe(true);
  });

  it("hashes passwords without retaining plaintext", async () => {
    const password = "Strong-Password-42!";
    const digest = await hash(password, 12);
    expect(digest).not.toContain(password);
    expect(await compare(password, digest)).toBe(true);
    expect(await compare("incorrect", digest)).toBe(false);
  }, 15_000);
});
