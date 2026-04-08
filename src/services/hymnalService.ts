import type { HymnalSong } from '../types/hymnal';
import MiniSearch from 'minisearch';

class HymnalService {
  private miniSearch: MiniSearch;
  private songs: HymnalSong[] = [];

  constructor() {
    this.miniSearch = new MiniSearch({
      fields: ['number', 'title', 'lyrics', 'code', 'meter', 'category'], // 검색 대상 필드 확장
      storeFields: ['id', 'number', 'title', 'lyrics', 'filename', 'filePath', 'category', 'code', 'meter'],
      searchOptions: {
        boost: { title: 2, number: 3 },
        fuzzy: 0.1,
        prefix: true,
        combineWith: 'AND' // 모든 키워드가 포함될 때만 결과 노출
      }
    });
  }

  setSongs(songs: HymnalSong[]) {
    // 검색 엔진이 null이나 undefined 필드를 만나면 해당 문서를 무시할 수 있으므로 안전하게 정제합니다.
    // Mac 환경 자모 분리 방지를 위해 모든 텍스트를 NFC로 정규화합니다.
    const sanitizedSongs = songs.map(song => ({
      ...song,
      title: (song.title || '').normalize('NFC'),
      lyrics: (song.lyrics || '').normalize('NFC'),
      category: (song.category || '').normalize('NFC'),
      code: (song.code || '').normalize('NFC'),
      meter: (song.meter || '').normalize('NFC'),
      number: song.number || 0
    }));

    this.songs = sanitizedSongs as HymnalSong[];
    this.miniSearch.removeAll();
    this.miniSearch.addAll(this.songs);
  }

  search(query: string): HymnalSong[] {
    if (!query || !query.trim()) return this.songs;
    
    // 검색어도 NFC로 정규화하여 데이터와 일치시킵니다.
    const trimmedQuery = query.trim().normalize('NFC');

    // 1. 단순 번호 검색 우선순위 (한 단어일 때만)
    if (/^\d+$/.test(trimmedQuery)) {
      const num = parseInt(trimmedQuery, 10);
      const exactMatch = this.songs.find(s => s.number === num);
      if (exactMatch) return [exactMatch, ...this.songs.filter(s => s.number !== num).slice(0, 50)];
    }

    // 2. 다중 키워드 검색 엔진 (MiniSearch)
    // 공백으로 구분된 개별 키워드를 MiniSearch의 AND 옵션으로 검색
    const results = this.miniSearch.search(trimmedQuery);
    return results as unknown as HymnalSong[];
  }

  getSongById(id: string): HymnalSong | undefined {
    return this.songs.find(s => s.id === id);
  }
}

export const hymnalService = new HymnalService();
