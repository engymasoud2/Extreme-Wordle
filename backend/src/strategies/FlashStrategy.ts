/**
 * ==========================================================
 *  FlashStrategy — "Flash / Memory" Mode
 * ==========================================================
 *
 * Rules:
 *  - Standard 5-letter Wordle evaluation.
 *  - The client shows the board for only 3 seconds, then
 *    whites out for 25 seconds (UI loop managed client-side).
 *  - Total time budget: 5 minutes (300 000 ms).
 *  - 6 guesses maximum.
 *  - Server enforces the master timer (the flash cycle is
 *    purely a client-side UX constraint).
 *
 * Health note: the client must implement smooth CSS
 * transitions and show a seizure warning before starting.
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

export class FlashStrategy implements IModeStrategy {
  readonly mode: GameMode = "FLASH";

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
    // Master timer check
    if (session.endsAt) {
      if (Date.now() >= new Date(session.endsAt).getTime()) {
        return "TIMED_OUT";
      }
    }

    const lastGuess = session.board[session.board.length - 1];
    if (lastGuess && isFullMatch(lastGuess)) return "WON";
    if (session.guessesUsed >= session.maxGuesses) return "LOST";

    return null;
  }
}
