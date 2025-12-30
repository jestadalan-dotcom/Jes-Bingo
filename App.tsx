import React, { useState } from 'react';
import { GameMode, GameState, AppRole } from './types';
import { generateCards } from './gameUtils';
import GameSetup from './components/GameSetup';
import ActiveGame from './components/ActiveGame';
import Landing from './components/Landing';
import PlayerClient from './components/PlayerClient';

const App: React.FC = () => {
  const [role, setRole] = useState<AppRole>('LANDING');
  const [gameState, setGameState] = useState<GameState | null>(null);

  const handleStartGame = (mode: GameMode, items: (string | number)[], themeName: string, prize: string, hostName: string) => {
    // Generate initial cards for the Host (Index 0)
    const hostCards = generateCards(items, mode, [hostName], 0);

    setGameState({
      isSetup: false,
      mode,
      theme: themeName,
      prize: prize,
      allItems: items,
      calledItems: [],
      currentCall: null,
      cards: hostCards, // Host starts with cards
      winnerIds: []
    });
  };

  const handleExit = () => {
    if (window.confirm("Disconnect and return to home screen?")) {
      setGameState(null);
      setRole('LANDING');
    }
  };

  if (role === 'LANDING') {
    return <Landing onChooseRole={setRole} />;
  }

  if (role === 'PLAYER') {
    return <PlayerClient onBack={() => setRole('LANDING')} />;
  }

  // Host Mode
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {!gameState ? (
        <>
          <div className="p-4">
            <button onClick={() => setRole('LANDING')} className="text-slate-500 hover:text-slate-800 font-bold mb-4">← Back</button>
          </div>
          <GameSetup onStartGame={handleStartGame} />
        </>
      ) : (
        <ActiveGame initialState={gameState} onExit={handleExit} />
      )}
    </div>
  );
};

export default App;