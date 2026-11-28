import type { StaticDatasetLoader } from '../../static-data';
import { loadStaticDataset } from '../static-data-loader';
import type { ClassicExcerpt } from './types';

interface YilinDataset {
  hexagrams: readonly string[];
  entries: readonly string[];
}

export const YILIN_HEXAGRAM_ORDER: readonly string[] = [
  '乾', '坤', '屯', '蒙', '需', '訟', '師', '比',
  '小畜', '履', '泰', '否', '同人', '大有', '謙', '豫',
  '隨', '蠱', '臨', '觀', '噬嗑', '賁', '剝', '復',
  '无妄', '大畜', '頤', '大過', '坎', '離', '咸', '恒',
  '遯', '大壯', '晉', '明夷', '家人', '睽', '蹇', '解',
  '損', '益', '夬', '姤', '萃', '升', '困', '井',
  '革', '鼎', '震', '艮', '漸', '歸妹', '豐', '旅',
  '巽', '兌', '渙', '節', '中孚', '小過', '既濟', '未濟',
];

const HEXAGRAM_INDEX = new Map<string, number>(
  YILIN_HEXAGRAM_ORDER.map((name, index) => [name, index]),
);

const FULL_NAME_TO_SHORT = new Map<string, string>([
  ['乾为天', '乾'], ['坤为地', '坤'], ['水雷屯', '屯'], ['山水蒙', '蒙'],
  ['水天需', '需'], ['天水讼', '讼'], ['地水师', '师'], ['水地比', '比'],
  ['风天小畜', '小畜'], ['天泽履', '履'], ['地天泰', '泰'], ['天地否', '否'],
  ['天火同人', '同人'], ['火天大有', '大有'], ['地山谦', '谦'], ['雷地豫', '豫'],
  ['泽雷随', '随'], ['山风蛊', '蛊'], ['地泽临', '临'], ['风地观', '观'],
  ['火雷噬嗑', '噬嗑'], ['山火贲', '贲'], ['山地剥', '剥'], ['地雷复', '复'],
  ['天雷无妄', '无妄'], ['山天大畜', '大畜'], ['山雷颐', '颐'], ['泽风大过', '大过'],
  ['坎为水', '坎'], ['离为火', '离'], ['泽山咸', '咸'], ['雷风恒', '恒'],
  ['天山遁', '遁'], ['雷天大壮', '大壮'], ['火地晋', '晋'], ['地火明夷', '明夷'],
  ['风火家人', '家人'], ['火泽睽', '睽'], ['水山蹇', '蹇'], ['雷水解', '解'],
  ['山泽损', '损'], ['风雷益', '益'], ['泽天夬', '夬'], ['天风姤', '姤'],
  ['泽地萃', '萃'], ['地风升', '升'], ['泽水困', '困'], ['水风井', '井'],
  ['泽火革', '革'], ['火风鼎', '鼎'], ['震为雷', '震'], ['艮为山', '艮'],
  ['风山渐', '渐'], ['雷泽归妹', '归妹'], ['雷火丰', '丰'], ['火山旅', '旅'],
  ['巽为风', '巽'], ['兑为泽', '兑'], ['风水涣', '涣'], ['水泽节', '节'],
  ['风泽中孚', '中孚'], ['雷山小过', '小过'], ['水火既济', '既济'], ['火水未济', '未济'],
]);

let loadedYilinEntries: readonly string[] | null = null;

/** 按需加载《焦氏易林》4,096 条林辞索引，避免将 425 KB 数据直接打入主包或 Worker。 */
export async function ensureYilinLoaded(load?: StaticDatasetLoader): Promise<void> {
  const data = await loadStaticDataset<YilinDataset>('yilin', load);
  loadedYilinEntries = data.entries;
}

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

  if (!loadedYilinEntries) {
    throw new Error('《焦氏易林》资料尚未加载。');
  }
  const text = loadedYilinEntries[baseIdx * YILIN_HEXAGRAM_ORDER.length + targetIdx];
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
