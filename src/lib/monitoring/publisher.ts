import "server-only";

import { Prisma, type JobSource, type SourceDiscovery, type SourceDocument } from "@/generated/prisma/client";
import { type AiJob, aiExtractionIsConfigured, ExtractionRefusedError, extractJobWithClaude, type ExtractionInput } from "@/lib/ai/job-extractor";
import { endOfPakistanDay, findImageCandidates, htmlToText } from "@/lib/ai/html";
import { db } from "@/lib/db";
import { assertPublicSourceUrl } from "@/lib/imports/network";
import { uniqueCompanySlug } from "@/lib/imports/staging";
import { logger } from "@/lib/observability/logger";
import { createAuditLog } from "@/lib/services/admin-audit";
import { createJobDeduplicationKey, createJobSlug, createSourceUrlHash, normalizeMatchingText } from "@/lib/services/job-identity";
import { rehostRemoteImage } from "@/lib/storage/object-store";

import { assertRobotsPermission } from "./network";

const USER_AGENT = "JobDraftly/1.0 (+https://www.jobdraftly.com)";
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function numberFromEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;
}

/** Minimum AI confidence for a trusted source's job to go live without review. */
export const autoPublishMinConfidence = () => numberFromEnv("AI_AUTO_PUBLISH_MIN_CONFIDENCE", 0.85, 0.5, 1);
/** Jobs without a stated deadline are removed after this many days. */
const defaultListingDays = () => numberFromEnv("AI_DEFAULT_LISTING_DAYS", 30, 1, 120);

type DiscoveryWithContext = SourceDiscovery & { source: JobSource; documents: SourceDocument[] };

function pakistanToday(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function httpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Fetching the advert                                                 */
/* ------------------------------------------------------------------ */

async function fetchAdvert(discovery: DiscoveryWithContext): Promise<Pick<ExtractionInput, "text" | "attachment" | "candidateImages"> & { truncated: boolean }> {
  // Prefer an attached PDF/image advert (common for government vacancies).
  const document = discovery.documents.find((item) => /pdf|image\/(png|jpe?g|webp)/i.test(item.mimeType ?? item.url));
  if (document) {
    const url = await assertPublicSourceUrl(document.url);
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, redirect: "error", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`Advert document responded with HTTP ${response.status}.`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > MAX_ATTACHMENT_BYTES) throw new Error("Advert document exceeds the 10 MB limit.");
    const type = (response.headers.get("content-type") ?? document.mimeType ?? "").toLowerCase();
    const mediaType = type.includes("pdf") ? "application/pdf"
      : type.includes("png") ? "image/png"
        : type.includes("webp") ? "image/webp"
          : type.includes("jpeg") || type.includes("jpg") ? "image/jpeg" : null;
    if (mediaType) {
      return {
        attachment: { mediaType, base64: bytes.toString("base64") },
        text: [discovery.title, discovery.summary].filter(Boolean).join("\n\n"),
        candidateImages: mediaType.startsWith("image/") ? [document.url] : [],
        truncated: false,
      };
    }
  }

  // Otherwise read the advert web page itself.
  if (discovery.source.monitoringMode === "WEB_PAGE") await assertRobotsPermission(discovery.canonicalUrl);
  const url = await assertPublicSourceUrl(discovery.canonicalUrl);
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Advert page responded with HTTP ${response.status}.`);
  const html = await response.text();
  const { text, truncated } = htmlToText(html);
  const fallback = [discovery.title, discovery.summary].filter(Boolean).join("\n\n");
  return { text: text || fallback, candidateImages: findImageCandidates(html, url.href), truncated };
}

/* ------------------------------------------------------------------ */
/* Mapping extracted values onto the database                          */
/* ------------------------------------------------------------------ */

async function referenceData() {
  const [categories, locations] = await Promise.all([
    db.jobCategory.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
    db.jobLocation.findMany({ where: { isActive: true }, select: { id: true, name: true, type: true } }),
  ]);
  return { categories, locations };
}

function matchByName<T extends { name: string }>(items: T[], value: string | null): T | null {
  if (!value) return null;
  const wanted = normalizeMatchingText(value);
  return items.find((item) => normalizeMatchingText(item.name) === wanted) ?? null;
}

async function findOrCreateCompany(name: string, website: string | null, locationId: string) {
  const existing = await db.company.findFirst({ where: { name }, select: { id: true, slug: true, logoUrl: true } });
  if (existing) return existing;
  return db.company.create({
    data: { name, slug: await uniqueCompanySlug(name), websiteUrl: httpUrl(website), locationId, isActive: true, isVerified: false },
    select: { id: true, slug: true, logoUrl: true },
  });
}

/** Why a job can't go live automatically. Empty array means it qualifies. */
export function autoPublishBlockers(input: {
  source: Pick<JobSource, "autoPublish">;
  job: AiJob;
  hasLocation: boolean;
  hasCategory: boolean;
  applicationUrl: string | null;
}): string[] {
  const blockers: string[] = [];
  if (!input.source.autoPublish) blockers.push("Source is not marked as trusted for auto-publishing.");
  if (input.job.confidence < autoPublishMinConfidence()) blockers.push(`AI confidence ${input.job.confidence.toFixed(2)} is below ${autoPublishMinConfidence()}.`);
  if (!input.job.title?.trim()) blockers.push("Job title is missing.");
  if (!input.job.companyName?.trim()) blockers.push("Employer is missing.");
  if ((input.job.description?.trim().length ?? 0) < 80) blockers.push("Description is too short.");
  if (!input.hasLocation) blockers.push("Location could not be matched.");
  if (!input.hasCategory) blockers.push("Category could not be matched.");
  if (!input.applicationUrl) blockers.push("No application link.");
  return blockers;
}

/* ------------------------------------------------------------------ */
/* Processing one discovery                                            */
/* ------------------------------------------------------------------ */

type Outcome = "PUBLISHED" | "PENDING_REVIEW" | "DISMISSED" | "FAILED" | "DUPLICATE";

async function processDiscovery(discovery: DiscoveryWithContext, now: Date): Promise<Outcome> {
  await db.sourceDiscovery.update({ where: { id: discovery.id }, data: { extractionStatus: "PROCESSING", extractionError: null } });
  try {
    const advert = await fetchAdvert(discovery);
    const reference = await referenceData();
    const job = await extractJobWithClaude({
      sourceName: discovery.source.name,
      pageUrl: discovery.canonicalUrl,
      text: advert.text,
      attachment: advert.attachment,
      candidateImages: advert.candidateImages,
      allowedCategories: reference.categories.map((item) => item.name),
      allowedLocations: reference.locations.map((item) => item.name),
      today: pakistanToday(now),
    });
    const notes = [job.notes, advert.truncated ? "Advert page was very long and only the first part was read." : null].filter(Boolean).join(" ");
    const extractedData = { ...job, notes } as unknown as Prisma.InputJsonValue;

    const deadline = endOfPakistanDay(job.applicationDeadline) ?? discovery.deadline;
    const dismissReason = !job.isJobPosting ? "Not a job advert."
      : job.isClosedOrCancelled ? "Advert says the vacancy is closed or cancelled."
        : deadline && deadline < now ? "Application deadline has already passed." : null;
    if (dismissReason) {
      await db.sourceDiscovery.update({
        where: { id: discovery.id },
        data: { status: "DISMISSED", extractionStatus: "SUCCEEDED", confidenceScore: job.confidence, extractedData, extractionError: dismissReason },
      });
      return "DISMISSED";
    }

    const location = matchByName(reference.locations, job.location);
    const category = matchByName(reference.categories, job.category) ?? matchByName(reference.categories, "Other");
    const applicationUrl = httpUrl(job.applicationUrl) ?? httpUrl(discovery.canonicalUrl);
    const title = (job.title?.trim() || discovery.title).slice(0, 191);
    const companyName = job.companyName?.trim().slice(0, 191);

    if (!location || !category || !companyName) {
      // Without these the job can't be stored; ask a person to post it by hand.
      const missing = [!location && "location", !category && "category", !companyName && "employer"].filter(Boolean).join(", ");
      await db.$transaction([
        db.sourceDiscovery.update({
          where: { id: discovery.id },
          data: { status: "REVIEWED", extractionStatus: "SUCCEEDED", confidenceScore: job.confidence, extractedData, extractionError: `Needs manual posting: missing ${missing}.` },
        }),
        db.adminNotification.create({
          data: { type: "NEW_JOB", title: "Job needs manual posting", message: `${discovery.source.name}: ${title} (missing ${missing})`, entityType: "SourceDiscovery", entityId: discovery.id },
        }),
      ]);
      return "PENDING_REVIEW";
    }

    const blockers = autoPublishBlockers({ source: discovery.source, job, hasLocation: true, hasCategory: Boolean(matchByName(reference.categories, job.category)), applicationUrl });
    const publish = blockers.length === 0;

    const company = await findOrCreateCompany(companyName, job.companyWebsite, location.id);
    const allowedImages = new Set(advert.candidateImages);
    if (!company.logoUrl && job.companyLogoUrl && allowedImages.has(job.companyLogoUrl)) {
      const logoUrl = await rehostRemoteImage(job.companyLogoUrl, "company-logos");
      if (logoUrl) await db.company.update({ where: { id: company.id }, data: { logoUrl } });
    }
    const imageUrl = job.advertImageUrl && allowedImages.has(job.advertImageUrl)
      ? await rehostRemoteImage(job.advertImageUrl, "job-images")
      : null;

    const salaryMin = job.salaryMin && job.salaryMin > 0 ? job.salaryMin : null;
    const salaryMax = job.salaryMax && job.salaryMax > 0 ? Math.max(job.salaryMax, salaryMin ?? 0) : null;
    const sourceUrl = discovery.canonicalUrl;
    const expiresAt = deadline ?? new Date(now.getTime() + defaultListingDays() * 86_400_000);
    const deduplicationKey = createJobDeduplicationKey({
      title, companyId: company.id, locationId: location.id, sourceId: discovery.sourceId,
      sourceExternalId: discovery.externalId, sourceUrl, applicationUrl, applicationDeadline: deadline,
    });

    let created;
    try {
      created = await db.job.create({
        data: {
          title,
          slug: createJobSlug(title, company.slug),
          companyId: company.id,
          categoryId: category.id,
          locationId: location.id,
          description: job.description?.trim() || discovery.summary?.trim() || title,
          responsibilities: job.responsibilities?.trim() || null,
          requirements: job.requirements?.trim() || null,
          skills: job.skills.slice(0, 10).join(", ") || null,
          employmentType: job.employmentType,
          experienceLevel: job.experienceLevel,
          education: job.education?.trim().slice(0, 191) || null,
          salaryMin,
          salaryMax,
          salaryCurrency: "PKR",
          salaryVisibility: salaryMin && salaryMax ? "RANGE" : salaryMin || salaryMax ? "EXACT" : "HIDDEN",
          salaryPeriod: salaryMin || salaryMax ? job.salaryPeriod ?? "MONTH" : null,
          workplaceType: job.workplaceType,
          applicationMethod: "EXTERNAL_URL",
          applicationUrl,
          sourceId: discovery.sourceId,
          sourceUrl,
          sourceExternalId: discovery.externalId,
          sourceUrlHash: createSourceUrlHash(sourceUrl),
          deduplicationKey,
          originalPublishedAt: endOfPakistanDay(job.postedDate) ?? discovery.sourcePublishedAt,
          applicationDeadline: deadline,
          expiresAt,
          imageUrl,
          status: publish ? "PUBLISHED" : "PENDING_REVIEW",
          publishedAt: publish ? now : null,
          verificationStatus: "UNVERIFIED",
        },
        select: { id: true, slug: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await db.job.findFirst({ where: { OR: [{ deduplicationKey }, { sourceId: discovery.sourceId, sourceUrlHash: createSourceUrlHash(sourceUrl) }] }, select: { id: true } });
        await db.sourceDiscovery.update({
          where: { id: discovery.id },
          data: { status: "REVIEWED", relatedJobId: existing?.id ?? null, extractionStatus: "SUCCEEDED", confidenceScore: job.confidence, extractedData, latestChangeType: "POSSIBLE_DUPLICATE" },
        });
        return "DUPLICATE";
      }
      throw error;
    }

    await db.$transaction([
      db.sourceDiscovery.update({
        where: { id: discovery.id },
        data: { status: "REVIEWED", relatedJobId: created.id, extractionStatus: "SUCCEEDED", confidenceScore: job.confidence, extractedData, extractionError: publish ? null : blockers.join(" ") },
      }),
      db.adminNotification.create({
        data: {
          type: "NEW_JOB",
          title: publish ? "Job published automatically" : "AI-drafted job waiting for review",
          message: `${discovery.source.name}: ${title}${publish ? "" : ` — ${blockers.join(" ")}`}`,
          entityType: "Job",
          entityId: created.id,
        },
      }),
    ]);
    await createAuditLog({
      action: publish ? "PUBLISH" : "IMPORT",
      entityType: "Job",
      entityId: created.id,
      summary: `${publish ? "Auto-published" : "AI-drafted"} "${title}" from ${discovery.source.name}`,
      metadata: { discoveryId: discovery.id, confidence: job.confidence, blockers },
    });
    return publish ? "PUBLISHED" : "PENDING_REVIEW";
  } catch (error) {
    const message = (error instanceof Error ? error.message : "AI extraction failed.").slice(0, 2_000);
    await db.$transaction([
      db.sourceDiscovery.update({ where: { id: discovery.id }, data: { extractionStatus: "FAILED", extractionError: message } }),
      db.adminNotification.create({
        data: { type: "EXTRACTION_FAILURE", title: error instanceof ExtractionRefusedError ? "AI declined an advert" : "AI extraction failed", message: `${discovery.source.name}: ${discovery.title} — ${message}`, entityType: "SourceDiscovery", entityId: discovery.id },
      }),
    ]);
    logger.warn("ai_publisher.discovery_failed", { discoveryId: discovery.id, error: message });
    return "FAILED";
  }
}

/* ------------------------------------------------------------------ */
/* Public entry points                                                 */
/* ------------------------------------------------------------------ */

/**
 * Turns newly discovered adverts into job posts using Claude.
 * Trusted sources with confident, complete extractions go live; everything else waits for review.
 */
export async function publishDiscoveredJobs(options: { sourceId?: string; limit?: number; now?: Date } = {}) {
  const totals: Record<Outcome, number> = { PUBLISHED: 0, PENDING_REVIEW: 0, DISMISSED: 0, FAILED: 0, DUPLICATE: 0 };
  if (!aiExtractionIsConfigured()) return { configured: false, processed: 0, ...totals };
  const now = options.now ?? new Date();
  const discoveries = await db.sourceDiscovery.findMany({
    where: {
      ...(options.sourceId ? { sourceId: options.sourceId } : {}),
      relatedJobId: null,
      status: { in: ["NEW", "UPDATED"] },
      type: { in: ["JOB", "UNKNOWN", "DOCUMENT"] },
      extractionStatus: { in: ["NOT_REQUIRED", "NOT_CONFIGURED", "PENDING"] },
      source: { isActive: true, permissionStatus: "APPROVED" },
    },
    include: { source: true, documents: true },
    orderBy: { firstSeenAt: "asc" },
    take: Math.min(Math.max(options.limit ?? numberFromEnv("AI_PUBLISH_BATCH_SIZE", 10, 1, 50), 1), 50),
  });
  for (const discovery of discoveries) totals[await processDiscovery(discovery, now)]++;
  if (discoveries.length) logger.info("ai_publisher.completed", { processed: discoveries.length, ...totals });
  return { configured: true, processed: discoveries.length, ...totals };
}

/**
 * Keeps live jobs in step with their source: closes jobs whose advert was removed
 * or cancelled, and moves deadlines when the source extends them.
 */
export async function syncJobsWithSources(now = new Date()) {
  const linked = await db.sourceDiscovery.findMany({
    where: {
      relatedJobId: { not: null },
      relatedJob: { status: { in: ["PUBLISHED", "PENDING_REVIEW"] } },
      OR: [{ status: "REMOVED" }, { latestChangeType: { in: ["CANCELLED", "DEADLINE_CHANGED"] } }],
    },
    select: { id: true, status: true, latestChangeType: true, deadline: true, relatedJob: { select: { id: true, title: true, sourceId: true, applicationDeadline: true } } },
    take: 200,
  });
  let closed = 0;
  let extended = 0;
  for (const item of linked) {
    const job = item.relatedJob;
    if (!job) continue;
    if (item.status === "REMOVED" || item.latestChangeType === "CANCELLED") {
      await db.job.update({ where: { id: job.id }, data: { status: "CLOSED", isFeatured: false } });
      await createAuditLog({ action: "EXPIRE", entityType: "Job", entityId: job.id, summary: `Closed "${job.title}" because the source advert was ${item.status === "REMOVED" ? "removed" : "cancelled"}` });
      closed++;
    } else if (item.deadline && item.deadline > now && (!job.applicationDeadline || item.deadline > job.applicationDeadline)) {
      await db.job.update({ where: { id: job.id }, data: { applicationDeadline: item.deadline, expiresAt: item.deadline } });
      extended++;
    }
    // Mark the change as handled so it isn't applied again next cycle.
    await db.sourceDiscovery.update({ where: { id: item.id }, data: { latestChangeType: "CONTENT_UPDATED", ...(item.status === "REMOVED" ? {} : { status: "REVIEWED" }) } });
  }
  return { closed, extended };
}
