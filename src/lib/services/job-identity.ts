import { createHash, randomUUID } from "node:crypto";

const TRACKING_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source",
]);

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeMatchingText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function canonicalizeJobUrl(value: string): string {
  const url = new URL(value);
  url.hash = "";
  url.hostname = url.hostname.toLocaleLowerCase("en");

  for (const parameter of [...url.searchParams.keys()]) {
    if (
      parameter.toLocaleLowerCase("en").startsWith("utm_") ||
      TRACKING_PARAMETERS.has(parameter.toLocaleLowerCase("en"))
    ) {
      url.searchParams.delete(parameter);
    }
  }

  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";

  return url.toString();
}

export function createSourceUrlHash(sourceUrl?: string | null): string | null {
  return sourceUrl ? sha256(canonicalizeJobUrl(sourceUrl)) : null;
}

type JobDeduplicationInput = {
  sourceId?: string | null;
  sourceExternalId?: string | null;
  sourceUrl?: string | null;
  applicationUrl?: string | null;
  title: string;
  companyId: string;
  locationId: string;
  applicationDeadline?: Date | null;
};

export function createJobDeduplicationKey(
  input: JobDeduplicationInput,
): string {
  const sourceId = input.sourceId ?? "no-source";
  const externalId = input.sourceExternalId?.trim();

  if (externalId) {
    return sha256(
      `external:${sourceId}:${normalizeMatchingText(externalId)}`,
    );
  }

  const matchingUrl = input.sourceUrl ?? input.applicationUrl;

  if (matchingUrl) {
    return sha256(`url:${sourceId}:${canonicalizeJobUrl(matchingUrl)}`);
  }

  const deadline = input.applicationDeadline?.toISOString().slice(0, 10) ?? "";

  return sha256(
    [
      "fallback",
      sourceId,
      normalizeMatchingText(input.title),
      input.companyId,
      input.locationId,
      deadline,
    ].join(":"),
  );
}

export function createJobSlug(
  title: string,
  companySlug: string,
  suffix = randomUUID().replaceAll("-", "").slice(0, 10),
): string {
  const base = `${normalizeMatchingText(title)} ${normalizeMatchingText(companySlug)}`
    .replaceAll(" ", "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 175)
    .replace(/-$/g, "");

  return `${base || "job"}-${suffix.toLocaleLowerCase("en")}`;
}
