import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type ApplicationStatus } from "@/generated/prisma/client";
import type { EmployerContext } from "@/lib/auth/employer-session";
import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";
import { safeDownloadName, validateCvDocument } from "@/lib/security/document-validation";
import { publishedJobWhere } from "@/lib/services/public-jobs";
import { deletePrivateFile, savePrivateFile } from "@/lib/storage/private-store";
import { applicationFormSchema } from "@/lib/validations/employer";

export class ApplicationError extends Error {
  constructor(message: string, readonly field?: string) {
    super(message);
  }
}

/** Applications (and their CVs) are deleted this many days after they were sent. */
export function applicationRetentionDays() {
  const value = Number(process.env.APPLICATION_RETENTION_DAYS);
  return Number.isFinite(value) ? Math.min(Math.max(value, 30), 1_095) : 365;
}

/** A candidate applies to a live ON_SITE job. */
export async function submitApplication(input: {
  jobId: string;
  fields: Record<string, unknown>;
  cv: { name: string; bytes: Uint8Array } | null;
}) {
  const parsed = applicationFormSchema.safeParse(input.fields);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApplicationError(issue?.message ?? "Check the form and try again.", String(issue?.path[0] ?? ""));
  }
  const job = await db.job.findFirst({
    where: { AND: [publishedJobWhere(), { id: input.jobId, applicationMethod: "ON_SITE" }] },
    select: { id: true, companyId: true, title: true },
  });
  if (!job) throw new ApplicationError("This job is no longer accepting applications.");
  if (!input.cv) throw new ApplicationError("Attach your CV (PDF or Word, up to 5 MB).", "cv");
  const document = validateCvDocument(input.cv.bytes);
  if (!document) throw new ApplicationError("Your CV must be a PDF or Word file (.pdf, .docx, .doc) up to 5 MB.", "cv");

  const already = await db.jobApplication.findUnique({
    where: { jobId_email: { jobId: job.id, email: parsed.data.email } },
    select: { id: true },
  });
  if (already) throw new ApplicationError("You have already applied for this job with this email address.", "email");

  const cvStorageKey = `cvs/${job.companyId.toLowerCase()}/${randomUUID()}.${document.extension}`;
  await savePrivateFile(cvStorageKey, input.cv.bytes, document.mimeType);
  try {
    return await db.jobApplication.create({
      data: {
        jobId: job.id,
        companyId: job.companyId,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        city: parsed.data.city,
        coverLetter: parsed.data.coverLetter,
        cvStorageKey,
        cvFileName: safeDownloadName(input.cv.name, document.extension),
        cvMimeType: document.mimeType,
        cvSizeBytes: input.cv.bytes.byteLength,
      },
      select: { id: true },
    });
  } catch (error) {
    await deletePrivateFile(cvStorageKey).catch(() => undefined);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ApplicationError("You have already applied for this job with this email address.", "email");
    }
    throw error;
  }
}

/** One application, only if it belongs to the signed-in company. Marks it as seen. */
export async function getEmployerApplication(employer: EmployerContext, id: string) {
  const application = await db.jobApplication.findFirst({
    where: { id, companyId: employer.companyId },
    include: { job: { select: { id: true, title: true, slug: true, status: true } } },
  });
  if (application && !application.viewedAt) {
    await db.jobApplication.update({ where: { id: application.id }, data: { viewedAt: new Date() } });
  }
  return application;
}

export async function updateApplicationStatus(employer: EmployerContext, id: string, status: ApplicationStatus) {
  const result = await db.jobApplication.updateMany({
    where: { id, companyId: employer.companyId },
    data: { status, statusChangedAt: new Date() },
  });
  if (!result.count) throw new ApplicationError("Application not found.");
}

export async function saveApplicationNotes(employer: EmployerContext, id: string, notes: string) {
  const result = await db.jobApplication.updateMany({
    where: { id, companyId: employer.companyId },
    data: { employerNotes: notes.trim().slice(0, 5_000) || null },
  });
  if (!result.count) throw new ApplicationError("Application not found.");
}

/** Deletes applications older than the retention period, CVs first. Run by the worker. */
export async function purgeOldApplications(now = new Date(), scope: { companyId?: string } = {}) {
  const cutoff = new Date(now.getTime() - applicationRetentionDays() * 86_400_000);
  const old = await db.jobApplication.findMany({
    where: { createdAt: { lt: cutoff }, ...(scope.companyId ? { companyId: scope.companyId } : {}) },
    select: { id: true, cvStorageKey: true },
    take: 500,
  });
  let deleted = 0;
  for (const application of old) {
    try {
      await deletePrivateFile(application.cvStorageKey);
      await db.jobApplication.delete({ where: { id: application.id } });
      deleted++;
    } catch (error) {
      logger.warn("applications.purge_failed", { applicationId: application.id, error });
    }
  }
  return deleted;
}
