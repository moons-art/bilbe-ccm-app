import React, { useState, useEffect, useCallback } from 'react';
import type { ContiItem } from '../../stores/HymnalProvider';
import { useHymnal } from '../../stores/HymnalProvider';
import { hymnalApi } from '../../api/hymnalApi';
import { X, ChevronLeft, ChevronRight, Library, StickyNote, Monitor, Users, FileText, Loader2, Share2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderViewerProps {
  onClose: () => void;
  onOpenLibrary?: () => void;
}

export const LeaderViewer: React.FC<LeaderViewerProps> = ({ onClose, onOpenLibrary }) => {
  const { contiItems, songs, contiTitle } = useHymnal();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ msg: '', percent: 0 });
  const [genResultUrl, setGenResultUrl] = useState<string | null>(null); // 생성 결과 URL 저장
  
  // 인도자용 뷰어에 표시할 항목 (화면에 배치된 항목들만)
  const visibleItems = contiItems.filter(item => item.isVisible);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showMemo, setShowMemo] = useState(true);
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});

  const handleNext = useCallback(() => {
    if (currentIndex < visibleItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  }, [currentIndex, visibleItems.length]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  // 키보드 방향키 조작 지원
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'm' || e.key === 'M') {
        setShowMemo(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev, onClose]);


  const handleGeneratePDF = async (type: 'leader' | 'congregation') => {
    if (isGenerating) return;
    setIsGenerating(true);
    setGenProgress({ msg: 'PDF 엔진 부팅 중...', percent: 0 });

    // 진행률 구독
    const unsubscribe = hymnalApi.onPDFProgress((data) => {
      setGenProgress(data);
    });

    try {
      const itemsToGenerate = visibleItems.map(item => {
        const song = songs.find(s => s.id === item.songId);
        return {
          id: item.id,
          filename: song?.filename || '',
          // 회중용일 경우 멘트(비고)를 제거하여 생성
          memo: type === 'congregation' ? '' : item.memo,
          memoFontSize: item.memoFontSize || 12,
        };
      });

      const result = await hymnalApi.generatePDF({
        title: contiTitle || '새 찬양 콘티',
        type,
        items: itemsToGenerate
      });

      if (result.success && result.url) {
        setIsGenerating(false); 
        hymnalApi.writeClipboard(result.url);
        setGenResultUrl(result.url); // 결과 URL 세팅 (자동으로 완료 UI 노출)
      } else if (result.message === 'Need Auth') {
        setIsGenerating(false);
        const authUrl = await hymnalApi.getAuthUrl();
        hymnalApi.openExternal(authUrl);
        const code = await hymnalApi.waitForAuthCode();
        if (code) {
          await hymnalApi.confirmAuth(code);
          alert('인증 성공! 다시 한번 [PDF 생성]을 눌러주세요.');
        }
      } else {
        setIsGenerating(false);
        alert(`생성 실패: ${result.message}`);
      }
    } catch (err: any) {
      setIsGenerating(false);
      alert(`오류 발생: ${err.message}`);
    } finally {
      if (unsubscribe) unsubscribe();
    }
  };

  if (visibleItems.length === 0) {
    return (
      <div className="fixed inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center text-white">
        <p className="text-xl font-bold mb-4">현재 콘티에 배치된 악보가 없습니다.</p>
        <button 
          onClick={onClose}
          className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg font-bold"
        >
          돌아가기
        </button>
      </div>
    );
  }

  const safeIndex = currentIndex >= visibleItems.length ? Math.max(0, visibleItems.length - 1) : currentIndex;
  const currentItem = visibleItems[safeIndex];
  const currentSong = songs.find(s => s.id === currentItem.songId);
  const crop = currentItem.crop || { top: 0, bottom: 0, left: 0, right: 0 };
  const visibleWidthFactor = (100 - crop.left - crop.right) / 100;
  const visibleHeightFactor = (100 - crop.top - crop.bottom) / 100;
  
  const currentImageRatio = imageRatios[currentItem.id] || 1; // 가로/세로 비율 (디폴트 1)
  const finalAspectRatio = currentImageRatio * (visibleWidthFactor / visibleHeightFactor);

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="fixed inset-0 z-[10000] bg-zinc-950 flex flex-col overflow-hidden text-white"
      >
        {/* 뷰어 컨트롤 바 (오버레이) */}
        <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 flex items-center justify-between z-50 bg-gradient-to-b from-black/70 to-transparent pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <button 
              onClick={onClose}
              className="p-2 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-md transition-colors"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <div className="flex flex-col">
              <h2 className="text-lg font-black tracking-tight drop-shadow-md">
                {currentSong?.title}
              </h2>
              <span className="text-xs text-white/70 font-bold">
                {currentIndex + 1} / {visibleItems.length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {onOpenLibrary && (
              <button
                onClick={onOpenLibrary}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600/80 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all backdrop-blur-md shadow-lg"
              >
                <Library className="w-4 h-4" />
                <span className="hidden sm:inline">저장소 불러오기</span>
              </button>
            )}

            {/* 모바일 PDF 생성 버튼 (인도자용 / 회중용 분리) */}
            <div className="flex bg-black/40 backdrop-blur-md rounded-xl p-1 shadow-lg border border-white/5">
              <button
                onClick={() => handleGeneratePDF('leader')}
                disabled={isGenerating}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-white/90 rounded-lg text-xs font-bold transition-all"
                title="멘트가 포함된 인도자용 PDF 생성"
              >
                <FileText className="w-3.5 h-3.5 text-red-400" />
                <span>PDF(인도자)</span>
              </button>
              <div className="w-[1px] bg-white/10 mx-1 self-stretch" />
              <button
                onClick={() => handleGeneratePDF('congregation')}
                disabled={isGenerating}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-white/10 text-white/90 rounded-lg text-xs font-bold transition-all"
                title="악보만 있는 회중용 PDF 생성"
              >
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>PDF(회중)</span>
              </button>
            </div>

            <button
              onClick={() => setShowMemo(!showMemo)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all backdrop-blur-md shadow-lg
                ${showMemo 
                  ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/20' 
                  : 'bg-white/10 hover:bg-white/20 text-white/50'
                }`}
            >
              <StickyNote className={`w-4 h-4 ${!showMemo ? 'opacity-50' : ''}`} />
              <span className="hidden sm:inline">멘트 {showMemo ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        {/* 이전/다음 버튼 (오버레이) */}
        <button 
          onClick={handlePrev}
          disabled={currentIndex === 0}
          className="absolute left-4 top-1/2 -translate-y-1/2 p-4 z-50 bg-black/20 hover:bg-black/50 disabled:opacity-0 rounded-full backdrop-blur-sm transition-all"
        >
          <ChevronLeft className="w-10 h-10 text-white" />
        </button>

        <button 
          onClick={handleNext}
          disabled={currentIndex === visibleItems.length - 1}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-4 z-50 bg-black/20 hover:bg-black/50 disabled:opacity-0 rounded-full backdrop-blur-sm transition-all"
        >
          <ChevronRight className="w-10 h-10 text-white" />
        </button>

        {/* 메인 뷰어 영역 */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-12 min-h-0 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.id}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.3 }}
              className="relative flex items-center justify-center w-full h-full max-h-[100%] min-h-0"
            >
              {/* Aspect Ratio Box to contain the cropped image */}
              <div 
                className="relative inline-flex overflow-hidden bg-white rounded-xl shadow-2xl ring-1 ring-white/10"
                style={{ maxWidth: '100%', maxHeight: '100%', margin: 'auto' }}
              >
                {/* 보이지 않는 임시 SVG를 통해 비율 강제 및 부모 영역에 맞춘 반응형 축소 보장 */}
                <svg 
                  viewBox={`0 0 ${finalAspectRatio * 1000} 1000`} 
                  className="block max-w-full max-h-full opacity-0 pointer-events-none" 
                  style={{ height: '100vh', width: 'auto' }}
                />

                <img 
                  src={hymnalApi.resolveImagePath(currentSong?.filePath || currentSong?.filename || '')} 
                  className="absolute block max-w-none top-0 left-0" 
                  onLoad={(e) => { 
                    const img = e.currentTarget;
                    const ratio = img.naturalWidth / img.naturalHeight;
                    setImageRatios(prev => ({
                      ...prev,
                      [currentItem.id]: ratio
                    })); 
                  }} 
                  style={{ 
                    width: `${100 / visibleWidthFactor}%`, 
                    left: `-${(crop.left / visibleWidthFactor)}%`, 
                    top: `-${(crop.top / visibleHeightFactor)}%` 
                  }} 
                  draggable={false} 
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 하단 멘트(Memo) 영역 */}
        <AnimatePresence>
          {showMemo && currentItem.memo && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="w-full flex-none border-t border-white/5 bg-black/40 backdrop-blur-md overflow-hidden"
            >
              <div className="w-full max-w-6xl mx-auto px-6 py-8 pb-10">
                <p 
                  className="text-amber-300 font-extrabold whitespace-pre-wrap text-center leading-relaxed"
                  style={{ fontSize: `${Math.max(20, (currentItem.memoFontSize || 12) * 1.5)}px` }}
                >
                  {currentItem.memo}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* 생성 진행 중 오버레이 */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="relative w-24 h-24 mb-6">
              <Loader2 className="w-full h-full text-indigo-500 animate-spin opacity-20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Share2 className="w-10 h-10 text-indigo-400 animate-pulse" />
              </div>
            </div>
            
            <h3 className="text-xl font-black mb-2 tracking-tight">모바일 악보집 생성 중</h3>
            <p className="text-white/60 text-sm mb-6 leading-relaxed max-w-xs">
              {genProgress.msg || '잠시만 기다려 주세요...'}
            </p>
            
            {/* 프로그레스 바 */}
            <div className="w-64 h-2 bg-white/5 rounded-full overflow-hidden mb-2">
              <motion.div 
                className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                initial={{ width: 0 }}
                animate={{ width: `${genProgress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-xs font-black text-indigo-400">
              {Math.round(genProgress.percent)}%
            </span>

            <p className="mt-8 text-xs text-white/30 italic">
              생성이 완료되면 주소가 클립보드에 자동으로 복사됩니다.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 생성 완료 오버레이 (alert 대신 사용) */}
      <AnimatePresence>
        {genResultUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[12000] bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-[2.5rem] p-10 max-w-sm w-full shadow-2xl"
            >
              <div className="w-20 h-20 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                <Check className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">생성 완료!</h3>
              <p className="text-white/60 text-sm leading-relaxed mb-6">
                프리미엄 모바일 PDF가 구글 드라이브에 안전하게 저장되었습니다.<br/>
                <span className="text-emerald-400 font-bold">링크가 클립보드에 복사되었습니다.</span>
              </p>

              {/* 링크 주소 표시 영역 */}
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 mb-8 group relative">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-black mb-1 text-left">Drive Link</p>
                <p className="text-[11px] text-emerald-400/80 font-mono break-all text-left line-clamp-2 leading-tight">
                  {genResultUrl}
                </p>
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded-xl cursor-pointer"
                     onClick={() => {
                        hymnalApi.writeClipboard(genResultUrl!);
                        alert('링크가 다시 복사되었습니다.');
                     }}>
                  <span className="text-[10px] text-white font-bold">다시 복사하기</span>
                </div>
              </div>
              
              <button
                onClick={() => {
                  setGenResultUrl(null);
                  setIsGenerating(false);
                }}
                className="w-full py-4 bg-white text-black rounded-2xl font-black hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
              >
                닫기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
