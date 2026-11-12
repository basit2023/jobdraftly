"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { RawImportRow } from "@/lib/imports/csv";
import { guessColumnMapping } from "@/lib/imports/fields";
import { createStagedImport, sha256 } from "@/lib/imports/staging";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { processSourceDocument } from "@/lib/monitoring/extraction";
import { publishDiscoveredJobs } from "@/lib/monitoring/publisher";
import { scanSource } from "@/lib/monitoring/runner";
import { createAuditLog } from "@/lib/services/admin-audit";
import { sourceMonitoringSchema } from "@/lib/validations/admin-forms";

function rawValue(payload: unknown, names: string[]) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const entries = Object.entries(payload);
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase().replaceAll("_", "") === name.toLowerCase().replaceAll("_", ""));
    if (match) return String(match[1] ?? "");
  }
  return "";
}

export async function updateSourceMonitoringAction(sourceId: string, formData: FormData) {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const parsed = sourceMonitoringSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid monitoring settings.");
  const source = await db.jobSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source not found.");
  const settings = parsed.data;
  if (settings.monitoringEnabled) {
    if (!source.isActive || source.permissionStatus !== "APPROVED") throw new Error("Approve and activate this source before monitoring.");
    if (!source.feedUrl?.startsWith("https://")) throw new Error("An HTTPS monitoring endpoint is required.");
    if (settings.monitoringMode === "API" && source.type !== "API") throw new Error("API monitoring requires an API source.");
    if (settings.monitoringMode === "RSS" && source.type !== "XML_FEED") throw new Error("RSS monitoring requires an XML feed source.");
    if (settings.monitoringMode === "WEB_PAGE" && !["EMPLOYER_WEBSITE", "JOB_BOARD", "GOVERNMENT_PORTAL"].includes(source.type)) {
      throw new Error("Web-page monitoring is limited to explicitly permitted website sources.");
    }
    if (settings.monitoringMode === "WEB_PAGE" && settings.rateLimitPerMinute < 2) {
      throw new Error("Permitted web-page monitoring needs a limit of at least two requests per minute so robots.txt can be checked before the page request.");
    }
    if (settings.monitoringMode === "DISABLED") throw new Error("Choose a monitoring mode before enabling the source.");
  }
  await db.jobSource.update({
    where: { id: source.id },
    data: {
      ...settings,
      nextScanAt: settings.monitoringEnabled ? new Date() : null,
      monitorLeaseUntil: null,
    },
  });
  await createAuditLog({
    adminId: admin.id,
    action: "UPDATE",
    entityType: "JobSource",
    entityId: source.id,
    summary: `${settings.monitoringEnabled ? "Enabled" : "Disabled"} monitoring for ${source.name}`,
    metadata: settings,
  });
  revalidatePath("/admin/sources");
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/jobs");
}

export async function runSourceNowAction(sourceId: string) {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const scan = await scanSource(sourceId);
  const publishing = scan.status === "SUCCESS" ? await publishDiscoveredJobs({ sourceId }) : null;
  const result = { ...scan, publishing };
  await createAuditLog({
    adminId: admin.id,
    action: "SYNC",
    entityType: "JobSource",
    entityId: sourceId,
    summary: `Ran authorized source monitor: ${result.status}`,
    metadata: result,
  });
  revalidatePath("/admin/sources");
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/jobs");
}

export async function setDiscoveryReviewAction(id: string, status: "REVIEWED" | "DISMISSED") {
  const admin = await requireAdmin();
  const discovery = await db.sourceDiscovery.update({ where: { id }, data: { status } });
  await createAuditLog({
    adminId: admin.id,
    action: status === "REVIEWED" ? "APPROVE" : "REJECT",
    entityType: "SourceDiscovery",
    entityId: id,
    summary: `${status === "REVIEWED" ? "Reviewed" : "Dismissed"} discovery: ${discovery.title}`,
  });
  revalidatePath("/admin/monitoring");
}

export async function applyDiscoveryToRelatedJobAction(id: string) {
  const admin = await requireAdmin(["SUPER_ADMIN", "ADMIN"]);
  const discovery = await db.sourceDiscovery.findUnique({
    where: { id },
    include: { relatedJob: true },
  });
  if (!discovery?.relatedJob) throw new Error("This discovery is not linked to an existing job.");

  if (discovery.latestChangeType === "DEADLINE_CHANGED" && discovery.deadline) {
    await db.job.update({
      where: { id: discovery.relatedJob.id },
      data: {
        applicationDeadline: discovery.deadline,
        expiresAt: discovery.relatedJob.expiresAt && discovery.relatedJob.expiresAt > discovery.deadline
          ? discovery.relatedJob.expiresAt
          : discovery.deadline,
      },
    });
  } else if (["CANCELLED", "REMOVED"].includes(discovery.latestChangeType)) {
    await db.job.update({
      where: { id: discovery.relatedJob.id },
      data: { status: "CLOSED", isFeatured: false },
    });
  } else {
    throw new Error("This change must be reviewed and edited manually; no safe automatic job update is available.");
  }

  await db.sourceDiscovery.update({ where: { id }, data: { status: "REVIEWED" } });
  await createAuditLog({
    adminId: admin.id,
    action: "UPDATE",
    entityType: "Job",
    entityId: discovery.relatedJob.id,
    summary: `Applied reviewed source change to job: ${discovery.relatedJob.title}`,
    metadata: { discoveryId: discovery.id, changeType: discovery.latestChangeType },
  });
  revalidatePath("/admin/monitoring");
  revalidatePath("/admin/jobs");
  revalidatePath(`/jobs/${discovery.relatedJob.slug}`);
}

export async function retryDocumentExtractionAction(documentId: string) {
  await requireAdmin();
  await db.sourceDocument.update({ where: { id: documentId }, data: { extractionStatus: "PENDING", extractionError: null } });
  await processSourceDocument(documentId);
  revalidatePath("/admin/monitoring");
}

export async function stageDiscoveryAsJobAction(discoveryId: string) {
  const admin = await requireAdmin();
  const discovery = await db.sourceDiscovery.findUnique({
    where: { id: discoveryId },
    include: { source: true },
  });
  if (!discovery || discovery.type !== "JOB") throw new Error("Only a job discovery can enter the job import workflow.");
  if (!discovery.source.isActive || discovery.source.permissionStatus !== "APPROVED") throw new Error("The source must remain active and approved.");
  const raw: RawImportRow = {
    title: discovery.title,
    description: discovery.summary ?? rawValue(discovery.rawPayload, ["description", "summary"]),
    company: rawValue(discovery.rawPayload, ["company", "organization", "employer"]),
    city: rawValue(discovery.rawPayload, ["city", "location"]),
    category: rawValue(discovery.rawPayload, ["category"]),
    employment_type: rawValue(discovery.rawPayload, ["employmentType", "jobType"]),
    experience_level: rawValue(discovery.rawPayload, ["experienceLevel"]),
    salary: rawValue(discovery.rawPayload, ["salary"]),
    source_url: discovery.canonicalUrl,
    application_url: rawValue(discovery.rawPayload, ["applicationUrl", "applyUrl"]),
    publication_date: discovery.sourcePublishedAt?.toISOString() ?? "",
    deadline: discovery.deadline?.toISOString() ?? "",
    source_job_id: discovery.externalId ?? "",
  };
  const headers = Object.keys(raw);
  const method = discovery.source.type === "API" ? "API" : discovery.source.type === "XML_FEED" ? "RSS" : "CSV";
  const created = await createStagedImport({
    sourceId: discovery.sourceId,
    uploadedById: admin.id,
    fileName: `monitor-${discovery.source.slug}-${discovery.id}.${method === "API" ? "json" : method === "RSS" ? "xml" : "csv"}`.slice(0, 255),
    fileChecksum: sha256(`monitor:${discovery.id}:${discovery.fingerprint}`),
    method,
    sourceUrl: discovery.canonicalUrl,
    rows: [raw],
    mapping: guessColumnMapping(headers),
  });
  await db.sourceDiscovery.update({ where: { id: discovery.id }, data: { status: "REVIEWED" } });
  await createAuditLog({
    adminId: admin.id,
    action: "IMPORT",
    entityType: "SourceDiscovery",
    entityId: discovery.id,
    summary: `Staged monitored job for review: ${discovery.title}`,
    metadata: { importId: created.id },
  });
  redirect(`/admin/imports/${created.id}/map`);
}

export async function markNotificationReadAction(id: string) {
  await requireAdmin();
  await db.adminNotification.update({ where: { id }, data: { readAt: new Date() } });
  revalidatePath("/admin/monitoring");
}
