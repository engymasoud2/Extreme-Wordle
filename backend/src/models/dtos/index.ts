/**
 * ==========================================================
 *  Data Transfer Objects (DTOs)
 * ==========================================================
 *
 * These are the shapes that cross the HTTP boundary.
 * They intentionally exclude server-only secrets like the
 * target word and the colour-mapping key.
 * ==========================================================
 */

import { GameMode, GameStatus, GuessResult } from "../interfaces/gameInterfaces";

// ── Requests ────────────────────────────────────────────────

/** Body for POST /api/v1/games/start */
export interface StartGameRequestDTO {
  mode: GameMode;
}

/** Body for POST /api/v1/games/:sessionId/guess */
export interface SubmitGuessRequestDTO {
  guess: string;
}

/** Body for POST /api/v1/games/:sessionId/mercy */
export interface MercyRequestDTO {
  jokeAnswer: string;
}

// ── Responses ───────────────────────────────────────────────

/**
 * Returned when a new game session is created.
 * Contains everything the client needs to render the
 * initial (empty) board.
 */
export interface GameSessionDTO {
  sessionId: string;
  mode: GameMode;
  status: GameStatus;
  attemptsRemaining: number;
  board: GuessResult[][];
  boardSecondary?: GuessResult[][];
  timeRemainingMs?: number;
}

/**
 * Returned after every guess submission.
 * Includes the latest per-letter evaluation and updated
 * board / status.
 */
export interface GuessResultDTO {
  sessionId: string;
  mode: GameMode;
  status: GameStatus;
  attemptsRemaining: number;
  result: GuessResult[];
  resultSecondary?: GuessResult[];
  board: GuessResult[][];
  boardSecondary?: GuessResult[][];
  message: string;
  timeRemainingMs?: number;
  isMercyAvailable?: boolean;
}

/**
 * Returned for the mercy (dad-joke) flow.
 * If the player hasn't submitted an answer yet, `joke` is
 * populated so the UI can display the prompt.
 */
export interface MercyResultDTO {
  sessionId: string;
  mode: GameMode;
  mercyGranted: boolean;
  attemptsRemaining: number;
  joke?: string;
  choices?: string[];
  message: string;
  status: GameStatus;
}
