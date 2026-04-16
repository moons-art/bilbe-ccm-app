import React, { useMemo, useEffect, useRef, useState } from 'react';
import type { BibleVersion, Verse } from '../types/bible';
import { useBible } from '../stores/BibleContext';
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
  isHighlighted: boolean;
  fontSize: number;
  lineHeight: number;
  onClick: (v: number) => void;
}>(({ verse, isSelected, isHighlighted, fontSize, lineHeight, onClick }) => {
  // 색상 결정 로직: 복사 선택(isSelected) > 검색 강조(isHighlighted)
  const itemStyles = isSelected 
    ? 'bg-red-50 border-l-red-500' 
    : isHighlighted 
      ? 'bg-sky-50 border-l-sky-500' 
      : 'hover:bg-slate-50 border-l-transparent';

  const numStyles = isSelected 
    ? 'text-red-600' 
    : isHighlighted 
      ? 'text-sky-600' 
      : 'text-slate-400';

  const textStyles = isSelected 
    ? 'text-slate-900 font-medium' 
    : isHighlighted 
      ? 'text-slate-900 font-medium' 
      : 'text-slate-700';

  return (
    <div
      data-verse={verse.verse}
      onClick={() => onClick(verse.verse)}
      style={{ scrollMarginTop: '44px' }}
      className={`
        verse-item group cursor-pointer rounded-md transition-colors
        ${itemStyles}
      `}
    >
      <div className="flex gap-3 items-start px-2">
        <span className={`text-[11px] font-bold mt-1.5 w-6 shrink-0 text-center ${numStyles}`}>
          {verse.verse}
        </span>
        <div className="flex-1 min-w-0">
          {verse.title && (
            <div className={`mb-1 font-extrabold text-[0.85em] tracking-tight ${isSelected || isHighlighted ? 'text-red-700' : 'text-red-700/60'}`}>
              &lt;{verse.title}&gt;
            </div>
          )}
          <p 
            className={`leading-relaxed whitespace-pre-wrap ${textStyles}`}
            style={{ fontSize: `${fontSize}px`, lineHeight: lineHeight }}
          >
            {verse.content}
          </p>
        </div>
      </div>
    </div>
  );
});

export const BibleViewer = React.memo<BibleViewerProps>(({ 
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
            verseElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }, 100);
      // ✅ 사용자 요청: 검색/이동 시 자동 선택(복사버튼 활성화) 방지
      // setSelectedVerses(new Set([highlightVerse])); 
      return () => clearTimeout(timer);
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
      // ✅ 사용자 요청: 알림창 없이 즉시 선택 해제 (버튼 사라짐)
      setSelectedVerses(new Set());
    } catch (err) {
      console.error("Failed to copy text: ", err);
      alert("복사에 실패했습니다.");
    }
  };

  const isSyncingRef = useRef(false);
  const lastScrolledIndexRef = useRef<number | null>(null);

  // ✅ 실시간 스크롤 동기화 로직
  const handleScroll = (idx: number, e: React.UIEvent<HTMLDivElement>) => {
    // 이미 동기화 중이거나, 다른 창에 의해 유도된 스크롤이면 무시
    if (isSyncingRef.current) return;
    
    const source = e.currentTarget;
    lastScrolledIndexRef.current = idx;
    isSyncingRef.current = true;

    // 현재 스크롤된 창의 상단에 가장 가까운 구절과 그 미세 위치(offset) 찾기
    const containerTop = source.scrollTop;
    const verseElements = Array.from(source.querySelectorAll('.verse-item')) as HTMLDivElement[];
    
    let targetVerseNum: string | null = null;
    let offsetFromTop = 0;
    let sourceEl: HTMLDivElement | null = null;

    for (const el of verseElements) {
      // 해당 구절의 아랫부분이 컨테이너 상단보다 아래에 있으면 (즉, 현재 보이고 있으면)
      if (el.offsetTop + el.offsetHeight > containerTop) {
        targetVerseNum = el.getAttribute('data-verse');
        sourceEl = el;
        // 구절의 시작점이 상단으로부터 얼마나 떨어져 있는지 계산 (보통 음수거나 작은 양수)
        offsetFromTop = el.offsetTop - containerTop;
        break;
      }
    }

    if (targetVerseNum && sourceEl) {
      // 다른 모든 창들의 스크롤 위치를 픽셀 단위로 정밀하게 맞추기
      scrollContainerRefs.current.forEach((target, j) => {
        if (!target || j === idx) return;
        
        const targetEl = target.querySelector(`[data-verse="${targetVerseNum}"]`) as HTMLDivElement;
        if (targetEl) {
          // 타겟 창의 scrollTop = 타겟 구절의 위치 - 소스 창에서 유지하던 오프셋
          target.scrollTop = targetEl.offsetTop - offsetFromTop;
        }
      });
    }

    // 다음 프레임에서 동기화 잠금 해제
    requestAnimationFrame(() => {
      isSyncingRef.current = false;
    });
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
            onScroll={(e) => handleScroll(idx, e)}
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
                  isHighlighted={v.verse === highlightVerse}
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
});
