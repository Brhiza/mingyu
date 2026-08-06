import type { AnalysisPayloadV1, PalaceFact, StarFact } from '../../types/analysis';
import {
  collectMutagenStars,
  getAllStars,
  getPalaceByIndex,
  getPalaceByName,
  getOppositePalace,
  getSurroundedPalaces,
} from '../iztro/palace-helpers';
import { formatPalaceName, mapZiweiScopeLabel, normalizePalaceName } from './labels';
import type { ZiweiPromptContext } from './types';

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

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((item) => item?.trim()).filter(Boolean) as string[]));
}

function compareMutagenPriority(left: string, right: string) {
  const order = ['禄', '权', '科', '忌'];
  const leftIndex = order.indexOf(left);
  const rightIndex = order.indexOf(right);
  if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right, 'zh-CN');
  if (leftIndex === -1) return 1;
  if (rightIndex === -1) return -1;
  return leftIndex - rightIndex;
}

function compareEvidenceStarPriority(left: string, right: string, palaces: PalaceFact[]) {
  const starWeight = (name: string) => {
    for (const palace of palaces) {
      const index = palace.major_stars.findIndex((star) => star.name === name);
      if (index !== -1) return index;
    }
    for (const palace of palaces) {
      const index = palace.minor_stars.findIndex((star) => star.name === name);
      if (index !== -1) return 100 + index;
    }
    for (const palace of palaces) {
      const index = palace.other_stars.findIndex((star) => star.name === name);
      if (index !== -1) return 200 + index;
    }
    return 999;
  };
  return starWeight(left) - starWeight(right) || left.localeCompare(right, 'zh-CN');
}

function resolveEvidencePalaces(
  payload: AnalysisPayloadV1,
  focusPalaces: PalaceFact[],
  item: { palace_indexes: number[]; palace_names: string[] },
) {
  const byIndexes = item.palace_indexes.map((index) => getPalaceByIndex(payload, index));
  const byNames = item.palace_names.map((name) => getPalaceByName(payload, name));
  return [...focusPalaces, ...byIndexes, ...byNames].filter(
    (candidate, index, list): candidate is PalaceFact =>
      Boolean(candidate) && list.findIndex((entry) => entry?.index === candidate?.index) === index,
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
            Boolean(star.birth_mutagen) ||
            Boolean(star.horoscope_mutagen) ||
            Boolean(star.active_scope_mutagen) ||
            payload.active_scope.mutagen_map.some(
              (mapped) =>
                mapped.star === star.name &&
                (mapped.palace_index === undefined || mapped.palace_index === palace.index),
            ),
        )
        .map((star) => star.name),
    ),
  );
  const merged = directStars.length
    ? uniqueStrings([...directStars, ...mutagenTaggedStars])
    : mutagenTaggedStars;
  return merged.sort((left, right) => compareEvidenceStarPriority(left, right, palaces));
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
  if (directMutagens.length) return directMutagens;

  const palaces = resolveEvidencePalaces(payload, focusPalaces, item);
  return uniqueStrings(
    palaces.flatMap((palace) => [
      ...getAllStars(palace).flatMap((star) =>
        [star.birth_mutagen, star.horoscope_mutagen, star.active_scope_mutagen].filter(Boolean),
      ),
      ...(palace.self_mutagens ?? []),
      ...payload.active_scope.mutagen_map
        .filter(
          (mapped) =>
            mapped.palace_index === palace.index ||
            (!mapped.palace_index && mapped.palace_name === palace.name),
        )
        .map((mapped) => mapped.mutagen),
    ]),
  ).sort(compareMutagenPriority);
}

export function buildPalaceSummary(payload: AnalysisPayloadV1, palace: PalaceFact) {
  const oppositePalace = getOppositePalace(payload, palace);
  const surroundedPalaces = getSurroundedPalaces(payload, palace);
  const allStars = getAllStars(palace);
  const includeScope = !isOriginScope(payload);
  const horoscopeMutagens = allStars
    .filter((star) => Boolean(star.horoscope_mutagen))
    .map((star) => `${star.name}化${star.horoscope_mutagen}`);
  const auxiliaryTags = [
    palace.changsheng12 ? `长生十二神:${palace.changsheng12}` : '',
    palace.boshi12 ? `博士十二神:${palace.boshi12}` : '',
    palace.base_jiangqian12 ? `原局将前十二神:${palace.base_jiangqian12}` : '',
    palace.base_suiqian12 ? `原局岁前十二神:${palace.base_suiqian12}` : '',
    palace.yearly_jiangqian12 ? `流年将前十二神:${palace.yearly_jiangqian12}` : '',
    palace.yearly_suiqian12 ? `流年岁前十二神:${palace.yearly_suiqian12}` : '',
  ].filter(Boolean);
  const emptyPalaceText = palace.empty_state
    ? oppositePalace
      ? `空宫，需借对宫${formatPalaceName(oppositePalace.name)}共同判断`
      : '空宫'
    : undefined;

  return {
    宫位: formatPalaceName(palace.name),
    宫干支: `${palace.heavenly_stem}${palace.earthly_branch}`,
    空宫: emptyPalaceText,
    主星: palace.major_stars.map(formatStarFact),
    辅星: palace.minor_stars.map(formatStarFact),
    杂曜: palace.other_stars.map(formatStarFact),
    当前运限加临星曜: includeScope ? palace.scope_stars.map(formatStarFact) : undefined,
    生年四化: collectMutagenStars(allStars, 'birth_mutagen'),
    流耀四化: includeScope ? horoscopeMutagens : undefined,
    当前运限四化: includeScope ? collectMutagenStars(allStars, 'active_scope_mutagen') : undefined,
    自化情况: (palace.self_mutagens ?? []).map((item) => `自化${item}`),
    飞星走向: (palace.mutaged_palaces ?? [])
      .filter((item) => item.palace_name)
      .map((item) => `化${item.mutagen}入${formatPalaceName(item.palace_name!)}`),
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
  reportContext: ZiweiPromptContext,
) {
  const focusIndexes = new Set(focusPalaces.map((item) => item.index));
  const focusNames = new Set(focusPalaces.map((item) => normalizePalaceName(item.name)));
  const fallbackList =
    reportContext.selectedTopic === 'risk'
      ? payload.evidence_pool.filter((item) => item.mutagens.includes('忌'))
      : payload.evidence_pool;
  const matchedEvidence = payload.evidence_pool.filter(
    (item) =>
      item.palace_indexes.some((index) => focusIndexes.has(index)) ||
      item.palace_names.some((name) => focusNames.has(normalizePalaceName(name))) ||
      (reportContext.selectedTopic === 'risk' && item.mutagens.includes('忌')),
  );
  const evidencePool = matchedEvidence.length ? matchedEvidence : fallbackList;
  const picked: typeof evidencePool = [];
  const seen = new Set<string>();
  for (const item of evidencePool) {
    const key = item.stable_key || item.id;
    if (seen.has(key) || picked.length >= 8) continue;
    seen.add(key);
    picked.push(item);
  }

  return picked.map((item) => ({
    判断线索: item.title,
    适用范围: mapZiweiScopeLabel(item.scope),
    关联宫位: item.palace_names.map((name) => formatPalaceName(name)),
    关联星曜: deriveEvidenceStars(payload, focusPalaces, item),
    关联四化: deriveEvidenceMutagens(payload, focusPalaces, item),
    说明: item.description,
  }));
}

export function buildScopeStructureSummary(payload: AnalysisPayloadV1) {
  if (isOriginScope(payload)) return [];

  const scopeLandings = payload.palaces.flatMap((palace) =>
    palace.scope_hits.map((hit) => ({
      类型: '运限落宫',
      运限: hit.replace(/落宫$/, ''),
      本命落宫: formatPalaceName(palace.name),
      当前动态宫名: palace.dynamic_scope_name || undefined,
      宫位干支: `${palace.heavenly_stem}${palace.earthly_branch}`,
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
  if (isOriginScope(payload)) return [];

  const currentPalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const scopeLabel = mapZiweiScopeLabel(payload.active_scope.scope);
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
      `${item.star}化${item.mutagen}→${item.palace_name ? formatPalaceName(item.palace_name) : '宫位未给出'}${item.dynamic_palace_name ? `（动态${formatPalaceName(item.dynamic_palace_name)}）` : ''}`,
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
  }));
}
