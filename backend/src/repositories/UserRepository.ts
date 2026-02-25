/**
 * ==========================================================
 *  UserRepository
 * ==========================================================
 *
 * Data-access layer for the `users` table.
 * ==========================================================
 */

import { pool } from "../db/pgClient";

export interface UserRow {
  id: string;
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export class UserRepository {
  /**
   * Retrieve a user by their unique ID.
   */
  async getUser(userId: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      `SELECT id, username, password_hash, created_at, updated_at
         FROM users WHERE id = $1`,
      [userId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Retrieve a user by username (for login).
   */
  async getByUsername(username: string): Promise<UserRow | null> {
    const result = await pool.query<UserRow>(
      `SELECT id, username, password_hash, created_at, updated_at
         FROM users WHERE username = $1`,
      [username]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Create a new user account.
   *
   * @param username      Unique display name
   * @param passwordHash  Pre-hashed password (bcrypt / argon2)
   * @returns             The created user row
   */
  async createUser(
    username: string,
    passwordHash: string
  ): Promise<UserRow> {
    const result = await pool.query<UserRow>(
      `INSERT INTO users (username, password_hash)
       VALUES ($1, $2)
       RETURNING id, username, password_hash, created_at, updated_at`,
      [username, passwordHash]
    );
    const row = result.rows[0];
    if (!row) {
      throw new Error("[UserRepository] Insert did not return a row");
    }
    return row;
  }
}
