import React, { useState } from 'react';
import { BibleProvider, useBible } from './stores/BibleProvider';
import { HymnalProvider } from './stores/HymnalProvider';
import { FileUploader } from './components/FileUploader';
import { BibleViewer } from './components/BibleViewer';
import { HymnalModule } from './components/Hymnal/HymnalModule';
import { HymnalSidebar } from './components/Hymnal/HymnalSidebar';
import { Menu, Search, BookOpen, Settings, X, Plus, Check, ChevronLeft, ChevronRight, ChevronDown, Trash2, Edit2, Type, AlignLeft, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { searchService, type SearchRange } from './services/searchService';
import { BIBLE_BOOKS, BIBLE_LIST } from './constants/bibleMeta';

const MainApp: React.FC = () => {
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
    setShowVersionInCopy 
  } = useBible();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const [currentTab, setCurrentTab] = useState<'bible' | 'hymnal'>('bible');
  
  // Editing State
  const [editingVersionId, setEditingVersionId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  
  // Navigation State
  const [currentBookId, setCurrentBookId] = useState('GEN');
  const [currentChapter, setCurrentChapter] = useState(1);
  const [currentVerse, setCurrentVerse] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [wordQuery, setWordQuery] = useState('');
  const [phraseQuery, setPhraseQuery] = useState('');
  const [searchRange, setSearchRange] = useState<SearchRange>('all');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  // Debounced Search Logic
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchQuery.trim();
      // Only search if it's not a book:chapter:verse pattern (which is handled in onChange)
      const isNavPattern = /^([1-3]?[가-힣a-zA-Z]+)\s*(\d+)(?:[:：.\s](\d+))?$/.test(trimmed);
      
      if (!isNavPattern && trimmed.length >= 2) {
        const results = searchService.search(trimmed, selectedVersionIds, 'word', searchRange, currentBookId);
        setSearchResults(results);
      } else if (!isNavPattern) {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedVersionIds, searchRange, currentBookId]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (wordQuery.length >= 2) {
        const results = searchService.search(wordQuery, selectedVersionIds, 'word', searchRange, currentBookId);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [wordQuery, selectedVersionIds, searchRange, currentBookId]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (phraseQuery.length >= 2) {
        const results = searchService.search(phraseQuery, selectedVersionIds, 'phrase', searchRange, currentBookId);
        setSearchResults(results);
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [phraseQuery, selectedVersionIds, searchRange, currentBookId]);

  const handlePrevChapter = () => {
    if (currentChapter > 1) {
      setCurrentChapter(currentChapter - 1);
    } else {
      const currentIndex = BIBLE_LIST.findIndex(b => b.id === currentBookId);
      if (currentIndex > 0) {
        const prevBook = BIBLE_LIST[currentIndex - 1];
        setCurrentBookId(prevBook.id);
        setCurrentChapter(prevBook.chapters);
      }
    }
    setCurrentVerse(undefined);
  };

  const handleNextChapter = () => {
    const currentBook = BIBLE_LIST.find(b => b.id === currentBookId);
    if (currentBook && currentChapter < currentBook.chapters) {
      setCurrentChapter(currentChapter + 1);
    } else {
      const currentIndex = BIBLE_LIST.findIndex(b => b.id === currentBookId);
      if (currentIndex < BIBLE_LIST.length - 1) {
        const nextBook = BIBLE_LIST[currentIndex + 1];
        setCurrentBookId(nextBook.id);
        setCurrentChapter(1);
      }
    }
    setCurrentVerse(undefined);
  };

  return (
    <div className="flex h-screen bg-background text-slate-200 overflow-hidden font-sans">
      {/* ... (sidebar content skipped for brevity in replacement) */}
      {/* Sidebar - Dynamically switch between Bible and Hymnal controls */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="glass border-r border-slate-200 h-full relative z-20 overflow-hidden bg-white shadow-xl"
          >
            <div className="p-6 h-full flex flex-col w-[280px]">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h1 className="text-xl font-bold bg-gradient-to-r from-red-600 to-red-400 bg-clip-text text-transparent">
                  {currentTab === 'bible' ? 'CEUM BIBLE Tool' : 'CEUM HYMNAL Tool'}
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

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative z-10">
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

            {currentTab === 'bible' ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                  <div className="relative group">
                    <select 
                      value={currentBookId}
                      onChange={(e) => {
                        setCurrentBookId(e.target.value);
                        setCurrentChapter(1);
                        setCurrentVerse(undefined);
                      }}
                      className="bg-transparent text-sm font-extrabold text-slate-800 pl-2 pr-7 py-2 outline-none appearance-none cursor-pointer hover:bg-white rounded-lg transition-colors min-w-[80px]"
                    >
                      {BIBLE_LIST.map(b => <option key={b.id} value={b.id} className="bg-white text-xs">{b.name}</option>)}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                  </div>
                  
                  <div className="w-px h-3 bg-slate-200"></div>
                  
                  <div className="relative group">
                    <select 
                      value={currentChapter}
                      onChange={(e) => {
                        setCurrentChapter(parseInt(e.target.value, 10));
                        setCurrentVerse(undefined);
                      }}
                      className="bg-transparent text-sm font-extrabold text-slate-800 pl-2 pr-7 py-2 outline-none appearance-none cursor-pointer hover:bg-white rounded-lg transition-colors min-w-[50px]"
                    >
                      {Array.from({ length: BIBLE_LIST.find(b => b.id === currentBookId)?.chapters || 1 }, (_, i) => (
                        <option key={i + 1} value={i + 1} className="bg-white text-xs">{i + 1}장</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                  </div>
  
                  <div className="w-px h-3 bg-slate-200"></div>
  
                  <div className="relative group">
                    <select 
                      value={currentVerse || ''}
                      onChange={(e) => {
                        setCurrentVerse(e.target.value ? parseInt(e.target.value, 10) : undefined);
                      }}
                      className="bg-transparent text-sm font-extrabold text-slate-800 pl-2 pr-7 py-2 outline-none appearance-none cursor-pointer hover:bg-white rounded-lg transition-colors min-w-[60px]"
                    >
                      <option value="" className="bg-white text-slate-400">절 선택</option>
                      {Array.from({ length: 150 }, (_, i) => (
                        <option key={i + 1} value={i + 1} className="bg-white text-xs">{i + 1}절</option>
                      ))}
                    </select>
                    <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                  </div>
  
                  <div className="w-px h-3 bg-slate-200"></div>
  
                  <div className="flex items-center px-1">
                    <button 
                      onClick={handlePrevChapter}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                      title="이전 장"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleNextChapter}
                      className="p-1.5 hover:bg-white rounded-lg text-slate-400 hover:text-red-600 transition-colors"
                      title="다음 장"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
  
                {/* Copy Mode Selector - Relocated */}
                <div className="flex items-center gap-2 pl-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">복사 설정</span>
                  <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-100">
                    {[
                      { id: 'default', label: '개역개정' },
                      { id: 'niv+krv', label: '개역+NIV' },
                      { id: 'all', label: '전체' }
                    ].map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setCopyMode(m.id as any)}
                        className={`
                          px-2 py-0.5 rounded-md text-[9px] font-bold transition-all
                          ${copyMode === m.id 
                            ? 'bg-white text-red-600 shadow-sm ring-1 ring-slate-200' 
                            : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                        `}
                      >
                        {m.label}
                      </button>
                    ))}
                    <div className="w-px h-2.5 bg-slate-200 mx-0.5"></div>
                    <button
                      onClick={() => setShowVersionInCopy(!showVersionInCopy)}
                      className={`
                        px-2 py-0.5 rounded-md text-[9px] font-bold transition-all
                        ${!showVersionInCopy 
                          ? 'bg-white text-red-600 shadow-sm ring-1 ring-slate-200' 
                          : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                      `}
                    >
                      번역본 표시안함
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-sm font-bold text-slate-800">찬송/CCM 관리자</div>
                <div className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full font-black uppercase">Alpha</div>
              </div>
            )}
          </div>

          {currentTab === 'bible' && (
            <div className="flex-1 flex flex-wrap items-center gap-2 min-w-[300px]">
              <div className="flex-1 min-w-[120px] relative group">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Search className="w-3 h-3" />
                </div>
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSearchQuery(val);
                    
                    // Navigation Pattern handling (instant)
                    const trimmed = val.trim();
                    const match = trimmed.match(/^([1-3]?[가-힣a-zA-Z]+)\s*(\d+)(?:[:：.\s](\d+))?$/);
                    
                    if (match) {
                      const [_, bookName, chapter, verse] = match;
                      const bookId = BIBLE_BOOKS[bookName];
                      if (bookId) {
                        setCurrentBookId(bookId);
                        setCurrentChapter(parseInt(chapter, 10));
                        if (verse) setCurrentVerse(parseInt(verse, 10));
                        else setCurrentVerse(undefined);
                        setSearchResults([]);
                      }
                    } 
                  }}
                  placeholder="직접입력 (창 1:1)"
                  className="w-full h-8 bg-slate-100 border border-slate-200 rounded-lg pl-8 pr-2 text-[11px] focus:outline-none focus:bg-white focus:border-red-300 transition-all font-semibold text-slate-800"
                />
              </div>
              
              <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 h-8 border border-slate-200 shrink-0">
                <span className="text-[9px] font-bold text-slate-400 mr-0.5 shrink-0">범위</span>
                <select 
                  value={searchRange}
                  onChange={(e) => setSearchRange(e.target.value as SearchRange)}
                  className="bg-transparent border-none text-[11px] font-bold text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="all">전체</option>
                  <option value="ot">구약</option>
                  <option value="nt">신약</option>
                  <option value="book">현재권</option>
                </select>
              </div>

              <div className="flex-1 min-w-[100px] relative group">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <Type className="w-3 h-3" />
                </div>
                <input 
                  type="text"
                  value={wordQuery}
                  onChange={(e) => setWordQuery(e.target.value)}
                  placeholder="단어 검색"
                  className="w-full h-8 bg-slate-100 border border-slate-200 rounded-lg pl-8 pr-2 text-[11px] focus:outline-none focus:bg-white focus:border-red-300 transition-all font-semibold text-slate-800"
                />
              </div>

              <div className="flex-1 min-w-[100px] relative group">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <AlignLeft className="w-3 h-3" />
                </div>
                <input 
                  type="text"
                  value={phraseQuery}
                  onChange={(e) => setPhraseQuery(e.target.value)}
                  placeholder="유사 구문 검색"
                  className="w-full h-8 bg-slate-100 border border-slate-200 rounded-lg pl-8 pr-2 text-[11px] focus:outline-none focus:bg-white focus:border-red-300 transition-all font-semibold text-slate-800"
                />
              </div>

              <AnimatePresence>
                {searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 max-h-[400px] overflow-y-auto z-50 custom-scrollbar"
                  >
                    {searchResults.map((res, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          setCurrentBookId(res.bookId);
                          setCurrentChapter(res.chapter);
                          setCurrentVerse(res.verse);
                          setSearchResults([]);
                          setSearchQuery(`${res.bookName} ${res.chapter}:${res.verse}`);
                        }}
                        className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group text-left"
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-bold text-red-600">{res.bookName} {res.chapter}:{res.verse}</span>
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            {versions.find(v => v.id === res.versionId)?.name}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 line-clamp-2 italic">"{res.content}"</p>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="ml-auto flex items-center gap-4">
            <div className="flex -space-x-2">
              {versions.filter(v => selectedVersionIds.includes(v.id)).map(v => (
                <div key={v.id} className="px-2 h-8 rounded-full bg-red-100 border-2 border-white flex items-center justify-center text-[10px] font-bold text-red-600 min-w-[32px]" title={v.name}>
                  {v.name.substring(0, 2)}
                </div>
              ))}
            </div>
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative bg-slate-50">
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
                <BibleViewer 
                  key={`${currentBookId}-${currentChapter}-${selectedVersionIds.join(',')}`}
                  selectedVersions={versions.filter(v => selectedVersionIds.includes(v.id))} 
                  currentBookId={currentBookId}
                  currentChapter={currentChapter}
                  highlightVerse={currentVerse}
                  fontSize={fontSize}
                />
              )
            ) : (
              <HymnalModule />
            )}
          </AnimatePresence>
        </div>
      </main>

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
              className="relative w-full max-w-md bg-white border border-slate-100 rounded-2xl shadow-2xl p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold text-slate-800">환경 설정</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-8">
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold text-slate-700">본문 글꼴 크기</span>
                    <span className="text-red-600 font-black px-3 py-1 bg-red-50 rounded-lg">{fontSize}px</span>
                  </div>
                  <input 
                    type="range" 
                    min="12" 
                    max="32" 
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-500"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                    <span>12px</span>
                    <span>32px</span>
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
              </div>

              <div className="mt-12 pt-6 border-t border-slate-100 text-center">
                <p className="text-[10px] font-black text-slate-400 tracking-widest uppercase mb-1">CEUM BIBLE Tool V1.0.0</p>
                <p className="text-[9px] text-slate-300 font-bold tracking-tight">© 2026 CEUM ministry. All rights reserved.</p>
              </div>
            </motion.div>
          </div>
        )}
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
