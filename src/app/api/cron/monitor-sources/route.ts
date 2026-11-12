import { timingSafeEqual } from "node:crypto";

import { runDueSourceMonitors } from "@/lib/monitoring/runner";
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
  const limit = await rateLimit(`cron-monitor:${requestIp(request.headers)}`, 6, 60_000);
  if (!limit.allowed) return rateLimitResponse(limit);
  if (!authorized(request)) {
    logger.warn("cron.monitor.unauthorized", { ip: requestIp(request.headers) });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const startedAt = Date.now();
  try {
    const requestedLimit = Number(process.env.MONITOR_SOURCE_BATCH_SIZE ?? 10);
    const result = await runDueSourceMonitors(Number.isFinite(requestedLimit) ? requestedLimit : 10);
    logger.info("cron.monitor.completed", { checked: result.checked, durationMs: Date.now() - startedAt });
    return Response.json({ ...result, completedAt: new Date().toISOString() });
  } catch (error) {
    logger.error("cron.monitor.failed", { error, durationMs: Date.now() - startedAt });
    return Response.json({ error: "Source monitoring run failed." }, { status: 500 });
  }
}
