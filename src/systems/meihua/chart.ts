// 梅花起卦计算，证据层仍由过渡适配器调用旧实现。
import { SolarTime } from 'tyme4ts';
import type { MeihuaSettings } from './types';
import { getDivinationTime, getSolarTermName, getBranchWuxing, getSeasonState, isSheng, isKe } from '../calendar';
import { trigrams } from './trigrams';
import { findHexagramByTrigrams, resolveTiYongByMovingYao } from './hexagram';
import { estimateYingQi } from './timing';
import { resolveTimeMethod, resolveNumberMethod, resolveSoundMethod, resolveCharacterMethod, resolveDirectionMethod, resolveRandomMethod, type MeihuaMethodResult } from './methods';

const MeihuaHelpers = {
  getSeasonByJieQi(name: string): '春' | '夏' | '秋' | '冬' | '未知' {
    const groups = { 春: '立春 雨水 惊蛰 春分 清明 谷雨', 夏: '立夏 小满 芒种 夏至 小暑 大暑', 秋: '立秋 处暑 白露 秋分 寒露 霜降', 冬: '立冬 小雪 大雪 冬至 小寒 大寒' } as const;
    for (const [season, names] of Object.entries(groups)) if (names.split(' ').includes(name)) return season as '春' | '夏' | '秋' | '冬';
    return '未知';
  },
  getSeasonByMonth(month: number): '春' | '夏' | '秋' | '冬' {
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('农历月份无效。');
    return (['春', '夏', '秋', '冬'] as const)[Math.floor((month - 1) / 3)];
  },
  getElementRelation(yong: string, ti: string) {
    if (yong === ti) return '体用比和';
    if (isSheng(yong, ti)) return '用生体';
    if (isSheng(ti, yong)) return '体生用';
    if (isKe(yong, ti)) return '用克体';
    if (isKe(ti, yong)) return '体克用';
    throw new Error(`无法判断用卦${yong}与体卦${ti}的五行关系。`);
  },
};

const VALID_WUXING = new Set(['木', '火', '土', '金', '水']);
const MOVING_YAO_NAMES = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'] as const;
const MEIHUA_INPUT_FIELDS = [
  'number',
  'soundCount',
  'characterText',
  'characterCount',
  'characterTones',
  'characterStrokeCounts',
  'characterLeftStrokes',
  'characterRightStrokes',
  'direction',
  'objectType',
] as const;
const MEIHUA_METHOD_INPUTS: Partial<Record<NonNullable<MeihuaSettings['method']>, readonly string[]>> = {
  time: [],
  number: ['number'],
  sound: ['soundCount'],
  character: MEIHUA_INPUT_FIELDS.filter((field) => field.startsWith('character')),
  direction: ['direction', 'objectType'],
  random: [],
};

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
      `梅花易数${sourceLabel}五行无效：${sourceLabel}${sourceElement || '空'}、原体${originalTiElement || '空'}。`,
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

export function getMeihuaTiYongSeasonEvaluation(
  relation: string,
  tiSeason: string,
  yongSeason: string,
): string {
  const isTiStrong = tiSeason === '旺' || tiSeason === '相';
  const isYongStrong = yongSeason === '旺' || yongSeason === '相';
  const seasonContext = `体卦月令${tiSeason}、用卦月令${yongSeason}`;

  switch (relation) {
    case '用克体':
      if (isTiStrong && !isYongStrong) {
        return `主卦用克体，${seasonContext}；体旺用衰，克体条件较轻`;
      }
      if (!isTiStrong && isYongStrong) {
        return `主卦用克体，${seasonContext}；用旺体衰，克体条件较重`;
      }
      return `主卦用克体，${seasonContext}`;
    case '体克用':
      return `主卦体克用，${seasonContext}；体卦${isTiStrong ? '旺相，制用条件较强' : '休囚死，制用条件较弱'}`;
    case '用生体':
      return `主卦用生体，${seasonContext}；用卦${isYongStrong ? '旺相，生体条件较强' : '休囚死，生体条件较弱'}`;
    case '体生用':
      return `主卦体生用，${seasonContext}；体卦向用卦泄气`;
    case '比和':
      return `体用同五行，比和相应；体卦${tiSeason}、用卦${yongSeason}`;
    default:
      return `主卦体用关系未定，${seasonContext}`;
  }
}

/**
 * 依据《梅花易数》“用为始，互为中，变为终”的事态三阶段演化趋势机
 */
export function evaluateMeihuaTimelineTrend(params: {
  tiElement: string;
  originalYongElement: string;
  interTiElement: string;
  interYongElement: string;
  changedYongElement: string;
  changedTiElement?: string;
}): {
  trend: '先难后易' | '先顺后阻' | '始末顺畅' | '始终受制' | '中途多阻' | '未形成单向走势';
  summary: string;
} {
  const {
    tiElement,
    originalYongElement,
    interTiElement,
    interYongElement,
    changedYongElement,
    changedTiElement = tiElement,
  } = params;

  const startRelation = getTiYongRelation(originalYongElement, tiElement);
  const interTiRelation = getInterRelationToOriginalTi('体互', interTiElement, tiElement);
  const interYongRelation = getInterRelationToOriginalTi('用互', interYongElement, tiElement);
  const endRelation = getTiYongRelation(changedYongElement, changedTiElement);

  // 1. 初阶段（主卦用对体）
  const startFavorable = startRelation === '用生体' || startRelation === '比和';
  const startDifficult = startRelation === '用克体' || startRelation === '体生用';

  // 2. 中阶段（互卦对原体）
  const interRelations = [interTiRelation, interYongRelation];
  const midFavorable = interRelations.every(
    (relation) => relation.includes('生原体') || relation.includes('与原体比和'),
  );
  const midDifficult = interRelations.some(
    (relation) => relation.includes('克原体') || relation.startsWith('原体生'),
  );

  // 3. 终阶段（变卦用对变后体）
  const endFavorable = endRelation === '用生体' || endRelation === '比和';
  const endDifficult = endRelation === '用克体' || endRelation === '体生用';
  const summary = `主卦用/体：${startRelation}；互卦：${interTiRelation}、${interYongRelation}；变卦用/体：${endRelation}`;

  if (startDifficult && endFavorable) {
    return {
      trend: '先难后易',
      summary,
    };
  }
  if (startFavorable && endDifficult) {
    return {
      trend: '先顺后阻',
      summary,
    };
  }
  if (startFavorable && endFavorable && midFavorable) {
    return {
      trend: '始末顺畅',
      summary,
    };
  }
  if (startDifficult && endDifficult && midDifficult) {
    return {
      trend: '始终受制',
      summary,
    };
  }
  if (midDifficult) {
    return {
      trend: '中途多阻',
      summary,
    };
  }

  return {
    trend: '未形成单向走势',
    summary,
  };
}

// savedRandom is only for rebuilding a previously drawn chart, never a public input.
export function generateMeihuaChart(date: Date, settings?: MeihuaSettings, savedRandom?: { upperTrigramIndex: number; lowerTrigramIndex: number; movingYaoIndex: number }) {
  const { ganzhi, timestamp } = getDivinationTime(date);
  const wall = new Date(timestamp + 8 * 3_600_000);
  const lunarDay = SolarTime.fromYmdHms(wall.getUTCFullYear(), wall.getUTCMonth() + 1, wall.getUTCDate(), wall.getUTCHours(), wall.getUTCMinutes(), 0).getLunarHour().getLunarDay();
  const lunar = { yearInChinese: lunarDay.toString().split('年')[0] + '年', monthNumber: Math.abs(lunarDay.getMonth()), dayNumber: lunarDay.getDay() };
  const timeInfo = { jieQi: getSolarTermName(timestamp) };
  const method = settings?.method ?? 'time';
  const acceptedInputs = MEIHUA_METHOD_INPUTS[method];
  if (acceptedInputs) for (const field of MEIHUA_INPUT_FIELDS) {
    if (settings?.[field] !== undefined && !acceptedInputs.includes(field)) throw new Error(`梅花易数${method}起卦不接受 ${field}。`);
  }
  const methodResult: MeihuaMethodResult = (() => {
    switch (method) {
      case 'number':
        return resolveNumberMethod(settings?.number ?? 0, ganzhi.hour.slice(-1));
      case 'sound':
        return resolveSoundMethod(settings?.soundCount ?? 0, ganzhi.hour.slice(-1));
      case 'character':
        return resolveCharacterMethod(settings ?? {});
      case 'direction': {
        if (!settings?.direction || !settings.objectType) {
          throw new Error('方位起卦必须提供 direction 和 objectType');
        }
        return resolveDirectionMethod(
          settings.direction,
          settings.objectType,
          ganzhi.hour.slice(-1),
        );
      }
      case 'random':
        return resolveRandomMethod(savedRandom);
      case 'time':
        return resolveTimeMethod(ganzhi, lunar);
      default:
        throw new Error(`未知的梅花易数起卦方式: ${method}`);
    }
  })();

  const { upperTrigramIndex, lowerTrigramIndex, movingYaoIndex, calculation } = methodResult;
  calculation.timezoneOffsetMinutes = 480;

  // 3. 确定主卦、互卦、变卦
  const upperTrigram = trigrams[upperTrigramIndex];
  const lowerTrigram = trigrams[lowerTrigramIndex];
  if (!upperTrigram || !lowerTrigram) {
    throw new Error(`梅花易数卦象索引越界: upper=${upperTrigramIndex}, lower=${lowerTrigramIndex}`);
  }
  const mainHexagram = findHexagramByTrigrams(upperTrigramIndex, lowerTrigramIndex);

  const mainLines = [...lowerTrigram.lines, ...upperTrigram.lines];
  const changedLines = [...mainLines];
  changedLines[movingYaoIndex - 1] = 1 - changedLines[movingYaoIndex - 1];

  // 《梅花易数》卷一《互卦起例》载“乾坤无互，互其变卦”：主卦为纯乾或纯坤时，改取变卦中间四爻。
  const mutualSourceLines =
    upperTrigramIndex === lowerTrigramIndex && (upperTrigramIndex === 1 || upperTrigramIndex === 8)
      ? changedLines
      : mainLines;
  const interLowerLines = mutualSourceLines.slice(1, 4);
  const interUpperLines = mutualSourceLines.slice(2, 5);

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

  const yaosDetail = mainLines.map((line, index) => {
    const isYong = index < 3 ? movingInLower : !movingInLower;
    return {
      position: index + 1,
      yaoType: (line === 1 ? '阳' : '阴') as '阳' | '阴',
      isChanging: index === movingYaoIndex - 1,
      tiYong: (isYong ? '用' : '体') as '用' | '体',
    };
  });

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

  const result = {
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
      tiYongSeasonEvaluation: getMeihuaTiYongSeasonEvaluation(
        getTiYongRelation(yongGua.element, tiGua.element),
        tiSeasonState,
        yongSeasonState,
      ),
      timelineTrend: evaluateMeihuaTimelineTrend({
        tiElement: tiGua.element,
        originalYongElement: yongGua.element,
        interTiElement: interTiGua.element,
        interYongElement: interYongGua.element,
        changedYongElement: changedTiYong.yongGua.element,
        changedTiElement: changedTiYong.tiGua.element,
      }),
      yingQi: estimateYingQi({
        movingYaoIndex,
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
  return result;
}
