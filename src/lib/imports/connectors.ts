import { XMLParser } from "fast-xml-parser";

import type { RawImportRow } from "./csv";

export function rowsFromApiPayload(payload: unknown): RawImportRow[] {
  const candidate = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { jobs?: unknown }).jobs)
      ? (payload as { jobs: unknown[] }).jobs
      : null;
  if (!candidate) throw new Error("The API response must be an array or an object containing a jobs array.");
  return candidate.map((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Every API job must be an object.");
    return Object.fromEntries(Object.entries(row).map(([name, value]) => [name, value == null ? "" : String(value)]));
  });
}

function text(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object" && value && "#text" in value) return String((value as { "#text": unknown })["#text"] ?? "");
  return String(value);
}

export function rowsFromRss(xml: string): RawImportRow[] {
  const parsed = new XMLParser({ ignoreAttributes: false, trimValues: true }).parse(xml) as Record<string, unknown>;
  const rssItems = (parsed.rss as { channel?: { item?: unknown } } | undefined)?.channel?.item;
  const atomEntries = (parsed.feed as { entry?: unknown } | undefined)?.entry;
  const items = rssItems ?? atomEntries;
  const list = Array.isArray(items) ? items : items ? [items] : [];
  if (!list.length) throw new Error("No RSS or Atom job entries were found.");
  return list.map((item) => {
    const row = item as Record<string, unknown>;
    const linkValue = Array.isArray(row.link) ? row.link[0] : row.link;
    const link = typeof linkValue === "object" && linkValue ? text((linkValue as Record<string, unknown>)["@_href"]) : text(linkValue);
    return {
      title: text(row.title),
      description: text(row.description ?? row.summary ?? row.content),
      source_url: link,
      application_url: text(row.applicationUrl ?? row.applyUrl) || link,
      publication_date: text(row.pubDate ?? row.published ?? row.updated),
      source_job_id: text(row.guid ?? row.id),
      company: text(row.company ?? row.author),
      city: text(row.city ?? row.location),
      category: text(row.category),
      employment_type: text(row.employmentType ?? row.jobType),
      experience_level: text(row.experienceLevel),
      salary: text(row.salary),
      deadline: text(row.deadline ?? row.closingDate),
    };
  });
}

