/**
 * ==========================================================
 *  Request Validation Middleware
 * ==========================================================
 *
 * Lightweight validation helpers used by the GameController
 * to reject malformed requests before they reach the engine.
 * ==========================================================
 */

import { Request, Response, NextFunction } from "express";
import { GameMode } from "../models";

/** The complete set of valid game mode strings */
const VALID_MODES: ReadonlySet<string> = new Set<GameMode>([
  "SPEED",
  "TWIN",
  "COLORBLIND",
  "FLASH",
  "MERCY",
  "GUESS_THE_REST",
]);

/**
 * Validate the body of POST /start.
 * Ensures `mode` is present and is a recognised GameMode.
 */
export function validateStartRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { mode } = req.body as { mode?: string };

  if (!mode || typeof mode !== "string") {
    res.status(400).json({
      error: "Missing required field: mode",
    });
    return;
  }

  if (!VALID_MODES.has(mode)) {
    res.status(400).json({
      error: `Invalid mode "${mode}". Must be one of: ${[...VALID_MODES].join(", ")}`,
    });
    return;
  }

  next();
}

/**
 * Validate the body of POST /:sessionId/guess.
 * Ensures `guess` is a non-empty alphabetic string.
 */
export function validateGuessRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { guess } = req.body as { guess?: string };

  if (!guess || typeof guess !== "string") {
    res.status(400).json({
      error: "Missing required field: guess",
    });
    return;
  }

  const trimmed = guess.trim();
  if (trimmed.length === 0) {
    res.status(400).json({ error: "Guess cannot be empty." });
    return;
  }

  if (!/^[a-zA-Z]+$/.test(trimmed)) {
    res.status(400).json({
      error: "Guess must contain only alphabetic characters.",
    });
    return;
  }

  next();
}

/**
 * Validate the body of POST /:sessionId/mercy.
 * The `jokeAnswer` field is optional on the first call
 * (to request the joke) but must be a string if provided.
 */
export function validateMercyRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { jokeAnswer } = req.body as { jokeAnswer?: unknown };

  // jokeAnswer is optional on the first call (to fetch the joke)
  if (jokeAnswer !== undefined && typeof jokeAnswer !== "string") {
    res.status(400).json({
      error: "Field jokeAnswer must be a string.",
    });
    return;
  }

  next();
}

/**
 * Validate that :sessionId is a non-empty string param.
 */
export function validateSessionId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { sessionId } = req.params;

  if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
    res.status(400).json({ error: "Missing or invalid sessionId." });
    return;
  }

  next();
}
