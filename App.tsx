import React, { useState } from 'react';
import { GameMode, GameState, BingoCard, BingoCell, THEME_COLORS, AppRole } from './types';
import GameSetup from './components/GameSetup';
import ActiveGame from './components/ActiveGame';
import Landing from './components/Landing';
import PlayerClient from './components/PlayerClient';

const App: React.FC = () => {
  const [role, setRole] = useState<AppRole>('LANDING');
  const [gameState, setGameState] = useState<GameState | null>(null);

  const generateCards = (items: (string | number)[], themeMode: GameMode, playerNames: string[]): BingoCard[] => {
    const cards: BingoCard[] = [];
    const CARDS_PER_PLAYER = 4;
    
    playerNames.forEach((playerName, playerIdx) => {
      // Create 4 cards for each player
      for(let cardIdx = 0; cardIdx < CARDS_PER_PLAYER; cardIdx++) {
         let cells: BingoCell[] = [];
         
         if (themeMode === 'STANDARD') {
            // Standard Bingo Logic
            const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
            const colNumbers: number[][] = [[], [], [], [], []];
            
            ranges.forEach((range, colIndex) => {
               const possible = Array.from({length: range[1] - range[0] + 1}, (_, k) => k + range[0]);
               // Shuffle
               for (let j = possible.length - 1; j > 0; j--) {
                 const k = Math.floor(Math.random() * (j + 1));
                 [possible[j], possible[k]] = [possible[k], possible[j]];
               }
               colNumbers[colIndex] = possible.slice(0, 5);
            });

            const flatCells: BingoCell[] = [];
            for(let r=0; r<5; r++) {
               for(let c=0; c<5; c++) {
                  const isFree = r === 2 && c === 2;
                  flatCells.push({
                    id: `p${playerIdx}_c${cardIdx}_r${r}_col${c}`,
                    value: isFree ? 'FREE' : colNumbers[c][r],
                    marked: false,
                    isFreeSpace: isFree
                  });
               }
            }
            cells = flatCells;
         } else {
            // Themed Logic
            const shuffled = [...items];
            for (let j = shuffled.length - 1; j > 0; j--) {
              const k = Math.floor(Math.random() * (j + 1));
              [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
            }
            
            const cardItems = shuffled.slice(0, 24);
            let itemIdx = 0;
            for (let r = 0; r < 5; r++) {
              for (let c = 0; c < 5; c++) {
                 const isFree = r === 2 && c === 2;
                 cells.push({
                   id: `p${playerIdx}_c${cardIdx}_r${r}_col${c}`,
                   value: isFree ? 'FREE' : cardItems[itemIdx++],
                   marked: false,
                   isFreeSpace: isFree
                 });
              }
            }
         }

         cards.push({
           id: `p${playerIdx}_c${cardIdx}`,
           ownerIndex: playerIdx,
           cardIndex: cardIdx,
           playerName: playerName,
           cells: cells,
           hasBingo: false,
           colorTheme: THEME_COLORS[playerIdx % THEME_COLORS.length]
         });
      }
    });

    return cards;
  };

  const handleStartGame = (mode: GameMode, items: (string | number)[], themeName: string, playerNames: string[]) => {
    const cards = generateCards(items, mode, playerNames);
    setGameState({
      isSetup: false,
      mode,
      theme: themeName,
      allItems: items,
      calledItems: [],
      currentCall: null,
      cards: cards,
      winnerIds: []
    });
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to end this game?")) {
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
        <ActiveGame initialState={gameState} onReset={handleReset} />
      )}
    </div>
  );
};

export default App;