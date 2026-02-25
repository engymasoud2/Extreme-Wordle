/**
 * ==========================================================
 *  DictionaryRepository
 * ==========================================================
 *
 * Data-access layer for the `dictionaries` table.
 * Responsible for selecting random target words and
 * validating whether a guess is a legitimate word.
 * ==========================================================
 */

import { pool } from "../db/pgClient";

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
   * @param word  The word to validate (case-insensitive)
   * @returns     `true` if the word is in the dictionary
   */
  async isValidWord(word: string): Promise<boolean> {
    const result = await pool.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
         FROM dictionaries
        WHERE UPPER(word) = UPPER($1)`,
      [word]
    );
    const row = result.rows[0];
    return row ? parseInt(row.cnt, 10) > 0 : false;
  }
}
