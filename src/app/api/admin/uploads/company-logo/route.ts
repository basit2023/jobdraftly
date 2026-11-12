import { randomUUID } from "node:crypto";

import { getAuthorizedAdmin } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/services/admin-audit";
import { validateImage } from "@/lib/security/image-validation";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { hasSameOrigin, requestIp } from "@/lib/security/request";
import { storePublicObject } from "@/lib/storage/object-store";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;

export async function POST(request: Request) {
  const admin = await getAuthorizedAdmin();
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasSameOrigin(request)) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  const limit = await rateLimit(`company-logo:${admin.id}:${requestIp(request.headers)}`, 20, 60 * 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Select an image file" }, { status: 400 });
  if (file.size < 1 || file.size > MAX_BYTES) return Response.json({ error: "Logo must be smaller than 2 MB" }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = validateImage(bytes, file.type);
  if (!image) return Response.json({ error: "Only valid PNG, JPEG, or WebP images up to 4096px are accepted" }, { status: 400 });

  const objectKey = `company-logos/${randomUUID()}.${image.extension}`;
  const url = await storePublicObject({ key: objectKey, body: bytes, contentType: file.type });

  await createAuditLog({
    adminId: admin.id,
    action: "UPLOAD",
    entityType: "CompanyLogo",
    summary: "Uploaded a validated company logo",
    metadata: { path: url, bytes: file.size, format: image.extension, width: image.width, height: image.height },
  });

  return Response.json({ url });
}
