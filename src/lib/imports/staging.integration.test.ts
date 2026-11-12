import { randomUUID } from "node:crypto";

import { hashSync } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PrismaClient } from "@/generated/prisma/client";
import { createDatabaseAdapter } from "@/lib/db/adapter";

import type { ColumnMapping } from "./fields";
import { commitStagedImport, createStagedImport, validateStagedImport } from "./staging";

const runDatabaseTests = Boolean(process.env.DATABASE_URL);

describe.runIf(runDatabaseTests)("import duplicate detection database workflow", () => {
  const db = new PrismaClient({ adapter: createDatabaseAdapter() });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const companyName = `Import QA Company ${suffix}`;
  const sourceUrl = `https://example.invalid/qa/${suffix}`;
  let adminId = "";
  let sourceId = "";
  const importIds: string[] = [];

  const mapping: ColumnMapping = {
    title: "title",
    company: "company",
    description: "description",
    city: "city",
    category: "category",
    sourceUrl: "source_url",
    applicationUrl: "application_url",
    sourceExternalId: "source_job_id",
  };

  beforeAll(async () => {
    const admin = await db.admin.create({
      data: {
        name: "Import QA Admin",
        email: `import-qa-${suffix}@example.invalid`,
        passwordHash: hashSync("QA-only-password!2026", 10),
        role: "ADMIN",
      },
    });
    adminId = admin.id;
    const source = await db.jobSource.create({
      data: {
        name: `Import QA Source ${suffix}`,
        slug: `import-qa-source-${suffix}`,
        type: "CSV",
        permissionStatus: "APPROVED",
        approvedAt: new Date(),
        isActive: true,
      },
    });
    sourceId = source.id;
  });

  afterAll(async () => {
    await db.job.deleteMany({ where: { jobImportId: { in: importIds } } });
    await db.jobImport.deleteMany({ where: { id: { in: importIds } } });
    await db.company.deleteMany({ where: { name: companyName } });
    if (sourceId) await db.jobSource.deleteMany({ where: { id: sourceId } });
    if (adminId) await db.admin.deleteMany({ where: { id: adminId } });
    await db.$disconnect();
  });

  it("retains source attribution and blocks duplicates within and across imports", async () => {
    const category = await db.jobCategory.findFirstOrThrow({ where: { slug: "information-technology-software" } });
    const baseRow = {
      title: `QA Import Analyst ${suffix}`,
      company: companyName,
      description: "Development-only import record used to verify duplicate handling and removed after the test.",
      city: "Karachi",
      category: category.name,
      source_url: sourceUrl,
      application_url: `${sourceUrl}/apply`,
      source_job_id: `QA-${suffix}`,
    };

    const first = await createStagedImport({
      sourceId,
      uploadedById: adminId,
      fileName: `phase9-first-${suffix}.csv`,
      fileChecksum: `${suffix.padEnd(64, "a")}`.slice(0, 64),
      method: "CSV",
      rows: [baseRow, { ...baseRow }],
      mapping,
    });
    importIds.push(first.id);
    await expect(validateStagedImport(first.id, mapping)).resolves.toEqual({ validRows: 1, duplicateRows: 1, rejectedRows: 0 });
    await expect(commitStagedImport(first.id)).resolves.toMatchObject({ importedRows: 1 });

    const imported = await db.job.findFirstOrThrow({ where: { jobImportId: first.id } });
    expect(imported).toMatchObject({
      sourceId,
      sourceUrl,
      sourceExternalId: `QA-${suffix}`,
      status: "PENDING_REVIEW",
      verificationStatus: "UNVERIFIED",
    });

    const second = await createStagedImport({
      sourceId,
      uploadedById: adminId,
      fileName: `phase9-second-${suffix}.csv`,
      fileChecksum: `${suffix.padEnd(64, "b")}`.slice(0, 64),
      method: "CSV",
      rows: [baseRow],
      mapping,
    });
    importIds.push(second.id);
    await expect(validateStagedImport(second.id, mapping)).resolves.toEqual({ validRows: 0, duplicateRows: 1, rejectedRows: 0 });
    const duplicate = await db.jobImportRow.findFirstOrThrow({ where: { jobImportId: second.id } });
    expect(duplicate.duplicateJobId).toBe(imported.id);
  });
});
