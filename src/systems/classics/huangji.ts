import type { ClassicExcerpt } from './types';

export type HuangjiCycleClassic = {
  cycleType: string;
  name: string;
  sourceBook: string;
  verse: string;
  principle: string;
  modernAdvice: string;
};

function splitSourceBook(sourceBook: string): { book: string; chapter?: string } {
  const cleaned = sourceBook.replace(/[《》]/gu, '');
  const idx = cleaned.indexOf('·');
  if (idx === -1) return { book: cleaned };
  return { book: cleaned.slice(0, idx), chapter: cleaned.slice(idx + 1) };
}

/** 张行成《皇极经世索隐·经世观物总要》的周期原文与释义。 */
const CANONICAL_HUANGJI_CYCLE_CLASSICS: Record<string, HuangjiCycleClassic> = {
  元: {
    cycleType: '元',
    name: '元 · 十二万九千六百年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '总一元有十二会、三百六十运、四千三百二十世。',
    principle: '一元由十二会组成，合三百六十运、四千三百二十世，共十二万九千六百年。',
    modernAdvice: '结合所取纪元，定位当前会、运、世在一元中的层次。',
  },
  会: {
    cycleType: '会',
    name: '会 · 一万零八百年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '月为会，自子至亥分十二会。星为运，自甲至癸凡三周，得三十运，为一会。',
    principle: '一会包含三十运，合一万零八百年；十二会以十二地支依次命名。',
    modernAdvice: '先辨所处会次及其起止，再阅读会内的运、世位置。',
  },
  运: {
    cycleType: '运',
    name: '运 · 三百六十年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '辰为世，自子至亥一周得十二世为一运。',
    principle: '一运包含十二世，每世三十年，合三百六十年。',
    modernAdvice: '把当前世次放回所属运的起止范围，比较前后周期位置。',
  },
  世: {
    cycleType: '世',
    name: '世 · 三十年',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '三十年为一世，则一运得三百六十年，一会得一万八百年，一元得一十二万九千六百年。',
    principle: '世是三十年的计数层级；十二世积为一运。',
    modernAdvice: '结合本世起止年，辨明目标年在三十年周期中的位置。',
  },
  年: {
    cycleType: '年',
    name: '年 · 经世层次',
    sourceBook: '《皇极经世索隐·经世观物总要》',
    verse: '会之用至年，故以会经运，始书年。',
    principle: '原文说明经世记年与会、运层次的关系。',
    modernAdvice: '阅读值年卦时，结合本次所取年序和上层周期共同理解。',
  },
};

export const HUANGJI_CYCLE_CLASSICS: Record<string, HuangjiCycleClassic> = structuredClone(
  CANONICAL_HUANGJI_CYCLE_CLASSICS,
);

export function getHuangjiCycleClassic(cycle: string): HuangjiCycleClassic | undefined {
  if (typeof cycle !== 'string' || !Object.hasOwn(CANONICAL_HUANGJI_CYCLE_CLASSICS, cycle)) {
    return undefined;
  }
  return { ...CANONICAL_HUANGJI_CYCLE_CLASSICS[cycle] };
}

function toHuangjiExcerpt(entry: HuangjiCycleClassic): ClassicExcerpt {
  const { book, chapter } = splitSourceBook(entry.sourceBook);
  return {
    book,
    chapter,
    title: entry.name,
    quote: entry.verse,
    explanation: `${entry.principle} ${entry.modernAdvice}`,
    condition: `皇极周期为${entry.cycleType}`,
  };
}

/**
 * 按皇极经世周期层级筛选典籍片段；未传入周期时返回全部五个层级。
 */
export function selectHuangjiClassics(cycles?: readonly string[]): ClassicExcerpt[] {
  const targets =
    cycles && cycles.length > 0 ? cycles : Object.keys(CANONICAL_HUANGJI_CYCLE_CLASSICS);
  const seen = new Set<string>();
  const excerpts: ClassicExcerpt[] = [];

  for (const cycle of targets) {
    const trimmed = cycle.trim();
    const entry = getHuangjiCycleClassic(trimmed);
    if (!entry || seen.has(entry.cycleType)) continue;
    seen.add(entry.cycleType);
    excerpts.push(toHuangjiExcerpt(entry));
  }

  return excerpts;
}
