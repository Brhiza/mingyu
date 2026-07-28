import type { AnalysisPayloadV1, PalaceFact, StarFact } from '../../types/analysis';
import { formatPalaceName, mapScopeLabel, normalizePalaceName } from './labels';
import {
  collectMutagenStars,
  getAllStars,
  getPalaceByIndex,
  getPalaceByName,
  getOppositePalace,
  getSurroundedPalaces,
} from './palace-helpers';
import type { PromptContext } from './types';

function formatStarFact(star: StarFact): string {
  const tags = [
    star.brightness,
    star.birth_mutagen ? `生年化${star.birth_mutagen}` : '',
    star.horoscope_mutagen ? `流耀化${star.horoscope_mutagen}` : '',
    star.active_scope_mutagen ? `当前运限化${star.active_scope_mutagen}` : '',
  ].filter(Boolean);

  return tags.length ? `${star.name}(${tags.join('/')})` : star.name;
}

function isOriginScope(payload: AnalysisPayloadV1) {
  return payload.active_scope.scope === 'origin';
}

function filterScopeTagsForOrigin(payload: AnalysisPayloadV1, tags: string[]) {
  if (!isOriginScope(payload)) return tags;

  return tags.filter((tag) => !/落宫$/.test(tag) && tag !== '有当前运限四化');
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[]));
}

function compareMutagenPriority(left: string, right: string) {
  const leftIndex = ['禄', '权', '科', '忌'].indexOf(left);
  const rightIndex = ['禄', '权', '科', '忌'].indexOf(right);

  if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, 'zh-CN');
  if (leftIndex === -1) return 1;
  if (rightIndex === -1) return -1;
  return leftIndex - rightIndex;
}

function compareEvidenceStarPriority(left: string, right: string, palace: PalaceFact[]) {
  const starWeight = (name: string) => {
    for (const item of palace) {
      const majorIndex = item.major_stars.findIndex((star) => star.name === name);
      if (majorIndex !== -1) return majorIndex;
    }

    for (const item of palace) {
      const minorIndex = item.minor_stars.findIndex((star) => star.name === name);
      if (minorIndex !== -1) return 100 + minorIndex;
    }

    for (const item of palace) {
      const otherIndex = item.other_stars.findIndex((star) => star.name === name);
      if (otherIndex !== -1) return 200 + otherIndex;
    }

    return 999;
  };

  return starWeight(left) - starWeight(right) || left.localeCompare(right, 'zh-CN');
}

function resolveEvidencePalaces(
  payload: AnalysisPayloadV1,
  palace: PalaceFact[],
  item: {
    palace_indexes: number[];
    palace_names: string[];
  },
) {
  const byIndexes = item.palace_indexes.map((index) => getPalaceByIndex(payload, index));
  const byNames = item.palace_names.map((name) => getPalaceByName(payload, name));

  return [...palace, ...byIndexes, ...byNames].filter(
    (candidate, index, list): candidate is PalaceFact => {
      if (!candidate) return false;
      return list.findIndex((entry) => entry?.index === candidate.index) === index;
    },
  );
}

function deriveEvidenceStars(
  payload: AnalysisPayloadV1,
  focusPalaces: PalaceFact[],
  item: {
    palace_indexes: number[];
    palace_names: string[];
    star_names: string[];
    mutagens: string[];
  },
) {
  const palaces = resolveEvidencePalaces(payload, focusPalaces, item);
  const directStars = uniqueStrings(item.star_names);
  const mutagenTaggedStars = uniqueStrings(
    palaces.flatMap((palace) =>
      getAllStars(palace)
        .filter(
          (star) =>
            !!star.birth_mutagen ||
            !!star.horoscope_mutagen ||
            !!star.active_scope_mutagen ||
            payload.active_scope.mutagen_map.some(
              (mapped) =>
                mapped.star === star.name &&
                (mapped.palace_index === undefined || mapped.palace_index === palace.index),
            ),
        )
        .map((star) => star.name),
    ),
  );

  if (directStars.length > 0) {
    const merged = uniqueStrings([...directStars, ...mutagenTaggedStars]);
    const base = merged.length > directStars.length ? merged : directStars;
    return [...base].sort((left, right) => compareEvidenceStarPriority(left, right, palaces));
  }

  return [...mutagenTaggedStars].sort((left, right) =>
    compareEvidenceStarPriority(left, right, palaces),
  );
}

function deriveEvidenceMutagens(
  payload: AnalysisPayloadV1,
  focusPalaces: PalaceFact[],
  item: {
    palace_indexes: number[];
    palace_names: string[];
    star_names: string[];
    mutagens: string[];
  },
) {
  const directMutagens = uniqueStrings(item.mutagens).sort(compareMutagenPriority);
  if (directMutagens.length > 0) {
    return directMutagens;
  }

  const palaces = resolveEvidencePalaces(payload, focusPalaces, item);
  const derivedMutagens = uniqueStrings(
    palaces.flatMap((palace) => [
      ...getAllStars(palace).flatMap((star) =>
        [star.birth_mutagen, star.horoscope_mutagen, star.active_scope_mutagen].filter(Boolean),
      ),
      ...(palace.self_mutagens ?? []),
      ...payload.active_scope.mutagen_map
        .filter(
          (mapped) =>
            mapped.palace_index === palace.index ||
            (!mapped.palace_index && mapped.palace_name && mapped.palace_name === palace.name),
        )
        .map((mapped) => mapped.mutagen),
    ]),
  ).sort(compareMutagenPriority);

  return derivedMutagens;
}

export function buildPalaceSummary(payload: AnalysisPayloadV1, palace: PalaceFact) {
  const oppositePalace = getOppositePalace(payload, palace);
  const surroundedPalaces = getSurroundedPalaces(payload, palace);
  const allStars = getAllStars(palace);
  const includeScope = !isOriginScope(payload);
  const horoscopeMutagens = allStars
    .filter((star) => !!star.horoscope_mutagen)
    .map((star) => `${star.name}化${star.horoscope_mutagen}`);
  const selfMutagens = (palace.self_mutagens ?? []).map((m) => `自化${m}`);
  const mutagedFlies = (palace.mutaged_palaces ?? [])
    .filter((item) => item.palace_name)
    .map((item) => `化${item.mutagen}入${formatPalaceName(item.palace_name!)}`);
  const auxiliaryTags = [
    palace.changsheng12 ? `长生十二神:${palace.changsheng12}` : '',
    palace.boshi12 ? `博士十二神:${palace.boshi12}` : '',
    palace.base_jiangqian12 ? `原局将前十二神:${palace.base_jiangqian12}` : '',
    palace.base_suiqian12 ? `原局岁前十二神:${palace.base_suiqian12}` : '',
    palace.yearly_jiangqian12 ? `流年将前十二神:${palace.yearly_jiangqian12}` : '',
    palace.yearly_suiqian12 ? `流年岁前十二神:${palace.yearly_suiqian12}` : '',
  ].filter(Boolean);

  return {
    宫位: formatPalaceName(palace.name),
    宫干支: `${palace.heavenly_stem}${palace.earthly_branch}`,
    当前动态宫名: includeScope ? palace.dynamic_scope_name || undefined : undefined,
    空宫提示:
      palace.empty_state && oppositePalace
        ? `空宫，需借对宫${formatPalaceName(oppositePalace.name)}共同判断`
        : palace.empty_state
          ? '空宫，需借对宫与三方四正共同判断'
          : undefined,
    主星: palace.major_stars.map(formatStarFact),
    辅星: palace.minor_stars.map(formatStarFact),
    杂曜: palace.other_stars.map(formatStarFact),
    当前运限加临星曜: includeScope ? palace.scope_stars.map(formatStarFact) : undefined,
    生年四化: collectMutagenStars(allStars, 'birth_mutagen'),
    流耀四化: includeScope ? horoscopeMutagens : undefined,
    当前运限四化: includeScope ? collectMutagenStars(allStars, 'active_scope_mutagen') : undefined,
    自化情况: selfMutagens,
    飞星走向: mutagedFlies,
    盘面标签: filterScopeTagsForOrigin(payload, palace.summary_tags),
    运限命中: includeScope ? palace.scope_hits : undefined,
    对宫: oppositePalace ? formatPalaceName(oppositePalace.name) : '无',
    三方四正: surroundedPalaces.map((item) => formatPalaceName(item.name)),
    大限范围: `${palace.decadal_range[0]}-${palace.decadal_range[1]}岁`,
    传统辅证: auxiliaryTags.length ? auxiliaryTags.join(' | ') : undefined,
  };
}

export function buildEvidenceSummary(
  payload: AnalysisPayloadV1,
  focusPalaces: PalaceFact[],
  reportContext: PromptContext,
) {
  const focusIndexes = new Set(focusPalaces.map((item) => item.index));
  const focusNames = new Set(focusPalaces.map((item) => normalizePalaceName(item.name)));
  const fallbackList =
    reportContext.selected_topic === 'risk'
      ? payload.evidence_pool.filter((item) => item.mutagens.includes('忌'))
      : payload.evidence_pool;
  const matchedEvidence = payload.evidence_pool.filter(
    (item) =>
      item.palace_indexes.some((index) => focusIndexes.has(index)) ||
      item.palace_names.some((name) => focusNames.has(normalizePalaceName(name))) ||
      (reportContext.selected_topic === 'risk' && item.mutagens.includes('忌')),
  );
  const evidencePool = matchedEvidence.length > 0 ? matchedEvidence : fallbackList;

  const picked: typeof evidencePool = [];
  const seen = new Set<string>();

  evidencePool.forEach((item) => {
    const key = item.stable_key || item.id;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    picked.push(item);
  });

  return picked.map((item) => ({
    判断线索: item.title,
    适用范围: mapScopeLabel(item.scope),
    关联宫位: item.palace_names.map((name) => formatPalaceName(name)),
    关联星曜: deriveEvidenceStars(payload, focusPalaces, item),
    关联四化: deriveEvidenceMutagens(payload, focusPalaces, item),
    说明: item.description,
  }));
}

export function buildScopeStructureSummary(payload: AnalysisPayloadV1) {
  if (isOriginScope(payload)) {
    return [];
  }

  const scopeLandings = payload.palaces.flatMap((palace) =>
    palace.scope_hits.map((hit) => ({
      类型: '运限落宫',
      运限: hit.replace(/落宫$/, ''),
      本命落宫: formatPalaceName(palace.name),
      当前动态宫名: palace.dynamic_scope_name || undefined,
      宫位干支: `${palace.heavenly_stem}${palace.earthly_branch}`,
      关键标签: palace.summary_tags.slice(0, 5),
      主星: palace.major_stars.map(formatStarFact),
    })),
  );

  const activeMutagens = payload.active_scope.mutagen_map.map((item) => ({
    类型: '当前四化飞入',
    运限: payload.active_scope.label,
    星曜: item.star,
    四化: `化${item.mutagen}`,
    飞入宫位: item.palace_name ? formatPalaceName(item.palace_name) : '宫位未给出',
    动态飞入宫位: item.dynamic_palace_name ? formatPalaceName(item.dynamic_palace_name) : undefined,
  }));

  return [...scopeLandings, ...activeMutagens];
}

export function buildScopeHitSummary(payload: AnalysisPayloadV1) {
  if (isOriginScope(payload)) {
    return [];
  }

  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const scopeLabel = mapScopeLabel(payload.active_scope.scope);
  const landingLines = payload.palaces.flatMap((palace) =>
    palace.scope_hits.map((hit) => {
      const dynamicName = palace.dynamic_scope_name
        ? `，动态宫名：${palace.dynamic_scope_name}`
        : '';
      const majorStars = palace.major_stars.length
        ? `，主星：${palace.major_stars.map(formatStarFact).join('、')}`
        : '';

      return `${hit}→本命${formatPalaceName(palace.name)}${dynamicName}${majorStars}`;
    }),
  );
  const mutagenLines = payload.active_scope.mutagen_map.map(
    (item) =>
      `${item.star}化${item.mutagen}→${
        item.palace_name ? formatPalaceName(item.palace_name) : '宫位未给出'
      }${item.dynamic_palace_name ? `（动态${formatPalaceName(item.dynamic_palace_name)}）` : ''}`,
  );
  const focusLine = currentPalace
    ? `${payload.active_scope.label || scopeLabel}当前落宫为本命${formatPalaceName(currentPalace.name)}。`
    : '';
  return [focusLine, ...landingLines.slice(0, 6), ...mutagenLines.slice(0, 8)];
}

export function buildPalaceIndex(payload: AnalysisPayloadV1) {
  const includeScope = !isOriginScope(payload);

  return payload.palaces.map((item) => ({
    宫位: formatPalaceName(item.name),
    主星: item.major_stars.map(formatStarFact),
    当前动态宫名: includeScope ? item.dynamic_scope_name || undefined : undefined,
    关键标签: [
      ...filterScopeTagsForOrigin(payload, item.summary_tags),
      ...(includeScope ? item.scope_hits : []),
    ].slice(0, 4),
  }));
}
