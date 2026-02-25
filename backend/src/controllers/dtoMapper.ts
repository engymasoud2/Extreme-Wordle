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
 *   For COLORBLIND mode, all letter statuses in the board
 *   are replaced with "absent" before being sent to the
 *   client.  The server board retains real statuses so the
 *   engine can detect wins.
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
 * Create a colorblind-safe copy of a board where every
 * letter status is replaced with "absent".
 *
 * The client receives no colour hints at all — the tiles
 * look identical regardless of correctness.
 */
function sanitizeBoardForColorblind(
  board: GuessResult[][]
): GuessResult[][] {
  return board.map((row) =>
    row.map((cell) => ({
      letter: cell.letter,
      status: "absent" as const,
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

  // COLORBLIND: strip statuses from any pre-existing board rows
  if (session.mode === "COLORBLIND") {
    board = sanitizeBoardForColorblind(board);
  }

  return {
    sessionId: session.sessionId,
    mode: session.mode,
    status: session.status,
    attemptsRemaining: session.maxGuesses - session.guessesUsed,
    board,
    boardSecondary,
    timeRemainingMs: computeTimeRemaining(session),
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
 * - The per-guess `result` array → all "absent"
 * - The cumulative `board` → all "absent"
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
    // Strip colours from the latest guess result
    result = result.map((r) => ({
      letter: r.letter,
      status: "absent" as const,
    }));

    // Strip colours from the cumulative board
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
  };
}

/**
 * Map a MercyResult to a MercyResultDTO.
 */
export function toMercyResultDTO(
  mercyResult: MercyResult
): MercyResultDTO {
  const { granted, joke, choices, session, message } = mercyResult;

  return {
    sessionId: session.sessionId,
    mode: session.mode,
    mercyGranted: granted,
    attemptsRemaining: session.maxGuesses - session.guessesUsed,
    joke,
    choices,
    message,
    status: session.status,
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
