import React, { createContext, useContext, useState, useEffect } from 'react';
import type { BibleVersion } from '../types/bible';
import { searchService } from '../services/searchService';

import { BibleParser } from '../services/bibleParser';

export type CopyMode = 'default' | 'niv+krv' | 'all';

interface BibleContextType {
  versions: BibleVersion[];
  selectedVersionIds: string[];
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
  const [versions, setVersions] = useState<BibleVersion[]>([]);
  const [selectedVersionIds, setSelectedVersionIds] = useState<string[]>([]);
  const [copyMode, setCopyMode] = useState<CopyMode>('default');
  const [showVersionInCopy, setShowVersionInCopy] = useState<boolean>(true);

  // Load from LocalStorage & Default Bible
  useEffect(() => {
    const init = async () => {
      let loaded: BibleVersion[] = [];
      const saved = localStorage.getItem('bible-versions');
      const savedShowVersion = localStorage.getItem('bible-show-version-copy');
      
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

      // 1. Ensure KRV exists (Built-in)
      const hasKrv = loaded.some(v => v.name === '개역개정');
      if (!hasKrv) {
        try {
          const response = await fetch('./data/krv.txt');
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
            loaded.push(krvVersion);
          }
        } catch (e) {
          console.error("Failed to load default KRV bible", e);
        }
      }

      // 2. Hydrate Built-in versions (they are saved without verses to save space)
      const hydratedVersions = await Promise.all(loaded.map(async (v) => {
        if (v.isBuiltIn && (!v.verses || v.verses.length === 0)) {
          try {
            const fileName = v.name === '개역개정' ? 'krv.txt' : null; // Add more built-in mappings if needed
            if (fileName) {
              const response = await fetch(`./data/${fileName}`);
              if (response.ok) {
                const content = await response.text();
                const fullVersion = await BibleParser.parseTxt(v.name, content);
                return { ...v, verses: fullVersion.verses };
              }
            }
          } catch (e) {
            console.error(`Failed to hydrate built-in version: ${v.name}`, e);
          }
        }
        return v;
      }));

      setVersions(hydratedVersions);
      hydratedVersions.forEach(v => searchService.indexVersion(v));

      // Auto-select first version if none selected
      if (hydratedVersions.length > 0) {
        setSelectedVersionIds([hydratedVersions[0].id]);
      }
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
      if (target?.isBuiltIn) return prev; // Protect built-in
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
      setShowVersionInCopy
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
