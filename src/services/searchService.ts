import MiniSearch from 'minisearch';
import type { BibleVersion, Verse } from '../types/bible';
import { BIBLE_SYNONYMS } from '../constants/bibleSynonyms';

const OT_BOOKS = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOE', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];
const NT_BOOKS = ['MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'];

export type SearchRange = 'all' | 'ot' | 'nt' | 'book';
export type MatchMode = 'partial' | 'exact';
export type LogicMode = 'AND' | 'OR';

const KOREAN_PARTICLES = /([은는이가을를의와과로도만])|([에]게|[에]서|[부]터|[까]지)|([하]며|[하]고|[하]니|[하]여|[하]라|[았었였]다|[으]니|[으]리|[아어여]서?|[게기음])$/;

function extractKeywords(text: string): string[] {
  return text.split(/[\s\p{P}]+/u)
    .filter(t => t.length > 1) 
    .map(t => t.replace(KOREAN_PARTICLES, ''))
    .filter(t => t.length >= 2);
}

function stemKorean(word: string): string {
  if (word.length <= 1) return word;
  return word.replace(KOREAN_PARTICLES, '');
}

export class BibleSearchService {
  private standardIndices: Map<string, MiniSearch<Verse>> = new Map();
  private semanticIndices: Map<string, MiniSearch<Verse>> = new Map();

  hasIndex(versionId: string): boolean {
    const exists = this.standardIndices.has(versionId);
    console.log(`[SearchService] Index check for ${versionId}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    return exists;
  }

  indexVersion(version: BibleVersion) {
    if (!version.verses || version.verses.length === 0) {
      console.warn(`[SearchService] Version ${version.name} has no verses to index.`);
      return;
    }
    const docs = version.verses.map((v, idx) => ({ ...v, id: `${version.id}-${idx}` }));

    const stdSearch = new MiniSearch<Verse>({
      fields: ['content'],
      storeFields: ['bookId', 'bookName', 'chapter', 'verse', 'content'],
      tokenize: (text) => text.split(/[\s\p{P}]+/u).filter(t => t.length > 0),
      searchOptions: { prefix: true }
    });
    stdSearch.addAll(docs);
    this.standardIndices.set(version.id, stdSearch);

    const semSearch = new MiniSearch<Verse>({
      fields: ['content'],
      storeFields: ['bookId', 'bookName', 'chapter', 'verse', 'content'],
      tokenize: (text) => {
        const tokens = text.split(/[\s\p{P}]+/u).filter(t => t.length > 0);
        const stemmed = tokens.map(t => stemKorean(t));
        const joined = [];
        for (let i = 0; i < tokens.length - 1; i++) joined.push(tokens[i] + tokens[i+1]);
        return Array.from(new Set([...tokens, ...stemmed, ...joined]));
      },
      searchOptions: { prefix: true, boost: { content: 2 } }
    });
    semSearch.addAll(docs);
    this.semanticIndices.set(version.id, semSearch);
    console.log(`[SearchService] Indexing success: ${version.name} (${version.verses.length} verses)`);
  }

  search(
    query: string, 
    versionIds: string[], 
    options: {
      matchMode: MatchMode,
      logicMode: LogicMode,
      range: SearchRange,
      currentBookId?: string,
      searchMode?: 'standard' | 'semantic'
    }
  ): any[] {
    const { matchMode, logicMode, range, currentBookId, searchMode = 'standard' } = options;
    if (!query.trim()) return [];

    const normalizedQuery = query.trim().normalize('NFC');
    const terms = Array.from(new Set(normalizedQuery.split(/\s+/).filter(t => t.length > 0)));
    const targetMap = searchMode === 'standard' ? this.standardIndices : this.semanticIndices;
    const allResults: any[] = [];

    console.log(`[SearchService] Searching for: "${normalizedQuery}"`, { searchMode, logicMode, versionCount: versionIds.length });

    for (const id of versionIds) {
      const index = targetMap.get(id);
      if (!index) {
        console.warn(`[SearchService] Still no index for version: ${id}. Re-indexing attempt might be needed.`);
        continue;
      }

      let versionResults: any[] = [];

      if (searchMode === 'standard') {
        if (logicMode === 'AND') {
          const termResults = terms.map(t => index.search(t, { prefix: true }));
          const sortedResults = termResults.sort((a, b) => a.length - b.length);
          if (sortedResults.length > 0) {
            let intersected = sortedResults[0];
            for (let i = 1; i < sortedResults.length; i++) {
              if (intersected.length === 0) break;
              const ids = new Set(sortedResults[i].map(r => r.id));
              intersected = intersected.filter(r => ids.has(r.id));
            }
            versionResults = intersected;
          }
        } else {
          versionResults = index.search(terms.join(' '), { combine: 'OR', prefix: true });
        }

        if (matchMode === 'exact') {
          const exactRegex = new RegExp(`(^|\\s)${normalizedQuery}(\\s|$)`);
          versionResults = versionResults.filter(r => exactRegex.test((r as any).content));
        }
      } else {
        // Semantic: 유사 구절 탐색
        const keywords = extractKeywords(normalizedQuery);
        const searchQuery = keywords.length > 0 ? keywords.join(' ') : normalizedQuery;
        
        const expanded = [...keywords];
        keywords.forEach(t => { if (BIBLE_SYNONYMS[t]) expanded.push(...BIBLE_SYNONYMS[t]); });
        
        versionResults = index.search(expanded.length > 0 ? expanded.join(' ') : searchQuery, { 
          combine: 'OR', prefix: false, boost: { content: 2 }, fuzzy: 0.1
        });
      }

      if (range !== 'all') {
        versionResults = versionResults.filter(r => {
          const doc = r as any;
          if (range === 'ot') return OT_BOOKS.includes(doc.bookId);
          if (range === 'nt') return NT_BOOKS.includes(doc.bookId);
          if (range === 'book') return doc.bookId === currentBookId;
          return true;
        });
      }
      allResults.push(...versionResults.map(r => ({ ...r, versionId: id })));
    }

    console.log(`[SearchService] Results found: ${allResults.length}`);
    return allResults.sort((a, b) => b.score - a.score).slice(0, 1000);
  }
}

export const searchService = new BibleSearchService();
