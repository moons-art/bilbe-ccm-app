import React, { useMemo, useEffect, useRef, useState } from 'react';
import type { BibleVersion, Verse } from '../types/bible';
import { useBible } from '../stores/BibleProvider';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, X } from 'lucide-react';

interface BibleViewerProps {
  selectedVersions: BibleVersion[];
  currentBookId: string;
  currentChapter: number;
  highlightVerse?: number;
  fontSize?: number;
  lineHeight: number;
}

const VerseItem = React.memo<{
  verse: Verse;
  isSelected: boolean;
  fontSize: number;
  lineHeight: number;
  onClick: (v: number) => void;
}>(({ verse, isSelected, fontSize, lineHeight, onClick }) => {
  return (
    <div
      onClick={() => onClick(verse.verse)}
      className={`
        verse-item group cursor-pointer rounded-md transition-colors
        ${isSelected ? 'bg-red-50/50 border-l-red-500' : 'hover:bg-slate-50 border-l-transparent'}
      `}
    >
      <div className="flex gap-3 items-start px-2">
        <span className={`text-[11px] font-bold mt-1.5 w-6 shrink-0 text-center ${isSelected ? 'text-red-600' : 'text-slate-400'}`}>
          {verse.verse}
        </span>
        <div className="flex-1 min-w-0">
          {verse.title && (
            <div className="mb-1 text-red-700 font-extrabold text-[0.85em] tracking-tight">
              &lt;{verse.title}&gt;
            </div>
          )}
          <p 
            className={`leading-relaxed whitespace-pre-wrap ${isSelected ? 'text-slate-900 font-medium' : 'text-slate-700'}`}
            style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
          >
            {verse.content}
          </p>
        </div>
      </div>
    </div>
  );
});

export const BibleViewer: React.FC<BibleViewerProps> = ({ 
  selectedVersions, 
  currentBookId, 
  currentChapter = 1, 
  highlightVerse,
  fontSize = 16,
  lineHeight
}) => {
  const scrollContainerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());

  // Group verses by book and chapter for each version
  const displayData = useMemo(() => {
    return selectedVersions.map(version => {
      const filtered = version.verses.filter(v => 
        v.bookId === currentBookId && v.chapter === currentChapter
      );
      return {
        id: version.id,
        name: version.name,
        verses: filtered.sort((a, b) => a.verse - b.verse)
      };
    });
  }, [selectedVersions, currentBookId, currentChapter]);

  // Scroll to highlight verse
  useEffect(() => {
    if (highlightVerse) {
      const timer = setTimeout(() => {
        scrollContainerRefs.current.forEach((container: HTMLDivElement | null) => {
          if (!container) return;
          const verseElement = container.querySelector(`[data-verse="${highlightVerse}"]`);
          if (verseElement) {
            verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        });
      }, 100);
      setSelectedVerses(new Set([highlightVerse]));
      return () => clearTimeout(timer);
    } else {
      setSelectedVerses(new Set());
    }
  }, [highlightVerse, currentBookId, currentChapter]);

  const toggleVerse = React.useCallback((verseNum: number) => {
    setSelectedVerses(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(verseNum)) {
        newSelected.delete(verseNum);
      } else {
        newSelected.add(verseNum);
      }
      return newSelected;
    });
  }, []);

  const { copyMode, versions, showVersionInCopy } = useBible();

  const copySelectedVerses = async () => {
    if (selectedVerses.size === 0) return;

    const sortedVerses = Array.from(selectedVerses).sort((a: number, b: number) => a - b);
    const minVerse = sortedVerses[0];
    const maxVerse = sortedVerses[sortedVerses.length - 1];
    
    let fullText = "";

    // Determine which versions to copy based on mode
    let versionsToCopy: BibleVersion[] = [];
    
    if (copyMode === 'default') {
      const krv = versions.find(v => v.name.includes('개역개정'));
      if (krv) versionsToCopy = [krv];
      else if (selectedVersions.length > 0) versionsToCopy = [selectedVersions[0]];
    } else if (copyMode === 'niv+krv') {
      const krv = versions.find(v => v.name.includes('개역개정'));
      const niv = versions.find(v => v.name.toLowerCase().includes('niv'));
      if (krv) versionsToCopy.push(krv);
      if (niv) versionsToCopy.push(niv);
      if (versionsToCopy.length === 0 && selectedVersions.length > 0) versionsToCopy = [selectedVersions[0]];
    } else {
      versionsToCopy = selectedVersions;
    }
    
    versionsToCopy.forEach((version) => {
      const targetVerses = version.verses.filter((v: Verse) => 
        selectedVerses.has(v.verse) && v.bookId === currentBookId && v.chapter === currentChapter
      ).sort((a: Verse, b: Verse) => a.verse - b.verse);

      if (targetVerses.length === 0) return;

      const bookName = targetVerses[0].bookName;
      const chapter = targetVerses[0].chapter;
      const versionLabel = showVersionInCopy ? `(${version.name})` : "";
      
      if (selectedVerses.size === 1) {
        const v = targetVerses[0];
        const labelStr = versionLabel ? ` ${versionLabel}` : "";
        fullText += `[${bookName} ${chapter}:${v.verse}] ${v.content}${labelStr}\n`;
      } else {
        const range = minVerse === maxVerse ? `${minVerse}` : `${minVerse}-${maxVerse}`;
        const labelStr = versionLabel ? ` ${versionLabel}` : "";
        fullText += `[${bookName} ${chapter}:${range}]${labelStr}\n`;
        targetVerses.forEach((v: Verse) => {
          fullText += `${v.verse}. ${v.content}\n`;
        });
        fullText += "\n";
      }
    });

    try {
      await navigator.clipboard.writeText(fullText.trim());
      alert("선택한 구절이 복사되었습니다.");
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert("복사에 실패했습니다.");
    }
  };

  if (selectedVersions.length === 0) return null;

  return (
    <div className="h-full flex overflow-hidden bg-white relative">
      {displayData.map((data, idx: number) => (
        <div 
          key={data.id} 
          className="flex-1 flex flex-col border-r border-slate-200 last:border-r-0 relative bg-white"
        >
          {/* Version Header */}
          <div className="h-10 flex items-center px-4 bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
            <span className="text-[10px] font-bold text-red-600 tracking-widest uppercase mr-2 bg-red-50 px-1.5 py-0.5 rounded">VER</span>
            <span className="text-xs font-bold text-slate-700 truncate">{data.name}</span>
          </div>

          {/* Verses Scroll Area */}
          <div 
            ref={el => { scrollContainerRefs.current[idx] = el; }}
            className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2 space-y-px pb-32"
          >
            {data.verses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 text-xs italic">
                해당 장의 본문이 없습니다.
              </div>
            ) : (
              data.verses.map((v: Verse) => (
                <VerseItem
                  key={`${v.bookId}-${v.chapter}-${v.verse}`}
                  verse={v}
                  isSelected={selectedVerses.has(v.verse)}
                  fontSize={fontSize}
                  lineHeight={lineHeight}
                  onClick={toggleVerse}
                />
              ))
            )}
          </div>
        </div>
      ))}

      {/* Floating Action Button */}
      <AnimatePresence>
        {selectedVerses.size > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl z-50 border border-slate-700"
          >
            <div className="flex items-center gap-2 mr-4 border-r border-slate-700 pr-4">
              <span className="text-xs font-bold text-red-400">{selectedVerses.size}</span>
              <span className="text-xs text-slate-400">구절 선택됨</span>
            </div>
            
            <button 
              onClick={copySelectedVerses}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 rounded-lg transition-colors text-sm font-semibold"
            >
              <Copy className="w-4 h-4 text-red-400" />
              복사하기
            </button>
            <button 
              onClick={() => setSelectedVerses(new Set())}
              className="p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
              title="선택 해제"
            >
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
