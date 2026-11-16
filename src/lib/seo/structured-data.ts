import type { PublicJobDetail } from "@/lib/services/public-jobs";

import { absoluteUrl } from "./site";

type JsonObject = Record<string, unknown>;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function paragraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

function publicHttpUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value, absoluteUrl("/"));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function employmentType(value: PublicJobDetail["employmentType"]) {
  return ({
    FULL_TIME: "FULL_TIME",
    PART_TIME: "PART_TIME",
    CONTRACT: "CONTRACTOR",
    TEMPORARY: "TEMPORARY",
    INTERNSHIP: "INTERN",
    FREELANCE: "OTHER",
    OTHER: "OTHER",
  } as const)[value];
}

function jobDescription(job: PublicJobDetail) {
  const sections = [paragraphs(job.description)];
  if (job.responsibilities) sections.push(`<p>Responsibilities</p>${paragraphs(job.responsibilities)}`);
  if (job.requirements) sections.push(`<p>Requirements</p>${paragraphs(job.requirements)}`);
  if (job.skills) {
    const items = job.skills.split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
    if (items.length) sections.push(`<p>Skills</p><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`);
  }
  if (job.education) sections.push(`<p>Education: ${escapeHtml(job.education)}</p>`);
  return sections.join("");
}

function baseSalary(job: PublicJobDetail): JsonObject | undefined {
  if (!job.salaryPeriod || job.salaryVisibility === "HIDDEN" || job.salaryVisibility === "NEGOTIABLE") return undefined;
  const minimum = job.salaryMin?.toNumber();
  const maximum = job.salaryMax?.toNumber();
  if (minimum === undefined && maximum === undefined) return undefined;
  const value: JsonObject = { "@type": "QuantitativeValue", unitText: job.salaryPeriod };
  if (minimum !== undefined && maximum !== undefined && minimum !== maximum) {
    value.minValue = minimum;
    value.maxValue = maximum;
  } else {
    value.value = minimum ?? maximum;
  }
  return { "@type": "MonetaryAmount", currency: job.salaryCurrency, value };
}

export function buildJobPosting(job: PublicJobDetail, now = new Date()): JsonObject | null {
  if (!isJobPostingEligible(job, now)) return null;
  const directApply = job.applicationMethod === "ON_SITE";
  const applicationUrl = publicHttpUrl(job.applicationUrl);
  const datePosted = job.originalPublishedAt ?? job.publishedAt;
  if ((!applicationUrl && !directApply) || !datePosted) return null;
  const organization: JsonObject = { "@type": "Organization", name: job.company.name };
  const website = publicHttpUrl(job.company.websiteUrl);
  if (website) organization.sameAs = website;

  const schema: JsonObject = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: jobDescription(job),
    datePosted: datePosted.toISOString(),
    employmentType: employmentType(job.employmentType),
    hiringOrganization: organization,
    url: absoluteUrl(`/jobs/${job.slug}`),
    // Candidates can apply on this page itself (Google shows "Easy apply").
    ...(directApply ? { directApply: true } : {}),
  };
  const validThrough = job.applicationDeadline ?? job.expiresAt;
  if (validThrough) schema.validThrough = validThrough.toISOString();
  if (job.sourceExternalId) schema.identifier = { "@type": "PropertyValue", name: job.company.name, value: job.sourceExternalId };
  if (job.workplaceType === "REMOTE") {
    schema.jobLocationType = "TELECOMMUTE";
    schema.applicantLocationRequirements = { "@type": "Country", name: "Pakistan" };
  } else {
    schema.jobLocation = {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        ...(job.workplaceStreetAddress ? { streetAddress: job.workplaceStreetAddress } : {}),
        addressLocality: job.location.name,
        ...(job.location.province ? { addressRegion: job.location.province.name } : {}),
        ...(job.workplacePostalCode ? { postalCode: job.workplacePostalCode } : {}),
        addressCountry: "PK",
      },
    };
  }
  const salary = baseSalary(job);
  if (salary) schema.baseSalary = salary;
  return schema;
}

export function isJobPostingEligible(job: PublicJobDetail, now = new Date()) {
  const pakistanDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const pakistanDayStart = new Date(`${pakistanDate}T00:00:00+05:00`);
  const datePosted = job.originalPublishedAt ?? job.publishedAt;
  const importedSourceIsEligible = !job.jobImportId || (
    job.verificationStatus === "VERIFIED" &&
    job.source?.isActive === true &&
    job.source.permissionStatus === "APPROVED"
  );

  return Boolean(
    job.status === "PUBLISHED" &&
    datePosted &&
    datePosted <= now &&
    job.company.isActive &&
    job.category.isActive &&
    job.location.isActive &&
    (!job.expiresAt || job.expiresAt > now) &&
    (!job.applicationDeadline || job.applicationDeadline >= pakistanDayStart) &&
    importedSourceIsEligible &&
    (job.applicationMethod === "ON_SITE" || publicHttpUrl(job.applicationUrl)),
  );
}

export function buildBreadcrumbList(items: { name: string; path: string }[]): JsonObject {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function buildOrganization(input: { name: string; slug: string; description: string | null; websiteUrl: string | null; logoUrl: string | null }): JsonObject {
  const schema: JsonObject = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: input.name,
    url: absoluteUrl(`/companies/${input.slug}`),
  };
  if (input.description) schema.description = input.description;
  const website = publicHttpUrl(input.websiteUrl);
  const logo = publicHttpUrl(input.logoUrl);
  if (website) schema.sameAs = website;
  if (logo) schema.logo = logo;
  return schema;
}


/** Homepage schema: the site itself (with a search box for Google) and the publisher. */
export function buildWebsite(): JsonObject {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": absoluteUrl("/#website"),
        name: "JobDraftly",
        url: absoluteUrl("/"),
        inLanguage: "en-PK",
        publisher: { "@id": absoluteUrl("/#organization") },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/jobs")}?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        "@id": absoluteUrl("/#organization"),
        name: "JobDraftly",
        url: absoluteUrl("/"),
        logo: absoluteUrl("/opengraph-image"),
        areaServed: { "@type": "Country", name: "Pakistan" },
      },
    ],
  };
}
