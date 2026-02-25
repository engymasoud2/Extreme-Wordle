/**
 * ==========================================================
 *  Auth Routes
 * ==========================================================
 *
 * Provides endpoints for user registration and login.
 *
 * In production, passwords would be hashed with bcrypt or
 * argon2.  For development convenience, this implementation
 * uses a simple hash comparison and also exposes a
 * /dev-token endpoint for quick testing.
 *
 * Endpoints:
 *   POST /api/v1/auth/register  — Create a new user account
 *   POST /api/v1/auth/login     — Authenticate & get JWT
 *   POST /api/v1/auth/dev-token — (dev only) Generate a test JWT
 * ==========================================================
 */

import { Router, Request, Response } from "express";
import crypto from "crypto";
import { UserRepository } from "../repositories/UserRepository";
import { generateToken } from "../middleware/authMiddleware";
import { config } from "../config";

/**
 * Simple password hashing for development.
 * In production, replace with bcrypt/argon2.
 */
function hashPassword(password: string): string {
  return crypto
    .createHash("sha256")
    .update(password + config.jwt.secret)
    .digest("hex");
}

export function createAuthRouter(): Router {
  const userRepo = new UserRepository();
  const router = Router();

  /**
   * POST /register
   * Body: { username: string, password: string }
   * Returns: { token: string, userId: string }
   */
  router.post("/register", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body as {
        username?: string;
        password?: string;
      };

      if (!username || !password) {
        res.status(400).json({
          error: "Missing required fields: username, password",
        });
        return;
      }

      if (username.length < 3 || username.length > 32) {
        res.status(400).json({
          error: "Username must be between 3 and 32 characters.",
        });
        return;
      }

      if (password.length < 6) {
        res.status(400).json({
          error: "Password must be at least 6 characters.",
        });
        return;
      }

      // Check for existing user
      const existing = await userRepo.getByUsername(username);
      if (existing) {
        res.status(409).json({ error: "Username already taken." });
        return;
      }

      const passwordHash = hashPassword(password);
      const user = await userRepo.createUser(username, passwordHash);
      const token = generateToken(user.id, user.username);

      res.status(201).json({
        token,
        userId: user.id,
        username: user.username,
      });
    } catch (err) {
      console.error("[Auth] Registration error:", err);
      res.status(500).json({ error: "Registration failed." });
    }
  });

  /**
   * POST /login
   * Body: { username: string, password: string }
   * Returns: { token: string, userId: string }
   */
  router.post("/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body as {
        username?: string;
        password?: string;
      };

      if (!username || !password) {
        res.status(400).json({
          error: "Missing required fields: username, password",
        });
        return;
      }

      const user = await userRepo.getByUsername(username);
      if (!user) {
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }

      const passwordHash = hashPassword(password);
      if (user.password_hash !== passwordHash) {
        res.status(401).json({ error: "Invalid credentials." });
        return;
      }

      const token = generateToken(user.id, user.username);

      res.status(200).json({
        token,
        userId: user.id,
        username: user.username,
      });
    } catch (err) {
      console.error("[Auth] Login error:", err);
      res.status(500).json({ error: "Login failed." });
    }
  });

  /**
   * POST /dev-token
   * Body: { userId?: string, username?: string }
   * Returns: { token: string }
   *
   * Development-only endpoint for generating test JWTs
   * without requiring a real database user.  Disabled in
   * production via NODE_ENV check.
   */
  router.post("/dev-token", (req: Request, res: Response) => {
    if (config.server.nodeEnv === "production") {
      res.status(404).json({ error: "Not found." });
      return;
    }

    const { userId, username } = req.body as {
      userId?: string;
      username?: string;
    };

    const token = generateToken(
      userId || "dev-user-001",
      username || "dev-player"
    );

    res.status(200).json({
      token,
      userId: userId || "dev-user-001",
      username: username || "dev-player",
      note: "Development token — do not use in production.",
    });
  });

  return router;
}
