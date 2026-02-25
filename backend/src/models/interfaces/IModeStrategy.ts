/**
 * ==========================================================
 *  IModeStrategy – Strategy Pattern Interface
 * ==========================================================
 *
 * Every game mode implements this interface.  The
 * GameEngineService delegates all mode-specific decisions
 * (validation rules, feedback generation, end-condition
 * checks) to the active strategy, keeping the engine itself
 * mode-agnostic.
 * ==========================================================
 */

import {
  GameSession,
  GuessResult,
  ModeRules,
  GameMode,
} from "./gameInterfaces";

export interface IModeStrategy {
  /** Identifies which mode this strategy handles */
  readonly mode: GameMode;

  /**
   * Returns the static rule-set for this mode (max guesses,
   * time budget, word length, etc.).
   */
  getRules(): ModeRules;

  /**
   * Evaluate a guess against the session's target word(s)
   * and return per-letter results.
   *
   * The strategy is responsible for any mode-specific
   * transformations (e.g. hex obfuscation in Guess the Rest,
   * or stripping colour info in Colorblind mode).
   *
   * @param session  Current server-side game state
   * @param guess    The player's guess (UPPER-CASE, already
   *                 validated as a real word by the engine)
   * @returns        An array (or tuple of arrays for Twin)
   *                 of per-letter results
   */
  evaluate(
    session: GameSession,
    guess: string
  ): { primary: GuessResult[]; secondary?: GuessResult[] };

  /**
   * Determine whether the game has ended after the latest
   * guess has been recorded on the session.
   *
   * @returns The new status, or `null` if the game continues.
   */
  checkEndCondition(
    session: GameSession
  ): "WON" | "LOST" | "TIMED_OUT" | null;

  /**
   * Optional hook called once when the session is first
   * created.  Strategies can use this to add mode-specific
   * fields (e.g. randomised hex colours) to the session.
   */
  onSessionCreated?(session: GameSession): void;
}
