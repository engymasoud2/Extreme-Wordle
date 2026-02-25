import dotenv from "dotenv";
dotenv.config();

/**
 * Centralized application configuration.
 * All environment variables are validated and exported from here.
 * Never access process.env directly outside this module.
 */
export const config = {
  /** PostgreSQL connection settings */
  pg: {
    host: process.env.PG_HOST || "localhost",
    port: parseInt(process.env.PG_PORT || "5432", 10),
    user: process.env.PG_USER || "wordle_admin",
    password: process.env.PG_PASSWORD || "changeme",
    database: process.env.PG_DATABASE || "extreme_wordle",
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
  },
} as const;
