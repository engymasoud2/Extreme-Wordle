/**
 * ==========================================================
 *  Extreme Wordle – PostgreSQL Schema Migration Script
 * ==========================================================
 *
 * Run this file against a fresh database to create all
 * required tables, types, indexes, and seed data.
 *
 *   psql -U wordle_admin -d extreme_wordle -f schema.sql
 *
 * Tables:
 *   - users            : registered player accounts
 *   - dictionaries      : valid 5-/6-letter word lists
 *   - match_history     : completed game results & stats
 *
 * The active session state lives in Redis (see SessionCacheService).
 * ==========================================================
 */

-- --------------------------------------------------------
-- Custom ENUM types
-- --------------------------------------------------------

-- All six game modes supported by the application
CREATE TYPE game_mode AS ENUM (
  'SPEED',
  'TWIN',
  'COLORBLIND',
  'FLASH',
  'MERCY',
  'GUESS_THE_REST'
);

-- Possible terminal outcomes for a finished game
CREATE TYPE game_outcome AS ENUM (
  'WIN',
  'LOSS',
  'TIMEOUT'
);

-- --------------------------------------------------------
-- Users table
-- --------------------------------------------------------
-- Stores registered accounts.  No PII beyond a display
-- name and a hashed password (bcrypt / argon2).
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(32)  NOT NULL UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Fast lookup by username on login
CREATE INDEX idx_users_username ON users (username);

-- --------------------------------------------------------
-- Dictionaries table
-- --------------------------------------------------------
-- Holds the word lists used to pick targets and validate
-- guesses.  Words are stored upper-cased and de-duped.
-- word_length allows us to support 5-letter and 6-letter
-- variants (Twin mode may use a different length later).
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS dictionaries (
  id          SERIAL PRIMARY KEY,
  word        VARCHAR(10)  NOT NULL,
  word_length INT          NOT NULL,
  is_target   BOOLEAN      NOT NULL DEFAULT FALSE,
  UNIQUE (word)
);

-- Index for fast random word selection filtered by length & eligibility
CREATE INDEX idx_dict_target ON dictionaries (word_length, is_target);

-- --------------------------------------------------------
-- Match History table
-- --------------------------------------------------------
-- Every completed game (win, loss, or timeout) is recorded
-- here for analytics and per-user statistics.
-- --------------------------------------------------------
CREATE TABLE IF NOT EXISTS match_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode            game_mode    NOT NULL,
  outcome         game_outcome NOT NULL,
  target_word     VARCHAR(10)  NOT NULL,
  guesses_used    INT          NOT NULL,
  max_guesses     INT          NOT NULL,
  duration_ms     INT,                              -- NULL when not timed
  mercy_triggered BOOLEAN      NOT NULL DEFAULT FALSE,
  played_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Index for querying a user's history efficiently
CREATE INDEX idx_match_user   ON match_history (user_id, played_at DESC);
CREATE INDEX idx_match_mode   ON match_history (mode);

-- --------------------------------------------------------
-- Seed: sample dictionary words (small starter set)
-- --------------------------------------------------------
-- In production these would be bulk-loaded from a curated
-- word list file.  This seed gives us something to test with.
-- --------------------------------------------------------
INSERT INTO dictionaries (word, word_length, is_target) VALUES
  ('APPLE',  5, TRUE),
  ('BRAIN',  5, TRUE),
  ('CRANE',  5, TRUE),
  ('DWELT',  5, TRUE),
  ('FLAME',  5, TRUE),
  ('GLOBE',  5, TRUE),
  ('HASTE',  5, TRUE),
  ('JOLLY',  5, TRUE),
  ('KNELT',  5, TRUE),
  ('LEMON',  5, TRUE),
  ('MANGO',  5, TRUE),
  ('NOBLE',  5, TRUE),
  ('OCEAN',  5, TRUE),
  ('PIANO',  5, TRUE),
  ('QUERY',  5, TRUE),
  ('ROAST',  5, TRUE),
  ('STONE',  5, TRUE),
  ('TIGER',  5, TRUE),
  ('ULTRA',  5, TRUE),
  ('VIVID',  5, TRUE),
  ('WHEAT',  5, TRUE),
  ('YACHT',  5, TRUE),
  ('ZEBRA',  5, TRUE),
  ('PLANT',  5, TRUE),
  ('PLANET', 6, TRUE),
  ('ORANGE', 6, TRUE),
  ('JIGSAW', 6, TRUE),
  ('QUARTZ', 6, TRUE),
  ('BRIDGE', 6, TRUE),
  ('FROSTY', 6, TRUE)
ON CONFLICT (word) DO NOTHING;
