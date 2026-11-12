import "server-only";

import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { assertPublicSourceUrl } from "@/lib/imports/network";

import { canonicalExtractionSchema } from "./extraction-contract";

const extractionResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  extractedData: canonicalExtractionSchema,
  documentReference: z.string().trim().max(255).optional(),
}).strict();

export function extractionIsConfigured() {
  return Boolean(
    process.env.AI_EXTRACTION_WEBHOOK_URL?.trim() &&
    process.env.AI_EXTRACTION_WEBHOOK_SECRET?.trim(),
  );
}

export async function processSourceDocument(documentId: string) {
  const endpointValue = process.env.AI_EXTRACTION_WEBHOOK_URL?.trim();
  const secret = process.env.AI_EXTRACTION_WEBHOOK_SECRET?.trim();
  if (!endpointValue || !secret) {
    await db.sourceDocument.update({
      where: { id: documentId },
      data: { extractionStatus: "NOT_CONFIGURED" },
    });
    return { status: "NOT_CONFIGURED" as const };
  }

  const endpoint = await assertPublicSourceUrl(endpointValue);
  const document = await db.sourceDocument.findUnique({
    where: { id: documentId },
    include: { discovery: { include: { source: true } } },
  });
  if (!document) throw new Error("Document not found.");

  await db.sourceDocument.update({
    where: { id: document.id },
    data: { extractionStatus: "PROCESSING", extractionError: null },
  });
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
        "User-Agent": "JobDraftly/1.0 (+https://www.jobdraftly.com)",
      },
      body: JSON.stringify({
        documentId: document.id,
        documentUrl: document.url,
        mimeType: document.mimeType,
        sourceName: document.discovery.source.name,
        sourceUrl: document.discovery.canonicalUrl,
        discoveredAt: document.discoveredAt.toISOString(),
      }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Extraction service responded with HTTP ${response.status}.`);
    const parsed = extractionResponseSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Extraction service returned an invalid response.");

    await db.$transaction([
      db.sourceDocument.update({
        where: { id: document.id },
        data: {
          extractionStatus: "SUCCEEDED",
          confidenceScore: parsed.data.confidence,
          extractedData: parsed.data.extractedData as Prisma.InputJsonValue,
          documentReference: parsed.data.documentReference ?? document.documentReference,
          extractionError: null,
          processedAt: new Date(),
        },
      }),
      db.sourceDiscovery.update({
        where: { id: document.discoveryId },
        data: {
          extractionStatus: "SUCCEEDED",
          confidenceScore: parsed.data.confidence,
          extractedData: parsed.data.extractedData as Prisma.InputJsonValue,
          extractionError: null,
        },
      }),
    ]);
    return { status: "SUCCEEDED" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2_000) : "Document extraction failed.";
    await db.$transaction([
      db.sourceDocument.update({
        where: { id: document.id },
        data: { extractionStatus: "FAILED", extractionError: message, processedAt: new Date() },
      }),
      db.sourceDiscovery.update({
        where: { id: document.discoveryId },
        data: { extractionStatus: "FAILED", extractionError: message },
      }),
      db.adminNotification.create({
        data: {
          type: "EXTRACTION_FAILURE",
          title: "Document extraction failed",
          message: `${document.discovery.source.name}: ${document.discovery.title}`,
          entityType: "SourceDocument",
          entityId: document.id,
        },
      }),
    ]);
    return { status: "FAILED" as const, error: message };
  }
}

export async function processPendingDocuments(sourceId: string, limit = 5) {
  if (!extractionIsConfigured()) return { processed: 0, configured: false };
  const documents = await db.sourceDocument.findMany({
    where: {
      discovery: { sourceId },
      extractionStatus: { in: ["PENDING", "NOT_CONFIGURED"] },
    },
    orderBy: { discoveredAt: "asc" },
    take: Math.min(Math.max(limit, 1), 20),
    select: { id: true },
  });
  for (const document of documents) await processSourceDocument(document.id);
  return { processed: documents.length, configured: true };
}
