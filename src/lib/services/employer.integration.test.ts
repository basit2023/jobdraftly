import { randomUUID } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { compare } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { EmployerContext } from "@/lib/auth/employer-session";

const runDatabaseTests = Boolean(process.env.DATABASE_URL);
const suffix = randomUUID().replaceAll("-", "").slice(0, 10);
const pdf = new Uint8Array([...Buffer.from("%PDF-1.7\n"), ...new Uint8Array(500)]);

describe.runIf(runDatabaseTests)("company accounts, jobs and applications", async () => {
  const storageRoot = await mkdtemp(path.join(os.tmpdir(), "jobdraftly-cvs-"));
  vi.stubEnv("PRIVATE_STORAGE_DIR", storageRoot);
  vi.stubEnv("PRIVATE_STORAGE_S3_BUCKET", "");

  const { db } = await import("@/lib/db");
  const accounts = await import("./employer-accounts");
  const jobs = await import("./employer-jobs");
  const applications = await import("./applications");

  const companyIds: string[] = [];
  let unverified: EmployerContext;
  let verified: EmployerContext;
  let categoryId = "";
  let cityId = "";
  const deadline = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);

  const jobInput = (title: string) => ({
    title,
    categoryId,
    locationId: cityId,
    employmentType: "FULL_TIME" as const,
    experienceLevel: "MID_LEVEL" as const,
    workplaceType: "ONSITE" as const,
    workplaceStreetAddress: null,
    workplacePostalCode: null,
    education: null,
    description: "A temporary vacancy created by the employer portal integration test. It is deleted when the test finishes.",
    responsibilities: null,
    requirements: null,
    skills: null,
    salaryMin: 100_000,
    salaryMax: 150_000,
    salaryVisibility: "RANGE" as const,
    salaryPeriod: "MONTH" as const,
    applicationDeadline: deadline,
    applicationMethod: "ON_SITE" as const,
    applicationUrl: null,
  });

  async function context(companyId: string, email: string, role: "OWNER" | "RECRUITER" = "OWNER"): Promise<EmployerContext> {
    const user = await db.employerUser.findUniqueOrThrow({ where: { email }, include: { company: true } });
    return {
      userId: user.id,
      companyId,
      role,
      name: user.name,
      email: user.email,
      company: { id: user.company.id, name: user.company.name, slug: user.company.slug, isVerified: user.company.isVerified, logoUrl: null },
    };
  }

  beforeAll(async () => {
    const [category, city] = await Promise.all([
      db.jobCategory.findFirstOrThrow({ where: { isActive: true } }),
      db.jobLocation.findFirstOrThrow({ where: { isActive: true, type: "CITY" } }),
    ]);
    categoryId = category.id;
    cityId = city.id;
    for (const [key, isVerified] of [["new", false], ["trusted", true]] as const) {
      const company = await db.company.create({
        data: { name: `Portal Test ${key} ${suffix}`, slug: `portal-test-${key}-${suffix}`, isActive: true, isVerified },
      });
      companyIds.push(company.id);
      await accounts.createEmployerUser({ companyId: company.id, name: `Owner ${key}`, email: `owner-${key}-${suffix}@example.com`, role: "OWNER" });
    }
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    const jobIds = (await db.job.findMany({ where: { companyId: { in: companyIds } }, select: { id: true } })).map((job) => job.id);
    await db.adminNotification.deleteMany({ where: { entityId: { in: jobIds } } });
    await db.jobApplication.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.job.deleteMany({ where: { id: { in: jobIds } } });
    await db.employerUser.deleteMany({ where: { companyId: { in: companyIds } } });
    await db.company.deleteMany({ where: { id: { in: companyIds } } });
    await rm(storageRoot, { recursive: true, force: true });
    await db.$disconnect();
  });

  it("sets a password from a one-time link that can't be reused", async () => {
    for (const key of ["new", "trusted"]) {
      const user = await db.employerUser.findUniqueOrThrow({ where: { email: `owner-${key}-${suffix}@example.com` } });
      expect(user.passwordHash).toBeNull();
      const { url } = await accounts.issueSetupLink(user.id);
      const token = new URL(url).searchParams.get("token")!;
      expect(await accounts.findValidSetupToken(token)).toMatchObject({ id: user.id });
      await accounts.completeEmployerSetup(token, "Strong-pass-123");
      const saved = await db.employerUser.findUniqueOrThrow({ where: { id: user.id } });
      expect(await compare("Strong-pass-123", saved.passwordHash!)).toBe(true);
      expect(saved.setupTokenHash).toBeNull();
      await expect(accounts.completeEmployerSetup(token, "Another-pass-456")).rejects.toThrow(/expired or was already used/);
    }
    unverified = await context(companyIds[0], `owner-new-${suffix}@example.com`);
    verified = await context(companyIds[1], `owner-trusted-${suffix}@example.com`);
  });

  it("rejects expired links and duplicate emails", async () => {
    const user = await db.employerUser.findUniqueOrThrow({ where: { email: `owner-new-${suffix}@example.com` } });
    const { url } = await accounts.issueSetupLink(user.id, new Date(Date.now() - 73 * 3_600_000));
    expect(await accounts.findValidSetupToken(new URL(url).searchParams.get("token")!)).toBeNull();
    await expect(accounts.createEmployerUser({ companyId: companyIds[1], name: "Dup", email: `OWNER-new-${suffix}@example.com `, role: "RECRUITER" }))
      .rejects.toThrow(/another company/);
  });

  it("publishes jobs from verified companies and holds the rest for approval", async () => {
    const held = await jobs.createEmployerJob(unverified, jobInput(`Held Role ${suffix}`));
    const live = await jobs.createEmployerJob(verified, jobInput(`Live Role ${suffix}`));
    expect(held.status).toBe("PENDING_REVIEW");
    expect(live.status).toBe("PUBLISHED");
    expect(await db.adminNotification.count({ where: { entityId: held.id } })).toBe(1);
    const saved = await db.job.findUniqueOrThrow({ where: { id: live.id } });
    expect(saved).toMatchObject({ applicationMethod: "ON_SITE", postedByEmployerId: verified.userId, companyId: verified.companyId });
    expect(saved.expiresAt?.toISOString()).toBe(new Date(`${deadline}T23:59:59+05:00`).toISOString());
  });

  it("never lets one company touch another company's jobs", async () => {
    const othersJob = await db.job.findFirstOrThrow({ where: { companyId: unverified.companyId } });
    expect(await jobs.findEmployerJob(verified, othersJob.id)).toBeNull();
    await expect(jobs.updateEmployerJob(verified, othersJob.id, jobInput("Hijacked"))).rejects.toThrow(/not found/);
    await expect(jobs.closeEmployerJob(verified, othersJob.id)).rejects.toThrow();
    expect((await db.job.findUniqueOrThrow({ where: { id: othersJob.id } })).title).toBe(`Held Role ${suffix}`);
  });

  it("sends an edited live job from an unverified company back to review", async () => {
    const job = await db.job.findFirstOrThrow({ where: { companyId: unverified.companyId } });
    await db.job.update({ where: { id: job.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    const edited = await jobs.updateEmployerJob(unverified, job.id, jobInput(`Held Role ${suffix} (edited)`));
    expect(edited.status).toBe("PENDING_REVIEW");
  });

  it("accepts a valid application only for a live on-site job", async () => {
    const pendingJob = await db.job.findFirstOrThrow({ where: { companyId: unverified.companyId } });
    const liveJob = await db.job.findFirstOrThrow({ where: { companyId: verified.companyId } });
    const fields = { fullName: "Test Candidate", email: `candidate-${suffix}@example.com`, phone: "0300 1234567", city: "Lahore", coverLetter: "", consent: "on" };

    await expect(applications.submitApplication({ jobId: pendingJob.id, fields, cv: { name: "cv.pdf", bytes: pdf } })).rejects.toThrow(/no longer accepting/);
    await expect(applications.submitApplication({ jobId: liveJob.id, fields, cv: { name: "cv.exe", bytes: Buffer.from("MZ not a cv") } })).rejects.toThrow(/PDF or Word/);
    await expect(applications.submitApplication({ jobId: liveJob.id, fields, cv: null })).rejects.toThrow(/Attach your CV/);

    await applications.submitApplication({ jobId: liveJob.id, fields, cv: { name: "My CV.pdf", bytes: pdf } });
    await expect(applications.submitApplication({ jobId: liveJob.id, fields: { ...fields, email: fields.email.toUpperCase() }, cv: { name: "cv.pdf", bytes: pdf } }))
      .rejects.toThrow(/already applied/);

    const saved = await db.jobApplication.findFirstOrThrow({ where: { jobId: liveJob.id } });
    expect(saved).toMatchObject({ companyId: verified.companyId, status: "NEW", cvFileName: "My-CV.pdf", cvMimeType: "application/pdf" });
    expect(saved.cvStorageKey).toMatch(/^cvs\/[a-z0-9]+\/[0-9a-f-]{36}\.pdf$/);
    expect(await readdir(path.join(storageRoot, "cvs", verified.companyId.toLowerCase()))).toHaveLength(1);
  });

  it("shows applicants only to the company that received them", async () => {
    const application = await db.jobApplication.findFirstOrThrow({ where: { companyId: verified.companyId } });
    expect(await applications.getEmployerApplication(unverified, application.id)).toBeNull();
    await expect(applications.updateApplicationStatus(unverified, application.id, "REJECTED")).rejects.toThrow(/not found/);
    await expect(applications.saveApplicationNotes(unverified, application.id, "sneaky")).rejects.toThrow(/not found/);

    const own = await applications.getEmployerApplication(verified, application.id);
    expect(own?.viewedAt).toBeNull(); // value read before it was marked
    await applications.updateApplicationStatus(verified, application.id, "SHORTLISTED");
    await applications.saveApplicationNotes(verified, application.id, "Strong Excel skills");
    expect(await db.jobApplication.findUniqueOrThrow({ where: { id: application.id } })).toMatchObject({
      status: "SHORTLISTED",
      employerNotes: "Strong Excel skills",
      viewedAt: expect.any(Date),
    });
  });

  it("stops taking applications once a job is closed", async () => {
    const liveJob = await db.job.findFirstOrThrow({ where: { companyId: verified.companyId } });
    await jobs.closeEmployerJob(verified, liveJob.id);
    const fields = { fullName: "Late Candidate", email: `late-${suffix}@example.com`, phone: "03001234567", consent: "on" };
    await expect(applications.submitApplication({ jobId: liveJob.id, fields, cv: { name: "cv.pdf", bytes: pdf } })).rejects.toThrow(/no longer accepting/);
  });

  it("deletes old applications together with their CV files", async () => {
    const before = await db.jobApplication.count({ where: { companyId: verified.companyId } });
    expect(before).toBe(1);
    // Pretend a year and a half has passed.
    // Scoped to the test company so real applications in a dev database are never touched.
    const purged = await applications.purgeOldApplications(new Date(Date.now() + 550 * 86_400_000), { companyId: verified.companyId });
    expect(purged).toBeGreaterThanOrEqual(1);
    expect(await db.jobApplication.count({ where: { companyId: verified.companyId } })).toBe(0);
    expect(await readdir(path.join(storageRoot, "cvs", verified.companyId.toLowerCase()))).toHaveLength(0);
  });
});
