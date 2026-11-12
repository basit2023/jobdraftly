import { getRedisClient } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const redis = await getRedisClient(true);
    const key = `${process.env.REDIS_KEY_PREFIX || "jobdraftly"}:worker:heartbeat`;
    const heartbeat = await redis?.get(key);
    if (!heartbeat) throw new Error("Worker heartbeat is missing.");
    const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(heartbeat)) / 1_000));
    if (!Number.isFinite(ageSeconds) || ageSeconds > 180) throw new Error("Worker heartbeat is stale.");
    return Response.json({ status: "healthy", ageSeconds }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unhealthy" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
}
