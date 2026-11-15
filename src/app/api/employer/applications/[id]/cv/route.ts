import { getAuthorizedEmployer } from "@/lib/auth/employer-session";
import { getAuthorizedAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";
import { readPrivateFile } from "@/lib/storage/private-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Streams a candidate's CV. Only the company that received the application
 * (or a JobDraftly administrator) can read it. Responses are never cached.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const employer = await getAuthorizedEmployer();
  const admin = employer ? null : await getAuthorizedAdmin();
  if (!employer && !admin) return new Response("Unauthorized", { status: 401, headers: { "Cache-Control": "no-store" } });

  const application = await db.jobApplication.findFirst({
    where: { id, ...(employer ? { companyId: employer.companyId } : {}) },
    select: { id: true, cvStorageKey: true, cvFileName: true, cvMimeType: true, viewedAt: true },
  });
  // Same response for "doesn't exist" and "belongs to another company".
  if (!application) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });

  let body: Uint8Array;
  try {
    body = await readPrivateFile(application.cvStorageKey);
  } catch (error) {
    logger.error("applications.cv_read_failed", { applicationId: application.id, error });
    return new Response("The CV file could not be found.", { status: 410, headers: { "Cache-Control": "no-store" } });
  }
  if (employer && !application.viewedAt) {
    await db.jobApplication.update({ where: { id: application.id }, data: { viewedAt: new Date() } });
  }

  const inline = new URL(request.url).searchParams.get("inline") === "1" && application.cvMimeType === "application/pdf";
  return new Response(Buffer.from(body), {
    headers: {
      "Content-Type": application.cvMimeType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${application.cvFileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
