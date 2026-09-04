/**
 * @file 玄空飞星城门诀与特殊理气格局判定
 * @传统依据 《沈氏玄空学》城门诀：向首两旁同元龙之位为城门候选；运星入中依元龙阴阳顺逆飞布，若旺星飞临城门宫位，为城门得位可用。
 */
import { flyStars, type FlyDirection } from './period-stars';

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

/** 先天八卦数（用于判定正城门与副城门：乾九兑四离三震八巽二坎七艮六坤一） */
const EARLY_HEAVEN_NUMBERS: Record<number, number> = {
  1: 7, // 坎
  2: 1, // 坤
  3: 8, // 震
  4: 2, // 巽
  6: 9, // 乾
  7: 4, // 兑
  8: 6, // 艮
  9: 3, // 离
};

export interface CastleGateCandidate {
  gong: number;
  gongName: string;
  mountain: string;
  role: '正城门' | '副城门';
  yunStar: number;
  flyDirection: FlyDirection;
  arrivalStar: number;
  status: '得旺可用' | '得生气可用' | '不得旺不可用';
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
    if (yunStar === 5) {
      candidates.push({
        gong,
        gongName: GONG_NAMES[gong],
        mountain: matchingMountain.mountain,
        role: '副城门',
        yunStar,
        flyDirection: '顺飞',
        arrivalStar: 5,
        status: '不得旺不可用',
        summary: `${GONG_NAMES[gong]}宫（${matchingMountain.mountain}方）运星逢五黄入中不可作城门`,
      });
      continue;
    }

    const baseMountain = Object.values(MOUNTAIN_PROFILES).find(
      (m) => m.gong === yunStar && m.yuanLong === targetYuanLong,
    );
    const flyDirection: FlyDirection =
      baseMountain && baseMountain.yinYang === '阳' ? '顺飞' : '逆飞';
    const plate = flyStars(yunStar, flyDirection);
    const arrivalStar = plate[gong - 1];

    const nextYun = (yun % 9) + 1;
    let status: CastleGateCandidate['status'] = '不得旺不可用';
    if (arrivalStar === yun) {
      status = '得旺可用';
    } else if (arrivalStar === nextYun) {
      status = '得生气可用';
    }

    const facingEarly = EARLY_HEAVEN_NUMBERS[facingGong] ?? 0;
    const gateEarly = EARLY_HEAVEN_NUMBERS[gong] ?? 0;
    const isEarlyMatch = facingEarly + gateEarly === 10 || Math.abs(facingEarly - gateEarly) === 5;
    const role: CastleGateCandidate['role'] = isEarlyMatch ? '正城门' : '副城门';

    const statusDesc =
      status === '得旺可用'
        ? `飞临当令${arrivalStar}白旺星，城门得位吉可用`
        : status === '得生气可用'
          ? `飞临进气${arrivalStar}白生气星，城门次吉可用`
          : `飞临${arrivalStar}星非旺气，城门不合`;

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

  const usable = candidates.filter((c) => c.status !== '不得旺不可用');
  const summary = usable.length
    ? `城门诀：${usable.map((u) => `${u.role}${u.mountain}方${u.status === '得旺可用' ? '当旺大吉' : '得生气次吉'}`).join('、')}`
    : '城门诀：两旁城门未得旺星飞临，正向纳气为要';

  return {
    hasUsableGate: usable.length > 0,
    candidates,
    summary,
  };
}
