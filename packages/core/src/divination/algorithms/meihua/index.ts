/**
 * @file 梅花易数排盘算法
 * @description 基于邵雍（康节）先生所传之《梅花易数》，实现年月日时、数字、随机起卦法。
 * @流派 邵氏心易
 * @核心思想
 * 1. 以数起卦：将农历的年、月、日、时辰之数，通过特定运算转换为八卦。
 *    - (年支序 + 月 + 日) % 8  => 上卦
 *    - (年支序 + 月 + 日 + 时支序) % 8 => 下卦
 *    - (年支序 + 月 + 日 + 时支序) % 6 => 动爻
 * 2. 定体用：此乃梅花心法之灵魂。以动爻所在的经卦为“用”，静止的另一经卦为“体”。
 * 3. 论生克：以体卦为中心，分别核验用卦、体互、用互、变卦与原体的五行关系。
 *    生克必须结合体卦旺衰、生体或克体之卦的旺衰以及现实问事资料，不由单项关系
 *    直接生成现实吉凶、成败或应期。
 * 4. 分动静：卦内按体与互为静、用与变为动登记角色；现场外应动静及求测者行卧坐立
 *    需要另有观察输入，不能由动爻、数字或时间起卦方式反推。
 * 5. 察坐端：八方应兆须以求测者所在处为中心，另有现场实际方位与真实兆象记录；
 *    当前输入不含这些资料，不由主互变卦方位、题目文字、设备位置或行政地名补造。
 * 6. 察万物外应：耳闻目见须保留现场原始记录，区分成卦前后、观察时序、
 *    对象类别与实际状态后，才能与原卦及所占事项合参；当前输入不含这些资料。
 * 7. 占饮食：须另行确认具体饮食或宴请之占、判断对象、专项角色、动静原始记录、
 *    宴食时间及主客关系；当前底本句读尚待校勘，不从通用体用与卦内动爻套结论。
 * 8. 察物类：观物、射覆须另行确认待辨对象范围与专项取主口径；当前通行底本的
 *    艮离段落未闭合，且后续占物规则尚待合校，不从通用盘面生成具体物件属性。
 * 9. 诸事响应：须先明确事项、对象、判断目标、现实状态与角色；同一体用关系跨事项
 *    可有不同含义，医疗、生育、法律与安全类歌诀只登记边界，不生成现实结论。
 * 10. 反对性情：主互变卦分别复算综卦与错卦，并保存通行《杂卦传》抽象卦义；
 *    当前底本异文单独登记，不由卦义词推断人物性格、动机、事件或吉凶。
 */

import type { MeihuaData, MeihuaDivinationMethod, MeihuaSettings } from '../../../types/divination';
import { trigramsByIndex } from '../../../divination/hexagram-data';
import { getDivinationTime } from '../../../calendar/timeManager';
import { getBranchWuxing, getSeasonState, isSheng, isKe } from '../../../ganzhi';
import { assertOptionalRecord } from '../../../shared/validation';
import { getMeihuaElementRelation, getMeihuaSeasonByJieQi } from './helpers/analysis';
import { findHexagramByTrigrams, resolveTiYongByMovingYao } from './helpers/hexagram';
import {
  resolveTimeTrigramMethod,
  resolveNumberMethod,
  resolveRandomMethod,
  resolveTimeMethod,
  type MeihuaMethodResult,
} from './helpers/methods';
import { attachResultMeta, createResultMeta, stableStringify } from '../../../shared/result';
import { createSeededRandom, hasRandomOptions, type RandomTrace } from '../../../shared/random';
import { analyzeRebuiltMeihuaEvidence } from '../../meihua-evidence';

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
 * 整理应期可用事实与资料边界。
 *
 * 《梅花易数》的克应须从体、用、互、变全卦寻找生体、比和、克体之应，
 * 并先明确事项自然期限、远近、数克或理克口径及年、月、日、时尺度。
 * 当前排盘没有这些事项情境输入，因此这里只登记全卦关系候选，不计算日期。
 */
function estimateYingQi(params: {
  movingYaoIndex: number;
  upperTrigramIndex: number;
  lowerTrigramIndex: number;
  tiElement: string;
  yongElement: string;
  responses: Array<{
    role: '主卦用卦' | '体互' | '用互' | '变卦用卦';
    name: string;
    element: string;
  }>;
  seasonState: '旺' | '相' | '休' | '囚' | '死' | '平';
}): string[] {
  const periods: string[] = [];
  const {
    movingYaoIndex,
    upperTrigramIndex,
    lowerTrigramIndex,
    tiElement,
    yongElement,
    responses,
    seasonState,
  } = params;

  // 1. 动爻只登记变化层位，不附会固定的现实事件阶段。
  periods.push(
    `第${movingYaoIndex}爻为变化层位；爻位不固定对应现实事件的起步、内部、决策或结束阶段`,
  );

  // 2. 卦数须先结合事件远近和时间尺度，不能单独换算日期。
  const guaSum = upperTrigramIndex + lowerTrigramIndex;
  periods.push(
    `上下卦数和为${guaSum}，只登记取数结果；传统克应仍须先确定事件远近与年、月、日、时尺度`,
  );

  // 3. 体用生克属于卦内关系，不单独裁定克应迟速。
  const tiYongRelation = getTiYongRelation(yongElement, tiElement);
  periods.push(`主卦体用关系为${tiYongRelation}，只作生克事实，不单独裁定应期快慢`);

  // 4. 体、用、互、变全卦均须对原体核验，只登记传统克应方向候选。
  const responseText = responses.map((response) => {
    const rawRelation = getTiYongRelation(response.element, tiElement);
    const relation =
      rawRelation === '用生体'
        ? '生体'
        : rawRelation === '比和'
          ? '与体比和'
          : rawRelation === '用克体'
            ? '克体'
            : rawRelation === '体生用'
              ? '体生应卦'
              : '体克应卦';
    const direction =
      relation === '生体' || relation === '与体比和'
        ? '传统吉应方向候选'
        : relation === '克体'
          ? '传统凶应方向候选'
          : '非本条直接刻期候选';
    return `${response.role}${response.name}${response.element}${relation}，列为${direction}`;
  });
  periods.push(
    `全卦克应候选：${responseText.join('；')}；仍须结合旺衰、制化与事项情境，不直接生成日期`,
  );

  // 5. 旺衰只登记体卦盛衰，不把旺相、休囚死机械等同于快慢。
  periods.push(`体卦月令状态为${seasonState}，只作盛衰事实，不单独裁定应期快慢`);

  periods.push(
    '现有排盘未结构化记录所占事项与对象、是否确需刻期、自然期限与远近、年/月/日/时时间尺度、应验方向、数克或理克口径以及适用时的材质耐久性；资料未齐时不能计算传统克应',
  );

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
function buildMeihuaData(customDate?: Date, settings?: MeihuaSettings): MeihuaData {
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
    tiYong: (movingInLower ? (index < 3 ? '用' : '体') : index < 3 ? '体' : '用') as '体' | '用',
  }));

  // 四时旺衰：按《梅花易数》以月建地支定旺相休囚死，比季节粗分更精确。
  // 复用六爻的 getSeasonState（同令→旺，令生我→相，我生令→休，我克令→囚，令克我→死）。
  const monthBranch = ganzhi.month.slice(-1);
  const monthElement = getBranchWuxing(monthBranch);
  const tiSeasonState = getSeasonState(tiGua.element, monthBranch);
  const yongSeasonState = getSeasonState(yongGua.element, monthBranch);
  const season = getMeihuaSeasonByJieQi(timeInfo.jieQi);

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
      tiYongRelation: getMeihuaElementRelation(yongGua.element, tiGua.element),
      tiSeasonState,
      yongSeasonState,
      // 体互最紧、用互次之，二者分别与原体核验，不把上下互的位置写反。
      inter1Relation: getInterRelationToOriginalTi('体互', interTiGua.element, tiGua.element),
      inter2Relation: getInterRelationToOriginalTi('用互', interYongGua.element, tiGua.element),
      changedRelation: getMeihuaElementRelation(
        changedTiYong.yongGua.element,
        changedTiYong.tiGua.element,
      ),
      changedTiYongRelation: getMeihuaElementRelation(
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
        responses: [
          { role: '主卦用卦', name: yongGua.name, element: yongGua.element },
          { role: '体互', name: interTiGua.name, element: interTiGua.element },
          { role: '用互', name: interYongGua.name, element: interYongGua.element },
          {
            role: '变卦用卦',
            name: changedTiYong.yongGua.name,
            element: changedTiYong.yongGua.element,
          },
        ],
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
  return resultWithMeta;
}

function assertMeihuaTimestamp(timestamp: number): number {
  if (!Number.isFinite(timestamp) || Number.isNaN(new Date(timestamp).getTime())) {
    throw new Error('梅花易数结果时间戳无效，无法审核重建。');
  }
  return timestamp;
}

function resolveAuditedMeihuaMethod(input: MeihuaData): MeihuaDivinationMethod {
  const method = input.calculation?.methodKey;
  if (!method || !['time', 'timeTrigram', 'number', 'random'].includes(method)) {
    throw new Error(`未知的梅花易数起卦方式: ${String(method)}`);
  }
  return method;
}

function normalizeMeihuaRandomTrace(input: MeihuaData, timestamp: number): RandomTrace {
  const directTrace = (input as MeihuaData & { randomTrace?: RandomTrace }).randomTrace;
  const metaTrace = input.meta?.random;
  if (directTrace && metaTrace && stableStringify(directTrace) !== stableStringify(metaTrace)) {
    throw new Error('梅花易数结果中的两份随机轨迹不一致，无法审核重建。');
  }
  const rawTrace = directTrace ?? metaTrace;
  if (!rawTrace) {
    throw new Error('梅花易数随机起卦缺少原始随机轨迹，无法审核重建。');
  }
  const trace = createResultMeta({
    algorithm: 'meihua.audit.trace',
    input: { method: 'random' },
    calculatedAt: timestamp,
    random: rawTrace,
  }).random!;
  if (trace.samples.length !== 3) {
    throw new Error(`梅花易数随机起卦应记录3个原始随机样本，当前为${trace.samples.length}个。`);
  }
  if (trace.mode === 'seeded') {
    if (trace.seed === undefined) {
      throw new Error('梅花易数 seeded 随机轨迹缺少种子，无法核验。');
    }
    const seededRandom = createSeededRandom(trace.seed);
    if (trace.samples.some((sample) => seededRandom() !== sample)) {
      throw new Error('梅花易数随机轨迹与保存的种子不一致。');
    }
  } else if (trace.seed !== undefined) {
    throw new Error('梅花易数非 seeded 随机轨迹不应携带种子。');
  }
  return trace;
}

/**
 * 只保留起卦方式、时间、用户数字或可重放随机轨迹，其余卦盘与证据全部重算。
 */
export function rebuildAuditedMeihuaData(input: MeihuaData): MeihuaData {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('梅花易数结果必须是对象。');
  }
  const timestamp = assertMeihuaTimestamp(input.timestamp);
  const customDate = new Date(timestamp);
  const method = resolveAuditedMeihuaMethod(input);
  const directTrace = (input as MeihuaData & { randomTrace?: RandomTrace }).randomTrace;
  let rebuilt: MeihuaData;

  if (method === 'time' || method === 'timeTrigram') {
    if (directTrace || input.meta?.random) {
      throw new Error('梅花易数时间起卦不应携带随机轨迹。');
    }
    rebuilt = buildMeihuaData(customDate, { method });
  } else if (method === 'number') {
    if (directTrace || input.meta?.random) {
      throw new Error('梅花易数数字起卦不应携带随机轨迹。');
    }
    const number = input.calculation?.number;
    if (!Number.isSafeInteger(number) || (number ?? 0) <= 0) {
      throw new Error('梅花易数数字起卦缺少安全范围内的原始正整数，无法审核重建。');
    }
    rebuilt = buildMeihuaData(customDate, { method: 'number', number });
  } else {
    const trace = normalizeMeihuaRandomTrace(input, timestamp);
    const replayed = buildMeihuaData(customDate, {
      method: 'random',
      replay: trace.samples,
    });
    rebuilt = {
      ...replayed,
      meta: createResultMeta({
        algorithm: 'meihua',
        input: { method: 'random', number: undefined, timestamp },
        calculatedAt: timestamp,
        random: trace,
      }),
    };
  }

  return {
    ...rebuilt,
    evidenceAnalysis: analyzeRebuiltMeihuaEvidence(rebuilt),
  };
}

/** 所有公开证据分析先从原始起卦输入重建，禁止旧派生字段进入提示词。 */
export function analyzeMeihuaEvidence(input: MeihuaData) {
  return rebuildAuditedMeihuaData(input).evidenceAnalysis!;
}

/** 生成梅花易数完整卦盘。 */
export function generateMeihua(customDate?: Date, settings?: MeihuaSettings): MeihuaData {
  const result = buildMeihuaData(customDate, settings);
  return {
    ...result,
    evidenceAnalysis: analyzeRebuiltMeihuaEvidence(result),
  };
}

export type {
  MeihuaCounterEvidenceFact,
  MeihuaCounterSummaryFact,
  MeihuaEvidenceAnalysis,
  MeihuaEvidenceStageKey,
  MeihuaHexagramFact,
  MeihuaExternalMotionFact,
  MeihuaFoodContextFact,
  MeihuaObjectContextFact,
  MeihuaTopicResponseContextFact,
  MeihuaTenResponseContextFact,
  MeihuaMatterTenResponseContextFact,
  MeihuaTrigramResponseCatalogFact,
  MeihuaHexagramDispositionFact,
  MeihuaHexagramDispositionVersionFact,
  MeihuaInternalMotionFact,
  MeihuaInternalMotionReference,
  MeihuaInternalMotionRole,
  MeihuaInterResponseEvidence,
  MeihuaPartyFact,
  MeihuaResponseInteractionFact,
  MeihuaResponseReference,
  MeihuaResponseRole,
  MeihuaSensoryOmenFact,
  MeihuaSpatialOmenFact,
  MeihuaStageEvidence,
  MeihuaStageCoverageFact,
  MeihuaTimingFact,
  MeihuaTimingRelationCandidate,
  MeihuaTimingSummaryFact,
  MeihuaTraditionalFact,
  MeihuaTransitionFact,
  MeihuaYaoCoverageFact,
  MeihuaYaoFact,
} from '../../meihua-evidence';
