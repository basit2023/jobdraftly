import { rowsFromRss } from "@/lib/imports/connectors";

import type {
  DiscoveryCandidate,
  DiscoveryDocument,
  MonitorPayloadMode,
} from "./types";

const TRACKING_PARAMETERS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
];

function cleanText(value: unknown, maximum = 50_000) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

export function canonicalizeDiscoveryUrl(value: string, baseUrl: string) {
  const url = new URL(value, baseUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("Unsupported discovery URL protocol.");
  url.hash = "";
  for (const parameter of TRACKING_PARAMETERS) url.searchParams.delete(parameter);
  url.searchParams.sort();
  return url.toString();
}

function parseDate(value: unknown) {
  const text = cleanText(value, 100);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function classifyDiscovery(title: string, summary = "") {
  const value = `${title} ${summary}`.toLocaleLowerCase("en");
  if (/\b(result|merit list|selected candidates?|final selection)\b/.test(value)) return "RESULT_MERIT_LIST" as const;
  if (/\b(interview|test schedule|written test|screening test|roll number slip)\b/.test(value)) return "TEST_INTERVIEW" as const;
  if (/\b(cancelled|cancellation|corrigendum|correction|deadline extended|extension)\b/.test(value)) return "ANNOUNCEMENT" as const;
  if (/\b(job|jobs|vacanc(?:y|ies)|career|recruitment|position|post(?:s|ing)?)\b/.test(value)) return "JOB" as const;
  return "ANNOUNCEMENT" as const;
}

function mimeFromUrl(url: string) {
  const pathname = new URL(url).pathname.toLowerCase();
  if (pathname.endsWith(".pdf")) return "application/pdf";
  if (/\.(png|jpg|jpeg|webp|tif|tiff)$/.test(pathname)) return `image/${pathname.split(".").pop() === "jpg" ? "jpeg" : pathname.split(".").pop()}`;
  return null;
}

function documentFromUrl(url: string, reference: string | null): DiscoveryDocument | null {
  const mimeType = mimeFromUrl(url);
  return mimeType ? { url, mimeType, reference } : null;
}

function value(record: Record<string, unknown>, names: string[]) {
  const entries = Object.entries(record);
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase().replaceAll("_", "") === name.toLowerCase().replaceAll("_", ""));
    if (match && match[1] != null) return match[1];
  }
  return "";
}

function recordCandidate(record: Record<string, unknown>, baseUrl: string): DiscoveryCandidate | null {
  const title = cleanText(value(record, ["title", "name", "jobTitle", "headline"]), 255);
  const rawUrl = cleanText(value(record, ["sourceUrl", "url", "link", "jobUrl", "applicationUrl"]), 2_000);
  if (!title || !rawUrl) return null;
  let canonicalUrl: string;
  try {
    canonicalUrl = canonicalizeDiscoveryUrl(rawUrl, baseUrl);
  } catch {
    return null;
  }
  const summary = cleanText(value(record, ["description", "summary", "content", "details"]));
  const externalId = cleanText(value(record, ["sourceJobId", "externalId", "guid", "id"]), 191) || null;
  const documentUrl = cleanText(value(record, ["documentUrl", "pdfUrl", "attachment", "imageUrl"]), 2_000);
  const documents: DiscoveryDocument[] = [];
  const canonicalDocument = documentFromUrl(canonicalUrl, title);
  if (canonicalDocument) documents.push(canonicalDocument);
  if (documentUrl) {
    try {
      const normalized = canonicalizeDiscoveryUrl(documentUrl, baseUrl);
      const document = documentFromUrl(normalized, title);
      if (document && !documents.some((item) => item.url === document.url)) documents.push(document);
    } catch {
      // Invalid optional attachments are ignored; the record remains reviewable.
    }
  }
  const rawPayload = Object.fromEntries(
    Object.entries(record).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, cleanText(item)]),
  );
  return {
    externalId,
    canonicalUrl,
    title,
    summary: summary || null,
    type: canonicalDocument ? "DOCUMENT" : classifyDiscovery(title, summary),
    publishedAt: parseDate(value(record, ["publicationDate", "publishedAt", "published", "pubDate", "date"])),
    deadline: parseDate(value(record, ["deadline", "applicationDeadline", "closingDate", "lastDate"])),
    documents: documents.sort((left, right) => left.url.localeCompare(right.url)),
    rawPayload,
  };
}

function apiRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item));
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Record<string, unknown>;
  for (const key of ["jobs", "items", "records", "announcements", "results", "data"]) {
    if (Array.isArray(root[key])) return apiRecords(root[key]);
  }
  return [];
}

function htmlCandidates(body: string, baseUrl: string) {
  const candidates: DiscoveryCandidate[] = [];
  const anchor = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of body.matchAll(anchor)) {
    const title = cleanText(match[2], 255);
    if (!title || !/(job|vacanc|career|recruit|advert|interview|test|result|merit|corrig|cancel|\.pdf|\.png|\.jpe?g)/i.test(`${title} ${match[1]}`)) continue;
    const candidate = recordCandidate({ title, url: match[1] }, baseUrl);
    if (candidate) candidates.push(candidate);
    if (candidates.length >= 1_000) break;
  }
  return candidates;
}

export function discoverContent(input: {
  mode: MonitorPayloadMode;
  body: string;
  endpoint: string;
}): DiscoveryCandidate[] {
  let candidates: DiscoveryCandidate[];
  if (input.mode === "API") {
    const payload = JSON.parse(input.body) as unknown;
    candidates = apiRecords(payload)
      .map((record) => recordCandidate(record, input.endpoint))
      .filter((candidate): candidate is DiscoveryCandidate => Boolean(candidate));
  } else if (input.mode === "RSS") {
    candidates = rowsFromRss(input.body)
      .map((record) => recordCandidate(record, input.endpoint))
      .filter((candidate): candidate is DiscoveryCandidate => Boolean(candidate));
  } else {
    candidates = htmlCandidates(input.body, input.endpoint);
  }

  const unique = new Map<string, DiscoveryCandidate>();
  for (const candidate of candidates.slice(0, 1_000)) {
    unique.set(`${candidate.externalId ?? ""}:${candidate.canonicalUrl}`, candidate);
  }
  return [...unique.values()];
}
