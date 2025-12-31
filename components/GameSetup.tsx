import React, { useState, useEffect } from 'react';
import { GameMode } from '../types';
import { Dice5, Sparkles, Loader2, Gift, User, Grid3X3, CheckSquare, Maximize } from 'lucide-react';
import { generateThemedItems } from '../services/geminiService';
import { getStandardPatterns, getPatternPreset } from '../gameUtils';

interface GameSetupProps {
  onStartGame: (mode: GameMode, items: (string | number)[], themeName: string, prize: string, hostName: string, winPatterns: number[][]) => void;
}

type PatternType = 'STANDARD' | 'BLACKOUT' | 'X' | 'CORNERS' | 'CUSTOM';

const GameSetup: React.FC<GameSetupProps> = ({ onStartGame }) => {
  const [mode, setMode] = useState<GameMode>('STANDARD');
  const [themeInput, setThemeInput] = useState('');
  const [prizeInput, setPrizeInput] = useState('');
  const [hostName, setHostName] = useState('Host');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pattern State
  const [patternType, setPatternType] = useState<PatternType>('STANDARD');
  const [customGrid, setCustomGrid] = useState<boolean[]>(Array(25).fill(false));

  useEffect(() => {
     // Pre-fill center for custom
     const newGrid = Array(25).fill(false);
     newGrid[12] = true; // Free space usually
     setCustomGrid(newGrid);
  }, []);

  const toggleCustomCell = (idx: number) => {
      setCustomGrid(prev => {
          const next = [...prev];
          next[idx] = !next[idx];
          return next;
      });
      setPatternType('CUSTOM');
  };

  const handleStart = async () => {
    setError(null);
    if (!hostName.trim()) {
        setError("Please enter a name for the Host.");
        return;
    }

    let winPatterns: number[][] = [];
    if (patternType === 'CUSTOM') {
        const indices = customGrid.map((active, idx) => active ? idx : -1).filter(i => i !== -1);
        if (indices.length === 0) {
             setError("Custom pattern cannot be empty.");
             return;
        }
        winPatterns = [indices];
    } else if (patternType === 'STANDARD') {
        winPatterns = getStandardPatterns();
    } else {
        winPatterns = getPatternPreset(patternType);
    }

    if (mode === 'STANDARD') {
      const numbers = Array.from({ length: 75 }, (_, i) => i + 1);
      onStartGame('STANDARD', numbers, 'Classic Numbers', prizeInput || 'Bragging Rights', hostName, winPatterns);
    } else {
      if (!themeInput.trim()) {
        setError("Please enter a theme for the AI to generate.");
        return;
      }
      setIsLoading(true);
      try {
        const items = await generateThemedItems(themeInput);
        onStartGame('THEMED', items, themeInput, prizeInput || 'Bragging Rights', hostName, winPatterns);
      } catch (e: any) {
        setError(e.message || "Failed to generate theme.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const renderPatternPreview = () => {
     return (
         <div className="grid grid-cols-5 gap-1 bg-slate-800 p-1 rounded w-fit mx-auto">
             {Array.from({length: 25}).map((_, i) => {
                 let isActive = false;
                 if (patternType === 'CUSTOM') isActive = customGrid[i];
                 else if (patternType === 'BLACKOUT') isActive = true;
                 else if (patternType === 'CORNERS') isActive = [0,4,20,24].includes(i);
                 else if (patternType === 'X') isActive = [0,4,6,8,12,16,18,20,24].includes(i);
                 else if (patternType === 'STANDARD') {
                     // Show a representation: e.g. first row
                     isActive = i < 5 || i % 5 === 0 || i % 6 === 0; // Just visual sugar
                 }
                 
                 return (
                     <button
                        key={i}
                        onClick={() => toggleCustomCell(i)}
                        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-sm transition-colors ${isActive ? 'bg-yellow-400' : 'bg-slate-600 hover:bg-slate-500'}`}
                        title={patternType === 'CUSTOM' ? "Click to toggle" : "Preset Pattern"}
                        disabled={patternType !== 'CUSTOM'}
                     />
                 )
             })}
         </div>
     )
  };

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24">
      <div className="text-center mb-6 md:mb-10 relative">
        <h1 className="text-3xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-2">
          Setup Game
        </h1>
        <p className="text-slate-600 text-sm md:text-lg">
          Configure rules, patterns, and prizes.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl p-4 md:p-8 border border-slate-100 space-y-6">
        {/* Host Name Input */}
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Host Name
            </label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-blue-500 outline-none"
            />
        </div>

        {/* Mode Selection */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('STANDARD')}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 text-center ${
              mode === 'STANDARD' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'
            }`}
          >
            <Dice5 className="w-6 h-6 sm:w-8 sm:h-8" />
            <span className="font-bold text-sm sm:text-base">Standard (1-75)</span>
          </button>

          <button
            onClick={() => setMode('THEMED')}
            className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 text-center ${
              mode === 'THEMED' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-500'
            }`}
          >
            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
            <span className="font-bold text-sm sm:text-base">AI Themed</span>
          </button>
        </div>

        {/* Theme Input */}
        {mode === 'THEMED' && (
          <div className="animate-fade-in">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Theme</label>
            <input
              type="text"
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              placeholder="e.g., 90s Pop Culture, Dog Breeds..."
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-purple-500 outline-none"
            />
          </div>
        )}

        <hr className="border-slate-100" />

        {/* Winning Pattern Selector */}
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                <Grid3X3 className="w-4 h-4 text-green-600" /> Winning Pattern
            </label>
            
            <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-full md:w-1/2 grid grid-cols-2 gap-2">
                    <button onClick={() => setPatternType('STANDARD')} className={`px-3 py-2 rounded-lg text-xs font-bold border ${patternType === 'STANDARD' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}>Any Line (Standard)</button>
                    <button onClick={() => setPatternType('BLACKOUT')} className={`px-3 py-2 rounded-lg text-xs font-bold border ${patternType === 'BLACKOUT' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}>Blackout (Full)</button>
                    <button onClick={() => setPatternType('X')} className={`px-3 py-2 rounded-lg text-xs font-bold border ${patternType === 'X' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}>Letter X</button>
                    <button onClick={() => setPatternType('CORNERS')} className={`px-3 py-2 rounded-lg text-xs font-bold border ${patternType === 'CORNERS' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-600'}`}>4 Corners</button>
                    <button onClick={() => setPatternType('CUSTOM')} className={`col-span-2 px-3 py-2 rounded-lg text-xs font-bold border ${patternType === 'CUSTOM' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-blue-600'}`}>Custom Manual</button>
                </div>
                
                <div className="w-full md:w-1/2 flex flex-col items-center">
                    <div className="mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                        {patternType === 'CUSTOM' ? 'Tap grid to edit' : 'Pattern Preview'}
                    </div>
                    {renderPatternPreview()}
                </div>
            </div>
        </div>
        
        <hr className="border-slate-100" />

        {/* Prize Input */}
        <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
              <Gift className="w-4 h-4 text-purple-600" /> Prize / Notes
            </label>
            <input
              type="text"
              value={prizeInput}
              onChange={(e) => setPrizeInput(e.target.value)}
              placeholder="e.g. Winner gets a free drink!"
              className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:border-purple-500 outline-none"
            />
        </div>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={isLoading}
          className={`
            w-full py-4 rounded-xl font-bold text-lg text-white shadow-lg transition-all
            flex items-center justify-center gap-2
            ${isLoading ? 'bg-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-slate-900 to-slate-700 hover:from-slate-800 active:scale-[0.98]'}
          `}
        >
          {isLoading ? (
            <><Loader2 className="animate-spin" /> Preparing...</>
          ) : (
            'Start Session'
          )}
        </button>
      </div>
    </div>
  );
};

export default GameSetup;