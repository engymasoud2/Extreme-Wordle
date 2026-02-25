/**
 * ==========================================================
 *  GameScreen — Active Game View
 * ==========================================================
 *
 * Composes all game-mode-aware components:
 *   - Timer (SPEED, FLASH)
 *   - FlashOverlay (FLASH)
 *   - GameBoard (all modes)
 *   - Keyboard (all modes)
 *   - MercyModal (MERCY)
 *   - Status bar (attempts, messages)
 *   - Game-over overlay
 * ==========================================================
 */

import React, { useCallback, useState } from "react";
import { useGame } from "@/context/GameContext";
import { useKeyboard } from "@/hooks/useKeyboard";
import { GameBoard } from "./GameBoard";
import { Keyboard } from "./Keyboard";
import { Timer } from "./Timer";
import { FlashOverlay } from "./FlashOverlay";
import { MercyModal } from "./MercyModal";

export function GameScreen() {
  const { state, resetGame } = useGame();
  const [isWhiteout, setIsWhiteout] = useState(false);

  const handleWhiteoutChange = useCallback((whiteout: boolean) => {
    setIsWhiteout(whiteout);
  }, []);

  // Disable physical keyboard during whiteout or when mercy modal is open
  const keyboardDisabled = isWhiteout || state.isMercyAvailable;
  useKeyboard(keyboardDisabled);

  const isGameOver =
    state.status === "WON" ||
    state.status === "LOST" ||
    state.status === "TIMED_OUT";

  const isFlash = state.mode === "FLASH";
  const isTimed = state.mode === "SPEED" || state.mode === "FLASH";

  return (
    <div className="min-h-screen flex flex-col items-center py-4 px-4 relative">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="w-full max-w-lg flex items-center justify-between mb-4">
        <button
          onClick={resetGame}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Home
        </button>
        <h1 className="text-xl font-bold text-white">
          {modeLabel(state.mode)}
        </h1>
        <div className="w-16" /> {/* Spacer for centering */}
      </div>

      {/* ── Timer ──────────────────────────────────────── */}
      {isTimed && (
        <div className="mb-4">
          <Timer />
        </div>
      )}

      {/* ── Status Bar ─────────────────────────────────── */}
      <div className="flex items-center gap-4 mb-4 text-sm">
        <span className="text-gray-400">
          Guesses: {state.board.length} / {state.maxGuesses}
        </span>
        {state.mode === "GUESS_THE_REST" && (
          <span className="text-amber-400 text-xs">
            Colours are obfuscated — deduce the pattern!
          </span>
        )}
        {state.mode === "COLORBLIND" && (
          <span className="text-gray-500 text-xs">
            No colour feedback — trust your instincts
          </span>
        )}
      </div>

      {/* ── Message ────────────────────────────────────── */}
      {state.message && state.status === "ACTIVE" && (
        <div className="bg-gray-700/60 text-gray-200 px-4 py-2 rounded-lg mb-4 text-sm text-center max-w-md">
          {state.message}
        </div>
      )}

      {/* ── Error ──────────────────────────────────────── */}
      {state.error && (
        <div className="bg-red-900/60 border border-red-500 text-red-200 px-4 py-2 rounded-lg mb-4 text-sm text-center max-w-md animate-shake">
          {state.error}
        </div>
      )}

      {/* ── Game Board ─────────────────────────────────── */}
      <div className="board-perspective mb-4">
        <GameBoard />
      </div>

      {/* ── Keyboard ───────────────────────────────────── */}
      {!isGameOver && (
        <Keyboard disabled={isWhiteout || state.loading} />
      )}

      {/* ── Loading ────────────────────────────────────── */}
      {state.loading && (
        <div className="flex items-center gap-2 mt-3 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          Processing…
        </div>
      )}

      {/* ── Flash Overlay ──────────────────────────────── */}
      {isFlash && (
        <FlashOverlay
          active={state.status === "ACTIVE"}
          onWhiteoutChange={handleWhiteoutChange}
        />
      )}

      {/* ── Mercy Modal ────────────────────────────────── */}
      {state.mode === "MERCY" && <MercyModal />}

      {/* ── Game Over Overlay ──────────────────────────── */}
      {isGameOver && <GameOverOverlay />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function GameOverOverlay() {
  const { state, resetGame } = useGame();

  const isWin = state.status === "WON";
  const isTimeout = state.status === "TIMED_OUT";

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 animate-fade-in">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
        {/* Emoji */}
        <div className="text-6xl mb-4">
          {isWin ? "🎉" : isTimeout ? "⏰" : "💀"}
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-white mb-2">
          {isWin ? "You Win!" : isTimeout ? "Time's Up!" : "Game Over"}
        </h2>

        {/* Stats */}
        <div className="text-gray-400 mb-6 space-y-1 text-sm">
          <p>Mode: {modeLabel(state.mode)}</p>
          <p>Guesses used: {state.board.length}</p>
          {state.message && <p className="text-gray-300">{state.message}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={resetGame}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
}

/** Map mode to a human-readable label */
function modeLabel(mode: string | null): string {
  switch (mode) {
    case "SPEED":
      return "Speed Run";
    case "TWIN":
      return "Twin";
    case "COLORBLIND":
      return "Colorblind";
    case "FLASH":
      return "Flash / Memory";
    case "MERCY":
      return "Show Mercy";
    case "GUESS_THE_REST":
      return "Guess the Rest";
    default:
      return "Extreme Wordle";
  }
}
