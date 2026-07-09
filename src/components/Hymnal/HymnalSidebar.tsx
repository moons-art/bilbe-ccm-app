import React, { useState } from 'react';
import { useHymnal } from '../../stores/HymnalProvider';
import { 
  Music, 
  UploadCloud,
  FilePlus,
  FolderUp,
  Settings,
  HelpCircle
} from 'lucide-react';
import { hymnalApi } from '../../api/hymnalApi';

const TooltipIcon = ({ text }: { text: string }) => (
  <div className="relative group inline-block ml-1" onClick={e => e.stopPropagation()}>
    <HelpCircle className="w-3.5 h-3.5 text-slate-400 hover:text-indigo-500 transition-colors cursor-help" />
    <div className="fixed bottom-[140px] left-4 w-[240px] p-3 bg-slate-800 text-white text-[12px] font-bold leading-relaxed rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-y-2 group-hover:translate-y-0 z-[100] shadow-2xl text-left whitespace-pre-wrap">
      {text}
    </div>
  </div>
);

export const HymnalSidebar: React.FC = () => {
  const [uploadProgress, setUploadProgress] = useState<{ processed: number; total: number } | null>(null);
  const { 
    albums,
    setAlbums,
    songs,
    setSongs,
    activeAlbumId, 
    setActiveAlbumId,
    setEditingAlbum,
    setShowAlbumModal,
    isSyncing,
    setIsSyncing
  } = useHymnal();

  // 대량 앨범 업로드 처리
  const handleAlbumUpload = async (isHymnal: boolean = false) => {
    try {
      const files = await hymnalApi.selectFolderForAlbum();
      if (!files || files.length === 0) return;
      
      const albumName = isHymnal ? '새찬송가' : prompt('업로드할 앨범 이름을 입력해주세요:', '새 앨범');
      if (!albumName) return;

      setIsSyncing(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const uploadedSongs = await hymnalApi.batchUploadImagesToGDrive(files, albumName, (processed, total) => {
        setUploadProgress({ processed, total });
      });

      // 1. 노래 목록 업데이트
      const updatedSongs = [...songs, ...uploadedSongs];
      setSongs(updatedSongs);
      
      // 구글 API 동적으로 불러와서 JSON 저장
      const { gdriveWebService } = await import('../../api/gdriveWebService');
      await gdriveWebService.uploadJsonFile('music_data.json', updatedSongs);

      // 2. 앨범 목록 업데이트
      const albumId = isHymnal ? 'hymnal' : albumName;
      if (!albums.find(a => a.id === albumId)) {
        const newAlbums = [...albums, { id: albumId, name: albumName }];
        setAlbums(newAlbums);
        await gdriveWebService.uploadJsonFile('settings.json', { albums: newAlbums });
      }

      alert('업로드가 완료되었습니다!');
    } catch (e: any) {
      console.error(e);
      alert(`업로드 중 오류가 발생했습니다: ${e?.message || e}`);
    } finally {
      setIsSyncing(false);
      setUploadProgress(null);
    }
  };

  // 낱개 파일 추가 처리
  const handleSingleFileUpload = async () => {
    try {
      const files = await hymnalApi.selectMultipleFiles();
      if (!files || files.length === 0) return;

      setIsSyncing(true);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const uploadedSongs = await hymnalApi.uploadSingleImagesToGDrive(files, (processed, total) => {
        // progress callback
      });

      // 병합 로직: 새찬송가 업로드 시, 기존 기본 목록(hymnal_default.json)의 항목과 합칩니다.
      const updatedSongs = [...songs];
      for (const newSong of uploadedSongs) {
        const existingIndex = updatedSongs.findIndex(s => 
          (s.albumId === newSong.albumId || (s.albumId === 'hymnal' && newSong.albumId === 'hymnal')) 
          && (s.number === newSong.number || s.title === newSong.title)
        );
        if (existingIndex !== -1) {
          updatedSongs[existingIndex] = { ...updatedSongs[existingIndex], ...newSong, id: updatedSongs[existingIndex].id };
        } else {
          updatedSongs.push(newSong);
        }
      }

      setSongs(updatedSongs);
      const { gdriveWebService } = await import('../../api/gdriveWebService');
      await gdriveWebService.uploadJsonFile('music_data.json', updatedSongs);

      if (!albums.find(a => a.id === 'misc')) {
        const newAlbums = [...albums, { id: 'misc', name: '기타파일앨범' }];
        setAlbums(newAlbums);
        await gdriveWebService.uploadJsonFile('settings.json', { albums: newAlbums });
      }

      alert('낱개 파일 업로드가 완료되었습니다!');
    } catch (e: any) {
      console.error(e);
      alert(`업로드 중 오류가 발생했습니다: ${e?.message || e}`);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* 앨범 목록 섹션 */}
      <div>
        <div className="mb-4 px-2 space-y-1">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">앨범 목록</h2>
          <p className="text-[10px] text-slate-400">*앱의 설정은 로그인한 모든 기기에서 연동됩니다</p>
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
          </button>

          {albums.map((album) => (
            <div 
              key={album.id}
              onClick={() => setActiveAlbumId(album.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer ${
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
            </div>
          ))}
        </div>
      </div>

      {/* 업로드 도구 섹션 */}
      <div className="space-y-6">
        {/* PC용 업로드 */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-bold text-indigo-400 uppercase px-2 mb-2 flex items-center">
            PC용 (폴더 업로드)
          </h2>
          <button 
            onClick={() => handleAlbumUpload(false)}
            disabled={isSyncing}
            className="w-full p-4 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-200 transition-all flex flex-col items-center gap-2 group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FolderUp className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
            <div className="flex items-center">
              <span className="text-xs font-bold">{isSyncing ? '업로드 준비 중...' : '앨범 업로드'}</span>
              <TooltipIcon text="[앨범 업로드] 기능을 사용하면 앨범이 구글드라이브에 통째로 업로드 되고 앨범 목록이 자동으로 생성됩니다." />
            </div>
          </button>
          
          <button 
            onClick={() => handleAlbumUpload(true)}
            disabled={isSyncing}
            className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-all flex flex-col items-center justify-center gap-1.5 group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <UploadCloud className="w-4 h-4 text-slate-500" />
            <div className="flex items-center text-center">
              <span className="text-[11px] font-bold leading-tight">찬송가 앨범 업로드<br/>(최초 1회만)</span>
              <TooltipIcon text="[찬송가 앨범 업로드] 기능으로 최초 1회 업로드 바랍니다. 찬송가는 기본 앨범으로 등록되어 있으나, 용량 관계상 악보 이미지는 사용자가 직접 업로드 하셔야 합니다." />
            </div>
          </button>
        </div>

        {/* PC/모바일용 업로드 */}
        <div className="space-y-2">
          <h2 className="text-[11px] font-bold text-emerald-500 uppercase px-2 mb-2">PC + 모바일용</h2>
          <button 
            onClick={handleSingleFileUpload}
            disabled={isSyncing}
            className="w-full p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-200 transition-all flex flex-col items-center gap-2 group shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FilePlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <div className="flex items-center">
              <span className="text-xs font-bold">{isSyncing ? '업로드 준비 중...' : '파일 추가 (낱개 악보)'}</span>
              <TooltipIcon text="기기의 폴더를 열어 악보를 개별로 추가하는 기능입니다. 구글 드라이브(CEUM_ccm_data)에 연동되어 저장되며, 앱의 [기타파일] 앨범에 자동으로 추가됩니다." />
            </div>
          </button>
        </div>

        {/* 진행률 표시기 */}
        {uploadProgress && (
          <div className="mt-4 p-4 bg-slate-800 text-white rounded-2xl shadow-xl border border-slate-700 animate-in fade-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold">업로드 진행률</span>
              <span className="text-xs font-black text-indigo-400">{Math.round((uploadProgress.processed / uploadProgress.total) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(uploadProgress.processed / uploadProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              {uploadProgress.processed} / {uploadProgress.total} 개 완료
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
