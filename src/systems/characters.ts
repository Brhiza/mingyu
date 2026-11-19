import dictionary from '../data/characters/index.json';
import searchOrder from '../data/characters/search-order.json';
import type { CharacterShardLoader } from '../character-data';

export interface CharacterDetail {
  char: string; simplified: string; traditional: string; kangxiStrokes: number;
  radical?: string; wuxing: string | null; pinyin?: string; definition?: string | null; common: boolean;
  simplifiedStrokes: number | null; traditionalStrokes: number | null; structure: string | null;
  kangxiVolume: string | null; kangxiSection: string | null; strokeNote?: string; readingNote?: string;
}
const glyphs: Record<string, number> = dictionary.glyphs;
const records: CharacterDetail[] = (dictionary.records as unknown as Array<Array<string | number | boolean | null>>).map((row) => {
  const [char, simplified, traditional, kangxiStrokes, radical, wuxing, pinyin, simplifiedStrokes, traditionalStrokes, structure, kangxiVolume, kangxiSection, common, readingNote, strokeNote] = row;
  return { char, simplified, traditional, kangxiStrokes, ...(radical === null ? {} : { radical }), wuxing, ...(pinyin === null ? {} : { pinyin }),
    simplifiedStrokes, traditionalStrokes, structure, kangxiVolume, kangxiSection, common,
    ...(readingNote == null ? {} : { readingNote }), ...(strokeNote == null ? {} : { strokeNote }) } as CharacterDetail;
});

export function characterRecordId(char: string) {
  return Object.hasOwn(glyphs, char) ? glyphs[char] : undefined;
}
export function characterMetadata(char: string) {
  const id = characterRecordId(char);
  return id === undefined ? null : { ...records[id] };
}
export function searchOrderedMetadata(): readonly CharacterDetail[] {
  return searchOrder.map((index) => records[index]);
}
async function completeDetails(ids: number[], loadShard?: CharacterShardLoader) {
  const definitions = await (await import('./character-shards')).characterEntries('definitions', ids, loadShard);
  return Object.fromEntries(ids.map((id) => [id, { ...records[id], definition: definitions[id] ?? null }]));
}
export async function characterDetail(char: string, loadShard?: CharacterShardLoader) {
  const id = characterRecordId(char);
  return id === undefined ? null : (await completeDetails([id], loadShard))[id];
}
export async function characterDetails(chars: readonly string[], loadShard?: CharacterShardLoader) {
  const known = [...new Set(chars.map(characterRecordId).filter((id): id is number => id !== undefined))];
  const details = await completeDetails(known, loadShard);
  return Object.fromEntries(chars.map((char) => { const id = characterRecordId(char); return [char, id === undefined ? null : details[id]]; }));
}

export async function lookupCharacters(text: string, includeReferences: boolean, loadShard?: CharacterShardLoader) {
  const chars = [...text.trim()];
  if (!chars.length || chars.length > 20 || chars.some((char) => !/\p{Script=Han}/u.test(char))) throw new Error('请输入 1 至 20 个汉字。');
  const ids = chars.map(characterRecordId);
  const known = ids.filter((id): id is number => id !== undefined);
  const [details, references] = await Promise.all([completeDetails(known, loadShard), includeReferences ? (await import('./character-shards')).characterEntries('references', known, loadShard) : {}]);
  const referenceById: Record<string, string | null> = references;
  const characters = chars.map((char, index) => {
    const id = ids[index], detail = id === undefined ? null : details[id];
    return { char, detail: detail && includeReferences && id !== undefined ? { ...detail, kangxiText: referenceById[id] ?? null } : detail };
  });
  return { text: chars.join(''), characters, totalKangxiStrokes: characters.every((item) => item.detail) ? characters.reduce((sum, item) => sum + item.detail!.kangxiStrokes, 0) : null,
    unknownCharacters: characters.filter((item) => !item.detail).map((item) => item.char) };
}

export interface CharacterFilter {
  strokes?: number; strokesMin?: number; strokesMax?: number; wuxing?: string; radical?: string; pinyin?: string; commonOnly?: boolean; offset?: number; limit?: number;
}
function normalizePinyin(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/u\u0308|u:/g, 'v').replace(/[\u0300-\u036f]/g, '').replace(/[1-5]/g, '');
}
export async function searchCharacters(filter: CharacterFilter, loadShard?: CharacterShardLoader) {
  if (filter.strokesMin !== undefined && filter.strokesMax !== undefined && filter.strokesMin > filter.strokesMax) throw new Error('最小笔画不能大于最大笔画。');
  const pinyin = normalizePinyin(filter.pinyin ?? ''), offset = filter.offset ?? 0, limit = filter.limit ?? 50;
  const matched = searchOrder.filter((index) => {
    const item = records[index];
    return (!(filter.commonOnly ?? true) || item.common) && (filter.strokes === undefined || item.kangxiStrokes === filter.strokes)
      && (filter.strokesMin === undefined || item.kangxiStrokes >= filter.strokesMin) && (filter.strokesMax === undefined || item.kangxiStrokes <= filter.strokesMax)
      && (!filter.wuxing || item.wuxing === filter.wuxing) && (!filter.radical || item.radical === filter.radical)
      && (!pinyin || normalizePinyin(item.pinyin ?? '').split(/[^a-zv]+/).some((reading) => reading.startsWith(pinyin)));
  });
  const selected = matched.slice(offset, offset + limit), details = await completeDetails(selected, loadShard);
  const items = selected.map((id) => details[id]);
  return { items, total: matched.length, offset, nextOffset: offset + items.length < matched.length ? offset + items.length : null };
}
