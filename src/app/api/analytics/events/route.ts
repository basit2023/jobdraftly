import { db } from "@/lib/db";
import { publishedJobWhere } from "@/lib/services/public-jobs";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/security/request";
import { analyticsEventSchema } from "@/lib/validations/analytics";


export async function POST(request: Request) {
  const size = Number(request.headers.get("content-length") || 0);
  if (size > 4_096) return Response.json({ error: "Payload too large" }, { status: 413 });
  const limit = await rateLimit(`public-analytics:${requestIp(request.headers)}`, 120, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  let body: unknown;
  try { body = JSON.parse(await request.text()); }
  catch { return Response.json({ error: "Invalid event" }, { status: 400 }); }
  const parsed = analyticsEventSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Invalid event" }, { status: 400 });
  const data = parsed.data;

  if (data.type === "JOB_VIEW" || data.type === "APPLICATION_LINK_CLICK") {
    const eligible = await db.job.findFirst({ where: { AND: [publishedJobWhere(), { id: data.jobId! }] }, select: { id: true } });
    if (!eligible) return Response.json({ error: "Ineligible job" }, { status: 404 });
  }

  await db.analyticsEvent.create({
    data: {
      type: data.type,
      jobId: data.jobId,
      path: data.path,
      locationSlug: data.locationSlug,
      categorySlug: data.categorySlug,
      filterCount: data.filterCount,
      metadata: data.metadata,
    },
  });
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
