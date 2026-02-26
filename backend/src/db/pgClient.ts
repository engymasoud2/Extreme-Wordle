import { Pool } from "pg";
import { config } from "../config";

/**
 * PostgreSQL connection pool.
 *
 * A single Pool instance is shared across the entire application.
 * The pool automatically manages connection lifecycle (checkout,
 * return, idle timeout).  Always use `pool.query()` or checkout
 * a client via `pool.connect()` for transactions.
 */

// Debug: Log which connection mode we're using
if (config.pg.connectionString) {
  console.log("[pgClient] Using connection string (Render/production mode)");
} else {
  console.log("[pgClient] Using host/port (local dev mode)");
  console.log(`[pgClient] Host: ${config.pg.host}:${config.pg.port}`);
}

export const pool = new Pool(
  config.pg.connectionString
    ? {
        connectionString: config.pg.connectionString,
        ssl: config.pg.ssl,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }
    : {
        host: config.pg.host,
        port: config.pg.port,
        user: config.pg.user,
        password: config.pg.password,
        database: config.pg.database,
        max: 20,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      }
);

/**
 * Graceful shutdown helper — drain the pool when the process exits.
 */
export async function closePgPool(): Promise<void> {
  await pool.end();
  console.log("[PostgreSQL] Connection pool closed.");
}
