/**
 * @file 应期判断（《奇门遁甲大全》应期章、《奇门旨归》）
 * @description 综合对象宫位与盘内条件判断应期节奏与触发条件：
 *   1. 已选事项用神 → 按阴阳遁内外宫取远近基线
 *   2. 未选事项用神 → 仅以值符落宫作通用参考
 *   3. 事项用神与值符分宫时，值符落宫 → 辅助基线
 *   4. 值使落宫数 → 辅助基线
 *   5. 马星加快、基准宫位落空则待填实/冲实、伏吟延迟、反吟加快
 *   6. 格局只作快慢辅助，不机械换算固定天数
 */

import { LIUCHONG_MAP } from '../../../../ganzhi';

// ============================================================================
// 常量
// ============================================================================

/** 阳遁内四宫：冬至以后，自坎至巽四宫为内 */
const YANG_DUN_INNER_PALACES = new Set([1, 8, 3, 4]);

/** 阳遁外四宫：冬至以后，自离至乾四宫为外；阴遁内外反之 */
const YANG_DUN_OUTER_PALACES = new Set([9, 2, 7, 6]);

type PalaceDistance = 'inner' | 'middle' | 'outer';

function getPalaceDistance(gong: number, isYangDun?: boolean): PalaceDistance {
  if (isYangDun === true) {
    if (YANG_DUN_INNER_PALACES.has(gong)) return 'inner';
    if (YANG_DUN_OUTER_PALACES.has(gong)) return 'outer';
    return 'middle';
  }

  if (isYangDun === false) {
    if (YANG_DUN_OUTER_PALACES.has(gong)) return 'inner';
    if (YANG_DUN_INNER_PALACES.has(gong)) return 'outer';
    return 'middle';
  }

  // 兼容旧调用：未传阴阳遁时保留原先固定宫号口径。
  if (gong <= 3) return 'inner';
  if (gong <= 6) return 'middle';
  return 'outer';
}

function assertPalaceNumber(gong: number, label: string): void {
  if (!Number.isInteger(gong) || gong < 1 || gong > 9) {
    throw new Error(`${label}必须是 1-9 的整数宫位。`);
  }
}

function getPalaceDistanceLabel(distance: PalaceDistance, isYangDun?: boolean): string {
  if (distance === 'middle') return '中宫';

  const dunLabel = isYangDun === undefined ? '' : isYangDun ? '阳遁' : '阴遁';
  return `${dunLabel}${distance === 'inner' ? '内宫' : '外宫'}`;
}

// ============================================================================
// 类型定义
// ============================================================================

export interface YingQiEstimate {
  /** 旧版固定天数下界；不再生成，仅保留类型兼容 */
  minDays?: number;
  /** 旧版固定天数上界；不再生成，仅保留类型兼容 */
  maxDays?: number;
  /** 应期节奏 */
  rhythm: '快' | '中' | '慢';
  /** 判断依据列表 */
  sources: string[];
  /** 可以据盘复核的触发条件 */
  triggerConditions: string[];
  /** 不确定性与解释边界 */
  limitations: string[];
  /** 综合描述 */
  description: string;
}

// ============================================================================
// 核心函数
// ============================================================================

/**
 * 估算应期
 *
 * @param jiuGongGe     - 九宫格宫位资料
 * @param useShenPalace - 已按事项选定的用神落宫；省略时仅回退到值符通用参考
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
 *   classicPatterns: [{ name: '青龙返首', tone: 'good' }],
 *   voidBranches: ['寅', '卯'],
 * });
 * ```
 */
export function estimateYingQi(
  jiuGongGe: Array<{ gong: number }>,
  useShenPalace?: number,
  options?: {
    /** 是否伏吟 */
    isFuyin?: boolean;
    /** 是否反吟 */
    isFanyin?: boolean;
    /** 是否有马星冲动 */
    hasHorse?: boolean;
    /** 基准宫位是否逢空亡；有事项用神时指用神，否则指值符通用参考 */
    hasVoid?: boolean;
    /** 值符落宫 */
    zhiFuLandingPalace?: number;
    /** 值使落宫 */
    zhiShiLandingPalace?: number;
    /** 经典格局列表 */
    classicPatterns?: Array<{
      name: string;
      tone: 'good' | 'bad' | 'neutral';
      /** 未填宫位表示全局格局；填宫位时仅作用于该宫。 */
      palace?: number;
    }>;
    /** 命中基准宫位的空亡地支列表（用于细化说明填实时间） */
    voidBranches?: string[];
    /** 是否阳遁；用于按冬至/夏至后内外宫判断应期远近 */
    isYangDun?: boolean;
  },
): YingQiEstimate {
  const sources: string[] = [];

  // ==========================================================================
  // 1. 基准宫位（事项用神或值符通用参考）→ 远近基线
  // ==========================================================================
  // 阴阳遁内外宫随冬至/夏至后切换；未传阴阳遁时保留旧固定宫号兼容。

  const hasUseShen = useShenPalace !== undefined;
  const baseGong = useShenPalace ?? options?.zhiFuLandingPalace;
  const baseLabel = hasUseShen ? '用神' : '值符通用参考';
  if (baseGong === undefined) {
    throw new Error('奇门应期必须提供用神落宫或值符落宫。');
  }
  assertPalaceNumber(baseGong, hasUseShen ? '用神落宫' : '值符落宫');
  if (options?.zhiFuLandingPalace !== undefined) {
    assertPalaceNumber(options.zhiFuLandingPalace, '值符落宫');
  }
  if (options?.zhiShiLandingPalace !== undefined) {
    assertPalaceNumber(options.zhiShiLandingPalace, '值使落宫');
  }
  for (const palace of jiuGongGe) {
    assertPalaceNumber(palace.gong, '九宫格宫位');
  }
  const baseDistance = getPalaceDistance(baseGong, options?.isYangDun);
  let fastSignals = 0;
  let slowSignals = 0;

  if (baseDistance === 'inner') {
    fastSignals += 1;
    sources.push(
      `${baseLabel}落${baseGong}宫（${getPalaceDistanceLabel(baseDistance, options?.isYangDun)}速应取象），盘内远近取象偏近`,
    );
  } else if (baseDistance === 'middle') {
    sources.push(
      `${baseLabel}落${baseGong}宫（${getPalaceDistanceLabel(baseDistance, options?.isYangDun)}），盘内远近取象居中`,
    );
  } else {
    slowSignals += 1;
    sources.push(
      `${baseLabel}落${baseGong}宫（${getPalaceDistanceLabel(baseDistance, options?.isYangDun)}迟应取象），盘内远近取象偏远`,
    );
  }

  // ==========================================================================
  // 2. 值符落宫 → 辅助调整
  // ==========================================================================
  // 只有事项用神已明确且与值符分宫时，值符才作为独立辅助条件；
  // 未选事项用神时值符已经是基准宫位，同宫时也不能重复计入。

  if (options?.zhiFuLandingPalace !== undefined && hasUseShen) {
    const fuGong = options.zhiFuLandingPalace;
    if (fuGong === baseGong) {
      sources.push(`值符与用神同落${fuGong}宫，内外宫基线只计一次`);
    } else {
      const fuDistance = getPalaceDistance(fuGong, options.isYangDun);
      if (fuDistance === 'inner') {
        fastSignals += 1;
        sources.push(
          `值符落${fuGong}宫（${getPalaceDistanceLabel(fuDistance, options.isYangDun)}），应期偏快`,
        );
      } else if (fuDistance === 'outer') {
        slowSignals += 1;
        sources.push(
          `值符落${fuGong}宫（${getPalaceDistanceLabel(fuDistance, options.isYangDun)}），应期偏缓`,
        );
      } else {
        sources.push(
          `值符落${fuGong}宫（${getPalaceDistanceLabel(fuDistance, options.isYangDun)}），应期中平`,
        );
      }
    }
  }

  // ==========================================================================
  // 3. 值使落宫 → 辅助调整
  // ==========================================================================

  if (options?.zhiShiLandingPalace) {
    const shiGong = options.zhiShiLandingPalace;
    const shiDistance = getPalaceDistance(shiGong, options.isYangDun);
    if (shiDistance === 'inner') {
      fastSignals += 1;
      sources.push(
        `值使落${shiGong}宫（${getPalaceDistanceLabel(shiDistance, options.isYangDun)}），应期略快`,
      );
    } else if (shiDistance === 'outer') {
      slowSignals += 1;
      sources.push(
        `值使落${shiGong}宫（${getPalaceDistanceLabel(shiDistance, options.isYangDun)}），应期略迟`,
      );
    }
  }

  // ==========================================================================
  // 4. 伏吟延迟 / 反吟加快
  // ==========================================================================

  if (options?.isFuyin) {
    slowSignals += 2;
    sources.push('伏吟局，事势迟滞，需等待重复推动或外部条件改变');
  }
  if (options?.isFanyin) {
    fastSignals += 1;
    sources.push('反吟局，事势反复，应期虽快但不稳定，需防变数');
  }

  // ==========================================================================
  // 5. 马星加快
  // ==========================================================================

  if (options?.hasHorse) {
    fastSignals += 1;
    sources.push('驿马发动，出现行动、迁移、消息流转时更容易触发进展');
  }

  // ==========================================================================
  // 6. 空亡延迟 → 需填实 / 冲实
  // ==========================================================================

  if (options?.hasVoid) {
    slowSignals += 2;
    sources.push('空亡入局，需填实或冲实之月日方应，应期偏迟');

    if (options?.voidBranches && options.voidBranches.length > 0) {
      const voidDesc = options.voidBranches
        .map((vb) => {
          const chong = LIUCHONG_MAP[vb];
          return chong ? `${vb}（冲${chong}填实）` : vb;
        })
        .join('、');
      sources.push(`空亡在${voidDesc}，待填实/冲实之月日应`);
    }
  }

  // ==========================================================================
  // 7. 经典格局调整
  // ==========================================================================
  // 格局只按传统类别作为支持或限制信号，不读取内部排序分，也不换算应期程度。

  if (options?.classicPatterns && options.classicPatterns.length > 0) {
    if (!hasUseShen) {
      sources.push('未选定事项用神，经典格局保留为全盘资料，不进入值符通用参考的应期节奏');
    } else {
      const relevantPatterns = options.classicPatterns.filter(
        (pattern) => pattern.palace === undefined || pattern.palace === baseGong,
      );
      const goodPatterns = relevantPatterns.filter((pattern) => pattern.tone === 'good');
      const badPatterns = relevantPatterns.filter((pattern) => pattern.tone === 'bad');

      if (goodPatterns.length > 0 && badPatterns.length === 0) {
        fastSignals += 1;
        sources.push(`用神落${baseGong}宫见支持格局，条件具备时较易推进`);
      } else if (badPatterns.length > 0 && goodPatterns.length === 0) {
        slowSignals += 1;
        sources.push(`用神落${baseGong}宫见限制格局，需先处理阻滞条件`);
      } else if (goodPatterns.length > 0 && badPatterns.length > 0) {
        sources.push(`用神落${baseGong}宫支持与限制并见，快慢取决于哪类条件先落实`);
      } else {
        sources.push(`用神落${baseGong}宫未命中所给格局，其他宫位格局不纳入本应期基线`);
      }
      if (goodPatterns.length > 0) {
        sources.push(`支持格局：${goodPatterns.map((pattern) => pattern.name).join('、')}`);
      }
      if (badPatterns.length > 0) {
        sources.push(`限制格局：${badPatterns.map((pattern) => pattern.name).join('、')}`);
      }
    }
  }

  // ==========================================================================
  // 8. 汇总节奏
  // ==========================================================================

  const rhythm: '快' | '中' | '慢' =
    slowSignals >= fastSignals + 2 ? '慢' : fastSignals >= slowSignals + 2 ? '快' : '中';

  // ==========================================================================
  // 9. 综合描述
  // ==========================================================================

  const matchedTriggerConditions = sources.filter((source) =>
    /逢|填实|冲实|行动|迁移|消息流转|条件具备|处理阻滞/.test(source),
  );
  const triggerConditions = matchedTriggerConditions.length
    ? matchedTriggerConditions
    : [
        `结合问题期限，观察${hasUseShen ? '用神宫' : '值符通用参考宫'}所代表的人事是否出现可核验的实际进展`,
      ];
  const limitations = [
    '快、中、慢只表示盘内相对节奏，不对应固定日数、月数或公历日期',
    '空亡、马星等只给候选触发条件，必须结合问题期限和现实事件核验',
    ...(hasUseShen ? [] : ['未按具体问题选定用神时，本结果只能作为值符落宫的通用参考']),
  ];
  const parts: string[] = [`盘内应期节奏为${rhythm}，不机械换算固定天数。`];

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
  if (baseDistance === 'inner' && !options?.hasVoid && !options?.isFuyin) {
    parts.push(
      hasUseShen ? '内宫用神，事在近期，果断推进即可。' : '值符通用参考落内宫，盘内节奏偏近。',
    );
  }
  if (baseDistance === 'outer' && !options?.hasHorse && !options?.isFanyin) {
    parts.push(
      hasUseShen ? '外宫用神，事在远日，宜耐心布局。' : '值符通用参考落外宫，盘内节奏偏远。',
    );
  }

  const description = parts.join('');

  return { rhythm, sources, triggerConditions, limitations, description };
}
