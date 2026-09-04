import type { AnalysisPayloadV1, PalaceFact, StarFact } from '../../types/analysis';

/** 汇总宫位内全部主星、辅星与杂曜。 */
export function getAllStars(palace: PalaceFact): StarFact[] {
  return [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars];
}

/** 按名称查宫，兼容“命”与“命宫”两种写法。 */
export function getPalaceByName(payload: AnalysisPayloadV1, palaceName: string): PalaceFact | null {
  const normalized = palaceName.endsWith('宫') ? palaceName.slice(0, -1) : palaceName;
  return (
    payload.palaces.find((item) => {
      const itemName = item.name.endsWith('宫') ? item.name.slice(0, -1) : item.name;
      return itemName === normalized;
    }) ?? null
  );
}

export function getPalaceByIndex(
  payload: AnalysisPayloadV1,
  palaceIndex?: number,
): PalaceFact | null {
  if (palaceIndex === undefined) return null;
  return payload.palaces.find((item) => item.index === palaceIndex) ?? null;
}

export function getBodyPalace(payload: AnalysisPayloadV1): PalaceFact | null {
  return payload.palaces.find((item) => item.is_body_palace) ?? null;
}

/**
 * 根据身宫所在宫位推导紫微斗数古典【命身复合主轴】断诀。
 * 依据《紫微斗数全书》《诸星问答论》：
 * - 命身同宫（子午时）：主见坚固自主执着，行藏不易受外界动摇，先天宿命与后天作为合一。
 * - 身在迁移（卯酉时）：身在迁移，一生多变动向外拓展，社会人际与外部机运为后天重心。
 * - 身在官禄（寅申时）：身在官禄，重名位权责与事业成就，责任感深重，后天行藏系于职守。
 * - 身在财帛（辰戌时）：身在财帛，重现实利禄与财富运作，行事讲求实效，以后天求财进退为依归。
 * - 身在夫妻（巳亥时）：身在夫妻，重家庭情感与婚恋归宿，配偶影响深远，易受感情关系牵动。
 * - 身在福德（丑未时）：身在福德，重精神寄托、情趣与内省体验，好精神享受，后天行藏随心境变化。
 */
export function getBodyPalaceAxisSummary(palaceName?: string): string | undefined {
  if (!palaceName) return undefined;
  const name = palaceName.endsWith('宫') ? palaceName.slice(0, -1) : palaceName;
  switch (name) {
    case '命':
    case '身':
      return '命身同宫，主见坚固自主执着，行藏不易受外界动摇，先天宿命与后天作为合一';
    case '迁移':
      return '身在迁移，一生多变动向外拓展，社会人际与外部机运为后天重心';
    case '官禄':
    case '事业':
      return '身在官禄，重名位权责与事业成就，责任感深重，后天行藏系于职守';
    case '财帛':
      return '身在财帛，重现实利禄与财富运作，行事讲求实效，以后天求财进退为依归';
    case '夫妻':
      return '身在夫妻，重家庭情感与婚恋归宿，配偶影响深远，易受感情关系牵动';
    case '福德':
      return '身在福德，重精神寄托、情趣与内省体验，好精神享受，后天行藏随心境变化';
    default:
      return undefined;
  }
}

export function getOppositePalace(
  payload: AnalysisPayloadV1,
  palace: PalaceFact | null,
): PalaceFact | null {
  if (!palace) return null;
  return getPalaceByIndex(payload, palace.opposite_palace_index);
}

export function getSurroundedPalaces(
  payload: AnalysisPayloadV1,
  palace: PalaceFact | null,
): PalaceFact[] {
  if (!palace) return [];
  return palace.surrounded_palace_indexes
    .map((index) => getPalaceByIndex(payload, index))
    .filter((item): item is PalaceFact => item !== null && item.index !== palace.index);
}

export function dedupePalaces(palaces: Array<PalaceFact | null | undefined>): PalaceFact[] {
  const map = new Map<number, PalaceFact>();
  palaces.forEach((item) => {
    if (item) map.set(item.index, item);
  });
  return Array.from(map.values());
}

export function collectMutagenStars(
  stars: StarFact[],
  key: 'birth_mutagen' | 'active_scope_mutagen',
): string[] {
  return stars.filter((star) => Boolean(star[key])).map((star) => `${star.name}化${star[key]}`);
}

/**
 * 从结构化运限命中中选择最值得优先查看的宫位。
 * 只返回宫位事实，不生成报告文案，适合页面、API 和提示词共同复用。
 */
export function buildScopeFocusPalaces(payload: AnalysisPayloadV1): PalaceFact[] {
  const activePalace = getPalaceByIndex(payload, payload.active_scope.palace_index);
  const hitPalaces = [...payload.palaces]
    .filter((item) => item.scope_hits.length > 0)
    .sort((left, right) => {
      const scoreLeft =
        left.scope_hits.length * 10 + (left.dynamic_scope_name ? 3 : 0) + left.summary_tags.length;
      const scoreRight =
        right.scope_hits.length * 10 +
        (right.dynamic_scope_name ? 3 : 0) +
        right.summary_tags.length;
      return scoreRight - scoreLeft || left.index - right.index;
    });

  return dedupePalaces([
    activePalace,
    ...hitPalaces,
    getPalaceByName(payload, '命宫'),
    getBodyPalace(payload),
    getPalaceByName(payload, '福德'),
  ]).slice(0, 6);
}
