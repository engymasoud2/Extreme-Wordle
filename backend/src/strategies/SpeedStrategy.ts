/**
 * ==========================================================
 *  SpeedStrategy — "Speed Run" Mode
 * ==========================================================
 *
 * Rules:
 *  - Standard Wordle evaluation (5-letter words).
 *  - Total time budget: 5 minutes (300 000 ms).
 *  - The game is lost if the timer expires, regardless of
 *    how many guesses remain.
 *  - 6 guesses maximum.
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

export class SpeedStrategy implements IModeStrategy {
  readonly mode: GameMode = "SPEED";

  getRules(): ModeRules {
    return {
      maxGuesses: 6,
      timeBudgetMs: 300_000, // 5 minutes
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

  checkEndCondition(session: GameSession): "WON" | "LOST" | "TIMED_OUT" | null {
    // Check timer first
    if (session.endsAt) {
      const now = Date.now();
      const deadline = new Date(session.endsAt).getTime();
      if (now >= deadline) return "TIMED_OUT";
    }

    // Check latest guess for win
    const lastGuess = session.board[session.board.length - 1];
    if (lastGuess && isFullMatch(lastGuess)) return "WON";

    // Check exhausted guesses
    if (session.guessesUsed >= session.maxGuesses) return "LOST";

    return null;
  }
}
