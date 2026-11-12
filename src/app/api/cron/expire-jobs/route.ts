import { timingSafeEqual } from "node:crypto";

import { expireDueJobs } from "@/lib/services/job-expiration";
import { logger } from "@/lib/observability/logger";
import { rateLimit, rateLimitResponse } from "@/lib/security/rate-limit";
import { requestIp } from "@/lib/security/request";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !supplied) return false;
  const expected = Buffer.from(secret);
  const received = Buffer.from(supplied);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function POST(request: Request) {
  const limit = await rateLimit(`cron-expire:${requestIp(request.headers)}`, 6, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);
  if (!authorized(request)) {
    logger.warn("cron.expire.unauthorized", { ip: requestIp(request.headers) });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    const expired = await expireDueJobs();
    logger.info("cron.expire.completed", { expired, durationMs: Date.now() - startedAt });
    return Response.json({ expired, completedAt: new Date().toISOString() });
  } catch (error) {
    logger.error("cron.expire.failed", { error, durationMs: Date.now() - startedAt });
    return Response.json({ error: "Expiration run failed." }, { status: 500 });
  }
}

