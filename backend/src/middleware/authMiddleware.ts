/**
 * ==========================================================
 *  JWT Authentication Middleware
 * ==========================================================
 *
 * Validates the `Authorization: Bearer <token>` header on
 * protected routes.  On success, attaches the decoded user
 * payload to `req.user` for downstream handlers.
 *
 * The middleware never leaks the reason for rejection beyond
 * a generic 401 message to prevent information disclosure.
 * ==========================================================
 */

import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

// ── Extend the Express Request type ─────────────────────────

/**
 * Shape of the JWT payload we sign and verify.
 * Kept minimal — only the user ID is required.
 */
export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

/**
 * Augment the Express Request interface so TypeScript knows
 * about `req.user` after auth verification.
 */
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Middleware ───────────────────────────────────────────────

/**
 * Express middleware that:
 *  1. Extracts the Bearer token from the Authorization header.
 *  2. Verifies and decodes it using the configured JWT secret.
 *  3. Attaches the decoded payload to `req.user`.
 *  4. Calls `next()` on success, or returns 401 on failure.
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required." });
    return;
  }

  const token = authHeader.slice(7); // Strip "Bearer "

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;

    // Sanity check: the payload must contain a userId
    if (!decoded.userId) {
      res.status(401).json({ error: "Invalid token payload." });
      return;
    }

    req.user = decoded;
    next();
  } catch (err) {
    // Token expired, malformed, or signature mismatch
    console.warn(
      "[Auth] Token verification failed:",
      (err as Error).message
    );
    res.status(401).json({ error: "Invalid or expired token." });
    return;
  }
}

// ── Token Generation Helper ─────────────────────────────────

/**
 * Generate a signed JWT for a user.
 * Used by the auth controller (future) when a user logs in.
 *
 * @param userId    The user's database ID
 * @param username  The user's display name
 * @returns         Signed JWT string (expires in 24 hours)
 */
export function generateToken(userId: string, username: string): string {
  return jwt.sign(
    { userId, username } as JwtPayload,
    config.jwt.secret,
    { expiresIn: "24h" }
  );
}
