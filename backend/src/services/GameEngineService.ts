/**
 * ==========================================================
 *  GameEngineService — Core Game Orchestrator
 * ==========================================================
 *
 * The single entry point for all game operations.  It uses
 * the Strategy Pattern to delegate mode-specific logic to
 * the appropriate IModeStrategy implementation while owning
 * the cross-cutting concerns:
 *
 *  - Session lifecycle (create → play → end)
 *  - Dictionary validation
 *  - Timer enforcement
 *  - Redis persistence
 *  - Mercy-mode coordination
 *  - Stats recording
 *
 * No game-mode-specific if/else or switch lives here.
 * ==========================================================
 */

import crypto from "crypto";

import {
  GameMode,
  GameSession,
  GameStatus,
  GuessResult,
} from "../models";
import { IModeStrategy } from "../models/interfaces/IModeStrategy";
import { SessionCacheService } from "./SessionCacheService";
import { JokeService } from "./JokeService";
import { DictionaryRepository } from "../repositories/DictionaryRepository";
import { StatsRepository } from "../repositories/StatsRepository";

// Import all strategies
import {
  SpeedStrategy,
  TwinStrategy,
  ColorblindStrategy,
  FlashStrategy,
  MercyStrategy,
  GuessTheRestStrategy,
} from "../strategies";

// ── Result types returned by public methods ───────────────

export interface InitResult {
  session: GameSession;
}

export interface GuessProcessResult {
  /** Obfuscated or sanitised results for the client */
  clientResults: GuessResult[];
  clientResultsSecondary?: GuessResult[];
  /** Updated session (for DTO mapping) */
  session: GameSession;
  /** Human-readable message */
  message: string;
  /** Whether the Mercy prompt should be shown */
  isMercyAvailable: boolean;
}

export interface MercyResult {
  granted: boolean;
  joke: string;
  choices?: string[];
  session: GameSession;
  message: string;
}

// ── Service Implementation ────────────────────────────────

export class GameEngineService {
  /** Strategy lookup keyed by GameMode */
  private strategies: Map<GameMode, IModeStrategy>;

  constructor(
    private readonly dictionaryRepo: DictionaryRepository,
    private readonly sessionCache: SessionCacheService,
    private readonly statsRepo: StatsRepository,
    private readonly jokeService: JokeService
  ) {
    // ── Register all strategies ────────────────────────────
    this.strategies = new Map<GameMode, IModeStrategy>();
    const allStrategies: IModeStrategy[] = [
      new SpeedStrategy(),
      new TwinStrategy(),
      new ColorblindStrategy(),
      new FlashStrategy(),
      new MercyStrategy(),
      new GuessTheRestStrategy(),
    ];
    for (const s of allStrategies) {
      this.strategies.set(s.mode, s);
    }
  }

  // ────────────────────────────────────────────────────────
  //  initializeGame
  // ────────────────────────────────────────────────────────

  /**
   * Create a new game session for the given mode.
   *
   * 1. Resolve the strategy and its rules.
   * 2. Pick a random target word (and a second for Twin).
   * 3. Build the initial GameSession object.
   * 4. Let the strategy initialise any mode-specific fields.
   * 5. Persist to Redis.
   *
   * @param mode    Selected game mode
   * @param userId  Authenticated user's ID
   */
  async initializeGame(
    mode: GameMode,
    userId: string
  ): Promise<InitResult> {
    const strategy = this.getStrategy(mode);
    const rules = strategy.getRules();

    // Select target word(s) from the dictionary
    const targetWord = await this.dictionaryRepo.getRandomWord(
      rules.wordLength
    );

    let targetWordSecondary: string | undefined;
    if (rules.requiresSecondWord) {
      // Ensure the second word is different from the first
      let attempts = 0;
      do {
        targetWordSecondary = await this.dictionaryRepo.getRandomWord(
          rules.wordLength
        );
        attempts++;
      } while (targetWordSecondary === targetWord && attempts < 10);
    }

    // Build session
    const now = new Date();
    const sessionId = crypto.randomUUID();

    const session: GameSession = {
      sessionId,
      userId,
      mode,
      targetWord,
      targetWordSecondary,
      maxGuesses: rules.maxGuesses,
      guessesUsed: 0,
      board: [],
      boardSecondary: rules.requiresSecondWord ? [] : undefined,
      status: "ACTIVE",
      startedAt: now.toISOString(),
    };

    // Set timer if the mode is timed
    if (rules.timeBudgetMs) {
      session.timeBudgetMs = rules.timeBudgetMs;
      session.endsAt = new Date(
        now.getTime() + rules.timeBudgetMs
      ).toISOString();
    }

    // Let the strategy hook in (e.g. GuessTheRest colour gen)
    if (strategy.onSessionCreated) {
      strategy.onSessionCreated(session);
    }

    // Persist to Redis
    await this.sessionCache.set(sessionId, session);

    // ── DEBUG: log the target word(s) for testing ─────────
    console.log(`[DEBUG] New ${mode} game | session=${sessionId} | target="${targetWord}"${targetWordSecondary ? ` | target2="${targetWordSecondary}"` : ""}`);

    return { session };
  }

  // ────────────────────────────────────────────────────────
  //  processGuess
  // ────────────────────────────────────────────────────────

  /**
   * Process a player's guess for an active session.
   *
   * 1. Load session from Redis & validate status.
   * 2. Validate the guess is a real word.
   * 3. Delegate evaluation to the mode strategy.
   * 4. Handle GUESS_THE_REST dual-result (real vs obfuscated).
   * 5. Update session state (board, guessesUsed).
   * 6. Check end conditions.
   * 7. Persist & return.
   *
   * @param sessionId  Active game session ID
   * @param guess      Player's guess (will be upper-cased)
   */
  async processGuess(
    sessionId: string,
    guess: string
  ): Promise<GuessProcessResult> {
    const session = await this.loadActiveSession(sessionId);
    const strategy = this.getStrategy(session.mode);
    const rules = strategy.getRules();

    // Normalize
    const normalizedGuess = guess.toUpperCase().trim();

    // Validate word length
    if (normalizedGuess.length !== rules.wordLength) {
      throw new GameError(
        `Guess must be exactly ${rules.wordLength} letters.`,
        400
      );
    }

    // Validate against dictionary (wrapped in try-catch for resilience)
    let isValid: boolean;
    try {
      isValid = await this.dictionaryRepo.isValidWord(normalizedGuess);
    } catch (err) {
      console.error("[GameEngine] Dictionary validation failed:", (err as Error).message);
      throw new GameError("Dictionary service unavailable. Please try again.", 503);
    }
    if (!isValid) {
      throw new GameError("Not a valid word.", 400);
    }

    // Re-check timer for timed modes — the dictionary lookup
    // may have taken long enough for the deadline to pass.
    if (session.endsAt && Date.now() >= new Date(session.endsAt).getTime()) {
      session.status = "TIMED_OUT";
      await this.sessionCache.set(sessionId, session);
      await this.safeRecordStats(session);
      throw new GameError("Time's up!", 410);
    }

    // ── Evaluate ──────────────────────────────────────────
    const evalResult = strategy.evaluate(session, normalizedGuess);

    // For GUESS_THE_REST: store REAL results on server board,
    // return obfuscated to client.
    let clientResults: GuessResult[];
    const realResultsKey = "_realResults" as keyof typeof evalResult;
    const realResults = evalResult[realResultsKey] as
      | GuessResult[]
      | undefined;

    if (realResults) {
      // Server board gets real results (for win detection)
      session.board.push(realResults);
      // Client gets obfuscated results
      clientResults = evalResult.primary;
    } else {
      // Standard modes — same results for server & client
      session.board.push(evalResult.primary);
      clientResults = evalResult.primary;
    }

    // Twin mode secondary board
    let clientResultsSecondary: GuessResult[] | undefined;
    if (evalResult.secondary && session.boardSecondary) {
      session.boardSecondary.push(evalResult.secondary);
      clientResultsSecondary = evalResult.secondary;
    }

    // Increment guess count
    session.guessesUsed++;

    // ── Check End Condition ───────────────────────────────
    const endStatus = strategy.checkEndCondition(session);
    let message = "Keep going!";
    let isMercyAvailable = false;

    if (endStatus) {
      session.status = endStatus;
      message = this.statusMessage(endStatus);

      // Record stats for terminal states (non-blocking)
      await this.safeRecordStats(session);
    } else if (
      session.mode === "MERCY" &&
      session.guessesUsed >= session.maxGuesses &&
      !session.mercyTriggered
    ) {
      // Mercy mode: guesses exhausted but mercy not used yet
      isMercyAvailable = true;
      message = "Out of guesses! Answer the joke for one more chance.";
    }

    // Persist
    await this.sessionCache.set(sessionId, session);

    return {
      clientResults,
      clientResultsSecondary,
      session,
      message,
      isMercyAvailable,
    };
  }

  // ────────────────────────────────────────────────────────
  //  triggerMercyState
  // ────────────────────────────────────────────────────────

  /**
   * Initiate or resolve the mercy (dad-joke) flow.
   *
   * Call 1 (no `jokeAnswer`):
   *   - Fetch a joke, store it on the session, return it.
   *
   * Call 2 (with `jokeAnswer`):
   *   - Validate the answer.  If correct, grant +1 guess.
   *     If wrong, end the game as a loss.
   */
  async triggerMercyState(
    sessionId: string,
    jokeAnswer?: string
  ): Promise<MercyResult> {
    const session = await this.loadActiveSession(sessionId);

    if (session.mode !== "MERCY") {
      throw new GameError("Mercy is only available in MERCY mode.", 400);
    }

    // ── Phase 1: send joke with multiple-choice answers ──
    if (!session.mercyTriggered) {
      const joke = await this.jokeService.fetchJoke();
      const choices = this.jokeService.generateChoices(joke.punchline);
      session.mercyTriggered = true;
      session.mercyJoke = joke.question;
      session.mercyPunchline = joke.punchline;
      session.mercyChoices = choices;
      await this.sessionCache.set(sessionId, session);

      return {
        granted: false,
        joke: joke.question,
        choices,
        session,
        message: "Pick the correct punchline to earn one more guess!",
      };
    }

    // ── Phase 2: validate answer ──────────────────────────
    if (!jokeAnswer) {
      throw new GameError(
        "You must provide a joke answer.",
        400
      );
    }

    // Guard against missing punchline (corrupt/expired session)
    if (!session.mercyPunchline) {
      session.status = "LOST";
      await this.sessionCache.set(sessionId, session);
      await this.safeRecordStats(session);
      return {
        granted: false,
        joke: session.mercyJoke ?? "(joke unavailable)",
        session,
        message: "Something went wrong with the joke. Game over!",
      };
    }

    const isCorrect = this.jokeService.validateAnswer(
      jokeAnswer,
      session.mercyPunchline
    );

    if (isCorrect) {
      // Grant one extra guess
      session.maxGuesses += 1;
      await this.sessionCache.set(sessionId, session);

      return {
        granted: true,
        joke: session.mercyJoke!,
        session,
        message: "Correct! You earned one more guess.",
      };
    } else {
      // Wrong answer → game over
      session.status = "LOST";
      await this.sessionCache.set(sessionId, session);
      await this.safeRecordStats(session);

      return {
        granted: false,
        joke: session.mercyJoke!,
        session,
        message: "Wrong answer. Game over!",
      };
    }
  }

  // ────────────────────────────────────────────────────────
  //  enforceTimers
  // ────────────────────────────────────────────────────────

  /**
   * Check whether a timed session has expired.
   *
   * This can be called proactively (e.g. on each guess) or
   * from a background job.  If the timer has elapsed, the
   * session status is set to TIMED_OUT and stats are saved.
   */
  async enforceTimers(sessionId: string): Promise<void> {
    const session = await this.sessionCache.get(sessionId);
    if (!session || session.status !== "ACTIVE") return;
    if (!session.endsAt) return;

    if (Date.now() >= new Date(session.endsAt).getTime()) {
      session.status = "TIMED_OUT";
      await this.sessionCache.set(sessionId, session);
      await this.safeRecordStats(session);
    }
  }

  // ────────────────────────────────────────────────────────
  //  Private Helpers
  // ────────────────────────────────────────────────────────

  /**
   * Load a session from Redis and ensure it is still active.
   */
  private async loadActiveSession(
    sessionId: string
  ): Promise<GameSession> {
    const session = await this.sessionCache.get(sessionId);

    if (!session) {
      throw new GameError("Session not found or expired.", 404);
    }

    if (session.status !== "ACTIVE") {
      throw new GameError(
        `Game is already over (${session.status}).`,
        409
      );
    }

    // Proactively check timer
    if (session.endsAt && Date.now() >= new Date(session.endsAt).getTime()) {
      session.status = "TIMED_OUT";
      await this.sessionCache.set(session.sessionId, session);
      await this.recordStats(session);
      throw new GameError("Time's up!", 410);
    }

    return session;
  }

  /**
   * Look up the strategy for a mode.
   */
  private getStrategy(mode: GameMode): IModeStrategy {
    const strategy = this.strategies.get(mode);
    if (!strategy) {
      throw new GameError(`Unknown game mode: ${mode}`, 400);
    }
    return strategy;
  }

  /**
   * Safely record stats — wraps recordStats in a try-catch
   * so a database failure never crashes the game response.
   */
  private async safeRecordStats(session: GameSession): Promise<void> {
    try {
      await this.recordStats(session);
    } catch (err) {
      console.error(
        "[GameEngine] Failed to record stats (non-fatal):",
        (err as Error).message
      );
    }
  }

  /**
   * Persist completed game to match_history.
   */
  private async recordStats(session: GameSession): Promise<void> {
    const outcomeMap: Record<string, "WIN" | "LOSS" | "TIMEOUT"> = {
      WON: "WIN",
      LOST: "LOSS",
      TIMED_OUT: "TIMEOUT",
    };

    const outcome = outcomeMap[session.status];
    if (!outcome) return; // Still active — nothing to record

    let durationMs: number | null = null;
    if (session.startedAt) {
      durationMs = Date.now() - new Date(session.startedAt).getTime();
    }

    await this.statsRepo.save({
      userId: session.userId,
      mode: session.mode,
      outcome,
      targetWord: session.targetWord,
      guessesUsed: session.guessesUsed,
      maxGuesses: session.maxGuesses,
      durationMs,
      mercyTriggered: session.mercyTriggered ?? false,
    });
  }

  /**
   * Human-readable status messages.
   */
  private statusMessage(status: GameStatus): string {
    switch (status) {
      case "WON":
        return "Congratulations! You solved it!";
      case "LOST":
        return "Game over. Better luck next time!";
      case "TIMED_OUT":
        return "Time's up! Game over.";
      default:
        return "Keep going!";
    }
  }
}

// ── Custom Error Class ────────────────────────────────────

/**
 * Application-level error with an HTTP status code.
 * Controllers catch these and map them to the appropriate
 * HTTP response.
 */
export class GameError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "GameError";
  }
}
