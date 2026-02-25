/**
 * ==========================================================
 *  Keyboard — On-Screen Keyboard
 * ==========================================================
 *
 * Standard QWERTY layout. Each key reflects the cumulative
 * letter status from the keyboard map in GameContext.
 *
 * For COLORBLIND mode, all statuses are "absent" so every
 * key shows the same neutral colour — intentional.
 *
 * For GUESS_THE_REST mode, statuses are "obfuscated" which
 * we render as neutral (no info leakage).
 * ==========================================================
 */

import React from "react";
import { useGame } from "@/context/GameContext";
import type { LetterStatus } from "@/types/game";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "DEL"],
];

function keyStatusClass(status: LetterStatus | undefined): string {
  switch (status) {
    case "correct":
      return "bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500";
    case "present":
      return "bg-amber-500 text-white border-amber-400 hover:bg-amber-400";
    case "absent":
      return "bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600";
    case "obfuscated":
    default:
      return "bg-gray-600 text-white border-gray-500 hover:bg-gray-500";
  }
}

interface KeyboardProps {
  disabled?: boolean;
}

export function Keyboard({ disabled = false }: KeyboardProps) {
  const { state, typeLetter, deleteLetter, submitGuess } = useGame();
  const { keyboardMap } = state;

  function handleKey(key: string) {
    if (disabled) return;
    if (key === "ENTER") {
      void submitGuess();
    } else if (key === "DEL") {
      deleteLetter();
    } else {
      typeLetter(key);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5 mt-4 select-none">
      {ROWS.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.map((key) => {
            const isSpecial = key === "ENTER" || key === "DEL";
            const status = isSpecial ? undefined : keyboardMap[key];

            return (
              <button
                key={key}
                onClick={() => handleKey(key)}
                disabled={disabled || state.status !== "ACTIVE"}
                className={`
                  ${isSpecial ? "px-3 sm:px-4" : "w-8 sm:w-10"}
                  h-12 sm:h-14 rounded-md border text-xs sm:text-sm font-semibold
                  transition-colors duration-150
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${keyStatusClass(status)}
                `}
              >
                {key === "DEL" ? "⌫" : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
