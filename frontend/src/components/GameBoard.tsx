/**
 * ==========================================================
 *  GameBoard — The Wordle Grid
 * ==========================================================
 *
 * Renders the complete board grid: committed guesses + current
 * input row + remaining empty rows. For TWIN mode, renders
 * two boards side-by-side.
 * ==========================================================
 */

import React from "react";
import { useGame } from "@/context/GameContext";
import { Tile } from "./Tile";
import type { GuessResult } from "@/types/game";

interface SingleBoardProps {
  board: GuessResult[][];
  currentInput: string;
  wordLength: number;
  maxGuesses: number;
  guessesUsed: number;
  label?: string;
  /** When true, the board is solved and no input row is shown */
  locked?: boolean;
}

function SingleBoard({
  board,
  currentInput,
  wordLength,
  maxGuesses,
  guessesUsed,
  label,
  locked = false,
}: SingleBoardProps) {
  const rows: React.ReactNode[] = [];

  // ── Committed guess rows ────────────────────────────────
  for (let r = 0; r < board.length; r++) {
    const row = board[r]!;
    rows.push(
      <div key={`row-${r}`} className="flex gap-1.5 justify-center">
        {row.map((cell, c) => (
          <Tile
            key={`${r}-${c}`}
            letter={cell.letter}
            status={cell.status}
            hex={cell.hex}
            flipDelay={c}
          />
        ))}
      </div>
    );
  }

  // ── Current input row (if the game is still active and board is not locked) ─────
  if (!locked && guessesUsed < maxGuesses && board.length < maxGuesses) {
    const inputCells: React.ReactNode[] = [];
    for (let c = 0; c < wordLength; c++) {
      inputCells.push(
        <Tile
          key={`input-${c}`}
          letter={currentInput[c] ?? ""}
          isInput
        />
      );
    }
    rows.push(
      <div key="input-row" className="flex gap-1.5 justify-center">
        {inputCells}
      </div>
    );
  }

  // ── Remaining empty rows ────────────────────────────────
  const filledRows = board.length + (guessesUsed < maxGuesses ? 1 : 0);
  for (let r = filledRows; r < maxGuesses; r++) {
    const emptyCells: React.ReactNode[] = [];
    for (let c = 0; c < wordLength; c++) {
      emptyCells.push(<Tile key={`empty-${r}-${c}`} letter="" />);
    }
    rows.push(
      <div key={`empty-row-${r}`} className="flex gap-1.5 justify-center">
        {emptyCells}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <div className="text-center text-sm text-gray-400 font-medium mb-1">
          {label}
        </div>
      )}
      {rows}
    </div>
  );
}

export function GameBoard() {
  const { state } = useGame();
  const {
    board,
    boardSecondary,
    currentInput,
    wordLength,
    maxGuesses,
    mode,
  } = state;

  const guessesUsed = board.length;

  if (mode === "TWIN") {
    // Detect whether each word has been solved by checking if
    // any row in the board is a full match (all "correct").
    const primarySolved = board.some((row) =>
      row.every((cell) => cell.status === "correct")
    );
    const secondarySolved = boardSecondary.some((row) =>
      row.every((cell) => cell.status === "correct")
    );

    // Route input exclusively to the unsolved board(s).
    // If both are unsolved, both show the current input.
    // If one is solved, only the other shows input.
    const primaryInput = primarySolved ? "" : currentInput;
    const secondaryInput = secondarySolved ? "" : currentInput;

    return (
      <div className="flex flex-col sm:flex-row gap-8 items-start justify-center">
        <SingleBoard
          board={board}
          currentInput={primaryInput}
          wordLength={wordLength}
          maxGuesses={maxGuesses}
          guessesUsed={guessesUsed}
          label={`Word 1${primarySolved ? " ✅" : ""}`}
          locked={primarySolved}
        />
        <SingleBoard
          board={boardSecondary}
          currentInput={secondaryInput}
          wordLength={wordLength}
          maxGuesses={maxGuesses}
          guessesUsed={boardSecondary.length}
          label={`Word 2${secondarySolved ? " ✅" : ""}`}
          locked={secondarySolved}
        />
      </div>
    );
  }

  return (
    <SingleBoard
      board={board}
      currentInput={currentInput}
      wordLength={wordLength}
      maxGuesses={maxGuesses}
      guessesUsed={guessesUsed}
    />
  );
}
