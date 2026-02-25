/**
 * ==========================================================
 *  MercyModal — Dad-Joke Multiple Choice Challenge
 * ==========================================================
 *
 * Shown when the player exhausts guesses in MERCY mode and
 * `isMercyAvailable` is true.
 *
 * Flow:
 *   1. Player clicks "Beg for Mercy" → requestMercy() with
 *      no answer → server returns the joke + 4 choices.
 *   2. Player picks one of the choices → requestMercy(choice)
 *      → server validates and returns granted/denied.
 *   3. If granted: modal shows success, game is ACTIVE +1 guess.
 *   4. If denied:  modal shows failure, game is LOST.
 * ==========================================================
 */

import React, { useEffect, useState } from "react";
import { useGame } from "@/context/GameContext";

export function MercyModal() {
  const { state, requestMercy } = useGame();
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<"prompt" | "answering" | "result">("prompt");
  const [dismissed, setDismissed] = useState(false);

  const isOpen =
    state.isMercyAvailable ||
    (state.mercyJoke !== null && state.status === "ACTIVE") ||
    (phase === "result" && state.status === "LOST" && !dismissed);

  // When mercy becomes available, reset
  useEffect(() => {
    if (state.isMercyAvailable) {
      setPhase("prompt");
      setSelected(null);
      setDismissed(false);
    }
  }, [state.isMercyAvailable]);

  // Auto-dismiss after result is shown (2s for grant, 3s for deny)
  useEffect(() => {
    if (phase === "result" && (state.status === "ACTIVE" || state.status === "LOST")) {
      const delay = state.status === "ACTIVE" ? 2000 : 3000;
      const timer = setTimeout(() => setDismissed(true), delay);
      return () => clearTimeout(timer);
    }
  }, [phase, state.status]);

  // When a joke + choices are received, move to answering phase
  useEffect(() => {
    if (state.mercyJoke && state.mercyChoices.length > 0 && phase === "prompt") {
      setPhase("answering");
    }
  }, [state.mercyJoke, state.mercyChoices, phase]);

  // If game is no longer active (lost after wrong answer), show result
  useEffect(() => {
    if (state.status === "LOST" && phase === "answering") {
      setPhase("result");
    }
  }, [state.status, phase]);

  // If mercy was granted (status still ACTIVE, attemptsRemaining > 0), close
  useEffect(() => {
    if (
      state.mercyMessage &&
      state.status === "ACTIVE" &&
      state.attemptsRemaining > 0 &&
      phase === "answering"
    ) {
      setPhase("result");
    }
  }, [state.mercyMessage, state.status, state.attemptsRemaining, phase]);

  if (dismissed) return null;
  if (!isOpen && phase !== "result") return null;

  async function handleRequestJoke() {
    await requestMercy();
  }

  async function handleSubmitChoice() {
    if (!selected) return;
    await requestMercy(selected);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in">
      <div className="bg-gray-800 border border-gray-600 rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        {/* Header */}
        <h2 className="text-2xl font-bold text-white mb-4 text-center">
          🙏 Show Mercy
        </h2>

        {/* Phase: Prompt — ask user if they want to try the joke */}
        {phase === "prompt" && !state.mercyJoke && (
          <div className="text-center">
            <p className="text-gray-300 mb-6">
              You've used all your guesses! Pick the correct punchline
              to a dad joke to earn one more chance.
            </p>
            <button
              onClick={() => void handleRequestJoke()}
              disabled={state.loading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {state.loading ? "Loading joke…" : "Beg for Mercy"}
            </button>
          </div>
        )}

        {/* Phase: Answering — show the joke and multiple choice */}
        {phase === "answering" && state.mercyJoke && state.mercyChoices.length > 0 && (
          <div>
            {/* Joke question */}
            <div className="bg-gray-900 rounded-xl p-4 mb-6">
              <p className="text-amber-300 text-lg font-medium text-center">
                "{state.mercyJoke}"
              </p>
            </div>

            {/* Multiple choice buttons */}
            <div className="flex flex-col gap-3 mb-5">
              {state.mercyChoices.map((choice, i) => {
                const letter = String.fromCharCode(65 + i); // A, B, C, D
                const isSelected = selected === choice;
                return (
                  <button
                    key={i}
                    onClick={() => setSelected(choice)}
                    disabled={state.loading}
                    className={`
                      w-full text-left px-4 py-3 rounded-lg border-2 transition-all duration-150
                      ${
                        isSelected
                          ? "border-emerald-500 bg-emerald-900/40 text-white"
                          : "border-gray-600 bg-gray-700/50 text-gray-200 hover:border-gray-400 hover:bg-gray-700"
                      }
                      disabled:opacity-50
                    `}
                  >
                    <span className="font-bold text-emerald-400 mr-2">{letter}.</span>
                    {choice}
                  </button>
                );
              })}
            </div>

            {/* Submit */}
            <button
              onClick={() => void handleSubmitChoice()}
              disabled={state.loading || !selected}
              className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {state.loading ? "Checking…" : "Lock In Answer"}
            </button>
          </div>
        )}

        {/* Phase: Result */}
        {phase === "result" && (
          <div className="text-center">
            {state.status === "ACTIVE" ? (
              <>
                <div className="text-5xl mb-4">🎉</div>
                <p className="text-emerald-400 text-lg font-medium mb-2">
                  Mercy Granted!
                </p>
                <p className="text-gray-400 mb-4">{state.mercyMessage}</p>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors"
                >
                  Continue
                </button>
              </>
            ) : (
              <>
                <div className="text-5xl mb-4">💀</div>
                <p className="text-red-400 text-lg font-medium mb-2">
                  No Mercy!
                </p>
                <p className="text-gray-400 mb-4">
                  {state.mercyMessage || "Wrong answer. Game over!"}
                </p>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors"
                >
                  OK
                </button>
              </>
            )}
          </div>
        )}

        {/* Error */}
        {state.error && (
          <p className="text-red-400 text-sm text-center mt-4">
            {state.error}
          </p>
        )}
      </div>
    </div>
  );
}
