import texts from '../data/zhouyi/texts.json';
import wings from '../data/zhouyi/wings.json';
import type { ClassicExcerpt } from './classics/types';

export type Hexagram = { id: number; name: string; shortName: string; upper: string; lower: string; palace: string; guaCi: string; tuanCi: string; daXiang: string;
  wenYan?: string; yongCi?: string; yaos: Array<{ position: number; positionName: string; yaoCi: string; xiaoXiang: string; explanation?: string }>; sourceRevision: number };
export type ZhouyiWingEntry = {
  id: string;
  wing: string;
  chapter: string;
  title: string;
  trigrams?: string[];
  text: string;
};
export const source = {
  title: '《周易》六十四卦', edition: '项目转录，按维基文库逐卦页面核对；校订于 2026-09-11', attribution: '维基文库《周易》各页贡献者',
  license: 'CC BY-SA 4.0；古典原文本身属公版', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  note: '转录使用简体字形，卦辞和爻辞去掉段末句号；卦名与卦序沿用项目资料，未对不同古籍底本进行异文校勘。',
};
export const allHexagrams: readonly Hexagram[] = texts;
export const allWings: readonly ZhouyiWingEntry[] = wings;
export function sourceUrl(hexagram: Hexagram) { return `https://zh.wikisource.org/w/index.php?oldid=${hexagram.sourceRevision}`; }
export function findHexagram(value: number | string) {
  if (typeof value === 'number') return allHexagrams.find((item) => item.id === value);
  const name = value.trim().replace(/卦$/u, '').replace(/遯/g, '遁');
  return allHexagrams.find((item) => item.name === name || item.shortName === name);
}

/** 仅按实际动爻提供原文，不将静爻伪称为动爻。 */
export function hexagramClassics(originalName: string, changedName: string, moving: readonly number[]) {
  const original = findHexagram(originalName), changed = findHexagram(changedName);
  if (!original || !changed) throw new Error('六爻卦名与周易资料不一致。');
  const selected = original.yaos.filter((line) => moving.includes(line.position));
  if (selected.length !== new Set(moving).size) throw new Error('六爻动爻位置与周易资料不一致。');
  return [`本卦《${original.name}》卦辞：${original.guaCi}；${original.tuanCi}；${original.daXiang}`,
    ...selected.map((line) => `${line.positionName}爻辞：${line.yaoCi}；${line.xiaoXiang}`),
    ...(selected.length === 6 && original.yongCi ? [`${original.id === 1 ? '用九' : '用六'}：${original.yongCi}`] : []),
    ...(changed.id !== original.id ? [`变卦《${changed.name}》卦辞：${changed.guaCi}；${changed.daXiang}`] : []),
    `经文来源：${source.attribution}；${source.edition}；${source.license}（${source.licenseUrl}）。本卦版本：${sourceUrl(original)}${changed.id !== original.id ? `；变卦版本：${sourceUrl(changed)}` : ''}。${source.note}`].join('\n');
}

const TRIGRAM_SET = new Set(['乾', '坤', '震', '巽', '坎', '离', '艮', '兑']);
const WING_ALIASES: Record<string, string[]> = {
  文言: ['文言传'],
  文言传: ['文言传'],
  系辞: ['系辞上传', '系辞下传'],
  系辞传: ['系辞上传', '系辞下传'],
  系辞上: ['系辞上传'],
  系辞上传: ['系辞上传'],
  系辞下: ['系辞下传'],
  系辞下传: ['系辞下传'],
  说卦: ['说卦传'],
  说卦传: ['说卦传'],
  序卦: ['序卦传'],
  序卦传: ['序卦传'],
  杂卦: ['杂卦传'],
  杂卦传: ['杂卦传'],
};

function normalizeWingFilter(wing?: string): string[] | null {
  if (!wing) return null;
  const cleaned = wing.trim().replace(/[《》]/g, '');
  if (!cleaned) return null;
  return WING_ALIASES[cleaned] ?? [cleaned];
}

function normalizeTrigram(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/卦$/u, '');
  const first = trimmed.slice(0, 1);
  return TRIGRAM_SET.has(first) ? first : null;
}

function buildExcerpt(text: string, keyword: string): string | undefined {
  const index = text.indexOf(keyword);
  if (index < 0) return undefined;
  const start = Math.max(0, index - 24);
  const end = Math.min(text.length, index + keyword.length + 24);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

export interface WingSearchParams {
  wing?: string;
  chapter?: string;
  trigram?: string;
  text?: string;
  offset?: number;
  limit?: number;
}

/** 按篇名、章节、八卦名或关键词检索《周易》十翼原文。 */
export function searchWings(params: WingSearchParams = {}) {
  const wingTargets = normalizeWingFilter(params.wing);
  const chapterQuery = params.chapter?.trim();
  const trigramQuery = normalizeTrigram(params.trigram);
  const textQuery = params.text?.trim();

  const matched = allWings.flatMap((entry) => {
    if (wingTargets && !wingTargets.includes(entry.wing)) return [];
    if (chapterQuery && !entry.chapter.includes(chapterQuery) && !entry.title.includes(chapterQuery)) return [];
    if (trigramQuery && !entry.trigrams?.includes(trigramQuery) && !entry.text.includes(trigramQuery)) return [];
    if (textQuery && !entry.text.includes(textQuery) && !entry.title.includes(textQuery) && !entry.chapter.includes(textQuery)) {
      return [];
    }
    const excerpt = textQuery ? buildExcerpt(entry.text, textQuery) : undefined;
    return [{ ...entry, ...(excerpt ? { excerpt } : {}) }];
  });

  const offset = params.offset ?? 0;
  const limit = params.limit ?? 20;
  const items = matched.slice(offset, offset + limit);
  return {
    items,
    total: matched.length,
    offset,
    limit,
    nextOffset: offset + limit < matched.length ? offset + limit : null,
  };
}

function extractShuoguaTrigramQuote(trigram: string): string | null {
  const virtueEntry = allWings.find((w) => w.id === 'shuogua-7');
  const imageryEntry = allWings.find((w) => w.id === 'shuogua-11');
  const virtue = virtueEntry?.text
    .split(/[；。]/u)
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${trigram}，`));
  const imagery = imageryEntry?.text
    .split('\n')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${trigram}为`));
  const parts = [virtue ? `${virtue}。` : '', imagery ?? ''].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/** 按本卦/体用八卦提取《说卦传》八卦类象与《文言》《系辞》经典片段。 */
export function selectZhouyiWingClassics({
  trigrams,
  originalHexagram,
  changedHexagram,
  movingCount,
}: {
  trigrams?: string[];
  originalHexagram?: string;
  changedHexagram?: string;
  movingCount?: number;
} = {}): ClassicExcerpt[] {
  const results: ClassicExcerpt[] = [];
  const orig = originalHexagram ? findHexagram(originalHexagram) : undefined;
  const changed = changedHexagram ? findHexagram(changedHexagram) : undefined;

  const rawTrigrams = trigrams?.length
    ? trigrams
    : orig
      ? [orig.upper, orig.lower]
      : [];
  const uniqueTrigrams = [...new Set(rawTrigrams.map((t) => normalizeTrigram(t)).filter((t): t is string => !!t))];

  for (const trigram of uniqueTrigrams.slice(0, 4)) {
    const quote = extractShuoguaTrigramQuote(trigram);
    if (quote) {
      results.push({
        book: '周易·说卦传',
        chapter: '八卦德性与万物类象',
        title: `${trigram}卦类象`,
        quote,
        condition: trigram,
      });
    }
  }

  if (orig?.id === 1 || changed?.id === 1) {
    const qianWenyan = allWings.find((w) => w.id === 'wenyan-qian');
    const firstParagraph = qianWenyan?.text.split('\n')[0];
    if (firstParagraph) {
      results.push({
        book: '周易·文言传',
        chapter: '乾文言',
        title: '乾元四德',
        quote: firstParagraph,
        condition: '乾卦',
      });
    }
  }

  if (orig?.id === 2 || changed?.id === 2) {
    const kunWenyan = allWings.find((w) => w.id === 'wenyan-kun');
    const firstParagraph = kunWenyan?.text.split('\n')[0];
    if (firstParagraph) {
      results.push({
        book: '周易·文言传',
        chapter: '坤文言',
        title: '坤道柔顺',
        quote: firstParagraph,
        condition: '坤卦',
      });
    }
  }

  if (typeof movingCount === 'number' && movingCount > 0) {
    results.push({
      book: '周易·系辞下传',
      chapter: '第一章',
      title: '动变生吉凶',
      quote: '吉凶悔吝者，生乎动者也；刚柔者，立本者也；变通者，趣时者也。',
      condition: `动爻数=${movingCount}`,
    });
  } else if (orig || uniqueTrigrams.length > 0) {
    results.push({
      book: '周易·系辞上传',
      chapter: '第二章',
      title: '观象玩辞观变玩占',
      quote: '是故君子居则观其象而玩其辞，动则观其变而玩其占，是以自天佑之，吉无不利。',
    });
  }

  return results;
}
