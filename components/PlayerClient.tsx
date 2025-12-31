import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection, MediaConnection } from 'peerjs';
import { BingoCard, NetworkMessage, WelcomePayload, BingoCell, JoinRequestPayload, ChatMessagePayload } from '../types';
import BingoBoard from './BingoBoard';
import ChatPanel from './ChatPanel';
import { Loader2, Wifi, WifiOff, Trophy, AlertCircle, Megaphone, Gift, User, CheckCircle2, XCircle, PartyPopper, Video, VideoOff, Zap, Grid3X3 } from 'lucide-react';
import { checkPatternMatch } from '../gameUtils';

interface PlayerClientProps {
  onBack: () => void;
}

const PlayerClient: React.FC<PlayerClientProps> = ({ onBack }) => {
  const [roomId, setRoomId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [status, setStatus] = useState<'IDLE' | 'CONNECTING' | 'WAITING_FOR_HOST' | 'CONNECTED' | 'ERROR'>('IDLE');
  const [errorMsg, setErrorMsg] = useState('');
  
  // Game Data
  const [cards, setCards] = useState<BingoCard[]>([]);
  const [playerIndex, setPlayerIndex] = useState<number | null>(null);
  const [theme, setTheme] = useState('');
  const [prize, setPrize] = useState('');
  const [currentCall, setCurrentCall] = useState<string | number | null>(null);
  const [calledItems, setCalledItems] = useState<(string|number)[]>([]);
  const [lastCall, setLastCall] = useState<string | number | null>(null);
  const [announcedWinners, setAnnouncedWinners] = useState<string[]>([]);
  const [winPatterns, setWinPatterns] = useState<number[][]>([]);
  
  // UI State
  const [confirmingBingoCardId, setConfirmingBingoCardId] = useState<string | null>(null);
  const [winnerAnnouncement, setWinnerAnnouncement] = useState<string | null>(null);
  
  // Auto-Play State
  const [isAutoMark, setIsAutoMark] = useState(true);

  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessagePayload[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Video State
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null); // Host's stream
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const callRef = useRef<MediaConnection | null>(null);

  const connectToRoom = () => {
    const cleanRoomId = roomId.trim().toUpperCase();
    const cleanName = playerName.trim();
    
    if (!cleanRoomId || !cleanName) return;
    setStatus('CONNECTING');
    setErrorMsg('');
    
    const peer = new Peer({ debug: 1 });
    peerRef.current = peer;

    peer.on('open', (myId) => {
      const conn = peer.connect(cleanRoomId, { reliable: true });
      connRef.current = conn;

      const timeout = setTimeout(() => {
          if (status !== 'CONNECTED' && status !== 'WAITING_FOR_HOST' && status !== 'ERROR') {
             setErrorMsg("Connection timed out. Host may be offline.");
             setStatus('ERROR');
          }
      }, 10000);

      conn.on('open', () => {
        clearTimeout(timeout);
        setStatus('WAITING_FOR_HOST');
        setErrorMsg('');
        const joinMsg: NetworkMessage = {
            type: 'JOIN_REQUEST',
            payload: { playerName: cleanName } as JoinRequestPayload
        };
        conn.send(joinMsg);
      });

      conn.on('data', (data: any) => {
        const msg = data as NetworkMessage;
        handleMessage(msg);
      });

      conn.on('error', (err) => {
        console.error("Conn Error", err);
        setStatus('ERROR');
        setErrorMsg('Connection lost.');
      });
      
      conn.on('close', () => {
          setStatus('ERROR');
          setErrorMsg('Host ended the session.');
      });
    });

    peer.on('error', (err: any) => {
      console.error("Peer Error", err);
      if (err.type === 'peer-unavailable') {
         setErrorMsg(`Room "${cleanRoomId}" not found. Check the code.`);
      } else if (err.type === 'unavailable-id') {
         setErrorMsg("ID Collision. Please retry.");
      } else {
         setErrorMsg(`Connection Error: ${err.type}`);
      }
      setStatus('ERROR');
    });
  };

  const handleMessage = (msg: NetworkMessage) => {
    if (msg.type === 'WELCOME') {
      const payload = msg.payload as WelcomePayload;
      setCards(payload.cards);
      setPlayerIndex(payload.playerIndex);
      setTheme(payload.theme);
      setPrize(payload.prize);
      setCalledItems(payload.calledItems);
      setWinPatterns(payload.winPatterns);
      if (payload.currentCall) {
          setCurrentCall(payload.currentCall);
          setLastCall(payload.currentCall);
      }
      setStatus('CONNECTED');
    } else if (msg.type === 'NEW_GAME') {
      const payload = msg.payload as WelcomePayload;
      setCards(payload.cards);
      setTheme(payload.theme);
      setPrize(payload.prize);
      setCalledItems([]);
      setWinPatterns(payload.winPatterns);
      setCurrentCall(null);
      setLastCall(null);
      setAnnouncedWinners([]);
      setWinnerAnnouncement(null);
      setConfirmingBingoCardId(null);
    } else if (msg.type === 'GAME_RESET') {
        if (connRef.current && playerName) {
            setCards([]);
            setCurrentCall(null);
            setLastCall(null);
            setAnnouncedWinners([]);
            setWinnerAnnouncement(null);
            setConfirmingBingoCardId(null);
            const joinMsg: NetworkMessage = {
                type: 'JOIN_REQUEST',
                payload: { playerName } as JoinRequestPayload
            };
            connRef.current.send(joinMsg);
        }
    } else if (msg.type === 'NEXT_CALL') {
      const val = msg.payload;
      setCurrentCall(val);
      setLastCall(val);
      setCalledItems(prev => [val, ...prev]);
    } else if (msg.type === 'BINGO_ANNOUNCED') {
      const { playerIndex: winnerIdx, cardId } = msg.payload;
      setAnnouncedWinners(prev => [...prev, cardId]);
      const winningCard = cards.find(c => c.id === cardId);
      if (winningCard) {
          setWinnerAnnouncement(`YOU WON!`);
      } else {
          setWinnerAnnouncement(`BINGO CLAIMED!`);
      }
      setTimeout(() => setWinnerAnnouncement(null), 5000);
    } else if (msg.type === 'CHAT_MESSAGE') {
        setChatMessages(prev => [...prev, msg.payload]);
    }
  };

  const handleSendChat = (text: string) => {
      const msg: ChatMessagePayload = {
          id: Date.now().toString(),
          sender: playerName,
          text,
          timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, msg]);
      if (connRef.current) {
          connRef.current.send({ type: 'CHAT_MESSAGE', payload: msg });
      }
  };

  const toggleCall = async () => {
      if (isCallActive) {
          // End Call
          callRef.current?.close();
          localStream?.getTracks().forEach(t => t.stop());
          setLocalStream(null);
          setRemoteStream(null);
          setIsCallActive(false);
          setIsVideoEnabled(false);
      } else {
          // Start Call
          try {
              const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              setLocalStream(stream);
              setIsVideoEnabled(true);
              setIsCallActive(true);

              if (peerRef.current) {
                  const call = peerRef.current.call(roomId.trim().toUpperCase(), stream);
                  callRef.current = call;
                  
                  call.on('stream', (hostStream) => {
                      setRemoteStream(hostStream);
                  });
                  call.on('close', () => {
                      setIsCallActive(false);
                      setRemoteStream(null);
                  });
              }
          } catch (e) {
              console.error(e);
              alert("Could not access camera/mic.");
          }
      }
  };

  // Local marking logic
  const updateCardsWithMark = (itemToMark: string | number) => {
      setCards(prevCards => {
        return prevCards.map(card => {
          const updatedCells = card.cells.map(cell => {
             if (cell.value === itemToMark) return { ...cell, marked: true };
             return cell;
          });
          
          const hasBingo = checkPatternMatch(updatedCells, winPatterns);
          return { ...card, cells: updatedCells, hasBingo };
        });
      });
  };

  // Auto-Mark Effect
  useEffect(() => {
     if (isAutoMark && currentCall) {
         updateCardsWithMark(currentCall);
     }
  }, [currentCall, isAutoMark, winPatterns]);

  const handleCellClick = (cardId: string, cellId: string) => {
    // Manual Toggle logic overrides auto-mark if user clicks
    setCards(prevCards => {
      const updatedCards = prevCards.map(card => {
        if (card.id !== cardId) return card;
        const updatedCells = card.cells.map(cell => {
          if (cell.id !== cellId) return cell;
          return { ...cell, marked: !cell.marked };
        });
        
        const hasBingo = checkPatternMatch(updatedCells, winPatterns);
        return { ...card, cells: updatedCells, hasBingo };
      });
      return updatedCards;
    });
  };
  
  const initiateBingoCall = (cardId: string) => setConfirmingBingoCardId(cardId);
  
  const confirmBingo = () => {
    if (connRef.current && confirmingBingoCardId) {
      connRef.current.send({
        type: 'CLAIM_BINGO',
        payload: { cardId: confirmingBingoCardId, playerIndex }
      });
      setConfirmingBingoCardId(null);
    }
  };
  
  const cancelBingo = () => setConfirmingBingoCardId(null);
  const winningCard = cards.find(c => c.hasBingo && !announcedWinners.includes(c.id));

  if (status !== 'CONNECTED') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
           <div className="text-center mb-6">
             <h2 className="text-2xl font-black text-slate-800">Join Party</h2>
             <p className="text-slate-500">Enter the Room Code from the host screen</p>
           </div>
           
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Your Name</label>
               <div className="relative">
                 <User className="absolute left-3 top-3.5 text-slate-400 w-5 h-5" />
                 <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-purple-500 outline-none" placeholder="Enter your name"/>
               </div>
             </div>
             <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Room Code (8 Chars)</label>
               <input value={roomId} onChange={(e) => setRoomId(e.target.value)} maxLength={8} className="w-full text-center text-2xl font-mono tracking-widest p-3 border-2 border-slate-200 rounded-lg focus:border-purple-500 outline-none uppercase" placeholder="XXXXXXXX"/>
             </div>
             {errorMsg && <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4" /> {errorMsg}</div>}
             <button onClick={connectToRoom} disabled={!roomId || !playerName || status === 'CONNECTING'} className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
               {status === 'CONNECTING' ? <Loader2 className="animate-spin" /> : <Wifi />} Connect
             </button>
             <button onClick={onBack} className="w-full text-sm text-slate-400 hover:text-slate-600">Back to Home</button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col relative">
       <ChatPanel 
        messages={chatMessages} 
        onSendMessage={handleSendChat} 
        currentUser={playerName} 
        isOpen={isChatOpen}
        onToggle={() => setIsChatOpen(!isChatOpen)}
      />
      
       {confirmingBingoCardId && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
               <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-fade-in">
                   <h3 className="text-2xl font-black text-slate-800 mb-2">Call Bingo?</h3>
                   <div className="flex gap-3 mt-4">
                       <button onClick={cancelBingo} className="flex-1 py-3 bg-slate-100 font-bold rounded-xl flex items-center justify-center gap-2">Cancel</button>
                       <button onClick={confirmBingo} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2">SCREAM IT!</button>
                   </div>
               </div>
           </div>
       )}

       {winnerAnnouncement && (
           <div className="fixed inset-0 z-[50] flex items-center justify-center pointer-events-none">
              <div className="bg-yellow-400 text-yellow-900 border-b-8 border-yellow-600 w-full py-12 flex flex-col items-center justify-center shadow-2xl animate-bounce-in opacity-95">
                 <PartyPopper className="w-16 h-16 mb-4 animate-pulse" />
                 <h2 className="text-4xl md:text-6xl font-black uppercase tracking-widest">{winnerAnnouncement}</h2>
              </div>
           </div>
       )}

       <header className="bg-white border-b border-slate-200 p-2 md:p-4 shadow-sm sticky top-0 z-20">
          <div className="max-w-md mx-auto flex items-center justify-between">
             <div className="flex items-center gap-2 md:gap-3">
               <div>
                  <div className="text-[10px] font-bold text-slate-400">PLAYING AS</div>
                  <div className="font-black text-sm md:text-lg text-slate-800 truncate max-w-[100px]">{playerName}</div>
               </div>
               
               {/* Auto Mark Toggle */}
               <button 
                 onClick={() => setIsAutoMark(!isAutoMark)}
                 className={`ml-1 px-2 py-1 rounded-lg border text-[10px] font-bold flex items-center gap-1 transition-all ${isAutoMark ? 'bg-purple-100 border-purple-300 text-purple-700' : 'bg-slate-50 text-slate-400'}`}
               >
                 <Zap className="w-3 h-3" />
                 {isAutoMark ? 'AUTO' : 'MANUAL'}
               </button>
             </div>
             
             {/* Target Pattern Icon */}
             <div className="bg-slate-100 p-1.5 rounded border border-slate-200 mx-2" title="Target Pattern">
                 <div className="grid grid-cols-5 gap-px w-5 h-5">
                     {Array.from({length: 25}).map((_, i) => (
                         <div key={i} className={`w-full h-full rounded-[1px] ${winPatterns.some(p => p.includes(i)) ? 'bg-green-500' : 'bg-slate-300'}`}></div>
                     ))}
                 </div>
             </div>

             <div className="text-right">
                <div className="text-[10px] font-bold text-slate-400">CURRENT</div>
                <div className="font-black text-xl text-blue-600">{currentCall || '--'}</div>
             </div>
          </div>
       </header>
       
       <div className="bg-slate-800 text-white text-center py-1 text-xs font-bold flex items-center justify-center gap-2 shadow-inner px-4">
         <Gift className="w-3 h-3 text-yellow-400 flex-shrink-0" />
         <span className="truncate">{prize || 'Bragging Rights'}</span>
      </div>
       
       {/* Video Call Bar */}
       <div className="bg-slate-200 p-2 flex justify-center gap-2 items-center">
            {isCallActive ? (
                <div className="flex gap-2 w-full max-w-md h-24 sm:h-32">
                    {/* Host Video */}
                    <div className="flex-1 bg-black rounded overflow-hidden relative">
                         <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">HOST</div>
                        {remoteStream ? (
                            <video ref={v => { if(v) v.srcObject = remoteStream }} autoPlay playsInline className="w-full h-full object-cover" />
                        ) : (
                            <div className="flex items-center justify-center h-full text-white text-xs">Waiting for Host...</div>
                        )}
                    </div>
                    {/* Self Video */}
                    <div className="w-24 sm:w-32 bg-slate-800 rounded overflow-hidden relative border-2 border-white">
                         <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">YOU</div>
                        {localStream && (
                            <video ref={v => { if(v) v.srcObject = localStream }} autoPlay muted playsInline className="w-full h-full object-cover" />
                        )}
                    </div>
                    <button onClick={toggleCall} className="bg-red-500 text-white p-2 rounded-full self-center">
                        <VideoOff className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <button onClick={toggleCall} className="bg-blue-600 text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm font-bold shadow-md">
                    <Video className="w-4 h-4" /> Join Video Call
                </button>
            )}
       </div>

       {lastCall && (
           <div className="bg-blue-600 text-white p-2 text-center text-sm font-bold animate-pulse">
              New Call: {lastCall}
           </div>
       )}

       {winningCard && !confirmingBingoCardId && (
         <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 animate-bounce w-full flex justify-center px-4">
            <button onClick={() => initiateBingoCall(winningCard.id)} className="bg-red-600 text-white border-4 border-red-800 rounded-full px-8 py-4 font-black text-xl md:text-2xl shadow-2xl flex items-center gap-3 hover:bg-red-700 hover:scale-105 transition-all w-full md:w-auto justify-center">
              <Megaphone className="w-6 h-6 md:w-8 md:h-8" /> CALL BINGO!
            </button>
         </div>
       )}

       <main className="flex-1 p-4 overflow-y-auto">
         <div className="max-w-md mx-auto space-y-6 pb-24">
            {cards.map((card, i) => (
               <div key={card.id}>
                 <div className="flex items-center justify-between mb-1 ml-1">
                    <div className="text-xs font-bold text-slate-400">CARD #{i+1}</div>
                    {announcedWinners.includes(card.id) && <span className="text-xs font-bold bg-green-100 text-green-700 px-2 rounded">Winner</span>}
                 </div>
                 <BingoBoard card={card} onCellClick={(cellId) => handleCellClick(card.id, cellId)} />
               </div>
            ))}
         </div>
       </main>
    </div>
  );
};

export default PlayerClient;