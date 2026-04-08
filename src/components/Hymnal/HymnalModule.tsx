import React, { useState, useEffect } from 'react';
import type { HymnalSong } from '../../types/hymnal';
import { useHymnal } from '../../stores/HymnalProvider';
import { 
  Search, 
  List, 
  ImageIcon, 
  RefreshCw, 
  Settings, 
  X, 
  Edit2, 
  Trash2, 
  ZoomIn, 
  ZoomOut,
  Music,
  Check,
  FolderOpen,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const HymnalModule: React.FC = () => {
  const { 
    filteredSongs, 
    searchQuery, 
    setSearchQuery, 
    selectedSongId, 
    setSelectedSongId, 
    isSyncing,
    fetchSongs,
    albums,
    activeAlbumId,
    setActiveAlbumId,
    showAlbumModal,
    setShowAlbumModal,
    showBuilder,
    setShowBuilder,
    editingAlbum,
    setEditingAlbum,
    processingProgress,
    syncAlbum,
    processImages,
    updateAlbum,
    addAlbum,
    updateAlbumPath,
    deleteAlbum
  } = useHymnal();

  // --- 로컬 전용 UI 상태 ---
  const [albumInput, setAlbumInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedLyrics, setEditedLyrics] = useState('');
  const [editedNumber, setEditedNumber] = useState(0);
  const [editedCode, setEditedCode] = useState('');
  const [editedMeter, setEditedMeter] = useState('');
  const [editedCategory, setEditedCategory] = useState('');
  const [isCustomMeter, setIsCustomMeter] = useState(false);
  const [isDeleteOriginal, setIsDeleteOriginal] = useState(false);
  const [zoomScale, setZoomScale] = useState(0.6);

  const selectedSong = filteredSongs.find(s => s.id === selectedSongId) as HymnalSong | undefined;
  const activeAlbum = albums.find(a => a.id === activeAlbumId);

  // 초기 설정
  useEffect(() => {
    if (editingAlbum) {
      setAlbumInput(editingAlbum.name);
    } else {
      setAlbumInput('');
    }
  }, [editingAlbum, showAlbumModal]);

  // 곡 변경 시 줌 초기화 (60%를 기본값으로)
  useEffect(() => {
    setZoomScale(0.6);
    setIsEditing(false);
    setIsDeleteOriginal(false); // 삭제 옵션 초기화
  }, [selectedSongId]);

  // --- 편집 모드 핸들러 ---
  const handleUpdateSong = async () => {
    if (!selectedSongId) return;
    const result = await (window as any).ipcRenderer.hymnal.updateSong({
      id: selectedSongId,
      title: editedTitle,
      lyrics: editedLyrics,
      number: editedNumber,
      code: editedCode,
      meter: editedMeter,
      category: editedCategory
    });

    if (result.success) {
      setIsEditing(false);
      await fetchSongs();
      alert('수정되었습니다.');
    } else {
      alert('수정 실패: ' + result.error);
    }
  };

  const startEditing = () => {
    if (selectedSong) {
      setEditedTitle(selectedSong.title);
      setEditedLyrics(selectedSong.lyrics);
      setEditedNumber(selectedSong.number);
      setEditedCode(selectedSong.code || '');
      setEditedMeter(selectedSong.meter || '');
      setEditedCategory(selectedSong.category || '');
      setIsCustomMeter(!['4/4', '3/4', '6/8', '12/8', '2/2', '4/6', ''].includes(selectedSong.meter || ''));
      setIsEditing(true);
      setIsDeleteOriginal(false);
    }
  };

  const handleDeleteSong = async () => {
    if (!selectedSongId) return;
    
    const warningMsg = isDeleteOriginal 
      ? '정말로 이 악보를 앱에서 제거하고, PC 원본 폴더에서도 영구히 삭제하시겠습니까?'
      : '정말로 이 악보를 앱에서 제거하시겠습니까? (PC 원본 파일은 유지됩니다)';
      
    if (!confirm(warningMsg)) return;

    const result = await (window as any).ipcRenderer.hymnal.deleteSong({ 
      songId: selectedSongId, 
      shouldDeleteOriginal: isDeleteOriginal 
    });
    
    if (result.success) {
      alert(isDeleteOriginal ? '앱 데이터와 원본 파일이 삭제되었습니다.' : '앱 데이터가 삭제되었습니다.');
      setSelectedSongId(null);
      setIsEditing(false);
      await fetchSongs();
    } else {
      alert('삭제 실패: ' + result.error);
    }
  };

  return (
    <div className="flex h-full w-full overflow-hidden bg-white">
      {/* 2단: 검색 및 곡 목록 (Middle Column) */}
      <div className="w-80 border-r border-slate-100 flex flex-col bg-slate-50/30">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 mb-4">
             <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center shadow-lg shadow-red-200">
               <Music className="w-4 h-4 text-white" />
             </div>
             <h2 className="text-xl font-black text-slate-800 tracking-tight truncate">
               {activeAlbumId === 'all' ? '전체 찬양' : activeAlbum?.name}
             </h2>
          </div>
          
          <div className="relative group">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" />
            <input 
              type="text"
              placeholder="제목, 가사, 번호 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 transition-all shadow-sm text-slate-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6">
          {filteredSongs.length > 0 ? (
            <div className="space-y-1.5">
              <div className="px-3 py-2 flex items-center justify-between">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">곡 리스트</p>
                <span className="text-[10px] bg-white border border-slate-200 px-1.5 py-0.5 rounded-full text-slate-400 font-bold">{filteredSongs.length}</span>
              </div>
              {filteredSongs.map((song) => (
                <button
                  key={song.id}
                  onClick={() => setSelectedSongId(song.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group ${
                    selectedSongId === song.id 
                      ? 'bg-white text-red-600 shadow-xl ring-1 ring-red-100' 
                      : 'hover:bg-white hover:shadow-md text-slate-600'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs transition-colors shrink-0 ${
                    selectedSongId === song.id ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400 group-hover:bg-red-50 group-hover:text-red-400'
                  }`}>
                    {song.number}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold truncate leading-tight">{song.title}</p>
                      {song.category && (
                        <span className="text-[8px] px-1.5 py-0.5 bg-slate-50 text-slate-400 rounded-md font-black border border-slate-100 shrink-0">
                          {song.category}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{song.lyrics}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-20 text-center">
               <List className="w-12 h-12 text-slate-200 mx-auto mb-4" />
               <p className="text-sm text-slate-300 font-bold italic">검색 결과가 없습니다.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3단: 악보 뷰어 영역 (Main Content) */}
      <div className="flex-1 flex flex-col relative bg-white overflow-hidden">
        <AnimatePresence mode="wait">
          {!selectedSongId ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-slate-300"
            >
              <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] border border-slate-100 shadow-2xl flex items-center justify-center mb-8">
                <ImageIcon className="w-10 h-10 text-slate-200" />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2 tracking-tight">악보 뷰어</h3>
              <p className="text-sm font-bold text-slate-400">목록에서 곡을 선택하여 악보를 확인하세요.</p>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              className="h-full w-full flex flex-col"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              {/* Viewer Header */}
              <div className="p-8 pb-4 border-b border-slate-50 flex items-start justify-between bg-white z-10">
                <div className="flex-1">
                  {isEditing ? (
                    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-top-4">
                      <div className="flex gap-2">
                        <input 
                          type="number"
                          value={editedNumber}
                          onChange={(e) => setEditedNumber(parseInt(e.target.value, 10))}
                          className="w-20 px-3 py-3 bg-white border border-slate-300 rounded-2xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 text-slate-950 shadow-sm"
                          placeholder="번호"
                        />
                        <input 
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-2xl text-sm font-black focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500 text-slate-950 shadow-sm"
                          placeholder="곡 제목"
                        />
                      </div>
                      
                      <div className="flex gap-3">
                        <input 
                          type="text"
                          value={editedCategory}
                          onChange={(e) => setEditedCategory(e.target.value)}
                          className="w-32 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 shadow-sm"
                          placeholder="분류 (태그)"
                        />
                        <input 
                          type="text"
                          value={editedCode}
                          onChange={(e) => setEditedCode(e.target.value)}
                          className="w-24 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 shadow-sm uppercase"
                          placeholder="코드 (예: G)"
                        />
                        <input 
                          type="text"
                          value={editedMeter}
                          onChange={(e) => setEditedMeter(e.target.value)}
                          className="w-20 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-black text-slate-900 shadow-sm"
                          placeholder="박자 (4/4)"
                        />
                        <button 
                          onClick={handleUpdateSong}
                          className="ml-auto px-6 py-2 bg-red-600 text-white rounded-xl text-xs font-black shadow-lg shadow-red-200 hover:bg-red-700 transition-all"
                        >
                          저장 완료
                        </button>
                        <button 
                          onClick={() => setIsEditing(false)}
                          className="px-6 py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-black hover:bg-slate-200 transition-all"
                        >
                          취소
                        </button>
                        <div className="ml-auto flex items-center gap-5 pl-4 border-l border-slate-200">
                           <label className="flex items-center gap-2 cursor-pointer group">
                              <input 
                                type="checkbox"
                                checked={isDeleteOriginal}
                                onChange={(e) => setIsDeleteOriginal(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer"
                              />
                              <div className="flex flex-col">
                                <span className="text-[11px] font-black text-slate-700 group-hover:text-red-600 transition-colors">pc원본 폴더의 악보파일도 삭제</span>
                              </div>
                           </label>
                           <button 
                             onClick={handleDeleteSong}
                             className={`p-3 rounded-xl transition-all flex items-center gap-2 font-black text-xs ${
                               isDeleteOriginal ? 'bg-red-500 text-white shadow-lg shadow-red-200' : 'bg-red-50 text-red-500 hover:bg-red-100'
                             }`}
                             title={isDeleteOriginal ? "원본 파일 포함 삭제" : "앱 데이터만 삭제"}
                           >
                             <Trash2 className="w-4 h-4" />
                             {isDeleteOriginal && <span>원본포함삭제</span>}
                           </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                            {selectedSong?.number}. {selectedSong?.title}
                          </h2>
                          <div className="flex gap-1.5">
                            {selectedSong?.meter && <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded-lg text-[10px] font-black border border-green-100">{selectedSong.meter}</span>}
                            {selectedSong?.code && <span className="px-2 py-0.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black border border-red-100">{selectedSong.code} KEY</span>}
                            {selectedSong?.category && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-black border border-blue-100">{selectedSong.category}</span>}
                          </div>
                        </div>
                        <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                          <FolderOpen className="w-3 h-3" />
                          {albums.find(a => selectedSong?.id.startsWith(`${a.id}-`))?.name || '앨범 미지정'}
                          {selectedSong?.isManual && <span className="ml-2 text-red-500">[수동 수정됨]</span>}
                        </p>
                      </div>
                      
                      <div className="flex gap-2 self-start pt-1">
                        <button 
                          onClick={startEditing}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black transition-all flex items-center gap-2"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          상세 편집
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Viewer Main Body */}
              <div className="flex-1 overflow-auto bg-slate-50/50 p-8 custom-scrollbar relative">
                {isEditing && (
                  <div className="mb-8 max-w-4xl mx-auto">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-1">가사 편집</p>
                    <textarea 
                      value={editedLyrics}
                      onChange={(e) => setEditedLyrics(e.target.value)}
                      className="w-full h-40 px-6 py-4 bg-white border border-slate-300 rounded-[2rem] text-sm leading-loose focus:outline-none focus:ring-4 focus:ring-red-500/10 text-slate-950 font-black shadow-md"
                      placeholder="가사를 입력해 주세요..."
                    />
                  </div>
                )}
                
                <div 
                  className="bg-white shadow-2xl rounded-2xl mx-auto overflow-hidden transition-all duration-300 transform-gpu origin-top"
                  style={{ 
                    width: `${850 * zoomScale}px`,
                    height: 'fit-content',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)'
                  }}
                >
                    <img 
                      src={`hymnal-resource://${selectedSong?.filePath || selectedSong?.filename}`} 
                      alt={selectedSong?.title}
                      className="w-full h-auto block" 
                      draggable={false}
                    />
                </div>
              </div>

              {/* Floating Zoom Controls */}
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
                <div className="flex items-center bg-slate-900 text-white rounded-full shadow-2xl p-2 gap-1 backdrop-blur-md bg-opacity-90 ring-1 ring-white/10">
                  <button 
                    onClick={() => setZoomScale(Math.max(zoomScale - 0.2, 0.4))}
                    className="p-3 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <ZoomOut className="w-5 h-5" />
                  </button>
                  <div className="px-4 min-w-[70px] text-center border-x border-white/10">
                    <span className="text-sm font-black">{Math.round(zoomScale * 100)}%</span>
                  </div>
                  <button 
                    onClick={() => setZoomScale(Math.min(zoomScale + 0.2, 3))}
                    className="p-3 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <ZoomIn className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={() => setZoomScale(0.6)}
                    className="ml-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-full text-xs font-black transition-all active:scale-95"
                  >
                    기본(60%)
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* --- Modals (Provider 상태 사용) --- */}
      
      {/* 앨범 설정 모달 */}
      <AnimatePresence>
        {showAlbumModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAlbumModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 overflow-hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {editingAlbum ? '앨범 설정 수정' : '새 데이터 앨범 추가'}
                </h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block pl-1">앨범 이름</label>
                  <input 
                    type="text" 
                    value={albumInput}
                    onChange={(e) => setAlbumInput(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold focus:outline-none focus:ring-4 focus:ring-red-500/10 focus:border-red-500"
                    placeholder="예: CCM 베스트 2024"
                  />
                </div>

                {editingAlbum && (
                  <button 
                    onClick={() => updateAlbumPath(editingAlbum.id)}
                    className="w-full flex items-center justify-between p-5 bg-slate-50 border border-dashed border-slate-300 rounded-2xl hover:border-red-400 hover:bg-red-50 transition-all group"
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">현재 연결된 폴더</p>
                      <p className="text-xs font-bold text-slate-600 truncate max-w-[200px]">{editingAlbum.path || '폴더 미지정'}</p>
                    </div>
                    <Settings className="w-5 h-5 text-slate-400 group-hover:text-red-500" />
                  </button>
                )}

                <div className="flex gap-3 pt-4">
                  <button 
                    onClick={() => {
                      if (editingAlbum) updateAlbum({ ...editingAlbum, name: albumInput });
                      else addAlbum(albumInput);
                      setShowAlbumModal(false);
                    }}
                    className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-black shadow-xl shadow-red-200 hover:bg-red-700 transition-all active:scale-95"
                  >
                    {editingAlbum ? '설정 저장' : '앨범 생성'}
                  </button>
                  {editingAlbum && (
                    <button 
                      onClick={() => {
                        if (confirm('앨범을 삭제하시겠습니까? 데이터베이스에서만 제거되며 원본 파일은 보존됩니다.')) {
                          deleteAlbum(editingAlbum.id);
                          setShowAlbumModal(false);
                        }
                      }}
                      className="p-4 bg-slate-100 text-red-500 rounded-2xl hover:bg-red-50 transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 데이터 빌더 모달 */}
      <AnimatePresence>
        {showBuilder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !processingProgress && setShowBuilder(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] shadow-2xl p-10"
            >
              <div className="flex items-center justify-between mb-10">
                <div className="space-y-1">
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">데이터 빌더 시스템</h3>
                  <p className="text-sm font-bold text-slate-400 italic">
                    이미지 파일을 분석하여 데이터를 자동 생성합니다.<br/>
                    <span className="text-red-400/80">(PC의 폴더의 악보 목록을 가져옵니다)</span>
                  </p>
                </div>
                {!processingProgress && (
                  <button onClick={() => setShowBuilder(false)} className="p-3 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-300" />
                  </button>
                )}
              </div>

              <div className="space-y-8">
                <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 block pl-1">분석 및 빌드 대상 앨범</label>
                  <div className="grid grid-cols-2 gap-3">
                    {albums.map(a => (
                      <button 
                        key={a.id}
                        onClick={() => setActiveAlbumId(a.id)}
                        className={`p-4 rounded-2xl text-xs font-black transition-all border ${
                          activeAlbumId === a.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-500 hover:border-red-200'
                        }`}
                      >
                        {a.name}
                      </button>
                    ))}
                  </div>
                </div>

                {activeAlbumId !== 'all' && activeAlbum && (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center gap-4 p-5 bg-red-50 rounded-2xl border border-red-100">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                        <FolderOpen className="w-6 h-6 text-red-500" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] font-black text-red-400 uppercase">연결된 폴더</p>
                        <p className="text-xs font-black text-slate-800 truncate">{activeAlbum.path || '경로가 없습니다. 폴더 선택 버튼을 눌러주세요.'}</p>
                      </div>
                      <button 
                        onClick={() => updateAlbumPath(activeAlbumId)}
                        className="px-4 py-2 bg-white text-red-600 rounded-xl text-[10px] font-black border border-red-200 shadow-sm"
                      >
                         폴더 변경
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <button 
                        onClick={() => processImages(activeAlbumId, true)}
                        disabled={!activeAlbum.path || !!processingProgress}
                        className="py-6 bg-red-500 text-white rounded-[2rem] font-black shadow-xl shadow-red-100 hover:bg-red-600 transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center gap-2"
                      >
                        <Plus className="w-6 h-6" />
                        <span>새곡 추가 빌드</span>
                      </button>
                      <button 
                        onClick={() => processImages(activeAlbumId, false)}
                        disabled={!activeAlbum.path || !!processingProgress}
                        className="py-6 bg-slate-100 text-slate-600 rounded-[2rem] font-black hover:bg-slate-200 transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center gap-2"
                      >
                        <RefreshCw className="w-6 h-6" />
                        <span>전체 다시 빌드</span>
                      </button>
                    </div>
                  </div>
                )}

                {processingProgress && (
                  <div className="space-y-5 py-4 animate-in zoom-in-95 duration-300">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-black text-slate-900">데이터 처리 중...</span>
                      <span className="text-2xl font-black text-red-500">{Math.round((processingProgress.processed / processingProgress.total) * 100)}%</span>
                    </div>
                    <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden p-1 shadow-inner border border-slate-200">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(processingProgress.processed / processingProgress.total) * 100}%` }}
                        className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                      />
                    </div>
                    <p className="text-xs text-slate-400 text-center font-bold">({processingProgress.processed} / {processingProgress.total} 곡 분석 완료)</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
