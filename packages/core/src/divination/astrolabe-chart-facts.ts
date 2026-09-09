import type { AstrolabeAspect, AstrolabePoint } from '../types/divination';

const MAJOR_ASPECT_TYPES = new Set(['合相', '六合', '刑相', '拱相', '冲相', '三分']);
const LUMINARY_LABELS = new Set(['太阳', '月亮', 'Sun', 'Moon']);
const ANGLE_LABELS = new Set(['上升', '天顶', '下降', '天底', 'Ascendant', 'Midheaven']);

function closenessScore(aspect: AstrolabeAspect) {
  if (aspect.closeness === '紧密') return 3;
  if (aspect.closeness === '中等') return 2;
  if (aspect.closeness === '宽松') return 1;
  if (typeof aspect.normalizedOrbRatio === 'number') {
    if (aspect.normalizedOrbRatio <= 1 / 3) return 3;
    if (aspect.normalizedOrbRatio <= 2 / 3) return 2;
  }
  return 0;
}

function involves(aspect: AstrolabeAspect, names: Set<string>) {
  return names.has(aspect.body1) || names.has(aspect.body2);
}

export function scoreAstrolabeAspect(aspect: AstrolabeAspect) {
  const major = MAJOR_ASPECT_TYPES.has(aspect.type) ? 4 : 0;
  const luminary = involves(aspect, LUMINARY_LABELS) ? 3 : 0;
  const angle = involves(aspect, ANGLE_LABELS) ? 2 : 0;
  const hard = aspect.type === '合相' || aspect.type === '冲相' || aspect.type === '刑相' ? 1 : 0;
  const tightness = closenessScore(aspect);
  const orb = Number.isFinite(aspect.orb) ? Math.max(0, 8 - aspect.orb) / 8 : 0;
  return major * 10 + luminary * 8 + angle * 6 + tightness * 5 + hard * 3 + orb;
}

export function rankAstrolabeAspects(aspects: AstrolabeAspect[]) {
  return aspects
    .map((aspect, index) => ({ aspect, index, score: scoreAstrolabeAspect(aspect) }))
    .sort(
      (first, second) =>
        second.score - first.score ||
        first.aspect.orb - second.aspect.orb ||
        first.index - second.index,
    )
    .map((item) => item.aspect);
}

export function formatAstrolabeAspectLine(aspect: AstrolabeAspect, points: AstrolabePoint[] = []) {
  const closeness = aspect.closeness ?? '未分级';
  const first = points.find((point) => point.label === aspect.body1 || point.name === aspect.body1);
  const second = points.find(
    (point) => point.label === aspect.body2 || point.name === aspect.body2,
  );
  const position = (label: string, point: AstrolabePoint | undefined) =>
    point
      ? `${label}（${point.formatted}${point.house > 0 ? `，第${point.house}宫` : ''}）`
      : label;
  const facts = [
    aspect.type,
    ...(typeof aspect.exactAngle === 'number' ? [`目标角${aspect.exactAngle}°`] : []),
    ...(typeof aspect.actualAngle === 'number'
      ? [`实际角距${aspect.actualAngle.toFixed(2)}°`]
      : []),
    `偏差${aspect.orb.toFixed(2)}°`,
    ...(typeof aspect.allowedOrb === 'number' ? [`容许偏差上限${aspect.allowedOrb}°`] : []),
    closeness,
    ...(first && second
      ? [
          first.sign === second.sign ? '同星座' : '跨星座',
          ...(first.house > 0 && second.house > 0
            ? [first.house === second.house ? '同宫' : '异宫']
            : []),
        ]
      : []),
  ];
  return `${position(aspect.body1, first)}${aspect.symbol}${position(aspect.body2, second)}：${facts.join('，')}`;
}

export function isAstrolabeAspectHeadline(aspect: AstrolabeAspect) {
  return (
    MAJOR_ASPECT_TYPES.has(aspect.type) &&
    (closenessScore(aspect) >= 3 ||
      involves(aspect, LUMINARY_LABELS) ||
      involves(aspect, ANGLE_LABELS))
  );
}

export function formatAstrolabeAspectSections(
  aspects: AstrolabeAspect[],
  points: AstrolabePoint[] = [],
) {
  if (aspects.length === 0) return [];
  const ranked = rankAstrolabeAspects(aspects);
  const headlines = ranked.filter(isAstrolabeAspectHeadline);
  const lead = headlines.length ? headlines : ranked.slice(0, Math.min(6, ranked.length));
  return [
    `相位主线：${lead.map((item) => formatAstrolabeAspectLine(item, points)).join('；')}。`,
    '相位明细：',
    ...ranked.map((item) => `  ${formatAstrolabeAspectLine(item, points)}`),
  ];
}
