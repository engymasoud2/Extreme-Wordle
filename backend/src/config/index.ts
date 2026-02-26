import dotenv from "dotenv";

// Only load .env file if DATABASE_URL is not already set (local dev)
// In production (Render), environment variables are injected directly
if (!process.env.DATABASE_URL) {
  dotenv.config();
}

// Debug: Log DATABASE_URL presence (hide actual value for security)
if (process.env.DATABASE_URL) {
  console.log("[Config] DATABASE_URL is present in environment");
} else {
  console.warn("[Config] DATABASE_URL is NOT set - will use fallback host/port");
}

/**
 * Centralized application configuration.
 * All environment variables are validated and exported from here.
 * Never access process.env directly outside this module.
 */
export const config = {
  /** PostgreSQL connection settings */
  pg: {
    /** If DATABASE_URL is set (Render, Heroku, etc.) use it directly */
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PG_HOST || "localhost",
    port: parseInt(process.env.PG_PORT || "5432", 10),
    user: process.env.PG_USER || "wordle_admin",
    password: process.env.PG_PASSWORD || "changeme",
    database: process.env.PG_DATABASE || "extreme_wordle",
    /** Render requires SSL for external connections */
    ssl: process.env.DATABASE_URL
      ? { rejectUnauthorized: false }
      : undefined,
  },

  /** Redis connection URL */
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  /** JWT authentication secret */
  jwt: {
    secret: process.env.JWT_SECRET || "dev-secret-key",
  },

  /** Express server settings */
  server: {
    port: parseInt(process.env.PORT || "3001", 10),
    nodeEnv: process.env.NODE_ENV || "development",
    /** Allowed CORS origin (your GitHub Pages URL) */
    corsOrigin: process.env.CORS_ORIGIN || "*",
  },
} as const;
