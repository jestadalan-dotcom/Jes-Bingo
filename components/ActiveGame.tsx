import React, { useState, useEffect } from 'react';
import { GameState, BingoCard, BingoCell } from '../types';
import BingoBoard from './BingoBoard';
import { RefreshCw, Play, Users, Trophy, LayoutGrid, ChevronLeft, ChevronRight, Volume2, VolumeX } from 'lucide-react';

interface ActiveGameProps {
  initialState: GameState;
  onReset: () => void;
}

const ActiveGame: React.FC<ActiveGameProps> = ({ initialState, onReset }) => {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0); // 0 to 9 (10 players)
  const [viewMode, setViewMode] = useState<'FOCUS' | 'ALL'>('FOCUS');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Derive list of players from cards
  const playersList = Array.from({ length: 10 }, (_, i) => {
    const playerCard = gameState.cards.find(c => c.ownerIndex === i);
    return {
      index: i,
      name: playerCard?.playerName || `Player ${i + 1}`,
      cards: gameState.cards.filter(c => c.ownerIndex === i)
    };
  });

  const activePlayer = playersList[currentPlayerIndex];

  // Helper to format call with letter (B 5)
  const getFormattedCall = (val: string | number | null) => {
    if (!val) return { letter: '', main: '-' };
    if (gameState.mode === 'THEMED') return { letter: '', main: val };
    
    const num = Number(val);
    if (isNaN(num)) return { letter: '', main: val };

    let letter = '';
    if (num <= 15) letter = 'B';
    else if (num <= 30) letter = 'I';
    else if (num <= 45) letter = 'N';
    else if (num <= 60) letter = 'G';
    else letter = 'O';
    
    return { letter, main: num };
  };

  const currentDisplay = getFormattedCall(gameState.currentCall);

  // Check for wins whenever cards change
  useEffect(() => {
    const newWinnerIds: string[] = [];
    
    const updatedCards = gameState.cards.map(card => {
      // Check rows
      let hasLine = false;
      for (let i = 0; i < 5; i++) {
        if (card.cells.slice(i * 5, (i + 1) * 5).every(c => c.marked || c.isFreeSpace)) hasLine = true;
      }
      // Check cols
      for (let i = 0; i < 5; i++) {
        let colComplete = true;
        for (let j = 0; j < 5; j++) {
          const cell = card.cells[i + j * 5];
          if (!cell.marked && !cell.isFreeSpace) colComplete = false;
        }
        if (colComplete) hasLine = true;
      }
      // Check diagonals
      if ([0, 6, 12, 18, 24].every(idx => card.cells[idx].marked || card.cells[idx].isFreeSpace)) hasLine = true;
      if ([4, 8, 12, 16, 20].every(idx => card.cells[idx].marked || card.cells[idx].isFreeSpace)) hasLine = true;

      if (hasLine && !gameState.winnerIds.includes(card.id)) {
        newWinnerIds.push(card.id);
      }
      
      return { ...card, hasBingo: hasLine };
    });

    if (newWinnerIds.length > 0) {
      setGameState(prev => ({
        ...prev,
        cards: updatedCards,
        winnerIds: [...prev.winnerIds, ...newWinnerIds]
      }));
      // Play sound
      if(soundEnabled) {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); 
          audio.volume = 0.5;
          audio.play().catch(e => console.log('Audio play failed', e));
      }
    } else {
        if (JSON.stringify(updatedCards) !== JSON.stringify(gameState.cards)) {
            setGameState(prev => ({ ...prev, cards: updatedCards }));
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.calledItems]); 


  const callNextNumber = () => {
    const availableItems = gameState.allItems.filter(item => !gameState.calledItems.includes(item));
    if (availableItems.length === 0) return;

    const randomIndex = Math.floor(Math.random() * availableItems.length);
    const nextItem = availableItems[randomIndex];

    if (soundEnabled && 'speechSynthesis' in window) {
      let text = String(nextItem);
      // Add letter to speech if in Standard mode
      if (gameState.mode === 'STANDARD') {
        const { letter } = getFormattedCall(nextItem);
        text = `${letter} ${nextItem}`;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }

    setGameState(prev => ({
      ...prev,
      calledItems: [nextItem, ...prev.calledItems],
      currentCall: nextItem
    }));
  };

  const handleCellClick = (cardId: string, cellId: string) => {
    setGameState(prev => {
      const updatedCards = prev.cards.map(card => {
        if (card.id !== cardId) return card;
        
        const updatedCells = card.cells.map(cell => {
          if (cell.id !== cellId) return cell;
          return { ...cell, marked: !cell.marked };
        });

        return { ...card, cells: updatedCells };
      });
      return { ...prev, cards: updatedCards };
    });
  };

  const totalBingos = gameState.winnerIds.length;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Top Bar - Host Controls */}
      <header className="bg-white border-b border-slate-200 p-3 md:p-4 shadow-sm z-20 flex-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            {/* Current Call Display */}
            <div className="bg-slate-900 text-white rounded-lg px-4 py-2 text-center min-w-[110px] md:min-w-[140px] shadow-md ring-2 ring-slate-100">
              <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Current Call</div>
              <div className="text-2xl md:text-3xl font-black truncate max-w-[180px] flex items-center justify-center gap-1" title={String(gameState.currentCall || '-')}>
                 {currentDisplay.letter && <span className="text-blue-400 text-lg md:text-2xl align-top self-center">{currentDisplay.letter}</span>}
                 <span>{currentDisplay.main}</span>
              </div>
            </div>
            
            <div className="flex gap-2">
               <button 
                onClick={callNextNumber}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
              >
                <Play className="w-5 h-5" /> <span className="hidden sm:inline">Next</span>
              </button>
              <button 
                 onClick={() => setSoundEnabled(!soundEnabled)}
                 className={`p-2 rounded-lg border ${soundEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`}
                 title={soundEnabled ? "Mute Sound" : "Enable Sound"}
              >
                 {soundEnabled ? <Volume2 className="w-5 h-5"/> : <VolumeX className="w-5 h-5"/>}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
             {/* Last 5 calls */}
             {gameState.calledItems.slice(1, 6).map((item, idx) => {
                const display = getFormattedCall(item);
                return (
                    <div key={idx} className="bg-slate-100 text-slate-500 rounded px-3 py-1 text-sm font-medium whitespace-nowrap border border-slate-200">
                    {display.letter && <span className="text-slate-400 mr-0.5 text-xs">{display.letter}</span>}
                    {display.main}
                    </div>
                );
             })}
             <div className="ml-auto flex gap-2 pl-2">
               <button 
                  onClick={() => setViewMode(viewMode === 'FOCUS' ? 'ALL' : 'FOCUS')}
                  className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1"
                  title="Toggle View"
               >
                 {viewMode === 'FOCUS' ? <LayoutGrid className="w-5 h-5" /> : <Users className="w-5 h-5" />}
               </button>

               <button 
                onClick={onReset}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                title="Reset Game"
               >
                 <RefreshCw className="w-5 h-5" />
               </button>
             </div>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-slate-50 relative p-4">
        
        {/* Winner Banner */}
        {totalBingos > 0 && (
           <div className="fixed top-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
              <div className="bg-yellow-400 text-yellow-900 border-4 border-yellow-500 px-6 py-2 rounded-full font-black text-xl shadow-xl flex items-center gap-2 animate-bounce">
                <Trophy className="w-6 h-6" />
                {totalBingos} Card{totalBingos !== 1 && 's'} Won!
              </div>
           </div>
        )}

        {viewMode === 'FOCUS' ? (
          <div className="max-w-7xl mx-auto flex flex-col h-full">
            {/* Player Selector for Focus Mode */}
            <div className="flex items-center justify-center gap-4 mb-4 md:mb-6 sticky top-0 z-10 py-2 bg-slate-50/90 backdrop-blur-sm">
               <button 
                  onClick={() => setCurrentPlayerIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentPlayerIndex === 0}
                  className="p-3 bg-white rounded-full shadow-md border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
               >
                 <ChevronLeft className="w-6 h-6" />
               </button>
               
               <div className="text-center min-w-[200px] bg-white px-6 py-2 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Viewing Player {currentPlayerIndex + 1}/10</div>
                  <div className="text-xl md:text-2xl font-black text-slate-800 truncate">{activePlayer.name}</div>
               </div>

               <button 
                  onClick={() => setCurrentPlayerIndex(prev => Math.min(9, prev + 1))}
                  disabled={currentPlayerIndex === 9}
                  className="p-3 bg-white rounded-full shadow-md border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
               >
                 <ChevronRight className="w-6 h-6" />
               </button>
            </div>
            
            {/* 4 Card Grid for Active Player */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 md:gap-8 pb-10 justify-items-center">
              {activePlayer.cards.map((card, idx) => (
                <div key={card.id} className="w-full max-w-[400px]">
                   <div className="text-xs font-bold text-slate-400 mb-1 pl-1">Card #{idx + 1}</div>
                   <BingoBoard 
                      card={card} 
                      onCellClick={(cellId) => handleCellClick(card.id, cellId)}
                    />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto">
             <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-slate-700">All Players Overview</h2>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {playersList.map(player => {
                  const playerWins = player.cards.filter(c => c.hasBingo).length;
                  return (
                    <button 
                      key={player.index}
                      onClick={() => {
                        setCurrentPlayerIndex(player.index);
                        setViewMode('FOCUS');
                      }}
                      className={`
                        p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02]
                        ${playerWins > 0 ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-slate-200 hover:border-blue-300'}
                      `}
                    >
                      <div className="flex justify-between items-start mb-2">
                         <div className="font-bold text-lg truncate pr-2">{player.name}</div>
                         {playerWins > 0 && <Trophy className="w-5 h-5 text-yellow-600" />}
                      </div>
                      
                      {/* Mini visual representation of cards */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {player.cards.map(c => (
                          <div key={c.id} className={`h-8 rounded flex items-center justify-center text-xs font-bold ${c.hasBingo ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-100 text-slate-400'}`}>
                            {c.hasBingo ? 'WIN' : `#${c.cardIndex+1}`}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
             </div>
          </div>
        )}
      </main>
      
      {/* Footer Info */}
      <footer className="bg-white border-t p-2 text-center text-xs text-slate-400 flex-none">
         Playing: <span className="font-bold text-slate-600">{gameState.theme}</span> | Players: 10
      </footer>
    </div>
  );
};

export default ActiveGame;