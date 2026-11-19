import { detectPatternsIn, PATTERN_ORBS } from 'caelus';
import { natalAspectRules } from './natal-aspects';

type Point = { id: string; name: string; longitude: number; sign: string; signIndex: number; house: number; retrograde: boolean };
type Aspect = { first: string; second: string; type: string; name: string; deviation: number; allowedOrb: number; strength: number };
const mainIds = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
const elementLabels = ['火', '土', '风', '水'];
const modalityLabels = ['基本', '固定', '变动'];
const patternLabels: Record<string, string> = { t_square: 'T字刑', grand_trine: '大三角', grand_cross: '大十字', yod: '上帝之指', kite: '风筝', mystic_rectangle: '神秘矩形', stellium_sign: '同星座星群', stellium_house: '同宫星群' };
const required: Record<string, string[]> = {
  t_square: ['opposition', 'square', 'square'], grand_trine: ['trine', 'trine', 'trine'],
  grand_cross: ['opposition', 'opposition', 'square', 'square', 'square', 'square'],
  yod: ['sextile', 'quincunx', 'quincunx'],
  kite: ['opposition', 'sextile', 'sextile', 'trine', 'trine', 'trine'],
  mystic_rectangle: ['opposition', 'opposition', 'sextile', 'sextile', 'trine', 'trine'],
};
export function natalEvidence(points: Point[], aspects: Aspect[]) {
  const main = mainIds.map((id) => points.find((point) => point.id === id));
  if (main.some((point) => !point)) throw new Error('十大星体不完整，无法计算本命分布与格局。');
  const selected = main as Point[];
  const elements = elementLabels.map((label, index) => ({ label, members: selected.filter((point) => point.signIndex % 4 === index).map(({ id, name }) => ({ id, name })) }));
  const modalities = modalityLabels.map((label, index) => ({ label, members: selected.filter((point) => point.signIndex % 3 === index).map(({ id, name }) => ({ id, name })) }));
  const retrograde = selected.filter((point) => point.retrograde).map(({ id, name }) => ({ id, name }));
  const orbs = Object.fromEntries(Object.entries(PATTERN_ORBS).map(([type, orb]) => {
    const rule = natalAspectRules.find(([id]) => id === type);
    return [type, rule ? Math.min(orb, rule[3] * 0.7) : -1];
  }));
  const detected = detectPatternsIn(Object.fromEntries(selected.map((point) => [point.id, { lon: point.longitude, house: point.house }])), { bodies: mainIds, orbs });
  const patterns = detected.flatMap((pattern) => {
    const expected = required[pattern.kind], edges: Aspect[] = [];
    if (expected) {
      for (let i = 0; i < pattern.bodies.length; i++) for (let j = i + 1; j < pattern.bodies.length; j++) {
        const a = pattern.bodies[i], b = pattern.bodies[j];
        const edge = aspects.find((item) => ((item.first === a && item.second === b) || (item.first === b && item.second === a)) && expected.includes(item.type));
        if (!edge) return [];
        edges.push(edge);
      }
      if (edges.map((edge) => edge.type).sort().join(',') !== [...expected].sort().join(',')) return [];
    }
    const members = pattern.bodies.map((id) => { const point = selected.find((value) => value.id === id); if (!point) throw new Error('格局引用了不存在的星体。'); return { id, name: point.name }; });
    const apex = pattern.apex && (pattern.kind === 't_square' || pattern.kind === 'yod') ? members.find((item) => item.id === pattern.apex) : undefined;
    const sign = pattern.sign ? selected.find((point) => point.id === members[0].id)?.sign : undefined;
    const label = patternLabels[pattern.kind] ?? pattern.kind;
    return [{ type: pattern.kind, label, members, ...(apex ? { apex } : {}), ...(sign ? { sign } : {}), ...(pattern.house ? { house: pattern.house } : {}),
      maxOrb: expected ? pattern.orb : null, aspects: edges.map(({ first, second, type, name, deviation, allowedOrb, strength }) => ({ first, second, type, name, deviation, allowedOrb, strength })) }];
  });
  return { distributions: { elements, modalities, retrograde, basis: '太阳至冥王星十大星体，各计一次' }, patterns };
}
