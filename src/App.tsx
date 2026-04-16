import React, { useState } from 'react';
import { BibleProvider } from './stores/BibleProvider';
import { useBible } from './stores/BibleContext';
import { HymnalProvider, useHymnal } from './stores/HymnalProvider';
import { FileUploader } from './components/FileUploader';
import { BibleViewer } from './components/BibleViewer';
import { HymnalModule } from './components/Hymnal/HymnalModule';
import { HymnalSidebar } from './components/Hymnal/HymnalSidebar';
import { ContiEditor } from './components/Hymnal/ContiEditor';
import { Menu, Search, BookOpen, Settings, X, Plus, Check, ChevronLeft, ChevronRight, ChevronDown, Trash2, Edit2, Type, AlignLeft, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchService, type SearchRange } from './services/searchService';
import { BIBLE_BOOKS, BIBLE_LIST } from './constants/bibleMeta';

import { MobilePdfLayout } from './components/Hymnal/MobilePdfLayout';

// --- Bible Navigation Bar Component ---
interface BibleNavBarProps {
  side: 'left' | 'right';
  nav: { bookId: string; chapter: number; verse?: number };
  setNav: (update: any) => void;
  onPrev: () => void;
  onNext: () => void;
  onQuickNav: (query: string) => boolean;
  // 좌측 전용
  showCopySettings?: boolean;
  copyMode?: any;
  setCopyMode?: (m: any) => void;
  showVersionInCopy?: boolean;
  setShowVersionInCopy?: (v: boolean) => void;
  // 우측 전용
  showVersionSelector?: boolean;
  availableVersions?: any[];
  currentVersionId?: string;
  onVersionChange?: (id: string) => void;
}

const BibleNavBar: React.FC<BibleNavBarProps> = ({
  side, nav, setNav, onPrev, onNext, onQuickNav,
  showCopySettings, copyMode, setCopyMode, showVersionInCopy, setShowVersionInCopy,
  showVersionSelector, availableVersions, currentVersionId, onVersionChange
}) => {
  const [localQuery, setLocalQuery] = useState('');

  const handleSearch = (val?: string) => {
    const query = val !== undefined ? val : localQuery;
    if (query.trim()) {
      const success = onQuickNav(query);
      if (success) {
        setLocalQuery('');
        return true;
      }
    }
    return false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalQuery(val);
    
    // ✅ 사용자 요청: 엔터를 안쳐도 유효한 패턴(마 1 등)이면 즉시 이동
    const trimmed = val.trim();
    const navPattern = /^([1-3]?[가-힣a-zA-Z]+)\s*(\d+)$/; // "마 1" 같은 형식을 실시간으로 감지
    if (navPattern.test(trimmed)) {
      handleSearch(trimmed);
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-2 p-3 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-20 ${side === 'right' ? 'bg-slate-50/50' : ''}`}>
      {/* 1. Quick Find Input with Search Button - Darkened for visibility */}
      <div className="relative group min-w-[140px]">
        <input 
          type="text"
          value={localQuery}
          onChange={handleChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="성경구절 (예: 창 1)"
          className="w-full h-9 bg-slate-100 border border-slate-300 rounded-lg pl-3 pr-8 text-xs font-black text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-500/5 transition-all outline-none"
        />
        <button 
          onClick={() => handleSearch()}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 text-slate-600 hover:text-red-600 transition-colors"
          title="구절 찾기"
        >
          <Search className="w-4 h-4 stroke-[2.5px]" />
        </button>
      </div>

      <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 border border-slate-200">
        {/* Book Selector */}
        <div className="relative group">
          <select 
            value={nav.bookId}
            onChange={(e) => setNav({ bookId: e.target.value, chapter: 1, verse: undefined })}
            className="bg-transparent text-xs font-black text-slate-800 pl-2 pr-6 py-1.5 outline-none appearance-none cursor-pointer hover:bg-white rounded-md transition-colors min-w-[70px]"
          >
            {BIBLE_LIST.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>
        
        <div className="w-px h-3 bg-slate-200"></div>

        {/* Chapter Selector */}
        <div className="relative group">
          <select 
            value={nav.chapter}
            onChange={(e) => setNav({ ...nav, chapter: parseInt(e.target.value, 10), verse: undefined })}
            className="bg-transparent text-xs font-black text-slate-800 pl-2 pr-6 py-1.5 outline-none appearance-none cursor-pointer hover:bg-white rounded-md transition-colors min-w-[50px]"
          >
            {Array.from({ length: BIBLE_LIST.find(b => b.id === nav.bookId)?.chapters || 1 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}장</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>

        <div className="w-px h-3 bg-slate-200"></div>

        {/* Verse Selector */}
        <div className="relative group">
          <select 
            value={nav.verse || ''}
            onChange={(e) => setNav({ ...nav, verse: e.target.value ? parseInt(e.target.value, 10) : undefined })}
            className="bg-transparent text-xs font-black text-slate-800 pl-2 pr-6 py-1.5 outline-none appearance-none cursor-pointer hover:bg-white rounded-md transition-colors min-w-[50px]"
          >
            <option value="">절</option>
            {Array.from({ length: 150 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1}절</option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
        </div>

        <div className="w-px h-3 bg-slate-200"></div>

        {/* Navigation Buttons */}
        <div className="flex items-center px-0.5">
          <button onClick={onPrev} className="p-1 hover:bg-white rounded text-slate-400 hover:text-red-600 transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={onNext} className="p-1 hover:bg-white rounded text-slate-400 hover:text-red-600 transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Copy Settings (Left Only) */}
      {showCopySettings && setCopyMode && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">복사설정</span>
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {['default', 'niv+krv', 'all'].map((m) => (
              <button 
                key={m} 
                onClick={() => setCopyMode(m as any)}
                className={`px-2 py-1 rounded text-[9px] font-black transition-all ${copyMode === m ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
              >
                {m === 'default' ? '개역' : m === 'niv+krv' ? '개역+NIV' : '전체'}
              </button>
            ))}
            <div className="w-px h-2.5 bg-slate-200 mx-1"></div>
            <button 
              onClick={() => setShowVersionInCopy?.(!showVersionInCopy)}
              className={`px-2 py-1 rounded text-[9px] font-black transition-all ${!showVersionInCopy ? 'bg-white text-red-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              번역본표시안함
            </button>
          </div>
        </div>
      )}

      {/* Version Selector (Right Only) */}
      {showVersionSelector && availableVersions && (
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">참고번역</span>
          <select 
            value={currentVersionId}
            onChange={(e) => onVersionChange?.(e.target.value)}
            className="bg-red-50 text-[10px] font-black text-red-600 px-2 py-1.5 rounded-lg border border-red-100 outline-none cursor-pointer hover:bg-red-100 transition-colors"
          >
            {availableVersions.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
      )}
    </div>
  );
};

// ✅ 검색 성능 최적화를 위한 독립 입력 컴포넌트
// 타자를 치는 동안에는 MainApp 전체가 리렌더링되지 않도록 격리합니다.
const SearchInput = React.memo<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  className: string;
}>(({ value, onChange, placeholder, className }) => {
  const [localValue, setLocalValue] = React.useState(value);

  // 외부(전역) 값이 바뀌면 로컬 값도 동기화 (검색결과 클릭 이동 등 대비)
  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // 입력이 멈추면 전역 상태로 전달 (0.2초 디바운싱)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localValue !== value) {
        onChange(localValue);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [localValue, value, onChange]);

  return (
    <input 
      type="text"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );
});

const MainApp: React.FC = () => {
  // PDF 인쇄 모드 확인
  const params = new URLSearchParams(window.location.search);
  const isPrintMode = params.get('mode') === 'print-pdf';

  if (isPrintMode) {
    return <MobilePdfLayout />;
  }
  const { 
    versions, 
    selectedVersionIds, 
    toggleVersion, 
    removeVersion, 
    clearAllVersions, 
    renameVersion, 
    addVersion,
    copyMode,
    setCopyMode,
    showVersionInCopy,
    setShowVersionInCopy,
    lineHeight,
    setLineHeight 
  } = useBible();
  const { isEditorOpen } = useHymnal();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [searchFontSize, setSearchFontSize] = useState(14); // ✅ 검색결과용 글자 크기 상태
  const [currentTab, setCurrentTab] = useState<'bible' | 'hymnal'>('bible');
  
  // Editing State
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // 듀얼 뷰 상태 추가
  const [isDualView, setIsDualView] = useState(false);
  
  // 듀얼 뷰 리사이저 상태 (너비 기억 기능 포함)
  const [splitPosition, setSplitPosition] = useState<number>(() => {
    const saved = localStorage.getItem('bibleSplitPosition');
    return saved ? parseFloat(saved) : 50;
  });
  const [isResizing, setIsResizing] = useState(false);
  const contentRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    localStorage.setItem('bibleSplitPosition', splitPosition.toString());
  }, [splitPosition]);

  // 마우스 드래그 이벤트 핸들러
  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !contentRef.current) return;
      
      const containerRect = contentRef.current.getBoundingClientRect();
      const newX = e.clientX - containerRect.left;
      const newPercent = (newX / containerRect.width) * 100;
      
      // 최소 20%, 최대 80% 제한
      if (newPercent >= 20 && newPercent <= 80) {
        setSplitPosition(newPercent);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto'; // 드래그 종료 후 텍스트 선택 허용
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none'; // 드래그 중 텍스트 선택 방지
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // Navigation State 분리
  const [leftNav, setLeftNav] = useState({ bookId: 'GEN', chapter: 1, verse: 1 });
  const [rightNav, setRightNav] = useState({ bookId: 'GEN', chapter: 1, verse: 1 });
  
  // 우측 창 전용 번역본 상태 (단일 선택)
  const [rightSelectedVersionId, setRightSelectedVersionId] = useState<string>('built-in-krv');

  const [searchQuery, setSearchQuery] = useState('');
  
  // Search Options State
  const [searchMode, setSearchMode] = useState<'standard' | 'semantic'>('standard');
  const [logicMode, setLogicMode] = useState<'AND' | 'OR'>('AND');
  const [matchMode, setMatchMode] = useState<'partial' | 'exact'>('partial');
  const [tolerance, setTolerance] = useState(1);
  const [searchRange, setSearchRange] = useState<SearchRange>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // 퀵 서치 처리 로직 (마 1:1 등)
  const handleQuickNav = (query: string, side: 'left' | 'right') => {
    const trimmed = query.trim();
    // 1. 권만 패턴 (예: "마")
    // 2. 권 장 패턴 (예: "마 1")
    // 3. 권 장 절 패턴 (예: "마 1:5")
    const navPattern = /^([1-3]?[가-힣a-zA-Z]+)(?:\s*(\d+))?(?:[:：.\s](\d+))?$/;
    const match = trimmed.match(navPattern);

    if (match) {
      const [_, bookName, chapterStr, verseStr] = match;
      
      // 약어나 전체 이름으로 책 찾기
      const bookId = BIBLE_BOOKS[bookName];
      const book = bookId ? BIBLE_LIST.find(b => b.id === bookId) : BIBLE_LIST.find(b => 
        b.name === bookName || 
        (b as any).shortName === bookName || 
        bookName === b.name.substring(0, 2) ||
        bookName === b.name.substring(0, 1)
      );

      if (book) {
        // ✅ 사용자 요청: 권만 적으면 1장 1절, 장만 적으면 1절이 나오게
        const ch = chapterStr ? parseInt(chapterStr, 10) : 1;
        const vs = verseStr ? parseInt(verseStr, 10) : 1;
        
        const update = { bookId: book.id, chapter: ch, verse: vs };
        if (side === 'left') setLeftNav(update);
        else setRightNav(update);
        return true;
      }
    }
    return false;
  };

  // Unified Search Logic - Side Search Panel
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim();
      // 내비게이션 패턴은 사이드바 검색 엔진에서 제외
      const isNavPattern = /^([1-3]?[가-힣a-zA-Z]+)\s*(\d+)(?:[:：.\s](\d+))?$/.test(trimmed);
      
      if (!isNavPattern && trimmed.length >= 2) {
        const normalizedQuery = trimmed.normalize('NFC');
        const results = searchService.search(normalizedQuery, selectedVersionIds, {
          matchMode: searchMode === 'semantic' ? 'partial' : matchMode,
          logicMode: searchMode === 'semantic' ? 'OR' : logicMode,
          range: searchRange,
          currentBookId: leftNav.bookId,
          searchMode: searchMode
        });
        setSearchResults(results);
      } else if (!isNavPattern) {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedVersionIds, searchRange, leftNav.bookId, searchMode, logicMode, matchMode]);

  const handlePrevChapter = (side: 'left' | 'right') => {
    const nav = side === 'left' ? leftNav : rightNav;
    const setNav = side === 'left' ? setLeftNav : setRightNav;

    if (nav.chapter > 1) {
      setNav({ ...nav, chapter: nav.chapter - 1, verse: undefined });
    } else {
      const currentIndex = BIBLE_LIST.findIndex(b => b.id === nav.bookId);
      if (currentIndex > 0) {
        const prevBook = BIBLE_LIST[currentIndex - 1];
        setNav({ bookId: prevBook.id, chapter: prevBook.chapters, verse: undefined });
      }
    }
  };

  const handleNextChapter = (side: 'left' | 'right') => {
    const nav = side === 'left' ? leftNav : rightNav;
    const setNav = side === 'left' ? setLeftNav : setRightNav;
    const currentBook = BIBLE_LIST.find(b => b.id === nav.bookId);

    if (currentBook && nav.chapter < currentBook.chapters) {
      setNav({ ...nav, chapter: nav.chapter + 1, verse: undefined });
    } else {
      const currentIndex = BIBLE_LIST.findIndex(b => b.id === nav.bookId);
      if (currentIndex < BIBLE_LIST.length - 1) {
        const nextBook = BIBLE_LIST[currentIndex + 1];
        setNav({ bookId: nextBook.id, chapter: 1, verse: undefined });
      }
    }
  };

  return (
    <div className="flex h-screen bg-background text-slate-200 overflow-y-auto overflow-x-hidden font-sans custom-scrollbar">
      {/* ... (sidebar content skipped for brevity in replacement) */}
      {/* Sidebar - Dynamically switch between Bible and Hymnal controls */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: "fit-content", opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="glass border-r border-slate-200 h-full relative z-30 bg-white shadow-xl shrink-0 group/sidebar"
          >
            {/* Sidebar Collapse Button (Floating in middle) */}
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-12 bg-white border border-slate-200 rounded-full shadow-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-50 transition-all z-40 opacity-0 group-hover/sidebar:opacity-100"
              title="사이드바 접기"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="p-5 h-full flex flex-col w-[16vw] min-w-[180px] max-w-[260px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h1 className="font-bold bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent flex items-baseline gap-1.5">
                  <span className="text-[10px] uppercase tracking-tighter opacity-80">ceum</span>
                  <span className="text-xl">성경CCM</span>
                </h1>
                {currentTab === 'bible' ? <BookOpen className="w-5 h-5 text-red-500" /> : <Music className="w-5 h-5 text-red-500" />}
              </div>

              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {currentTab === 'bible' ? (
                  /* Bible Sidebar Content */
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-3 px-2">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">번역본 목록</h2>
                        <div className="flex items-center gap-1">
                          {versions.length > 0 && (
                            <button 
                               onClick={() => {
                                if (confirm('모든 번역본을 삭제하시겠습니까?')) {
                                  clearAllVersions();
                                }
                              }}
                              className="p-1 hover:bg-red-500/10 rounded-md transition-colors text-red-400/60 hover:text-red-400"
                              title="모든 번역본 삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => setShowUploadModal(true)}
                            className="p-1 hover:bg-slate-100 rounded-md transition-colors text-red-500"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        {versions.length === 0 ? (
                          <p className="text-xs text-slate-400 px-2 italic">번역본을 추가해주세요.</p>
                        ) : (
                          versions.map((v) => (
                             <div
                               key={v.id}
                               className={`
                                 group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                                 ${selectedVersionIds.includes(v.id) ? 'bg-red-50 text-red-700 ring-1 ring-red-100' : 'hover:bg-slate-50 text-slate-600'}
                               `}
                               onClick={() => toggleVersion(v.id)}
                             >
                               <div className={`
                                 w-5 h-5 rounded-md border flex items-center justify-center transition-colors
                                 ${selectedVersionIds.includes(v.id) ? 'bg-red-500 border-red-500' : 'border-slate-200'}
                               `}>
                                 {selectedVersionIds.includes(v.id) && <Check className="w-3 h-3 text-white" />}
                               </div>
                               <span className="flex-1 text-sm font-medium truncate">{v.name}</span>
                               
                               {/* ✅ 개별 삭제 버튼 - 시스템 번역본 제외 */}
                               {!v.isSystem && !v.isBuiltIn && (
                                 <button
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     if (confirm(`'${v.name}' 번역본을 삭제하시겠습니까?`)) {
                                       removeVersion(v.id);
                                     }
                                   }}
                                   className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-md transition-all opacity-0 group-hover:opacity-100"
                                   title="이 번역본 삭제"
                                 >
                                   <X className="w-3.5 h-3.5" />
                                 </button>
                               )}
                             </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Hymnal Sidebar Content (3-Column Layout Column 1) */
                  <HymnalSidebar />
                )}
              </div>

              {/* Footer Settings */}
              <div className="mt-auto pt-6 border-t border-slate-100">
                <button 
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-3 px-4 py-3 w-full hover:bg-slate-50 rounded-xl transition-colors text-slate-500 hover:text-red-600"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-medium">설정</span>
                </button>
                <div className="mt-4 px-4 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">제작: CEUM ministry</p>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 flex overflow-hidden">
        {/* Main View Area - No Animation */}
        <div 
          className={`flex flex-col flex-1 overflow-hidden bg-white ${isSearchOpen ? 'w-2/3' : 'w-full'}`}
        >
          <main className="flex-1 flex flex-col relative z-10 overflow-hidden">
        {/* Header */}
        <header className="min-h-16 border-b border-slate-200 flex flex-wrap items-center px-4 md:px-6 py-2 gap-x-6 gap-y-3 bg-white sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setCurrentTab('bible')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === 'bible' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                성경
              </button>
              <button
                onClick={() => setCurrentTab('hymnal')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  currentTab === 'hymnal' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                찬송/CCM
              </button>
            </div>
            
            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            {currentTab === 'bible' && (
              <div className="flex items-center gap-3 ml-2">
                <button 
                  onClick={() => {
                    if (!isDualView) {
                      setRightSelectedVersionId('built-in-krv');
                      setRightNav({ ...leftNav });
                    }
                    setIsDualView(!isDualView);
                  }}
                  className={`flex items-center justify-center gap-2 w-[130px] py-2 rounded-xl transition-all shadow-sm active:scale-95 ${isDualView ? 'bg-indigo-600 text-white shadow-indigo-200 ring-2 ring-indigo-300' : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-indigo-400 hover:text-indigo-600'}`}
                  title="두 개 창 보기 (설교 준비용)"
                >
                  <div className="flex gap-1">
                    <div className={`w-1.5 h-3.5 rounded-sm ${isDualView ? 'bg-white' : 'bg-indigo-400'}`} />
                    <div className={`w-1.5 h-3.5 rounded-sm ${isDualView ? 'bg-white/60' : 'bg-indigo-200'}`} />
                  </div>
                  <span className="text-xs font-black tracking-tight">설교준비 듀얼뷰</span>
                </button>
              </div>
            )}
            
            {currentTab === 'hymnal' && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                   <div className="text-sm font-bold text-slate-800">찬송/CCM 관리자</div>
                   <button 
                     onClick={() => setShowSettings(true)}
                     className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white rounded-xl transition-all active:scale-95 group shadow-sm border border-red-100"
                     title="도움말 및 설치 가이드"
                   >
                     <span className="text-[10px] font-black">사용법</span>
                     <Settings className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
                   </button>
                </div>
              </div>
            )}
          </div>

            <div className="flex-1"></div>

          {/* ✅ Dynamic Reference Pane Close Button - Aligned with the divider */}
          {currentTab === 'bible' && isDualView && (
            <div 
              className="absolute top-1/2 -translate-y-1/2 z-40 transition-none pl-3" // pl-3 to match typical left margin
              style={{ left: `${splitPosition}%` }}
            >
              <button 
                onClick={() => setIsDualView(false)}
                className="flex items-center justify-center gap-2 w-[130px] py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-black text-xs shadow-indigo-200 ring-2 ring-indigo-300 active:scale-95"
              >
                <div className="flex gap-0.5">
                  <div className="w-1 h-3 bg-white/40 rounded-sm" />
                  <div className="w-1 h-3 bg-white rounded-sm" />
                </div>
                참조본문
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center gap-4">
            {currentTab === 'bible' && (
              <>
                <div className="flex -space-x-2">
                  {versions.filter(v => selectedVersionIds.includes(v.id)).map(v => (
                    <div key={v.id} className="px-2 h-8 rounded-full bg-red-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-red-600 min-w-[32px]" title={v.name}>
                      {v.name.substring(0, 2)}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 ${isSearchOpen ? 'bg-red-600 text-white shadow-lg' : 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white'}`}
                  title="검색 창 열기/닫기"
                >
                  <Search className={`w-5 h-5 ${isSearchOpen ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-black whitespace-nowrap">성경 검색</span>
                </button>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div ref={contentRef} className="flex-1 overflow-hidden relative bg-slate-50">
          <AnimatePresence mode="wait">
            {currentTab === 'bible' ? (
              versions.length === 0 ? (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-white"
                >
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8 border border-slate-100">
                    <BookOpen className="w-10 h-10 text-slate-300" />
                  </div>
                  <h2 className="text-2xl font-bold mb-4 text-slate-900">시작하기</h2>
                  <p className="text-slate-500 text-center max-w-md mb-8">
                    PC에 있는 성경 PDF 또는 TXT 파일을 업로드하여 사용하세요. <br/>
                    여러 번역본을 동시에 비교하며 볼 수 있습니다.
                  </p>
                  <button 
                    onClick={() => setShowUploadModal(true)}
                    className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-red-200 hover:scale-105"
                  >
                    성경 파일 업로드하기
                  </button>
                </motion.div>
              ) : selectedVersionIds.length === 0 ? (
                <motion.div 
                  key="no-selection"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col items-center justify-center text-slate-400 p-12 italic"
                >
                  <p>왼쪽 사이드바에서 표시할 성경 번역본을 체크해 주세요.</p>
                </motion.div>
              ) : (
                <div className="flex h-full overflow-hidden bg-slate-100 relative">
                  {/* Left Pane (Main) */}
                  <div 
                    className={`flex flex-col bg-white shadow-inner relative z-10 ${isDualView ? 'border-r border-slate-200' : 'w-full'}`}
                    style={{ width: isDualView ? `${splitPosition}%` : '100%' }}
                  >
                    <BibleNavBar 
                      side="left"
                      nav={leftNav}
                      setNav={setLeftNav}
                      onPrev={() => handlePrevChapter('left')}
                      onNext={() => handleNextChapter('left')}
                      onQuickNav={(q) => handleQuickNav(q, 'left')}
                      showCopySettings={true}
                      copyMode={copyMode}
                      setCopyMode={setCopyMode}
                      showVersionInCopy={showVersionInCopy}
                      setShowVersionInCopy={setShowVersionInCopy}
                    />
                    <div className="flex-1 overflow-hidden">
                       <BibleViewer 
                        key={`left-${leftNav.bookId}-${leftNav.chapter}-${selectedVersionIds.join(',')}`}
                        selectedVersions={versions.filter(v => selectedVersionIds.includes(v.id))} 
                        currentBookId={leftNav.bookId}
                        currentChapter={leftNav.chapter}
                        highlightVerse={leftNav.verse}
                        fontSize={fontSize}
                        lineHeight={lineHeight}
                      />
                    </div>
                  </div>

                  {/* Resizer Bar (Splitter) - Only visible in dual view */}
                  {isDualView && (
                    <div 
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setIsResizing(true);
                      }}
                      className="absolute top-0 bottom-0 z-30 w-2 -ml-1 cursor-col-resize group flex items-center justify-center transition-all hover:bg-red-500/10 active:bg-red-500/20"
                      style={{ left: `${splitPosition}%` }}
                    >
                      <div className="w-px h-full bg-slate-400 group-hover:bg-red-500 transition-colors" />
                    </div>
                  )}

                  {/* Right Pane (Reference) */}
                  {isDualView && (
                    <div 
                      className="flex flex-col bg-white relative z-0 border-l border-slate-200"
                      style={{ width: `${100 - splitPosition}%` }}
                    >
                      <BibleNavBar 
                        side="right"
                        nav={rightNav}
                        setNav={setRightNav}
                        onPrev={() => handlePrevChapter('right')}
                        onNext={() => handleNextChapter('right')}
                        onQuickNav={(q) => handleQuickNav(q, 'right')}
                        showVersionSelector={true}
                        availableVersions={versions}
                        currentVersionId={rightSelectedVersionId}
                        onVersionChange={setRightSelectedVersionId}
                      />
                      <div className="flex-1 overflow-hidden bg-slate-50/30">
                        <BibleViewer 
                          key={`right-${rightNav.bookId}-${rightNav.chapter}-${rightSelectedVersionId}`}
                          selectedVersions={versions.filter(v => v.id === rightSelectedVersionId)} 
                          currentBookId={rightNav.bookId}
                          currentChapter={rightNav.chapter}
                          highlightVerse={rightNav.verse}
                          fontSize={fontSize}
                          lineHeight={lineHeight}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )
            ) : (
              <HymnalModule />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>

    {/* ✅ 우측 검색 사이드 패널 (애니메이션 없는 일반 aside) */}
    {isSearchOpen && (
      <aside
        className="search-side-panel w-1/3 min-w-[350px] max-w-[500px]"
      >
          {/* 패널 헤더: 검색 옵션 상단 배치 */}
          <div className="search-panel-header">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Search className="w-5 h-5 text-red-600" />
                성경 검색
              </h2>
              <button 
                onClick={() => setIsSearchOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 1. 검색 모드 및 범위 */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex bg-slate-100 p-0.5 rounded-lg border border-slate-200 shadow-inner w-3/5">
                  <button
                    onClick={() => setSearchMode('standard')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-black transition-all ${searchMode === 'standard' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    일반 검색
                  </button>
                  <button
                    onClick={() => setSearchMode('semantic')}
                    className={`flex-1 py-1.5 rounded-md text-[10px] font-black transition-all ${searchMode === 'semantic' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    유사 구절
                  </button>
                </div>
                <select 
                  value={searchRange}
                  onChange={(e) => setSearchRange(e.target.value as SearchRange)}
                  className="flex-1 bg-slate-100 border border-slate-200 text-[11px] font-bold px-3 py-1.5 rounded-lg text-slate-700 outline-none h-full"
                >
                  <option value="all">전체 범위</option>
                  <option value="ot">구약 전체</option>
                  <option value="nt">신약 전체</option>
                  <option value="book">현재 (해당 권만)</option>
                </select>
              </div>

              {/* 2. 상세 옵션 (Standard 모드 시 노출) */}
              {searchMode === 'standard' && (
                <div className="search-options-grid">
                  <div className="col-span-2 flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">검색 옵션</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={logicMode === 'AND'} onChange={() => setLogicMode(logicMode === 'AND' ? 'OR' : 'AND')} className="accent-red-600" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-red-600">모든 단어 (AND)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox" checked={matchMode === 'exact'} onChange={() => setMatchMode(matchMode === 'exact' ? 'partial' : 'exact')} className="accent-red-600" />
                    <span className="text-xs font-bold text-slate-600 group-hover:text-red-600">완전 일치</span>
                  </label>
                </div>
              )}

              {/* 3. 검색 입력창 */}
              <div className="relative group">
                <SearchInput 
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder={searchMode === 'standard' ? "검색어 입력 (예: 아브라함 이삭 야곱)" : "비슷한 표현 늬앙스 검색"}
                  className="w-full h-11 bg-slate-50 border-2 border-slate-100 rounded-xl pl-4 pr-10 text-sm focus:outline-none focus:bg-white focus:border-red-400 focus:ring-4 focus:ring-red-500/5 transition-all font-medium text-slate-800"
                />
                <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" />
              </div>
            </div>
          </div>

          {/* 결과 리스트 영역 혹은 가이드 문구 */}
          <div className="search-result-list custom-scrollbar">
            {searchResults.length > 0 ? (() => {
              // 성능을 위해 번역본 ID맵을 미리 생성 (1,000개 결과 대비)
              const versionMap = new Map(versions.map(v => [v.id, v.name]));
              return searchResults.map((res, i) => (
                <div
                  key={i}
                  onClick={() => {
                    const targetSide = isDualView ? 'right' : 'left';
                    const setNav = targetSide === 'left' ? setLeftNav : setRightNav;
                    setNav({
                      bookId: res.bookId,
                      chapter: res.chapter,
                      verse: res.verse
                    });
                  }}
                  className="search-result-item group"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded-lg">{res.bookName} {res.chapter}:{res.verse}</span>
                    <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-600">
                      {versionMap.get(res.versionId) || 'Unknown'}
                    </span>
                  </div>
                  <p 
                    className="text-slate-700 leading-relaxed font-medium"
                    style={{ fontSize: `${searchFontSize}px` }}
                  >
                    {res.content}
                  </p>
                </div>
              ));
            })() : searchQuery.length < 2 && searchMode === 'standard' ? (
              /* 검색 가이드 팁 - 일반 검색 모드에서만 노출 */
              <div className="p-4 space-y-3">
                <div className="space-y-3">
                   <div className="space-y-3">
                      {/* Guide 1: All Words */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                        <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                          <span className="text-red-500">1.</span> 모든단어 (AND)
                        </p>
                        <div className="space-y-1.5 pl-4 border-l-2 border-slate-200">
                          <p className="text-[11px] text-slate-600 leading-tight">
                            <span className="font-black text-red-600">● 체크 시:</span> 모든 단어 조건이 맞아야 검색
                          </p>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            <span className="font-bold">● 해제 시:</span> 한 단어만 맞아도 검색
                          </p>
                        </div>
                      </div>

                      {/* Guide 2: Exact Match */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                        <p className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                          <span className="text-red-500">2.</span> 완전일치 (Exact Match)
                        </p>
                        <div className="space-y-1.5 pl-4 border-l-2 border-slate-200">
                          <p className="text-[11px] text-slate-600 leading-tight">
                            <span className="font-black text-red-600">● 체크 시:</span> 조사까지 일치 (예: '아브라함의')
                          </p>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            <span className="font-bold">● 해제 시:</span> 단어만 들어가면 모두 검색 (예: '아브라함')
                          </p>
                        </div>
                      </div>
                   </div>
                </div>

                <div className="p-4 bg-red-50/30 rounded-2xl border border-red-100/50">
                   <p className="text-[10px] text-red-700 leading-relaxed font-medium">
                     * 검색어 사이에 띄어쓰기를 입력하여 여러 단어를 검색할 수 있습니다.
                   </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-64 text-slate-300">
                <Search className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-sm font-bold">검색 결과가 없습니다.</p>
              </div>
            )}
          </div>
        </aside>
      )}
    </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUploadModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-surface border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <h2 className="text-xl font-bold">성경 번역본 추가</h2>
                <button 
                  onClick={() => setShowUploadModal(false)}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-8">
                <FileUploader 
                  onUploadSuccess={(v) => {
                    addVersion(v);
                    setShowUploadModal(false);
                  }} 
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white border border-slate-100 rounded-2xl shadow-2xl p-8 max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex items-center justify-between mb-8 shrink-0">
                <div className="flex items-center gap-3">
                   <div className="p-2 bg-red-50 rounded-xl">
                      <Settings className="w-6 h-6 text-red-600" />
                   </div>
                   <h2 className="text-xl font-bold text-slate-800">
                     {currentTab === 'bible' ? '성경 환경 설정' : '[CEUM] 통합 도구 가이드'}
                   </h2>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8">
                {currentTab === 'bible' ? (
                  <>
                    <div className="space-y-8">
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-bold text-slate-700">본문 글꼴 크기</span>
                          <span className="text-red-600 font-black px-3 py-1 bg-red-50 rounded-lg">{fontSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="12" 
                          max="40" 
                          value={fontSize}
                          onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                        />
                        <div className="flex justify-between mt-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                          <span>12px</span>
                          <span>본문 크게 (최대 40px)</span>
                        </div>
                      </div>

                      <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <div className="flex justify-between items-center mb-4">
                          <span className="font-bold text-indigo-900">검색 결과 글꼴 크기</span>
                          <span className="text-indigo-600 font-black px-3 py-1 bg-white rounded-lg border border-indigo-200">{searchFontSize}px</span>
                        </div>
                        <input 
                          type="range" 
                          min="10" 
                          max="24" 
                          value={searchFontSize}
                          onChange={(e) => setSearchFontSize(parseInt(e.target.value, 10))}
                          className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                        />
                        <div className="flex justify-between mt-2 text-[10px] font-black text-indigo-400 uppercase tracking-tighter">
                          <span>10px</span>
                          <span>검색결과 크게</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="font-bold text-slate-700">본문 줄 간격</span>
                        <span className="text-red-600 font-black px-3 py-1 bg-red-50 rounded-lg">{lineHeight.toFixed(1)}</span>
                      </div>
                      <input 
                        type="range" 
                        min="1.3" 
                        max="3" 
                        step="0.1"
                        value={lineHeight}
                        onChange={(e) => setLineHeight(parseFloat(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                      />
                      <div className="flex justify-between mt-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                        <span>가장 촘촘히 (1.3)</span>
                        <span>넓게 (3.0)</span>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-2 mb-3">
                        <BookOpen className="w-4 h-4 text-slate-400" />
                        <h3 className="text-sm font-bold text-slate-800">성경 번역본 지원 형식 안내</h3>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-700">1. 표준 형식 (매 줄에 정보 포함)</p>
                          <ul className="text-[10px] text-slate-500 space-y-0.5 pl-3">
                            <li>• 예: <code className="bg-white px-1 rounded border">창세기 1:1</code>, <code className="bg-white px-1 rounded border">창 1:1</code>, <code className="bg-white px-1 rounded border">Genesis 1:1</code>, <code className="bg-white px-1 rounded border">Gen 1:1</code></li>
                          </ul>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[11px] font-bold text-slate-700">2. 헤더 구분 형식 (권/장이 상단에 위치)</p>
                          <ul className="text-[10px] text-slate-500 space-y-0.5 pl-3">
                            <li>• 헤더: <code className="bg-white px-1 rounded border">[Genesis 1]</code>, <code className="bg-white px-1 rounded border">창세기 1</code>, <code className="bg-white px-1 rounded border">Genesis 1</code></li>
                            <li>• 본문: <code className="bg-white px-1 rounded border">1.Text...</code> 또는 <code className="bg-white px-1 rounded border">1 본문...</code></li>
                          </ul>
                        </div>

                        <div className="pt-2 border-t border-slate-200">
                          <p className="text-[11px] font-bold text-red-600 leading-tight mb-2">
                            * 번역본 텍스트를 제미나이ai를 사용해 아래 형식으로 변환 후 사용하세요.
                          </p>
                          <p className="text-[10px] text-slate-400 leading-tight">
                            * 권장 사양: UTF-8 (BOM 없음), LF (\n), .txt 파일
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  /* Hymnal/Unified Guide Content */
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="p-5 bg-red-50 rounded-2xl border border-red-100">
                      <p className="text-xs font-bold text-red-800 leading-relaxed">목사님의 사역이 이 도구를 통해 더욱 풍성해지길 기도합니다. 🕊️🙏</p>
                    </div>

                    <div className="space-y-6">
                       <section>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                             <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                             맥(macOS) 보안 설정 안내
                          </h3>
                          <div className="bg-slate-50 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed border border-slate-100">
                             <p>앱 실행 시 "확인되지 않은 개발자" 경고가 뜨면:</p>
                             <ul className="mt-2 space-y-1.5 list-disc pl-4 font-bold">
                                <li><strong>시스템 설정</strong> &gt; <strong>개인정보 보호 및 보안</strong>으로 이동</li>
                                <li>아래쪽 <strong>확인 없이 열기 (Open Anyway)</strong> 버튼 클릭</li>
                                <li>암호 입력 후 최종 실행 승인</li>
                             </ul>
                          </div>
                       </section>

                       <section>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                             <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                             찬양 악보 데이터 넣는 법
                          </h3>
                          <div className="bg-slate-50 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed border border-slate-100 space-y-3">
                             <div>
                                <p className="font-black text-slate-800 mb-1">1. 데이터 빌더 실행</p>
                                <p>왼쪽 하단 <strong>[데이터 빌더 실행]</strong> 클릭 후 앨범과 PC 폴더 연결</p>
                             </div>
                             <div>
                                <p className="font-black text-slate-800 mb-1">2. 빌드 방식</p>
                                <p>• <strong>전체다시 빌드</strong>: 폴더 내 모든 곡을 새로 삽입</p>
                                <p>• <strong>새곡추가 빌드</strong>: 추가된 곡만 인식 (추천)</p>
                             </div>
                          </div>
                       </section>

                       <section>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                             <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                             드라이브 동기화 (모바일 연동)
                          </h3>
                          <div className="bg-white p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed border-2 border-red-50 space-y-2">
                             <p>패널 왼쪽 하단 <strong>[드라이브 동기화]</strong> 버튼을 누르면 구글 드라이브에 자동으로 업로드됩니다.</p>
                             <p className="text-[10px] text-red-500 font-bold">* 곡 추가나 정보 수정 후에는 항상 동기화를 눌러주세요.</p>
                          </div>
                       </section>

                       <section>
                          <h3 className="text-sm font-black text-slate-900 flex items-center gap-2 mb-3">
                             <div className="w-1.5 h-4 bg-red-500 rounded-full" />
                             정보 일괄 수정 (엑셀 활용)
                          </h3>
                          <div className="bg-slate-50 p-4 rounded-xl text-[11px] text-slate-600 leading-relaxed border border-slate-100">
                             <p><strong>[CSV 내보내기]</strong>로 받은 엑셀에서 수정 후, <strong>[CSV 가져오기]</strong>로 다시 올리면 한꺼번에 반영됩니다.</p>
                          </div>
                       </section>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 text-center shrink-0">
                <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">
                  {currentTab === 'bible' ? 'CEUM BIBLE Tool V1.0.0' : 'CEUM CCM Tool V1.0.0'}
                </p>
                <p className="text-[9px] text-slate-300 font-bold tracking-tight">© 2026 CEUM ministry. All rights reserved.</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isEditorOpen && <ContiEditor />}
      </AnimatePresence>
    </div>
);
};

export const App: React.FC = () => {
  return (
    <BibleProvider>
      <HymnalProvider>
        <MainApp />
      </HymnalProvider>
    </BibleProvider>
  );
};

export default App;
