/**
 * ==========================================================
 *  Core Game Interfaces
 * ==========================================================
 *
 * Strict TypeScript definitions for every data structure that
 * flows through the game engine.  These mirror the "Public
 * Interfaces" section of the dev-spec and add server-only
 * fields that must never leak to the client.
 * ==========================================================
 */

// ── Game Mode Enum ──────────────────────────────────────────

/** All six supported game modes */
export type GameMode =
  | "SPEED"
  | "TWIN"
  | "COLORBLIND"
  | "FLASH"
  | "MERCY"
  | "GUESS_THE_REST";

// ── Game Status ─────────────────────────────────────────────

/** Lifecycle states for a game session */
export type GameStatus = "ACTIVE" | "WON" | "LOST" | "TIMED_OUT";

// ── Letter Evaluation ───────────────────────────────────────

/** Possible statuses for an individual letter after evaluation */
export type LetterStatus = "correct" | "present" | "absent" | "obfuscated";

// ── Guess Result ────────────────────────────────────────────

/**
 * Per-letter evaluation returned for every guess.
 * `hex` is only populated in GUESS_THE_REST mode where
 * colours are obfuscated to increase difficulty.
 */
export interface GuessResult {
  letter: string;
  status: LetterStatus;
  hex?: string;
}

// ── Game Session (Server-Side – lives in Redis) ─────────────

/**
 * Complete server-side session state.
 *
 * ⚠️  This object contains the answer (`targetWord`) and the
 *     colour key (`exactColorHex`, etc.).  It must NEVER be
 *     sent directly to the client.
 */
export interface GameSession {
  /** Unique session identifier */
  sessionId: string;

  /** Owning user id */
  userId: string;

  /** Selected game mode */
  mode: GameMode;

  /** The secret target word (UPPER-CASE) */
  targetWord: string;

  /**
   * For TWIN mode the player must solve two words.
   * `targetWordSecondary` holds the second word.
   */
  targetWordSecondary?: string;

  /** Maximum number of guesses allowed (typically 6) */
  maxGuesses: number;

  /** Number of guesses the player has used so far */
  guessesUsed: number;

  /** Full board history: each entry is one guess evaluation */
  board: GuessResult[][];

  /**
   * Secondary board for TWIN mode.
   * Each guess is evaluated against both target words.
   */
  boardSecondary?: GuessResult[][];

  /** Current session status */
  status: GameStatus;

  // ── GUESS_THE_REST colour obfuscation ───────────────────

  /** Hex colour the client should render for "correct" letters */
  exactColorHex?: string;

  /** Hex colour the client should render for "present" letters */
  partialColorHex?: string;

  /** Hex colour the client should render for "absent" letters */
  absentColorHex?: string;

  // ── Timer fields (SPEED / FLASH) ─────────────────────────

  /** ISO-8601 timestamp when the game started */
  startedAt: string;

  /** ISO-8601 timestamp when the game expires (SPEED / FLASH) */
  endsAt?: string;

  /** Total time budget in milliseconds (SPEED default: 300 000) */
  timeBudgetMs?: number;

  // ── MERCY mode ────────────────────────────────────────────

  /** Whether the mercy (dad-joke) prompt has been triggered */
  mercyTriggered?: boolean;

  /** The joke question sent to the player */
  mercyJoke?: string;

  /** The expected exact punchline (for validation) */
  mercyPunchline?: string;

  /** Shuffled multiple-choice options sent to the player */
  mercyChoices?: string[];
}

// ── Mode-Specific Rule Configuration ────────────────────────

/**
 * Each mode strategy exposes its rules so the engine can
 * configure the session at creation time.
 */
export interface ModeRules {
  /** Default max guesses for this mode */
  maxGuesses: number;

  /** Total time budget in ms (undefined = untimed) */
  timeBudgetMs?: number;

  /** Word length required for this mode */
  wordLength: number;

  /** Whether a second target word is needed (Twin) */
  requiresSecondWord: boolean;

  /** Whether colour feedback is hidden (Colorblind) */
  hideColors: boolean;

  /** Whether colours are obfuscated with random hex (Guess the Rest) */
  obfuscateColors: boolean;
}
