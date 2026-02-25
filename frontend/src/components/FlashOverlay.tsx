/**
 * ==========================================================
 *  FlashOverlay — Memory Mode Whiteout Cycle
 * ==========================================================
 *
 * Dev-spec requirement:
 *   "MUST use requestAnimationFrame or strict CSS transitions
 *    for the precise 3-seconds visible / 25-seconds whiteout
 *    cycle."
 *
 * Implementation:
 *   - A full-screen white overlay whose `opacity` is driven
 *     by CSS `transition` (0.8s ease-in-out, configured in
 *     tailwind.config.js).
 *   - A `requestAnimationFrame` loop tracks elapsed time
 *     and toggles a boolean (`isWhiteout`).
 *   - During whiteout: overlay opacity=1, keyboard disabled.
 *   - During visible:  overlay opacity=0, keyboard enabled.
 *   - Cycle: 3 000ms visible → 25 000ms whiteout → repeat.
 *   - Contains an accessibility warning text.
 *
 * The parent component (GameScreen) reads `isWhiteout` to
 * disable the keyboard during the whiteout phase.
 * ==========================================================
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "@/context/GameContext";

const VISIBLE_MS = 3_000;
const WHITEOUT_MS = 25_000;
const CYCLE_MS = VISIBLE_MS + WHITEOUT_MS;

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

interface FlashOverlayProps {
  /** Whether the game is still active. Stops cycle when false. */
  active: boolean;
  /** Callback to inform parent of whiteout state */
  onWhiteoutChange: (isWhiteout: boolean) => void;
}

export function FlashOverlay({ active, onWhiteoutChange }: FlashOverlayProps) {
  const { state } = useGame();
  const [isWhiteout, setIsWhiteout] = useState(false);
  const [whiteoutRemaining, setWhiteoutRemaining] = useState(0);
  const startRef = useRef<number>(performance.now());
  const rafRef = useRef<number | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const tick = useCallback(
    (now: number) => {
      if (!activeRef.current) return;

      const elapsed = (now - startRef.current) % CYCLE_MS;
      const shouldWhiteout = elapsed >= VISIBLE_MS;

      // Calculate seconds until board returns
      if (shouldWhiteout) {
        const msIntoWhiteout = elapsed - VISIBLE_MS;
        setWhiteoutRemaining(Math.ceil((WHITEOUT_MS - msIntoWhiteout) / 1000));
      }

      setIsWhiteout((prev) => {
        if (prev !== shouldWhiteout) {
          onWhiteoutChange(shouldWhiteout);
          return shouldWhiteout;
        }
        return prev;
      });

      rafRef.current = requestAnimationFrame(tick);
    },
    [onWhiteoutChange]
  );

  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
      setIsWhiteout(false);
      onWhiteoutChange(false);
      return;
    }

    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [active, tick, onWhiteoutChange]);

  if (!active) return null;

  // Compute game timer display for the overlay
  const gameRemaining = state.timerDeadline ? state.timerDeadline - Date.now() : null;
  const gameTimerDisplay = gameRemaining !== null && gameRemaining > 0
    ? formatTime(gameRemaining)
    : null;
  const isUrgent = gameRemaining !== null && gameRemaining > 0 && gameRemaining < 30_000;

  return (
    <div
      className="whiteout-overlay fixed inset-0 z-40 pointer-events-none flex flex-col items-center justify-center gap-6"
      style={{ opacity: isWhiteout ? 1 : 0, backgroundColor: "white" }}
      aria-hidden={!isWhiteout}
    >
      {isWhiteout && (
        <>
          {/* Game timer — always visible during whiteout */}
          {gameTimerDisplay && (
            <div
              className={`text-4xl font-mono font-bold tabular-nums tracking-wider ${
                isUrgent ? "text-red-500 animate-pulse" : "text-gray-700"
              }`}
            >
              ⏱ {gameTimerDisplay}
            </div>
          )}

          {/* Whiteout countdown */}
          <div className="text-gray-400 text-xl font-medium animate-pulse-slow select-none">
            Board returning in {whiteoutRemaining}s
          </div>
        </>
      )}
    </div>
  );
}
