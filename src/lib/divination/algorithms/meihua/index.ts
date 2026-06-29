/**
 * @file 梅花易数排盘算法
 * @description 基于邵雍（康节）先生所传之《梅花易数》，实现年月日时、数字、随机、外应四类起卦法。
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

import type { MeihuaData, MeihuaSettings } from '../../../../types/divination';
import { trigramsByIndex } from '../../../../utils/hexagram-data';
import { MeihuaHelpers } from '../../../../utils/divination-helpers';
import { getDivinationTime } from '../../../../utils/timeManager';
import { getSeasonState, BRANCH_WUXING, isSheng, isKe, LIUHE_MAP, LIUCHONG_MAP } from '../_shared';
import { findHexagramByTrigrams, resolveTiYongByMovingYao } from './helpers/hexagram';
import {
  resolveExternalMethod,
  resolveLaterHeavenMethod,
  resolveNumberMethod,
  resolveRandomMethod,
  resolveTimeMethod,
  type MeihuaMethodResult,
} from './helpers/methods';

const trigrams = trigramsByIndex;/**
 * 体用生克关系判定字串
 */
function getTiYongRelation(yongElement: string, tiElement: string): string {
  if (!yongElement || !tiElement) return '无';
  if (yongElement === tiElement) return '比和';
  if (isSheng(yongElement, tiElement)) return '用生体';
  if (isSheng(tiElement, yongElement)) return '体生用';
  if (isKe(yongElement, tiElement)) return '用克体';
  if (isKe(tiElement, yongElement)) return '体克用';
  return '杂';
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
  const { movingYaoIndex, upperTrigramIndex, lowerTrigramIndex, tiElement, yongElement, seasonState } = params;

  // 1. 动爻数定应期范围：初爻快（日），二爻周，三爻月，四爻季，五爻半年，上爻年
  const yaoPeriodMap: Record<number, string> = {
    1: '应期较快，以日计（1-6日或1-6周）',
    2: '应期以周计（7-14日）',
    3: '应期以月计（1-3月）',
    4: '应期以季计（3-6月）',
    5: '应期以半年计（6-12月）',
    6: '应期以年计（1年以上）',
  };
  periods.push(yaoPeriodMap[movingYaoIndex] || '应期视卦气进退而定');

  // 2. 卦数定应期（上下卦数之和或乘积）
  const guaSum = upperTrigramIndex + lowerTrigramIndex;
  if (guaSum <= 6) {
    periods.push(`卦数和为${guaSum}，应期偏向短期（${guaSum * 3}日内）`);
  } else if (guaSum <= 12) {
    periods.push(`卦数和为${guaSum}，应期以月计（${Math.round(guaSum / 2)}月左右）`);
  } else {
    periods.push(`卦数和为${guaSum}，应期偏长（以季或年计）`);
  }

  // 3. 体用生克定吉凶时限
  if (yongElement === tiElement) {
    periods.push('体用比和，事成较快，应期缩短');
  } else if (isSheng(yongElement, tiElement)) {
    periods.push('用生体，事有助力，应期顺势）');
  } else if (isKe(yongElement, tiElement)) {
    periods.push('用克体，需先破解阻力，应期推迟');
  } else if (isKe(tiElement, yongElement)) {
    periods.push('体克用，我克事势虽可成但需消耗时日');
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
 * @param customDate 自定义时间，若不提供则使用当前时间
 * @returns 返回一个完整的梅花易数卦盘数据对象
 */
export function generateMeihua(customDate?: Date, settings?: MeihuaSettings): MeihuaData {
  // 1. 获取占卜时间的农历及干支信息
  const { ganzhi, timeInfo, timestamp } = getDivinationTime(customDate);
  const { lunar } = timeInfo;
  const method = settings?.method || 'time';

  const methodResult: MeihuaMethodResult = (() => {
    switch (method) {
      case 'number':
        return resolveNumberMethod(settings?.number || 0);
      case 'random':
        return resolveRandomMethod();
      case 'external':
        return resolveExternalMethod(settings?.externalOmens);
      case 'laterHeaven':
        return resolveLaterHeavenMethod(ganzhi.hour.slice(-1));
      case 'time':
      default:
        return resolveTimeMethod(ganzhi, lunar);
    }
  })();

  const { upperTrigramIndex, lowerTrigramIndex, movingYaoIndex, calculation } = methodResult;

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

  // 使用更直接的方法查找互卦
  const findTrigramByLines = (lines: number[]) => {
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

  const interLowerResult = findTrigramByLines(interLowerLines);
  const interUpperResult = findTrigramByLines(interUpperLines);

  const interHexagram =
    interLowerResult && interUpperResult
      ? findHexagramByTrigrams(interUpperResult.index, interLowerResult.index)
      : null;

  const changedLines = [...mainLines];
  changedLines[movingYaoIndex - 1] = 1 - changedLines[movingYaoIndex - 1];

  const changedLowerLines = changedLines.slice(0, 3);
  const changedUpperLines = changedLines.slice(3, 6);

  const changedLowerResult = findTrigramByLines(changedLowerLines);
  const changedUpperResult = findTrigramByLines(changedUpperLines);

  const changingHexagram =
    changedLowerResult && changedUpperResult
      ? findHexagramByTrigrams(changedUpperResult.index, changedLowerResult.index)
      : null;

  //【核心修正：注入“体用”之魂】
  // 梅花易数之精髓，在于体用生克。无体用，则无以论吉凶。
  // 体卦：代表占卜者自身或所占之事的主体，是相对静止的一方。
  // 用卦：代表所占之事所遇到的人、事、物，是相对运动的一方。
  // 定体用之法，以动爻为准：动爻所在的经卦为“用”，静止的另一经卦为“体”。
  // 动爻在四、五、上爻时，上卦为用、下卦为体；反之则下卦为用、上卦为体。
  const { tiGua, yongGua } = resolveTiYongByMovingYao(upperTrigram, lowerTrigram, movingYaoIndex);

  const changedTiYong =
    changedUpperResult && changedLowerResult
      ? resolveTiYongByMovingYao(
          changedUpperResult.trigram,
          changedLowerResult.trigram,
          movingYaoIndex,
        )
      : null;

  const yaosDetail = mainLines.map((line, index) => ({
    position: index + 1,
    yaoType: (line === 1 ? '阳' : '阴') as '阳' | '阴',
    isChanging: index === movingYaoIndex - 1,
    // 标注体用，并进行类型断言
    tiYong: ((index < 3 ? lowerTrigram.name : upperTrigram.name) === tiGua.name ? '体' : '用') as
      | '体'
      | '用',
  }));

  // 四时旺衰：按《梅花易数》以月建地支定旺相休囚死，比季节粗分更精确。
  // 复用六爻的 getSeasonState（同令→旺，令生→相，生令→休，令克→囚，克令→死）。
  const monthBranch = ganzhi.month.slice(-1);
  const tiSeasonState = getSeasonState(tiGua.element, monthBranch);
  const yongSeasonState = getSeasonState(yongGua.element, monthBranch);
  const seasonByJieQi = MeihuaHelpers.getSeasonByJieQi(timeInfo.jieQi);
  const season: '春' | '夏' | '秋' | '冬' =
    seasonByJieQi !== '未知' ? (seasonByJieQi as '春' | '夏' | '秋' | '冬') : '春';

  return {
    originalName: mainHexagram.name,
    changedName: changingHexagram?.name || '',
    interName: interHexagram?.name || '',

    // 核心体用关系
    tiGua: { name: tiGua.name, element: tiGua.element, nature: tiGua.nature },
    yongGua: { name: yongGua.name, element: yongGua.element, nature: yongGua.nature },
    changedTiGua: changedTiYong
      ? {
          name: changedTiYong.tiGua.name,
          element: changedTiYong.tiGua.element,
          nature: changedTiYong.tiGua.nature,
        }
      : null,
    changedYongGua: changedTiYong
      ? {
          name: changedTiYong.yongGua.name,
          element: changedTiYong.yongGua.element,
          nature: changedTiYong.yongGua.nature,
        }
      : null,

    // 卦象详情
    mainHexagram: {
      name: mainHexagram.name,
      symbol: mainHexagram.symbol,
      upper: upperTrigram.name,
      lower: lowerTrigram.name,
      description: mainHexagram.description,
      yaoCi: mainHexagram.yaoCi,
      movingYaoCi: mainHexagram.yaoCi?.[movingYaoIndex - 1] || '',
    },
    changedHexagram: changingHexagram
      ? {
          name: changingHexagram.name,
          symbol: changingHexagram.symbol,
          upper: changedUpperResult?.trigram?.name || '',
          lower: changedLowerResult?.trigram?.name || '',
          description: changingHexagram.description,
          yaoCi: changingHexagram.yaoCi,
        }
      : null,
    interHexagram: interHexagram
      ? {
          name: interHexagram.name,
          symbol: interHexagram.symbol,
          upper: interUpperResult?.trigram?.name || '',
          lower: interLowerResult?.trigram?.name || '',
          description: interHexagram.description,
          yaoCi: interHexagram.yaoCi,
        }
      : null,

    // 动爻信息
    movingYao: {
      position: movingYaoIndex,
      description: `第${movingYaoIndex}爻动`,
      yaoName: ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][movingYaoIndex - 1] || '未知',
    },

    //【核心修正：重构分析逻辑】
    // 所有的吉凶判断，都围绕“体卦”的五行展开。
    // 用生体、互生体、变生体为吉；用克体、互克体、变克体为凶。
    analysis: {
      season,
      // 1. 用卦与体卦关系：代表事情的开端和当前状态。
      tiYongRelation: MeihuaHelpers.getElementRelation(yongGua.element, tiGua.element),
      tiSeasonState,
      yongSeasonState,
      // 2. 互卦与体卦关系：代表事情发展的过程。互卦有二，需分别论之。
      // 传统梅花互卦体用定法（《梅花易数》原旨）：
      // 原动爻在下卦（1/2/3爻）→互卦的下卦为互体、上卦为互用；
      // 原动爻在上卦（4/5/6爻）→互卦的上卦为互体、下卦为互用。
      // 以互用对互体论生克，反映事态发展过程中的关键关系。
      inter1Relation:
        interLowerResult && interUpperResult
          ? MeihuaHelpers.getElementRelation(
              movingYaoIndex <= 3
                ? interUpperResult.trigram.element
                : interLowerResult.trigram.element,
              movingYaoIndex <= 3
                ? interLowerResult.trigram.element
                : interUpperResult.trigram.element,
            )
          : '无',
      // 另一互卦经卦对原体卦的辅助关系（非正统，仅作参考）
      inter2Relation: interUpperResult
        ? MeihuaHelpers.getElementRelation(interUpperResult.trigram.element, tiGua.element)
        : '无',
      // 3. 变卦与体卦关系：代表事情的最终结局。
      changedRelation: changedTiYong
        ? MeihuaHelpers.getElementRelation(
            changedTiYong.yongGua.element,
            changedTiYong.tiGua.element,
          )
        : '无变卦',
      changedTiYongRelation: changedTiYong
        ? MeihuaHelpers.getElementRelation(
            changedTiYong.yongGua.element,
            changedTiYong.tiGua.element,
          )
        : '无变卦',
      // 4. 体用生克细化：按五行生克定吉凶程度
      tiYongRaw: getTiYongRelation(yongGua.element, tiGua.element),
      // 5. 应期判断
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
}
