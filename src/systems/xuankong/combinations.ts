export type Formation = '旺山旺向' | '上山下水' | '双星到向' | '双星到坐';
export type PalaceKey = 'kan' | 'gen' | 'zhen' | 'xun' | 'li' | 'kun' | 'dui' | 'qian' | 'center';
export type CombinationKind = 'auspicious' | 'inauspicious';

export interface XuankongPalaceResult {
  readonly key: PalaceKey;
  readonly name: string;
  readonly direction: string;
  readonly earth: number;
  readonly row: 0 | 1 | 2;
  readonly col: 0 | 1 | 2;
  readonly period: number;
  readonly mountain: number;
  readonly water: number;
}

export interface XuankongCombination {
  readonly name: string;
  readonly kind: CombinationKind;
  readonly palaces?: readonly PalaceKey[];
  readonly note: string;
}

const SANBAN_GROUPS: readonly (readonly [number, number, number])[] = [
  [1, 4, 7],
  [2, 5, 8],
  [3, 6, 9],
];

const TRUE_TRIAD: readonly PalaceKey[] = ['qian', 'zhen', 'li'];
const FALSE_TRIAD: readonly PalaceKey[] = ['kan', 'xun', 'dui'];

function wrap1to9(value: number): number {
  return ((((value - 1) % 9) + 9) % 9) + 1;
}

function isParentGroup(nums: readonly number[]): boolean {
  const sorted = [...nums].sort((a, b) => a - b);
  return SANBAN_GROUPS.some((group) => group[0] === sorted[0] && group[1] === sorted[1] && group[2] === sorted[2]);
}

function isConsecutive(nums: readonly number[]): boolean {
  const set = new Set(nums);
  if (set.size !== 3) return false;
  return [...set].some((start) => set.has(wrap1to9(start + 1)) && set.has(wrap1to9(start + 2)));
}

function detectSanban(
  palaces: readonly XuankongPalaceResult[],
  byKey: Map<PalaceKey, XuankongPalaceResult>,
  out: XuankongCombination[],
): void {
  const triples = palaces.map((palace) => [palace.period, palace.mountain, palace.water] as const);
  if (triples.every(isParentGroup)) {
    out.push({
      name: '父母三般卦',
      kind: 'auspicious',
      note: '全局九宫皆成 147/258/369，综合三元旺气，大吉。258 宫位防二黑五黄。',
    });
    return;
  }
  if (triples.every(isConsecutive)) {
    const center = byKey.get('center');
    if (!center) throw new Error('缺少中宫');
    const note =
      center.water === wrap1to9(center.period - 1)
        ? '向星连珠：运、山、向顺飞相连，主财富、名声、事业。'
        : center.mountain === wrap1to9(center.period - 1)
          ? '山星连珠：运、山、向逆飞相连，主健康、人丁、家庭。'
          : '运、山、向三盘相连，凶位不凶，上山下水亦不忌。';
    out.push({ name: '连珠三般卦', kind: 'auspicious', note });
  }
}

function detectHeshi(palaces: readonly XuankongPalaceResult[], out: XuankongCombination[]): void {
  if (palaces.every((palace) => palace.mountain + palace.period === 10)) {
    out.push({
      name: '山星合十',
      kind: 'auspicious',
      note: '全盘山星与运盘合十，主人丁，通关化煞；当旺或刚退运时有力。',
    });
  }
  if (palaces.every((palace) => palace.water + palace.period === 10)) {
    out.push({
      name: '向星合十',
      kind: 'auspicious',
      note: '全盘向星与运盘合十，主财禄，通关化煞；当旺或刚退运时有力。',
    });
  }
}

function detectFanFuYin(palaces: readonly XuankongPalaceResult[], out: XuankongCombination[]): void {
  for (const [label, pick] of [
    ['山星', (palace: XuankongPalaceResult) => palace.mountain],
    ['向星', (palace: XuankongPalaceResult) => palace.water],
  ] as const) {
    const harm = label === '山星' ? '健康、人丁、家庭' : '财富、事业、名声';
    if (palaces.every((palace) => pick(palace) === palace.earth)) {
      out.push({
        name: `全盘伏吟（${label}）`,
        kind: 'inauspicious',
        note: `${label}与元旦盘全盘相同，主忧虑滞涩、顽疾，影响${harm}。`,
      });
    } else if (palaces.every((palace) => pick(palace) + palace.earth === 10)) {
      out.push({
        name: `全盘反吟（${label}）`,
        kind: 'inauspicious',
        note: `${label}与元旦盘全盘合十，主突发灾祸、破败，影响${harm}。`,
      });
    } else {
      const fu = palaces.filter((palace) => pick(palace) === palace.earth).map((palace) => palace.key);
      const fan = palaces.filter((palace) => pick(palace) + palace.earth === 10).map((palace) => palace.key);
      if (fu.length) {
        out.push({
          name: `单宫伏吟（${label}）`,
          kind: 'inauspicious',
          palaces: fu,
          note: `${label}与元旦盘相同；除非外有形煞引动，破坏不大。`,
        });
      }
      if (fan.length) {
        out.push({
          name: `单宫反吟（${label}）`,
          kind: 'inauspicious',
          palaces: fan,
          note: `${label}与元旦盘合十；除非外有形煞引动，破坏不大。`,
        });
      }
    }
  }
}

function detectRuQiu(
  period: number,
  byKey: Map<PalaceKey, XuankongPalaceResult>,
  out: XuankongCombination[],
): void {
  const center = byKey.get('center');
  if (!center) throw new Error('缺少中宫');
  if (center.mountain === period) {
    out.push({
      name: '山星入囚',
      kind: 'inauspicious',
      note: '当运山星入中宫受囚，主人丁不旺、健康受损；中宫见光、动气可破囚。',
    });
  }
  if (center.water === period) {
    out.push({
      name: '向星入囚',
      kind: 'inauspicious',
      note: '当运向星入中宫受囚，主财源受阻、事业不顺；中宫见光、动气可破囚。',
    });
  }
}

function detectDaJie(
  formation: string,
  facingPalace: PalaceKey,
  byKey: Map<PalaceKey, XuankongPalaceResult>,
  palaces: readonly XuankongPalaceResult[],
  out: XuankongCombination[],
): void {
  if (formation !== '双星到向') return;
  const waterOf = (keys: readonly PalaceKey[]) => keys.map((key) => byKey.get(key)!.water);
  const blocked = palaces.every((palace) => palace.mountain === palace.earth);
  const blockNote = blocked ? '（山星5入中顺飞犯全盘伏吟，打劫不可用）' : '';

  if (TRUE_TRIAD.includes(facingPalace) && isParentGroup(waterOf(TRUE_TRIAD))) {
    out.push({
      name: '七星真打劫',
      kind: blocked ? 'inauspicious' : 'auspicious',
      palaces: TRUE_TRIAD,
      note: `双星到向，乾·震·离三宫向星连成 147/258/369，劫取未来旺气，力强。布水、开门、通气引动。${blockNote}`,
    });
  } else if (FALSE_TRIAD.includes(facingPalace) && isParentGroup(waterOf(FALSE_TRIAD))) {
    out.push({
      name: '七星假打劫',
      kind: blocked ? 'inauspicious' : 'auspicious',
      palaces: FALSE_TRIAD,
      note: `双星到向，坎·巽·兑三宫向星连成 147/258/369；力不及真打劫，仍可引动旺气。${blockNote}`,
    });
  }
}

/** 检测玄空飞星九宫盘的传统格局（三般卦、合十、伏吟反吟、入囚、七星打劫）。 */
export function detectXuankongCombinations(
  period: number,
  formation: string,
  facingPalace: PalaceKey,
  palaces: readonly XuankongPalaceResult[],
): readonly XuankongCombination[] {
  const byKey = new Map<PalaceKey, XuankongPalaceResult>(palaces.map((palace) => [palace.key, palace]));
  const out: XuankongCombination[] = [];
  detectSanban(palaces, byKey, out);
  detectHeshi(palaces, out);
  detectFanFuYin(palaces, out);
  detectRuQiu(period, byKey, out);
  detectDaJie(formation, facingPalace, byKey, palaces, out);
  return out;
}
