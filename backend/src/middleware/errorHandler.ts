/**
 * ==========================================================
 *  Global Error Handler Middleware
 * ==========================================================
 *
 * Catches all unhandled errors from route handlers and
 * returns a consistent JSON error envelope.  Recognises
 * `GameError` instances and uses their status codes;
 * everything else becomes a 500.
 * ==========================================================
 */

import { Request, Response, NextFunction } from "express";
import { GameError } from "../services/GameEngineService";

/**
 * Express error-handling middleware (4-argument signature).
 * Must be registered AFTER all routes.
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Known application error with an explicit status code
  if (err instanceof GameError) {
    res.status(err.statusCode).json({
      error: err.message,
    });
    return;
  }

  // Unexpected / unhandled errors
  console.error("[ErrorHandler] Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error.",
  });
}
