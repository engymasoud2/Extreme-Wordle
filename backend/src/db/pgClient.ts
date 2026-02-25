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
export const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pg.user,
  password: config.pg.password,
  database: config.pg.database,
  max: 20,               // maximum connections in the pool
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

/**
 * Graceful shutdown helper — drain the pool when the process exits.
 */
export async function closePgPool(): Promise<void> {
  await pool.end();
  console.log("[PostgreSQL] Connection pool closed.");
}
