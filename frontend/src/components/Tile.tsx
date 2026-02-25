/**
 * ==========================================================
 *  Tile — Single Letter Cell
 * ==========================================================
 *
 * Renders one letter tile. Handles:
 *   - Standard modes: bg colour based on status
 *   - GUESS_THE_REST: bg colour from hex property
 *   - COLORBLIND: neutral grey (status is always "absent")
 *   - Flip animation on reveal
 * ==========================================================
 */

import React from "react";
import type { LetterStatus } from "@/types/game";

interface TileProps {
  letter: string;
  status?: LetterStatus;
  hex?: string;
  /** Delay index for staggered flip animation */
  flipDelay?: number;
  /** Whether this tile is part of the current (uncommitted) input */
  isInput?: boolean;
}

/**
 * Map a LetterStatus to a Tailwind background colour class.
 */
function statusToBg(status: LetterStatus | undefined): string {
  switch (status) {
    case "correct":
      return "bg-emerald-600 border-emerald-500";
    case "present":
      return "bg-amber-500 border-amber-400";
    case "absent":
      return "bg-gray-700 border-gray-600";
    case "obfuscated":
      // Falls through — hex colour is applied inline
      return "border-gray-500";
    default:
      return "bg-gray-800 border-gray-600";
  }
}

export function Tile({ letter, status, hex, flipDelay = 0, isInput }: TileProps) {
  const hasLetter = letter.length > 0;
  const isRevealed = status !== undefined;

  // For GUESS_THE_REST: apply inline hex colour
  const inlineStyle: React.CSSProperties =
    status === "obfuscated" && hex
      ? { backgroundColor: hex, transitionDelay: `${flipDelay * 100}ms` }
      : { transitionDelay: `${flipDelay * 100}ms` };

  return (
    <div
      className={`
        w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center
        border-2 rounded-lg text-2xl font-bold uppercase
        transition-all duration-300
        ${isInput && hasLetter ? "border-gray-400 scale-105" : ""}
        ${isRevealed ? statusToBg(status) : "bg-gray-800 border-gray-600"}
        ${isRevealed ? "animate-flip text-white" : "text-white"}
      `}
      style={inlineStyle}
    >
      {letter}
    </div>
  );
}
