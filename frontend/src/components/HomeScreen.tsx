/**
 * ==========================================================
 *  HomeScreen — Mode Selection
 * ==========================================================
 *
 * Displays a grid of cards for the six game modes.
 * Clicking a card calls `startGame(mode)` from context.
 * ==========================================================
 */

import React from "react";
import { useGame } from "@/context/GameContext";
import type { GameMode, ModeInfo } from "@/types/game";

const MODES: ModeInfo[] = [
  {
    mode: "SPEED",
    title: "Speed Run",
    description: "Solve a 5-letter word in 6 guesses within 5 minutes. Every second counts!",
    icon: "⚡",
    wordLength: 5,
    maxGuesses: 6,
    timed: true,
  },
  {
    mode: "TWIN",
    title: "Twin",
    description:
      "Two words, one board. Each guess is evaluated against both target words. Solve both in 7 guesses.",
    icon: "👯",
    wordLength: 5,
    maxGuesses: 7,
    timed: false,
  },
  {
    mode: "COLORBLIND",
    title: "Colorblind",
    description:
      "No colour feedback at all — every tile looks the same. 8 guesses, pure deduction.",
    icon: "🔲",
    wordLength: 5,
    maxGuesses: 8,
    timed: false,
  },
  {
    mode: "FLASH",
    title: "Flash / Memory",
    description:
      "The board is visible for 3 seconds, then whites out for 25 seconds. Memorise fast! 5-minute limit.",
    icon: "💡",
    wordLength: 5,
    maxGuesses: 6,
    timed: true,
  },
  {
    mode: "MERCY",
    title: "Show Mercy",
    description:
      "Run out of guesses? Answer a dad joke correctly for one more chance. Fail, and it's game over!",
    icon: "🙏",
    wordLength: 5,
    maxGuesses: 6,
    timed: false,
  },
  {
    mode: "GUESS_THE_REST",
    title: "Guess the Rest",
    description:
      "6-letter words with obfuscated colours — tiles show random hex colours instead of green/yellow/grey. Deduce the pattern!",
    icon: "🎨",
    wordLength: 6,
    maxGuesses: 6,
    timed: false,
  },
];

export function HomeScreen() {
  const { startGame, state } = useGame();

  function handleSelect(mode: GameMode) {
    void startGame(mode);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      {/* Title */}
      <h1 className="text-5xl font-extrabold text-white mb-2 tracking-tight">
        Extreme Wordle
      </h1>
      <p className="text-gray-400 mb-10 text-lg">
        Choose your challenge. Survive if you can.
      </p>

      {/* Error banner */}
      {state.error && (
        <div className="bg-red-900/60 border border-red-500 text-red-200 px-4 py-2 rounded-lg mb-6 max-w-xl text-center">
          {state.error}
        </div>
      )}

      {/* Mode Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl w-full">
        {MODES.map((m) => (
          <button
            key={m.mode}
            onClick={() => handleSelect(m.mode)}
            disabled={state.loading}
            className={`
              group relative flex flex-col items-start p-6 rounded-2xl
              bg-gray-800/80 border border-gray-700
              hover:border-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-wait
              text-left
            `}
          >
            {/* Icon */}
            <span className="text-4xl mb-3">{m.icon}</span>

            {/* Title */}
            <h2 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">
              {m.title}
            </h2>

            {/* Meta badges */}
            <div className="flex gap-2 mt-2 mb-3">
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                {m.wordLength} letters
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                {m.maxGuesses} guesses
              </span>
              {m.timed && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-700/60 text-amber-200">
                  timed
                </span>
              )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-400 leading-relaxed">
              {m.description}
            </p>
          </button>
        ))}
      </div>

      {/* Loading spinner */}
      {state.loading && (
        <div className="mt-8 flex items-center gap-3 text-gray-400">
          <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          Starting game…
        </div>
      )}
    </div>
  );
}
