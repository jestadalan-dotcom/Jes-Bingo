import React, { useState, useEffect, useRef } from 'react';
import { GameState, BingoCard, NetworkMessage, WelcomePayload, BingoCell, GameMode, JoinRequestPayload, ChatMessagePayload } from '../types';
import BingoBoard from './BingoBoard';
import GameSetup from './GameSetup';
import ChatPanel from './ChatPanel';
import { generateCards, checkPatternMatch } from '../gameUtils';
import { RefreshCw, Play, Users, Trophy, LayoutGrid, ChevronLeft, ChevronRight, Volume2, VolumeX, Link, Copy, BellRing, Gift, X, UserPlus, PartyPopper, Megaphone, XCircle, Video, VideoOff, Mic, MicOff, Pause, Zap, Grid3X3 } from 'lucide-react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';

interface ActiveGameProps {
  initialState: GameState;
  onExit: () => void;
}

const ActiveGame: React.FC<ActiveGameProps> = ({ initialState, onExit }) => {
  const [gameState, setGameState] = useState<GameState>(initialState);
  const gameStateRef = useRef(initialState);
  
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0); 
  const [viewMode, setViewMode] = useState<'FOCUS' | 'ALL'>('FOCUS');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [notifications, setNotifications] = useState<string[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);
  
  // Celebration State
  const [latestWinner, setLatestWinner] = useState<{name: string, cardIndex: number} | null>(null);
  
  // Host Play State
  const [confirmingBingoCardId, setConfirmingBingoCardId] = useState<string | null>(null);

  // Auto-Play State
  const [isAutoCalling, setIsAutoCalling] = useState(false);
  const [autoCallSpeed, setAutoCallSpeed] = useState<'SLOW' | 'NORMAL' | 'FAST'>('NORMAL');
  
  // Networking State
  const [roomCode, setRoomCode] = useState<string | null>(null);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Video/Audio State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null); 
  
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  
  const connectionsRef = useRef<DataConnection[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const playerMapRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // Auto-Call Logic
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;
    
    if (isAutoCalling && !confirmingBingoCardId) {
        const availableItems = gameState.allItems.filter(item => !gameState.calledItems.includes(item));
        
        if (availableItems.length === 0) {
            setIsAutoCalling(false);
            addNotification("Game Over! All numbers called.");
        } else {
            const delay = autoCallSpeed === 'FAST' ? 2500 : autoCallSpeed === 'SLOW' ? 6000 : 4000;
            
            timeout = setTimeout(() => {
                callNextNumber();
            }, delay);
        }
    }
    
    return () => clearTimeout(timeout);
  }, [isAutoCalling, gameState.calledItems, confirmingBingoCardId, autoCallSpeed, gameState.allItems]);

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

  const handleSendChat = (text: string) => {
      const msg: ChatMessagePayload = {
          id: Date.now().toString(),
          sender: "HOST",
          text,
          timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, msg]);
      broadcast({ type: 'CHAT_MESSAGE', payload: msg });
  };

  const toggleMedia = async () => {
     if (localStreamRef.current) {
         localStreamRef.current.getTracks().forEach(track => track.stop());
         localStreamRef.current = null;
         setLocalStream(null);
         setIsVideoEnabled(false);
         setIsMicEnabled(false);
     } else {
         try {
             const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
             localStreamRef.current = stream;
             setLocalStream(stream);
             setIsVideoEnabled(true);
             setIsMicEnabled(true);
         } catch (e) {
             console.error("Media Error", e);
             addNotification("Could not access camera/mic.");
         }
     }
  };

  const announceWinner = (playerName: string, cardId: string, playerIndex: number) => {
     if (gameStateRef.current.winnerIds.includes(cardId)) return;

     setIsAutoCalling(false);

     setGameState(prev => ({
         ...prev,
         winnerIds: [...prev.winnerIds, cardId]
     }));
     
     setLatestWinner({ name: playerName, cardIndex: 0 }); 
     setTimeout(() => setLatestWinner(null), 6000); 

     if(soundEnabled) {
       const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3'); 
       audio.volume = 0.8;
       audio.play().catch(() => {});
     }
     
     broadcast({ type: 'BINGO_ANNOUNCED', payload: { playerIndex, cardId } });
     addNotification(`🎉 ${playerName} called BINGO!`);
  };

  useEffect(() => {
    const customId = Math.random().toString(36).slice(2, 10).padEnd(8, 'X').toUpperCase();
    
    const peer = new Peer(customId, { debug: 1 });
    
    peer.on('open', (id) => {
      setRoomCode(id);
    });

    peer.on('error', (err: any) => {
        if (err.type === 'unavailable-id') {
            addNotification("Room Code collision. Please reload.");
        } else if (err.type === 'peer-unavailable') {
        } else {
             addNotification(`Connection Error: ${err.type}`);
        }
    });

    peer.on('call', (call) => {
        call.answer(localStreamRef.current || undefined);
        call.on('stream', (remoteStream) => {
            setRemoteStreams(prev => new Map(prev).set(call.peer, remoteStream));
        });
        call.on('close', () => {
             setRemoteStreams(prev => {
                 const newMap = new Map(prev);
                 newMap.delete(call.peer);
                 return newMap;
             });
        });
    });

    peer.on('connection', (conn) => {
      conn.on('data', (data: any) => {
        const msg = data as NetworkMessage;

        if (msg.type === 'JOIN_REQUEST') {
           const { playerName } = msg.payload as JoinRequestPayload;
           const currentGameState = gameStateRef.current;
           
           playerMapRef.current.set(conn.peer, playerName);

           const existingPlayerCard = currentGameState.cards.find(c => c.playerName.toLowerCase() === playerName.toLowerCase());
           let targetIndex: number;
           let cardsToSend: BingoCard[];

           if (existingPlayerCard) {
               targetIndex = existingPlayerCard.ownerIndex;
               cardsToSend = currentGameState.cards.filter(c => c.ownerIndex === targetIndex);
               addNotification(`${playerName} reconnected!`);
           } else {
               const usedIndices = new Set<number>(currentGameState.cards.map(c => c.ownerIndex));
               targetIndex = 0;
               while(usedIndices.has(targetIndex)) targetIndex++;

               cardsToSend = generateCards(currentGameState.allItems, currentGameState.mode, [playerName], targetIndex);
               
               setGameState(prev => ({
                   ...prev,
                   cards: [...prev.cards, ...cardsToSend]
               }));
               addNotification(`${playerName} joined the party!`);
           }

           connectionsRef.current.push(conn);

           const welcomeMsg: NetworkMessage = {
             type: 'WELCOME',
             payload: {
               playerIndex: targetIndex,
               playerName: playerName,
               cards: cardsToSend,
               theme: currentGameState.theme,
               prize: currentGameState.prize,
               currentCall: currentGameState.currentCall,
               calledItems: currentGameState.calledItems,
               winPatterns: currentGameState.winPatterns
             } as WelcomePayload
           };
           conn.send(welcomeMsg);

        } else if (msg.type === 'CLAIM_BINGO') {
          const { cardId, playerIndex } = msg.payload;
          const currentGameState = gameStateRef.current;
          
          const card = currentGameState.cards.find(c => c.id === cardId);
          if (card) {
            const verifiedCells = card.cells.map(cell => ({
               ...cell,
               marked: cell.isFreeSpace || currentGameState.calledItems.includes(cell.value)
            }));
            
            if (checkPatternMatch(verifiedCells, currentGameState.winPatterns)) {
               if (!currentGameState.winnerIds.includes(cardId)) {
                   announceWinner(card.playerName, cardId, playerIndex);
               }
            } else {
               addNotification(`⚠️ ${card.playerName} called a false Bingo!`);
            }
          }
        } else if (msg.type === 'CHAT_MESSAGE') {
            const chatPayload = msg.payload as ChatMessagePayload;
            setChatMessages(prev => [...prev, chatPayload]);
            connectionsRef.current.forEach(c => {
                if (c.open && c.peer !== conn.peer) {
                    c.send(msg);
                }
            });
        }
      });
    });

    peerRef.current = peer;
    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const uniqueOwnerIndices = Array.from(new Set<number>(gameState.cards.map(c => c.ownerIndex))).sort((a,b) => a-b);
  const playersList = uniqueOwnerIndices.map(index => {
    const cards = gameState.cards.filter(c => c.ownerIndex === index);
    return {
      index: index,
      name: cards[0]?.playerName || `Player ${index + 1}`,
      cards: cards,
      connected: true 
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

  useEffect(() => {
    const updatedCards = gameState.cards.map(card => {
       const hasBingo = checkPatternMatch(card.cells, gameState.winPatterns);
       return { ...card, hasBingo };
    });
    const hasChanges = JSON.stringify(updatedCards.map(c => c.hasBingo)) !== JSON.stringify(gameState.cards.map(c => c.hasBingo));
    if (hasChanges) {
        setGameState(prev => ({ ...prev, cards: updatedCards }));
    }
  }, [gameState.cards, gameState.calledItems, gameState.winPatterns]); 

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
    broadcast({ type: 'NEXT_CALL', payload: nextItem });
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

  const handleHostClaimBingo = () => {
      if (!confirmingBingoCardId) return;
      const card = gameState.cards.find(c => c.id === confirmingBingoCardId);
      if (card && card.hasBingo) {
          announceWinner(card.playerName, card.id, card.ownerIndex);
      }
      setConfirmingBingoCardId(null);
  };

  const startNewRound = (mode: GameMode, items: (string | number)[], themeName: string, prize: string, hostName: string, winPatterns: number[][]) => {
      const newCards: BingoCard[] = [];
      const currentCards = gameState.cards;
      
      const uniquePlayers = Array.from(new Set<number>(currentCards.map(c => c.ownerIndex)))
          .map(idx => {
             if (idx === 0) return { index: 0, name: hostName };
             return { index: idx, name: currentCards.find(c => c.ownerIndex === idx)?.playerName || 'Player' }
          });

      const newState: GameState = {
          isSetup: false,
          mode,
          theme: themeName,
          prize,
          allItems: items,
          calledItems: [],
          currentCall: null,
          cards: [], 
          winnerIds: [],
          winPatterns
      };
      
      uniquePlayers.forEach(p => {
         const playerCards = generateCards(items, mode, [p.name], p.index);
         newCards.push(...playerCards);
      });
      
      newState.cards = newCards;
      setGameState(newState);
      setIsAutoCalling(false); // Reset auto call
      setShowSetupModal(false);
      setLatestWinner(null);
      setConfirmingBingoCardId(null);
      addNotification("New Round Started!");

      broadcast({ type: 'GAME_RESET', payload: null });
  };

  const copyRoomLink = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      alert("Room Code copied to clipboard!");
    }
  };

  const totalBingos = gameState.winnerIds.length;
  const isViewingHost = activePlayer && activePlayer.index === 0;
  const hostWinningCard = isViewingHost ? activePlayer.cards.find(c => c.hasBingo && !gameState.winnerIds.includes(c.id)) : null;

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative">
      <ChatPanel 
        messages={chatMessages} 
        onSendMessage={handleSendChat} 
        currentUser="HOST" 
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
      />

      {confirmingBingoCardId && (
           <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
               <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                   <h3 className="text-2xl font-black text-slate-800 mb-2">Host Bingo?</h3>
                   <p className="text-slate-500 mb-6">Confirm you have a winner!</p>
                   <div className="flex gap-3">
                       <button onClick={() => setConfirmingBingoCardId(null)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-2"><XCircle className="w-5 h-5"/> Cancel</button>
                       <button onClick={handleHostClaimBingo} className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-200"><Megaphone className="w-5 h-5"/> SCREAM IT!</button>
                   </div>
               </div>
           </div>
       )}

      {latestWinner && (
         <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
             <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-fade-in"></div>
             <div className="relative bg-white border-4 border-yellow-400 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-bounce-in text-center mx-4">
                 <div className="bg-yellow-100 p-6 rounded-full">
                    <PartyPopper className="w-16 h-16 text-yellow-600 animate-pulse" />
                 </div>
                 <div>
                    <h2 className="text-4xl font-black text-slate-800 uppercase tracking-widest">BINGO!</h2>
                    <p className="text-xl text-slate-500 font-bold mt-2">Winner Announced</p>
                 </div>
                 <div className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-2xl shadow-lg transform -rotate-2">
                    {latestWinner.name}
                 </div>
             </div>
         </div>
      )}

      {showSetupModal && (
          <div className="absolute inset-0 z-50 bg-slate-50 overflow-y-auto">
              <div className="max-w-4xl mx-auto pt-10">
                  <div className="flex justify-between items-center px-6 mb-4">
                     <h2 className="text-2xl font-black text-slate-800">Start Next Round</h2>
                     <button onClick={() => setShowSetupModal(false)} className="p-2 hover:bg-slate-200 rounded-full">
                         <X className="w-6 h-6" />
                     </button>
                  </div>
                  <GameSetup onStartGame={startNewRound} />
              </div>
          </div>
      )}

      <div className="fixed top-24 right-4 z-50 flex flex-col gap-2 pointer-events-none">
          {notifications.map((note, idx) => (
              <div key={idx} className="bg-slate-800 text-white px-4 py-3 rounded-lg shadow-xl animate-fade-in flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-yellow-400" />
                  {note}
              </div>
          ))}
      </div>

      <header className="bg-white border-b border-slate-200 p-2 md:p-4 shadow-sm z-20 flex-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-3 md:gap-4">
          
          {/* Top Row: Room Code & Call Controls */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-start">
             <div className="flex items-center gap-3">
                 <button onClick={copyRoomLink} className="flex flex-col items-start" title="Click to Copy Room Code">
                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <Link className="w-3 h-3"/> Room Code
                    </div>
                    <div className="font-mono font-bold text-xl leading-none text-slate-800 flex items-center gap-2">
                        {roomCode || '...'} <Copy className="w-3 h-3 text-slate-400" />
                    </div>
                 </button>
                 
                 <div className="h-8 w-px bg-slate-200 mx-1"></div>

                 {/* Current Call Display */}
                 <div className="bg-slate-900 text-white rounded-lg px-3 py-1 text-center min-w-[90px] shadow-md">
                    <div className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Current</div>
                    <div className="text-2xl font-black leading-none flex items-center justify-center gap-1">
                        {currentDisplay.letter && <span className="text-blue-400 text-lg">{currentDisplay.letter}</span>}
                        <span>{currentDisplay.main}</span>
                    </div>
                 </div>
             </div>

             {/* Controls Group */}
             <div className="flex items-center gap-2 ml-auto md:ml-0">
                 {/* Target Pattern Icon (Mobile Compact) */}
                 <div className="bg-slate-100 p-1.5 rounded border border-slate-200" title="Target Pattern">
                     <div className="grid grid-cols-5 gap-px w-5 h-5">
                         {Array.from({length: 25}).map((_, i) => (
                             <div key={i} className={`w-full h-full rounded-[1px] ${checkPatternMatch([{id:'', value:'', marked:true, isFreeSpace:false}], [gameState.winPatterns.map(p => p.includes(i) ? 0 : -1).filter(idx => idx !== -1)]) || gameState.winPatterns.some(p => p.includes(i)) ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                         ))}
                     </div>
                 </div>

                 <button 
                    onClick={() => setIsAutoCalling(!isAutoCalling)}
                    className={`p-2 rounded-lg font-bold flex items-center gap-1 transition-all ${isAutoCalling ? 'bg-green-500 text-white shadow' : 'bg-white text-slate-600 border border-slate-200'}`}
                 >
                     {isAutoCalling ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                 </button>
                 
                 <button 
                  onClick={callNextNumber}
                  disabled={isAutoCalling}
                  className="bg-blue-600 active:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  <Play className="w-5 h-5 fill-white" /> <span className="hidden sm:inline">Next</span>
                </button>
             </div>
          </div>

          {/* Bottom/Side Row: History & Tools */}
          <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 hide-scrollbar border-t md:border-t-0 border-slate-100 pt-2 md:pt-0">
             <div className="text-[10px] font-bold text-slate-400 uppercase mr-1">History</div>
             {gameState.calledItems.slice(1, 6).map((item, idx) => (
                <div key={idx} className="bg-slate-100 text-slate-500 rounded px-2 py-1 text-xs font-bold whitespace-nowrap border border-slate-200">
                    {item}
                </div>
             ))}
             
             <div className="ml-auto flex gap-2 pl-2 border-l border-slate-200">
               {playersList.length > 0 && (
                   <button onClick={() => setViewMode(viewMode === 'FOCUS' ? 'ALL' : 'FOCUS')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg" title="Toggle View">
                     {viewMode === 'FOCUS' ? <LayoutGrid className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                   </button>
               )}
               <button onClick={() => setShowSetupModal(true)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg" title="New Round">
                 <RefreshCw className="w-5 h-5" />
               </button>
               <button onClick={onExit} className="p-2 text-red-400 hover:bg-red-50 rounded-lg" title="Exit Game">
                 <XCircle className="w-5 h-5" />
               </button>
             </div>
          </div>
        </div>
      </header>
      
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center py-1 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-inner">
         <Gift className="w-3 h-3 sm:w-4 sm:h-4" /> PRIZE: <span className="text-yellow-300 truncate max-w-[200px]">{gameState.prize}</span>
      </div>

      <main className="flex-1 overflow-y-auto bg-slate-50 relative p-2 md:p-4 flex gap-4">
         {/* Live Video Sidebar for Host (Hidden on mobile if not active, or stacked) */}
         <div className="hidden lg:flex flex-col gap-4 w-64 flex-none sticky top-0 h-fit">
            <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 text-white p-2 text-xs font-bold flex justify-between items-center">
                    <span>HOST LIVE CAM</span>
                    <button onClick={toggleMedia} className={`p-1 rounded ${isVideoEnabled ? 'bg-red-500' : 'bg-slate-700'}`}>
                        {isVideoEnabled ? <Video className="w-3 h-3"/> : <VideoOff className="w-3 h-3"/>}
                    </button>
                </div>
                <div className="aspect-video bg-slate-900 relative flex items-center justify-center">
                    {localStream ? (
                        <video ref={v => { if(v) v.srcObject = localStream }} autoPlay muted playsInline className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-slate-500 text-xs text-center p-4">Camera Off</div>
                    )}
                </div>
            </div>

            {/* Remote Streams Grid */}
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
                <div key={peerId} className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="bg-slate-100 p-2 text-[10px] font-bold text-slate-500 truncate">
                        {playerMapRef.current.get(peerId) || "Player"}
                    </div>
                    <div className="aspect-video bg-slate-900">
                        <video ref={v => { if(v) v.srcObject = stream }} autoPlay playsInline className="w-full h-full object-cover" />
                    </div>
                </div>
            ))}
         </div>

         {/* Main Board Area */}
         <div className="flex-1 flex flex-col items-center">
            {totalBingos > 0 && (
            <div className="fixed top-32 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-full flex justify-center">
                <div className="bg-yellow-400 text-yellow-900 border-4 border-yellow-500 px-6 py-2 rounded-full font-black text-xl shadow-xl flex items-center gap-2 animate-bounce">
                    <Trophy className="w-6 h-6" /> {totalBingos} Card{totalBingos !== 1 && 's'} Won!
                </div>
            </div>
            )}

            {hostWinningCard && !confirmingBingoCardId && (
                <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-bounce">
                    <button onClick={() => setConfirmingBingoCardId(hostWinningCard.id)} className="bg-red-600 text-white border-4 border-red-800 rounded-full px-8 py-4 font-black text-2xl shadow-2xl flex items-center gap-3 hover:bg-red-700 hover:scale-105 transition-all">
                    <Megaphone className="w-8 h-8" /> HOST BINGO!
                    </button>
                </div>
            )}
            
            {playersList.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                    <div className="bg-slate-100 p-8 rounded-full mb-4 animate-pulse">
                        <UserPlus className="w-20 h-20 text-slate-300" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-center">Waiting for players...</h2>
                    <p className="text-center px-4">Share Room Code: <span className="font-mono font-bold text-slate-600 text-xl block sm:inline">{roomCode}</span></p>
                </div>
            ) : (
                viewMode === 'FOCUS' ? (
                <div className="w-full max-w-xl flex flex-col h-full">
                    {/* Pagination */}
                    <div className="flex items-center justify-between gap-2 mb-4 sticky top-0 z-10 py-2 bg-slate-50/95 backdrop-blur-sm">
                        <button onClick={() => setCurrentPlayerIndex(prev => Math.max(0, prev - 1))} disabled={currentPlayerIndex === 0} className="p-2 bg-white rounded-lg shadow border disabled:opacity-30">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        
                        {activePlayer && (
                            <div className="flex-1 text-center bg-white px-2 py-1.5 rounded-lg shadow-sm border border-slate-200 min-w-0">
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">
                                    Player {currentPlayerIndex + 1}/{playersList.length}
                                </div>
                                <div className="text-lg font-black text-slate-800 truncate leading-none pb-0.5">{activePlayer.name}</div>
                            </div>
                        )}
        
                        <button onClick={() => setCurrentPlayerIndex(prev => Math.min(playersList.length - 1, prev + 1))} disabled={currentPlayerIndex >= playersList.length - 1} className="p-2 bg-white rounded-lg shadow border disabled:opacity-30">
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {activePlayer && (
                        <div className="space-y-6 pb-20">
                            {activePlayer.cards.map((card, idx) => (
                                <div key={card.id}>
                                    <div className="text-xs font-bold text-slate-400 mb-1 pl-1">Card #{idx + 1}</div>
                                    <BingoBoard card={card} onCellClick={(cellId) => handleCellClick(card.id, cellId)} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                ) : (
                <div className="w-full max-w-7xl">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-700">All Players Overview ({playersList.length})</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        {playersList.map((player, idx) => {
                        const playerWins = player.cards.filter(c => c.hasBingo).length;
                        return (
                            <button key={player.index} onClick={() => { setCurrentPlayerIndex(idx); setViewMode('FOCUS'); }} className={`p-3 rounded-xl border-2 text-left transition-all hover:scale-[1.02] relative ${playerWins > 0 ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                            {player.connected && <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full" title="Connected"></div>}
                            <div className="font-bold text-sm truncate pr-2 mb-2">
                                {player.name}
                                {player.index === 0 && <span className="block text-[9px] text-blue-500 uppercase">HOST</span>}
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                                {player.cards.map(c => (
                                <div key={c.id} className={`h-6 rounded flex items-center justify-center text-[10px] font-bold ${c.hasBingo ? 'bg-yellow-400 text-yellow-900' : 'bg-slate-100 text-slate-400'}`}>
                                    {c.hasBingo ? 'WIN' : `#${c.cardIndex+1}`}
                                </div>
                                ))}
                            </div>
                            </button>
                        );
                        })}
                    </div>
                </div>
                )
            )}
         </div>
      </main>
    </div>
  );
};

export default ActiveGame;