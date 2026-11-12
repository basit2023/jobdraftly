"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { rowsFromApiPayload, rowsFromRss } from "@/lib/imports/connectors";
import { guessColumnMapping, importFields, columnMappingSchema } from "@/lib/imports/fields";
import { fetchApprovedSource } from "@/lib/imports/network";
import { commitStagedImport, createStagedImport, sha256, validateStagedImport } from "@/lib/imports/staging";
import { createAuditLog } from "@/lib/services/admin-audit";

export async function validateImportMappingAction(importId: string, formData: FormData) {
  await requireAdmin();
  const parsed = columnMappingSchema.safeParse(Object.fromEntries(importFields.map((field) => [field, String(formData.get(field) ?? "") || undefined])));
  if (!parsed.success) redirect(`/admin/imports/${importId}/map?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid mapping")}`);
  await validateStagedImport(importId, parsed.data);
  revalidatePath(`/admin/imports/${importId}/preview`);
  redirect(`/admin/imports/${importId}/preview`);
}

export async function confirmImportAction(importId: string) {
  const admin = await requireAdmin();
  const result = await commitStagedImport(importId);
  await createAuditLog({ adminId: admin.id, action: "IMPORT", entityType: "JobImport", entityId: importId, summary: `Imported ${result.importedRows} vacancies into review`, metadata: result });
  revalidatePath("/admin/imports");
  revalidatePath("/admin/jobs");
  redirect(`/admin/imports/${importId}/preview?completed=1`);
}

export async function stageConnectorImportAction(formData: FormData) {
  const admin = await requireAdmin();
  const sourceId = String(formData.get("sourceId") ?? "");
  const method = String(formData.get("method") ?? "");
  if (method !== "API" && method !== "RSS") throw new Error("Unsupported connector type.");
  const source = await db.jobSource.findFirst({ where: { id: sourceId, isActive: true, permissionStatus: "APPROVED", type: method === "API" ? "API" : "XML_FEED" } });
  if (!source?.feedUrl) throw new Error("This approved source does not have a connector endpoint.");
  const response = await fetchApprovedSource(source.feedUrl);
  const rows = method === "API" ? rowsFromApiPayload(JSON.parse(response.body)) : rowsFromRss(response.body);
  if (rows.length > 1_000) throw new Error("Connector imports are limited to 1,000 rows per run.");
  const headers = Object.keys(rows[0] ?? {});
  const created = await createStagedImport({ sourceId, uploadedById: admin.id, fileName: `${source.slug}-${new Date().toISOString()}.${method === "API" ? "json" : "xml"}`.slice(0, 255), fileChecksum: sha256(`${source.id}:${response.body}:${randomUUID()}`), method, sourceUrl: source.feedUrl, rows, mapping: guessColumnMapping(headers) });
  await db.jobSource.update({ where: { id: source.id }, data: { lastSyncAt: new Date() } });
  await createAuditLog({ adminId: admin.id, action: "SYNC", entityType: "JobSource", entityId: source.id, summary: `Staged ${rows.length} ${method} records from ${source.name}` });
  redirect(`/admin/imports/${created.id}/map`);
}

export async function approveImportedJobAction(id: string) {
  const admin = await requireAdmin();
  const job = await db.job.findFirst({ where: { id, jobImportId: { not: null }, status: "PENDING_REVIEW" } });
  if (!job) throw new Error("Only a pending imported vacancy can be approved.");
  await db.job.update({ where: { id }, data: { status: "DRAFT", verificationStatus: "VERIFIED", verifiedAt: new Date(), verifiedById: admin.id } });
  await createAuditLog({ adminId: admin.id, action: "APPROVE", entityType: "Job", entityId: id, summary: `Approved imported job: ${job.title}` });
  revalidatePath("/admin/imports");
}

export async function rejectImportedJobAction(id: string) {
  const admin = await requireAdmin();
  const job = await db.job.findFirst({ where: { id, jobImportId: { not: null }, status: "PENDING_REVIEW" } });
  if (!job) throw new Error("Only a pending imported vacancy can be rejected.");
  await db.job.update({ where: { id }, data: { status: "REJECTED", verificationStatus: "REJECTED", verifiedAt: null, verifiedById: admin.id, isFeatured: false } });
  await createAuditLog({ adminId: admin.id, action: "REJECT", entityType: "Job", entityId: id, summary: `Rejected imported job: ${job.title}` });
  revalidatePath("/admin/imports");
}

export async function expireImportedJobAction(id: string) {
  const admin = await requireAdmin();
  const job = await db.job.findFirst({ where: { id, jobImportId: { not: null } } });
  if (!job) throw new Error("Imported vacancy not found.");
  await db.job.update({ where: { id }, data: { status: "EXPIRED", isFeatured: false, expiresAt: job.expiresAt ?? new Date() } });
  await createAuditLog({ adminId: admin.id, action: "EXPIRE", entityType: "Job", entityId: id, summary: `Expired imported job: ${job.title}` });
  revalidatePath("/admin/imports");
  revalidatePath("/");
}

