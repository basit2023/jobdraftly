import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { publishedJobWhere } from "@/lib/services/public-jobs";

const RESERVED_JOB_PATHS = new Set(["remote", "government", "internships"]);

export async function proxy(request: NextRequest) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return NextResponse.next();
  }

  let slug: string;
  try {
    slug = decodeURIComponent(request.nextUrl.pathname.slice("/jobs/".length));
  } catch {
    return NextResponse.rewrite(new URL("/_not-found", request.url), {
      status: 404,
      headers: { "X-Robots-Tag": "noindex, nofollow" },
    });
  }
  if (!slug || RESERVED_JOB_PATHS.has(slug)) return NextResponse.next();

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
    return NextResponse.redirect(
      new URL(`/jobs/${historicalSlug.job.slug}`, request.url),
      308,
    );
  }

  return NextResponse.rewrite(new URL("/404", request.url), {
    status: 404,
    headers: { "X-Robots-Tag": "noindex, nofollow" },
  });
}

export const config = {
  matcher: "/jobs/:slug",
};
