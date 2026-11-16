import "server-only";

import { randomUUID } from "node:crypto";

import type { JobStatus } from "@/generated/prisma/client";
import type { EmployerContext } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";
import { createJobDeduplicationKey, createJobSlug } from "@/lib/services/job-identity";
import { MAX_EMPLOYER_LISTING_DAYS, type EmployerJobInput } from "@/lib/validations/employer";

export class EmployerJobError extends Error {}

/**
 * Verified companies publish straight away. Unverified companies always go to
 * review, including when they edit a job that is already live (so an approved
 * advert can't be swapped for different content).
 */
export function employerJobStatus(companyIsVerified: boolean): Extract<JobStatus, "PUBLISHED" | "PENDING_REVIEW"> {
  return companyIsVerified ? "PUBLISHED" : "PENDING_REVIEW";
}

function pakistanToday(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Deadline as the end of that day in Pakistan; must be today .. today + 90 days. */
export function parseEmployerDeadline(value: string, now = new Date()) {
  const deadline = new Date(`${value}T23:59:59+05:00`);
  const today = new Date(`${pakistanToday(now)}T00:00:00+05:00`);
  if (Number.isNaN(deadline.getTime()) || deadline < today) throw new EmployerJobError("The last date to apply can't be in the past.");
  if (deadline.getTime() > today.getTime() + (MAX_EMPLOYER_LISTING_DAYS + 1) * 86_400_000) {
    throw new EmployerJobError(`Jobs can stay open for up to ${MAX_EMPLOYER_LISTING_DAYS} days. Choose an earlier date.`);
  }
  return deadline;
}

async function assertReferences(data: EmployerJobInput) {
  const [category, location] = await Promise.all([
    db.jobCategory.findFirst({ where: { id: data.categoryId, isActive: true }, select: { id: true } }),
    db.jobLocation.findFirst({ where: { id: data.locationId, isActive: true }, select: { id: true } }),
  ]);
  if (!category) throw new EmployerJobError("Choose a category from the list.");
  if (!location) throw new EmployerJobError("Choose a city from the list.");
}

function jobFields(data: EmployerJobInput, deadline: Date) {
  return {
    title: data.title,
    categoryId: data.categoryId,
    locationId: data.locationId,
    description: data.description,
    responsibilities: data.responsibilities,
    requirements: data.requirements,
    skills: data.skills,
    employmentType: data.employmentType,
    experienceLevel: data.experienceLevel,
    workplaceType: data.workplaceType,
    workplaceStreetAddress: data.workplaceType === "REMOTE" ? null : data.workplaceStreetAddress,
    workplacePostalCode: data.workplaceType === "REMOTE" ? null : data.workplacePostalCode,
    education: data.education,
    salaryMin: data.salaryVisibility === "HIDDEN" ? null : data.salaryMin,
    salaryMax: data.salaryVisibility === "HIDDEN" ? null : data.salaryMax,
    salaryCurrency: "PKR",
    salaryVisibility: data.salaryVisibility,
    salaryPeriod: data.salaryVisibility === "HIDDEN" ? null : data.salaryPeriod,
    applicationMethod: data.applicationMethod,
    applicationUrl: data.applicationMethod === "EXTERNAL_URL" ? data.applicationUrl : null,
    applicationDeadline: deadline,
    expiresAt: deadline,
  };
}

async function notifyReview(employer: EmployerContext, jobId: string, title: string, edited: boolean) {
  await db.adminNotification.create({
    data: {
      type: "NEW_JOB",
      title: edited ? "Company edited a job — review needed" : "Company job waiting for approval",
      message: `${employer.company.name}: ${title}`,
      entityType: "Job",
      entityId: jobId,
    },
  });
}

/** Creates a job for the signed-in company. */
export async function createEmployerJob(employer: EmployerContext, data: EmployerJobInput, now = new Date()) {
  await assertReferences(data);
  const deadline = parseEmployerDeadline(data.applicationDeadline, now);
  const status = employerJobStatus(employer.company.isVerified);
  const job = await db.job.create({
    data: {
      ...jobFields(data, deadline),
      slug: createJobSlug(data.title, employer.company.slug),
      companyId: employer.companyId,
      postedByEmployerId: employer.userId,
      // Each company posting is its own vacancy, even if the title repeats.
      deduplicationKey: createJobDeduplicationKey({
        title: data.title,
        companyId: employer.companyId,
        locationId: data.locationId,
        sourceId: `employer-${employer.companyId}`,
        sourceExternalId: randomUUID(),
      }),
      status,
      publishedAt: status === "PUBLISHED" ? now : null,
      originalPublishedAt: status === "PUBLISHED" ? now : null,
      verificationStatus: employer.company.isVerified ? "VERIFIED" : "UNVERIFIED",
      verifiedAt: employer.company.isVerified ? now : null,
    },
    select: { id: true, slug: true, status: true, title: true },
  });
  if (status === "PENDING_REVIEW") await notifyReview(employer, job.id, job.title, false);
  return job;
}

/** Loads a job only if it belongs to the signed-in company. */
export async function findEmployerJob(employer: EmployerContext, jobId: string) {
  return db.job.findFirst({ where: { id: jobId, companyId: employer.companyId } });
}

export async function updateEmployerJob(employer: EmployerContext, jobId: string, data: EmployerJobInput, now = new Date()) {
  const existing = await findEmployerJob(employer, jobId);
  if (!existing) throw new EmployerJobError("Job not found.");
  if (existing.status === "REJECTED") throw new EmployerJobError("This job was rejected by JobDraftly. Contact us to discuss it.");
  await assertReferences(data);
  const deadline = parseEmployerDeadline(data.applicationDeadline, now);

  // Closed or expired jobs are re-opened by editing; live jobs of unverified companies go back to review.
  const wasLive = existing.status === "PUBLISHED";
  const status = existing.status === "DRAFT" ? "DRAFT" : employerJobStatus(employer.company.isVerified);
  const job = await db.job.update({
    where: { id: existing.id },
    data: {
      ...jobFields(data, deadline),
      status,
      publishedAt: status === "PUBLISHED" ? existing.publishedAt ?? now : null,
      originalPublishedAt: status === "PUBLISHED" ? existing.originalPublishedAt ?? now : existing.originalPublishedAt,
      isFeatured: status === "PUBLISHED" ? existing.isFeatured : false,
    },
    select: { id: true, slug: true, status: true, title: true },
  });
  if (status === "PENDING_REVIEW") await notifyReview(employer, job.id, job.title, wasLive);
  return job;
}

/** Stops a live job from accepting candidates (it disappears from the public site). */
export async function closeEmployerJob(employer: EmployerContext, jobId: string) {
  const result = await db.job.updateMany({
    where: { id: jobId, companyId: employer.companyId, status: { in: ["PUBLISHED", "PENDING_REVIEW"] } },
    data: { status: "CLOSED", isFeatured: false },
  });
  if (!result.count) throw new EmployerJobError("Only open jobs can be closed.");
}
