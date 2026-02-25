import { createClient, RedisClientType } from "redis";
import { config } from "../config";

/**
 * Redis client singleton.
 *
 * Used exclusively for active game session storage.
 * All keys follow the pattern  `game_session:{sessionId}`
 * with a TTL of 3600 seconds (1 hour) as specified in the
 * data-schema section of the dev spec.
 */
let redisClient: RedisClientType;

/**
 * Returns the shared Redis client, creating and connecting it
 * lazily on first call.
 */
export async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    redisClient = createClient({ url: config.redis.url }) as RedisClientType;

    redisClient.on("error", (err) => {
      console.error("[Redis] Client error:", err);
    });

    redisClient.on("connect", () => {
      console.log("[Redis] Connected successfully.");
    });

    await redisClient.connect();
  }
  return redisClient;
}

/**
 * Graceful shutdown helper — disconnect the Redis client.
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    console.log("[Redis] Client disconnected.");
  }
}
