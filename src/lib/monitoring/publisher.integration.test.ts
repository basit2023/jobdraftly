import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { AiJob } from "@/lib/ai/job-extractor";

// Claude, outbound network and Cloudinary are replaced so the test is free and offline.
const extractions = new Map<string, Partial<AiJob>>();
vi.mock("@/lib/ai/job-extractor", () => ({
  aiExtractionIsConfigured: () => true,
  ExtractionRefusedError: class extends Error {},
  extractJobWithClaude: vi.fn(async (input: { pageUrl: string }) => ({ ...baseJob, ...extractions.get(input.pageUrl) })),
}));
vi.mock("@/lib/imports/network", () => ({ assertPublicSourceUrl: async (value: string) => new URL(value) }));
vi.mock("@/lib/storage/object-store", () => ({
  rehostRemoteImage: async () => "https://res.cloudinary.com/demo/image/upload/jobdraftly/job-images/test.jpg",
}));
vi.mock("./network", () => ({ assertRobotsPermission: async () => undefined }));

const runDatabaseTests = Boolean(process.env.DATABASE_URL);
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const futureDeadline = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);

const baseJob: AiJob = {
  isJobPosting: true,
  isClosedOrCancelled: false,
  title: `Pipeline Test Engineer ${suffix}`,
  companyName: `Pipeline Test Employer ${suffix}`,
  companyWebsite: null,
  description: "A temporary vacancy created by the automated publishing test. It checks extraction, publishing, review routing and removal behaviour.",
  responsibilities: null,
  requirements: null,
  skills: ["Testing"],
  employmentType: "FULL_TIME",
  experienceLevel: "MID_LEVEL",
  workplaceType: "ONSITE",
  education: null,
  location: null,
  category: null,
  salaryMin: 150000,
  salaryMax: 200000,
  salaryPeriod: "MONTH",
  applicationUrl: null,
  applicationEmail: null,
  applicationDeadline: futureDeadline,
  postedDate: null,
  companyLogoUrl: null,
  advertImageUrl: "https://jobs.example.test/advert.jpg",
  confidence: 0.95,
  notes: null,
};

describe.runIf(runDatabaseTests)("AI job publishing pipeline", async () => {
  const { db } = await import("@/lib/db");
  const { publishDiscoveredJobs, syncJobsWithSources } = await import("./publisher");
  const { expireDueJobs } = await import("@/lib/services/job-expiration");

  const sourceIds: string[] = [];
  let city = { name: "" };
  let category = { name: "" };

  async function createSource(autoPublish: boolean) {
    const source = await db.jobSource.create({
      data: {
        name: `Pipeline Test Source ${suffix} ${autoPublish ? "trusted" : "untrusted"}`,
        slug: `pipeline-test-${suffix}-${autoPublish ? "t" : "u"}`,
        type: "API",
        permissionStatus: "APPROVED",
        isActive: true,
        monitoringMode: "API",
        autoPublish,
      },
    });
    sourceIds.push(source.id);
    return source;
  }

  async function createDiscovery(sourceId: string, key: string, overrides: Partial<AiJob> = {}) {
    const canonicalUrl = `https://jobs.example.test/${suffix}/${key}`;
    extractions.set(canonicalUrl, { location: city.name, category: category.name, ...overrides });
    return db.sourceDiscovery.create({
      data: {
        sourceId,
        externalKey: `${suffix}${key}`.padEnd(64, "0").slice(0, 64),
        externalId: `${suffix}-${key}`,
        canonicalUrl,
        title: `Discovered advert ${key}`,
        type: "JOB",
        fingerprint: "f".repeat(64),
      },
    });
  }

  beforeAll(async () => {
    const [foundCity, foundCategory] = await Promise.all([
      db.jobLocation.findFirst({ where: { isActive: true, type: "CITY" } }),
      db.jobCategory.findFirst({ where: { isActive: true, NOT: { name: "Other" } } }),
    ]);
    if (!foundCity || !foundCategory) throw new Error("Development reference data is required.");
    city = foundCity;
    category = foundCategory;
    // The fake advert page contains the original wording the extractor "copies".
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`<html><body><h1>Advert</h1><p>${baseJob.description}</p><img src="/advert.jpg"></body></html>`, { status: 200, headers: { "content-type": "text/html" } })));
  });

  afterAll(async () => {
    vi.unstubAllGlobals();
    const jobs = await db.job.findMany({ where: { sourceId: { in: sourceIds } }, select: { id: true, companyId: true } });
    const jobIds = jobs.map((job) => job.id);
    await db.adminNotification.deleteMany({ where: { OR: [{ entityId: { in: jobIds } }, { message: { contains: suffix } }] } });
    await db.auditLog.deleteMany({ where: { entityId: { in: jobIds } } });
    await db.sourceDiscovery.deleteMany({ where: { sourceId: { in: sourceIds } } });
    await db.job.deleteMany({ where: { id: { in: jobIds } } });
    await db.company.deleteMany({ where: { name: { contains: suffix } } });
    await db.jobSource.deleteMany({ where: { id: { in: sourceIds } } });
    await db.$disconnect();
  });

  it("publishes trusted jobs, queues the rest, and skips closed adverts", async () => {
    const trusted = await createSource(true);
    const untrusted = await createSource(false);
    const published = await createDiscovery(trusted.id, "published");
    const lowConfidence = await createDiscovery(trusted.id, "unsure", { confidence: 0.5, title: `Unsure Role ${suffix}` });
    const fromUntrusted = await createDiscovery(untrusted.id, "untrusted", { title: `Untrusted Role ${suffix}` });
    const expired = await createDiscovery(trusted.id, "expired", { applicationDeadline: "2020-01-01" });
    const reworded = await createDiscovery(trusted.id, "reworded", {
      title: `Reworded Role ${suffix}`,
      description: "An exciting opportunity to join a dynamic, fast-growing team and make a real difference every single day in a rewarding role.",
    });

    const trustedResult = await publishDiscoveredJobs({ sourceId: trusted.id });
    const untrustedResult = await publishDiscoveredJobs({ sourceId: untrusted.id });
    expect(trustedResult).toMatchObject({ processed: 4, PUBLISHED: 1, PENDING_REVIEW: 2, DISMISSED: 1 });
    expect(untrustedResult).toMatchObject({ processed: 1, PENDING_REVIEW: 1 });

    const live = await db.sourceDiscovery.findUniqueOrThrow({ where: { id: published.id }, include: { relatedJob: true } });
    expect(live.relatedJob).toMatchObject({
      status: "PUBLISHED",
      imageUrl: "https://res.cloudinary.com/demo/image/upload/jobdraftly/job-images/test.jpg",
      applicationUrl: published.canonicalUrl,
      salaryVisibility: "RANGE",
    });
    expect(live.relatedJob?.expiresAt?.toISOString()).toBe(new Date(`${futureDeadline}T23:59:59+05:00`).toISOString());
    expect(live.relatedJob?.publishedAt).not.toBeNull();

    const rewordedJob = await db.sourceDiscovery.findUniqueOrThrow({ where: { id: reworded.id }, include: { relatedJob: true } });
    expect(rewordedJob.relatedJob?.status).toBe("PENDING_REVIEW");
    expect(rewordedJob.extractionError).toMatch(/original advert word for word/);

    for (const id of [lowConfidence.id, fromUntrusted.id]) {
      const queued = await db.sourceDiscovery.findUniqueOrThrow({ where: { id }, include: { relatedJob: true } });
      expect(queued.relatedJob?.status).toBe("PENDING_REVIEW");
      expect(queued.extractionError).toBeTruthy();
    }
    expect((await db.sourceDiscovery.findUniqueOrThrow({ where: { id: expired.id } })).status).toBe("DISMISSED");

    // Running again must not create duplicates.
    expect(await publishDiscoveredJobs({ sourceId: trusted.id })).toMatchObject({ processed: 0 });
  });

  it("closes a live job when its source advert disappears", async () => {
    const live = await db.sourceDiscovery.findFirstOrThrow({ where: { sourceId: { in: sourceIds }, relatedJob: { status: "PUBLISHED" } } });
    await db.sourceDiscovery.update({ where: { id: live.id }, data: { status: "REMOVED", latestChangeType: "REMOVED" } });
    expect((await syncJobsWithSources()).closed).toBeGreaterThanOrEqual(1);
    expect((await db.job.findUniqueOrThrow({ where: { id: live.relatedJobId! } })).status).toBe("CLOSED");
  });

  it("expires a published job once its deadline passes", async () => {
    const pending = await db.job.findFirstOrThrow({ where: { sourceId: { in: sourceIds }, status: "PENDING_REVIEW" } });
    await db.job.update({ where: { id: pending.id }, data: { status: "PUBLISHED", publishedAt: new Date(), applicationDeadline: new Date("2020-01-01T00:00:00Z") } });
    expect(await expireDueJobs()).toBeGreaterThanOrEqual(1);
    expect((await db.job.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe("EXPIRED");
  });
});
