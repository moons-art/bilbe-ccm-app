import React, { createContext, useContext, useState, useEffect } from 'react';
import type { BibleVersion } from '../types/bible';
import { searchService } from '../services/searchService';

import { BibleParser } from '../services/bibleParser';

export type CopyMode = 'default' | 'niv+krv' | 'all';

interface BibleContextType {
  versions: BibleVersion[];
  selectedVersionIds: string[];
  lineHeight: number;
  setLineHeight: (val: number) => void;
  copyMode: CopyMode;
  showVersionInCopy: boolean;
  addVersion: (version: BibleVersion) => void;
  removeVersion: (id: string) => void;
  renameVersion: (id: string, newName: string) => void;
  clearAllVersions: () => void;
  toggleVersion: (id: string) => void;
  setCopyMode: (mode: CopyMode) => void;
  setShowVersionInCopy: (show: boolean) => void;
}

const BibleContext = createContext<BibleContextType | undefined>(undefined);

export const BibleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 고정된 개역개정 초기 객체 (로딩 전에도 목록에 보이게 함)
  const DEFAULT_KRV: BibleVersion = {
    id: 'built-in-krv',
    name: '개역개정',
    verses: [],
    isBuiltIn: true,
    isSystem: true,
    metadata: { uploadedAt: Date.now(), fileType: 'txt' }
  };

  const [versions, setVersions] = useState<BibleVersion[]>([DEFAULT_KRV]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>(['built-in-krv']);
  const [lineHeight, setLineHeight] = useState<number>(1.6);
  const [copyMode, setCopyMode] = useState<CopyMode>('default');
  const [showVersionInCopy, setShowVersionInCopy] = useState<boolean>(true);

  // Load from LocalStorage & Default Bible
  useEffect(() => {
    const init = async () => {
      let loaded: BibleVersion[] = [];
      const saved = localStorage.getItem('bible-versions');
      const savedShowVersion = localStorage.getItem('bible-show-version-copy');
      
      const savedLineHeight = localStorage.getItem('bible-line-height');
      
      if (savedLineHeight) {
        const val = parseFloat(savedLineHeight);
        setLineHeight(val < 1.3 ? 1.3 : val);
      }

      if (savedShowVersion) {
        setShowVersionInCopy(savedShowVersion === 'true');
      }
      
      if (saved) {
        try {
          loaded = JSON.parse(saved);
        } catch (e) {
          console.error("Failed to load bible versions", e);
        }
      }

      // 1. Ensure KRV exists and is hydrated (Built-in System Version)
      // Use the stable 'built-in-krv' ID
      let krvEntry = loaded.find(v => v.name === '개역개정' || v.id === 'built-in-krv');
      
      if (!krvEntry) {
        krvEntry = { ...DEFAULT_KRV };
        loaded.unshift(krvEntry);
      } else {
        // 개역개정을 목록의 맨 앞으로 이동 (강제 우선순위)
        loaded = [krvEntry, ...loaded.filter(v => v.id !== krvEntry!.id)];
      }
      
      krvEntry.isSystem = true;
      krvEntry.isBuiltIn = true;
      krvEntry.id = 'built-in-krv'; // ID 강제 고정

      if (!krvEntry.verses || krvEntry.verses.length === 0) {
        console.log("[Bible] System KRV verses missing. Forcing load from /data/krv.txt...");
        try {
          // fetch('/data/krv.txt') -> 가끔 base 경로 문제가 있을 수 있어 './data/krv.txt'도 고려
          const response = await fetch('/data/krv.txt');
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            let content;
            try {
              const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
              content = utf8Decoder.decode(buffer);
            } catch {
              const eucKrDecoder = new TextDecoder('euc-kr');
              content = eucKrDecoder.decode(buffer);
            }
            const krvVersion = await BibleParser.parseTxt('개역개정', content);
            krvVersion.isBuiltIn = true;
            krvVersion.isSystem = true; 
            krvVersion.id = 'built-in-krv';
            
            console.log(`[Bible] 개역개정 파싱 완료: ${krvVersion.verses.length}개 구절 로드됨.`);

            if (krvVersion.verses.length === 0) {
              console.error("[Bible] 개역개정 파싱 결과가 0개입니다! 파일 내용을 확인하세요.");
            }
            
            // Update in loaded array
            const idx = loaded.findIndex(v => v.id === 'built-in-krv');
            if (idx !== -1) {
              loaded[idx] = krvVersion;
            } else {
              loaded.unshift(krvVersion);
            }
            
            console.log(`[Bible] KRV built-in loaded/updated. Total: ${krvVersion.verses.length}`);
          } else {
            console.error(`[Bible] Failed to fetch krv.txt: ${response.status}. 데이터 경로를 확인하세요.`);
          }
        } catch (e) {
          console.error("[Bible] Failed to load default KRV bible from /data/krv.txt", e);
        }
      }

      // 2. Hydrate other Built-in versions if any
      const hydratedVersions = await Promise.all(loaded.map(async (v) => {
        if (v.isBuiltIn && (!v.verses || v.verses.length === 0)) {
          console.log(`[Bible] Hydrating built-in version: ${v.name}`);
          try {
            const fileName = v.name === '개역개정' ? 'krv.txt' : null;
            if (fileName) {
              const response = await fetch(`/data/${fileName}`);
              if (response.ok) {
                const buffer = await response.arrayBuffer();
                let content;
                try {
                  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
                  content = utf8Decoder.decode(buffer);
                } catch {
                  const eucKrDecoder = new TextDecoder('euc-kr');
                  content = eucKrDecoder.decode(buffer);
                }
                const fullVersion = await BibleParser.parseTxt(v.name, content);
                console.log(`[Bible] Hydrated ${v.name} successfully.`);
                return { ...v, verses: fullVersion.verses };
              }
            }
          } catch (e) {
            console.error(`[Bible] Failed to hydrate built-in version: ${v.name}`, e);
          }
        }
        return v;
      }));

      setVersions(hydratedVersions);
      hydratedVersions.forEach(v => searchService.indexVersion(v));

      // Force select KRV on first load to guarantee visibility
      console.log("[Bible] Initial Selection logic running...");
      setSelectedVersionIds(['built-in-krv']);
    };

    init();
  }, []);

  // Save to LocalStorage (Optimized)
  useEffect(() => {
    // To prevent heavy JSON.stringify and localStorage size limit issues,
    // we don't save the massive 'verses' array for built-in bibles.
    const versionsToSave = versions.map(v => ({
      ...v,
      verses: v.isBuiltIn ? [] : v.verses
    }));
    
    try {
      localStorage.setItem('bible-versions', JSON.stringify(versionsToSave));
    } catch (e) {
      console.warn("localStorage save failed (possibly size limit). Uploaded bibles might not persist.", e);
    }
  }, [versions]);

  useEffect(() => {
    localStorage.setItem('bible-show-version-copy', String(showVersionInCopy));
  }, [showVersionInCopy]);

  useEffect(() => {
    localStorage.setItem('bible-line-height', String(lineHeight));
  }, [lineHeight]);

  const addVersion = (version: BibleVersion) => {
    setVersions(prev => {
      const newVersions = [...prev.filter(v => v.name !== version.name), version];
      searchService.indexVersion(version);
      return newVersions;
    });
  };

  const removeVersion = (id: string) => {
    setVersions(prev => {
      const target = prev.find(v => v.id === id);
      if (target?.isBuiltIn || target?.isSystem || target?.name === '개역개정') {
        console.warn("[Bible] Cannot remove system/built-in version.");
        return prev; // 시스템/빌트인 버전 보호
      }
      return prev.filter(v => v.id !== id);
    });
    setSelectedVersionIds(prev => prev.filter(vid => vid !== id));
  };

  const renameVersion = (id: string, newName: string) => {
    setVersions(prev => prev.map(v => v.id === id ? { ...v, name: newName } : v));
  };

  const clearAllVersions = () => {
    setVersions(prev => prev.filter(v => v.isBuiltIn));
    setSelectedVersionIds(prev => {
      const builtInIds = versions.filter(v => v.isBuiltIn).map(v => v.id);
      return prev.filter(vid => builtInIds.includes(vid));
    });
  };

  const toggleVersion = (id: string) => {
    setSelectedVersionIds(prev => {
      if (prev.includes(id)) return prev.filter(vid => vid !== id);
      if (prev.length >= 5) return prev; // Limit to 5
      return [...prev, id];
    });
  };

  return (
    <BibleContext.Provider value={{ 
      versions, 
      selectedVersionIds, 
      copyMode,
      showVersionInCopy,
      addVersion, 
      removeVersion, 
      renameVersion, 
      clearAllVersions, 
      toggleVersion,
      setCopyMode,
      setShowVersionInCopy,
      lineHeight,
      setLineHeight: (val: number) => setLineHeight(val < 1.3 ? 1.3 : val)
    }}>
      {children}
    </BibleContext.Provider>
  );
};

export const useBible = () => {
  const context = useContext(BibleContext);
  if (!context) throw new Error("useBible must be used within a BibleProvider");
  return context;
};
