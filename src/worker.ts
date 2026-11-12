import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { runDueSourceMonitors } from "@/lib/monitoring/runner";
import { logger } from "@/lib/observability/logger";
import { closeRedis, getRedisClient } from "@/lib/redis";
import { expireDueJobs } from "@/lib/services/job-expiration";

const prefix = process.env.REDIS_KEY_PREFIX || "jobdraftly";
const pollMs = Math.min(Math.max(Number(process.env.WORKER_POLL_INTERVAL_MS || 60_000), 10_000), 300_000);
const sourceBatch = Math.min(Math.max(Number(process.env.MONITOR_SOURCE_BATCH_SIZE || 10), 1), 25);
// How often expired jobs are taken down (default every 15 minutes).
const expiryIntervalMs = Math.min(Math.max(Number(process.env.EXPIRY_INTERVAL_MINUTES || 15), 1), 1_440) * 60_000;
const workerId = randomUUID();
let stopping = false;
let sleepTimer: NodeJS.Timeout | null = null;
let wakeSleep: (() => void) | null = null;

async function sleep(milliseconds: number) {
  if (stopping) return;
  await new Promise<void>((resolve) => {
    wakeSleep = resolve;
    sleepTimer = setTimeout(resolve, milliseconds);
  });
  sleepTimer = null;
  wakeSleep = null;
}

const developmentMode = process.argv.includes("--dev") || process.env.ALLOW_DEVELOPMENT_WORKER === "true";
let lastExpiryRunAt = 0;

/** One pass: scan due sources → AI-publish new adverts → sync live jobs → expire due jobs. */
async function runJobs(canRunExpiry: () => Promise<boolean>) {
  const startedAt = Date.now();
  const monitorResult = await runDueSourceMonitors(sourceBatch);
  const expired = (await canRunExpiry()) ? await expireDueJobs() : 0;
  logger.info("worker.cycle_completed", {
    workerId,
    checked: monitorResult.checked,
    published: monitorResult.publishing.PUBLISHED,
    queuedForReview: monitorResult.publishing.PENDING_REVIEW,
    closedBySource: monitorResult.lifecycle.closed,
    expired,
    durationMs: Date.now() - startedAt,
  });
}

async function cycle() {
  const redis = await getRedisClient(!developmentMode);
  if (!redis) {
    // Local development without Redis: a single process, so an in-memory schedule is enough.
    await runJobs(async () => {
      const due = Date.now() - lastExpiryRunAt >= expiryIntervalMs;
      if (due) lastExpiryRunAt = Date.now();
      return due;
    });
    return;
  }
  const acquired = await redis.set(`${prefix}:worker:lease`, workerId, { NX: true, PX: 30 * 60_000 });
  if (!acquired) {
    await redis.set(`${prefix}:worker:heartbeat`, new Date().toISOString(), { EX: 180 });
    return;
  }

  try {
    await runJobs(async () => Boolean(await redis.set(`${prefix}:worker:expiry-lease`, workerId, { NX: true, PX: expiryIntervalMs })));
    await redis.set(`${prefix}:worker:heartbeat`, new Date().toISOString(), { EX: 180 });
  } finally {
    const currentLease = await redis.get(`${prefix}:worker:lease`);
    if (currentLease === workerId) await redis.del(`${prefix}:worker:lease`);
  }
}

async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  if (sleepTimer) clearTimeout(sleepTimer);
  wakeSleep?.();
  logger.info("worker.shutdown_started", { workerId, signal });
  await Promise.allSettled([db.$disconnect(), closeRedis()]);
  logger.info("worker.shutdown_completed", { workerId, signal });
}

process.once("SIGINT", () => { void shutdown("SIGINT"); });
process.once("SIGTERM", () => { void shutdown("SIGTERM"); });

async function main() {
  if (process.env.NODE_ENV !== "production" && !developmentMode) {
    throw new Error("Run `npm run worker:dev` locally, or set NODE_ENV=production to start the worker.");
  }
  logger.info("worker.started", { workerId, pollMs, sourceBatch, expiryIntervalMs, mode: developmentMode ? "development" : "production" });
  while (!stopping) {
    try {
      await cycle();
    } catch (error) {
      logger.error("worker.cycle_failed", { workerId, error });
    }
    await sleep(pollMs);
  }
}

main().catch(async (error) => {
  logger.error("worker.fatal", { workerId, error });
  await shutdown("fatal");
  process.exitCode = 1;
});
