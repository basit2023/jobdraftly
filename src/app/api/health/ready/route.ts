import { db } from "@/lib/db";
import { logger } from "@/lib/observability/logger";
import { getRedisClient, redisIsConfigured } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const redis = await getRedisClient(process.env.NODE_ENV === "production");
    await Promise.race([
      Promise.all([db.job.count({ take: 1 }), redis?.ping()]),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Database readiness check timed out.")), 3_000)),
    ]);
    return Response.json(
      { status: "ready", checks: { database: "ok", redis: redisIsConfigured() ? "ok" : "not_configured" }, responseTimeMs: Date.now() - startedAt },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    logger.error("health.readiness_failed", { error, responseTimeMs: Date.now() - startedAt });
    return Response.json(
      { status: "not_ready", checks: { dependencies: "unavailable" } },
      { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } },
    );
  }
}
