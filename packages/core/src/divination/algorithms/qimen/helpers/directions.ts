/**
 * @file 方位指引
 * @description 依据三吉门及其明确限制条件生成方位候选，不把门、星、神和格局折算为总分。
 *
 * 古籍依据：
 *   - 《奇门宝鉴御定》：「吉门若遇开休生，诸事逢之总情」
 *   - 《奇门遁甲秘笈大全》：「开休生门为上吉」
 *   - 《遁甲符应经》：「若吉门被迫，则吉事不成」
 *   - 《奇门遁甲秘笈大全》：「纵有奇门皆不利」（五不遇时）
 *   - 《奇门遁甲秘笈大全》：「时遇空亡，吉凶不成」
 *
 * 古籍给出的是成立条件、用途和限制，并没有可通用于各门星神的加减分表。因此：
 *   - 开、休、生三吉门是通用吉方的主证；三奇、吉神与吉格只补充依据，不单独造吉方。
 *   - 空亡、难神、门迫及其他宫位凶格是明确限制，不能被吉项“加分抵消”。
 *   - 避方只按明确不利事实生成，不再从全盘中机械选一个“最低分”。
 */

import {
  auspiciousDoors,
  difficultDoors,
  supportiveGods,
  difficultGods,
  sanQiStems,
  diPanPalaces,
} from './_constants';

// ============================================================================
// 类型定义
// ============================================================================

/** 单个宫位方位判断输入 */
export interface PalaceScoreInput {
  gong: number;
  name: string;
  direction: string;
  element: string;
  tianPan: { stem: string; star: string; companionStem?: string; companionStar?: string };
  diPan: { stem: string };
  renPan: { door: string };
  shenPan: { god: string };
}

/** 方位建议条目 */
export interface DirectionAdvice {
  gong: number;
  name: string;
  direction: string;
  use: string;
  reasons: string[];
}

interface DirectionPatternInput {
  name: string;
  tone: 'good' | 'bad' | 'neutral';
  palace?: number;
  palaces?: number[];
  /** @deprecated 旧版格局评分仅作输入兼容，方位判断不会读取。 */
  score?: number;
}

interface DirectionConditionsInput {
  /** 五不遇时为全局举事限制，纵有三奇吉门也不输出通用吉方。 */
  isWuBuYuShi?: boolean;
}

function hasSanQiWithAuspiciousDoor(palace: Pick<PalaceScoreInput, 'tianPan' | 'renPan'>): boolean {
  return (
    [palace.tianPan.stem, palace.tianPan.companionStem].some(
      (stem) => Boolean(stem) && sanQiStems.includes(stem as string),
    ) && auspiciousDoors.includes(palace.renPan.door)
  );
}

function getPatternPalaces(pattern: DirectionPatternInput): number[] {
  return pattern.palaces ?? (pattern.palace ? [pattern.palace] : []);
}

function buildPatternMap(
  patterns: DirectionPatternInput[] | undefined,
  tone: DirectionPatternInput['tone'],
): Map<number, string[]> {
  const result = new Map<number, string[]>();

  for (const pattern of patterns ?? []) {
    if (pattern.tone !== tone) continue;
    for (const gong of getPatternPalaces(pattern)) {
      result.set(gong, [...(result.get(gong) ?? []), pattern.name]);
    }
  }

  return result;
}

// ============================================================================
// 方向使用字典
// ============================================================================

/**
 * 根据三吉门确定传统用途；值符同宫仅补充急难、见贵用途，不替代吉门条件。
 */
function getDirectionUse(door: string, god: string): string {
  let use: string;
  switch (door) {
    case '开门':
      use = '求官/事业/求职';
      break;
    case '生门':
      use = '求财/合作/投资';
      break;
    case '休门':
      use = '休养/安宁/关系';
      break;
    default:
      use = '按门类用途审慎取用';
  }

  return god === '值符' ? `${use}/急难见贵` : use;
}

// ============================================================================
// buildDirectionAdvice
// ============================================================================

/**
 * 生成方位建议。
 *
 * 吉方必须先见开、休、生三吉门，并排除空亡、难神和宫位凶格；三奇、吉神与吉格
 * 只作为加强依据。五不遇时属于全局限制，命中时不输出通用吉方。避方则保留所有
 * 具备难门、难神、空亡或宫位凶格的方位，不再按总分强选唯一方位。
 */
export function buildDirectionAdvice(
  jiuGongGe: PalaceScoreInput[],
  voidBranches?: string[],
  classicPatterns?: DirectionPatternInput[],
  conditions?: DirectionConditionsInput,
): { goodDirections: DirectionAdvice[]; avoidDirections: DirectionAdvice[] } {
  const voidGongs = new Set<number>();
  for (const branch of voidBranches ?? []) {
    const gong = diPanPalaces[branch];
    if (gong) voidGongs.add(gong);
  }

  const goodPatternMap = buildPatternMap(classicPatterns, 'good');
  const badPatternMap = buildPatternMap(classicPatterns, 'bad');
  const directionalPalaces = jiuGongGe.filter((palace) => palace.gong !== 5);

  const goodDirections: DirectionAdvice[] = conditions?.isWuBuYuShi
    ? []
    : directionalPalaces
        .filter((palace) => {
          const hasMainEvidence = auspiciousDoors.includes(palace.renPan.door);
          const hasExplicitBlock =
            voidGongs.has(palace.gong) ||
            difficultGods.includes(palace.shenPan.god) ||
            (badPatternMap.get(palace.gong)?.length ?? 0) > 0;
          return hasMainEvidence && !hasExplicitBlock;
        })
        .map((palace) => {
          const reasons = [palace.renPan.door];

          if (supportiveGods.includes(palace.shenPan.god)) {
            reasons.push(`值${palace.shenPan.god}`);
          }
          if (hasSanQiWithAuspiciousDoor(palace)) {
            const qi = [palace.tianPan.stem, palace.tianPan.companionStem].find((stem) =>
              sanQiStems.includes(stem || ''),
            );
            reasons.push(`${qi}奇合${palace.renPan.door}`);
          }
          for (const patternName of goodPatternMap.get(palace.gong) ?? []) {
            reasons.push(`吉格:${patternName}`);
          }

          return {
            gong: palace.gong,
            name: palace.name,
            direction: palace.direction,
            use: getDirectionUse(palace.renPan.door, palace.shenPan.god),
            reasons: Array.from(new Set(reasons)),
          };
        });

  const avoidDirections: DirectionAdvice[] = directionalPalaces
    .map((palace): DirectionAdvice | null => {
      const reasons: string[] = [];

      if (difficultDoors.includes(palace.renPan.door)) reasons.push(palace.renPan.door);
      if (difficultGods.includes(palace.shenPan.god)) reasons.push(palace.shenPan.god);
      if (voidGongs.has(palace.gong)) reasons.push('空亡');
      for (const patternName of badPatternMap.get(palace.gong) ?? []) {
        reasons.push(`凶格:${patternName}`);
      }
      if (reasons.length === 0) return null;

      return {
        gong: palace.gong,
        name: palace.name,
        direction: palace.direction,
        use: '宜避之方',
        reasons: Array.from(new Set(reasons)),
      };
    })
    .filter((item): item is DirectionAdvice => Boolean(item));

  return { goodDirections, avoidDirections };
}
