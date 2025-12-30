import React, { useState } from 'react';
import { GameMode } from '../types';
import { Dice5, Sparkles, Loader2, Gift } from 'lucide-react';
import { generateThemedItems } from '../services/geminiService';

interface GameSetupProps {
  onStartGame: (mode: GameMode, items: (string | number)[], themeName: string, prize: string) => void;
  // removed initialPlayerNames props as it's no longer needed
}

const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<GameMode>('STANDARD');
  const [themeInput, setThemeInput] = useState('');
  const [prizeInput, setPrizeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStart = async () => {
    setError(null);
    if (mode === 'STANDARD') {
      // Generate standard bingo numbers 1-75
      const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
      onStartGame('STANDARD', numbers, 'Classic Numbers', prizeInput || 'Bragging Rights');
    } else {
      if (!themeInput.trim()) {
        setError("Please enter a theme for the AI to generate.");
        return;
      }
      setIsLoading(true);
      try {
        const items = await generateThemedItems(themeInput);
        onStartGame('THEMED', items, themeInput, prizeInput || 'Bragging Rights');
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
          Setup Game
        </h1>
        <p className="text-slate-600 text-lg mb-4">
          Configure the rules and prizes. Players will join using the Room Code.
        </p>
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
          <div className="mb-6 animate-fade-in">
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
        
        {/* Prize Input */}
        <div className="mb-8">
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-600" /> Prize / Bet Information
            </label>
            <input
              type="text"
              value={prizeInput}
              onChange={(e) => setPrizeInput(e.target.value)}
              placeholder="e.g. $5 per card, Winner gets $50, or 'Free Drink'"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none transition-all"
            />
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
            'Start Session'
          )}
        </button>
      </div>
    </div>
  );
};

export default GameSetup;