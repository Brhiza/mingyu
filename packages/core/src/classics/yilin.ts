import pairIndex from './data/yilin-w20-03-pair-index';
import gapReport from './data/yilin-w20-03-gap-report';
import confirmedMappings from './data/yilin-w20-03-confirmed-mappings';
import type {
  YilinDataStatus,
  YilinEditionMetadata,
  YilinGapSummary,
  YilinHexagramName,
  YilinQueryResult,
  YilinSourceEntry,
  YilinSourceKind,
  YilinSourcePreference,
} from './types';

type RawYilinSource = {
  sourceKind: YilinSourceKind;
  source: string;
  volume: number;
  line: number;
  page: string | null;
  rawLabel: string;
  observedLabel: string;
  text: string;
  markers: {
    kanripoRefs: string[];
    wikisourceSKchars: string[];
  };
  skcharId: string | null;
};

type RawYilinPair = {
  base: string;
  target: string;
  key: string;
  volume: number;
  kanripo: RawYilinSource & { sourceKind: 'kanripo-wyg' };
  wikisource: RawYilinSource & { sourceKind: 'wikisource-skqs' };
  textDigest: {
    kanripo: string;
    wikisource: string;
  };
};

type RawGap = {
  kind: string;
  status?: string;
  key?: string;
  base?: string;
  target?: string;
  source?: string;
  line?: number;
  page?: string;
  observedRaw?: string;
  observed?: string;
  kanripoRefs?: string[];
  wikisourceSKchars?: string[];
};

type RawGapReport = {
  task: 'W20.03';
  editionPolicy: string;
  expectedPairCount: number;
  parsedPairCount: number;
  sourceProvenance: YilinEditionMetadata['sourceProvenance'];
  gaps: RawGap[];
  markerCounts: YilinEditionMetadata['gapSummary']['markerCounts'];
  confirmedMappingsCount: number;
  unresolvedSummary: {
    wikisourceOnlySKcharIds: string[];
    opaqueMarkerCountMismatchKeys: string[];
    labelOrderMismatchKeys: string[];
  };
};

type RawPairIndex = {
  task: 'W20.03';
  pairs: RawYilinPair[];
};

// 每行依次为卦名索引、目标索引、卷次，以及两份底本各自的元数据索引、卷次、行号、页码、标签、正文、标记和字形索引，末尾是两份正文摘要。
type CompactPairRow = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

type CompactPairIndex = {
  task: 'W20.03';
  hexagrams: string[];
  strings: string[];
  sourceMeta: Array<[number, number]>;
  markers: Array<[number[], number[]]>;
  pairs: CompactPairRow[];
};

function readCompactValue(index: CompactPairIndex, stringIndex: number): string | null {
  if (stringIndex < 0) return null;
  const value = index.strings[stringIndex];
  if (value === undefined) {
    throw new Error('焦氏易林固定索引字符串表下标异常。');
  }
  return value;
}

function decodeCompactSource(
  index: CompactPairIndex,
  row: CompactPairRow,
  offset: number,
): RawYilinSource {
  const [kindIndex, sourceIndex] = index.sourceMeta[row[offset]];
  const marker = index.markers[row[offset + 7]];
  if (!marker) throw new Error('焦氏易林固定索引标记表下标异常。');
  const [kanripoMarkerIndexes, wikisourceMarkerIndexes] = marker;
  return {
    sourceKind: readCompactValue(index, kindIndex) as YilinSourceKind,
    source: readCompactValue(index, sourceIndex) as string,
    volume: row[offset + 1],
    line: row[offset + 2],
    page: readCompactValue(index, row[offset + 3]),
    rawLabel: readCompactValue(index, row[offset + 4]) as string,
    observedLabel: readCompactValue(index, row[offset + 5]) as string,
    text: readCompactValue(index, row[offset + 6]) as string,
    markers: {
      kanripoRefs: kanripoMarkerIndexes.map(
        (stringIndex) => readCompactValue(index, stringIndex) as string,
      ),
      wikisourceSKchars: wikisourceMarkerIndexes.map(
        (stringIndex) => readCompactValue(index, stringIndex) as string,
      ),
    },
    skcharId: readCompactValue(index, row[offset + 8]),
  };
}

function decodeCompactPairIndex(index: CompactPairIndex): RawPairIndex {
  return {
    task: index.task,
    pairs: index.pairs.map((row) => {
      const base = index.hexagrams[row[0]];
      const target = index.hexagrams[row[1]];
      if (!base || !target) throw new Error('焦氏易林固定索引卦名表下标异常。');
      return {
        base,
        target,
        key: `${base}→${target}`,
        volume: row[2],
        kanripo: decodeCompactSource(index, row, 3) as RawYilinPair['kanripo'],
        wikisource: decodeCompactSource(index, row, 12) as RawYilinPair['wikisource'],
        textDigest: {
          kanripo: readCompactValue(index, row[21]) as string,
          wikisource: readCompactValue(index, row[22]) as string,
        },
      };
    }),
  };
}

const rawPairIndex = decodeCompactPairIndex(pairIndex as unknown as CompactPairIndex);
const rawGapReport = gapReport as unknown as RawGapReport;
const rawConfirmedMappings = confirmedMappings as unknown as {
  mappings: unknown[];
};

/** 固定卦序；这里只用于索引和输入规范化，不承担起卦或随机取卦。 */
export const YILIN_HEXAGRAM_ORDER = [
  '乾',
  '坤',
  '屯',
  '蒙',
  '需',
  '訟',
  '師',
  '比',
  '小畜',
  '履',
  '泰',
  '否',
  '同人',
  '大有',
  '謙',
  '豫',
  '隨',
  '蠱',
  '臨',
  '觀',
  '噬嗑',
  '賁',
  '剝',
  '復',
  '无妄',
  '大畜',
  '頤',
  '大過',
  '坎',
  '離',
  '咸',
  '恒',
  '遯',
  '大壯',
  '晉',
  '明夷',
  '家人',
  '睽',
  '蹇',
  '解',
  '損',
  '益',
  '夬',
  '姤',
  '萃',
  '升',
  '困',
  '井',
  '革',
  '鼎',
  '震',
  '艮',
  '漸',
  '歸妹',
  '豐',
  '旅',
  '巽',
  '兌',
  '渙',
  '節',
  '中孚',
  '小過',
  '既濟',
  '未濟',
] as const satisfies readonly YilinHexagramName[];

const HEXAGRAM_ALIASES: Record<string, YilinHexagramName> = {
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
  㤗: '泰',
  睽: '睽',
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
  无妄: '无妄',
};

const pairByKey = new Map(rawPairIndex.pairs.map((pair) => [pair.key, pair]));
const gapsByKey = new Map<string, RawGap[]>();

for (const gap of rawGapReport.gaps) {
  const key = gap.key ?? `${gap.base ?? ''}→${gap.target ?? ''}`;
  const current = gapsByKey.get(key) ?? [];
  current.push(gap);
  gapsByKey.set(key, current);
}

if (
  rawPairIndex.pairs.length !== rawGapReport.expectedPairCount ||
  rawGapReport.parsedPairCount !== rawGapReport.expectedPairCount ||
  rawConfirmedMappings.mappings.length !== rawGapReport.confirmedMappingsCount
) {
  throw new Error('焦氏易林固定索引数量异常，拒绝以不完整索引提供查询。');
}

export const YILIN_EDITION: YilinEditionMetadata = {
  task: 'W20.03',
  id: 'yilin-w20-03-fixed-4096',
  title: '焦氏易林',
  editionPolicy: rawGapReport.editionPolicy,
  expectedPairCount: rawGapReport.expectedPairCount,
  parsedPairCount: rawGapReport.parsedPairCount,
  sourceProvenance: rawGapReport.sourceProvenance,
  gapSummary: {
    total: rawGapReport.gaps.length,
    confirmedMappings: rawGapReport.confirmedMappingsCount,
    ...rawGapReport.unresolvedSummary,
    markerCounts: rawGapReport.markerCounts,
  },
};

export function normalizeYilinHexagramName(value: string): YilinHexagramName | undefined {
  const normalized = value.trim();
  if (!normalized) return undefined;
  if ((YILIN_HEXAGRAM_ORDER as readonly string[]).includes(normalized)) {
    return normalized as YilinHexagramName;
  }
  return HEXAGRAM_ALIASES[normalized];
}

function normalizeSourceText(text: string) {
  const marker = /焦氏易林卷[一二三四]/gu.exec(text);
  if (!marker || text.length - marker.index > 256) {
    return { text: text.trim(), textNormalization: 'none' as const };
  }

  const anchorStart = text.lastIndexOf('{{SK anchor|焦氏易林卷', marker.index);
  const cutoff = anchorStart >= 0 ? anchorStart : marker.index;
  return {
    text: text.slice(0, cutoff).trim(),
    textNormalization: 'fixed-volume-footer' as const,
  };
}

function createSourceEntry(source: RawYilinSource, digest: string): YilinSourceEntry {
  const normalized = normalizeSourceText(source.text);
  return {
    sourceKind: source.sourceKind,
    source: source.source,
    volume: source.volume,
    line: source.line,
    page: source.page,
    rawLabel: source.rawLabel,
    observedLabel: source.observedLabel,
    text: normalized.text,
    markers: {
      kanripoRefs: [...source.markers.kanripoRefs],
      wikisourceSKchars: [...source.markers.wikisourceSKchars],
    },
    skcharId: source.skcharId,
    textDigest: digest,
    textNormalization: normalized.textNormalization,
  };
}

function summarizeGap(gap: RawGap, key: string): YilinGapSummary {
  return {
    kind: gap.kind,
    ...(gap.status ? { status: gap.status } : {}),
    key,
    ...(gap.source ? { source: gap.source } : {}),
    ...(gap.line !== undefined ? { line: gap.line } : {}),
    ...(gap.page ? { page: gap.page } : {}),
    ...(gap.observedRaw ? { observedRaw: gap.observedRaw } : {}),
    ...(gap.observed ? { observed: gap.observed } : {}),
    ...(gap.kanripoRefs ? { kanripoRefs: [...gap.kanripoRefs] } : {}),
    ...(gap.wikisourceSKchars ? { wikisourceSKchars: [...gap.wikisourceSKchars] } : {}),
  };
}

export function getYilinEditionMetadata(): YilinEditionMetadata {
  return structuredClone(YILIN_EDITION);
}

export function getYilinEntry(
  baseHexagram: string,
  targetHexagram: string,
  source: YilinSourcePreference = 'both',
): YilinQueryResult | undefined {
  if (!['both', 'wikisource', 'kanripo'].includes(source)) {
    throw new Error('文字底本须为 both、wikisource 或 kanripo。');
  }
  const base = normalizeYilinHexagramName(baseHexagram);
  const target = normalizeYilinHexagramName(targetHexagram);
  if (!base || !target) return undefined;

  const key = `${base}→${target}`;
  const pair = pairByKey.get(key);
  if (!pair) return undefined;

  const sources = {
    wikisource: createSourceEntry(pair.wikisource, pair.textDigest.wikisource),
    kanripo: createSourceEntry(pair.kanripo, pair.textDigest.kanripo),
  };
  const selectedSource = source === 'kanripo' ? 'kanripo' : 'wikisource';
  const gaps = (gapsByKey.get(key) ?? []).map((gap) => summarizeGap(gap, key));
  const dataStatus: YilinDataStatus =
    gaps.length || sources.wikisource.text !== sources.kanripo.text
      ? '含校勘或字形差异'
      : '双底本对读一致';

  return {
    edition: getYilinEditionMetadata(),
    base,
    target,
    key,
    selectedSource,
    text: sources[selectedSource].text,
    dataStatus,
    gaps,
    sources,
  };
}

export function queryYilinEntry(
  baseHexagram: string,
  targetHexagram: string,
  source: YilinSourcePreference = 'both',
): YilinQueryResult {
  const base = normalizeYilinHexagramName(baseHexagram);
  const target = normalizeYilinHexagramName(targetHexagram);
  if (!base)
    throw new Error(`baseHexagram 不是固定卦序中的有效卦名：${baseHexagram || '（空）'}。`);
  if (!target) {
    throw new Error(`targetHexagram 不是固定卦序中的有效卦名：${targetHexagram || '（空）'}。`);
  }
  const result = getYilinEntry(base, target, source);
  if (!result) throw new Error(`固定索引中没有 ${base}→${target} 的易林条目。`);
  return result;
}

export function getYilinIndexStats() {
  return {
    expectedPairCount: YILIN_EDITION.expectedPairCount,
    parsedPairCount: YILIN_EDITION.parsedPairCount,
    hexagramCount: YILIN_HEXAGRAM_ORDER.length,
    unresolvedGapCount: YILIN_EDITION.gapSummary.total,
    confirmedMappings: YILIN_EDITION.gapSummary.confirmedMappings,
    alignedMarkerPairs: YILIN_EDITION.gapSummary.markerCounts.alignedPairs,
  } as const;
}
