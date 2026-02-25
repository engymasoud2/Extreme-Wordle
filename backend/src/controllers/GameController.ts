/**
 * ==========================================================
 *  GameController
 * ==========================================================
 *
 * HTTP request handler for all game operations.  This class
 * owns the HTTP concern ONLY:
 *
 *  - Parse & validate request bodies (via middleware)
 *  - Extract the authenticated user from `req.user`
 *  - Delegate to GameEngineService for all game logic
 *  - Map engine results to safe DTOs via the DTO mapper
 *  - Return appropriate HTTP status codes
 *
 * It does NOT contain any game logic, Redis calls, or
 * database queries.  Separation of Concerns is strict.
 *
 * Routes handled:
 *  POST /api/v1/games/start            → startGame
 *  POST /api/v1/games/:sessionId/guess  → submitGuess
 *  POST /api/v1/games/:sessionId/mercy  → requestMercy
 * ==========================================================
 */

import { Request, Response, NextFunction } from "express";
import { GameEngineService, GameError } from "../services/GameEngineService";
import { GameMode, StartGameRequestDTO, SubmitGuessRequestDTO, MercyRequestDTO } from "../models";
import {
  toGameSessionDTO,
  toGuessResultDTO,
  toMercyResultDTO,
} from "./dtoMapper";

export class GameController {
  constructor(private readonly gameService: GameEngineService) {}

  // ────────────────────────────────────────────────────────
  //  POST /api/v1/games/start
  // ────────────────────────────────────────────────────────

  /**
   * Start a new game session.
   *
   * Request body: { mode: GameMode }
   * Response: GameSessionDTO (201 Created)
   *
   * The authenticated user ID is extracted from the JWT
   * payload attached by the auth middleware.
   */
  startGame = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { mode } = req.body as StartGameRequestDTO;
      const userId = req.user!.userId;

      // Delegate to the game engine
      const { session } = await this.gameService.initializeGame(
        mode as GameMode,
        userId
      );

      // Map to a client-safe DTO (strips targetWord, hex keys, etc.)
      const dto = toGameSessionDTO(session);

      res.status(201).json(dto);
    } catch (err) {
      next(err);
    }
  };

  // ────────────────────────────────────────────────────────
  //  POST /api/v1/games/:sessionId/guess
  // ────────────────────────────────────────────────────────

  /**
   * Submit a guess for an active game.
   *
   * Request body: { guess: string }
   * Response: GuessResultDTO (200 OK)
   *
   * The per-letter results are already sanitised by the
   * engine + DTO mapper:
   *  - Standard modes  → real statuses
   *  - Colorblind      → all "absent" (no colour cues)
   *  - Guess the Rest  → "obfuscated" + hex
   *
   * The obfuscated colour KEY (which hex = which status) is
   * NEVER included in the response.
   */
  submitGuess = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sessionId = req.params.sessionId as string;
      const { guess } = req.body as SubmitGuessRequestDTO;

      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId." });
        return;
      }

      // Delegate to the game engine
      const processResult = await this.gameService.processGuess(
        sessionId,
        guess
      );

      // Map to a client-safe DTO
      const dto = toGuessResultDTO(processResult);

      res.status(200).json(dto);
    } catch (err) {
      next(err);
    }
  };

  // ────────────────────────────────────────────────────────
  //  POST /api/v1/games/:sessionId/mercy
  // ────────────────────────────────────────────────────────

  /**
   * Request or answer a mercy (dad-joke) prompt.
   *
   * This endpoint serves two purposes depending on the
   * request body:
   *
   * Call 1 — Request the joke:
   *   Body: {} (empty or no jokeAnswer)
   *   Response: MercyResultDTO with the joke question.
   *
   * Call 2 — Submit joke answer:
   *   Body: { jokeAnswer: string }
   *   Response: MercyResultDTO indicating whether mercy
   *   was granted (+1 guess) or denied (game over).
   *
   * The joke punchline (answer) is NEVER returned to the
   * client — only whether the answer was correct.
   */
  requestMercy = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const sessionId = req.params.sessionId as string;
      const { jokeAnswer } = req.body as MercyRequestDTO;

      if (!sessionId) {
        res.status(400).json({ error: "Missing sessionId." });
        return;
      }

      // Delegate to the game engine
      const mercyResult = await this.gameService.triggerMercyState(
        sessionId,
        jokeAnswer || undefined  // Convert empty string to undefined
      );

      // Map to a client-safe DTO
      const dto = toMercyResultDTO(mercyResult);

      res.status(200).json(dto);
    } catch (err) {
      next(err);
    }
  };
}
