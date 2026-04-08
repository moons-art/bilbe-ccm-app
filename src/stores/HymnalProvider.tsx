import React, { createContext, useContext, useState, useEffect } from 'react';
import type { HymnalSong } from '../types/hymnal';
import { hymnalService } from '../services/hymnalService';

export interface Album {
  id: string;
  name: string;
  path: string;
  type: 'fixed' | 'custom';
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

  // UI States
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);

  const reloadSettings = async () => {
    const settings = await (window as any).ipcRenderer.hymnal.getSettings();
    if (settings && settings.albums) {
      setAlbums(settings.albums);
    }
  };

  const fetchSongs = async () => {
    setIsLoading(true);
    try {
      const data = await (window as any).ipcRenderer.hymnal.getSongs();
      setSongs(data);
      hymnalService.setSongs(data);
      setFilteredSongs(data);
    } catch (e) {
      console.error("Failed to load music data via IPC", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Load Initial Data
  useEffect(() => {
    reloadSettings();
    fetchSongs();
  }, []);

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
    const result = await (window as any).ipcRenderer.hymnal.addAlbum({ name, path: '' });
    if (result.success) {
      await reloadSettings();
      setActiveAlbumId(result.album.id);
    }
  };

  const updateAlbum = async (album: Album) => {
    const result = await (window as any).ipcRenderer.hymnal.updateAlbum(album);
    if (result.success) await reloadSettings();
  };

  const deleteAlbum = async (id: string) => {
    const result = await (window as any).ipcRenderer.hymnal.deleteAlbum(id);
    if (result.success) {
      await reloadSettings();
      setActiveAlbumId('all');
      await fetchSongs();
    }
  };

  const updateAlbumPath = async (id: string) => {
    const path = await (window as any).ipcRenderer.hymnal.selectFolder();
    if (path) {
      const album = albums.find(a => a.id === id);
      if (album) {
        await updateAlbum({ ...album, path });
      }
    }
  };

  // Sync & Build
  const syncAlbum = async (albumId: string) => {
    setIsSyncing(true);
    try {
      const result = await (window as any).ipcRenderer.hymnal.syncGDrive(albumId);
      if (result.success) {
        const target = albums.find(a => a.id === albumId);
        alert(`[${target?.name || '앨범'}] 동기화 완료!\n업로드: ${result.uploaded}, 건너뜀: ${result.skipped}`);
        await fetchSongs();
      } else if (result.message === 'Need Auth') {
        const url = await (window as any).ipcRenderer.hymnal.getAuthUrl();
        (window as any).ipcRenderer.hymnal.openExternal(url);
        alert('구글 인증이 필요합니다. 웹 브라우저에서 인증 후 다시 시도해 주세요.');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const processImages = async (albumId: string, isIncremental: boolean) => {
    const target = albums.find(a => a.id === albumId);
    if (!target || !target.path) {
      alert('앨범 폴더를 먼저 지정해 주세요.');
      return;
    }

    const stopListening = (window as any).ipcRenderer.hymnal.onProgress((data: any) => {
      setProcessingProgress(data);
    });

    try {
      const result = await (window as any).ipcRenderer.hymnal.processImages({
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
    const result = await (window as any).ipcRenderer.hymnal.exportCSV({ mode: albumId });
    if (result.success) alert('CSV 내보내기 완료');
  };

  const importCSV = async () => {
    const result = await (window as any).ipcRenderer.hymnal.importCSV();
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
