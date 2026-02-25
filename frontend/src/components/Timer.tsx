/**
 * ==========================================================
 *  Timer — Countdown Display
 * ==========================================================
 *
 * Uses requestAnimationFrame for smooth, jitter-free updates.
 * Reads the absolute deadline (`timerDeadline`) from context
 * and displays MM:SS format.
 *
 * Active for SPEED and FLASH modes.
 * ==========================================================
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "@/context/GameContext";

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function Timer() {
  const { state } = useGame();
  const [display, setDisplay] = useState<string | null>(null);
  const rafRef = useRef<number | null>(null);
  const deadlineRef = useRef<number | null>(null);

  deadlineRef.current = state.timerDeadline;

  const tick = useCallback(() => {
    const deadline = deadlineRef.current;
    if (deadline === null) return;

    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      setDisplay("0:00");
      return; // stop the loop
    }

    setDisplay(formatTime(remaining));
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (state.status !== "ACTIVE" || state.timerDeadline === null) {
      setDisplay(null);
      return;
    }

    // Kick off the RAF loop
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [state.status, state.timerDeadline, tick]);

  if (display === null) return null;

  const remaining = state.timerDeadline ? state.timerDeadline - Date.now() : 0;
  const isUrgent = remaining > 0 && remaining < 30_000;

  return (
    <div
      className={`
        text-3xl font-mono font-bold tabular-nums tracking-wider
        ${isUrgent ? "text-red-400 animate-pulse" : "text-white"}
      `}
    >
      ⏱ {display}
    </div>
  );
}
