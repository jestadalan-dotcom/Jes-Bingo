import React, { useState, useEffect, useRef } from 'react';
import { GameState, BingoCard, NetworkMessage, WelcomePayload, BingoCell } from '../types';
import BingoBoard from './BingoBoard';
import { RefreshCw, Play, Users, Trophy, LayoutGrid, ChevronLeft, ChevronRight, Volume2, VolumeX, Link, Copy, BellRing } from 'lucide-react';
import Peer, { DataConnection } from 'peerjs';

interface ActiveGameProps {
  initialState: GameState;
  onReset: () => void;
}

const ActiveGame: React.FC<ActiveGameProps> = ({ initialState, onReset }) => {
  const [gameState, setGameState] = useState<GameState>(initialState);
  // Ref to keep track of latest state in event listeners
  const gameStateRef = useRef(initialState);
  
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0); 
  const [viewMode, setViewMode] = useState<'FOCUS' | 'ALL'>('FOCUS');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState<string[]>([]);
  
  // Networking State
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [connectedPlayers, setConnectedPlayers] = useState<number[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);

  // Sync Ref with State
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const addNotification = (msg: string) => {
    setNotifications(prev => [msg, ...prev].slice(0, 5));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n !== msg));
    }, 5000);
  };

  const broadcast = (msg: NetworkMessage) => {
    connectionsRef.current.forEach(conn => {
        if(conn.open) conn.send(msg);
    });
  };

  // Initialize Host Server (PeerJS)
  useEffect(() => {
    const peer = new Peer();
    
    peer.on('open', (id) => {
      console.log('Host ID:', id);
      setRoomCode(id);
    });

    peer.on('connection', (conn) => {
      conn.on('open', () => {
        const currentConnections = connectionsRef.current;
        if (currentConnections.length >= 10) {
          conn.close(); 
          return;
        }

        connectionsRef.current.push(conn);
        
        const playerIndex = connectionsRef.current.length - 1;
        setConnectedPlayers(prev => [...prev, playerIndex]);

        // Access state via ref to avoid stale closure
        const currentGameState = gameStateRef.current;
        const playerCards = currentGameState.cards.filter(c => c.ownerIndex === playerIndex);
        
        const welcomeMsg: NetworkMessage = {
          type: 'WELCOME',
          payload: {
            playerIndex,
            playerName: `Player ${playerIndex + 1}`,
            cards: playerCards,
            theme: currentGameState.theme,
            currentCall: currentGameState.currentCall,
            calledItems: currentGameState.calledItems
          } as WelcomePayload
        };
        conn.send(welcomeMsg);
      });

      conn.on('data', (data: any) => {
        const msg = data as NetworkMessage;
        
        if (msg.type === 'CLAIM_BINGO') {
          const { cardId, playerIndex } = msg.payload;
          const currentGameState = gameStateRef.current;
          
          // Verify Bingo on Server Side (Trust but Verify)
          const card = currentGameState.cards.find(c => c.id === cardId);
          if (card) {
            // Check if this card ACTUALLY has a bingo based on calledItems
            // We reconstruct the cells and mark them based on called items, not user input
            const verifiedCells = card.cells.map(cell => ({
               ...cell,
               marked: cell.isFreeSpace || currentGameState.calledItems.includes(cell.value)
            }));
            
            const hasVerifiedBingo = checkForWin(verifiedCells);

            if (hasVerifiedBingo) {
               addNotification(`🎉 Player ${playerIndex + 1} called BINGO!`);
               
               // Mark this card as a winner in local state if not already
               if (!currentGameState.winnerIds.includes(cardId)) {
                   setGameState(prev => ({
                       ...prev,
                       winnerIds: [...prev.winnerIds, cardId]
                   }));
                   // Play sound
                   if(soundEnabled) {
                     const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); 
                     audio.volume = 0.8;
                     audio.play().catch(() => {});
                   }
                   // Announce to all
                   broadcast({ type: 'BINGO_ANNOUNCED', payload: { playerIndex, cardId } });
               }
            } else {
               addNotification(`⚠️ Player ${playerIndex + 1} called a false Bingo!`);
            }
          }
        }
      });

      conn.on('close', () => {
        console.log('Player disconnected');
      });
    });

    peerRef.current = peer;

    return () => {
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const checkForWin = (cells: BingoCell[]) => {
      // Rows
      for (let i = 0; i < 5; i++) {
        if (cells.slice(i * 5, (i + 1) * 5).every(c => c.marked)) return true;
      }
      // Cols
      for (let i = 0; i < 5; i++) {
        let colComplete = true;
        for (let j = 0; j < 5; j++) {
          if (!cells[i + j * 5].marked) colComplete = false;
        }
        if (colComplete) return true;
      }
      // Diagonals
      if ([0, 6, 12, 18, 24].every(idx => cells[idx].marked)) return true;
      if ([4, 8, 12, 16, 20].every(idx => cells[idx].marked)) return true;
      
      return false;
  };

  const playersList = Array.from({ length: 10 }, (_, i) => {
    const playerCard = gameState.cards.find(c => c.ownerIndex === i);
    const isConnected = connectedPlayers.includes(i);
    return {
      index: i,
      name: playerCard?.playerName || `Player ${i + 1}`,
      cards: gameState.cards.filter(c => c.ownerIndex === i),
      connected: isConnected
    };
  });

  const activePlayer = playersList[currentPlayerIndex];

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

  // Auto-update winners based on what Host sees (Manual marking or auto-verification)
  // We keep this to visualize wins on the host board if the host is manually tracking too
  useEffect(() => {
    const newWinnerIds: string[] = [];
    // We only update state if we find a NEW winner locally to avoid loops
    // But the PeerJS handler also updates state.
    
    // To enable "Host Mode Auto-Marking" visualization (optional but nice):
    // If we wanted to auto-mark cards on the host when a number is called:
    // We would do it in callNextNumber.
    // For now, we rely on PeerJS verification for official wins, but we still check for local 'marked' wins.
    
    const updatedCards = gameState.cards.map(card => {
       const hasLine = checkForWin(card.cells);
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
    } else {
        // Just sync 'hasBingo' visual state without adding to winnerIds if already there
        const hasChanges = JSON.stringify(updatedCards.map(c => c.hasBingo)) !== JSON.stringify(gameState.cards.map(c => c.hasBingo));
        if (hasChanges) {
           setGameState(prev => ({ ...prev, cards: updatedCards }));
        }
    }
  }, [gameState.cards, gameState.calledItems]); 


  const callNextNumber = () => {
    const availableItems = gameState.allItems.filter(item => !gameState.calledItems.includes(item));
    if (availableItems.length === 0) return;

    const randomIndex = Math.floor(Math.random() * availableItems.length);
    const nextItem = availableItems[randomIndex];

    if (soundEnabled && 'speechSynthesis' in window) {
      let text = String(nextItem);
      if (gameState.mode === 'STANDARD') {
        const { letter } = getFormattedCall(nextItem);
        text = `${letter} ${nextItem}`;
      }
      const utterance = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utterance);
    }

    setGameState(prev => {
        // Auto-mark logic for Host View:
        // When a number is called, we update the Host's cards so they can see who has it.
        const updatedCards = prev.cards.map(card => ({
            ...card,
            cells: card.cells.map(cell => 
                cell.value === nextItem ? { ...cell, marked: true } : cell
            )
        }));
        
        return {
            ...prev,
            calledItems: [nextItem, ...prev.calledItems],
            currentCall: nextItem,
            cards: updatedCards
        };
    });

    broadcast({
      type: 'NEXT_CALL',
      payload: nextItem
    });
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

  const copyRoomLink = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      alert("Room Code copied to clipboard!");
    }
  };

  const totalBingos = gameState.winnerIds.length;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* Toast Notifications */}
      <div className="fixed top-24 right-4 z-50 flex flex-col gap-2">
          {notifications.map((note, idx) => (
              <div key={idx} className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl animate-fade-in flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-yellow-400" />
                  {note}
              </div>
          ))}
      </div>

      {/* Top Bar - Host Controls */}
      <header className="bg-white border-b border-slate-200 p-3 md:p-4 shadow-sm z-20 flex-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            
            {/* Room Info */}
            <div className="flex flex-col">
               <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Link className="w-3 h-3"/> Room Code
               </div>
               <button onClick={copyRoomLink} className="flex items-center gap-2 font-mono font-bold text-lg hover:text-blue-600 transition-colors" title="Click to Copy">
                 {roomCode ? <>{roomCode} <Copy className="w-4 h-4 text-slate-400" /></> : <span className="animate-pulse">Creating Room...</span>}
               </button>
            </div>

            <div className="w-px h-10 bg-slate-200 hidden md:block"></div>

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
            <div className="flex items-center justify-center gap-4 mb-4 md:mb-6 sticky top-0 z-10 py-2 bg-slate-50/90 backdrop-blur-sm">
               <button 
                  onClick={() => setCurrentPlayerIndex(prev => Math.max(0, prev - 1))}
                  disabled={currentPlayerIndex === 0}
                  className="p-3 bg-white rounded-full shadow-md border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
               >
                 <ChevronLeft className="w-6 h-6" />
               </button>
               
               <div className="text-center min-w-[200px] bg-white px-6 py-2 rounded-xl shadow-sm border border-slate-200">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-2">
                    Viewing Player {currentPlayerIndex + 1}/10
                    {activePlayer.connected ? <span className="w-2 h-2 rounded-full bg-green-500"></span> : <span className="w-2 h-2 rounded-full bg-slate-300"></span>}
                  </div>
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
                        p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] relative
                        ${playerWins > 0 ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-slate-200 hover:border-blue-300'}
                      `}
                    >
                      {player.connected && (
                          <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white" title="Connected"></div>
                      )}
                      <div className="flex justify-between items-start mb-2">
                         <div className="font-bold text-lg truncate pr-2">{player.name}</div>
                         {playerWins > 0 && <Trophy className="w-5 h-5 text-yellow-600" />}
                      </div>
                      
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
      
      <footer className="bg-white border-t p-2 text-center text-xs text-slate-400 flex-none">
         Playing: <span className="font-bold text-slate-600">{gameState.theme}</span> | Players Connected: {connectedPlayers.length}/10
      </footer>
    </div>
  );
};

export default ActiveGame;