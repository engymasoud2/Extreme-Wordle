/**
 * ==========================================================
 *  Frontend Game Types
 * ==========================================================
 *
 * Mirrors the backend DTOs. These types describe the shapes
 * that arrive from the server over the wire. No server-only
 * secrets ever appear here.
 * ==========================================================
 */

// ── Enums / Unions ──────────────────────────────────────────

export type GameMode =
  | "SPEED"
  | "TWIN"
  | "COLORBLIND"
  | "FLASH"
  | "MERCY"
  | "GUESS_THE_REST";

export type GameStatus = "ACTIVE" | "WON" | "LOST" | "TIMED_OUT";

export type LetterStatus = "correct" | "present" | "absent" | "obfuscated";

// ── Per-letter evaluation ───────────────────────────────────

export interface GuessResult {
  letter: string;
  status: LetterStatus;
  /** Only populated in GUESS_THE_REST mode */
  hex?: string;
}

// ── API Response DTOs ───────────────────────────────────────

/** Returned by POST /api/v1/games/start */
export interface GameSessionDTO {
  sessionId: string;
  mode: GameMode;
  status: GameStatus;
  attemptsRemaining: number;
  board: GuessResult[][];
  boardSecondary?: GuessResult[][];
  timeRemainingMs?: number;
}

/** Returned by POST /api/v1/games/:sessionId/guess */
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

/** Returned by POST /api/v1/games/:sessionId/mercy */
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

// ── UI-Level Extended State ─────────────────────────────────

/** Tracks the cumulative keyboard letter statuses */
export type KeyboardMap = Record<string, LetterStatus>;

/** Mode display metadata for the HomeScreen */
export interface ModeInfo {
  mode: GameMode;
  title: string;
  description: string;
  icon: string;
  wordLength: number;
  maxGuesses: number;
  timed: boolean;
}
