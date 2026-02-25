/**
 * ==========================================================
 *  API Client Service
 * ==========================================================
 *
 * All HTTP calls to the backend live here.  The Vite dev
 * server proxies /api requests to localhost:3001 so we can
 * use relative URLs.
 * ==========================================================
 */

import type {
  GameMode,
  GameSessionDTO,
  GuessResultDTO,
  MercyResultDTO,
} from "@/types/game";

const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : "/api/v1";

// ── Token Management ────────────────────────────────────────

let token: string | null = null;

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch a dev-mode JWT so we can talk to the protected
 * endpoints without a full registration/login UI.
 */
export async function ensureToken(): Promise<void> {
  if (token) return;

  const res = await fetch(`${BASE}/auth/dev-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    throw new Error(`Failed to obtain dev token: ${res.status}`);
  }
  const body = (await res.json()) as { token: string };
  token = body.token;
}

// ── Game Endpoints ──────────────────────────────────────────

/** Start a new game session for the given mode */
export async function startGame(mode: GameMode): Promise<GameSessionDTO> {
  await ensureToken();

  const res = await fetch(`${BASE}/games/start`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ mode }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Start game failed: ${res.status}`
    );
  }

  return res.json() as Promise<GameSessionDTO>;
}

/** Submit a guess for an active session */
export async function submitGuess(
  sessionId: string,
  guess: string
): Promise<GuessResultDTO> {
  await ensureToken();

  const res = await fetch(`${BASE}/games/${sessionId}/guess`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ guess: guess.toUpperCase() }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Guess failed: ${res.status}`
    );
  }

  return res.json() as Promise<GuessResultDTO>;
}

/** Request mercy (dad-joke flow) */
export async function requestMercy(
  sessionId: string,
  jokeAnswer?: string
): Promise<MercyResultDTO> {
  await ensureToken();

  const body: Record<string, string> = {};
  if (jokeAnswer !== undefined) {
    body.jokeAnswer = jokeAnswer;
  }

  const res = await fetch(`${BASE}/games/${sessionId}/mercy`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || `Mercy request failed: ${res.status}`
    );
  }

  return res.json() as Promise<MercyResultDTO>;
}
