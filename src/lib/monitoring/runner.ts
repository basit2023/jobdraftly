import "server-only";

import { createHash } from "node:crypto";

import {
  Prisma,
  type DiscoveryChangeType,
  type JobSource,
} from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";
import { createSourceUrlHash, normalizeMatchingText } from "@/lib/services/job-identity";

import { discoverContent } from "./discovery";
import { extractionIsConfigured, processPendingDocuments } from "./extraction";
import { publishDiscoveredJobs, syncJobsWithSources } from "./publisher";
import { assertRobotsPermission, fetchMonitoredSource } from "./network";
import type { DiscoveryCandidate } from "./types";

const LEASE_MILLISECONDS = 5 * 60_000;

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function candidateKey(candidate: DiscoveryCandidate) {
  return sha256(candidate.externalId ? `id:${candidate.externalId}` : `url:${candidate.canonicalUrl}`);
}

function snapshot(candidate: DiscoveryCandidate) {
  return {
    externalId: candidate.externalId,
    canonicalUrl: candidate.canonicalUrl,
    title: candidate.title,
    summary: candidate.summary,
    type: candidate.type,
    publishedAt: candidate.publishedAt?.toISOString() ?? null,
    deadline: candidate.deadline?.toISOString() ?? null,
    documents: candidate.documents,
    rawPayload: candidate.rawPayload,
  } satisfies Prisma.InputJsonObject;
}

function fingerprint(candidate: DiscoveryCandidate) {
  return sha256(JSON.stringify(snapshot(candidate)));
}

function nextScanAt(source: Pick<JobSource, "monitoringIntervalMinutes">, now: Date) {
  const minutes = Math.min(Math.max(source.monitoringIntervalMinutes, 5), 43_200);
  return new Date(now.getTime() + minutes * 60_000);
}

export function nextRetryAt(source: Pick<JobSource, "monitoringIntervalMinutes" | "consecutiveFailures">, now: Date) {
  const baseMinutes = Math.min(Math.max(source.monitoringIntervalMinutes, 5), 43_200);
  const multiplier = 2 ** Math.min(source.consecutiveFailures, 5);
  return new Date(now.getTime() + Math.min(baseMinutes * multiplier, 43_200) * 60_000);
}

export function classifyDiscoveryChange(
  existing: { status: string; deadline: Date | null },
  candidate: DiscoveryCandidate,
): DiscoveryChangeType {
  const combined = `${candidate.title} ${candidate.summary ?? ""}`.toLowerCase();
  if (existing.status === "REMOVED") return "RESTORED";
  if (/\b(cancelled|canceled|cancellation|withdrawn)\b/.test(combined)) return "CANCELLED";
  if (candidate.deadline && (!existing.deadline || candidate.deadline > existing.deadline)) return "DEADLINE_CHANGED";
  if (/\b(corrigendum|correction|revised|amended)\b/.test(combined)) return "CORRECTION";
  return "CONTENT_UPDATED";
}

async function relatedJobId(sourceId: string, candidate: DiscoveryCandidate) {
  const sourceUrlHash = createSourceUrlHash(candidate.canonicalUrl);
  const directMatch = (
    await db.job.findFirst({
      where: {
        OR: [
          ...(candidate.externalId ? [{ sourceId, sourceExternalId: candidate.externalId }] : []),
          ...(sourceUrlHash ? [{ sourceUrlHash }] : []),
        ],
      },
      select: { id: true },
    })
  )?.id ?? null;
  if (directMatch) return directMatch;

  const normalizedTitle = normalizeMatchingText(candidate.title);
  const company = normalizeMatchingText(candidate.rawPayload.company ?? candidate.rawPayload.employer ?? "");
  const city = normalizeMatchingText(candidate.rawPayload.city ?? candidate.rawPayload.location ?? "");
  const titleCandidates = await db.job.findMany({
    where: { title: { contains: candidate.title.slice(0, 120) } },
    include: { company: { select: { name: true } }, location: { select: { name: true } } },
    take: 50,
  });
  return titleCandidates.find((job) =>
    normalizeMatchingText(job.title) === normalizedTitle &&
    (!company || normalizeMatchingText(job.company.name) === company) &&
    (!city || normalizeMatchingText(job.location.name) === city),
  )?.id ?? null;
}

async function notify(input: {
  type: "NEW_JOB" | "NEW_ANNOUNCEMENT" | "SOURCE_FAILURE" | "DEADLINE_CHANGE" | "POSSIBLE_DUPLICATE";
  title: string;
  message: string;
  entityType: string;
  entityId: string | null;
}) {
  await db.adminNotification.create({ data: input });
}

export async function scanSource(sourceId: string, now = new Date()) {
  const source = await db.jobSource.findUnique({ where: { id: sourceId } });
  if (!source) throw new Error("Source not found.");
  if (!source.isActive || source.permissionStatus !== "APPROVED") {
    throw new Error("Only active sources with documented approval can be monitored.");
  }
  if (!source.monitoringEnabled || source.monitoringMode === "DISABLED") {
    throw new Error("Monitoring is disabled for this source.");
  }
  if (!source.feedUrl) throw new Error("A monitored HTTPS endpoint is required.");

  const leaseUntil = new Date(now.getTime() + LEASE_MILLISECONDS);
  const lease = await db.jobSource.updateMany({
    where: {
      id: source.id,
      OR: [{ monitorLeaseUntil: null }, { monitorLeaseUntil: { lt: now } }],
    },
    data: { monitorLeaseUntil: leaseUntil, lastScanAt: now },
  });
  if (!lease.count) return { status: "SKIPPED" as const, reason: "Source scan already running." };

  const run = await db.sourceMonitorRun.create({
    data: { sourceId: source.id, status: "RUNNING", startedAt: now },
  });
  try {
    if (source.monitoringMode === "WEB_PAGE") {
      await assertRobotsPermission(source.feedUrl);
    }
    const response = await fetchMonitoredSource({
      endpoint: source.feedUrl,
      etag: source.monitorEtag,
      lastModified: source.monitorLastModified,
    });
    if (response.status === 304) {
      await db.$transaction([
        db.sourceMonitorRun.update({
          where: { id: run.id },
          data: { status: "SUCCESS", responseStatus: 304, completedAt: new Date() },
        }),
        db.jobSource.update({
          where: { id: source.id },
          data: {
            lastSuccessfulScanAt: new Date(),
            nextScanAt: nextScanAt(source, now),
            consecutiveFailures: 0,
            lastMonitorError: null,
            monitorLeaseUntil: null,
          },
        }),
      ]);
      return { status: "SUCCESS" as const, unchanged: true, discovered: 0, changed: 0, removed: 0 };
    }

    const candidates = discoverContent({
      mode: source.monitoringMode,
      body: response.body,
      endpoint: source.feedUrl,
    });
    const existing = await db.sourceDiscovery.findMany({
      where: { sourceId: source.id },
      select: {
        id: true, externalKey: true, fingerprint: true, status: true, deadline: true,
        extractionStatus: true, missingScans: true, canonicalUrl: true, title: true,
      },
    });
    const existingByKey = new Map(existing.map((item) => [item.externalKey, item]));
    const seen = new Set<string>();
    let discoveredCount = 0;
    let changedCount = 0;
    let documentCount = 0;

    for (const candidate of candidates) {
      const externalKey = candidateKey(candidate);
      const candidateFingerprint = fingerprint(candidate);
      const candidateSnapshot = snapshot(candidate);
      const previous = existingByKey.get(externalKey);
      seen.add(externalKey);
      if (!previous) {
        const matchingJobId = await relatedJobId(source.id, candidate);
        const initialChange: DiscoveryChangeType = matchingJobId ? "POSSIBLE_DUPLICATE" : "NEW_CONTENT";
        const discovery = await db.sourceDiscovery.create({
          data: {
            sourceId: source.id,
            relatedJobId: matchingJobId,
            externalKey,
            externalId: candidate.externalId,
            canonicalUrl: candidate.canonicalUrl,
            title: candidate.title,
            summary: candidate.summary,
            type: candidate.type,
            status: "NEW",
            latestChangeType: initialChange,
            fingerprint: candidateFingerprint,
            sourcePublishedAt: candidate.publishedAt,
            deadline: candidate.deadline,
            firstSeenAt: now,
            lastSeenAt: now,
            rawPayload: candidate.rawPayload as Prisma.InputJsonValue,
            extractionStatus: candidate.documents.length
              ? extractionIsConfigured() ? "PENDING" : "NOT_CONFIGURED"
              : "NOT_REQUIRED",
            versions: {
              create: {
                monitorRunId: run.id,
                changeType: initialChange,
                fingerprint: candidateFingerprint,
                snapshot: candidateSnapshot,
              },
            },
            documents: {
              create: candidate.documents.map((document) => ({
                urlHash: sha256(document.url),
                url: document.url,
                documentReference: document.reference,
                mimeType: document.mimeType,
                extractionStatus: extractionIsConfigured() ? "PENDING" : "NOT_CONFIGURED",
              })),
            },
          },
        });
        discoveredCount++;
        documentCount += candidate.documents.length;
        await notify({
          type: matchingJobId ? "POSSIBLE_DUPLICATE" : candidate.type === "JOB" ? "NEW_JOB" : "NEW_ANNOUNCEMENT",
          title: matchingJobId ? "Possible duplicate discovery" : candidate.type === "JOB" ? "New job discovered" : "New announcement discovered",
          message: `${source.name}: ${candidate.title}`,
          entityType: "SourceDiscovery",
          entityId: discovery.id,
        });
        continue;
      }

      if (previous.fingerprint === candidateFingerprint) {
        await db.sourceDiscovery.update({
          where: { id: previous.id },
          data: { lastSeenAt: now, missingScans: 0, removedAt: null },
        });
        continue;
      }

      const detectedChange = classifyDiscoveryChange(previous, candidate);
      await db.$transaction([
        db.sourceDiscovery.update({
          where: { id: previous.id },
          data: {
            canonicalUrl: candidate.canonicalUrl,
            title: candidate.title,
            summary: candidate.summary,
            type: candidate.type,
            status: "UPDATED",
            latestChangeType: detectedChange,
            fingerprint: candidateFingerprint,
            sourcePublishedAt: candidate.publishedAt,
            deadline: candidate.deadline,
            lastSeenAt: now,
            missingScans: 0,
            removedAt: null,
            rawPayload: candidate.rawPayload as Prisma.InputJsonValue,
            extractionStatus: candidate.documents.length
              ? extractionIsConfigured() ? "PENDING" : "NOT_CONFIGURED"
              : previous.extractionStatus,
          },
        }),
        db.sourceDiscoveryVersion.create({
          data: {
            discoveryId: previous.id,
            monitorRunId: run.id,
            changeType: detectedChange,
            fingerprint: candidateFingerprint,
            snapshot: candidateSnapshot,
          },
        }),
      ]);
      if (candidate.documents.length) {
        await db.sourceDocument.createMany({
          data: candidate.documents.map((document) => ({
            discoveryId: previous.id,
            urlHash: sha256(document.url),
            url: document.url,
            documentReference: document.reference,
            mimeType: document.mimeType,
            extractionStatus: extractionIsConfigured() ? "PENDING" : "NOT_CONFIGURED",
          })),
          skipDuplicates: true,
        });
      }
      changedCount++;
      documentCount += candidate.documents.length;
      if (detectedChange === "DEADLINE_CHANGED") {
        await notify({
          type: "DEADLINE_CHANGE",
          title: "Application deadline changed",
          message: `${source.name}: ${candidate.title}`,
          entityType: "SourceDiscovery",
          entityId: previous.id,
        });
      }
    }

    let removedCount = 0;
    if (source.monitoringMode === "WEB_PAGE") {
      for (const item of existing) {
        if (seen.has(item.externalKey) || item.status === "REMOVED" || item.status === "DISMISSED") continue;
        const missingScans = item.missingScans + 1;
        if (missingScans < 2) {
          await db.sourceDiscovery.update({ where: { id: item.id }, data: { missingScans } });
          continue;
        }
        await db.$transaction([
          db.sourceDiscovery.update({
            where: { id: item.id },
            data: { status: "REMOVED", latestChangeType: "REMOVED", missingScans, removedAt: now },
          }),
          db.sourceDiscoveryVersion.create({
            data: {
              discoveryId: item.id,
              monitorRunId: run.id,
              changeType: "REMOVED",
              fingerprint: item.fingerprint,
              snapshot: { canonicalUrl: item.canonicalUrl, title: item.title, removedAt: now.toISOString() },
            },
          }),
        ]);
        removedCount++;
      }
    }

    await processPendingDocuments(source.id);
    const completedAt = new Date();
    await db.$transaction([
      db.sourceMonitorRun.update({
        where: { id: run.id },
        data: {
          status: "SUCCESS",
          responseStatus: response.status,
          discoveredCount,
          changedCount,
          removedCount,
          documentCount,
          completedAt,
          metadata: { contentType: response.contentType, candidateCount: candidates.length },
        },
      }),
      db.jobSource.update({
        where: { id: source.id },
        data: {
          lastSuccessfulScanAt: completedAt,
          nextScanAt: nextScanAt(source, now),
          consecutiveFailures: 0,
          lastMonitorError: null,
          monitorEtag: response.etag,
          monitorLastModified: response.lastModified,
          monitorLeaseUntil: null,
        },
      }),
    ]);
    return { status: "SUCCESS" as const, discovered: discoveredCount, changed: changedCount, removed: removedCount };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 2_000) : "Source monitoring failed.";
    const completedAt = new Date();
    await db.$transaction([
      db.sourceMonitorRun.update({
        where: { id: run.id },
        data: { status: "FAILED", errorMessage: message, completedAt },
      }),
      db.jobSource.update({
        where: { id: source.id },
        data: {
          lastFailureAt: completedAt,
          nextScanAt: nextRetryAt(source, now),
          consecutiveFailures: { increment: 1 },
          lastMonitorError: message,
          monitorLeaseUntil: null,
        },
      }),
      db.adminNotification.create({
        data: {
          type: "SOURCE_FAILURE",
          title: "Source check failed",
          message: `${source.name}: ${message}`,
          entityType: "JobSource",
          entityId: source.id,
        },
      }),
    ]);
    logger.warn("source_monitor.failed", { sourceId: source.id, runId: run.id, error: message, consecutiveFailures: source.consecutiveFailures + 1 });
    return { status: "FAILED" as const, error: message };
  }
}

export async function runDueSourceMonitors(limit = 10, now = new Date()) {
  const sources = await db.jobSource.findMany({
    where: {
      isActive: true,
      permissionStatus: "APPROVED",
      monitoringEnabled: true,
      monitoringMode: { not: "DISABLED" },
      OR: [{ nextScanAt: null }, { nextScanAt: { lte: now } }],
    },
    orderBy: [{ nextScanAt: "asc" }, { lastScanAt: "asc" }],
    take: Math.min(Math.max(limit, 1), 25),
    select: { id: true },
  });
  const results = [];
  for (const source of sources) results.push(await scanSource(source.id, now));
  const publishing = await publishDiscoveredJobs({ now });
  const lifecycle = await syncJobsWithSources(now);
  return { checked: sources.length, results, publishing, lifecycle };
}
