import React, { useState, useEffect, useRef } from 'react';
import type { BibleVersion } from '../types/bible';
import { searchService } from '../services/searchService';
import { BibleParser } from '../services/bibleParser';
import { BibleContext, type CopyMode } from './BibleContext';

export const BibleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
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
  
  // ✅ 인덱싱 중복 방지를 위한 Ref
  const indexedVersionIds = useRef<Set<string>>(new Set());

  // 1. 초기 데이터 로드 및 Hydration
  useEffect(() => {
    const init = async () => {
      let loaded: BibleVersion[] = [];
      const saved = localStorage.getItem('bible-versions');
      const savedShowVersion = localStorage.getItem('bible-show-version-copy');
      const savedLineHeight = localStorage.getItem('bible-line-height');
      
      if (savedLineHeight) setLineHeight(parseFloat(savedLineHeight) || 1.6);
      if (savedShowVersion) setShowVersionInCopy(savedShowVersion === 'true');
      
      if (saved) {
        try { loaded = JSON.parse(saved); } catch (e) { console.error("Load failed", e); }
      }

      let krvEntry = loaded.find(v => v.name === '개역개정' || v.id === 'built-in-krv');
      if (!krvEntry) {
        krvEntry = { ...DEFAULT_KRV };
        loaded.unshift(krvEntry);
      } else {
        loaded = [krvEntry, ...loaded.filter(v => v.id !== krvEntry!.id)];
      }
      krvEntry.isSystem = true;
      krvEntry.isBuiltIn = true;
      krvEntry.id = 'built-in-krv';

      const hydratedVersions = await Promise.all(loaded.map(async (v) => {
        if (v.isBuiltIn && (!v.verses || v.verses.length === 0)) {
          try {
            const fileName = v.name === '개역개정' ? 'krv.txt' : null;
            if (fileName) {
              const response = await fetch(`/data/${fileName}`);
              if (response.ok) {
                const buffer = await response.arrayBuffer();
                let content;
                try {
                  content = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
                } catch {
                  content = new TextDecoder('euc-kr').decode(buffer);
                }
                const fullVersion = await BibleParser.parseTxt(v.name, content);
                return { ...v, verses: fullVersion.verses };
              }
            }
          } catch (e) { console.error(`Hydration failed: ${v.name}`, e); }
        }
        return v;
      }));

      setVersions(hydratedVersions);
      setSelectedVersionIds(['built-in-krv']);
    };
    init();
  }, []);

  // ✅ [안정성 강화] 데이터 로딩 완료 후 비동기적으로 인덱싱 실행
  useEffect(() => {
    const validOnes = versions.filter(v => v.verses && v.verses.length > 0);
    
    if (validOnes.length > 0) {
      validOnes.forEach(v => {
        // 이미 인덱싱된 버전이라도 서비스와의 동기화를 위해 체크
        if (!indexedVersionIds.current.has(v.id) || !searchService.hasIndex(v.id)) {
          setTimeout(() => {
            searchService.indexVersion(v);
            indexedVersionIds.current.add(v.id);
          }, 50); // 약간의 지연을 주어 로딩 안정성 확보
        }
      });
    }
  }, [versions]);

  // 2. LocalStorage 저장
  useEffect(() => {
    const toSave = versions.map(v => ({ ...v, verses: v.isBuiltIn ? [] : v.verses }));
    localStorage.setItem('bible-versions', JSON.stringify(toSave));
  }, [versions]);

  const addVersion = (version: BibleVersion) => {
    setVersions(prev => [...prev.filter(v => v.name !== version.name), version]);
  };

  const removeVersion = (id: string) => {
    setVersions(prev => {
      const target = prev.find(v => v.id === id);
      if (target?.isSystem) return prev;
      return prev.filter(v => v.id !== id);
    });
    setSelectedVersionIds(prev => prev.filter(vid => vid !== id));
    indexedVersionIds.current.delete(id);
  };

  return (
    <BibleContext.Provider value={{ 
      versions, selectedVersionIds, copyMode, showVersionInCopy,
      addVersion, removeVersion, 
      renameVersion: (id, name) => setVersions(prev => prev.map(v => v.id === id ? { ...v, name } : v)),
      clearAllVersions: () => {
        const builtIns = versions.filter(v => v.isBuiltIn);
        setVersions(builtIns);
        setSelectedVersionIds(builtIns.map(v => v.id));
        indexedVersionIds.current.clear();
      },
      toggleVersion: (id) => setSelectedVersionIds(prev => {
        if (prev.includes(id)) return prev.filter(vid => vid !== id);
        return prev.length >= 5 ? prev : [...prev, id];
      }),
      setCopyMode, setShowVersionInCopy,
      lineHeight, setLineHeight: (val) => setLineHeight(Math.max(1.3, val))
    }}>
      {children}
    </BibleContext.Provider>
  );
};
