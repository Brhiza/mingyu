import type { AstrolabeAspect } from '../types/divination';

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

export function formatAstrolabeAspectLine(aspect: AstrolabeAspect) {
  const closeness = aspect.closeness ?? '未分级';
  return `${aspect.body1}${aspect.symbol}${aspect.body2}（${aspect.type}，容许度${aspect.orb.toFixed(2)}°，${closeness}）`;
}

export function isAstrolabeAspectHeadline(aspect: AstrolabeAspect) {
  return (
    MAJOR_ASPECT_TYPES.has(aspect.type) &&
    (closenessScore(aspect) >= 3 ||
      involves(aspect, LUMINARY_LABELS) ||
      involves(aspect, ANGLE_LABELS))
  );
}

export function formatAstrolabeAspectSections(aspects: AstrolabeAspect[]) {
  if (aspects.length === 0) return [];
  const ranked = rankAstrolabeAspects(aspects);
  const headlines = ranked.filter(isAstrolabeAspectHeadline);
  const lead = headlines.length ? headlines : ranked.slice(0, Math.min(6, ranked.length));
  return [
    `相位主线：${lead.map(formatAstrolabeAspectLine).join('；')}。`,
    '相位明细：',
    ...ranked.map((item) => `  ${formatAstrolabeAspectLine(item)}`),
  ];
}
