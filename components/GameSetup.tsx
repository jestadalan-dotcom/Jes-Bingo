import React, { useState } from 'react';
import { GameMode } from '../types';
import { Dice5, Sparkles, Loader2, Users, ChevronDown, ChevronUp, Share2 } from 'lucide-react';
import { generateThemedItems } from '../services/geminiService';

interface GameSetupProps {
  onStartGame: (mode: GameMode, items: (string | number)[], themeName: string, playerNames: string[]) => void;
}

const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<GameMode>('STANDARD');
  const [themeInput, setThemeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInviteTooltip, setShowInviteTooltip] = useState(false);
  
  const [showPlayerNames, setShowPlayerNames] = useState(false);
  const [playerNames, setPlayerNames] = useState<string[]>(
    Array.from({ length: 10 }, (_, i) => `Player ${i + 1}`)
  );

  const handleNameChange = (index: number, value: string) => {
    const newNames = [...playerNames];
    newNames[index] = value;
    setPlayerNames(newNames);
  };

  const handleInvite = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        setShowInviteTooltip(true);
        setTimeout(() => setShowInviteTooltip(false), 2000);
    }).catch(err => {
        console.error('Failed to copy: ', err);
    });
  };

  const handleStart = async () => {
    setError(null);
    if (mode === 'STANDARD') {
      // Generate standard bingo numbers 1-75
      const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
      onStartGame('STANDARD', numbers, 'Classic Numbers', playerNames);
    } else {
      if (!themeInput.trim()) {
        setError("Please enter a theme for the AI to generate.");
        return;
      }
      setIsLoading(true);
      try {
        const items = await generateThemedItems(themeInput);
        onStartGame('THEMED', items, themeInput, playerNames);
      } catch (e: any) {
        setError(e.message || "Failed to generate theme.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="text-center mb-10 relative">
        <h1 className="text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-4">
          Jeser Bingo Party 2026
        </h1>
        <p className="text-slate-600 text-lg mb-4">
          Create a game for 10 players (4 cards each). Choose standard numbers or let AI create a custom theme!
        </p>

        <button 
         onClick={handleInvite}
         className="inline-flex items-center gap-2 px-5 py-2 bg-white text-slate-600 rounded-full shadow-sm border border-slate-200 hover:bg-slate-50 transition-all font-bold text-sm hover:text-blue-600 relative group"
        >
         <Share2 className="w-4 h-4" />
         Invite Friends to Join
         {showInviteTooltip && (
           <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap z-50 animate-fade-in font-normal">
             Link Copied to Clipboard!
             <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45"></div>
           </div>
         )}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        {/* Mode Selection */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <button
            onClick={() => setMode('STANDARD')}
            className={`flex-1 p-6 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-3 ${
              mode === 'STANDARD'
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md ring-2 ring-blue-200 ring-offset-2'
                : 'border-slate-200 hover:border-blue-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Dice5 className="w-10 h-10" />
            <span className="font-bold text-lg">Standard (1-75)</span>
          </button>

          <button
            onClick={() => setMode('THEMED')}
            className={`flex-1 p-6 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-3 ${
              mode === 'THEMED'
                ? 'border-purple-500 bg-purple-50 text-purple-700 shadow-md ring-2 ring-purple-200 ring-offset-2'
                : 'border-slate-200 hover:border-purple-300 text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Sparkles className="w-10 h-10" />
            <span className="font-bold text-lg">AI Themed</span>
          </button>
        </div>

        {/* Theme Input */}
        {mode === 'THEMED' && (
          <div className="mb-8 animate-fade-in">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              What's the theme?
            </label>
            <input
              type="text"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              placeholder="e.g., Remote Work Meetings, 90s Pop Culture, Dog Breeds..."
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            />
            <p className="text-xs text-slate-500 mt-2">
              Gemini will generate 60 unique items for this theme.
            </p>
          </div>
        )}

        {/* Player Names Section */}
        <div className="mb-8 border rounded-xl overflow-hidden border-slate-200">
          <button 
            onClick={() => setShowPlayerNames(!showPlayerNames)}
            className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-2 font-bold text-slate-700">
              <Users className="w-5 h-5" />
              <span>Customize Players ({playerNames.length})</span>
            </div>
            {showPlayerNames ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
          </button>
          
          {showPlayerNames && (
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white animate-fade-in">
              {playerNames.map((name, idx) => (
                <div key={idx} className="flex items-center gap-2">
                   <span className="text-xs font-bold text-slate-400 w-6">#{idx+1}</span>
                   <input
                    type="text"
                    value={name}
                    onChange={(e) => handleNameChange(idx, e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm focus:border-blue-400 outline-none"
                    placeholder={`Player ${idx+1}`}
                   />
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={isLoading}
          className={`
            w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all
            flex items-center justify-center gap-2
            ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 hover:to-slate-600 active:scale-[0.98]'}
          `}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Generating Magic...
            </>
          ) : (
            'Start Game'
          )}
        </button>
      </div>
    </div>
  );
};

export default GameSetup;