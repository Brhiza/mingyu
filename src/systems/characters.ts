import type { CharacterIndexData, CharacterIndexLoader, CharacterShardLoader } from '../character-data';
import { characterEntries, loadCharacterIndexData } from './character-shards';

export interface CharacterDetail {
  char: string; simplified: string; traditional: string; kangxiStrokes: number;
  radical?: string; wuxing: string | null; pinyin?: string; definition?: string | null; common: boolean;
  simplifiedStrokes: number | null; traditionalStrokes: number | null; structure: string | null;
  kangxiVolume: string | null; kangxiSection: string | null; strokeNote?: string; readingNote?: string;
}

export interface CharacterDictionary {
  glyphs: Record<string, number>;
  records: CharacterDetail[];
  searchOrder: number[];
  recordId: (char: string) => number | undefined;
  metadata: (char: string) => CharacterDetail | null;
  searchOrdered: () => readonly CharacterDetail[];
}

function buildDictionary({ index, searchOrder }: CharacterIndexData): CharacterDictionary {
  const glyphs: Record<string, number> = index.glyphs;
  const records: CharacterDetail[] = index.records.map((row) => {
    const [char, simplified, traditional, kangxiStrokes, radical, wuxing, pinyin, simplifiedStrokes, traditionalStrokes, structure, kangxiVolume, kangxiSection, common, readingNote, strokeNote] = row;
    return {
      char, simplified, traditional, kangxiStrokes,
      ...(radical === null ? {} : { radical }),
      wuxing,
      ...(pinyin === null ? {} : { pinyin }),
      simplifiedStrokes, traditionalStrokes, structure, kangxiVolume, kangxiSection, common,
      ...(readingNote == null ? {} : { readingNote }),
      ...(strokeNote == null ? {} : { strokeNote }),
    } as CharacterDetail;
  });
  const recordId = (char: string) => (Object.hasOwn(glyphs, char) ? glyphs[char] : undefined);
  const metadata = (char: string) => {
    const id = recordId(char);
    return id === undefined ? null : { ...records[id] };
  };
  const searchOrdered = () => searchOrder.map((idx) => records[idx]);
  return { glyphs, records, searchOrder, recordId, metadata, searchOrdered };
}

let defaultDictionaryPromise: Promise<CharacterDictionary> | undefined;
const customDictionaryCache = new WeakMap<CharacterIndexLoader, Promise<CharacterDictionary>>();

/** 按需加载并缓存康熙字库字典索引与排序表。 */
export async function loadCharacterDictionary(loadIndex?: CharacterIndexLoader): Promise<CharacterDictionary> {
  if (loadIndex) {
    let pending = customDictionaryCache.get(loadIndex);
    if (!pending) {
      pending = loadCharacterIndexData(loadIndex).then(buildDictionary);
      customDictionaryCache.set(loadIndex, pending);
    }
    try { return await pending; }
    catch (error) { if (customDictionaryCache.get(loadIndex) === pending) customDictionaryCache.delete(loadIndex); throw error; }
  }
  if (!defaultDictionaryPromise) {
    defaultDictionaryPromise = loadCharacterIndexData().then(buildDictionary);
  }
  const active = defaultDictionaryPromise;
  try { return await active; }
  catch (error) { if (defaultDictionaryPromise === active) defaultDictionaryPromise = undefined; throw error; }
}

async function completeDetails(dict: CharacterDictionary, ids: number[], loadShard?: CharacterShardLoader) {
  const definitions = await characterEntries('definitions', ids, loadShard);
  return Object.fromEntries(ids.map((id) => [id, { ...dict.records[id], definition: definitions[id] ?? null }]));
}

export async function characterDetail(char: string, loadShard?: CharacterShardLoader, loadIndex?: CharacterIndexLoader) {
  const dict = await loadCharacterDictionary(loadIndex);
  const id = dict.recordId(char);
  return id === undefined ? null : (await completeDetails(dict, [id], loadShard))[id];
}

export async function characterDetails(chars: readonly string[], loadShard?: CharacterShardLoader, loadIndex?: CharacterIndexLoader) {
  const dict = await loadCharacterDictionary(loadIndex);
  const known = [...new Set(chars.map(dict.recordId).filter((id): id is number => id !== undefined))];
  const details = await completeDetails(dict, known, loadShard);
  return Object.fromEntries(chars.map((char) => {
    const id = dict.recordId(char);
    return [char, id === undefined ? null : details[id]];
  }));
}

export async function lookupCharacters(
  text: string,
  includeReferences: boolean,
  loadShard?: CharacterShardLoader,
  loadIndex?: CharacterIndexLoader,
) {
  const chars = [...text.trim()];
  if (!chars.length || chars.length > 20 || chars.some((char) => !/\p{Script=Han}/u.test(char))) throw new Error('请输入 1 至 20 个汉字。');
  const dict = await loadCharacterDictionary(loadIndex);
  const ids = chars.map(dict.recordId);
  const known = ids.filter((id): id is number => id !== undefined);
  const [details, references] = await Promise.all([
    completeDetails(dict, known, loadShard),
    includeReferences ? characterEntries('references', known, loadShard) : {},
  ]);
  const referenceById: Record<string, string | null> = references;
  const characters = chars.map((char, index) => {
    const id = ids[index], detail = id === undefined ? null : details[id];
    return { char, detail: detail && includeReferences && id !== undefined ? { ...detail, kangxiText: referenceById[id] ?? null } : detail };
  });
  return {
    text: chars.join(''),
    characters,
    totalKangxiStrokes: characters.every((item) => item.detail) ? characters.reduce((sum, item) => sum + item.detail!.kangxiStrokes, 0) : null,
    unknownCharacters: characters.filter((item) => !item.detail).map((item) => item.char),
  };
}

export interface CharacterFilter {
  strokes?: number; strokesMin?: number; strokesMax?: number; wuxing?: string; radical?: string; pinyin?: string; commonOnly?: boolean; offset?: number; limit?: number;
}
function normalizePinyin(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/u\u0308|u:/g, 'v').replace(/[\u0300-\u036f]/g, '').replace(/[1-5]/g, '');
}
export async function searchCharacters(
  filter: CharacterFilter,
  loadShard?: CharacterShardLoader,
  loadIndex?: CharacterIndexLoader,
) {
  if (filter.strokesMin !== undefined && filter.strokesMax !== undefined && filter.strokesMin > filter.strokesMax) throw new Error('最小笔画不能大于最大笔画。');
  const dict = await loadCharacterDictionary(loadIndex);
  const pinyin = normalizePinyin(filter.pinyin ?? ''), offset = filter.offset ?? 0, limit = filter.limit ?? 50;
  const matched = dict.searchOrder.filter((index) => {
    const item = dict.records[index];
    return (!(filter.commonOnly ?? true) || item.common) && (filter.strokes === undefined || item.kangxiStrokes === filter.strokes)
      && (filter.strokesMin === undefined || item.kangxiStrokes >= filter.strokesMin) && (filter.strokesMax === undefined || item.kangxiStrokes <= filter.strokesMax)
      && (!filter.wuxing || item.wuxing === filter.wuxing) && (!filter.radical || item.radical === filter.radical)
      && (!pinyin || normalizePinyin(item.pinyin ?? '').split(/[^a-zv]+/).some((reading) => reading.startsWith(pinyin)));
  });
  const selected = matched.slice(offset, offset + limit), details = await completeDetails(dict, selected, loadShard);
  const items = selected.map((id) => details[id]);
  return { items, total: matched.length, offset, nextOffset: offset + items.length < matched.length ? offset + items.length : null };
}
