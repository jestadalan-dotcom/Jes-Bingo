import React from 'react';
import { BingoCard, BingoCell } from '../types';
import { Check, Star } from 'lucide-react';

interface BingoBoardProps {
  card: BingoCard;
  onCellClick: (cellId: string) => void;
  isViewOnly?: boolean;
}

const BingoBoard: React.FC<BingoBoardProps> = ({ card, onCellClick, isViewOnly = false }) => {
  const getCellContent = (cell: BingoCell) => {
    if (cell.isFreeSpace) {
      return <Star className="w-5 h-5 md:w-8 md:h-8 text-yellow-400 fill-yellow-400 animate-pulse" />;
    }
    // Responsive text size for potentially smaller cards
    return <span className="text-center font-medium leading-tight text-[10px] sm:text-xs md:text-sm lg:text-base break-words overflow-hidden px-0.5">{cell.value}</span>;
  };

  return (
    <div className="w-full bg-white rounded-xl shadow-xl overflow-hidden border-4 border-slate-800">
      {/* Header */}
      <div className={`py-2 px-3 ${card.colorTheme} flex justify-between items-center text-white h-12`}>
        <h3 className="font-bold text-lg uppercase tracking-wider truncate mr-2">{card.playerName}</h3>
        {card.hasBingo && (
          <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded animate-bounce">
            BINGO!
          </span>
        )}
      </div>

      {/* Grid Header (B I N G O) */}
      <div className="grid grid-cols-5 bg-slate-800 text-white font-black text-center py-1 text-base md:text-lg">
        <div>B</div>
        <div>I</div>
        <div>N</div>
        <div>G</div>
        <div>O</div>
      </div>

      {/* Grid Cells */}
      <div className="grid grid-cols-5 gap-0.5 md:gap-1 p-1 md:p-2 bg-slate-200">
        {card.cells.map((cell) => {
          const isSelected = cell.marked || cell.isFreeSpace;
          
          return (
            <div
              key={cell.id}
              onClick={() => !isViewOnly && onCellClick(cell.id)}
              className={`
                aspect-square flex items-center justify-center p-0.5 relative cursor-pointer transition-all duration-200
                ${isSelected ? 'bg-white shadow-inner' : 'bg-slate-100 hover:bg-white shadow-sm'}
                ${isViewOnly ? 'cursor-default' : 'active:scale-95'}
                rounded text-slate-800
              `}
            >
              {/* Content Layer */}
              <div className={`z-10 flex items-center justify-center w-full h-full ${isSelected ? 'opacity-40' : 'opacity-100'}`}>
                {getCellContent(cell)}
              </div>

              {/* Marker Layer */}
              {isSelected && (
                <div className="absolute inset-0 z-20 flex items-center justify-center bingo-cell-enter pointer-events-none">
                  <div className={`
                    w-8 h-8 md:w-10 md:h-10 rounded-full opacity-80 flex items-center justify-center
                    ${card.colorTheme.replace('bg-', 'text-').replace('500', '600')}
                    border-2 md:border-4 border-current
                  `}>
                    {cell.isFreeSpace ? null : <Check strokeWidth={4} className="w-5 h-5 md:w-6 md:h-6" />}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BingoBoard;