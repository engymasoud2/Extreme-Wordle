/**
 * ==========================================================
 *  GuessTheRestStrategy — "Guess the Rest" Mode
 * ==========================================================
 *
 * The most devious mode.  Standard Wordle evaluation is
 * performed internally, but the colour-coded letter statuses
 * are REPLACED by randomised hex colours.  The player sees
 * coloured tiles but doesn't know which colour means
 * "correct", "present", or "absent" — they must DEDUCE
 * the colour key from the patterns across guesses.
 *
 * Security:
 *  - The three hex values (exact, partial, absent) are
 *    generated on the server at session creation and stored
 *    exclusively in Redis.
 *  - They are NEVER sent to the client directly.
 *  - The client only receives the obfuscated hex per letter.
 *
 * Algorithm:
 *  1. On session creation (`onSessionCreated`), three
 *     high-contrast random colours are generated and saved
 *     on the session as `exactColorHex`, `partialColorHex`,
 *     and `absentColorHex`.
 *  2. On each guess, the standard evaluation runs first.
 *     Then each letter's `status` is replaced with
 *     `"obfuscated"` and the matching hex is attached.
 *  3. The player deduces via cross-referencing results.
 *
 * Example:
 *   If exactColorHex = "#FF5733" and the letter 'A' is
 *   in the correct position, the result sent to the client
 *   is: { letter: "A", status: "obfuscated", hex: "#FF5733" }
 * ==========================================================
 */

import { IModeStrategy } from "../models/interfaces/IModeStrategy";
import {
  GameSession,
  GuessResult,
  LetterStatus,
  ModeRules,
  GameMode,
} from "../models/interfaces/gameInterfaces";
import { evaluateStandard, isFullMatch } from "./evaluationUtils";

// ── Colour Generation Helpers ─────────────────────────────

/**
 * Pre-defined palette of high-contrast, visually distinct
 * colours.  Three are picked at random (without replacement)
 * so they are always distinguishable from each other.
 *
 * WCAG 2.1 contrast ratios have been considered.
 */
const HIGH_CONTRAST_PALETTE: string[] = [
  "#FF5733", // Vibrant red-orange
  "#33FF57", // Bright green
  "#3357FF", // Bold blue
  "#FF33F6", // Hot pink
  "#33FFF6", // Cyan
  "#F6FF33", // Electric yellow
  "#FF8C33", // Tangerine
  "#8C33FF", // Purple
  "#33FF8C", // Mint
  "#FF3333", // Pure red
  "#3333FF", // Deep blue
  "#33FFFF", // Aqua
];

/**
 * Shuffle an array using Fisher-Yates and return the first
 * `n` elements.  This guarantees no two chosen colours are
 * the same.
 */
function pickDistinctColors(n: number): string[] {
  const shuffled = [...HIGH_CONTRAST_PALETTE];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  return shuffled.slice(0, n);
}

// ── Strategy Implementation ───────────────────────────────

export class GuessTheRestStrategy implements IModeStrategy {
  readonly mode: GameMode = "GUESS_THE_REST";

  getRules(): ModeRules {
    return {
      maxGuesses: 6,
      wordLength: 6,            // 6-letter words for extra difficulty
      requiresSecondWord: false,
      hideColors: false,
      obfuscateColors: true,    // key differentiator
    };
  }

  /**
   * Called once at session creation.  Generates three random
   * hex colours and attaches them to the session.
   *
   * These values persist in Redis and are never exposed to
   * the client.
   */
  onSessionCreated(session: GameSession): void {
    const [exact, partial, absent] = pickDistinctColors(3);
    session.exactColorHex = exact;
    session.partialColorHex = partial;
    session.absentColorHex = absent;
  }

  /**
   * Evaluate the guess, then obfuscate the results.
   *
   * Steps:
   *  1. Run the standard Wordle evaluation to determine the
   *     real "correct" / "present" / "absent" status.
   *  2. Map each result to an obfuscated version:
   *       - `status` → always "obfuscated"
   *       - `hex`    → the session's colour for the real status
   *  3. Return the obfuscated array.
   *
   * The **server board** stores the REAL results so that
   * `checkEndCondition` works correctly.  The engine is
   * responsible for storing the real result on the session
   * board and sending the obfuscated version to the client.
   */
  evaluate(
    session: GameSession,
    guess: string
  ): { primary: GuessResult[]; _realResults?: GuessResult[] } {
    // Step 1 — real evaluation
    const realResults = evaluateStandard(guess, session.targetWord);

    // Step 2 — obfuscate for client
    const statusToHex: Record<string, string> = {
      correct: session.exactColorHex!,
      present: session.partialColorHex!,
      absent: session.absentColorHex!,
    };

    const obfuscated: GuessResult[] = realResults.map((r) => ({
      letter: r.letter,
      status: "obfuscated" as LetterStatus,
      hex: statusToHex[r.status],
    }));

    // Return BOTH sets — the engine stores `_realResults` on
    // the server board and sends `primary` (obfuscated) to
    // the client.
    return { primary: obfuscated, _realResults: realResults };
  }

  checkEndCondition(session: GameSession): "WON" | "LOST" | null {
    // The server board stores real results, so isFullMatch works
    const lastGuess = session.board[session.board.length - 1];
    if (lastGuess && isFullMatch(lastGuess)) return "WON";
    if (session.guessesUsed >= session.maxGuesses) return "LOST";
    return null;
  }
}
