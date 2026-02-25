/**
 * ==========================================================
 *  Shared Evaluation Utilities
 * ==========================================================
 *
 * Pure helper functions shared by all mode strategies.
 * The canonical Wordle evaluation algorithm lives here so
 * every strategy can reuse it without duplication.
 * ==========================================================
 */

import { GuessResult, LetterStatus } from "../models";

/**
 * Evaluate a 5- or 6-letter guess against a target word
 * using standard Wordle rules:
 *
 *  1. Mark exact positional matches as "correct".
 *  2. For remaining letters, mark as "present" if the letter
 *     exists elsewhere in the target (respecting count limits).
 *  3. Everything else is "absent".
 *
 * @param guess   Upper-cased guess string
 * @param target  Upper-cased target string
 * @returns       Array of per-letter results
 */
export function evaluateStandard(
  guess: string,
  target: string
): GuessResult[] {
  const length = target.length;
  const guessChars = guess.split("");
  const targetChars = target.split("");
  const results: GuessResult[] = new Array(length);

  // Track how many of each letter in the target are still
  // available for "present" matches after exact matches are
  // consumed.
  const remaining: Record<string, number> = {};
  for (const ch of targetChars) {
    remaining[ch] = (remaining[ch] ?? 0) + 1;
  }

  // ── Pass 1: exact matches ("correct") ──────────────────
  for (let i = 0; i < length; i++) {
    const g = guessChars[i]!;
    const t = targetChars[i]!;
    if (g === t) {
      results[i] = { letter: g, status: "correct" };
      remaining[g] = (remaining[g] ?? 0) - 1;
    }
  }

  // ── Pass 2: present / absent ───────────────────────────
  for (let i = 0; i < length; i++) {
    if (results[i]) continue; // already marked correct

    const g = guessChars[i]!;
    const count = remaining[g] ?? 0;
    if (count > 0) {
      results[i] = { letter: g, status: "present" };
      remaining[g] = count - 1;
    } else {
      results[i] = { letter: g, status: "absent" };
    }
  }

  return results;
}

/**
 * Check if every letter in the result set is "correct"
 * (i.e. the guess exactly matches the target).
 */
export function isFullMatch(results: GuessResult[]): boolean {
  return results.every((r) => r.status === "correct");
}
