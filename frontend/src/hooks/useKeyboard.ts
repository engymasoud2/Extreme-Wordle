/**
 * ==========================================================
 *  useKeyboard — Physical Keyboard Listener
 * ==========================================================
 *
 * Attaches a global `keydown` listener that routes physical
 * key presses to the game context (type, delete, submit).
 *
 * Automatically disabled when:
 *   - The game is not active
 *   - The flash whiteout overlay is visible
 *   - A modal is open (mercy)
 * ==========================================================
 */

import { useEffect } from "react";
import { useGame } from "@/context/GameContext";

export function useKeyboard(disabled: boolean = false) {
  const { state, typeLetter, deleteLetter, submitGuess } = useGame();

  useEffect(() => {
    if (disabled || state.status !== "ACTIVE") return;

    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if the user is typing in an input field (e.g. mercy modal)
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        void submitGuess();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        deleteLetter();
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        typeLetter(e.key);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [disabled, state.status, typeLetter, deleteLetter, submitGuess]);
}
