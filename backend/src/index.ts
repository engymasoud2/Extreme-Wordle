/**
 * ==========================================================
 *  Application Entry Point
 * ==========================================================
 *
 * Boots Express, connects to PostgreSQL & Redis, registers
 * middleware and routes, and starts listening.
 *
 * Route tree:
 *   /api/v1/auth/...           Auth routes (register, login)
 *   /api/v1/games/...          Game routes (start, guess, mercy)
 *   /health                    Liveness probe
 * ==========================================================
 */

import express from "express";
import cors from "cors";
import { config } from "./config";
import { pool, closePgPool } from "./db/pgClient";
import { getRedisClient, closeRedisClient } from "./db/redisClient";
import { createGameRouter, createAuthRouter } from "./routes";
import { errorHandler } from "./middleware/errorHandler";

async function main(): Promise<void> {
  const app = express();

  // ── Global Middleware ─────────────────────────────────────
  console.log(`[CORS] Allowing origin: ${config.server.corsOrigin}`);
  
  app.use(
    cors({
      origin: config.server.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 204
    })
  );
  app.use(express.json());

  // ── Health Check ──────────────────────────────────────────
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ── Connect to datastores ────────────────────────────────
  try {
    await pool.query("SELECT 1");
    console.log("[PostgreSQL] Connection verified.");
  } catch (err) {
    console.error(
      "[PostgreSQL] Could not connect — ERROR:",
      err
    );
  }

  try {
    await getRedisClient();
    console.log("[Redis] Connection verified.");
  } catch (err) {
    console.warn(
      "[Redis] Could not connect — game sessions will be unavailable:",
      (err as Error).message
    );
  }

  // ── API Info ──────────────────────────────────────────────
  app.get("/api/v1", (_req, res) => {
    res.json({
      message: "Extreme Wordle API v1",
      modes: [
        "SPEED",
        "TWIN",
        "COLORBLIND",
        "FLASH",
        "MERCY",
        "GUESS_THE_REST",
      ],
      endpoints: {
        auth: {
          register: "POST /api/v1/auth/register",
          login: "POST /api/v1/auth/login",
          devToken: "POST /api/v1/auth/dev-token (dev only)",
        },
        games: {
          start: "POST /api/v1/games/start",
          guess: "POST /api/v1/games/:sessionId/guess",
          mercy: "POST /api/v1/games/:sessionId/mercy",
        },
      },
    });
  });

  // ── Mount Route Trees ─────────────────────────────────────
  app.use("/api/v1/auth", createAuthRouter());
  app.use("/api/v1/games", createGameRouter());

  // ── Global Error Handler (must be last middleware) ────────
  app.use(errorHandler);

  // ── Start Server ──────────────────────────────────────────
  const server = app.listen(config.server.port, () => {
    console.log(
      `[Server] Extreme Wordle backend running on port ${config.server.port} (${config.server.nodeEnv})`
    );
  });

  // ── Graceful Shutdown ─────────────────────────────────────
  const shutdown = async () => {
    console.log("\n[Server] Shutting down gracefully...");
    server.close();
    await closeRedisClient();
    await closePgPool();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Fatal] Failed to start application:", err);
  process.exit(1);
});

main().catch((err) => {
  console.error("[Fatal] Failed to start application:", err);
  process.exit(1);
});
