/**
 * ==========================================================
 *  TwinStrategy — "Twin" Mode
 * ==========================================================
 *
 * Rules:
 *  - The player must solve TWO words simultaneously.
 *  - Each guess is evaluated against both target words.
 *  - The game is won only when BOTH words are solved.
 *  - 7 guesses to offset the increased difficulty.
 *  - Words should ideally share vowels (selection is done
 *    at the repository level via future heuristics).
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

export class TwinStrategy implements IModeStrategy {
  readonly mode: GameMode = "TWIN";

  getRules(): ModeRules {
    return {
      maxGuesses: 7,
      wordLength: 5,
      requiresSecondWord: true,
      hideColors: false,
      obfuscateColors: false,
    };
  }

  evaluate(
    session: GameSession,
    guess: string
  ): { primary: GuessResult[]; secondary: GuessResult[] } {
    const primary = evaluateStandard(guess, session.targetWord);

    // targetWordSecondary is guaranteed to exist for TWIN mode
    const secondary = evaluateStandard(
      guess,
      session.targetWordSecondary!
    );

    return { primary, secondary };
  }

  checkEndCondition(session: GameSession): "WON" | "LOST" | null {
    const lastPrimary = session.board[session.board.length - 1];
    const lastSecondary =
      session.boardSecondary?.[session.boardSecondary.length - 1];

    // Check if BOTH boards have been solved (any guess, not just last)
    const primarySolved = session.board.some((row) => isFullMatch(row));
    const secondarySolved = session.boardSecondary?.some((row) =>
      isFullMatch(row)
    );

    if (primarySolved && secondarySolved) return "WON";

    if (session.guessesUsed >= session.maxGuesses) return "LOST";

    return null;
  }
}
