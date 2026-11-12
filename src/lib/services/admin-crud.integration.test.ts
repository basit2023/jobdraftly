import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/lib/db/adapter";
import { expireDueJobs } from "./job-expiration";

import { createJobDeduplicationKey, createJobSlug, createSourceUrlHash } from "./job-identity";

config({ path: [".env.local", ".env"], quiet: true });

const runDatabaseTests = Boolean(process.env.DATABASE_URL);

describe.runIf(runDatabaseTests)("administrator database CRUD", () => {
  const db = new PrismaClient({ adapter: createDatabaseAdapter() });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  let companyId = "";
  let jobId = "";
  const testStartedAt = new Date();

  beforeAll(async () => {
    const [category, location] = await Promise.all([
      db.jobCategory.findFirst({ where: { isActive: true } }),
      db.jobLocation.findFirst({ where: { isActive: true, type: "CITY" } }),
    ]);
    if (!category || !location) throw new Error("Development reference data is required for CRUD tests.");

    const company = await db.company.create({
      data: { name: `CRUD Test Company ${suffix}`, slug: `crud-test-company-${suffix}`, isActive: true },
    });
    companyId = company.id;
    const applicationUrl = `https://example.com/job/${suffix}`;
    const job = await db.job.create({
      data: {
        title: `CRUD Test Job ${suffix}`,
        slug: createJobSlug("CRUD Test Job", company.slug, suffix.slice(0, 10)),
        companyId,
        categoryId: category.id,
        locationId: location.id,
        description: "Temporary integration-test vacancy that is removed after the test.",
        employmentType: "FULL_TIME",
        workplaceType: "ONSITE",
        applicationMethod: "EXTERNAL_URL",
        applicationUrl,
        sourceUrlHash: createSourceUrlHash(applicationUrl),
        deduplicationKey: createJobDeduplicationKey({ title: `CRUD Test Job ${suffix}`, companyId, locationId: location.id, applicationUrl }),
        status: "DRAFT",
      },
    });
    jobId = job.id;
  });

  afterAll(async () => {
    if (jobId) await db.job.deleteMany({ where: { id: jobId } });
    if (companyId) await db.company.deleteMany({ where: { id: companyId } });
    await db.auditLog.deleteMany({ where: { adminId: null, action: "EXPIRE", createdAt: { gte: testStartedAt } } });
    await db.$disconnect();
  });

  it("creates and reads a draft vacancy", async () => {
    const job = await db.job.findUnique({ where: { id: jobId }, include: { company: true } });
    expect(job?.status).toBe("DRAFT");
    expect(job?.companyId).toBe(companyId);
  });

  it("updates and safely archives the vacancy", async () => {
    const job = await db.job.update({ where: { id: jobId }, data: { status: "CLOSED", isFeatured: false } });
    expect(job.status).toBe("CLOSED");
    expect(job.isFeatured).toBe(false);
  });

  it("expires a published vacancy whose explicit expiry has passed", async () => {
    const now = new Date("2026-11-11T12:00:00.000Z");
    await db.job.update({
      where: { id: jobId },
      data: { status: "PUBLISHED", isFeatured: true, publishedAt: new Date("2026-11-01T00:00:00.000Z"), expiresAt: new Date("2026-11-10T00:00:00.000Z") },
    });
    await expect(expireDueJobs(now)).resolves.toBeGreaterThanOrEqual(1);
    await expect(db.job.findUnique({ where: { id: jobId }, select: { status: true, isFeatured: true } })).resolves.toMatchObject({ status: "EXPIRED", isFeatured: false });
  });
});
