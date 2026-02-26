/**
 * ==========================================================
 *  DictionaryRepository
 * ==========================================================
 *
 * Data-access layer for the `dictionaries` table.
 * Responsible for selecting random target words and
 * validating whether a guess is a legitimate word.
 *
 * When the PostgreSQL dictionaries table lacks a word, we
 * fall back to the comprehensive `an-array-of-english-words`
 * npm package (~275 K words) so common words are never
 * rejected as "invalid".
 * ==========================================================
 */

import { pool } from "../db/pgClient";
import allWords from "an-array-of-english-words";

/**
 * Pre-built Set of the full english word list, upper-cased,
 * for O(1) fallback lookups.
 */
const FALLBACK_WORD_SET: Set<string> = new Set(
  (allWords as string[]).map((w: string) => w.toUpperCase())
);

export class DictionaryRepository {
  /**
   * Select a random word eligible to be a target.
   *
   * @param wordLength  Desired word length (default 5)
   * @returns           Upper-cased target word
   * @throws            If no eligible words exist
   */
  async getRandomWord(wordLength: number = 5): Promise<string> {
    const result = await pool.query<{ word: string }>(
      `SELECT word
         FROM dictionaries
        WHERE word_length = $1
          AND is_target = TRUE
        ORDER BY RANDOM()
        LIMIT 1`,
      [wordLength]
    );

    const row = result.rows[0];
    if (!row) {
      throw new Error(
        `[DictionaryRepository] No target words found for length ${wordLength}`
      );
    }

    return row.word.toUpperCase();
  }

  /**
   * Check whether a word exists in the dictionary
   * (regardless of whether it is flagged as a valid target).
   *
   * First checks the PostgreSQL `dictionaries` table and, if
   * the word is not found there, falls back to the broad
   * `an-array-of-english-words` package so that common
   * English words are never rejected.
   *
   * @param word  The word to validate (case-insensitive)
   * @returns     `true` if the word is in any dictionary
   */
  async isValidWord(word: string): Promise<boolean> {
    // 1. Check PostgreSQL
    try {
      const result = await pool.query<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt
           FROM dictionaries
          WHERE UPPER(word) = UPPER($1)`,
        [word]
      );
      const row = result.rows[0];
      if (row && parseInt(row.cnt, 10) > 0) return true;
    } catch {
      // DB unavailable — fall through to local fallback
    }

    // 2. Check the comprehensive npm word list
    return FALLBACK_WORD_SET.has(word.toUpperCase());
  }
}
