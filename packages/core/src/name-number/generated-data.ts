export interface GeneratedCharacterData {
  char: string;
  simplified: string;
  traditional: string;
  kangxiStrokes: number;
  radical?: string;
  wuxing: string | null;
  pinyin?: string;
  definition?: string | null;
  common: boolean;
  simplifiedStrokes: number | null;
  traditionalStrokes: number | null;
  structure: string | null;
  kangxiVolume: string | null;
  kangxiSection: string | null;
}

export type GeneratedCharacterTuple = readonly [string, string, number, string | null, string | null, string | null, string | null, number | null, number | null, string | null, string | null, string | null, boolean];

export interface GeneratedShuliData { level: string; poem: string; text: string; keywords: string; level_note?: string }

export { CHARACTER_TUPLES } from './generated-character-tuples.js';
export { SANCAI_DATA, SHULI_DATA } from './generated-numerology-data.js';
