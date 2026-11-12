import { Prisma } from "@/generated/prisma/client";
import { getAuthorizedAdmin } from "@/lib/auth/session";
import { MAX_IMPORT_BYTES, parseCsv } from "@/lib/imports/csv";
import { guessColumnMapping } from "@/lib/imports/fields";
import { createStagedImport, sha256 } from "@/lib/imports/staging";
import { logger } from "@/lib/observability/logger";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { hasSameOrigin, requestIp } from "@/lib/security/request";

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const limit = await rateLimit(`csv-import:${admin.id}:${requestIp(request.headers)}`, 10, 60 * 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const sourceId = String(formData.get("sourceId") ?? "");
    if (!(file instanceof File) || !file.name.toLocaleLowerCase("en").endsWith(".csv")) {
      return Response.json({ error: "Choose a CSV file." }, { status: 400 });
    }
    if (!sourceId) return Response.json({ error: "Choose an approved source." }, { status: 400 });
    if (file.size > MAX_IMPORT_BYTES) return Response.json({ error: "CSV files are limited to 2 MB." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const { headers, rows } = parseCsv(text);
    const jobImport = await createStagedImport({
      sourceId,
      uploadedById: admin.id,
      fileName: file.name.slice(0, 255),
      fileChecksum: sha256(bytes),
      method: "CSV",
      rows,
      mapping: guessColumnMapping(headers),
    });
    return Response.json({ redirectTo: `/admin/imports/${jobImport.id}/map` }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return Response.json({ error: "This exact CSV file has already been staged." }, { status: 409 });
    }
    logger.warn("csv_import.staging_failed", { error, adminId: admin.id });
    return Response.json({ error: error instanceof Error ? error.message : "The CSV could not be staged." }, { status: 400 });
  }
}

