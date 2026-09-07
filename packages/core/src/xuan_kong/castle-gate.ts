/**
 * @file 玄空飞星城门诀与特殊理气格局判定
 * @传统依据 《沈氏玄空学》城门诀：向首两旁同元龙之位为城门候选；运星入中依元龙阴阳顺逆飞布，若旺星飞临城门宫位，为城门得位可用。
 */
import { flyStars, type FlyDirection } from './period-stars';
import { getNineStarProfile } from '../direction';

export type YuanLong = '天元龙' | '地元龙' | '人元龙';

export interface MountainProfile {
  mountain: string;
  gong: number;
  trigram: string;
  yuanLong: YuanLong;
  yinYang: '阳' | '阴';
}

export const MOUNTAIN_PROFILES: Record<string, MountainProfile> = {
  // 坎一宫
  壬: { mountain: '壬', gong: 1, trigram: '坎', yuanLong: '地元龙', yinYang: '阳' },
  子: { mountain: '子', gong: 1, trigram: '坎', yuanLong: '天元龙', yinYang: '阴' },
  癸: { mountain: '癸', gong: 1, trigram: '坎', yuanLong: '人元龙', yinYang: '阴' },
  // 艮八宫
  丑: { mountain: '丑', gong: 8, trigram: '艮', yuanLong: '地元龙', yinYang: '阴' },
  艮: { mountain: '艮', gong: 8, trigram: '艮', yuanLong: '天元龙', yinYang: '阳' },
  寅: { mountain: '寅', gong: 8, trigram: '艮', yuanLong: '人元龙', yinYang: '阳' },
  // 震三宫
  甲: { mountain: '甲', gong: 3, trigram: '震', yuanLong: '地元龙', yinYang: '阳' },
  卯: { mountain: '卯', gong: 3, trigram: '震', yuanLong: '天元龙', yinYang: '阴' },
  乙: { mountain: '乙', gong: 3, trigram: '震', yuanLong: '人元龙', yinYang: '阴' },
  // 巽四宫
  辰: { mountain: '辰', gong: 4, trigram: '巽', yuanLong: '地元龙', yinYang: '阴' },
  巽: { mountain: '巽', gong: 4, trigram: '巽', yuanLong: '天元龙', yinYang: '阳' },
  巳: { mountain: '巳', gong: 4, trigram: '巽', yuanLong: '人元龙', yinYang: '阳' },
  // 离九宫
  丙: { mountain: '丙', gong: 9, trigram: '离', yuanLong: '地元龙', yinYang: '阳' },
  午: { mountain: '午', gong: 9, trigram: '离', yuanLong: '天元龙', yinYang: '阴' },
  丁: { mountain: '丁', gong: 9, trigram: '离', yuanLong: '人元龙', yinYang: '阴' },
  // 坤二宫
  未: { mountain: '未', gong: 2, trigram: '坤', yuanLong: '地元龙', yinYang: '阴' },
  坤: { mountain: '坤', gong: 2, trigram: '坤', yuanLong: '天元龙', yinYang: '阳' },
  申: { mountain: '申', gong: 2, trigram: '坤', yuanLong: '人元龙', yinYang: '阳' },
  // 兑七宫
  庚: { mountain: '庚', gong: 7, trigram: '兑', yuanLong: '地元龙', yinYang: '阳' },
  酉: { mountain: '酉', gong: 7, trigram: '兑', yuanLong: '天元龙', yinYang: '阴' },
  辛: { mountain: '辛', gong: 7, trigram: '兑', yuanLong: '人元龙', yinYang: '阴' },
  // 乾六宫
  戌: { mountain: '戌', gong: 6, trigram: '乾', yuanLong: '地元龙', yinYang: '阴' },
  乾: { mountain: '乾', gong: 6, trigram: '乾', yuanLong: '天元龙', yinYang: '阳' },
  亥: { mountain: '亥', gong: 6, trigram: '乾', yuanLong: '人元龙', yinYang: '阳' },
};

/** 八卦宫位按顺时针排列（用于取向首左右相邻两宫） */
const CLOCKWISE_GONG_RING = [1, 8, 3, 4, 9, 2, 7, 6];

/** 宫位对应八卦卦名 */
const GONG_NAMES: Record<number, string> = {
  1: '坎',
  2: '坤',
  3: '震',
  4: '巽',
  5: '中',
  6: '乾',
  7: '兑',
  8: '艮',
  9: '离',
};

export interface CastleGateCandidate {
  gong: number;
  gongName: string;
  mountain: string;
  role: '正城门' | '副城门';
  yunStar: number;
  flyDirection: FlyDirection;
  arrivalStar: number;
  status: '得旺可用' | '不得旺不可用';
  summary: string;
}

export interface CastleGateEvaluation {
  hasUsableGate: boolean;
  candidates: CastleGateCandidate[];
  summary: string;
}

/**
 * 计算给定当运与朝向的城门诀
 */
export function evaluateCastleGate(params: {
  yun: number;
  facingMountain: string;
  yunPlate: number[];
}): CastleGateEvaluation {
  const { yun, facingMountain, yunPlate } = params;
  const expectedPlate = flyStars(yun, '顺飞');
  if (
    !Array.isArray(yunPlate) ||
    yunPlate.length !== 9 ||
    expectedPlate.some((star, index) => yunPlate[index] !== star)
  ) {
    throw new Error('城门运盘须为当运入中顺飞的完整九宫盘。');
  }
  if (typeof facingMountain !== 'string' || !Object.hasOwn(MOUNTAIN_PROFILES, facingMountain)) {
    throw new Error('城门朝向须为有效的二十四山。');
  }
  const facingProfile = MOUNTAIN_PROFILES[facingMountain];
  if (!facingProfile) {
    return {
      hasUsableGate: false,
      candidates: [],
      summary: '城门诀：未识别朝向，无法推导',
    };
  }

  const facingGong = facingProfile.gong;
  const ringIdx = CLOCKWISE_GONG_RING.indexOf(facingGong);
  if (ringIdx === -1) {
    return {
      hasUsableGate: false,
      candidates: [],
      summary: '城门诀：中宫不立向',
    };
  }

  const leftGong = CLOCKWISE_GONG_RING[(ringIdx - 1 + 8) % 8];
  const rightGong = CLOCKWISE_GONG_RING[(ringIdx + 1) % 8];

  const targetYuanLong = facingProfile.yuanLong;
  const adjacentGongs = [leftGong, rightGong];

  const candidates: CastleGateCandidate[] = [];

  for (const gong of adjacentGongs) {
    const matchingMountain = Object.values(MOUNTAIN_PROFILES).find(
      (m) => m.gong === gong && m.yuanLong === targetYuanLong,
    );
    if (!matchingMountain) continue;

    const yunStar = yunPlate[gong - 1];
    const baseMountain = Object.values(MOUNTAIN_PROFILES).find(
      (m) => m.gong === (yunStar === 5 ? yun : yunStar) && m.yuanLong === targetYuanLong,
    );
    const flyDirection: FlyDirection =
      baseMountain && baseMountain.yinYang === '阳' ? '顺飞' : '逆飞';
    const plate = flyStars(yunStar, flyDirection);
    const arrivalStar = plate[gong - 1];

    const status: CastleGateCandidate['status'] = arrivalStar === yun ? '得旺可用' : '不得旺不可用';

    // 元旦盘宫数合一六、二七、三八、四九为正城门。
    const role: CastleGateCandidate['role'] =
      Math.abs(facingGong - gong) === 5 ? '正城门' : '副城门';

    const arrivalProfile = getNineStarProfile(arrivalStar - 1);
    const arrivalName = `${arrivalProfile.number}${arrivalProfile.color}`;
    const statusDesc =
      status === '得旺可用'
        ? `飞临当令${arrivalName}旺星，城门旺星到位`
        : `飞临${arrivalName}，未得当运旺星，城门不合`;

    candidates.push({
      gong,
      gongName: GONG_NAMES[gong],
      mountain: matchingMountain.mountain,
      role,
      yunStar,
      flyDirection,
      arrivalStar,
      status,
      summary: `${role}${matchingMountain.mountain}方（${GONG_NAMES[gong]}宫）：运星${yunStar}${flyDirection}，${statusDesc}`,
    });
  }

  const usable = candidates.filter((c) => c.status === '得旺可用');
  const summary = usable.length
    ? `城门诀：${usable.map((u) => `${u.role}${u.mountain}方旺星到位`).join('、')}；须结合该方实际水口、周围形势及生克判断`
    : '城门诀：两旁城门未得旺星飞临，正向纳气为要';

  return {
    hasUsableGate: usable.length > 0,
    candidates,
    summary,
  };
}
