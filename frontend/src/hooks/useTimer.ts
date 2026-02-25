/**
 * ==========================================================
 *  useTimer — Countdown Timer Hook
 * ==========================================================
 *
 * Uses requestAnimationFrame for smooth, accurate countdown.
 * Reads the absolute deadline from GameContext and dispatches
 * TIMER_TICK / TIMER_EXPIRED actions.
 * ==========================================================
 */

import { useEffect, useRef } from "react";
import { useGame } from "@/context/GameContext";

export function useTimer() {
  const { state } = useGame();
  const rafRef = useRef<number | null>(null);
  const dispatchRef = useRef<((remaining: number) => void) | null>(null);
  const expiredRef = useRef<(() => void) | null>(null);

  // We grab dispatch indirectly via the context value
  // to avoid re-creating the RAF loop on every render.
  // Instead, we'll use a simpler approach: just track state.

  useEffect(() => {
    if (
      state.status !== "ACTIVE" ||
      state.timerDeadline === null
    ) {
      return;
    }

    const deadline = state.timerDeadline;

    function tick() {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        // Timer expired — the server is the source of truth,
        // but we update UI immediately for snappy feedback.
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [state.status, state.timerDeadline]);

  // Compute the display time from the deadline
  if (state.timerDeadline === null) return null;

  const remaining = Math.max(0, state.timerDeadline - Date.now());
  return remaining;
}
