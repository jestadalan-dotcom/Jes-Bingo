import React, { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { BingoCard, NetworkMessage, WelcomePayload, BingoCell, JoinRequestPayload } from '../types';
import BingoBoard from './BingoBoard';
import { Loader2, Wifi, WifiOff, Trophy, AlertCircle, Megaphone, Gift, User } from 'lucide-react';

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
  const [announcedWinners, setAnnouncedWinners] = useState<string[]>([]); // Card IDs that have officially won

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);

  const connectToRoom = () => {
    if (!roomId || !playerName) return;
    setStatus('CONNECTING');
    
    const peer = new Peer();
    peerRef.current = peer;

    peer.on('open', (myId) => {
      // Uppercase input to match host generation
      const conn = peer.connect(roomId.toUpperCase());
      connRef.current = conn;

      conn.on('open', () => {
        setStatus('WAITING_FOR_HOST');
        setErrorMsg('');
        
        // Send Join Request
        const joinMsg: NetworkMessage = {
            type: 'JOIN_REQUEST',
            payload: { playerName } as JoinRequestPayload
        };
        conn.send(joinMsg);
      });

      conn.on('data', (data: any) => {
        const msg = data as NetworkMessage;
        handleMessage(msg);
      });

      conn.on('error', (err) => {
        console.error(err);
        setStatus('ERROR');
        setErrorMsg('Connection lost or failed.');
      });
      
      conn.on('close', () => {
          setStatus('ERROR');
          setErrorMsg('Host ended the session.');
      });
    });

    peer.on('error', (err) => {
      setStatus('ERROR');
      setErrorMsg('Could not initialize connection. Check Room ID.');
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
      if (payload.currentCall) {
          setCurrentCall(payload.currentCall);
          setLastCall(payload.currentCall);
      }
      setStatus('CONNECTED');
    } else if (msg.type === 'NEW_GAME') {
      // Reset State for New Round
      const payload = msg.payload as WelcomePayload;
      setCards(payload.cards);
      setTheme(payload.theme);
      setPrize(payload.prize);
      
      setCalledItems([]);
      setCurrentCall(null);
      setLastCall(null);
      setAnnouncedWinners([]);
      
    } else if (msg.type === 'NEXT_CALL') {
      const val = msg.payload;
      setCurrentCall(val);
      setLastCall(val);
      setCalledItems(prev => [val, ...prev]);
    } else if (msg.type === 'BINGO_ANNOUNCED') {
      const { playerIndex: winnerIdx, cardId } = msg.payload;
      setAnnouncedWinners(prev => [...prev, cardId]);
    }
  };

  // Local marking logic (Player marks their own board)
  const handleCellClick = (cardId: string, cellId: string) => {
    setCards(prevCards => {
      const updatedCards = prevCards.map(card => {
        if (card.id !== cardId) return card;
        
        // Find cell
        const updatedCells = card.cells.map(cell => {
          if (cell.id !== cellId) return cell;
          // Toggle mark
          return { ...cell, marked: !cell.marked };
        });

        // Check for Bingo locally
        let hasLine = false;
        // Rows
        for (let i = 0; i < 5; i++) {
            if (updatedCells.slice(i * 5, (i + 1) * 5).every(c => c.marked || c.isFreeSpace)) hasLine = true;
        }
        // Cols
        for (let i = 0; i < 5; i++) {
            let colComplete = true;
            for (let j = 0; j < 5; j++) {
            const cell = updatedCells[i + j * 5];
            if (!cell.marked && !cell.isFreeSpace) colComplete = false;
            }
            if (colComplete) hasLine = true;
        }
        // Diagonals
        if ([0, 6, 12, 18, 24].every(idx => updatedCells[idx].marked || updatedCells[idx].isFreeSpace)) hasLine = true;
        if ([4, 8, 12, 16, 20].every(idx => updatedCells[idx].marked || updatedCells[idx].isFreeSpace)) hasLine = true;

        return { ...card, cells: updatedCells, hasBingo: hasLine };
      });
      return updatedCards;
    });
  };
  
  const callBingo = (cardId: string) => {
    if (connRef.current) {
      connRef.current.send({
        type: 'CLAIM_BINGO',
        payload: { cardId, playerIndex }
      });
    }
  };
  
  // Determine if we should show the "Call Bingo" button
  // We check if any card has a local 'Bingo' that hasn't been announced yet
  const winningCard = cards.find(c => c.hasBingo && !announcedWinners.includes(c.id));
  const hasOfficialWin = cards.some(c => announcedWinners.includes(c.id));

  if (status === 'IDLE' || status === 'CONNECTING' || status === 'ERROR') {
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
                 <input 
                   value={playerName}
                   onChange={(e) => setPlayerName(e.target.value)}
                   className="w-full pl-10 pr-4 py-3 border-2 border-slate-200 rounded-lg focus:border-purple-500 outline-none"
                   placeholder="Enter your name"
                 />
               </div>
             </div>

             <div>
               <label className="block text-sm font-bold text-slate-700 mb-1">Room Code (8 Chars)</label>
               <input 
                 value={roomId}
                 onChange={(e) => setRoomId(e.target.value)}
                 maxLength={8}
                 className="w-full text-center text-2xl font-mono tracking-widest p-3 border-2 border-slate-200 rounded-lg focus:border-purple-500 outline-none uppercase"
                 placeholder="XXXXXXXX"
               />
             </div>

             {errorMsg && (
               <div className="p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2 text-sm">
                 <AlertCircle className="w-4 h-4" /> {errorMsg}
               </div>
             )}

             <button 
               onClick={connectToRoom}
               disabled={!roomId || !playerName || status === 'CONNECTING'}
               className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
             >
               {status === 'CONNECTING' ? <Loader2 className="animate-spin" /> : <Wifi />}
               Connect
             </button>
             
             <button onClick={onBack} className="w-full text-sm text-slate-400 hover:text-slate-600">Back to Home</button>
           </div>
        </div>
      </div>
    );
  }
  
  if (status === 'WAITING_FOR_HOST') {
      return (
          <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 flex-col">
              <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
              <h2 className="text-xl font-bold text-slate-700">Connecting to Host...</h2>
              <p className="text-slate-400">Waiting for game data...</p>
          </div>
      )
  }

  // Connected View
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
       <header className="bg-white border-b border-slate-200 p-4 shadow-sm sticky top-0 z-20">
          <div className="max-w-md mx-auto flex items-center justify-between">
             <div>
               <div className="text-xs font-bold text-slate-400">PLAYING AS</div>
               <div className="font-black text-lg text-slate-800">{playerName}</div>
             </div>
             
             <div className="text-right">
                <div className="text-xs font-bold text-slate-400">CURRENT CALL</div>
                <div className="font-black text-xl text-blue-600">{currentCall || 'WAITING...'}</div>
             </div>
          </div>
       </header>
       
       <div className="bg-slate-800 text-white text-center py-1 text-xs font-bold flex items-center justify-center gap-2 shadow-inner">
         <Gift className="w-3 h-3 text-yellow-400" />
         PRIZE: {prize || 'Bragging Rights'}
      </div>
       
       {lastCall && (
           <div className="bg-blue-600 text-white p-2 text-center text-sm font-bold animate-pulse">
              New Call: {lastCall}
           </div>
       )}

       {/* Floating Action Button for Calling Bingo */}
       {winningCard && (
         <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-bounce">
            <button 
              onClick={() => callBingo(winningCard.id)}
              className="bg-red-600 text-white border-4 border-red-800 rounded-full px-8 py-4 font-black text-2xl shadow-2xl flex items-center gap-3 hover:bg-red-700 hover:scale-105 transition-all"
            >
              <Megaphone className="w-8 h-8" />
              CALL BINGO!
            </button>
         </div>
       )}

       {hasOfficialWin && (
         <div className="fixed inset-x-0 top-32 z-40 pointer-events-none flex justify-center">
            <div className="bg-yellow-400 text-yellow-900 border-4 border-yellow-600 px-8 py-4 rounded-xl shadow-2xl transform rotate-3">
               <div className="flex items-center gap-3 font-black text-2xl">
                 <Trophy className="w-8 h-8" />
                 WIN CONFIRMED!
               </div>
               <div className="text-center font-bold text-sm mt-1">Great Job!</div>
            </div>
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
                 <BingoBoard 
                   card={card} 
                   onCellClick={(cellId) => handleCellClick(card.id, cellId)} 
                 />
               </div>
            ))}
         </div>
       </main>
    </div>
  );
};

export default PlayerClient;