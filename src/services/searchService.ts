import MiniSearch from 'minisearch';
import type { BibleVersion, Verse } from '../types/bible';

const OT_BOOKS = ['GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO', 'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOE', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'];
const NT_BOOKS = ['MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV'];

export type SearchRange = 'all' | 'ot' | 'nt' | 'book';

export class BibleSearchService {
  private indices: Map<string, MiniSearch<Verse>> = new Map();

  /**
   * Index a bible version for fast searching
   */
  indexVersion(version: BibleVersion) {
    const miniSearch = new MiniSearch<Verse>({
      fields: ['content'], // fields to index for full-text search
      storeFields: ['bookId', 'bookName', 'chapter', 'verse', 'content'], // fields to return with search results
      searchOptions: {
        boost: { content: 2 },
        fuzzy: 0.2, // Allow some fuzziness for "similar expressions"
        prefix: true
      }
    });

    // MiniSearch requires a unique ID field 'id'
    const docs = version.verses.map((v, idx) => ({
      ...v,
      id: `${version.id}-${idx}`
    }));

    miniSearch.addAll(docs);
    this.indices.set(version.id, miniSearch);
  }

  /**
   * Search across indexed versions
   * mode: 'word' (AND match), 'phrase' (Exact match)
   */
  search(
    query: string, 
    versionIds: string[], 
    mode: 'word' | 'phrase' = 'word',
    range: SearchRange = 'all',
    currentBookId?: string
  ): any[] {
    const allResults: any[] = [];
    if (!query) return [];

    const searchOptions = mode === 'phrase'
      ? { combine: 'AND', prefix: true, fuzzy: 0.2 }
      : { combine: 'OR', prefix: true, fuzzy: 0.2 };

    for (const id of versionIds) {
      const index = this.indices.get(id);
      if (index) {
        let results = index.search(query, searchOptions);
        
        // Mode: Phrase
        if (mode === 'phrase') {
          results = results.filter(r => (r as any).content.replace(/\s/g, '').includes(query.replace(/\s/g, '')));
        }

        // Range Filtering
        if (range !== 'all') {
          results = results.filter(r => {
            const doc = r as any;
            if (range === 'ot') return OT_BOOKS.includes(doc.bookId);
            if (range === 'nt') return NT_BOOKS.includes(doc.bookId);
            if (range === 'book') return doc.bookId === currentBookId;
            return true;
          });
        }

        allResults.push(...results.map(r => ({ ...r, versionId: id })));
      }
    }

    // Sort by score
    return allResults.sort((a, b) => b.score - a.score);
  }
}

export const searchService = new BibleSearchService();
