import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { publishedJobWhere } from "@/lib/services/public-jobs";

const RESERVED_JOB_PATHS = new Set(["remote", "government", "internships"]);

/*
 * Pages under (public) have a loading skeleton, so their HTML starts streaming with a
 * 200 status before the page decides it doesn't exist. Checking the slug here, before
 * any streaming, lets unknown URLs return a real 404 status (not a "soft 404").
 */

function notFoundResponse(request: NextRequest) {
  return NextResponse.rewrite(new URL("/404", request.url), {
    status: 404,
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  });
}

function decodedSlug(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

async function jobResponse(request: NextRequest, slug: string) {
  if (RESERVED_JOB_PATHS.has(slug)) return NextResponse.next();

  const currentJob = await db.job.findFirst({
    where: { AND: [publishedJobWhere(), { slug }] },
    select: { id: true },
  });
  if (currentJob) return NextResponse.next();

  const historicalSlug = await db.jobSlugRedirect.findFirst({
    where: { oldSlug: slug, job: publishedJobWhere() },
    select: { job: { select: { slug: true } } },
  });
  if (historicalSlug) {
    return NextResponse.redirect(new URL(`/jobs/${historicalSlug.job.slug}`, request.url), 308);
  }
  return notFoundResponse(request);
}

/** Same rules as the pages' own lookups: only active records are public. */
async function listingExists(kind: string, slug: string) {
  switch (kind) {
    case "city":
      return Boolean(await db.jobLocation.findFirst({ where: { slug, type: "CITY", isActive: true }, select: { id: true } }));
    case "province":
      return Boolean(await db.jobLocation.findFirst({ where: { slug, type: "PROVINCE", isActive: true }, select: { id: true } }));
    case "category":
      return Boolean(await db.jobCategory.findFirst({ where: { slug, isActive: true }, select: { id: true } }));
    case "company":
      return Boolean(await db.company.findFirst({ where: { slug, isActive: true, isVerified: true }, select: { id: true } }));
    default:
      return true;
  }
}

export async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const rawSlug = segments.at(-1) ?? "";
  const slug = decodedSlug(rawSlug);
  if (slug === null) return notFoundResponse(request);
  if (!slug) return NextResponse.next();

  // /jobs/<job-slug>
  if (segments[0] === "jobs" && segments.length === 2) return jobResponse(request, slug);

  // /jobs/city/<slug>, /jobs/province/<slug>, /jobs/category/<slug>, /companies/<slug>
  const kind = segments[0] === "companies" ? "company" : segments[1];
  return (await listingExists(kind, slug)) ? NextResponse.next() : notFoundResponse(request);
}

export const config = {
  matcher: ["/jobs/:slug", "/jobs/city/:slug", "/jobs/province/:slug", "/jobs/category/:slug", "/companies/:slug"],
};
