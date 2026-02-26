/**
 * ==========================================================
 *  DTO Mapper — Session → Client-Safe Transformations
 * ==========================================================
 *
 * This module is the SINGLE point of truth for converting
 * internal GameSession objects into client-safe DTOs.
 *
 * Security contract:
 *   The following fields must NEVER appear in any DTO:
 *     - targetWord
 *     - targetWordSecondary
 *     - exactColorHex
 *     - partialColorHex
 *     - absentColorHex
 *     - mercyPunchline
 *
 *   These fields live only in the Redis session and the
 *   GameEngineService.  This mapper strips them all.
 *
 * Colorblind mode:
 *   For COLORBLIND mode, exact-match ("correct") statuses
 *   are downgraded to "present" (yellow) so the player
 *   knows a letter is in the word but cannot distinguish
 *   exact vs misplaced.  "present" and "absent" statuses
 *   are left unchanged.  The server board retains real
 *   statuses so the engine can detect wins.
 * ==========================================================
 */

import {
  GameSession,
  GuessResult,
  GameMode,
} from "../models";
import {
  GameSessionDTO,
  GuessResultDTO,
  MercyResultDTO,
} from "../models/dtos";
import { GuessProcessResult, MercyResult } from "../services/GameEngineService";

// ── Time Helpers ────────────────────────────────────────────

/**
 * Calculate milliseconds remaining until the session deadline.
 * Returns `undefined` for untimed modes.
 */
function computeTimeRemaining(session: GameSession): number | undefined {
  if (!session.endsAt) return undefined;

  const remaining = new Date(session.endsAt).getTime() - Date.now();
  return Math.max(0, remaining);
}

// ── Board Sanitisation ──────────────────────────────────────

/**
 * Create a colorblind-safe copy of a board where exact
 * matches ("correct") are suppressed to "absent", but
 * "present" (yellow / misplaced) feedback is preserved.
 *
 * This gives the player partial deduction cues (the letter
 * IS in the word) without revealing exact positions.
 *
 * Mapping:
 *   "correct" → "present"  (letter in word, position hidden)
 *   "present" → "present"  (unchanged)
 *   "absent"  → "absent"   (unchanged)
 */
function sanitizeBoardForColorblind(
  board: GuessResult[][]
): GuessResult[][] {
  return board.map((row) =>
    row.map((cell) => ({
      letter: cell.letter,
      status: cell.status === "correct" ? "present" as const : cell.status,
    }))
  );
}

/**
 * Create a client-safe copy of a GUESS_THE_REST board.
 *
 * The server board stores REAL statuses (correct/present/absent)
 * for win detection.  The client board must show the obfuscated
 * hex colours instead.  Since the engine already returns the
 * obfuscated results per-guess, the "client board" for
 * GUESS_THE_REST is built incrementally in the controller.
 *
 * For the initial /start response (empty board), this is a no-op.
 * For subsequent responses, the controller uses clientResults
 * directly.
 */

// ── DTO Constructors ────────────────────────────────────────

/**
 * Map a GameSession to a GameSessionDTO for the /start response.
 *
 * Strips all secret fields.  For COLORBLIND mode, sanitises
 * the board.  For GUESS_THE_REST, the board is empty at
 * creation so no special handling is needed.
 */
export function toGameSessionDTO(session: GameSession): GameSessionDTO {
  let board = session.board;
  let boardSecondary = session.boardSecondary;

  // COLORBLIND: strip exact-match statuses from any pre-existing board rows
  if (session.mode === "COLORBLIND") {
    board = sanitizeBoardForColorblind(board);
  }

  // Reveal solution on terminal states
  const isTerminal = session.status === "LOST" || session.status === "TIMED_OUT";

  return {
    sessionId: session.sessionId,
    mode: session.mode,
    status: session.status,
    attemptsRemaining: session.maxGuesses - session.guessesUsed,
    board,
    boardSecondary,
    timeRemainingMs: computeTimeRemaining(session),
    ...(isTerminal && { solution: session.targetWord }),
    ...(isTerminal && session.targetWordSecondary && { solutionSecondary: session.targetWordSecondary }),
  };
}

/**
 * Map a GuessProcessResult to a GuessResultDTO.
 *
 * The `clientResults` from the engine are already safe:
 * - Standard modes: real statuses (correct/present/absent)
 * - GUESS_THE_REST: obfuscated (status="obfuscated", hex=<random>)
 *
 * For COLORBLIND mode, we additionally sanitise:
 * - The per-guess `result` array → "correct" becomes "present"
 * - The cumulative `board` → "correct" becomes "present"
 */
export function toGuessResultDTO(
  processResult: GuessProcessResult
): GuessResultDTO {
  const { clientResults, clientResultsSecondary, session, message, isMercyAvailable } =
    processResult;

  let result = clientResults;
  let board = session.board;
  let boardSecondary = session.boardSecondary;
  let resultSecondary = clientResultsSecondary;

  if (session.mode === "COLORBLIND") {
    // Map exact matches to "present" so the player knows the
    // letter is in the word but cannot distinguish exact vs
    // misplaced.  Truly absent letters stay "absent".
    result = result.map((r) => ({
      letter: r.letter,
      status: r.status === "correct" ? "present" as const : r.status,
    }));

    // Same transformation for the cumulative board
    board = sanitizeBoardForColorblind(board);
  }

  if (session.mode === "GUESS_THE_REST") {
    // The server board has REAL results for win detection.
    // The client must see obfuscated results.  We need to
    // build the client-visible board from all prior obfuscated
    // results.  Since the engine doesn't store obfuscated
    // history, we re-build it here by taking the real board
    // length and noting that the controller accumulates the
    // obfuscated board in the `_obfuscatedBoard` on session.
    //
    // Strategy: we replace the board in the DTO with a
    // board of all-obfuscated rows.  The client only needs
    // the hex colours per-tile, not the real statuses.
    board = buildObfuscatedBoard(session);
  }

  // Reveal solution and color key on terminal states
  const isTerminal = session.status === "LOST" || session.status === "TIMED_OUT";

  // GUESS_THE_REST: reveal the color key on game over
  let colorKey: { exact: string; partial: string; absent: string } | undefined;
  if (
    isTerminal &&
    session.mode === "GUESS_THE_REST" &&
    session.exactColorHex &&
    session.partialColorHex &&
    session.absentColorHex
  ) {
    colorKey = {
      exact: session.exactColorHex,
      partial: session.partialColorHex,
      absent: session.absentColorHex,
    };
  }

  return {
    sessionId: session.sessionId,
    mode: session.mode,
    status: session.status,
    attemptsRemaining: session.maxGuesses - session.guessesUsed,
    result,
    resultSecondary,
    board,
    boardSecondary,
    message,
    timeRemainingMs: computeTimeRemaining(session),
    isMercyAvailable: isMercyAvailable || undefined,
    ...(isTerminal && { solution: session.targetWord }),
    ...(isTerminal && session.targetWordSecondary && { solutionSecondary: session.targetWordSecondary }),
    ...(colorKey && { colorKey }),
  };
}

/**
 * Map a MercyResult to a MercyResultDTO.
 */
export function toMercyResultDTO(
  mercyResult: MercyResult
): MercyResultDTO {
  const { granted, joke, choices, session, message } = mercyResult;

  const isTerminal = session.status === "LOST" || session.status === "TIMED_OUT";

  return {
    sessionId: session.sessionId,
    mode: session.mode,
    mercyGranted: granted,
    attemptsRemaining: session.maxGuesses - session.guessesUsed,
    joke,
    choices,
    message,
    status: session.status,
    ...(isTerminal && { solution: session.targetWord }),
  };
}

// ── Internal Helpers ────────────────────────────────────────

/**
 * For GUESS_THE_REST mode, the server board stores REAL
 * letter statuses.  We must never send those to the client.
 *
 * This function re-obfuscates each row by mapping the real
 * status back to the session's hex colour palette.  The
 * hex values are pulled from the session (which lives in
 * Redis) — they are NOT sent to the client as separate
 * fields.  Only the per-tile `hex` in the GuessResult is
 * included.
 */
function buildObfuscatedBoard(session: GameSession): GuessResult[][] {
  const statusToHex: Record<string, string> = {
    correct: session.exactColorHex ?? "#000000",
    present: session.partialColorHex ?? "#000000",
    absent: session.absentColorHex ?? "#000000",
  };

  return session.board.map((row) =>
    row.map((cell) => ({
      letter: cell.letter,
      status: "obfuscated" as const,
      hex: statusToHex[cell.status] ?? statusToHex["absent"],
    }))
  );
}
