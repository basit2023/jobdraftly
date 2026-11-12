import { createClient, type RedisClientType } from "redis";

import { logger } from "@/lib/observability/logger";

let client: RedisClientType | null = null;
let connection: Promise<RedisClientType> | null = null;

export function redisIsConfigured() {
  return Boolean(process.env.REDIS_URL?.trim());
}

export async function getRedisClient(required = false) {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    if (required) throw new Error("REDIS_URL is required for this production process.");
    return null;
  }
  if (client?.isReady) return client;
  if (connection) return connection;

  client = createClient({
    url,
    socket: {
      connectTimeout: 5_000,
      reconnectStrategy: (retries) => Math.min(250 * 2 ** Math.min(retries, 5), 5_000),
    },
  });
  client.on("error", (error) => logger.error("redis.client_error", { error }));
  connection = client.connect().then(() => client as RedisClientType).finally(() => { connection = null; });
  return connection;
}

export async function closeRedis() {
  const active = client;
  client = null;
  connection = null;
  if (active?.isOpen) await active.close();
}
