import React from 'react';
import { motion } from 'framer-motion';
import { 
  Library, 
  X, 
  Trash2, 
  Calendar, 
  Layout, 
  ChevronRight, 
  Download 
} from 'lucide-react';

interface SavedContisModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedContis: any[];
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export const SavedContisModal: React.FC<SavedContisModalProps> = ({ 
  isOpen, 
  onClose, 
  savedContis, 
  onLoad, 
  onDelete 
}) => {
  if (!isOpen) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[11000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-6 no-print"
      onClick={onClose}
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Library className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 leading-none">내 콘티 저장소</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase mt-1.5 tracking-wider">과거 작업물을 자유롭게 불러오세요</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {savedContis.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Download className="w-12 h-12 mb-4 opacity-20" />
              <p className="font-bold text-sm">저장된 콘티가 아직 없습니다.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {savedContis.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).map((conti) => (
                <div 
                  key={conti.id} 
                  className="group relative bg-white border border-slate-100 p-5 rounded-2xl hover:border-indigo-200 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer flex items-center justify-between"
                  onClick={() => { onLoad(conti.id); onClose(); }}
                >
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-indigo-50 group-hover:border-indigo-100 transition-colors">
                      <Calendar className="w-5 h-5 text-slate-400 group-hover:text-indigo-500" />
                    </div>
                    <div>
                      <h3 className="font-black text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{conti.title}</h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                          <Layout className="w-3 h-3" /> {conti.items?.length || 0}곡 배치됨
                        </span>
                        <div className="w-1 h-1 bg-slate-200 rounded-full" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                          {new Date(conti.updatedAt).toLocaleDateString('ko-KR', { year:'numeric', month:'2-digit', day:'2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(conti.id); }}
                      className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};
