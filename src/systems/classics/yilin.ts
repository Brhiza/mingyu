import yilinData from '../../data/yilin.json';
import zhouyiTexts from '../../data/zhouyi/texts.json';
import type { ClassicExcerpt } from './types';

export const YILIN_HEXAGRAM_ORDER: readonly string[] = yilinData.hexagrams;

const HEXAGRAM_INDEX = new Map<string, number>(
  yilinData.hexagrams.map((name, index) => [name, index]),
);

const FULL_NAME_TO_SHORT = new Map<string, string>(
  zhouyiTexts.map((item) => [item.name, item.shortName]),
);

const HEXAGRAM_ALIASES: Record<string, string> = {
  㢲: '巽',
  兊: '兌',
  兑: '兌',
  剥: '剝',
  归妹: '歸妹',
  随: '隨',
  观: '觀',
  贲: '賁',
  颐: '頤',
  讼: '訟',
  师: '師',
  复: '復',
  晋: '晉',
  遁: '遯',
  無妄: '无妄',
  恆: '恒',
  㤗: '泰',
  丰: '豐',
  离: '離',
  节: '節',
  损: '損',
  渐: '漸',
  既济: '既濟',
  未济: '未濟',
  大过: '大過',
  小过: '小過',
  大壮: '大壯',
  涣: '渙',
  谦: '謙',
  临: '臨',
  蛊: '蠱',
};

export interface YilinEntry {
  base: string;
  target: string;
  key: string;
  text: string;
}

/**
 * 将卦名（含简体、繁体、异体及周易全名如“乾为天”）规范化为《焦氏易林》64 卦名。
 */
export function normalizeYilinHexagramName(value: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().replace(/卦$/u, '');
  if (!trimmed) return undefined;

  const candidate = FULL_NAME_TO_SHORT.get(trimmed) ?? trimmed;
  if (HEXAGRAM_INDEX.has(candidate)) {
    return candidate;
  }
  return Object.hasOwn(HEXAGRAM_ALIASES, candidate) ? HEXAGRAM_ALIASES[candidate] : undefined;
}

/**
 * 按本卦与变卦查询《焦氏易林》4,096 卦变林辞。
 */
export function getYilinEntry(baseHexagram: string, targetHexagram: string): YilinEntry | undefined {
  const base = normalizeYilinHexagramName(baseHexagram);
  const target = normalizeYilinHexagramName(targetHexagram);
  if (!base || !target) return undefined;

  const baseIdx = HEXAGRAM_INDEX.get(base);
  const targetIdx = HEXAGRAM_INDEX.get(target);
  if (baseIdx === undefined || targetIdx === undefined) return undefined;

  const text = yilinData.entries[baseIdx * yilinData.hexagrams.length + targetIdx];
  if (text === undefined) return undefined;

  return {
    base,
    target,
    key: `${base}之${target}`,
    text,
  };
}

/**
 * 严格查询《焦氏易林》林辞，无效卦名时抛出中文错误。
 */
export function queryYilinEntry(baseHexagram: string, targetHexagram: string): YilinEntry {
  const base = normalizeYilinHexagramName(baseHexagram);
  if (!base) {
    throw new Error(`本卦不是有效的六十四卦名：${baseHexagram || '（空）'}。`);
  }
  const target = normalizeYilinHexagramName(targetHexagram);
  if (!target) {
    throw new Error(`变卦不是有效的六十四卦名：${targetHexagram || '（空）'}。`);
  }
  const entry = getYilinEntry(base, target);
  if (!entry) {
    throw new Error(`《焦氏易林》中未找到 ${base}之${target} 条目。`);
  }
  return entry;
}

export function explainYilinTone(verse: string): string {
  const positiveHits = (verse.match(/(吉|喜|利|福|安|和|成|通|昌|乐|泰|兴|贵|丰|得|归)/gu) ?? []).length;
  const cautionHits = (verse.match(/(忧|灾|阻|难|失|危|悔|凶|病|讼|苦|败|伤|亡|惊|困)/gu) ?? []).length;
  if (positiveHits > cautionHits + 1) {
    return '林辞主基调偏吉顺畅达，重在顺势推进或得贵人相济。';
  }
  if (cautionHits > positiveHits + 1) {
    return '林辞主基调偏警示阻滞，提醒防口舌损耗，宜慎守避险。';
  }
  return '林辞取比兴象征，兼具转机与权衡之意，须结合卦象与所问具体人事合看。';
}

/**
 * 为梅花易数或六爻生成按需附带的《焦氏易林》典籍片段。
 */
export function selectYilinClassic({
  baseHexagram,
  targetHexagram,
}: {
  baseHexagram?: string;
  targetHexagram?: string;
} = {}): ClassicExcerpt | undefined {
  if (!baseHexagram || !targetHexagram) return undefined;
  const entry = getYilinEntry(baseHexagram, targetHexagram);
  if (!entry) return undefined;

  return {
    book: '焦氏易林',
    title: entry.key,
    quote: entry.text,
    explanation: explainYilinTone(entry.text),
    condition: `${entry.base}→${entry.target}`,
  };
}
