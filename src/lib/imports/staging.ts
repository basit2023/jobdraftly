import "server-only";

import { createHash } from "node:crypto";

import { Prisma, type JobImportMethod } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { createEntitySlug } from "@/lib/services/entity-slug";
import { createJobDeduplicationKey, createJobSlug, createSourceUrlHash, normalizeMatchingText } from "@/lib/services/job-identity";

import type { RawImportRow } from "./csv";
import type { ColumnMapping } from "./fields";
import { normalizeImportRow, type NormalizedImportRow } from "./normalize";

export function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

export async function createStagedImport(input: {
  sourceId: string;
  uploadedById: string;
  fileName: string;
  fileChecksum: string;
  method: JobImportMethod;
  sourceUrl?: string | null;
  rows: RawImportRow[];
  mapping?: ColumnMapping;
}) {
  const source = await db.jobSource.findFirst({
    where: { id: input.sourceId, isActive: true, permissionStatus: "APPROVED" },
    select: { id: true, type: true },
  });
  if (!source) throw new Error("Select an active source whose permission has been approved.");
  const allowedTypes: Record<JobImportMethod, string[]> = {
    CSV: ["CSV", "EMPLOYER_WEBSITE", "JOB_BOARD", "GOVERNMENT_PORTAL"],
    API: ["API"],
    RSS: ["XML_FEED"],
  };
  if (!allowedTypes[input.method].includes(source.type)) throw new Error(`This source is not configured for ${input.method} imports.`);

  return db.jobImport.create({
    data: {
      sourceId: input.sourceId,
      uploadedById: input.uploadedById,
      fileName: input.fileName,
      fileChecksum: input.fileChecksum,
      method: input.method,
      sourceUrl: input.sourceUrl,
      columnMapping: input.mapping as Prisma.InputJsonValue | undefined,
      totalRows: input.rows.length,
      rows: {
        create: input.rows.map((rawData, index) => ({
          rowNumber: index + 2,
          rawData: rawData as Prisma.InputJsonValue,
        })),
      },
    },
    select: { id: true },
  });
}

function asRawData(value: Prisma.JsonValue): RawImportRow {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item == null ? "" : String(item)]));
}

type StagedNormalizedRow = NormalizedImportRow & { categoryId: string | null; locationId: string | null; companyId: string | null };

function asNormalizedData(value: Prisma.JsonValue | null): StagedNormalizedRow | null {
  return value && !Array.isArray(value) && typeof value === "object" ? value as StagedNormalizedRow : null;
}

export async function validateStagedImport(importId: string, mapping: ColumnMapping) {
  const jobImport = await db.jobImport.findUnique({
    where: { id: importId },
    include: { rows: { orderBy: { rowNumber: "asc" } } },
  });
  if (!jobImport || jobImport.status === "COMPLETED" || jobImport.status === "COMPLETED_WITH_ERRORS") {
    throw new Error("This import cannot be validated.");
  }

  await db.jobImport.update({ where: { id: importId }, data: { status: "PROCESSING", startedAt: jobImport.startedAt ?? new Date(), columnMapping: mapping as Prisma.InputJsonValue } });
  const [categories, locations, companies] = await Promise.all([
    db.jobCategory.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    db.jobLocation.findMany({ where: { isActive: true, type: "CITY" }, select: { id: true, name: true } }),
    db.company.findMany({ select: { id: true, name: true } }),
  ]);
  const categoryMap = new Map(categories.map((item) => [normalizeMatchingText(item.name), item.id]));
  const locationMap = new Map(locations.map((item) => [normalizeMatchingText(item.name), item.id]));
  const companyMap = new Map(companies.map((item) => [normalizeMatchingText(item.name), item.id]));
  const seen = new Set<string>();
  let validRows = 0;
  let duplicateRows = 0;
  let rejectedRows = 0;

  for (const row of jobImport.rows) {
    const normalized = normalizeImportRow(asRawData(row.rawData), mapping);
    const categoryId = categoryMap.get(normalizeMatchingText(normalized.data.category));
    const locationId = locationMap.get(normalizeMatchingText(normalized.data.city));
    const companyId = companyMap.get(normalizeMatchingText(normalized.data.company)) ?? null;
    if (!categoryId) normalized.errors.push(`Unknown active category: ${normalized.data.category}.`);
    if (!locationId) normalized.errors.push(`Unknown active Pakistani city: ${normalized.data.city}.`);

    let duplicateJobId: string | null = null;
    const sourceUrlHash = normalized.data.sourceUrl ? createSourceUrlHash(normalized.data.sourceUrl) : null;
    if (!normalized.errors.length) {
      const localKey = normalized.data.sourceExternalId
        ? `id:${normalizeMatchingText(normalized.data.sourceExternalId)}`
        : sourceUrlHash
          ? `url:${sourceUrlHash}`
          : `fallback:${normalizeMatchingText(normalized.data.title)}:${normalizeMatchingText(normalized.data.company)}:${locationId}`;
      if (seen.has(localKey)) {
        duplicateRows++;
        await db.jobImportRow.update({ where: { id: row.id }, data: { status: "DUPLICATE", normalizedData: { ...normalized.data, categoryId, locationId, companyId } as Prisma.InputJsonValue, errorMessages: ["Duplicate row within this import."], duplicateJobId: null } });
        continue;
      }
      seen.add(localKey);
      const conditions: Prisma.JobWhereInput[] = [];
      if (normalized.data.sourceExternalId) conditions.push({ sourceId: jobImport.sourceId, sourceExternalId: normalized.data.sourceExternalId });
      if (sourceUrlHash) conditions.push({ sourceUrlHash });
      if (conditions.length) duplicateJobId = (await db.job.findFirst({ where: { OR: conditions }, select: { id: true } }))?.id ?? null;
      if (!duplicateJobId && companyId && locationId) {
        const titleCandidates = await db.job.findMany({ where: { companyId, locationId }, select: { id: true, title: true }, take: 100 });
        duplicateJobId = titleCandidates.find((candidate) => normalizeMatchingText(candidate.title) === normalizeMatchingText(normalized.data.title))?.id ?? null;
      }
    }
    const normalizedData = { ...normalized.data, categoryId: categoryId ?? null, locationId: locationId ?? null, companyId };
    if (normalized.errors.length) {
      rejectedRows++;
      await db.jobImportRow.update({ where: { id: row.id }, data: { status: "INVALID", normalizedData: normalizedData as Prisma.InputJsonValue, errorMessages: normalized.errors, duplicateJobId: null } });
    } else if (duplicateJobId) {
      duplicateRows++;
      await db.jobImportRow.update({ where: { id: row.id }, data: { status: "DUPLICATE", normalizedData: normalizedData as Prisma.InputJsonValue, errorMessages: ["A matching vacancy already exists."], duplicateJobId } });
    } else {
      validRows++;
      await db.jobImportRow.update({ where: { id: row.id }, data: { status: "VALID", normalizedData: normalizedData as Prisma.InputJsonValue, errorMessages: Prisma.JsonNull, duplicateJobId: null } });
    }
  }
  await db.jobImport.update({ where: { id: importId }, data: { status: "PENDING", importedRows: 0, duplicateRows, rejectedRows, errorSummary: rejectedRows ? { rejectedRows } : Prisma.JsonNull } });
  return { validRows, duplicateRows, rejectedRows };
}

export async function uniqueCompanySlug(name: string) {
  const base = createEntitySlug(name);
  let slug = base;
  let counter = 2;
  while (await db.company.findUnique({ where: { slug }, select: { id: true } })) slug = `${base}-${counter++}`;
  return slug;
}

export async function commitStagedImport(importId: string) {
  const jobImport = await db.jobImport.findUnique({
    where: { id: importId },
    include: { source: true, rows: { where: { status: "VALID" }, orderBy: { rowNumber: "asc" } } },
  });
  if (!jobImport || jobImport.status !== "PENDING") throw new Error("Only a validated pending import can be confirmed.");
  await db.jobImport.update({ where: { id: importId }, data: { status: "PROCESSING" } });
  let importedRows = 0;
  let rejectedRows = jobImport.rejectedRows;
  const companyCache = new Map<string, { id: string; slug: string }>();

  for (const row of jobImport.rows) {
    const data = asNormalizedData(row.normalizedData);
    if (!data?.categoryId || !data.locationId) {
      rejectedRows++;
      await db.jobImportRow.update({ where: { id: row.id }, data: { status: "INVALID", errorMessages: ["Validated row data is incomplete."] } });
      continue;
    }
    try {
      const companyKey = normalizeMatchingText(data.company);
      let company = companyCache.get(companyKey);
      if (!company) {
        const existing = await db.company.findFirst({ where: { name: data.company }, select: { id: true, slug: true } });
        company = existing ?? await db.company.create({ data: { name: data.company, slug: await uniqueCompanySlug(data.company), locationId: data.locationId, isVerified: false, isActive: true }, select: { id: true, slug: true } });
        companyCache.set(companyKey, company);
      }
      const deadline = data.deadline ? new Date(data.deadline) : null;
      const deduplicationKey = createJobDeduplicationKey({ title: data.title, companyId: company.id, locationId: data.locationId, sourceId: jobImport.sourceId, sourceExternalId: data.sourceExternalId, sourceUrl: data.sourceUrl, applicationUrl: data.applicationUrl, applicationDeadline: deadline });
      await db.job.create({
        data: {
          title: data.title,
          slug: createJobSlug(data.title, company.slug),
          companyId: company.id,
          categoryId: data.categoryId,
          locationId: data.locationId,
          description: data.description,
          employmentType: data.employmentType,
          experienceLevel: data.experienceLevel,
          salaryMin: data.salaryMin,
          salaryMax: data.salaryMax,
          salaryVisibility: data.salaryVisibility,
          salaryCurrency: "PKR",
          workplaceType: "NOT_SPECIFIED",
          applicationMethod: "EXTERNAL_URL",
          applicationUrl: data.applicationUrl,
          sourceId: jobImport.sourceId,
          sourceUrl: data.sourceUrl,
          sourceExternalId: data.sourceExternalId,
          sourceUrlHash: createSourceUrlHash(data.sourceUrl),
          deduplicationKey,
          jobImportId: jobImport.id,
          originalPublishedAt: data.publicationDate ? new Date(data.publicationDate) : null,
          applicationDeadline: deadline,
          expiresAt: null,
          status: "PENDING_REVIEW",
          verificationStatus: "UNVERIFIED",
        },
      });
      await db.jobImportRow.update({ where: { id: row.id }, data: { status: "IMPORTED" } });
      importedRows++;
    } catch (error) {
      rejectedRows++;
      console.error(error);
      await db.jobImportRow.update({ where: { id: row.id }, data: { status: "INVALID", errorMessages: ["A duplicate or database constraint blocked this row."] } });
    }
  }
  const status = rejectedRows || jobImport.duplicateRows ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  await db.jobImport.update({ where: { id: importId }, data: { status, importedRows, rejectedRows, completedAt: new Date() } });
  return { importedRows, rejectedRows, status };
}

