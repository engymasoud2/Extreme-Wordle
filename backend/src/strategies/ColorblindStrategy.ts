/**
 * ==========================================================
 *  ColorblindStrategy — "Colorblind" Mode
 * ==========================================================
 *
 * Rules:
 *  - Standard 5-letter Wordle evaluation.
 *  - However, the status field is REMOVED from every letter
 *    result — the client receives `"absent"` for all letters
 *    regardless of actual position.
 *  - The player must deduce purely from their own mental
 *    model with no colour cues at all.
 *  - 8 guesses to offset extreme difficulty.
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

export class ColorblindStrategy implements IModeStrategy {
  readonly mode: GameMode = "COLORBLIND";

  getRules(): ModeRules {
    return {
      maxGuesses: 8,
      wordLength: 5,
      requiresSecondWord: false,
      hideColors: true,        // key differentiator
      obfuscateColors: false,
    };
  }

  evaluate(
    session: GameSession,
    guess: string
  ): { primary: GuessResult[] } {
    // Run real evaluation internally (we need it for end-condition)
    const real = evaluateStandard(guess, session.targetWord);

    // Strip all status info — the client sees everything as "absent".
    // We store the REAL results on the server board so that
    // checkEndCondition can detect a win, but the DTO mapper
    // will replace statuses before sending to the client.
    // Here we return the real results; the controller layer
    // handles the "colorblind" sanitisation for the response.
    return { primary: real };
  }

  checkEndCondition(session: GameSession): "WON" | "LOST" | null {
    const lastGuess = session.board[session.board.length - 1];
    if (lastGuess && isFullMatch(lastGuess)) return "WON";
    if (session.guessesUsed >= session.maxGuesses) return "LOST";
    return null;
  }
}
