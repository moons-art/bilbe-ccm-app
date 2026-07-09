import React, { useState, useEffect, useRef } from 'react';
import type { BibleVersion } from '../types/bible';
import { searchService } from '../services/searchService';
import { BibleParser } from '../services/bibleParser';
import { BibleContext, type CopyMode } from './BibleContext';
import { bibleDB } from '../utils/indexedDB';

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
      
      try {
        const idbVersions = await bibleDB.getAllVersions();
        if (idbVersions && idbVersions.length > 0) {
          loaded = idbVersions;
        } else if (saved) {
          // Fallback to localStorage migration
          loaded = JSON.parse(saved);
        }
      } catch (e) { console.error("DB Load failed", e); }

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
          } catch (e: any) { 
            console.error(`Hydration failed: ${v.name}`, e);
            alert(`기본 성경(${v.name}) 로드 중 오류가 발생했습니다: ${e?.message || e}`);
          }
          
          if (v.isBuiltIn && (!v.verses || v.verses.length === 0)) {
            alert(`기본 성경(${v.name})을 불러왔으나, 내용이 없습니다.`);
          }
        }
        return v;
      }));

      setVersions(hydratedVersions);
      setSelectedVersionIds(['built-in-krv']);

      // ✅ 2. 구글 드라이브(appDataFolder) 백그라운드 동기화 로직
      const syncCloud = (currentVersions: BibleVersion[]) => {
        import('../api/gdriveWebService').then(({ gdriveWebService }) => {
          if (!gdriveWebService.getAccessToken()) return;
          
          gdriveWebService.listBibleFiles().then(async driveFiles => {
            if (!driveFiles || driveFiles.length === 0) return;
            
            let hasNew = false;
            let updatedVersions = [...currentVersions];
            
            for (const file of driveFiles) {
              const vName = file.name.replace('.txt', '');
              // 로컬(IndexedDB)에 이미 있는지 확인
              if (!updatedVersions.find(v => v.name === vName)) {
                try {
                  console.log(`[Bible Sync] Downloading ${file.name} from Cloud...`);
                  const content = await gdriveWebService.downloadBibleFile(file.id);
                  const fullVersion = await BibleParser.parseTxt(vName, content);
                  updatedVersions.push(fullVersion);
                  // IndexedDB에 새로 다운로드한 성경 저장
                  await bibleDB.saveVersion(fullVersion);
                  hasNew = true;
                } catch (e) {
                  console.error(`Failed to download/parse ${file.name}`, e);
                }
              }
            }
            
            if (hasNew) {
              setVersions([...updatedVersions]);
              console.log('[Bible Sync] ☁️ Cloud sync complete! New versions added.');
            }
          }).catch(e => {
            console.error('GDrive Bible sync list failed', e);
          });
        });
      };

      // 처음 초기화 시 실행 (로그인 되어있다면)
      syncCloud(hydratedVersions);

      // 나중에 로그인 성공 시 이벤트로 실행
      const handleAuth = () => {
        setVersions(latestVersions => {
          syncCloud(latestVersions);
          return latestVersions;
        });
      };
      window.addEventListener('gdrive_authenticated', handleAuth);
      
      // Cleanup을 위해 컴포넌트 마운트 해제 시 제거하려면 (useEffect 외부에 저장해야 하지만, 일단 여기서는 간단히)
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

  // 2. IndexedDB 저장
  useEffect(() => {
    const saveToDB = async () => {
      try {
        for (const v of versions) {
          // Save all versions including verses to IndexedDB
          await bibleDB.saveVersion(v);
        }
        // Minimal state for selected tabs in localStorage
        const miniState = versions.map(v => ({ id: v.id, name: v.name, isBuiltIn: v.isBuiltIn }));
        localStorage.setItem('bible-versions-meta', JSON.stringify(miniState));
      } catch (e) {
        console.error('Failed to save to IndexedDB', e);
      }
    };
    if (versions.length > 0) saveToDB();
  }, [versions]);

  const addVersion = (version: BibleVersion) => {
    setVersions(prev => [...prev.filter(v => v.name !== version.name), version]);
  };

  const removeVersion = async (id: string) => {
    setVersions(prev => {
      const target = prev.find(v => v.id === id);
      if (target?.isSystem) return prev;
      return prev.filter(v => v.id !== id);
    });
    setSelectedVersionIds(prev => prev.filter(vid => vid !== id));
    indexedVersionIds.current.delete(id);
    await bibleDB.deleteVersion(id);
  };

  return (
    <BibleContext.Provider value={{ 
      versions, selectedVersionIds, copyMode, showVersionInCopy,
      addVersion, removeVersion, 
      renameVersion: (id, name) => setVersions(prev => prev.map(v => v.id === id ? { ...v, name } : v)),
      clearAllVersions: async () => {
        const builtIns = versions.filter(v => v.isBuiltIn);
        setVersions(builtIns);
        setSelectedVersionIds(builtIns.map(v => v.id));
        indexedVersionIds.current.clear();
        
        // Remove non-built-in from DB
        const all = await bibleDB.getAllVersions();
        for (const v of all) {
          if (!v.isBuiltIn) await bibleDB.deleteVersion(v.id);
        }
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
