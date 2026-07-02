/**
 * @file 应期判断（《奇门遁甲大全》应期章、《奇门旨归》）
 * @description 综合多种方法估算应期时间：
 *   1. 用神落宫数 → 远近基线
 *   2. 值符落宫数 → 辅助基线
 *   3. 值使落宫数 → 辅助基线
 *   4. 庚格定应期：阳日看庚下（地盘庚），阴日看庚上（天盘庚），地支逢冲为应
 *   5. 马星加快、空亡填实/冲实、伏吟延迟、反吟加快
 *   6. 吉格加快、凶格延迟
 */

import { palaceBranches } from './_constants';

// ============================================================================
// 常量
// ============================================================================

/** 六冲映射（地支六冲：子午、丑未、寅申、卯酉、辰戌、巳亥） */
const sixChong: Record<string, string> = {
  子: '午',
  午: '子',
  丑: '未',
  未: '丑',
  寅: '申',
  申: '寅',
  卯: '酉',
  酉: '卯',
  辰: '戌',
  戌: '辰',
  巳: '亥',
  亥: '巳',
};

/** 阳干 */
const YANG_STEMS = ['甲', '丙', '戊', '庚', '壬'];

// ============================================================================
// 类型定义
// ============================================================================

export interface YingQiEstimate {
  /** 最短应期（日） */
  minDays: number;
  /** 最长应期（日） */
  maxDays: number;
  /** 应期节奏 */
  rhythm: '快' | '中' | '慢';
  /** 判断依据列表 */
  sources: string[];
  /** 综合描述 */
  description: string;
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 估算应期
 *
 * @param jiuGongGe     - 九宫格数据（含天盘星干、地盘干）
 * @param useShenPalace - 用神落宫（若无则回退至值符落宫）
 * @param options       - 可选参数
 * @returns 应期估算结果
 *
 * @example
 * ```ts
 * const result = estimateYingQi(jiuGongGe, 3, {
 *   isFuyin: false,
 *   isFanyin: true,
 *   hasHorse: false,
 *   hasVoid: true,
 *   zhiFuLandingPalace: 1,
 *   zhiShiLandingPalace: 8,
 *   dayGanZhi: '甲子',
 *   classicPatterns: [{ name: '青龙返首', score: 8 }],
 *   voidBranches: ['寅', '卯'],
 * });
 * ```
 */
export function estimateYingQi(
  jiuGongGe: Array<{
    gong: number;
    tianPan: { stem: string; star: string };
    diPan: { stem: string };
  }>,
  useShenPalace?: number,
  options?: {
    /** 是否伏吟 */
    isFuyin?: boolean;
    /** 是否反吟 */
    isFanyin?: boolean;
    /** 是否有马星冲动 */
    hasHorse?: boolean;
    /** 是否有空亡 */
    hasVoid?: boolean;
    /** 值符落宫 */
    zhiFuLandingPalace?: number;
    /** 值使落宫 */
    zhiShiLandingPalace?: number;
    /** 日干支（如 "甲子"），用于庚格定应期的阳日/阴日判断 */
    dayGanZhi?: string;
    /** 旧字段兼容：历史上误传时干支，新调用请使用 dayGanZhi */
    hourGanZhi?: string;
    /** 经典格局列表 */
    classicPatterns?: Array<{ name: string; score: number }>;
    /** 空亡地支列表（用于细化说明填实时间） */
    voidBranches?: string[];
  },
): YingQiEstimate {
  const sources: string[] = [];

  // ==========================================================================
  // 1. 用神落宫数 → 远近基线
  // ==========================================================================
  // 内宫（1-3）：应速，1-15 日
  // 中宫（4-6）：渐进，15-60 日
  // 外宫（7-9）：迟应，60 日以上

  const baseGong = useShenPalace || options?.zhiFuLandingPalace || 5;
  let baseDays: number;
  let rhythm: '快' | '中' | '慢';

  if (baseGong <= 3) {
    baseDays = 7;
    rhythm = '快';
    sources.push(`用神落${baseGong}宫（内宫速应），基线 1-15 日`);
  } else if (baseGong <= 6) {
    baseDays = 30;
    rhythm = '中';
    sources.push(`用神落${baseGong}宫（中宫渐近），基线 15-60 日`);
  } else {
    baseDays = 120;
    rhythm = '慢';
    sources.push(`用神落${baseGong}宫（外宫迟应），基线 60 日以上`);
  }

  // ==========================================================================
  // 2. 值符落宫 → 辅助调整
  // ==========================================================================
  // 值符落内宫（1-3）→ 加快，落外宫（7-9）→ 减缓

  if (options?.zhiFuLandingPalace) {
    const fuGong = options.zhiFuLandingPalace;
    if (fuGong <= 3) {
      baseDays *= 0.85;
      sources.push(`值符落${fuGong}宫（内宫），应期偏快`);
    } else if (fuGong >= 7) {
      baseDays *= 1.15;
      sources.push(`值符落${fuGong}宫（外宫），应期偏缓`);
    } else {
      sources.push(`值符落${fuGong}宫（中宫），应期中平`);
    }
  }

  // ==========================================================================
  // 3. 值使落宫 → 辅助调整
  // ==========================================================================

  if (options?.zhiShiLandingPalace) {
    const shiGong = options.zhiShiLandingPalace;
    if (shiGong <= 3) {
      baseDays *= 0.9;
      sources.push(`值使落${shiGong}宫（内宫），应期略快`);
    } else if (shiGong >= 7) {
      baseDays *= 1.1;
      sources.push(`值使落${shiGong}宫（外宫），应期略迟`);
    }
  }

  // ==========================================================================
  // 4. 庚格定应期
  // ==========================================================================
  // 《奇门遁甲大全》庚格章：
  //   阳日（甲丙戊庚壬）看庚下 → 地盘庚所在宫
  //   阴日（乙丁己辛癸）看庚上 → 天盘庚所在宫
  //   地支逢冲为应 → 庚所在宫的地支逢其六冲之日/月为应期

  const ganZhi = options?.dayGanZhi || options?.hourGanZhi || '';
  if (ganZhi) {
    const dayStem = ganZhi.charAt(0);
    const isYangDay = YANG_STEMS.includes(dayStem);

    // 遍历九宫查找庚的位置
    for (const gong of jiuGongGe) {
      if (gong.gong === 5) continue; // 中五宫无明确地支定位

      if (isYangDay && gong.diPan.stem === '庚') {
        // 阳日：看庚下（地盘庚）
        const gongNum = gong.gong;
        const branches = palaceBranches[gongNum] || [];
        const chongDesc = branches
          .map((b) => {
            const opp = sixChong[b];
            return opp ? `${b}冲${opp}` : b;
          })
          .join('、');

        sources.push(
          `阳日（${dayStem}日）见庚在地盘${gongNum}宫，` +
            `${chongDesc ? '逢' + chongDesc : '依宫数'}应`,
        );

        // 奇数宫（阳宫）以日/月计，偶数宫（阴宫）以月计
        if (gongNum % 2 === 1) {
          sources.push(`庚落${gongNum}宫（阳宫），应期以日或月计`);
        } else {
          sources.push(`庚落${gongNum}宫（阴宫），应期以月计`);
        }
      } else if (!isYangDay && gong.tianPan.stem === '庚') {
        // 阴日：看庚上（天盘庚）
        const gongNum = gong.gong;
        const branches = palaceBranches[gongNum] || [];
        const chongDesc = branches
          .map((b) => {
            const opp = sixChong[b];
            return opp ? `${b}冲${opp}` : b;
          })
          .join('、');

        sources.push(
          `阴日（${dayStem}日）见庚在天盘${gongNum}宫，` +
            `${chongDesc ? '逢' + chongDesc : '依宫数'}应`,
        );

        if (gongNum % 2 === 1) {
          sources.push(`庚落${gongNum}宫（阳宫），应期以日或月计`);
        } else {
          sources.push(`庚落${gongNum}宫（阴宫），应期以月计`);
        }
      }
    }
  }

  // ==========================================================================
  // 5. 伏吟延迟 / 反吟加快
  // ==========================================================================

  if (options?.isFuyin) {
    baseDays *= 1.5;
    rhythm = '慢';
    sources.push('伏吟局，事势迟滞，应期延长约 50%');
  }
  if (options?.isFanyin) {
    baseDays *= 0.7;
    if (rhythm !== '快') rhythm = '中';
    sources.push('反吟局，事势反复，应期虽快但不稳定，需防变数');
  }

  // ==========================================================================
  // 6. 马星加快
  // ==========================================================================

  if (options?.hasHorse) {
    baseDays *= 0.7;
    sources.push('驿马发动，应期加快约 30%');
  }

  // ==========================================================================
  // 7. 空亡延迟 → 需填实 / 冲实
  // ==========================================================================

  if (options?.hasVoid) {
    baseDays *= 1.3;
    sources.push('空亡入局，需填实或冲实之月日方应，应期偏迟');

    if (options?.voidBranches && options.voidBranches.length > 0) {
      const voidDesc = options.voidBranches
        .map((vb) => {
          const chong = sixChong[vb];
          return chong ? `${vb}（冲${chong}填实）` : vb;
        })
        .join('、');
      sources.push(`空亡在${voidDesc}，待填实/冲实之月日应`);
    }
  }

  // ==========================================================================
  // 8. 经典格局调整
  // ==========================================================================
  // 吉格（score > 0）→ 加快 30%
  // 凶格（score < 0）→ 延迟 50%
  // 吉凶参半 → 保持中平

  if (options?.classicPatterns && options.classicPatterns.length > 0) {
    const goodCount = options.classicPatterns.filter((p) => p.score > 0).length;
    const badCount = options.classicPatterns.filter((p) => p.score < 0).length;

    if (goodCount > 0 && badCount === 0) {
      baseDays *= 0.7;
      sources.push(`吉格为主（${goodCount}吉），应期加快约 30%`);
    } else if (badCount > 0 && goodCount === 0) {
      baseDays *= 1.5;
      sources.push(`凶格为主（${badCount}凶），应期延迟约 50%`);
    } else if (goodCount > 0 && badCount > 0) {
      sources.push(`吉凶参半（${goodCount}吉 ${badCount}凶），应期中平`);
    }

    // 高影响力格局单独说明
    for (const pat of options.classicPatterns) {
      if (Math.abs(pat.score) >= 8) {
        if (pat.score > 0) {
          sources.push(`${pat.name}大吉格，应期显著加快`);
        } else {
          sources.push(`${pat.name}大凶格，应期显著延迟`);
        }
      }
    }
  }

  // ==========================================================================
  // 9. 最终计算
  // ==========================================================================

  // 限制到合理范围：至少 1 日，最多 360 日
  baseDays = Math.max(1, Math.min(360, Math.round(baseDays)));

  let minDays: number;
  let maxDays: number;

  if (rhythm === '快') {
    // 快：1-15 日基线
    minDays = Math.max(1, Math.round(baseDays * 0.5));
    maxDays = Math.min(15, Math.round(baseDays * 1.5));
  } else if (rhythm === '中') {
    // 中：15-60 日基线
    minDays = Math.max(3, Math.round(baseDays * 0.6));
    maxDays = Math.min(90, Math.round(baseDays * 1.5));
  } else {
    // 慢：60 日以上基线
    minDays = Math.max(15, Math.round(baseDays * 0.7));
    maxDays = Math.min(360, Math.round(baseDays * 1.5));
  }

  // 确保合理
  minDays = Math.max(1, Math.min(minDays, maxDays));
  maxDays = Math.max(minDays, maxDays);

  // ==========================================================================
  // 10. 综合描述
  // ==========================================================================

  const parts: string[] = [`应期约 ${minDays}-${maxDays} 日（${rhythm}）。`];

  if (options?.hasHorse) {
    parts.push('马星冲动，应期较快，宜主动把握时机。');
  }
  if (options?.hasVoid) {
    parts.push('空亡填实/冲实后方应，需耐心等待相应月日。');
  }
  if (options?.isFuyin) {
    parts.push('伏吟局主迟滞，需反复推动或等待外因触发。');
  }
  if (options?.isFanyin) {
    parts.push('反吟局主反复，虽快但易生变数，多做预案。');
  }
  if (baseGong <= 3 && !options?.hasVoid && !options?.isFuyin) {
    parts.push('内宫用神，事在近期，果断推进即可。');
  }
  if (baseGong >= 7 && !options?.hasHorse && !options?.isFanyin) {
    parts.push('外宫用神，事在远日，宜耐心布局。');
  }

  const description = parts.join('');

  return { minDays, maxDays, rhythm, sources, description };
}
