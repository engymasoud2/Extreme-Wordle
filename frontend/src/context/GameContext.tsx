/**
 * ==========================================================
 *  Game Context — Centralised State Management
 * ==========================================================
 *
 * Provides the React context and a custom hook (`useGame`)
 * that every component consumes.  All API calls, board state,
 * keyboard tracking, current input, and UI flags live here.
 * ==========================================================
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import type {
  GameMode,
  GameStatus,
  GuessResult,
  GuessResultDTO,
  KeyboardMap,
  LetterStatus,
  MercyResultDTO,
} from "@/types/game";

import * as api from "@/services/api";

// ── State Shape ─────────────────────────────────────────────

export interface GameState {
  /** null = on HomeScreen */
  sessionId: string | null;
  mode: GameMode | null;
  status: GameStatus | null;
  attemptsRemaining: number;
  maxGuesses: number;
  board: GuessResult[][];
  boardSecondary: GuessResult[][];
  keyboardMap: KeyboardMap;
  currentInput: string;
  timeRemainingMs: number | null;
  timerDeadline: number | null;
  isMercyAvailable: boolean;
  mercyJoke: string | null;
  mercyChoices: string[];
  mercyMessage: string | null;
  message: string | null;
  loading: boolean;
  error: string | null;
  wordLength: number;
}

const initialState: GameState = {
  sessionId: null,
  mode: null,
  status: null,
  attemptsRemaining: 0,
  maxGuesses: 6,
  board: [],
  boardSecondary: [],
  keyboardMap: {},
  currentInput: "",
  timeRemainingMs: null,
  timerDeadline: null,
  isMercyAvailable: false,
  mercyJoke: null,
  mercyChoices: [],
  mercyMessage: null,
  message: null,
  loading: false,
  error: null,
  wordLength: 5,
};

// ── Actions ─────────────────────────────────────────────────

type Action =
  | { type: "SET_LOADING" }
  | { type: "SET_ERROR"; error: string }
  | { type: "CLEAR_ERROR" }
  | {
      type: "GAME_STARTED";
      sessionId: string;
      mode: GameMode;
      status: GameStatus;
      attemptsRemaining: number;
      maxGuesses: number;
      board: GuessResult[][];
      boardSecondary: GuessResult[][];
      timeRemainingMs: number | null;
      wordLength: number;
    }
  | {
      type: "GUESS_RESULT";
      dto: GuessResultDTO;
    }
  | {
      type: "MERCY_RESULT";
      dto: MercyResultDTO;
    }
  | { type: "SET_INPUT"; value: string }
  | { type: "TIMER_TICK"; remaining: number }
  | { type: "TIMER_EXPIRED" }
  | { type: "RESET" };

// ── Keyboard Updater ────────────────────────────────────────

/**
 * Merge new guess results into the cumulative keyboard map.
 * Priority: correct > present > absent.  "obfuscated" is
 * ignored for keyboard tracking — the player gets no colour
 * info in GUESS_THE_REST mode.
 */
function mergeKeyboard(
  prev: KeyboardMap,
  results: GuessResult[]
): KeyboardMap {
  const priority: Record<LetterStatus, number> = {
    correct: 3,
    present: 2,
    absent: 1,
    obfuscated: 0,
  };

  const next = { ...prev };
  for (const r of results) {
    const key = r.letter.toUpperCase();
    const existing = next[key];
    const existingPriority = existing ? (priority[existing] ?? 0) : -1;
    const newPriority = priority[r.status] ?? 0;
    if (newPriority > existingPriority) {
      next[key] = r.status;
    }
  }
  return next;
}

// ── Reducer ─────────────────────────────────────────────────

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: true, error: null };

    case "SET_ERROR":
      return { ...state, loading: false, error: action.error };

    case "CLEAR_ERROR":
      return { ...state, error: null };

    case "GAME_STARTED": {
      const deadline =
        action.timeRemainingMs !== null
          ? Date.now() + action.timeRemainingMs
          : null;
      return {
        ...initialState,
        sessionId: action.sessionId,
        mode: action.mode,
        status: action.status,
        attemptsRemaining: action.attemptsRemaining,
        maxGuesses: action.maxGuesses,
        board: action.board,
        boardSecondary: action.boardSecondary,
        timeRemainingMs: action.timeRemainingMs,
        timerDeadline: deadline,
        wordLength: action.wordLength,
      };
    }

    case "GUESS_RESULT": {
      const { dto } = action;
      // Don't update keyboard for COLORBLIND (statuses are all "absent")
      // or GUESS_THE_REST (statuses are all "obfuscated")
      const skipKeyboard =
        state.mode === "COLORBLIND" || state.mode === "GUESS_THE_REST";
      const newKeyboard = skipKeyboard
        ? state.keyboardMap
        : mergeKeyboard(state.keyboardMap, dto.result);

      const deadline =
        dto.timeRemainingMs != null
          ? Date.now() + dto.timeRemainingMs
          : state.timerDeadline;

      return {
        ...state,
        loading: false,
        status: dto.status,
        attemptsRemaining: dto.attemptsRemaining,
        board: dto.board,
        boardSecondary: dto.boardSecondary ?? state.boardSecondary,
        keyboardMap: newKeyboard,
        currentInput: "",
        message: dto.message || null,
        timeRemainingMs: dto.timeRemainingMs ?? state.timeRemainingMs,
        timerDeadline: deadline,
        isMercyAvailable: dto.isMercyAvailable ?? false,
      };
    }

    case "MERCY_RESULT": {
      const { dto } = action;
      // When mercy is granted, maxGuesses increases by 1
      const newMaxGuesses = dto.mercyGranted
        ? state.maxGuesses + 1
        : state.maxGuesses;
      return {
        ...state,
        loading: false,
        mercyJoke: dto.joke ?? state.mercyJoke,
        mercyChoices: dto.choices ?? state.mercyChoices,
        mercyMessage: dto.message,
        attemptsRemaining: dto.attemptsRemaining,
        maxGuesses: newMaxGuesses,
        status: dto.status,
        isMercyAvailable: !dto.mercyGranted && dto.status === "ACTIVE",
      };
    }

    case "SET_INPUT":
      return { ...state, currentInput: action.value };

    case "TIMER_TICK":
      return { ...state, timeRemainingMs: action.remaining };

    case "TIMER_EXPIRED":
      return { ...state, status: "TIMED_OUT", timeRemainingMs: 0 };

    case "RESET":
      return { ...initialState };

    default:
      return state;
  }
}

// ── Context ─────────────────────────────────────────────────

interface GameContextValue {
  state: GameState;
  startGame: (mode: GameMode) => Promise<void>;
  submitGuess: () => Promise<void>;
  typeLetter: (letter: string) => void;
  deleteLetter: () => void;
  requestMercy: (jokeAnswer?: string) => Promise<void>;
  resetGame: () => void;
}

const GameContext = createContext<GameContextValue | null>(null);

// ── Provider ────────────────────────────────────────────────

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Start Game ──────────────────────────────────────────

  const startGame = useCallback(async (mode: GameMode) => {
    dispatch({ type: "SET_LOADING" });
    try {
      const dto = await api.startGame(mode);

      // Determine word length from mode
      const wordLength = mode === "GUESS_THE_REST" ? 6 : 5;
      const maxGuesses =
        mode === "TWIN"
          ? 7
          : mode === "COLORBLIND"
            ? 8
            : 6;

      dispatch({
        type: "GAME_STARTED",
        sessionId: dto.sessionId,
        mode: dto.mode,
        status: dto.status,
        attemptsRemaining: dto.attemptsRemaining,
        maxGuesses,
        board: dto.board,
        boardSecondary: dto.boardSecondary ?? [],
        timeRemainingMs: dto.timeRemainingMs ?? null,
        wordLength,
      });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Failed to start game",
      });
    }
  }, []);

  // ── Submit Guess ────────────────────────────────────────

  const submitGuess = useCallback(async () => {
    const s = stateRef.current;
    if (
      !s.sessionId ||
      s.loading ||
      s.currentInput.length !== s.wordLength
    ) {
      return;
    }

    dispatch({ type: "SET_LOADING" });
    try {
      const dto = await api.submitGuess(s.sessionId, s.currentInput);
      dispatch({ type: "GUESS_RESULT", dto });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Guess failed",
      });
    }
  }, []);

  // ── Type / Delete ───────────────────────────────────────

  const typeLetter = useCallback((letter: string) => {
    const s = stateRef.current;
    if (
      s.status !== "ACTIVE" ||
      s.currentInput.length >= s.wordLength
    ) {
      return;
    }
    dispatch({ type: "SET_INPUT", value: s.currentInput + letter.toUpperCase() });
  }, []);

  const deleteLetter = useCallback(() => {
    const s = stateRef.current;
    if (s.currentInput.length === 0) return;
    dispatch({ type: "SET_INPUT", value: s.currentInput.slice(0, -1) });
  }, []);

  // ── Mercy ───────────────────────────────────────────────

  const requestMercyAction = useCallback(async (jokeAnswer?: string) => {
    const s = stateRef.current;
    if (!s.sessionId) return;

    dispatch({ type: "SET_LOADING" });
    try {
      const dto = await api.requestMercy(s.sessionId, jokeAnswer);
      dispatch({ type: "MERCY_RESULT", dto });
    } catch (err) {
      dispatch({
        type: "SET_ERROR",
        error: err instanceof Error ? err.message : "Mercy request failed",
      });
    }
  }, []);

  // ── Reset ───────────────────────────────────────────────

  const resetGame = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // ── Value ───────────────────────────────────────────────

  const value: GameContextValue = {
    state,
    startGame,
    submitGuess,
    typeLetter,
    deleteLetter,
    requestMercy: requestMercyAction,
    resetGame,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// ── Hook ────────────────────────────────────────────────────

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}
