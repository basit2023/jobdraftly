import "server-only";

import { createHash } from "node:crypto";

import { logger } from "@/lib/observability/logger";
import { getRedisClient } from "@/lib/redis";

type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Entry>();
const MAX_BUCKETS = 10_000;

export type RateLimitResult = { allowed: boolean; limit: number; remaining: number; retryAfter: number };

function localRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const safeLimit = Math.max(1, limit);
  const id = createHash("sha256").update(key).digest("hex");
  let entry = buckets.get(id);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    buckets.set(id, entry);
  }
  entry.count += 1;

  if (buckets.size > MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now || buckets.size > MAX_BUCKETS) buckets.delete(bucketKey);
      if (buckets.size <= MAX_BUCKETS) break;
    }
  }

  return {
    allowed: entry.count <= safeLimit,
    limit: safeLimit,
    remaining: Math.max(0, safeLimit - entry.count),
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1_000)),
  };
}

export async function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): Promise<RateLimitResult> {
  const safeLimit = Math.max(1, limit);
  const id = createHash("sha256").update(key).digest("hex");
  try {
    const redis = await getRedisClient(false);
    if (!redis) return localRateLimit(key, safeLimit, windowMs, now);
    const redisKey = `${process.env.REDIS_KEY_PREFIX || "jobdraftly"}:rate:${id}`;
    const result = await redis.eval(
      "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; local ttl=redis.call('PTTL',KEYS[1]); return {count,ttl}",
      { keys: [redisKey], arguments: [String(windowMs)] },
    ) as [number, number];
    const count = Number(result[0]);
    const ttl = Math.max(1, Number(result[1]));
    return { allowed: count <= safeLimit, limit: safeLimit, remaining: Math.max(0, safeLimit - count), retryAfter: Math.max(1, Math.ceil(ttl / 1_000)) };
  } catch (error) {
    logger.error("rate_limit.redis_failed", { error });
    if (process.env.NODE_ENV === "production") throw error;
    return localRateLimit(key, safeLimit, windowMs, now);
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
