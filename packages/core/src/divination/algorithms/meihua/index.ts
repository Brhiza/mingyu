/**
 * @file 梅花易数排盘算法
 * @description 基于邵雍（康节）先生所传之《梅花易数》，实现年月日时、数字、随机起卦法。
 * @来源 通行本《梅花易数》（传为邵雍所传）；版本、卦序与体用互变口径以当前固定数据为准。
 * @流派 邵氏心易
 * @核心思想
 * 1. 以数起卦：将农历的年、月、日、时辰之数，通过特定运算转换为八卦。
 *    - (年支序 + 月 + 日) % 8  => 上卦
 *    - (年支序 + 月 + 日 + 时支序) % 8 => 下卦
 *    - (年支序 + 月 + 日 + 时支序) % 6 => 动爻
 * 2. 定体用：此乃梅花心法之灵魂。以动爻所在的经卦为“用”，静止的另一经卦为“体”。
 * 3. 论生克：以体卦为中心（我），分析用卦、互卦、变卦对体卦的五行生克关系，以此判断吉凶。
 *    - 生体为吉，克体为凶。体用比和，事顺。
 *    - 用为事之始，互为事之中，变为事之终。
 */

import type { MeihuaData, MeihuaSettings } from '../../../types/divination';
import { trigramsByIndex } from '../../../divination/hexagram-data';
import { MeihuaHelpers } from '../../../divination/divination-helpers';
import { getDivinationTime } from '../../../calendar/timeManager';
import { getBranchWuxing, getSeasonState, isSheng, isKe } from '../../../ganzhi';
import { assertOptionalRecord } from '../../../shared/validation';
import { findHexagramByTrigrams, resolveTiYongByMovingYao } from './helpers/hexagram';
import {
  resolveTimeTrigramMethod,
  resolveNumberMethod,
  resolveRandomMethod,
  resolveTimeMethod,
  type MeihuaMethodResult,
} from './helpers/methods';
import { attachResultMeta } from '../../../shared/result';
import { hasRandomOptions } from '../../../shared/random';
import { analyzeMeihuaEvidence } from '../../meihua-evidence';

const trigrams = trigramsByIndex;
const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);
const MOVING_YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const;

/**
 * 体用生克关系判定字串
 */
function getTiYongRelation(yongElement: string, tiElement: string): string {
  if (!VALID_WUXING.has(yongElement) || !VALID_WUXING.has(tiElement)) {
    throw new Error(`梅花易数体用五行无效：用${yongElement || '空'}、体${tiElement || '空'}。`);
  }
  if (yongElement === tiElement) return '比和';
  if (isSheng(yongElement, tiElement)) return '用生体';
  if (isSheng(tiElement, yongElement)) return '体生用';
  if (isKe(yongElement, tiElement)) return '用克体';
  if (isKe(tiElement, yongElement)) return '体克用';
  return '杂';
}

function getInterRelationToOriginalTi(
  sourceLabel: '体互' | '用互',
  sourceElement: string,
  originalTiElement: string,
): string {
  if (!VALID_WUXING.has(sourceElement) || !VALID_WUXING.has(originalTiElement)) {
    throw new Error(
      `梅花易数互卦五行无效：${sourceLabel}${sourceElement || '空'}、原体${originalTiElement || '空'}。`,
    );
  }
  if (sourceElement === originalTiElement) return `${sourceLabel}与原体比和`;
  if (isSheng(sourceElement, originalTiElement)) return `${sourceLabel}生原体`;
  if (isSheng(originalTiElement, sourceElement)) return `原体生${sourceLabel}`;
  if (isKe(sourceElement, originalTiElement)) return `${sourceLabel}克原体`;
  if (isKe(originalTiElement, sourceElement)) return `原体克${sourceLabel}`;
  throw new Error(
    `梅花易数无法判断${sourceLabel}${sourceElement}与原体${originalTiElement}的关系。`,
  );
}

/**
 * 应期判断（按《梅花易数》动静应期法）：
 * 根据动爻数、卦数、体用旺衰综合判断应期范围
 */
function estimateYingQi(params: {
  movingYaoIndex: number;
  upperTrigramIndex: number;
  lowerTrigramIndex: number;
  tiElement: string;
  yongElement: string;
  seasonState: '旺' | '相' | '休' | '囚' | '死' | '平';
}): string[] {
  const periods: string[] = [];
  const {
    movingYaoIndex,
    upperTrigramIndex,
    lowerTrigramIndex,
    tiElement,
    yongElement,
    seasonState,
  } = params;

  // 1. 动爻只定阶段和层位，不机械换算具体日、周、月、年。
  const yaoPeriodMap: Record<number, string> = {
    1: '初爻动，先观察事情刚开始或基层条件的变化',
    2: '二爻动，先观察内部配合与近端条件的变化',
    3: '三爻动，先观察由内向外过渡时的变化',
    4: '四爻动，先观察外部环境开始介入时的变化',
    5: '五爻动，先观察核心决策与主导条件的变化',
    6: '上爻动，先观察事情末端、退出或重新定局的变化',
  };
  periods.push(yaoPeriodMap[movingYaoIndex] || '触发层位须结合实际事件再验');

  // 2. 卦数只保留为起卦结构旁证，不直接映射时间单位。
  const guaSum = upperTrigramIndex + lowerTrigramIndex;
  periods.push(`上下卦数和为${guaSum}，只作取数来源旁证，不换算绝对日期`);

  // 3. 体用生克只作快慢与阻力条件，不直接等于事件成败。
  if (yongElement === tiElement) {
    periods.push('体用比和，关系同气，可优先观察条件同步时的进展');
  } else if (isSheng(yongElement, tiElement)) {
    periods.push('用生体，外部条件对体卦有生扶，可观察助力实际出现时的进展');
  } else if (isKe(yongElement, tiElement)) {
    periods.push('用克体，外部事项对体卦形成压力，须先观察阻力是否缓解');
  } else if (isKe(tiElement, yongElement)) {
    periods.push('体克用，体卦能够制约事项，但须核验投入和消耗是否可承受');
  }

  // 4. 旺衰定迟速
  if (seasonState === '旺' || seasonState === '相') {
    periods.push('体卦旺相，应期快于常规');
  } else if (seasonState === '休' || seasonState === '囚' || seasonState === '死') {
    periods.push('体卦休囚，应期迟缓');
  }

  return periods;
}

/**
 * 生成梅花易数卦盘
 *
 * 支持时间起卦、数字起卦和随机起卦；timeTrigram 作为历史兼容入口按时间起卦计算。
 * 不传 `customDate` 则使用当前时间。
 *
 * @param customDate 自定义起卦时间（可选），影响时间卦的时间干支。
 * @param settings   起卦设置，含 method（起卦方式）、number（数字起卦用）等。
 * @returns 完整的梅花易数卦盘数据对象 MeihuaData。
 *
 * @example
 * ```ts
 * // 时间起卦（默认）
 * const result = generateMeihua();
 *
 * // 数字起卦
 * const result = generateMeihua(undefined, { method: 'number', number: 123 });
 * ```
 */
export function generateMeihua(customDate?: Date, settings?: MeihuaSettings): MeihuaData {
  assertOptionalRecord(settings, '梅花易数起卦设置');
  // 1. 获取占卜时间的农历及干支信息
  const { ganzhi, timeInfo, timestamp } = getDivinationTime(customDate);
  const { lunar } = timeInfo;
  const method = settings?.method ?? 'time';
  if (method !== 'random' && hasRandomOptions(settings)) {
    throw new Error('梅花易数仅随机起卦接受 seed、replay 或自定义随机源。');
  }

  const methodResult: MeihuaMethodResult = (() => {
    switch (method) {
      case 'number':
        return resolveNumberMethod(settings?.number ?? 0, ganzhi.hour.slice(-1));
      case 'random':
        return resolveRandomMethod(settings);
      case 'timeTrigram':
        return resolveTimeTrigramMethod(ganzhi, lunar);
      case 'time':
        return resolveTimeMethod(ganzhi, lunar);
      default:
        throw new Error(`未知的梅花易数起卦方式: ${method}`);
    }
  })();

  const { upperTrigramIndex, lowerTrigramIndex, movingYaoIndex, calculation, randomTrace } =
    methodResult;

  // 3. 确定主卦、互卦、变卦
  const upperTrigram = trigrams[upperTrigramIndex];
  const lowerTrigram = trigrams[lowerTrigramIndex];
  if (!upperTrigram || !lowerTrigram) {
    throw new Error(`梅花易数卦象索引越界: upper=${upperTrigramIndex}, lower=${lowerTrigramIndex}`);
  }
  const mainHexagram = findHexagramByTrigrams(upperTrigramIndex, lowerTrigramIndex);

  const mainLines = [...lowerTrigram.lines, ...upperTrigram.lines];

  const interLowerLines = mainLines.slice(1, 4);
  const interUpperLines = mainLines.slice(2, 5);

  const findTrigramByBottomUpLines = (lines: number[]) => {
    for (let i = 1; i <= 8; i++) {
      const trigram = trigrams[i];
      if (trigram && trigram.lines.length === lines.length) {
        let match = true;
        for (let j = 0; j < lines.length; j++) {
          if (trigram.lines[j] !== lines[j]) {
            match = false;
            break;
          }
        }
        if (match) return { index: i, trigram };
      }
    }
    return null;
  };

  const interLowerResult = findTrigramByBottomUpLines(interLowerLines);
  const interUpperResult = findTrigramByBottomUpLines(interUpperLines);
  if (!interLowerResult || !interUpperResult) {
    throw new Error(
      `梅花易数互卦经卦匹配失败：下互${interLowerLines.join('')}、上互${interUpperLines.join('')}。`,
    );
  }
  const interHexagram = findHexagramByTrigrams(interUpperResult.index, interLowerResult.index);

  const changedLines = [...mainLines];
  changedLines[movingYaoIndex - 1] = 1 - changedLines[movingYaoIndex - 1];

  const changedLowerLines = changedLines.slice(0, 3);
  const changedUpperLines = changedLines.slice(3, 6);

  const changedLowerResult = findTrigramByBottomUpLines(changedLowerLines);
  const changedUpperResult = findTrigramByBottomUpLines(changedUpperLines);
  if (!changedLowerResult || !changedUpperResult) {
    throw new Error(
      `梅花易数变卦经卦匹配失败：下卦${changedLowerLines.join('')}、上卦${changedUpperLines.join('')}。`,
    );
  }
  const changingHexagram = findHexagramByTrigrams(
    changedUpperResult.index,
    changedLowerResult.index,
  );

  // 定体用之法，以动爻为准：动爻所在的经卦为“用”，静止的另一经卦为“体”。
  // 动爻在四、五、上爻时，上卦为用、下卦为体；反之则下卦为用、上卦为体。
  const { tiGua, yongGua } = resolveTiYongByMovingYao(upperTrigram, lowerTrigram, movingYaoIndex);

  // 《梅花易数》卷三《体用互变之诀》明定：
  // 体在上，则上互为体互、下互为用互；体在下，则下互为体互、上互为用互。
  // 动爻在下卦时原体在上，动爻在上卦时原体在下，互卦角色必须沿用原体所在方位。
  const movingInLower = movingYaoIndex <= 3;
  const interTiGua = movingInLower ? interUpperResult.trigram : interLowerResult.trigram;
  const interYongGua = movingInLower ? interLowerResult.trigram : interUpperResult.trigram;

  const changedTiYong = resolveTiYongByMovingYao(
    changedUpperResult.trigram,
    changedLowerResult.trigram,
    movingYaoIndex,
  );
  const movingYaoName = MOVING_YAO_NAMES[movingYaoIndex - 1];
  if (!movingYaoName) {
    throw new Error(`梅花易数动爻层位无效：${movingYaoIndex}。`);
  }
  const movingYaoCi = mainHexagram.yaoCi?.[movingYaoIndex - 1];
  if (!movingYaoCi) {
    throw new Error(`梅花易数${mainHexagram.name}缺少第${movingYaoIndex}爻爻辞。`);
  }

  const yaosDetail = mainLines.map((line, index) => ({
    position: index + 1,
    yaoType: (line === 1 ? '阳' : '阴') as '阳' | '阴',
    isChanging: index === movingYaoIndex - 1,
    tiYong: ((index < 3 ? lowerTrigram.name : upperTrigram.name) === tiGua.name ? '体' : '用') as
      '体' | '用',
  }));

  // 四时旺衰：按《梅花易数》以月建地支定旺相休囚死，比季节粗分更精确。
  // 复用六爻的 getSeasonState（同令→旺，令生我→相，我生令→休，我克令→囚，令克我→死）。
  const monthBranch = ganzhi.month.slice(-1);
  const monthElement = getBranchWuxing(monthBranch);
  const tiSeasonState = getSeasonState(tiGua.element, monthBranch);
  const yongSeasonState = getSeasonState(yongGua.element, monthBranch);
  const seasonByJieQi = MeihuaHelpers.getSeasonByJieQi(timeInfo.jieQi);
  const season: '春' | '夏' | '秋' | '冬' =
    seasonByJieQi !== '未知'
      ? (seasonByJieQi as '春' | '夏' | '秋' | '冬')
      : MeihuaHelpers.getSeasonByMonth(lunar.monthNumber);

  const result: MeihuaData = {
    originalName: mainHexagram.name,
    changedName: changingHexagram.name,
    interName: interHexagram.name,

    // 核心体用关系
    tiGua: { name: tiGua.name, element: tiGua.element, nature: tiGua.nature },
    yongGua: { name: yongGua.name, element: yongGua.element, nature: yongGua.nature },
    changedTiGua: {
      name: changedTiYong.tiGua.name,
      element: changedTiYong.tiGua.element,
      nature: changedTiYong.tiGua.nature,
    },
    changedYongGua: {
      name: changedTiYong.yongGua.name,
      element: changedTiYong.yongGua.element,
      nature: changedTiYong.yongGua.nature,
    },
    interTiGua: {
      name: interTiGua.name,
      element: interTiGua.element,
      nature: interTiGua.nature,
    },
    interYongGua: {
      name: interYongGua.name,
      element: interYongGua.element,
      nature: interYongGua.nature,
    },

    // 卦象详情
    mainHexagram: {
      name: mainHexagram.name,
      symbol: mainHexagram.symbol,
      upper: upperTrigram.name,
      lower: lowerTrigram.name,
      description: mainHexagram.description,
      yaoCi: mainHexagram.yaoCi,
      movingYaoCi,
      yongCi: mainHexagram.yongCi,
    },
    changedHexagram: {
      name: changingHexagram.name,
      symbol: changingHexagram.symbol,
      upper: changedUpperResult.trigram.name,
      lower: changedLowerResult.trigram.name,
      description: changingHexagram.description,
      yaoCi: changingHexagram.yaoCi,
      yongCi: changingHexagram.yongCi,
    },
    interHexagram: {
      name: interHexagram.name,
      symbol: interHexagram.symbol,
      upper: interUpperResult.trigram.name,
      lower: interLowerResult.trigram.name,
      description: interHexagram.description,
      yaoCi: interHexagram.yaoCi,
      yongCi: interHexagram.yongCi,
    },

    // 动爻信息
    movingYao: {
      position: movingYaoIndex,
      description: `第${movingYaoIndex}爻动`,
      yaoName: movingYaoName,
    },

    analysis: {
      season,
      monthBranch,
      monthElement,
      tiYongRelation: MeihuaHelpers.getElementRelation(yongGua.element, tiGua.element),
      tiSeasonState,
      yongSeasonState,
      // 体互最紧、用互次之，二者分别与原体核验，不把上下互的位置写反。
      inter1Relation: getInterRelationToOriginalTi('体互', interTiGua.element, tiGua.element),
      inter2Relation: getInterRelationToOriginalTi('用互', interYongGua.element, tiGua.element),
      changedRelation: MeihuaHelpers.getElementRelation(
        changedTiYong.yongGua.element,
        changedTiYong.tiGua.element,
      ),
      changedTiYongRelation: MeihuaHelpers.getElementRelation(
        changedTiYong.yongGua.element,
        changedTiYong.tiGua.element,
      ),
      tiYongRaw: getTiYongRelation(yongGua.element, tiGua.element),
      yingQi: estimateYingQi({
        movingYaoIndex,
        upperTrigramIndex,
        lowerTrigramIndex,
        tiElement: tiGua.element,
        yongElement: yongGua.element,
        seasonState: tiSeasonState,
      }),
    },

    ganzhi,
    timestamp,
    yaosDetail,
    calculation,
  };
  const resultWithMeta = attachResultMeta(result, {
    algorithm: 'meihua',
    input: { method, number: settings?.number, timestamp },
    calculatedAt: timestamp,
    random: randomTrace,
  });
  return { ...resultWithMeta, evidenceAnalysis: analyzeMeihuaEvidence(resultWithMeta) };
}

export { analyzeMeihuaEvidence, conditionMeihuaTraditionalText } from '../../meihua-evidence';
export type {
  MeihuaCounterEvidenceFact,
  MeihuaCounterSummaryFact,
  MeihuaEvidenceAnalysis,
  MeihuaEvidenceStageKey,
  MeihuaHexagramFact,
  MeihuaStageEvidence,
  MeihuaStageCoverageFact,
  MeihuaTimingFact,
  MeihuaTimingSummaryFact,
  MeihuaTraditionalFact,
  MeihuaTransitionFact,
  MeihuaYaoCoverageFact,
  MeihuaYaoFact,
} from '../../meihua-evidence';
