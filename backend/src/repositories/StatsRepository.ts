/**
 * ==========================================================
 *  StatsRepository
 * ==========================================================
 *
 * Persists completed game results to the `match_history`
 * table and retrieves per-user statistics.
 * ==========================================================
 */

import { pool } from "../db/pgClient";
import { GameMode } from "../models";

/** Shape of a single match history row */
export interface MatchHistoryRow {
  id: string;
  userId: string;
  mode: GameMode;
  outcome: "WIN" | "LOSS" | "TIMEOUT";
  targetWord: string;
  guessesUsed: number;
  maxGuesses: number;
  durationMs: number | null;
  mercyTriggered: boolean;
  playedAt: string;
}

/** Aggregated stats for a single user */
export interface UserStats {
  totalGames: number;
  wins: number;
  losses: number;
  timeouts: number;
  avgGuesses: number;
  modeBreakdown: Record<string, number>;
}

export class StatsRepository {
  /**
   * Record a completed game in the match history.
   */
  async save(row: Omit<MatchHistoryRow, "id" | "playedAt">): Promise<void> {
    await pool.query(
      `INSERT INTO match_history
         (user_id, mode, outcome, target_word, guesses_used,
          max_guesses, duration_ms, mercy_triggered)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        row.userId,
        row.mode,
        row.outcome,
        row.targetWord,
        row.guessesUsed,
        row.maxGuesses,
        row.durationMs,
        row.mercyTriggered,
      ]
    );
  }

  /**
   * Retrieve aggregated statistics for a user.
   */
  async getByUser(userId: string): Promise<UserStats> {
    const totals = await pool.query<{
      total: string;
      wins: string;
      losses: string;
      timeouts: string;
      avg_guesses: string;
    }>(
      `SELECT
         COUNT(*)::text                        AS total,
         COUNT(*) FILTER (WHERE outcome = 'WIN')::text     AS wins,
         COUNT(*) FILTER (WHERE outcome = 'LOSS')::text    AS losses,
         COUNT(*) FILTER (WHERE outcome = 'TIMEOUT')::text AS timeouts,
         COALESCE(AVG(guesses_used), 0)::text              AS avg_guesses
       FROM match_history
       WHERE user_id = $1`,
      [userId]
    );

    const modeRows = await pool.query<{ mode: string; cnt: string }>(
      `SELECT mode, COUNT(*)::text AS cnt
         FROM match_history
        WHERE user_id = $1
        GROUP BY mode`,
      [userId]
    );

    const r = totals.rows[0]!;
    const modeBreakdown: Record<string, number> = {};
    for (const mr of modeRows.rows) {
      modeBreakdown[mr.mode] = parseInt(mr.cnt, 10);
    }

    return {
      totalGames: parseInt(r.total, 10),
      wins: parseInt(r.wins, 10),
      losses: parseInt(r.losses, 10),
      timeouts: parseInt(r.timeouts, 10),
      avgGuesses: parseFloat(parseFloat(r.avg_guesses).toFixed(2)),
      modeBreakdown,
    };
  }
}
