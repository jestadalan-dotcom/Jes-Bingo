import { BingoCard, BingoCell, GameMode } from './types';

export const THEME_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-amber-500',
  'bg-green-500',
  'bg-emerald-500',
  'bg-teal-500',
  'bg-cyan-500',
  'bg-sky-500',
  'bg-blue-500',
  'bg-indigo-500',
  'bg-violet-500',
  'bg-purple-500',
  'bg-fuchsia-500',
  'bg-pink-500',
  'bg-rose-500',
];

export const getStandardPatterns = (): number[][] => {
  const patterns: number[][] = [];
  // Rows
  for(let r=0; r<5; r++) patterns.push([r*5, r*5+1, r*5+2, r*5+3, r*5+4]);
  // Cols
  for(let c=0; c<5; c++) patterns.push([c, c+5, c+10, c+15, c+20]);
  // Diagonals
  patterns.push([0, 6, 12, 18, 24]);
  patterns.push([4, 8, 12, 16, 20]);
  return patterns;
};

export const getPatternPreset = (type: 'BLACKOUT' | 'X' | 'CORNERS'): number[][] => {
    if (type === 'BLACKOUT') {
        return [Array.from({length: 25}, (_, i) => i)];
    }
    if (type === 'X') {
        return [[0, 4, 6, 8, 12, 16, 18, 20, 24]];
    }
    if (type === 'CORNERS') {
        return [[0, 4, 20, 24]];
    }
    return getStandardPatterns();
};

export const checkPatternMatch = (cells: BingoCell[], patterns: number[][]): boolean => {
    return patterns.some(pattern => {
        return pattern.every(index => {
            const cell = cells[index];
            return cell && (cell.marked || cell.isFreeSpace);
        });
    });
};

export const generateCards = (
  items: (string | number)[], 
  themeMode: GameMode, 
  playerNames: string[], 
  startIndex: number = 0
): BingoCard[] => {
  const cards: BingoCard[] = [];
  const CARDS_PER_PLAYER = 1; // Simplified to 1 per player for better mobile UX, or keep user choice. Assuming logic allows multi.
  // Actually, keeping previous logic (loop for multiple) but defaulting to 4 in loop was hardcoded.
  // Let's stick to existing loop logic but maybe just 1-2 for mobile friendliness if we changed it, 
  // but let's strictly follow previous logic:
  
  playerNames.forEach((playerName, idx) => {
    const playerIdx = startIndex + idx;
    
    // Default to 2 cards per player for better mobile fit, or keep 4.
    // Keeping 4 as per original spec, but UI handles horizontal scroll.
    for(let cardIdx = 0; cardIdx < 4; cardIdx++) {
       let cells: BingoCell[] = [];
       
       if (themeMode === 'STANDARD') {
          // Standard Bingo Logic
          const ranges = [[1, 15], [16, 30], [31, 45], [46, 60], [61, 75]];
          const colNumbers: number[][] = [[], [], [], [], []];
          
          ranges.forEach((range, colIndex) => {
             const possible = Array.from({length: range[1] - range[0] + 1}, (_, k) => k + range[0]);
             // Shuffle
             for (let j = possible.length - 1; j > 0; j--) {
               const k = Math.floor(Math.random() * (j + 1));
               [possible[j], possible[k]] = [possible[k], possible[j]];
             }
             colNumbers[colIndex] = possible.slice(0, 5);
          });

          const flatCells: BingoCell[] = [];
          for(let r=0; r<5; r++) {
             for(let c=0; c<5; c++) {
                const isFree = r === 2 && c === 2;
                flatCells.push({
                  id: `p${playerIdx}_c${cardIdx}_r${r}_col${c}`,
                  value: isFree ? 'FREE' : colNumbers[c][r],
                  marked: false,
                  isFreeSpace: isFree
                });
             }
          }
          cells = flatCells;
       } else {
          // Themed Logic
          const shuffled = [...items];
          for (let j = shuffled.length - 1; j > 0; j--) {
            const k = Math.floor(Math.random() * (j + 1));
            [shuffled[k], shuffled[k]] = [shuffled[k], shuffled[j]];
          }
          
          const cardItems = shuffled.slice(0, 24);
          let itemIdx = 0;
          for (let r = 0; r < 5; r++) {
            for (let c = 0; c < 5; c++) {
               const isFree = r === 2 && c === 2;
               cells.push({
                 id: `p${playerIdx}_c${cardIdx}_r${r}_col${c}`,
                 value: isFree ? 'FREE' : cardItems[itemIdx++],
                 marked: false,
                 isFreeSpace: isFree
               });
            }
          }
       }

       cards.push({
         id: `p${playerIdx}_c${cardIdx}_${Date.now()}`, 
         ownerIndex: playerIdx,
         cardIndex: cardIdx,
         playerName: playerName,
         cells: cells,
         hasBingo: false,
         colorTheme: THEME_COLORS[playerIdx % THEME_COLORS.length]
       });
    }
  });

  return cards;
};