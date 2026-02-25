/**
 * ==========================================================
 *  SessionCacheService
 * ==========================================================
 *
 * Manages active game sessions in Redis.
 *
 * Key pattern : `game_session:{sessionId}`
 * TTL         : 3600 seconds (1 hour)
 *
 * Sessions are serialised as JSON.  The full GameSession
 * object (including the secret target word AND the hex
 * colour key for Guess the Rest) is stored here.  The
 * client never sees the raw Redis value — only safe DTOs
 * are returned through the API layer.
 *
 * Security invariant:
 *   - `targetWord`, `targetWordSecondary`, `mercyPunchline`,
 *     `exactColorHex`, `partialColorHex`, and `absentColorHex`
 *     must NEVER leave this service without being stripped
 *     by the DTO mapper.
 * ==========================================================
 */

import { getRedisClient } from "../db/redisClient";
import { GameSession } from "../models";

/** Redis key prefix for all game sessions */
const KEY_PREFIX = "game_session";

/** Default TTL in seconds (1 hour) */
const SESSION_TTL = 3600;

export class SessionCacheService {
  // ── Key Helper ──────────────────────────────────────────

  private key(sessionId: string): string {
    return `${KEY_PREFIX}:${sessionId}`;
  }

  // ── CRUD Operations ─────────────────────────────────────

  /**
   * Retrieve a session from Redis.
   *
   * ⚠️  Returns the FULL session including secrets.  The
   *     caller (GameEngineService) is responsible for never
   *     forwarding secret fields to the controller layer
   *     without sanitisation.
   *
   * @param sessionId  The game session identifier
   * @returns          The full GameSession, or null if expired / missing
   */
  async get(sessionId: string): Promise<GameSession | null> {
    const client = await getRedisClient();
    const raw = await client.get(this.key(sessionId));

    if (!raw) return null;

    return JSON.parse(raw) as GameSession;
  }

  /**
   * Persist (create or update) a session in Redis with the
   * configured TTL.
   *
   * The entire GameSession — including the obfuscated hex
   * colour mapping for Guess the Rest — is serialised and
   * stored.  Redis is the single source of truth for live
   * game state.
   *
   * @param sessionId  The game session identifier
   * @param session    Complete session state to store
   */
  async set(sessionId: string, session: GameSession): Promise<void> {
    const client = await getRedisClient();
    await client.set(this.key(sessionId), JSON.stringify(session), {
      EX: SESSION_TTL,
    });
  }

  /**
   * Delete a session (e.g. after the game ends and stats
   * have been persisted to PostgreSQL).
   *
   * @param sessionId  The game session identifier
   */
  async delete(sessionId: string): Promise<void> {
    const client = await getRedisClient();
    await client.del(this.key(sessionId));
  }

  /**
   * Refresh the TTL for an active session (e.g. on each
   * guess to prevent mid-game expiration).
   */
  async touch(sessionId: string): Promise<void> {
    const client = await getRedisClient();
    await client.expire(this.key(sessionId), SESSION_TTL);
  }

  /**
   * Check whether a session exists without deserialising it.
   * Useful for lightweight existence checks.
   */
  async exists(sessionId: string): Promise<boolean> {
    const client = await getRedisClient();
    const count = await client.exists(this.key(sessionId));
    return count > 0;
  }
}
