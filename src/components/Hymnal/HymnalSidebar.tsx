import React from 'react';
import { useHymnal } from '../../stores/HymnalProvider';
import { 
  Plus, 
  Settings, 
  RefreshCw, 
  Download, 
  Upload, 
  Music, 
  HardDrive, 
  ChevronRight,
  FolderOpen
} from 'lucide-react';

export const HymnalSidebar: React.FC = () => {
  const { 
    albums, 
    activeAlbumId, 
    setActiveAlbumId, 
    isSyncing, 
    syncAlbum, 
    exportCSV, 
    importCSV,
    setShowBuilder,
    setShowAlbumModal,
    setEditingAlbum
  } = useHymnal();

  const activeAlbum = albums.find(a => a.id === activeAlbumId);

  return (
    <div className="space-y-6">
      {/* Album Section */}
      <div>
        <div className="flex items-center justify-between mb-4 px-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">앨범 목록</h2>
          <button 
            onClick={() => {
              setEditingAlbum(null);
              setShowAlbumModal(true);
            }}
            className="p-1 hover:bg-red-50 text-red-500 rounded-md transition-all"
            title="새 앨범 추가"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        <div className="space-y-1">
          <button 
            onClick={() => setActiveAlbumId('all')}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
              activeAlbumId === 'all' 
                ? 'bg-slate-800 text-white shadow-lg' 
                : 'hover:bg-slate-50 text-slate-600'
            }`}
          >
            <Music className="w-4 h-4" />
            <span className="text-sm font-bold flex-1 text-left">전체 곡 보기</span>
            {activeAlbumId === 'all' && <ChevronRight className="w-4 h-4" />}
          </button>

          {albums.map((album) => (
            <div key={album.id} className="group relative">
              <button 
                onClick={() => setActiveAlbumId(album.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  activeAlbumId === album.id 
                    ? 'bg-red-500 text-white shadow-lg shadow-red-100' 
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${activeAlbumId === album.id ? 'bg-white' : 'bg-red-400'}`} />
                <span className="text-sm font-bold flex-1 text-left truncate">{album.name}</span>
                {activeAlbumId === album.id && (
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAlbum(album);
                      setShowAlbumModal(true);
                    }}
                    className="p-1 hover:bg-red-400 rounded-md text-white transition-all"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Management Section */}
      <div className="pt-2 space-y-3">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">관리 도구</h2>
        
        {activeAlbumId !== 'all' && activeAlbum && (
          <div className="space-y-2">
            <button 
              onClick={() => syncAlbum(activeAlbumId)}
              disabled={isSyncing}
              className={`w-full p-5 rounded-2xl border flex flex-col items-center gap-3 transition-all group ${
                isSyncing ? 'bg-red-50 border-red-100 text-red-400' : 'bg-white border-slate-100 text-slate-600 hover:border-red-200 hover:shadow-md'
              }`}
            >
              <RefreshCw className={`w-6 h-6 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500 text-red-500'}`} />
              <div className="text-center space-y-1">
                <p className="text-sm font-black text-slate-900">드라이브 동기화</p>
                <div className="flex items-center justify-center gap-1.5 py-1 px-3 bg-red-50 rounded-full border border-red-100 mx-auto">
                   <FolderOpen className="w-3 h-3 text-red-500" />
                   <p className="text-[11px] font-black text-red-600">[{activeAlbum.name}]</p>
                </div>
                <p className="text-[9px] text-slate-400 font-bold leading-tight pt-1">
                  (구글 드라이브의 목록이<br/>앱의 목록으로 대체됩니다)
                </p>
              </div>
            </button>
          </div>
        )}

        <button 
          onClick={() => setShowBuilder(true)}
          className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-100 text-slate-600 hover:bg-white hover:border-red-200 hover:shadow-md transition-all flex flex-col items-center gap-2 group"
        >
          <HardDrive className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-bold">데이터 빌더 실행</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={() => exportCSV(activeAlbumId)}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-slate-100 text-slate-500 hover:border-blue-200 hover:text-blue-600 transition-all hover:bg-blue-50/30"
          >
            <Download className="w-4 h-4" />
            <span className="text-[10px] font-bold">CSV 내보내기</span>
          </button>
          <button 
            onClick={() => importCSV()}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-slate-100 text-slate-500 hover:border-green-200 hover:text-green-600 transition-all hover:bg-green-50/30"
          >
            <Upload className="w-4 h-4" />
            <span className="text-[10px] font-bold">CSV 가져오기</span>
          </button>
        </div>
      </div>
    </div>
  );
};
