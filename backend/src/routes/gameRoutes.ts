/**
 * ==========================================================
 *  Game Routes
 * ==========================================================
 *
 * Defines the Express Router for all game-related endpoints.
 * Each route is protected by JWT auth middleware and input
 * validation middleware before reaching the GameController.
 *
 * Endpoints:
 *   POST /api/v1/games/start              — Start a new game
 *   POST /api/v1/games/:sessionId/guess   — Submit a guess
 *   POST /api/v1/games/:sessionId/mercy   — Mercy flow
 *
 * The router is self-contained and exported for mounting in
 * the main Express app.
 * ==========================================================
 */

import { Router } from "express";
import { GameController } from "../controllers/GameController";
import { GameEngineService } from "../services/GameEngineService";
import { SessionCacheService } from "../services/SessionCacheService";
import { JokeService } from "../services/JokeService";
import { DictionaryRepository } from "../repositories/DictionaryRepository";
import { StatsRepository } from "../repositories/StatsRepository";
import {
  authMiddleware,
} from "../middleware/authMiddleware";
import {
  validateStartRequest,
  validateGuessRequest,
  validateMercyRequest,
  validateSessionId,
} from "../middleware/validation";

/**
 * Create and return the fully wired game router.
 *
 * This factory function instantiates the dependency chain:
 *   Repositories → Services → Controller → Routes
 *
 * This is the composition root for the game domain.
 */
export function createGameRouter(): Router {
  // ── Instantiate dependencies ─────────────────────────────
  const dictionaryRepo = new DictionaryRepository();
  const statsRepo = new StatsRepository();
  const sessionCache = new SessionCacheService();
  const jokeService = new JokeService();

  const gameEngine = new GameEngineService(
    dictionaryRepo,
    sessionCache,
    statsRepo,
    jokeService
  );

  const controller = new GameController(gameEngine);

  // ── Define routes ────────────────────────────────────────
  const router = Router();

  /**
   * POST /start
   * Body: { mode: "SPEED" | "TWIN" | ... }
   * Returns: GameSessionDTO (201)
   */
  router.post(
    "/start",
    authMiddleware,
    validateStartRequest,
    controller.startGame
  );

  /**
   * POST /:sessionId/guess
   * Body: { guess: "CRANE" }
   * Returns: GuessResultDTO (200)
   */
  router.post(
    "/:sessionId/guess",
    authMiddleware,
    validateSessionId,
    validateGuessRequest,
    controller.submitGuess
  );

  /**
   * POST /:sessionId/mercy
   * Body: { jokeAnswer?: "punchline text" }
   * Returns: MercyResultDTO (200)
   */
  router.post(
    "/:sessionId/mercy",
    authMiddleware,
    validateSessionId,
    validateMercyRequest,
    controller.requestMercy
  );

  return router;
}
