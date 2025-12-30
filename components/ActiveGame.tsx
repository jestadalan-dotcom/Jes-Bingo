import React, { useState, useEffect, useRef } from 'react';
import { GameState, BingoCard, NetworkMessage, WelcomePayload, BingoCell, GameMode, JoinRequestPayload, ChatMessagePayload } from '../types';
import BingoBoard from './BingoBoard';
import GameSetup from './GameSetup';
import ChatPanel from './ChatPanel';
import { generateCards } from '../gameUtils';
import { RefreshCw, Play, Users, Trophy, LayoutGrid, ChevronLeft, ChevronRight, Volume2, VolumeX, Link, Copy, BellRing, Gift, X, UserPlus, PartyPopper, Megaphone, XCircle, Video, VideoOff, Mic, MicOff } from 'lucide-react';
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
  
  // Networking State
  const [roomCode, setRoomCode] = useState<string | null>(null);
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Video/Audio State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(false);
  
  const connectionsRef = useRef<DataConnection[]>([]);
  const peerRef = useRef<Peer | null>(null);
  const playerMapRef = useRef<Map<string, string>>(new Map()); // PeerID -> PlayerName

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

  // Chat Handler
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

  // Video Handlers
  const toggleMedia = async () => {
     if (localStream) {
         // Stop
         localStream.getTracks().forEach(track => track.stop());
         setLocalStream(null);
         setIsVideoEnabled(false);
         setIsMicEnabled(false);
     } else {
         try {
             const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
    const customId = Math.random().toString(36).substring(2, 10).toUpperCase();
    const peer = new Peer(customId);
    
    peer.on('open', (id) => {
      console.log('Host ID:', id);
      setRoomCode(id);
    });

    peer.on('error', (err: any) => {
        console.error("Peer Error", err);
        if (err.type === 'unavailable-id') {
            addNotification("Room Code error. Please reload.");
        }
    });

    peer.on('call', (call) => {
        // Player calling Host
        // Answer automatically if we are "Live"? Or just answer to receive their stream?
        // We answer with our stream if available, or null (peerjs might require stream)
        // If we don't have a stream, we can pass a dummy or just answer().
        
        // Use current localStream or empty
        // Note: call.answer(stream)
        call.answer(localStream || undefined);
        
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
               const usedIndices = new Set(currentGameState.cards.map(c => c.ownerIndex));
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
               calledItems: currentGameState.calledItems
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
            
            if (checkForWin(verifiedCells)) {
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
            // Re-broadcast to all others
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
      // Clean up media
      localStream?.getTracks().forEach(t => t.stop());
      peer.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  // Update local stream in active calls if it changes?
  // PeerJS logic: if we change stream, we might need to call again or replace track.
  // For simplicity: Players call Host. If Host starts stream LATER, PeerJS MediaConnection.answer(stream)
  // only works once at start of call.
  // We need a mechanism for players to "Subscribe" to media.
  // Simpler: Host starts media. Players see "Host is Live" and click "Join Stream".

  const checkForWin = (cells: BingoCell[]) => {
      for (let i = 0; i < 5; i++) {
        if (cells.slice(i * 5, (i + 1) * 5).every(c => c.marked)) return true;
      }
      for (let i = 0; i < 5; i++) {
        let colComplete = true;
        for (let j = 0; j < 5; j++) {
          if (!cells[i + j * 5].marked) colComplete = false;
        }
        if (colComplete) return true;
      }
      if ([0, 6, 12, 18, 24].every(idx => cells[idx].marked)) return true;
      if ([4, 8, 12, 16, 20].every(idx => cells[idx].marked)) return true;
      
      return false;
  };

  const uniqueOwnerIndices = Array.from(new Set(gameState.cards.map(c => c.ownerIndex))).sort((a,b) => a-b);
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
       const hasLine = checkForWin(card.cells);
       return { ...card, hasBingo: hasLine };
    });
    const hasChanges = JSON.stringify(updatedCards.map(c => c.hasBingo)) !== JSON.stringify(gameState.cards.map(c => c.hasBingo));
    if (hasChanges) {
        setGameState(prev => ({ ...prev, cards: updatedCards }));
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

  const startNewRound = (mode: GameMode, items: (string | number)[], themeName: string, prize: string, hostName: string) => {
      const newCards: BingoCard[] = [];
      const currentCards = gameState.cards;
      
      const uniquePlayers = Array.from(new Set(currentCards.map(c => c.ownerIndex)))
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
          winnerIds: []
      };
      
      uniquePlayers.forEach(p => {
         const playerCards = generateCards(items, mode, [p.name], p.index);
         newCards.push(...playerCards);
      });
      
      newState.cards = newCards;
      setGameState(newState);
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

      <header className="bg-white border-b border-slate-200 p-3 md:p-4 shadow-sm z-20 flex-none">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <div className="flex flex-col">
               <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                  <Link className="w-3 h-3"/> Room Code
               </div>
               <button onClick={copyRoomLink} className="flex items-center gap-2 font-mono font-bold text-2xl hover:text-blue-600 transition-colors" title="Click to Copy">
                 {roomCode ? <>{roomCode} <Copy className="w-4 h-4 text-slate-400" /></> : <span className="animate-pulse text-lg">Connecting...</span>}
               </button>
            </div>
            <div className="w-px h-10 bg-slate-200 hidden md:block"></div>
            <div className="bg-slate-900 text-white rounded-lg px-4 py-2 text-center min-w-[110px] md:min-w-[140px] shadow-md ring-2 ring-slate-100">
              <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold tracking-wider mb-0.5">Current Call</div>
              <div className="text-2xl md:text-3xl font-black truncate max-w-[180px] flex items-center justify-center gap-1" title={String(gameState.currentCall || '-')}>
                 {currentDisplay.letter && <span className="text-blue-400 text-lg md:text-2xl align-top self-center">{currentDisplay.letter}</span>}
                 <span>{currentDisplay.main}</span>
              </div>
            </div>
            <div className="flex gap-2">
               <button onClick={callNextNumber} className="bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2 rounded-lg font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all">
                <Play className="w-5 h-5" /> <span className="hidden sm:inline">Next</span>
              </button>
              <button onClick={() => setSoundEnabled(!soundEnabled)} className={`p-2 rounded-lg border ${soundEnabled ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-100 border-slate-200 text-slate-400'}`} title={soundEnabled ? "Mute Sound" : "Enable Sound"}>
                 {soundEnabled ? <Volume2 className="w-5 h-5"/> : <VolumeX className="w-5 h-5"/>}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 hide-scrollbar">
             {gameState.calledItems.slice(1, 6).map((item, idx) => (
                <div key={idx} className="bg-slate-100 text-slate-500 rounded px-3 py-1 text-sm font-medium whitespace-nowrap border border-slate-200">
                    {item}
                </div>
             ))}
             <div className="ml-auto flex gap-2 pl-2">
               {playersList.length > 0 && (
                   <button onClick={() => setViewMode(viewMode === 'FOCUS' ? 'ALL' : 'FOCUS')} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg flex items-center gap-1" title="Toggle View">
                     {viewMode === 'FOCUS' ? <LayoutGrid className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                   </button>
               )}
               <button onClick={() => setShowSetupModal(true)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg font-bold flex items-center gap-1 text-xs uppercase" title="New Round">
                 <RefreshCw className="w-4 h-4" /> New Round
               </button>
               <button onClick={onExit} className="p-2 text-red-400 hover:bg-red-50 rounded-lg text-xs" title="Exit Game">Exit</button>
             </div>
          </div>
        </div>
      </header>
      
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white text-center py-1 text-sm font-bold flex items-center justify-center gap-2 shadow-inner">
         <Gift className="w-4 h-4" /> PRIZE: <span className="text-yellow-300">{gameState.prize}</span>
      </div>

      <main className="flex-1 overflow-y-auto bg-slate-50 relative p-4 flex gap-4">
         {/* Live Video Sidebar for Host */}
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
         <div className="flex-1">
            {totalBingos > 0 && (
            <div className="fixed top-32 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                <div className="bg-yellow-400 text-yellow-900 border-4 border-yellow-500 px-6 py-2 rounded-full font-black text-xl shadow-xl flex items-center gap-2 animate-bounce">
                    <Trophy className="w-6 h-6" /> {totalBingos} Card{totalBingos !== 1 && 's'} Won!
                </div>
            </div>
            )}

            {hostWinningCard && !confirmingBingoCardId && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-bounce">
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
                    <h2 className="text-2xl font-bold mb-2">Waiting for players to join...</h2>
                    <p>Share the Room Code: <span className="font-mono font-bold text-slate-600">{roomCode}</span></p>
                </div>
            ) : (
                viewMode === 'FOCUS' ? (
                <div className="max-w-7xl mx-auto flex flex-col h-full">
                    <div className="flex items-center justify-center gap-4 mb-4 md:mb-6 sticky top-0 z-10 py-2 bg-slate-50/90 backdrop-blur-sm">
                        <button onClick={() => setCurrentPlayerIndex(prev => Math.max(0, prev - 1))} disabled={currentPlayerIndex === 0} className="p-3 bg-white rounded-full shadow-md border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        
                        {activePlayer && (
                            <div className="text-center min-w-[200px] bg-white px-6 py-2 rounded-xl shadow-sm border border-slate-200">
                                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center justify-center gap-2">
                                    Viewing Player {currentPlayerIndex + 1}/{playersList.length}
                                    {activePlayer.index === 0 && <span className="bg-blue-100 text-blue-600 px-1.5 rounded text-[10px]">HOST (YOU)</span>}
                                    {activePlayer.connected ? <span className="w-2 h-2 rounded-full bg-green-500"></span> : <span className="w-2 h-2 rounded-full bg-slate-300"></span>}
                                </div>
                                <div className="text-xl md:text-2xl font-black text-slate-800 truncate">{activePlayer.name}</div>
                            </div>
                        )}
        
                        <button onClick={() => setCurrentPlayerIndex(prev => Math.min(playersList.length - 1, prev + 1))} disabled={currentPlayerIndex >= playersList.length - 1} className="p-3 bg-white rounded-full shadow-md border hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                            <ChevronRight className="w-6 h-6" />
                        </button>
                    </div>
                    
                    {activePlayer && (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-2 gap-4 md:gap-8 pb-10 justify-items-center">
                        {activePlayer.cards.map((card, idx) => (
                            <div key={card.id} className="w-full max-w-[400px]">
                            <div className="text-xs font-bold text-slate-400 mb-1 pl-1">Card #{idx + 1}</div>
                            <BingoBoard card={card} onCellClick={(cellId) => handleCellClick(card.id, cellId)} />
                            </div>
                        ))}
                        </div>
                    )}
                </div>
                ) : (
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-6">
                        <h2 className="text-2xl font-bold text-slate-700">All Players Overview ({playersList.length})</h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                        {playersList.map((player, idx) => {
                        const playerWins = player.cards.filter(c => c.hasBingo).length;
                        return (
                            <button key={player.index} onClick={() => { setCurrentPlayerIndex(idx); setViewMode('FOCUS'); }} className={`p-4 rounded-xl border-2 text-left transition-all hover:scale-[1.02] relative ${playerWins > 0 ? 'bg-yellow-50 border-yellow-400' : 'bg-white border-slate-200 hover:border-blue-300'}`}>
                            {player.connected && <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full ring-2 ring-white" title="Connected"></div>}
                            <div className="flex justify-between items-start mb-2">
                                <div className="font-bold text-lg truncate pr-2 flex flex-col">
                                    {player.name}
                                    {player.index === 0 && <span className="text-[10px] text-blue-500 uppercase">HOST (YOU)</span>}
                                </div>
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
                )
            )}
         </div>
      </main>
    </div>
  );
};

export default ActiveGame;