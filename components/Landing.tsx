import React from 'react';
import { Presentation, UserPlus } from 'lucide-react';

interface LandingProps {
  onChooseRole: (role: 'HOST' | 'PLAYER') => void;
}

const Landing: React.FC<LandingProps> = ({ onChooseRole }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
           <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 mb-6">
            Jeser Bingo
          </h1>
          <p className="text-slate-500 text-xl font-medium">Join the party or host your own game!</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <button 
            onClick={() => onChooseRole('HOST')}
            className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-blue-500 flex flex-col items-center gap-6 text-center"
          >
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center group-hover:bg-blue-100 transition-colors">
              <Presentation className="w-12 h-12 text-blue-600" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Host a Game</h2>
              <p className="text-slate-500">Create a room, generate cards with AI, and call the numbers for up to 10 players.</p>
            </div>
            <div className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-full font-bold group-hover:scale-105 transition-transform">
              Start Hosting
            </div>
          </button>

          <button 
            onClick={() => onChooseRole('PLAYER')}
            className="group relative bg-white rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all border-2 border-transparent hover:border-purple-500 flex flex-col items-center gap-6 text-center"
          >
            <div className="w-24 h-24 bg-purple-50 rounded-full flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <UserPlus className="w-12 h-12 text-purple-600" />
            </div>
             <div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Join a Game</h2>
              <p className="text-slate-500">Got a room code? Enter it to get your bingo cards and join the fun.</p>
            </div>
            <div className="mt-4 px-6 py-3 bg-purple-600 text-white rounded-full font-bold group-hover:scale-105 transition-transform">
              Join Party
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Landing;