/**
 * ==========================================================
 *  App — Root Component
 * ==========================================================
 *
 * Routes between HomeScreen and GameScreen based on whether
 * a session is active. Wraps everything in GameProvider..
 * ==========================================================
 */

import React from "react";
import { GameProvider, useGame } from "@/context/GameContext";
import { HomeScreen } from "@/components/HomeScreen";
import { GameScreen } from "@/components/GameScreen";

function AppRouter() {
  const { state } = useGame();

  // If there's an active session, show the game screen
  if (state.sessionId) {
    return <GameScreen />;
  }

  // Otherwise, show the home screen
  return <HomeScreen />;
}

export default function App() {
  return (
    <GameProvider>
      <div className="min-h-screen bg-gray-900">
        <AppRouter />
      </div>
    </GameProvider>
  );
}
