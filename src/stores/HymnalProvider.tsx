import React, { createContext, useContext, useState, useEffect } from 'react';
import type { HymnalSong } from '../types/hymnal';
import { hymnalService } from '../services/hymnalService';
import { hymnalApi } from '../api/hymnalApi';

export interface Album {
  id: string;
  name: string;
  path: string;
  type: 'fixed' | 'custom';
}

export interface ContiItem {
  id: string;      // 콘티 내 고유 ID
  songId: string;  // 원본 곡 ID
  x: number;       // 캔버스 내 X 좌표 (%)
  y: number;       // 캔버스 내 Y 좌표 (%)
  width: number;   // 너비 (%)
  height: number;  // 높이 (%) (비율 유지를 위해 자동 계산 권장)
  memo: string;    // 개별 악보 메모
  order: number;   // 순서
  crop?: { top: number; bottom: number; left: number; right: number }; // % 기반 자르기
  isVisible: boolean; // 캔버스 표시 여부
  memoFontSize?: number; // 메모 글자 크기
  isMemoOpen?: boolean; // 메모창 열림 여부
  page?: number;       // 배치된 페이지 번호
}

interface HymnalContextType {
  songs: HymnalSong[];
  filteredSongs: HymnalSong[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedSongId: string | null;
  setSelectedSongId: (id: string | null) => void;
  isLoading: boolean;
  isSyncing: boolean;
  setIsSyncing: (val: boolean) => void;
  
  // Albums
  albums: Album[];
  activeAlbumId: string;
  setActiveAlbumId: (id: string) => void;
  addAlbum: (name: string) => Promise<void>;
  updateAlbum: (album: Album) => Promise<void>;
  deleteAlbum: (id: string) => Promise<void>;
  updateAlbumPath: (id: string) => Promise<void>;
  
  // Sync & Build
  processingProgress: { processed: number; total: number } | null;
  syncAlbum: (albumId: string) => Promise<void>;
  processImages: (albumId: string, isIncremental: boolean) => Promise<void>;
  
  // CSV
  exportCSV: (albumId: string) => Promise<void>;
  importCSV: () => Promise<void>;

  // --- Conti Editor ---
  contiItems: ContiItem[];
  contiTitle: string;
  setContiTitle: (title: string) => void;
  paperSize: 'A4' | 'A3';
  setPaperSize: (size: 'A4' | 'A3') => void;
  contiTitleFontSize: number;
  setContiTitleFontSize: (size: number) => void;
  showContiNumbers: boolean;
  setShowContiNumbers: (val: boolean) => void;
  orientation: 'portrait' | 'landscape';
  setOrientation: (val: 'portrait' | 'landscape') => void;
  itemsPerPage: number;
  setItemsPerPage: (val: number) => void;
  isEditorOpen: boolean;
  setIsEditorOpen: (val: boolean) => void;
  isLibraryOpen: boolean;
  setIsLibraryOpen: (val: boolean) => void;
  
  // Saved Contis
  savedContis: any[];
  currentContiId: string | null;
  saveCurrentConti: (name?: string) => Promise<void>;
  loadSavedConti: (id: string) => Promise<void>;
  deleteSavedConti: (id: string) => Promise<void>;
  fetchSavedContis: () => Promise<void>;

  addToConti: (songId: string) => void;
  removeFromConti: (id: string) => void;
  updateContiItem: (id: string, updates: Partial<ContiItem>) => void;
  toggleContiItemVisibility: (id: string) => void;
  reorderContiItems: (newItems: ContiItem[]) => void;
  clearConti: () => void;
  
  // UI States
  showAlbumModal: boolean;
  setShowAlbumModal: (val: boolean) => void;
  showBuilder: boolean;
  setShowBuilder: (val: boolean) => void;
  editingAlbum: Album | null;
  setEditingAlbum: (album: Album | null) => void;
  
  fetchSongs: () => Promise<void>;
  reloadSettings: () => Promise<void>;
}

const HymnalContext = createContext<HymnalContextType | undefined>(undefined);

export const HymnalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [songs, setSongs] = useState<HymnalSong[]>([]);
  const [filteredSongs, setFilteredSongs] = useState<HymnalSong[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Albums State
  const [albums, setAlbums] = useState<Album[]>([]);
  const [activeAlbumId, setActiveAlbumId] = useState<string>('all');
  const [processingProgress, setProcessingProgress] = useState<{ processed: number; total: number } | null>(null);

  // --- Conti Editor States ---
  const [contiItems, setContiItems] = useState<ContiItem[]>([]);
  const [contiTitle, setContiTitle] = useState('');
  const [contiTitleFontSize, setContiTitleFontSize] = useState(48);
  const [showContiNumbers, setShowContiNumbers] = useState(true);
  const [paperSize, setPaperSize] = useState<'A4' | 'A3'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [itemsPerPage, setItemsPerPage] = useState<number>(2);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  
  // Saved Contis State
  const [savedContis, setSavedContis] = useState<any[]>([]);
  const [currentContiId, setCurrentContiId] = useState<string | null>(null);

  // UI States
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

  const reloadSettings = async () => {
    const settings = await hymnalApi.getSettings();
    if (settings && settings.albums) {
      setAlbums(settings.albums);
    }
  };

  const fetchSongs = async () => {
    setIsLoading(true);
    try {
      const data = await hymnalApi.getSongs();
      setSongs(data);
      hymnalService.setSongs(data);
      setFilteredSongs(data);
    } catch (e) {
      console.error("Failed to load music data via API", e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSavedContis = async () => {
    const data = await hymnalApi.getSavedContis();
    setSavedContis(data);
  };

  // Load Initial Data
  useEffect(() => {
    reloadSettings();
    fetchSongs();
    fetchSavedContis();
    
    // 로컬 스토리지에서 이전 콘티 데이터 로드 (옵션)
    const savedConti = localStorage.getItem('last_conti');
    if (savedConti) {
      try {
        const parsed = JSON.parse(savedConti);
        setContiItems(parsed.items || []);
        setContiTitle(parsed.title || '');
        setContiTitleFontSize(parsed.contiTitleFontSize || 48);
        setShowContiNumbers(parsed.showContiNumbers !== undefined ? parsed.showContiNumbers : true);
        setPaperSize(parsed.paperSize || 'A4');
        setOrientation(parsed.orientation || 'portrait');
        setItemsPerPage(parsed.itemsPerPage || 2);
        setCurrentContiId(parsed.currentContiId || null);
      } catch (e) {}
    }
  }, []);

  // 콘티 변경 시 자동 저장 (마지막 작업물)
  useEffect(() => {
    localStorage.setItem('last_conti', JSON.stringify({
      items: contiItems,
      title: contiTitle,
      contiTitleFontSize: contiTitleFontSize,
      showContiNumbers: showContiNumbers,
      paperSize: paperSize,
      orientation: orientation,
      itemsPerPage: itemsPerPage,
      currentContiId: currentContiId
    }));
  }, [contiItems, contiTitle, contiTitleFontSize, showContiNumbers, paperSize, orientation, itemsPerPage, currentContiId]);

  // Handle Search & Album Filtering
  useEffect(() => {
    const timer = setTimeout(() => {
      let baseSongs = songs;
      if (activeAlbumId !== 'all') {
        baseSongs = songs.filter(s => s.id.startsWith(`${activeAlbumId}-`));
      }
      
      if (!searchQuery.trim()) {
        setFilteredSongs(baseSongs);
      } else {
        const results = hymnalService.search(searchQuery.normalize('NFC'));
        // Filter search results by active album if applicable
        const filtered = activeAlbumId === 'all' 
          ? results 
          : results.filter((s: any) => s.id.startsWith(`${activeAlbumId}-`));
        setFilteredSongs(filtered as HymnalSong[]);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, songs, activeAlbumId]);

  // Album Methods
  const addAlbum = async (name: string) => {
    const result = await hymnalApi.addAlbum({ name, path: '' });
    if (result.success) {
      await reloadSettings();
      setActiveAlbumId(result.album.id);
    }
  };

  const updateAlbum = async (album: Album) => {
    const result = await hymnalApi.updateAlbum(album);
    if (result.success) await reloadSettings();
  };

  const deleteAlbum = async (id: string) => {
    const result = await hymnalApi.deleteAlbum(id);
    if (result.success) {
      await reloadSettings();
      setActiveAlbumId('all');
      await fetchSongs();
    }
  };

  const updateAlbumPath = async (id: string) => {
    const path = await hymnalApi.selectFolder();
    if (path) {
      const album = albums.find(a => a.id === id);
      if (album) {
        await updateAlbum({ ...album, path });
      }
    }
  };

  // --- Saved Conti Methods ---
  const saveCurrentConti = async (name?: string) => {
    if (!contiTitle && !name) {
      alert('콘티 제목을 입력하거나 저장 이름을 지정해주세요.');
      return;
    }

    const id = currentContiId || `conti-${Date.now()}`;
    const contiData = {
      id,
      title: name || contiTitle,
      items: contiItems,
      paperSize,
      orientation,
      contiTitleFontSize,
      showContiNumbers
    };

    const result = await hymnalApi.saveConti(contiData);
    if (result.success) {
      setCurrentContiId(id);
      if (name) setContiTitle(name);
      await fetchSavedContis();
      alert('콘티가 안전하게 저장되었습니다.');
    } else {
      alert('저장 실패: ' + result.error);
    }
  };

  const loadSavedConti = async (id: string) => {
    const target = savedContis.find(c => c.id === id);
    if (!target) return;

    if (contiItems.length > 0 && !confirm('현재 작업 중인 콘티가 사라집니다. 불러오시겠습니까?')) {
      return;
    }

    setContiItems(target.items || []);
    setContiTitle(target.title || '');
    setPaperSize(target.paperSize || 'A4');
    setOrientation(target.orientation || 'portrait');
    setContiTitleFontSize(target.contiTitleFontSize || 48);
    setShowContiNumbers(target.showContiNumbers !== undefined ? target.showContiNumbers : true);
    setCurrentContiId(target.id);
    setIsEditorOpen(true);
    setIsLibraryOpen(false); // 로드 후 저장소 닫기
  };

  const deleteSavedConti = async (id: string) => {
    if (!confirm('정말로 이 저장된 콘티를 삭제하시겠습니까?')) return;
    
    const result = await hymnalApi.deleteSavedConti(id);
    if (result.success) {
      if (currentContiId === id) setCurrentContiId(null);
      await fetchSavedContis();
    }
  };

  // --- Conti Methods ---
  const addToConti = (songId: string) => {
    const song = songs.find(s => s.id === songId);
    if (!song) return;

    // 목사님 요청: 초기 크기 30%
    const initialWidth = 30;

    const newItem: ContiItem = {
      id: `conti-item-${Date.now()}`,
      songId,
      x: 40,
      y: 40,
      width: initialWidth,
      height: 0,
      memo: '',
      memoFontSize: 12, // 기본 크기 12px
      isMemoOpen: false, // 기본적으로 닫혀 있음
      page: 1, // 1페이지 전용
      order: contiItems.length + 1,
      isVisible: false // 선반에 먼저 들어감
    };
    setContiItems([...contiItems, newItem]);
  };

  const removeFromConti = (id: string) => {
    setContiItems(contiItems.filter(item => item.id !== id));
  };

  const updateContiItem = (id: string, updates: Partial<ContiItem>) => {
    setContiItems(contiItems.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const toggleContiItemVisibility = (id: string) => {
    setContiItems(contiItems.map(item => {
      if (item.id === id) {
        const nextVisible = !item.isVisible;
        const update: Partial<ContiItem> = {
           isVisible: nextVisible,
           page: 1 // 항상 1페이지
        };
        // 목사님 요청 해결: 이미 위치가 잡혀있다면(0이 아니면) 리셋하지 않고 보존합니다.
        // 처음 추가되어 한 번도 배정되지 않은 경우(x, y가 undefined이거나 정확히 40 초기값이 아닌 경우 등)만 기본값 부여
        if (nextVisible && item.x === undefined && item.y === undefined) {
          update.x = 40;
          update.y = 40;
        }
        return { ...item, ...update };
      }
      return item;
    }));
  };

  const reorderContiItems = (newItems: ContiItem[]) => {
    setContiItems(newItems);
  };

  const clearConti = () => {
    if (confirm('콘티를 모두 비우시겠습니까?')) {
      setContiItems([]);
      setContiTitle('');
      setCurrentContiId(null);
    }
  };



  // Sync & Build
  const syncAlbum = async (albumId: string) => {
    setIsSyncing(true);
    const stopListening = hymnalApi.onProgress((data: any) => {
      setProcessingProgress(data);
    });
    try {
      const result = await hymnalApi.syncGDrive(albumId);
      if (result.success) {
        const target = albums.find(a => a.id === albumId);
        alert(`[${target?.name || '앨범'}] 동기화 완료!\n업로드: ${result.uploaded}, 건너뜀: ${result.skipped}`);
        await fetchSongs();
      } else if (result.message === 'Need Auth') {
        const url = await hymnalApi.getAuthUrl();
        hymnalApi.openExternal(url);
        alert('구글 인증이 필요합니다. 웹 브라우저에서 인증 후 다시 시도해 주세요.');
      }
    } finally {
      stopListening();
      setProcessingProgress(null);
      setIsSyncing(false);
    }
  };

  const processImages = async (albumId: string, isIncremental: boolean) => {
    const target = albums.find(a => a.id === albumId);
    if (!target || !target.path) {
      alert('앨범 폴더를 먼저 지정해 주세요.');
      return;
    }

    const stopListening = hymnalApi.onProgress((data: any) => {
      setProcessingProgress(data);
    });

    try {
      const result = await hymnalApi.processImages({
        albumId,
        sourcePath: target.path,
        isIncremental
      });
      alert(`빌드 완료: ${result.processed}곡 처리됨`);
      await fetchSongs();
    } finally {
      stopListening();
      setProcessingProgress(null);
    }
  };

  // CSV
  const exportCSV = async (albumId: string) => {
    const result = await hymnalApi.exportCSV({ mode: albumId });
    if (result.success) alert('CSV 내보내기 완료');
  };

  const importCSV = async () => {
    const result = await hymnalApi.importCSV();
    if (result.success) {
      alert(`${result.count}곡 데이터 반영 완료`);
      await fetchSongs();
    }
  };

  return (
    <HymnalContext.Provider value={{
      songs,
      filteredSongs,
      searchQuery,
      setSearchQuery,
      selectedSongId,
      setSelectedSongId,
      isLoading,
      isSyncing,
      setIsSyncing,
      albums,
      activeAlbumId,
      setActiveAlbumId,
      addAlbum,
      updateAlbum,
      deleteAlbum,
      updateAlbumPath,
      processingProgress,
      syncAlbum,
      processImages,
      exportCSV,
      importCSV,
      contiItems,
      contiTitle,
      setContiTitle,
      contiTitleFontSize,
      setContiTitleFontSize,
      showContiNumbers,
      setShowContiNumbers,
      paperSize,
      setPaperSize,
      orientation,
      setOrientation,
      itemsPerPage,
      setItemsPerPage,
      isEditorOpen,
      setIsEditorOpen,
      savedContis,
      currentContiId,
      saveCurrentConti,
      loadSavedConti,
      deleteSavedConti,
      fetchSavedContis,
      addToConti,
      removeFromConti,
      updateContiItem,
      toggleContiItemVisibility,
      reorderContiItems,
      clearConti,
      isLibraryOpen,
      setIsLibraryOpen,
      showAlbumModal,
      setShowAlbumModal,
      showBuilder,
      setShowBuilder,
      editingAlbum,
      setEditingAlbum,
      fetchSongs,
      reloadSettings
    }}>
      {children}
    </HymnalContext.Provider>
  );
};

export const useHymnal = () => {
  const context = useContext(HymnalContext);
  if (!context) throw new Error("useHymnal must be used within a HymnalProvider");
  return context;
};
