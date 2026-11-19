import type { ZiweiExactData } from './ziwei';

type Natal = ZiweiExactData['natal'];
type PersonId = 'person1' | 'person2';

/** 将一方宫干化星定位到另一方本命盘，不推断跨盘自化、关系结果或运限。 */
function direction(from: PersonId, to: PersonId, source: Natal, target: Natal) {
  const stars = new Map<string, Natal['palaces']>();
  for (const palace of target.palaces) for (const star of [...palace.majorStars, ...palace.minorStars]) {
    const matches = stars.get(star.name) ?? [];
    if (!matches.some((item) => item.index === palace.index)) matches.push(palace);
    stars.set(star.name, matches);
  }
  const paths = [], gaps = [];
  for (const palace of source.palaces) for (const flying of palace.flyingTransformations) {
    const matches = stars.get(flying.star) ?? [];
    const common = { sourcePerson: from, targetPerson: to, sourcePalace: palace.name, sourceBranch: palace.earthlyBranch,
      sourceStem: palace.heavenlyStem, mutagen: flying.mutagen, star: flying.star };
    if (matches.length === 1) {
      const match = matches[0];
      paths.push({ ...common, targetPalace: match.name, targetBranch: match.earthlyBranch, targetBody: match.isBodyPalace });
    } else {
      gaps.push({ ...common, reason: matches.length ? '目标盘同名星曜落宫不唯一' : '目标盘缺少同名星曜',
        candidatePalaces: matches.map((match) => `${match.name}（${match.earthlyBranch}）`) });
    }
  }
  return { paths, gaps };
}

export function locateCrossFlying(first: Natal, second: Natal) {
  const a = direction('person1', 'person2', first, second);
  const b = direction('person2', 'person1', second, first);
  return { paths: [...a.paths, ...b.paths], gaps: [...a.gaps, ...b.gaps] };
}

export function formatCrossFlying(flying: ReturnType<typeof locateCrossFlying>, people: Record<PersonId, string>) {
  const grouped = new Map<string, { prefix: string; paths: string[] }>();
  for (const path of [...flying.paths, ...flying.gaps]) {
    const key = `${path.sourcePerson}/${path.sourceBranch}`;
    const group = grouped.get(key) ?? { prefix: `${people[path.sourcePerson]}${path.sourcePalace}（${path.sourceStem}${path.sourceBranch}）→${people[path.targetPerson]}`, paths: [] };
    group.paths.push('targetPalace' in path
      ? `化${path.mutagen}${path.star}→${path.targetPalace}（${path.targetBranch}${path.targetBody ? '，身宫' : ''}）`
      : `化${path.mutagen}${path.star}→${path.reason}${path.candidatePalaces.length ? `（${path.candidatePalaces.join('、')}）` : ''}`);
    grouped.set(key, group);
  }
  return [...grouped.values()].map((group) => `${group.prefix}：${group.paths.join('；')}`).join('\n');
}
