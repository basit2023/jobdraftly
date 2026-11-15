import { logger } from "@/lib/observability/logger";
import { MAX_CV_BYTES } from "@/lib/security/document-validation";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { hasSameOrigin, requestIp } from "@/lib/security/request";
import { ApplicationError, submitApplication } from "@/lib/services/applications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** A job seeker applies to an ON_SITE job with their CV. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSameOrigin(request)) return json({ error: "Invalid request origin." }, 403);
  // Enough for genuine use (a few jobs an hour), too little for spam runs.
  const limit = await rateLimit(`job-apply:${requestIp(request.headers)}`, 10, 60 * 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);
  if (Number(request.headers.get("content-length") || 0) > MAX_CV_BYTES + 64 * 1024) {
    return json({ error: "Your CV must be 5 MB or smaller.", field: "cv" }, 413);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ error: "The form could not be read. Please try again." }, 400);
  }
  // Hidden field real people never fill in.
  if (String(form.get("website") ?? "")) return json({ ok: true });

  const { id } = await params;
  const file = form.get("cv");
  try {
    await submitApplication({
      jobId: id,
      fields: {
        fullName: form.get("fullName"),
        email: form.get("email"),
        phone: form.get("phone"),
        city: form.get("city"),
        coverLetter: form.get("coverLetter"),
        consent: form.get("consent"),
      },
      cv: file instanceof File && file.size > 0 ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : null,
    });
    return json({ ok: true }, 201);
  } catch (error) {
    if (error instanceof ApplicationError) return json({ error: error.message, field: error.field }, 400);
    logger.error("applications.submit_failed", { jobId: id, error });
    return json({ error: "Your application could not be sent. Please try again in a few minutes." }, 500);
  }
}
