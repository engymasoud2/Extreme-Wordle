/**
 * ==========================================================
 *  MercyStrategy — "Show Mercy" Mode
 * ==========================================================
 *
 * Rules:
 *  - Standard 5-letter Wordle evaluation.
 *  - 6 guesses maximum.
 *  - When the player exhausts all guesses WITHOUT solving:
 *      • Instead of an immediate loss, the server triggers
 *        a "mercy state" and sends a dad joke prompt.
 *      • If the player answers the joke correctly, they get
 *        ONE additional guess.
 *      • If wrong, the game ends as a loss.
 *  - Mercy can only be triggered once per session.
 *
 * The joke fetching / validation is handled by JokeService.
 * This strategy only manages the end-condition logic.
 * ==========================================================
 */

import { IModeStrategy } from "../models/interfaces/IModeStrategy";
import {
  GameSession,
  GuessResult,
  ModeRules,
  GameMode,
} from "../models/interfaces/gameInterfaces";
import { evaluateStandard, isFullMatch } from "./evaluationUtils";

export class MercyStrategy implements IModeStrategy {
  readonly mode: GameMode = "MERCY";

  getRules(): ModeRules {
    return {
      maxGuesses: 6,
      wordLength: 5,
      requiresSecondWord: false,
      hideColors: false,
      obfuscateColors: false,
    };
  }

  evaluate(
    session: GameSession,
    guess: string
  ): { primary: GuessResult[] } {
    return { primary: evaluateStandard(guess, session.targetWord) };
  }

  /**
   * End-condition for Mercy mode is more nuanced:
   *
   * - Win if the word is solved.
   * - If guesses are exhausted AND mercy has NOT been
   *   triggered yet, return `null` — the engine will
   *   transition the session into the mercy state
   *   (game is NOT over yet).
   * - If guesses are exhausted AND mercy HAS already been
   *   used, it's a loss.
   */
  checkEndCondition(session: GameSession): "WON" | "LOST" | null {
    const lastGuess = session.board[session.board.length - 1];
    if (lastGuess && isFullMatch(lastGuess)) return "WON";

    if (session.guessesUsed >= session.maxGuesses) {
      // Mercy already used or denied → definitive loss
      if (session.mercyTriggered) return "LOST";

      // Otherwise, mercy is available — return null so the
      // engine initiates the joke prompt flow instead of
      // ending the game.
      return null;
    }

    return null;
  }
}
