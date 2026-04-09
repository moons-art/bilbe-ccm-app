import React, { useRef, useState, useEffect } from 'react';
import { useHymnal } from '../../stores/HymnalProvider';
import type { ContiItem } from '../../stores/HymnalProvider';
import { 
  Trash2, 
  RotateCcw,
  Layout,
  CheckCircle2,
  ChevronLeft,
  Scissors,
  Check,
  Search,
  Hash,
  StickyNote,
  GripVertical,
  Save,
  Library,
  X,
  Calendar,
  ChevronRight,
  Download,
  Plus,
  Minus,
  DoorOpen
} from 'lucide-react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { SavedContisModal } from './SavedContisModal';

const MARGIN_PX = 55; // 안전 여백

// Internal SavedContisModal removed and replaced by shared component

// --- Pro Crop Overlay Component ---
const CropEditor: React.FC<{
  item: ContiItem;
  song: any;
  onSave: (crop: NonNullable<ContiItem['crop']>, width: number) => void;
  onCancel: () => void;
}> = ({ item, song, onSave, onCancel }) => {
  const [crop, setCrop] = useState(item.crop || { top: 0, bottom: 0, left: 0, right: 0 });
  const [zoom, setZoom] = useState(item.width);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.05;
    setZoom(prev => Math.max(1, Math.min(100, prev + delta)));
  };

  const handleReset = () => {
    setCrop({ top: 0, bottom: 0, left: 0, right: 0 });
    setZoom(25);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[10000] bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center no-print"
      onWheel={handleWheel}
    >
        <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center">
            <h3 className="text-white text-lg font-black tracking-tight">{song?.title} - 자르기 편집</h3>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">상자 모서리를 잡아당겨 자르기 • 마우스 휠로 확대</p>
        </div>

        <div ref={containerRef} className="relative w-[80vw] h-[70vh] flex items-center justify-center overflow-hidden">
            <div className="relative transition-transform duration-200 ease-out" style={{ width: `${zoom}%` }}>
               <img src={`hymnal-resource://${song?.filePath || song?.filename}`} className="w-full h-auto block select-none pointer-events-none" alt="preview" />
               
               {/* Dimmed Area */}
               <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-0 left-0 right-0 bg-black/60" style={{ height: `${crop.top}%` }} />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60" style={{ height: `${crop.bottom}%` }} />
                  <div className="absolute top-[var(--top)] bottom-[var(--bottom)] left-0 bg-black/60" 
                    style={{ '--top': `${crop.top}%`, '--bottom': `${crop.bottom}%`, width: `${crop.left}%` } as any} />
                  <div className="absolute top-[var(--top)] bottom-[var(--bottom)] right-0 bg-black/60" 
                    style={{ '--top': `${crop.top}%`, '--bottom': `${crop.bottom}%`, width: `${crop.right}%` } as any} />
               </div>

               {/* Resizable Crop Box */}
               <div className="absolute border-2 border-indigo-400 shadow-2xl cursor-move" style={{ top: `${crop.top}%`, left: `${crop.left}%`, right: `${crop.right}%`, bottom: `${crop.bottom}%` }}
                 onPointerDown={(e) => {
                    const rect = (e.currentTarget as HTMLElement).parentElement!.getBoundingClientRect();
                    const startX = e.clientX; const startY = e.clientY; const startCrop = { ...crop };
                    const move = (me: PointerEvent) => {
                       const dx = ((me.clientX - startX) / rect.width) * 100;
                       const dy = ((me.clientY - startY) / rect.height) * 100;
                       const nLeft = Math.max(0, Math.min(100 - (100-startCrop.right-startCrop.left), startCrop.left + dx));
                       const nTop = Math.max(0, Math.min(100 - (100-startCrop.bottom-startCrop.top), startCrop.top + dy));
                       setCrop({ top: nTop, bottom: startCrop.bottom - (nTop-startCrop.top), left: nLeft, right: startCrop.right - (nLeft-startCrop.left) });
                    };
                    const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
                    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
                 }}
               >
                  {/* Handles */}
                  {[
                    { style: 'top-[-6px] left-[-6px] cursor-nw-resize', type: 'tl' },
                    { style: 'top-[-6px] right-[-6px] cursor-ne-resize', type: 'tr' },
                    { style: 'bottom-[-6px] left-[-6px] cursor-sw-resize', type: 'bl' },
                    { style: 'bottom-[-6px] right-[-6px] cursor-se-resize', type: 'br' },
                    { style: 'top-[-6px] left-1/2 -translate-x-1/2 cursor-n-resize h-3 w-10 bg-indigo-400', type: 'n' },
                    { style: 'bottom-[-6px] left-1/2 -translate-x-1/2 cursor-s-resize h-3 w-10 bg-indigo-400', type: 's' },
                  ].map(h => (
                    <div key={h.type} className={`absolute z-[10] border-2 border-white bg-indigo-500 rounded-full shadow-lg ${h.style} ${!h.style.includes('h-') ? 'w-5 h-5' : ''}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        const rect = (e.currentTarget as HTMLElement).parentElement!.parentElement!.getBoundingClientRect();
                        const sX = e.clientX; const sY = e.clientY; const sC = { ...crop };
                        const move = (me: PointerEvent) => {
                          const dx = ((me.clientX - sX) / rect.width) * 100;
                          const dy = ((me.clientY - sY) / rect.height) * 100;
                          setCrop(prev => {
                            const n = { ...prev };
                            if (h.type.includes('n')) n.top = Math.max(0, Math.min(100 - prev.bottom - 2, sC.top + dy));
                            if (h.type.includes('s')) n.bottom = Math.max(0, Math.min(100 - prev.top - 2, sC.bottom - dy));
                            if (h.type.includes('l')) n.left = Math.max(0, Math.min(100 - prev.right - 2, sC.left + dx));
                            if (h.type.includes('r')) n.right = Math.max(0, Math.min(100 - prev.left - 2, sC.right - dx));
                            return n;
                          });
                        };
                        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
                        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
                      }}
                    />
                  ))}
               </div>
            </div>
        </div>

        <div className="absolute bottom-12 flex items-center gap-8 bg-white/10 backdrop-blur-3xl px-10 py-5 rounded-[2.5rem] border border-white/20 shadow-2xl">
           <button onClick={handleReset} className="text-slate-300 text-xs font-black uppercase hover:text-white transition-colors">초기화</button>
           <div className="w-px h-6 bg-white/10" />
           <div className="flex items-center gap-6">
              <Search className="w-4 h-4 text-indigo-400" />
              <input type="range" min="1" max="100" step="0.1" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-48 accent-indigo-500 cursor-pointer" />
              <span className="text-white font-mono text-sm">{zoom.toFixed(1)}%</span>
           </div>
           <div className="flex items-center gap-3">
              <button onClick={onCancel} className="px-6 py-2.5 rounded-2xl text-xs font-black text-slate-400 hover:text-white">취소</button>
              <button onClick={() => onSave(crop, zoom)} className="px-10 py-3 rounded-2xl text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-xl flex items-center gap-2">
                <Check className="w-4 h-4" /> 적용하기
              </button>
           </div>
        </div>
    </motion.div>
  );
};

// --- Sub-component for individual page content to keep it clean ---
const PageContent: React.FC<{ 
  pNum: number, 
  canvasWidth: number, 
  canvasHeight: number,
  activeItemId: string | null,
  setActiveItemId: (id: string | null) => void,
  setCropEditingId: (id: string | null) => void,
  isPreviewMode: boolean
}> = ({ pNum, canvasWidth, canvasHeight, activeItemId, setActiveItemId, setCropEditingId, isPreviewMode }) => {
  const { 
    contiItems, contiTitle, contiTitleFontSize, songs, 
    updateContiItem, removeFromConti, showContiNumbers
  } = useHymnal();
  
  const [imageRatios, setImageRatios] = useState<Record<string, number>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={canvasRef} onMouseDown={() => setActiveItemId(null)} className={`bg-white relative page-break-after overflow-hidden transition-shadow duration-500 ${isPreviewMode ? '' : 'shadow-2xl'}`} style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}>
      {!isPreviewMode && <div className="absolute pointer-events-none no-print border border-slate-200 border-dashed" style={{ left: MARGIN_PX, top: MARGIN_PX, right: MARGIN_PX, bottom: MARGIN_PX }} />}
      
      {/* Title Area - Shared across pages - pointer-events-none added to allow clicks to pass through */}
      <div className="absolute left-0 right-0 z-20 text-center flex flex-col items-center gap-2 group/title no-print pointer-events-none" style={{ top: '30px' }}>
        <div 
          className="w-full font-black text-slate-900 bg-transparent text-center py-4 border-none focus:outline-none transition-all" 
          style={{ fontSize: `${contiTitleFontSize}px` }}
        >
          {contiTitle || "무제목 콘티"}
        </div>
      </div>

      <div className="hidden print:block absolute left-0 right-0 text-center font-black text-black" style={{ top: '30px', fontSize: `${contiTitleFontSize}px` }}>
        {contiTitle && contiTitle.trim() !== '' ? contiTitle : ''}
      </div>

      <AnimatePresence>
        {contiItems.filter(item => item.isVisible && item.page === pNum).map((item) => {
          const song = songs.find(s => s.id === item.songId);
          const isSelected = activeItemId === item.id;
          
          const crop = item.crop || { top: 0, bottom: 0, left: 0, right: 0 };
          const visibleWidthFactor = (100 - crop.left - crop.right) / 100;
          const visibleHeightFactor = (100 - crop.top - crop.bottom) / 100;
          
          return (
            <motion.div
              key={item.id} drag={!isPreviewMode} dragMomentum={false} dragElastic={0} dragConstraints={canvasRef}
              initial={false}
              layout
              onDragStart={() => setActiveItemId(item.id)}
              onDragEnd={(e, info) => {
                 const canvas = canvasRef.current; if (!canvas) return;
                 const rect = canvas.getBoundingClientRect();
                 const el = (e.target as HTMLElement).closest('.conti-item-container');
                 if (!el) return;
                 const elRect = el.getBoundingClientRect();
                 
                 let xPercent = Number((((elRect.left - rect.left) / rect.width) * 100).toFixed(2));
                 let yPercent = Number((((elRect.top - rect.top) / rect.height) * 100).toFixed(2));
                 updateContiItem(item.id, { x: xPercent, y: yPercent });
              }}
              className={`absolute cursor-grab active:cursor-grabbing conti-item-container ${isSelected ? 'z-[100]' : 'z-10'}`}
              animate={{
                x: (item.x * canvasWidth) / 100,
                y: (item.y * canvasHeight) / 100,
              }}
              style={{
                left: 0, top: 0,
                width: `${item.width}%`,
              }}
              onClick={() => setActiveItemId(item.id)}
            >
               {isSelected && !isPreviewMode && (
                 <div 
                   className="absolute -top-14 left-0 flex items-center gap-4 bg-slate-900/90 backdrop-blur-md text-white px-4 py-2.5 rounded-2xl shadow-2xl z-[110] no-print border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200"
                   onMouseDown={(e) => e.stopPropagation()}
                   onClick={(e) => e.stopPropagation()}
                 >
                    <button onClick={(e) => { e.stopPropagation(); setCropEditingId(item.id); }} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 transition-all rounded-xl shadow-lg shadow-indigo-500/30 group whitespace-nowrap">
                      <Scissors className="w-3.5 h-3.5 text-white/90 group-hover:scale-110 transition-transform" />
                      <span className="text-[11px] font-black tracking-tight">악보 자르기</span>
                    </button>
                    
                    <div className="w-px h-4 bg-white/20" />
                    
                    <div className="flex items-center gap-4">
                      <button onClick={(e) => { e.stopPropagation(); updateContiItem(item.id, { isMemoOpen: !item.isMemoOpen }); }} className={`flex items-center gap-2 px-3 py-1.5 transition-all rounded-xl shadow-lg border border-white/10 ${item.isMemoOpen ? 'bg-amber-500 text-white shadow-amber-500/30' : 'bg-white/10 text-slate-400 hover:bg-white/20'}`}>
                        <StickyNote className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-black tracking-tight">메모 {item.isMemoOpen ? 'ON' : 'OFF'}</span>
                      </button>

                      {item.isMemoOpen && (
                        <div className="flex items-center gap-3 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Font</span>
                           <input 
                             type="range" min="10" max="60" step="1" 
                             value={item.memoFontSize || 12} 
                             onMouseDown={(e) => e.stopPropagation()}
                             onChange={(e) => {
                               e.stopPropagation();
                               updateContiItem(item.id, { memoFontSize: Number(e.target.value) });
                             }} 
                             className="w-16 accent-amber-400 h-1 cursor-pointer" 
                           />
                           <span className="text-[10px] font-black font-mono text-amber-300 w-6 text-center">{item.memoFontSize || 12}</span>
                        </div>
                      )}
                    </div>

                    <div className="w-px h-4 bg-white/20" />
                    
                    <div className="flex items-center gap-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">크기</span>
                        <div className="flex items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/5">
                           <button 
                             onMouseDown={(e) => e.stopPropagation()}
                             onClick={(e) => {
                                e.stopPropagation();
                                const nextVal = Math.max(20, item.width - 2);
                                updateContiItem(item.id, { width: nextVal });
                             }}
                             className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                           >
                             <Minus className="w-3.5 h-3.5" />
                           </button>
                           
                           <span className="text-[10px] font-black font-mono text-indigo-300 w-8 text-center">{Math.round(item.width)}%</span>
                           
                           <button 
                             onMouseDown={(e) => e.stopPropagation()}
                             onClick={(e) => {
                                e.stopPropagation();
                                // 여백 기반 최댓값 계산
                                const mX = MARGIN_PX/canvasWidth; const mY = MARGIN_PX/canvasHeight;
                                const xF = item.x/100; const yF = item.y/100;
                                const mR = (1-xF-mX)*100;
                                const c = item.crop || {top:0,bottom:0,left:0,right:0};
                                const vH = (100-c.top-c.bottom)/100; const vW = (100-c.left-c.right)/100;
                                const cR = vH/vW || 1; const aH = (1-yF-mY)*canvasHeight;
                                const mB = (aH/cR/canvasWidth)*100;
                                const dynamicMax = Math.max(20, Math.min(mR, mB || 100));

                                const nextVal = Math.min(dynamicMax, item.width + 2);
                                updateContiItem(item.id, { width: nextVal });
                             }}
                             className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-all"
                           >
                             <Plus className="w-3.5 h-3.5" />
                           </button>
                        </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); removeFromConti(item.id); }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                 </div>
               )}

               <div className="relative w-full overflow-hidden rounded-sm ring-1 ring-slate-200 bg-white" style={{ aspectRatio: `${(imageRatios[item.id] || 1) * (visibleWidthFactor / visibleHeightFactor)}` }}>
                  <img src={`hymnal-resource://${song?.filePath || song?.filename}`} className="absolute block max-w-none" onLoad={(e) => {
                    const r = e.currentTarget.naturalWidth / e.currentTarget.naturalHeight;
                    if (imageRatios[item.id] !== r) setImageRatios(prev => ({ ...prev, [item.id]: r }));
                  }} style={{ width: `${100 / visibleWidthFactor}%`, left: `-${(crop.left / visibleWidthFactor)}%`, top: `-${(crop.top / visibleHeightFactor)}%` }} draggable={false} />
               </div>

               {showContiNumbers && (
                 <div className={`absolute -top-3 -left-3 w-8 h-8 bg-slate-900 border-2 border-white text-white rounded-full items-center justify-center text-sm font-black shadow-xl z-[105] ${!isPreviewMode ? 'flex' : 'hidden print:flex'} print:shadow-none print:bg-black`}>
                    {contiItems.findIndex(i => i.id === item.id) + 1}
                 </div>
               )}

               {isSelected && !isPreviewMode && <div className="absolute -inset-1 border-2 border-indigo-500 rounded-lg pointer-events-none z-[101]" />}
               
               {item.isMemoOpen && (
                  <div className="mt-3 no-print relative group/memo" onMouseDown={(e) => e.stopPropagation()}>
                    <textarea value={item.memo} onChange={(e) => updateContiItem(item.id, { memo: e.target.value })} placeholder="찬양 멘트..." className="w-full bg-white/95 border-2 border-slate-100 rounded-xl p-3 font-bold text-slate-700 shadow-lg focus:border-indigo-200 focus:outline-none transition-all resize-none custom-scrollbar" style={{ fontSize: `${item.memoFontSize || 12}px`, height: 'auto', minHeight: '60px' }} />
                  </div>
               )}
               <div className="hidden print:block text-center mt-3 font-black text-black leading-tight" style={{ fontSize: `${item.memoFontSize || 12}px` }}>{item.memo}</div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};

export const ContiEditor: React.FC = () => {
  const { 
    setIsEditorOpen, contiItems, contiTitle, setContiTitle, paperSize, setPaperSize,
    orientation, setOrientation, updateContiItem, removeFromConti, toggleContiItemVisibility,
    clearConti, songs, contiTitleFontSize, setContiTitleFontSize,
    reorderContiItems, showContiNumbers, setShowContiNumbers,
    isLibraryOpen, setIsLibraryOpen,
    savedContis, saveCurrentConti, loadSavedConti, deleteSavedConti
  } = useHymnal();

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [cropEditingId, setCropEditingId] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const isLandscape = orientation === 'landscape';
  const canvasWidth = isLandscape ? (paperSize === 'A4' ? 1123 : 1587) : (paperSize === 'A4' ? 794 : 1123);
  const canvasHeight = isLandscape ? (paperSize === 'A4' ? 794 : 1123) : (paperSize === 'A4' ? 1123 : 1587);

  const editingItem = contiItems.find(i => i.id === cropEditingId);
  const editingSong = editingItem ? songs.find(s => s.id === editingItem.songId) : null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`fixed inset-0 z-[9999] flex flex-col overflow-hidden select-none transition-colors duration-500 ${isPreviewMode ? 'bg-slate-50' : 'bg-slate-950'}`}>
        <AnimatePresence>
          {cropEditingId && editingItem && editingSong && (
            <CropEditor item={editingItem} song={editingSong} onCancel={() => setCropEditingId(null)} onSave={(newCrop, newWidth) => { updateContiItem(cropEditingId, { crop: newCrop, width: newWidth }); setCropEditingId(null); }} />
          )}
          <SavedContisModal 
            isOpen={isLibraryOpen} 
            onClose={() => setIsLibraryOpen(false)} 
            savedContis={savedContis} 
            onLoad={loadSavedConti} 
            onDelete={deleteSavedConti} 
          />
        </AnimatePresence>

        {/* Top Header - Restructured to 2 Layers */}
        <div className={`bg-white border-b border-slate-200 z-50 no-print transition-all duration-300 shadow-sm ${isPreviewMode ? '-translate-y-full absolute w-full' : 'relative'}`}>
          {/* Layer 1: Title & Main Actions */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100/50">
            <div className="flex items-center gap-5">
              <button onClick={() => setIsEditorOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"><ChevronLeft className="w-6 h-6" /></button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100"><Layout className="w-5 h-5 text-white" /></div>
                <div><h1 className="text-sm font-black text-slate-900 leading-none">콘티 에디터</h1></div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Title Control */}
              <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group transition-all focus-within:ring-2 focus-within:ring-indigo-500/10 focus-within:border-indigo-500/50">
                <input 
                  type="text" value={contiTitle} onChange={(e) => setContiTitle(e.target.value)} 
                  placeholder="콘티 제목 입력..." className="bg-transparent font-bold text-sm text-slate-900 focus:outline-none w-48"
                />
                <div className="w-px h-4 bg-slate-200" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">T-Size</span>
                <input type="range" min="20" max="100" value={contiTitleFontSize} onChange={(e) => setContiTitleFontSize(Number(e.target.value))} className="w-20 accent-indigo-500" />
              </div>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <button 
                onClick={() => setIsLibraryOpen(true)}
                className="px-4 py-2 bg-white hover:bg-slate-50 rounded-lg text-xs font-black text-slate-600 flex items-center gap-2 transition-all border border-slate-200 shadow-sm active:scale-95"
              >
                <Library className="w-4 h-4 text-slate-400" />
                저장소
              </button>

              <button 
                onClick={() => saveCurrentConti()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs font-black text-white flex items-center gap-2 transition-all shadow-lg shadow-indigo-100 active:scale-95"
              >
                <Save className="w-4 h-4" />
                저장하기
              </button>
            </div>
          </div>

          {/* Layer 2: Detailed Setting Tools */}
          <div className="h-14 px-6 flex items-center justify-between bg-slate-50/30">
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowContiNumbers(!showContiNumbers)} 
                className={`px-4 py-2 rounded-lg text-[11px] font-black flex items-center gap-2 transition-all border ${showContiNumbers ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-500 border-slate-200'}`}
              >
                <Hash className="w-3.5 h-3.5" />
                순번 표시 {showContiNumbers ? 'ON' : 'OFF'}
              </button>

              <div className="w-px h-4 bg-slate-200 mx-1" />

              <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                <button 
                  onClick={() => setOrientation('portrait')} 
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${!isLandscape ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  세로
                </button>
                <button 
                  onClick={() => setOrientation('landscape')} 
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${isLandscape ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  가로
                </button>
              </div>

              <div className="flex bg-white p-1 rounded-lg border border-slate-200">
                <button 
                  onClick={() => setPaperSize('A4')} 
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${paperSize === 'A4' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  A4
                </button>
                <button 
                  onClick={() => setPaperSize('A3')} 
                  className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-all ${paperSize === 'A3' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  A3
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setIsPreviewMode(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-900 rounded-lg text-[11px] font-black text-white shadow-lg flex items-center gap-2 transition-all active:scale-95">
                <Search className="w-3.5 h-3.5" />
                미리보기
              </button>

              <button onClick={clearConti} className="p-2 bg-white text-slate-400 hover:text-red-500 rounded-lg border border-slate-200 transition-all flex items-center gap-2 text-[11px] font-black px-4" title="전체 비우기">
                <RotateCcw className="w-4 h-4" />
                비우기
              </button>

              <div className="w-px h-6 bg-slate-200 mx-1" />

              <button onClick={() => window.print()} className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-black shadow-lg transition-all active:scale-95">인쇄하기</button>
              
              <button 
                onClick={() => {
                  if (contiItems.length > 0 && !confirm('변경사항이 저장되지 않을 수 있습니다. 정말 취소하시겠습니까?')) return;
                  setIsEditorOpen(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[11px] font-black flex items-center gap-2 border border-slate-200 transition-all"
              >
                <DoorOpen className="w-3.5 h-3.5" />
                취소하기
              </button>
            </div>
          </div>
        </div>

        {/* Floating Pagination Sidebar / Top Header for Songs */}
        <Reorder.Group 
          axis="x" 
          values={contiItems} 
          onReorder={reorderContiItems}
          className={`bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 overflow-x-auto custom-scrollbar no-print transition-all duration-300 ${isPreviewMode ? 'opacity-0 h-0 p-0 pointer-events-none' : 'opacity-100 h-auto'}`}
        >
           {contiItems
             .filter(item => !item.isVisible || item.page === 1)
             .map((item, idx) => {
               const song = songs.find(s => s.id === item.songId);
               const isAssignedToThisPage = item.isVisible && item.page === 1;
               
               return (
                 <Reorder.Item 
                   key={item.id} 
                   value={item}
                   layout
                   transition={{ type: "spring", stiffness: 700, damping: 40, mass: 0.8 }}
                   className={`flex items-center gap-1 pl-2 pr-5 py-2.5 rounded-2xl border-2 shrink-0 select-none ${isAssignedToThisPage ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : (item.isVisible ? 'opacity-30 border-slate-200 pointer-events-none' : 'bg-slate-50 border-slate-100 text-slate-500')}`}
                 >
                    <div className="p-1 cursor-grab active:cursor-grabbing text-slate-400/50 hover:text-white transition-colors group">
                       <GripVertical className="w-5 h-5 group-active:scale-110" />
                    </div>

                    <button onClick={() => toggleContiItemVisibility(item.id)} className="flex items-center gap-3">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${isAssignedToThisPage ? 'bg-white/20 text-white' : 'bg-white text-slate-300'}`}>{idx + 1}</span>
                      <span className="text-sm font-bold truncate max-w-[150px]">{song?.title}</span>
                      {isAssignedToThisPage && <CheckCircle2 className="w-4 h-4 fill-white text-indigo-600" />}
                    </button>
                 </Reorder.Item>
               );
           })}
        </Reorder.Group>

        {/* Floating Preview Controller */}
        <AnimatePresence>
          {isPreviewMode && (
            <motion.div 
              initial={{ y: -50, opacity: 0 }} 
              animate={{ y: 20, opacity: 1 }} 
              exit={{ y: -50, opacity: 0 }}
              className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] bg-white/80 backdrop-blur-xl border border-slate-200 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 no-print"
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-tighter">인쇄 미리보기 모드</span>
              </div>
              <div className="w-px h-4 bg-slate-200" />
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setIsPreviewMode(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-black transition-colors"
                >
                  편집으로 돌아가기
                </button>
                <button 
                  onClick={() => window.print()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black shadow-lg flex items-center gap-2"
                >
                  지금 인쇄하기
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex-1 overflow-auto p-24 flex flex-col items-center custom-scrollbar transition-all print:p-0 print:m-0 print:overflow-visible print:bg-white ${isPreviewMode ? 'bg-slate-50' : 'bg-slate-100'}`}>
            <div className="relative flex flex-col items-center gap-20 print:gap-0 print:static">
               {/* --- Single-Page Canvas Rendering --- */}
               <div className="flex flex-col items-center transition-opacity duration-300 relative z-10 print:visible print:relative print:pointer-events-auto print:z-10 print:h-auto print:block">
                 <PageContent 
                   pNum={1} 
                   canvasWidth={canvasWidth} 
                   canvasHeight={canvasHeight} 
                   activeItemId={activeItemId} 
                   setActiveItemId={setActiveItemId}
                   setCropEditingId={setCropEditingId}
                   isPreviewMode={isPreviewMode}
                 />
               </div>
            </div>
        </div>
        <style>{`.custom-scrollbar::-webkit-scrollbar { height: 4px; width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } @media print { * { box-shadow: none !important; -webkit-print-color-adjust: exact; } body { margin: 0; padding: 0 !important; background-color: white !important; } .no-print { display: none !important; } .page-break-after { page-break-after: always; display: block !important; margin: 0 auto !important; position: static !important; } @page { size: ${paperSize} ${orientation}; margin: 0; } .bg-slate-950, .bg-slate-100 { background: white !important; } }`}</style>
    </motion.div>
  );
};
