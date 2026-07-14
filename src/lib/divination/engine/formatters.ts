import type {
  AlmanacData,
  AstrolabeData,
  DivinationData,
  LenormandData,
  LiurenData,
  LiuyaoData,
  MeihuaData,
  QimenData,
  SsgwData,
  SupplementaryInfo,
  TarotData,
  TaiyiResult,
  XiaoliurenData,
  XiaoliurenPalaceDetail,
} from '../../../types/divination';
import { LunarUtil, getDivinationTime } from 'mingyu-core/calendar';
import { resolveSsgwStoryContent } from '../ssgw-content';
import { analyzeSsgwEvidence, conditionSsgwInterpretation } from 'mingyu-core/divination/ssgw';
import {
  analyzeQimenEvidence,
  conditionQimenTraditionalText,
} from '@core/divination/algorithms/qimen';
import {
  analyzeAlmanacEvidence,
  conditionAlmanacTraditionalText,
} from '@core/divination/algorithms/almanac';
import { LIUCHONG_MAP } from '@core/ganzhi';
import type { DivinationMethodId } from '@core/divination/config';
import {
  analyzeLiuyaoEvidence,
  conditionLiuyaoTraditionalText,
} from '@core/divination/algorithms/liuyao';
import { analyzeMeihuaEvidence } from '@core/divination/algorithms/meihua';
import {
  analyzeLiurenEvidence,
  conditionLiurenTraditionalText,
} from '@core/divination/algorithms/liuren';
import {
  analyzeXiaoliurenEvidence,
  conditionXiaoliurenTraditionalText,
} from '@core/divination/algorithms/xiaoliuren';
import { analyzeTarotEvidence } from '@core/divination/tarot';
import { analyzeLenormandEvidence } from '@core/divination/algorithms/lenormand';
import { analyzeAstrolabeEvidence } from '@core/divination/algorithms/astrolabe';

function resolveDivinationTimestamp(data?: DivinationData): number | null {
  if (
    !data ||
    !('timestamp' in data) ||
    typeof data.timestamp !== 'number' ||
    !Number.isFinite(data.timestamp)
  ) {
    return null;
  }

  return data.timestamp;
}

function resolveDivinationDate(data?: DivinationData): Date | undefined {
  const timestamp = resolveDivinationTimestamp(data);
  if (timestamp === null) {
    return undefined;
  }

  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function buildTimeInfoText(data?: DivinationData) {
  const date = resolveDivinationDate(data);
  const timeInfo = date ? getDivinationTime(date).timeInfo : getDivinationTime().timeInfo;
  const display = LunarUtil.formatTimeDisplay(timeInfo);
  return [display.solar, display.lunar, display.ganzhi, `节气：${timeInfo.jieQi}`].join('\n');
}

export function buildSolarTimeInfoText(data?: DivinationData) {
  const date = resolveDivinationDate(data);
  const timeInfo = date ? getDivinationTime(date).timeInfo : getDivinationTime().timeInfo;
  const display = LunarUtil.formatTimeDisplay(timeInfo);
  return display.solar;
}

export function formatGanzhi(ganzhi?: { year: string; month: string; day: string; hour: string }) {
  if (!ganzhi) {
    return '干支：未知';
  }

  return `干支：${ganzhi.year}年 ${ganzhi.month}月 ${ganzhi.day}日 ${ganzhi.hour}时`;
}

export function formatSupplementaryInfoSection(
  method: Exclude<DivinationMethodId, 'random'>,
  supplementaryInfo?: SupplementaryInfo,
) {
  if (!supplementaryInfo) {
    return '';
  }

  const lines: string[] = [];
  if (supplementaryInfo.gender) {
    lines.push(`性别：${supplementaryInfo.gender}`);
  }
  if (
    typeof supplementaryInfo.birthYear === 'number' &&
    Number.isFinite(supplementaryInfo.birthYear)
  ) {
    lines.push(`出生年份：${supplementaryInfo.birthYear}`);
  }
  if (method === 'meihua' && supplementaryInfo.meihuaSettings?.method) {
    const methodLabelMap: Record<string, string> = {
      time: '时间起卦',
      number: '数字起卦',
      random: '随机起卦',
      timeTrigram: '时间起卦兼容项',
    };
    lines.push(
      `起卦方式：${methodLabelMap[supplementaryInfo.meihuaSettings.method] || supplementaryInfo.meihuaSettings.method}`,
    );
  }
  if (method === 'meihua' && typeof supplementaryInfo.meihuaSettings?.number === 'number') {
    lines.push(`起卦数字：${supplementaryInfo.meihuaSettings.number}`);
  }
  if (supplementaryInfo.userSupplement?.trim()) {
    lines.push(
      method === 'almanac'
        ? `择日补充：${supplementaryInfo.userSupplement.trim()}`
        : `现实背景：${supplementaryInfo.userSupplement.trim()}`,
    );
  }
  const contextFields = [
    ['当前情况', supplementaryInfo.currentSituation],
    ['当前状态', supplementaryInfo.currentState],
    ['已知事实', supplementaryInfo.knownFacts],
    ['期望结果', supplementaryInfo.desiredOutcome],
    ['现实限制', supplementaryInfo.constraints],
  ] as const;
  contextFields.forEach(([label, value]) => {
    if (value?.trim()) lines.push(`${label}：${value.trim()}`);
  });

  if (lines.length === 0) {
    return '';
  }

  return lines.join('\n');
}

export function buildSection(title: string, content: string) {
  const body = content.trim();
  if (!body) {
    return '';
  }

  return `${title}\n${body}`;
}

function getMeihuaMethodLabel(
  calculation?: Pick<NonNullable<MeihuaData['calculation']>, 'method' | 'methodKey'> | null,
) {
  if (!calculation) {
    return '未知';
  }

  const methodLabelMap: Record<string, string> = {
    time: '年月日时起卦法',
    number: '数字起卦法',
    random: '随机起卦法',
    timeTrigram: '年月日时起卦法（兼容）',
  };

  if (calculation.method?.trim()) {
    return methodLabelMap[calculation.method] || calculation.method;
  }

  return calculation.methodKey
    ? methodLabelMap[calculation.methodKey] || calculation.methodKey
    : '未知';
}

function formatLiuyaoYaoBrief(item: LiuyaoData['yaosDetail'][number]) {
  return `第${item.position}爻${item.sixRelative}${item.najiaDizhi}${item.wuxing}`;
}

function formatHiddenSpirit(item: NonNullable<LiuyaoData['hiddenSpirits']>[number]) {
  return `${item.sixRelative}伏第${item.position}爻${item.najiaDizhi}${item.wuxing}${item.isVoid ? '（空）' : ''}，伏于${item.underYao.sixRelative}${item.underYao.najiaDizhi}${item.underYao.wuxing}下`;
}

function formatLiuyaoHexagramRelation(data: LiuyaoData) {
  const relations = data.hexagramRelations;
  if (!relations) {
    return '';
  }

  return [
    relations.original ? `主卦${relations.original}` : '',
    relations.changed ? `变卦${relations.changed}` : '',
    relations.transition || '',
  ]
    .filter(Boolean)
    .join('；');
}

function formatLiuyaoFanFuRelation(data: LiuyaoData) {
  const relations = data.fanfuRelations;
  if (!relations?.labels?.length) {
    return '';
  }

  const details = [...(relations.fanyin || []), ...(relations.fuyin || [])]
    .map((item) => `${item.label}（${item.description}）`)
    .join('；');

  return details || relations.labels.join('；');
}

function getGanzhiBranch(value?: string) {
  return value ? value.slice(-1) : '';
}

function createLiuyaoMonthDayEvidence(data: LiuyaoData) {
  const monthBranch = getGanzhiBranch(data.ganzhi.month);
  const dayBranch = getGanzhiBranch(data.ganzhi.day);
  const monthClash = LIUCHONG_MAP[monthBranch] || '';
  const dayClash = LIUCHONG_MAP[dayBranch] || '';
  const describeBranchHit = (label: string, branch: string, clashBranch: string) => {
    const sameYaos = data.yaosDetail
      .filter((item) => item.najiaDizhi === branch)
      .map(formatLiuyaoYaoBrief);
    const clashYaos = data.yaosDetail
      .filter((item) => item.najiaDizhi === clashBranch)
      .map(formatLiuyaoYaoBrief);
    const parts = [
      sameYaos.length ? `同支${sameYaos.join('、')}` : '未直接同支入爻',
      clashYaos.length ? `冲${clashYaos.join('、')}` : '',
    ].filter(Boolean);
    return `${label}${branch || '未知'}：${parts.join('，')}`;
  };

  return [
    describeBranchHit('月建', monthBranch, monthClash),
    describeBranchHit('日辰', dayBranch, dayClash),
    '月日证据只作旺衰与触发校验，不能脱离用神、世应和动变单独下结论',
  ].join('；');
}

function createLiuyaoTimingEvidence(data: LiuyaoData) {
  const movingText = data.yaosDetail
    .filter((item) => item.isChanging)
    .map(
      (item) =>
        `${formatLiuyaoYaoBrief(item)}动${item.changedYao ? `化${item.changedYao.liuqin}${item.changedYao.dizhi}` : ''}`,
    )
    .join('、');
  const voidText = data.voidBranches?.length
    ? `空亡${data.voidBranches.join('、')}：逢出空、冲实或用神透出时才可作为应期`
    : '';
  const hiddenText = data.hiddenSpirits?.length
    ? `伏神${data.hiddenSpirits.map(formatHiddenSpirit).join('；')}：待伏神透出、飞神受冲或用神得力时再看应期`
    : '';

  return [
    movingText ? `动变触发：${movingText}` : '静卦：先以世应、用神旺衰、月日冲合定快慢',
    voidText,
    hiddenText,
  ]
    .filter(Boolean)
    .join('；');
}

function createLiuyaoTimingPriorityEvidence(data: LiuyaoData) {
  const movingYaos = data.yaosDetail.filter((item) => item.isChanging).map(formatLiuyaoYaoBrief);
  const hasMonthDay = Boolean(data.ganzhi?.month || data.ganzhi?.day);
  const priorities = [
    movingYaos.length
      ? `一级动变：先看${movingYaos.join('、')}及其化出六亲`
      : '一级动变：无动爻时改看世应用神旺衰',
    hasMonthDay
      ? '二级月日：月建、日辰对用神、世应、动爻的同支、冲合与生克'
      : '二级月日：资料不足时不得硬给绝对日期',
    data.voidBranches?.length
      ? `三级空亡：${data.voidBranches.join('、')}待出空、冲实或用神透出`
      : '三级空亡：未见空亡资料时不作出空应期',
    data.hiddenSpirits?.length
      ? '四级伏神：伏神透出、飞神受冲或用神得力后再看成事窗口'
      : '四级伏神：未见伏神时不补造伏藏应期',
    '未给目标期限时只输出快慢、先后和触发条件，不换算绝对年月日',
  ];

  return priorities.join('；');
}

function createMeihuaTimingEvidence(data: MeihuaData) {
  const calculation = data.calculation;
  const methodLabel = getMeihuaMethodLabel(calculation);
  const numberEvidence =
    typeof calculation?.number === 'number'
      ? `起卦数字${calculation.number}可作卦数旁证`
      : calculation?.numbers?.length
        ? `起卦数字${calculation.numbers.join('、')}可作卦数旁证`
        : '';
  const timeEvidence = [
    calculation?.month ? `月数${calculation.month}` : '',
    calculation?.day ? `日数${calculation.day}` : '',
    calculation?.timeZhi ? `时支${calculation.timeZhi}` : '',
  ]
    .filter(Boolean)
    .join('、');

  return [
    `动爻第${data.movingYao.position}爻：可作阶段、层位或触发点，不可单独换算绝对日期`,
    `${data.analysis.season}季体卦${data.analysis.tiSeasonState}、用卦${data.analysis.yongSeasonState}：先判断快慢与承受力`,
    `互卦${data.interName || data.interHexagram?.name || '无'}主过程，变卦${data.changedName || data.changedHexagram?.name || '无'}主结果`,
    numberEvidence,
    timeEvidence ? `时间数：${timeEvidence}` : '',
    `起卦法${methodLabel}只决定取数来源，应期仍需体用、互变、四时和卦数互证`,
  ]
    .filter(Boolean)
    .join('；');
}

function createMeihuaTimingPriorityEvidence(data: MeihuaData) {
  const calculation = data.calculation;
  const numberText =
    typeof calculation?.number === 'number' || calculation?.numbers?.length
      ? '四级卦数：数字、年月日时数只作旁证'
      : '四级卦数：未给数字或时间数时不补造卦数应期';

  return [
    '一级体用：先看体用生克与四时旺衰定快慢和承受力',
    `二级动爻：第${data.movingYao.position}爻只作阶段、层位或触发点`,
    '三级互变：互卦看过程窗口，变卦看结果落点',
    numberText,
  ].join('；');
}

function createMeihuaSymbolEvidence(data: MeihuaData) {
  const calculation = data.calculation;
  const methodLabel = getMeihuaMethodLabel(calculation);
  const processHexagram = data.interHexagram?.name || data.interName || '无';
  const resultHexagram = data.changedHexagram?.name || data.changedName || '无';
  const numberText =
    typeof calculation?.number === 'number'
      ? `数字${calculation.number}只作旁证`
      : calculation?.numbers?.length
        ? `数字${calculation.numbers.join('、')}只作旁证`
        : '';

  return [
    `体卦${data.tiGua.name}${data.tiGua.element}为主观承载，用卦${data.yongGua.name}${data.yongGua.element}为外部事务`,
    `体用${data.analysis.tiYongRelation}，四时${data.analysis.season}季体${data.analysis.tiSeasonState}、用${data.analysis.yongSeasonState}`,
    `互卦${processHexagram}看过程压力或转折，变卦${resultHexagram}看结果落点`,
    `动爻第${data.movingYao.position}爻优先看当前阶段、层位变化和触发点`,
    data.changedTiGua && data.changedYongGua
      ? `变后体${data.changedTiGua.name}${data.changedTiGua.element}、用${data.changedYongGua.name}${data.changedYongGua.element}，按${data.analysis.changedTiYongRelation}复核最终取舍`
      : '',
    `起卦法${methodLabel}决定取象来源，不单独压过体用主轴`,
    numberText,
  ]
    .filter(Boolean)
    .join('；');
}

function createXiaoliurenTimingEvidence(data: XiaoliurenData) {
  const timingMap: Record<XiaoliurenPalaceDetail['name'], string> = {
    大安: '偏稳定，可看当下已有基础，宜稳中推进',
    留连: '偏拖延反复，常需先清旧账或等阻滞松动',
    速喜: '偏快速消息，宜看近处回应和短期转机',
    赤口: '偏口舌冲突，先避争执再看进展',
    小吉: '偏渐进有助力，适合小步推进并复盘',
    空亡: '偏落空或未成形，宜等条件明确后再动',
  };
  const { sequence } = data;

  return [
    `起因${sequence.start.name}：${timingMap[sequence.start.name]}`,
    `过程${sequence.process.name}：${timingMap[sequence.process.name]}`,
    `结果${sequence.result.name}：${timingMap[sequence.result.name]}`,
    `结果宫${data.primary.name}：宫位倾向${data.primary.tendency}，只适合短期复盘，不作长期命运定论`,
  ].join('；');
}

function createXiaoliurenReviewEvidence(data: XiaoliurenData) {
  const { sequence } = data;

  return [
    `先核实起因${sequence.start.name}所示情境是否已出现`,
    `过程若符合${sequence.process.name}的宫位含义，说明卡点已显化`,
    `结果以${sequence.result.name}的宫位含义作为短期复盘指标`,
    `结果宫${data.primary.name}只给近事观察，不延伸为长期定局`,
  ].join('；');
}

function createXiaoliurenActionLevelEvidence(data: XiaoliurenData) {
  const levelMap: Record<XiaoliurenPalaceDetail['tendency'], string> = {
    宜推进: '可推进：可以行动，但仍要按起因、过程、结果三段逐步验证',
    有助力: '稳步推进：有助力但不宜贪快，先拿小结果',
    宜等待: '宜等待：先补条件或等信号，不宜强推',
    易反复: '降速整理：先处理旧账和牵扯，再看是否推进',
    易争执: '先控风险：先止争执、降情绪，再谈推进',
    易落空: '暂缓确认：条件未成形，先观察再决定',
  };

  return `${levelMap[data.primary.tendency]}；结果宫${data.primary.name}只给近事行动等级，不延伸为长期定局`;
}

function createXiaoliurenReviewWindowEvidence(data: XiaoliurenData) {
  return [
    `先观察起因${data.sequence.start.name}是否已出现`,
    `再看过程${data.sequence.process.name}对应卡点是否显化`,
    `最后用结果${data.sequence.result.name}验证短期走向`,
    '若【问题】给出目标期限，以目标期限内复盘为准；未给期限时只给短期近事观察，不换算绝对日期',
  ].join('；');
}

function formatLiuyaoInfo(
  data: LiuyaoData,
  topic: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' = 'general',
) {
  const movingYaos = data.changingYaos?.length
    ? data.changingYaos
        .map((item) => `第${item.position}爻${item.type ? `（${item.type}）` : ''}`)
        .join('、')
    : '无动爻';
  const worldYao = data.yaosDetail.find((item) => item.isWorld);
  const responseYao = data.yaosDetail.find((item) => item.isResponse);
  const changingLines = data.yaosDetail
    .filter((item) => item.isChanging)
    .map((item) => {
      const changedText = item.changedYao
        ? `化${item.changedYao.liuqin}${item.changedYao.dizhi}${item.changedYao.wuxing}${item.changedYao.isVoid ? '（变空）' : ''}${item.changeDirection ? `（${item.changeDirection}）` : ''}${item.changeRelation ? `（${item.changeRelation}）` : ''}`
        : '无变爻资料';
      const breakText = item.isDayBreak
        ? item.isHiddenMove
          ? '（暗动）'
          : '（日破）'
        : item.isMonthBreak
          ? '（月破）'
          : '';
      return `${formatLiuyaoYaoBrief(item)}${item.isVoid ? '（空）' : ''}${breakText}${changedText}`;
    });
  const voidYaoText = data.yaosDetail
    .filter((item) => item.isVoid || item.changedYao?.isVoid)
    .map((item) => {
      const parts = [
        item.isVoid ? '本爻空亡' : '',
        item.changedYao?.isVoid ? '变爻空亡' : '',
      ].filter(Boolean);
      return `${formatLiuyaoYaoBrief(item)}（${parts.join('、')}）`;
    });
  const hiddenSpiritText = data.hiddenSpirits?.length
    ? data.hiddenSpirits.map(formatHiddenSpirit).join('；')
    : '本卦六亲齐备或本宫首卦无可伏之神';
  const hexagramRelationText = formatLiuyaoHexagramRelation(data);
  const fanfuRelationText = formatLiuyaoFanFuRelation(data);
  const evidenceAnalysis = analyzeLiuyaoEvidence(data, { topic });
  const structuredEvidence = evidenceAnalysis.promptText;
  const monthDayEvidence = createLiuyaoMonthDayEvidence(data);
  const timingEvidence = createLiuyaoTimingEvidence(data);
  const timingPriorityEvidence = createLiuyaoTimingPriorityEvidence(data);
  const sanheParts = [
    data.sanheWithDay
      ? `日辰${getGanzhiBranch(data.ganzhi.day)}引动${data.sanheWithDay.group}（${data.sanheWithDay.members.join('、')}）`
      : '',
    data.sanheWithMonth
      ? `月建${getGanzhiBranch(data.ganzhi.month)}引动${data.sanheWithMonth.group}（${data.sanheWithMonth.members.join('、')}）`
      : '',
  ].filter(Boolean);
  const sanheDetail = sanheParts.length
    ? `三合局盘面事实：${sanheParts.join('；')}；传统上视为合局条件较集中，是否形成有效助力须结合合局五行旺衰、世应用神与现实进展复核`
    : null;
  const sanxingDetail = data.sanxingInYaos?.length
    ? `三刑盘面事实：${data.sanxingInYaos.map((s) => `${s.branches.join('、')}构成${s.type}`).join('；')}；传统类象提示纠缠、对立或反复，但须先看合冲能否解刑并以现实资料复核`
    : null;
  const guaShenDetail = data.guaShen
    ? `卦身盘面事实：月卦身在${data.guaShen.branch}，${data.guaShen.sixRelative}临第${data.guaShen.position}爻；传统上可作为事项线索，不证明事情真伪或结果`
    : null;
  const worldSymbol = worldYao
    ? evidenceAnalysis.traditionalSymbols.find((item) => item.relative === worldYao.sixRelative)
    : undefined;
  const focusParts = [
    worldYao ? `世爻在第${worldYao.position}爻` : '世爻未知',
    responseYao ? `应爻在第${responseYao.position}爻` : '应爻未知',
    `动爻${movingYaos}`,
    `空亡${data.voidBranches?.join('、') || '无'}`,
    data.specialPattern ? `卦式${data.specialPattern}` : '',
    data.palaceStage ? `八宫卦位：${data.palaceStage}` : '',
    hexagramRelationText ? `整卦关系：${hexagramRelationText}` : '',
    fanfuRelationText ? `反伏关系：${fanfuRelationText}` : '',
    worldYao ? `六亲持世：${worldYao.sixRelative}` : '',
    data.guaShen ? `卦身在${data.guaShen.branch}` : '',
  ].filter(Boolean);
  return [
    '占法：六爻',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}${data.palace?.name ? `（${data.palace.name}宫）` : ''}；变卦${data.changedName || '无'}；互卦${data.interName || '无'}`,
    `关键提示：空亡${data.voidBranches?.join('、') || '无'}；动爻${movingYaos}；世应${worldYao ? `世爻在第${worldYao.position}爻` : '世爻未知'}、${responseYao ? `应爻在第${responseYao.position}爻` : '应爻未知'}；特殊卦式${data.specialPattern || '常规卦'}`,
    data.palaceStage ? `八宫卦位：${data.palaceStage}` : '',
    hexagramRelationText ? `整卦关系：${hexagramRelationText}` : '',
    fanfuRelationText ? `反伏关系：${fanfuRelationText}` : '',
    worldYao
      ? `六亲持世盘面事实：第${worldYao.position}爻${worldYao.sixRelative}持世${worldSymbol ? `；${worldSymbol.promptText}；边界：${worldSymbol.limitation}` : '；六亲类象须结合具体问题取用，不单独生成现实结论'}`
      : '',
    `断卦抓手：${focusParts.join('；')}`,
    `主轴证据：${worldYao ? `世爻${formatLiuyaoYaoBrief(worldYao)}` : '世爻未知'}；${responseYao ? `应爻${formatLiuyaoYaoBrief(responseYao)}` : '应爻未知'}；${changingLines.length ? `动变${changingLines.join('、')}` : '无动变，以静卦世应用神为主'}`,
    structuredEvidence,
    `辅助证据：${voidYaoText.length ? `空亡爻位${voidYaoText.join('、')}` : `空亡${data.voidBranches?.join('、') || '无'}未直接落到本卦爻位`}；伏神${hiddenSpiritText}`,
    `月日触发：${monthDayEvidence}`,
    `应期候选：${timingEvidence}`,
    `应期优先级：${timingPriorityEvidence}`,
    data.specialAdvice
      ? `补充提示（传统辅助、非事实结论）：${conditionLiuyaoTraditionalText(data.specialAdvice)}`
      : '',
    sanheDetail || sanxingDetail || guaShenDetail ? '组合时机：' : '',
    sanheDetail ? sanheDetail : '',
    sanxingDetail ? sanxingDetail : '',
    guaShenDetail ? guaShenDetail : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatMeihuaInfo(data: MeihuaData) {
  const calculation = data.calculation;
  const methodLabel = getMeihuaMethodLabel(calculation);
  const processHexagram = data.interHexagram?.name || data.interName || '无';
  const resultHexagram = data.changedHexagram?.name || data.changedName || '无';
  const changedTiYongText =
    data.changedTiGua && data.changedYongGua
      ? `；变后体卦${data.changedTiGua.name}（${data.changedTiGua.element}）；变后用卦${data.changedYongGua.name}（${data.changedYongGua.element}）；变后体用${data.analysis.changedTiYongRelation}`
      : '';
  const timingEvidence = createMeihuaTimingEvidence(data);
  const symbolEvidence = createMeihuaSymbolEvidence(data);
  const evidenceAnalysis = data.evidenceAnalysis?.traditionalFacts
    ? data.evidenceAnalysis
    : analyzeMeihuaEvidence(data);
  const timingPriorityEvidence = createMeihuaTimingPriorityEvidence(data);
  const yaoLines = [...data.yaosDetail]
    .sort((a, b) => b.position - a.position)
    .map((item) => {
      const fact = evidenceAnalysis.traditionalFacts.find(
        (candidate) =>
          candidate.stage === '主卦' &&
          candidate.kind === '爻辞' &&
          candidate.yaoPosition === item.position,
      );
      return item.isChanging
        ? `- 第${item.position}爻（动，属${item.tiYong}）：${item.yaoType}爻；${fact?.promptText ?? '未附可核验爻辞资料'}；边界：${fact?.limitation ?? '动爻传统解释须结合体用与现实资料复核'}`
        : `- 第${item.position}爻（静，属${item.tiYong}）：${item.yaoType}爻；未发动，不展开爻辞解释`;
    });
  const descriptionFact = (stage: '主卦' | '互卦' | '变卦') =>
    evidenceAnalysis.traditionalFacts.find((fact) => fact.stage === stage && fact.kind === '卦辞');
  const movingYaoFact = evidenceAnalysis.traditionalFacts.find(
    (fact) => fact.applicability === '当前动爻辅助',
  );

  return [
    '占法：梅花易数',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}；互卦${data.interName || '无'}；变卦${data.changedName || '无'}`,
    descriptionFact('主卦') ? `主卦卦辞分类：${descriptionFact('主卦')?.promptText}` : '',
    descriptionFact('互卦') ? `互卦卦辞分类：${descriptionFact('互卦')?.promptText}` : '',
    descriptionFact('变卦') ? `变卦卦辞分类：${descriptionFact('变卦')?.promptText}` : '',
    movingYaoFact ? `动爻传统辅助：${movingYaoFact.promptText}` : '',
    '断卦抓手：先定体用，再看互卦过程、变卦结果与四时旺衰',
    `主轴证据：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${data.analysis.tiYongRelation}`,
    `过程证据：互卦${processHexagram}；互卦体用${data.analysis.inter1Relation}；互上辅助${data.analysis.inter2Relation}`,
    `结果证据：变卦${resultHexagram}${changedTiYongText}；结果关系${data.analysis.changedRelation}`,
    evidenceAnalysis.promptText,
    `辅助证据：四时${data.analysis.season}季，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}；起卦法${methodLabel}${typeof calculation?.number === 'number' ? `；起卦数字${calculation.number}` : ''}`,
    `应期候选：${timingEvidence}`,
    `应期优先级：${timingPriorityEvidence}`,
    `类象边界：${symbolEvidence}`,
    '结构明细：',
    `- 四时旺衰：${data.analysis.season}季，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}`,
    `- 体用关系：${data.analysis.tiYongRelation}`,
    `- 过程关系：互卦体用${data.analysis.inter1Relation}，互上辅助${data.analysis.inter2Relation}`,
    `- 结果关系：${data.analysis.changedRelation}`,
    data.changedTiGua && data.changedYongGua
      ? `- 变后体用：体卦${data.changedTiGua.name}（${data.changedTiGua.element}），用卦${data.changedYongGua.name}（${data.changedYongGua.element}），关系${data.analysis.changedTiYongRelation}`
      : '',
    ...yaoLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatXiaoliurenInfo(data: XiaoliurenData) {
  const sequence = data.sequence;
  const evidenceAnalysis = data.evidenceAnalysis ?? analyzeXiaoliurenEvidence(data);
  const timingEvidence = createXiaoliurenTimingEvidence(data);
  const reviewEvidence = createXiaoliurenReviewEvidence(data);
  const actionLevelEvidence = createXiaoliurenActionLevelEvidence(data);
  const reviewWindowEvidence = createXiaoliurenReviewWindowEvidence(data);
  const traditionalFact = (palace: XiaoliurenPalaceDetail['name'], kind: '宫位解释' | '传统属性') =>
    evidenceAnalysis.traditionalFacts.find((fact) => fact.palace === palace && fact.kind === kind);
  const palaceLines = (
    [
      ['起因', sequence.start, data.seasonStates?.start],
      ['过程', sequence.process, data.seasonStates?.process],
      ['结果', sequence.result, data.seasonStates?.result],
    ] as const
  ).map(([stage, palace, seasonState]) => {
    const meaningFact = traditionalFact(palace.name, '宫位解释');
    const attributeFact = traditionalFact(palace.name, '传统属性');
    return [
      `- ${stage}：${palace.name}（五行${palace.element || '未提供'}${palace.yinYang ? `，${palace.yinYang}` : ''}）`,
      `关键词${palace.keywords?.join('、') || '未提供'}`,
      `倾向${palace.tendency}`,
      `条件化宫义${meaningFact?.promptText ?? conditionXiaoliurenTraditionalText(palace.meaning)}`,
      seasonState ? `月令${seasonState}` : '',
      attributeFact ? `传统属性${attributeFact.promptText}` : '',
      `建议${palace.advice}`,
      `边界${meaningFact?.limitation ?? '宫位取象只用于当前课式近事复核，不证明现实结果'}`,
    ]
      .filter(Boolean)
      .join('；');
  });

  return [
    '占法：小六壬',
    `时间干支：以【当前时间】为准；农历${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}`,
    `核心结构：起因${sequence.start.name}；过程${sequence.process.name}；结果${sequence.result.name}`,
    `关键提示：起课方式${data.methodLabel}；结果宫${data.primary.name}；宫位倾向${data.tendency}${data.fortune ? `；${conditionXiaoliurenTraditionalText(data.fortune)}` : ''}`,
    '断课抓手：先看结果宫位定主判断，再看起因与过程宫位解释事情为何如此、会如何推进。',
    `主轴证据：起因${sequence.start.name}；过程${sequence.process.name}；结果${sequence.result.name}`,
    data.wuxingRelations
      ? `五行推进证据：起因到过程${data.wuxingRelations.startToProcess}；过程到结果${data.wuxingRelations.processToResult}；${data.wuxingRelations.description}`
      : '',
    evidenceAnalysis.promptText,
    `辅助证据：起因${traditionalFact(sequence.start.name, '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(sequence.start.meaning)}；过程${traditionalFact(sequence.process.name, '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(sequence.process.meaning)}；结果${traditionalFact(sequence.result.name, '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(sequence.result.meaning)}`,
    data.seasonStates
      ? `月令旺衰：起因${data.seasonStates.start}，过程${data.seasonStates.process}，结果${data.seasonStates.result}`
      : '',
    data.direction ? `传统方位类象：${data.direction}；不得单独作为现实行动方向` : '',
    data.shenSha ? `传统神煞标签：${data.shenSha}；不得单独作为现实事件结论` : '',
    `取象提示（传统宫义、非事实结论）：${conditionXiaoliurenTraditionalText(data.questionHint)}`,
    data.yingQi ? `应期参考：${data.yingQi}` : `应期候选：${timingEvidence}`,
    data.timingEvidence?.primaryBasis?.length
      ? `应期主证：${data.timingEvidence.primaryBasis.join('；')}`
      : '',
    data.timingEvidence?.triggerConditions?.length
      ? `应期触发条件：${data.timingEvidence.triggerConditions.join('；')}`
      : '',
    data.timingEvidence?.limitations?.length
      ? `应期限制：${data.timingEvidence.limitations.join('；')}`
      : '',
    `复盘信号：${reviewEvidence}`,
    `行动建议等级：${actionLevelEvidence}`,
    `复盘窗口：${reviewWindowEvidence}`,
    '证据边界：结果宫与三段推进为主证，月令旺衰与五行为辅证，方位、神煞和应期属性不得单独决定吉凶或硬换成绝对日期。',
    '结构明细：',
    `- 起课方式：${data.methodLabel}`,
    ...palaceLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatQimenInfo(data: QimenData) {
  const evidenceAnalysis = data.evidenceAnalysis?.palaceFacts
    ? data.evidenceAnalysis
    : analyzeQimenEvidence(data);
  const zhiFuPalace = data.jiuGongGe.find((item) => item.tianPan.star === data.zhiFu);
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const hourStem = data.ganzhi.hour.charAt(0);
  const hourStemPalaces = data.jiuGongGe.filter(
    (item) => item.tianPan.stem === hourStem || item.diPan.stem === hourStem,
  );
  const voidText = data.voidPalaces?.length
    ? data.voidPalaces.map((item) => `${item.branch}空落${item.name}`).join('、')
    : data.voidBranches?.length
      ? `${data.voidBranches.join('、')}空，落宫未定位`
      : '无';
  const horseText = data.horseStar
    ? `${data.horseStar.sourceBranch}时驿马在${data.horseStar.branch}，落${data.horseStar.name}`
    : '未定位';
  const basicPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '基础格局',
  );
  const patternSummary = basicPatternFacts
    .map((item) => `${item.name}（传统分类、非事实结论）：${item.promptText}`)
    .join('；');
  // 经典格局（九遁、三奇得使等）—— 比一般格局标签更优先的判断依据
  const classicPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '经典格局',
  );
  const classicPatternSummary = classicPatternFacts.length
    ? classicPatternFacts
        .slice(0, 4)
        .map(
          (item) =>
            `${item.name}（传统${item.traditionalTone}分类、非事实结论）：${item.promptText}`,
        )
        .join('；')
    : '';
  // 天地盘干关系（八十一格精选）—— 取最有代表性的格式
  const stemRelationSummary = data.stemRelations?.length
    ? data.stemRelations
        .filter(
          (item) =>
            item.pattern &&
            /青龙返首|飞鸟跌穴|青龙逃走|白虎猖狂|朱雀投江|螣蛇夭矫|荧入太白|太白入荧|大格|小格|刑格|天网四张|地网四张|伏干飞干|伏宫飞宫/.test(
              item.pattern,
            ),
        )
        .slice(0, 4)
        .map(
          (item) =>
            `${item.heavenStem}${item.earthStem}落${item.gong}宫：${item.relation}，${item.pattern}`,
        )
        .join('；')
    : '';
  // 方位建议只保留方向、用途和依据，不向提示词暴露内部排序分数。
  const directionSummary = data.directions?.goodDirections?.length
    ? `吉方${data.directions.goodDirections
        .slice(0, 3)
        .map((d) => `${d.direction}（${d.name}：${d.use}）`)
        .join('、')}${
        data.directions.avoidDirections?.length
          ? `；避${data.directions.avoidDirections
              .slice(0, 2)
              .map((d) => d.direction)
              .join('、')}`
          : ''
      }`
    : '';
  const seasonalitySummary = data.seasonality
    ? [
        `${data.seasonality.currentJieQi}${data.seasonality.jieQiPhase.phase}`,
        `节气五行${data.seasonality.seasonalElement || '未知'}`,
        `日干${data.seasonality.dayStem}${data.seasonality.seasonRelation}`,
        `月相${data.seasonality.lunarPhaseDetail || data.seasonality.lunarPhase}`,
        `建除${data.seasonality.dayOfficer}${data.seasonality.dayOfficerFortuneLabel}`,
      ].join('；')
    : '';
  const ganzhiInteractionSummary = data.seasonality?.ganzhiInteractions?.length
    ? data.seasonality.ganzhiInteractions
        .slice(0, 5)
        .map((item) => `${item.type}${item.values.join('、')}`)
        .join('；')
    : '';
  const comboPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '复合格局',
  );
  const patternComboSummary = comboPatternFacts.length
    ? comboPatternFacts
        .slice(0, 4)
        .map((item) => {
          const tone =
            item.traditionalTone === '有利'
              ? '支持条件集中'
              : item.traditionalTone === '风险'
                ? '限制条件集中'
                : '支持与限制并见';
          return `${item.name}（${tone}、非事实结论）：${item.promptText}`;
        })
        .join('；')
    : '';
  const specialConditionsText = data.specialConditions?.description?.trim()
    ? conditionQimenTraditionalText(data.specialConditions.description.trim())
    : '';
  const primaryCandidate = evidenceAnalysis.candidates[0];
  const focusParts = [
    `值符${data.zhiFu}`,
    `值使${data.zhiShi}`,
    `${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局`,
    data.patternTags?.length ? `格局${data.patternTags.join('、')}` : '',
    primaryCandidate ? `先看${primaryCandidate.name}` : '',
  ].filter(Boolean);

  return [
    '占法：奇门遁甲',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符${data.zhiFu}；值使${data.zhiShi}`,
    `关键提示：节令${`${data.timeInfo?.solarTerm || '未知'} ${data.timeInfo?.epoch || ''}`.trim()}；格局标签${data.patternTags?.join('、') || '无'}`,
    seasonalitySummary ? `节令背景：${seasonalitySummary}` : '',
    data.seasonality?.jieQiPhase.solarTermEvidence
      ? data.seasonality.jieQiPhase.solarTermEvidence.promptText
      : '',
    data.seasonality?.moonPhaseEvidence ? data.seasonality.moonPhaseEvidence.promptText : '',
    data.seasonality && !data.seasonality.lunarPhaseConsistency
      ? `月相口径提示：历法八相为${data.seasonality.lunarPhaseDetail}，日月黄经八分法为${data.seasonality.moonPhaseEvidence.eightPhaseName}；临界时刻应优先查看相位角与前后朔弦望时刻，不强行合并名称。`
      : '',
    ganzhiInteractionSummary ? `四柱互动：${ganzhiInteractionSummary}` : '',
    `起局抓手：${focusParts.join('；')}`,
    `主轴证据：值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '落宫未定位'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '落宫未定位'}；时干${hourStem}${hourStemPalaces.length ? `见于${hourStemPalaces.map((item) => item.name).join('、')}` : '落宫未定位'}`,
    evidenceAnalysis.promptText,
    `辅助证据：旬空${voidText}；马星${horseText}`,
    specialConditionsText ? `特殊时辰：${specialConditionsText}` : '',
    patternSummary ? `判断依据：${patternSummary}` : '',
    classicPatternSummary ? `经典格局：${classicPatternSummary}` : '',
    patternComboSummary ? `复合格局：${patternComboSummary}` : '',
    stemRelationSummary ? `天地盘干：${stemRelationSummary}` : '',
    directionSummary ? `方位吉凶：${directionSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLiurenInfo(data: LiurenData) {
  const evidenceAnalysis = analyzeLiurenEvidence(data);
  const traditionalFacts = evidenceAnalysis.traditionalFacts;
  const firstTransmission = data.threeTransmissions[0];
  const lastTransmission = data.threeTransmissions[2];
  const lessonText = data.fourLessons
    .map((item) => `${item.name}${item.upper}临${item.lower}乘${item.god}，${item.relation}`)
    .join('；');
  const transmissionText = data.threeTransmissions
    .map(
      (item) =>
        `${item.stage}${item.branch}乘${item.god}，${item.relation}，${conditionLiurenTraditionalText(item.note)}`,
    )
    .join('；');
  const voidHits = data.threeTransmissions
    .filter((item) => data.xunKong?.includes(item.branch))
    .map((item) => `${item.stage}${item.branch}`);
  const summaryText = [data.lessonSummary, data.transmissionSummary, data.transmissionDetail]
    .filter(Boolean)
    .map((item) => conditionLiurenTraditionalText(item || ''))
    .join('；');
  const mainLineText = [
    data.transmissionRule ? `取传${data.transmissionRule}` : '',
    data.transmissionPattern ? `传态${data.transmissionPattern}` : '',
    firstTransmission ? `发用${firstTransmission.branch}乘${firstTransmission.god}` : '',
    lastTransmission ? `末传${lastTransmission.branch}` : '',
  ].filter(Boolean);
  const noblemanGroundBranch =
    data.noblemanGroundBranch ||
    data.heavenlyPlate.find((item) => item.branch === data.noblemanBranch)?.under ||
    '';
  const noblemanText = data.noblemanBranch
    ? `贵人${data.noblemanBranch}${noblemanGroundBranch ? `临${noblemanGroundBranch}` : ''}`
    : '';
  const plateSummaryText = [
    `月将${data.monthLeader}`,
    `占时${data.divinationBranch}`,
    data.dayNight || '',
    noblemanText,
    data.xunKong?.length ? `旬空${data.xunKong.join('、')}` : '',
  ].filter(Boolean);
  const heavenlyPlateText = data.heavenlyPlate
    .map((item) => `${item.under}上${item.branch}乘${item.god}`)
    .join('；');
  const classicalRuleText = traditionalFacts.some((item) => item.kind === '经典取传规则')
    ? traditionalFacts
        .filter((item) => item.kind === '经典取传规则')
        .map((item) => `${item.sources.join('、')}：${item.name}，${item.promptText}`)
        .join('；')
    : '';
  const guaTiText = data.guaTi?.length ? data.guaTi.join('、') : '';
  const guaTiSection = guaTiText
    ? `课体标签：${guaTiText}；只表示盘面结构类别，须与四课取传、三传、旺衰和空亡互证，不单独作吉凶结论`
    : '';
  const tianJiangContext = traditionalFacts
    .filter((item) => item.kind === '天将属性')
    .map(
      (item) =>
        `${item.stages?.join('、') || ''}${item.name}：${item.promptText}；边界：${item.limitation}`,
    );
  const tianJiangSection = tianJiangContext?.length
    ? `天将属性：${tianJiangContext.join('；')}`
    : '';
  const shenShaCategorized = traditionalFacts
    .filter((item) => item.kind === '神煞')
    .map((item) => `${item.promptText}；边界：${item.limitation}`)
    .join('；');

  return [
    '占法：大六壬',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：盘面摘要：${plateSummaryText.join('；')}`,
    data.earthlyPlate?.length ? `地盘：${data.earthlyPlate.join('、')}` : '',
    heavenlyPlateText ? `天盘：${heavenlyPlateText}` : '',
    data.dayStemResidence ? `日干寄宫：${data.ganzhi.day.charAt(0)}寄${data.dayStemResidence}` : '',
    mainLineText.length ? `课传主线：${mainLineText.join('；')}` : '',
    classicalRuleText ? `古籍依据：${classicalRuleText}` : '',
    guaTiSection,
    lessonText ? `四课：${lessonText}` : '',
    transmissionText ? `三传：${transmissionText}` : '',
    tianJiangSection,
    shenShaCategorized ? `神煞：${shenShaCategorized}` : '',
    evidenceAnalysis.promptText,
    evidenceAnalysis.timingEvidence.length
      ? `应期优先级：${evidenceAnalysis.timingEvidence
          .map(conditionLiurenTraditionalText)
          .join('；')}`
      : '',
    data.xunKong?.length
      ? `旬空：${data.xunKong.join('、')}${voidHits.length ? `，命中${voidHits.join('、')}；传统上提示该阶段线索尚未落实，须待填实并结合现实进展复核` : ''}`
      : '',
    summaryText ? `简要提示：${summaryText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatTarotInfo(data: TarotData) {
  const evidenceAnalysis = data.evidenceAnalysis?.traditionalFacts
    ? data.evidenceAnalysis
    : analyzeTarotEvidence(data);
  const cardLines = data.cards.map((card, index) => {
    const fact = evidenceAnalysis.traditionalFacts.find((item) => item.index === index + 1);
    return `- ${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}；关键词：${card.keywords.join('、') || '未提供'}${card.element ? `；元素主题：${card.element}` : ''}${card.archetype ? `；牌阶主题：${card.archetype}` : ''}${fact ? `；条件化牌义：${fact.promptText}；边界：${fact.limitation}` : ''}`;
  });

  return [
    '占法：塔罗',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    '断牌口径：按当前牌阵、牌位、牌名和正逆位解读；牌阵未限定专项时按通用断牌。',
    `判断主轴：按“${data.cards.map((card) => card.position).join(' → ')}”的牌位顺序组织现状、变化与建议；每张牌必须同时结合牌位、关键词和正逆位取证。`,
    '证据边界：牌位与牌面为主证，关键词用于限定可解释范围；正逆位必须结合牌位和整组牌势判断，不套用孤立的固定断语。',
    '现实边界：塔罗只能给当下倾向、心理动力、互动节奏和行动建议；未给期限时不把牌义硬换成绝对日期，也不替代医疗、法律或财务事实。',
    evidenceAnalysis.promptText,
    '牌位明细：',
    ...cardLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSsgwInfo(data: SsgwData) {
  const evidenceAnalysis = data.evidenceAnalysis ?? analyzeSsgwEvidence(data);
  if (data.ritual?.rejected) {
    const throwLog = data.ritual.throws.map((t) => t.result).join(' → ');
    return (
      '占法：三山国王灵签\n' +
      `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}\n` +
      `掷筊记录：${throwLog}\n` +
      `结果：${data.ritual.reason}\n\n` +
      '本次没有形成可解释签文，不根据已抽出的签号、签题或签诗生成结论。\n' +
      `【仪式与证据边界】\n${evidenceAnalysis.ritualFacts.join('；')}。\n` +
      `${evidenceAnalysis.randomFacts.join('；')}。\n` +
      `【限制】${evidenceAnalysis.limitations.join('；')}`
    );
  }

  const { canonicalStory, extraStory } = resolveSsgwStoryContent(data);
  const promptCanonicalStory = canonicalStory
    ? conditionSsgwInterpretation(canonicalStory)
    : evidenceAnalysis.promptStory;
  const promptExtraStory = extraStory ? conditionSsgwInterpretation(extraStory) : '';
  const ritualLog = data.ritual?.throws?.length
    ? `掷筊记录：${data.ritual.throws.map((t) => t.result).join(' → ')}${data.ritual.reason ? `（${data.ritual.reason}）` : ''}`
    : '';
  const interpretationFields = [
    '核心寓意',
    '事业',
    '财运',
    '感情',
    '学业',
    '健康',
    '行动建议',
    '风险提醒',
  ];
  const preferredFields = ['吉凶', ...interpretationFields].filter((key) =>
    evidenceAnalysis.interpretations.some((item) => item.field === key),
  );
  const selectedInterpretations =
    preferredFields.length > 1
      ? preferredFields
          .map((field) => evidenceAnalysis.interpretations.find((item) => item.field === field))
          .filter((item): item is NonNullable<typeof item> => Boolean(item))
      : evidenceAnalysis.interpretations;
  const detailLines = selectedInterpretations.map(
    (item) =>
      `- ${item.field}（传统辅助、非事实结论）：${item.promptText || conditionSsgwInterpretation(item.originalText || item.text)}`,
  );

  return [
    '占法：三山国王灵签',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：第${data.number}签；签题《${data.title}》`,
    '断签口径：按【问题】、签诗原文、典故和八类签意解读，先抓核心寓意，再对应现实事项。',
    '证据口径：签诗原文为主证，典故与分类条目为辅证；不得由签号或诗句数字推算绝对日期。',
    ritualLog,
    `签诗：${data.poem}`,
    promptCanonicalStory ? `典故（传统类比、非事实结论）：${promptCanonicalStory}` : '',
    promptExtraStory ? `补充提示（条件化表达）：${promptExtraStory}` : '',
    detailLines.length ? '签文条目（条件化传统释义）：' : '',
    ...detailLines,
    evidenceAnalysis.promptText,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatAlmanacAnnualDirectionGods(
  candidate: ReturnType<typeof analyzeAlmanacEvidence>['candidates'][number] | undefined,
) {
  const gods = candidate?.traditionalFacts.filter((fact) => fact.kind === '全年方位神') ?? [];
  if (!gods.length) return '';

  const importantBadGods = new Set([
    '太岁',
    '岁破',
    '丧门',
    '官符',
    '死符',
    '白虎',
    '吊客',
    '病符',
  ]);
  const helpfulGods = new Set(['太阳', '太阴', '龙德', '福德']);
  const importantBad = gods
    .filter((god) => importantBadGods.has(god.name))
    .map((god) => `${god.name}${god.branch}${god.direction}`);
  const helpful = gods
    .filter((god) => helpfulGods.has(god.name))
    .map((god) => `${god.name}${god.branch}${god.direction}`);

  return [
    importantBad.length ? `岁支方位避${importantBad.join('、')}` : '',
    helpful.length ? `可参考${helpful.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('；');
}

function formatAlmanacInfo(data: AlmanacData) {
  const evidenceAnalysis = analyzeAlmanacEvidence(data);
  const topDays = data.days.slice(0, 8);
  const participantLines = data.participants.map((item) => {
    const usefulEvidenceAvailable =
      item.usefulGods.length > 0 && item.usefulGods.length <= 3 && item.avoidGods.length > 0;
    const useful = usefulEvidenceAvailable
      ? `喜用参考${item.usefulGods.join('、')}，忌神参考${item.avoidGods.join('、')}`
      : '喜忌结论过于分散，不用于本次候选判断';
    return `- ${item.name}：${item.gender || '性别未填'}，公历${item.solarDate}，农历${item.lunarDate}，生肖${item.zodiac}，日主${item.dayMaster}${item.dayMasterElement}，四柱${item.pillars.year}年 ${item.pillars.month}月 ${item.pillars.day}日 ${item.pillars.hour}时，${useful}`;
  });
  const dayLines = topDays.map((item, index) => {
    const candidate = evidenceAnalysis.candidates.find(
      (candidateItem) => candidateItem.date === item.date,
    );
    const starFact = candidate?.traditionalFacts.find((fact) => fact.kind === '二十八宿');
    const nineStarFact = candidate?.traditionalFacts.find((fact) => fact.kind === '九星');
    const starDetail = starFact
      ? `（${starFact.promptText}；边界：${starFact.limitation}）`
      : item.twentyEightStarDetail
        ? `（${conditionAlmanacTraditionalText(item.twentyEightStarDetail.meaning)}）`
        : '';
    const nineStarDetail = nineStarFact
      ? `（${nineStarFact.promptText}；边界：${nineStarFact.limitation}）`
      : item.nineStarDetail
        ? `（${conditionAlmanacTraditionalText(item.nineStarDetail.meaning)}）`
        : '';
    const godText = item.gods.length ? `吉神${item.gods.join('、')}` : '';
    const annualDirectionGodsText = formatAlmanacAnnualDirectionGods(candidate);
    const evidence = [
      `宜${item.recommends.slice(0, 8).join('、') || '无'}`,
      `忌${item.avoids.slice(0, 8).join('、') || '无'}`,
      godText,
      annualDirectionGodsText,
      item.highlights.length ? `支持${item.highlights.join('、')}` : '',
      item.cautions.length ? `风险${item.cautions.join('、')}` : '',
      item.participantNotes.length ? `参与人${item.participantNotes.join('；')}` : '',
      item.bestHours?.length
        ? `建议时辰${item.bestHours
            .map(
              (hour) =>
                `${hour.name}${hour.range}（${hour.ganzhi}、${hour.twelveStar}；${hour.highlights.join('、') || '未见独立增强证据'}${hour.cautions.length ? `；风险${hour.cautions.join('、')}` : ''}）`,
            )
            .join('、')}`
        : '未筛出证据足够的建议时辰',
    ].filter(Boolean);
    const status = candidate?.status;
    return `- 第${index + 1}候选：${item.date} ${item.weekday}${status ? `，${status}` : ''}，${item.lunarDate}，${item.ganzhi.year}年 ${item.ganzhi.month}月 ${item.ganzhi.day}日；${item.dayOfficer}执日，十二神${item.twelveStar}，二十八宿${item.twentyEightStar}${starDetail}，九星${item.nineStar}${nineStarDetail}，${item.clash}；${evidence.join('；')}`;
  });
  const bestDay = topDays[0];
  const backupDays = topDays.slice(1, 3);
  const topicScopeEvidence =
    data.topic === 'custom'
      ? '事项未限定，按通用黄历取舍；补充的具体事项只作现实背景'
      : `事项范围：${data.topicLabel}；按该事项和候选日期证据处理`;
  const participantFitEvidence = data.participants.length
    ? data.participants
        .map((participant) => {
          const relatedNotes = topDays
            .flatMap((day) =>
              day.participantNotes
                .filter((note) => note.includes(participant.name))
                .map((note) => `${day.date}${note}`),
            )
            .slice(0, 3);
          const usefulEvidenceAvailable =
            participant.usefulGods.length > 0 &&
            participant.usefulGods.length <= 3 &&
            participant.avoidGods.length > 0;
          const usefulText = usefulEvidenceAvailable
            ? `喜用${participant.usefulGods.join('、')}，忌神${participant.avoidGods.join('、')}`
            : '喜忌结论分散，不用于候选判断';
          return `${participant.name}：日主${participant.dayMaster}${participant.dayMasterElement}，${usefulText}；${relatedNotes.join('；') || '候选日期未见直接参与人刑冲破害提醒'}`;
        })
        .join('；')
    : '未给出参与人八字，不能编造个人适配，只按通用黄历规则判断';
  const realityConstraintEvidence = [
    '现实刚性约束包括场地、证件、人员到场、交通、预算、天气和办理窗口',
    '已提供资料未给现实时不得编造；若补充现实条件与传统排序冲突，应说明为什么现实约束优先',
  ].join('；');
  const availableWindowEvidence = [
    `只允许在${data.startDate}至${data.endDate}范围内排序`,
    bestDay?.bestHours?.length
      ? `首选日可用时辰先看${bestDay.bestHours.map((hour) => `${hour.name}${hour.range}`).join('、')}`
      : '首选日未筛出证据足够的具体时辰，不硬指吉时',
    bestDay
      ? `首选窗口先看${bestDay.date}，备选看${backupDays.map((item) => item.date).join('、') || '暂无'}`
      : '',
  ]
    .filter(Boolean)
    .join('；');

  return [
    '占法：黄历择日',
    `核心结构：择日事项：${data.topicLabel}；候选日期：${data.startDate} 至 ${data.endDate}；先按黄历宜忌、神煞、冲煞与参与人刑冲破害做初筛`,
    bestDay
      ? `初筛结论：当前首列候选为${bestDay.date}；仍须结合证据分组与现实约束复核`
      : '初筛结论：暂无候选日期',
    '择日抓手：先排除直接冲犯和忌项明显命中的日期，再比较宜项、吉神、执日、星宿与参与人日主喜忌。',
    `事项口径：${topicScopeEvidence}`,
    `参与人适配：${participantFitEvidence}`,
    evidenceAnalysis.promptText,
    `现实约束：${realityConstraintEvidence}`,
    `可用时段边界：${availableWindowEvidence}`,
    participantLines.length ? '参与人八字参考：' : '参与人八字参考：未给出，只能按通用黄历规则判断',
    ...participantLines,
    '候选日期明细：',
    ...dayLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLenormandInfo(data: LenormandData) {
  const evidenceAnalysis =
    data.evidenceAnalysis?.traditionalFacts && data.evidenceAnalysis.structuredLayoutFacts
      ? data.evidenceAnalysis
      : analyzeLenormandEvidence(data);
  return [
    '占法：雷诺曼',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    '断牌口径：按当前牌阵、牌位、牌名和牌义解读；单牌或未限定专项时按通用断牌。',
    `牌序主轴：按“${data.cards.map((card) => card.position).join(' → ')}”读取事件推进；先看各牌牌位和关键词，再看相邻牌能否构成上方已经列出的组合。`,
    '组合证据：优先使用标注为“固定组合”的条目；“相邻合读”只表示牌序衔接，不得冒充传统固定组合。',
    '现实边界：雷诺曼只描述当前事件线索、关系和行动条件；不得把单牌或单一组合写成必然结果，也不得替代可核验的现实资料。',
    evidenceAnalysis.promptText,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatAstrolabeInfo(data: AstrolabeData) {
  const evidenceAnalysis =
    data.evidenceAnalysis?.positionFacts && data.evidenceAnalysis.aspectFacts
      ? data.evidenceAnalysis
      : analyzeAstrolabeEvidence(data);
  const describeAspectCloseness = (item: AstrolabeData['aspects'][number]) => {
    if (item.closeness) return item.closeness;
    const ratio = item.normalizedOrbRatio ?? 1;
    return ratio <= 1 / 3 ? '紧密' : ratio <= 2 / 3 ? '中等' : '宽松';
  };
  const sun = data.planets.find((item) => item.name === 'Sun');
  const moon = data.planets.find((item) => item.name === 'Moon');
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const aspectSummary = data.aspects
    .slice(0, 3)
    .map(
      (item) =>
        `${item.body1}${item.symbol}${item.body2}（${item.type}，${describeAspectCloseness(item)}等级）`,
    )
    .join('；');

  return [
    '占法：星盘',
    `出生信息：${data.birth.name}，${data.birth.gender || '性别未填'}，${data.birth.dateTime}，位置${data.birth.location}，时区 UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    `核心结构：太阳${sun?.formatted || '未知'}；月亮${moon?.formatted || '未知'}；上升${ascendant?.formatted || '未知'}；共${data.planets.length}颗星体、${data.houses.length}个宫位、${data.aspects.length}组主要相位`,
    `关键提示：逆行星体${data.summary.retrograde.join('、') || '无'}；格局${data.summary.patterns.join('、') || '未见明显格局'}`,
    `主轴证据：太阳${sun?.formatted || '未知'}；月亮${moon?.formatted || '未知'}；上升${ascendant?.formatted || '未知'}；辅助证据：${aspectSummary || '主要相位未见强证据'}`,
    evidenceAnalysis.promptText,
    data.solarIllumination?.promptText || '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatTaiyiInfo(data: TaiyiResult) {
  const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计', minute: '分计' }[
    data.scope
  ];
  return [
    `占法：太乙神数（${scopeLabel}）`,
    `起局时间：${data.dateTime}；本计干支：${data.ganZhi}；${data.accumulatedLabel}：${data.accumulatedValue}`,
    `第${data.yuan}元、第${data.ji}纪；${data.yinYang}第${data.bureau}局`,
    `太乙：${data.taiyiPosition}（第${data.taiyiPalace}宫，${data.taiyiGua}卦，${data.taiyiDir}）`,
    `文昌（主目）：${data.wenChangPosition}；始击（客目）：${data.shiJiPosition}；计神：${data.jiShenPosition}`,
    `主客定算：主算${data.lordCount}；客算${data.guestCount}；定算${data.setCount}`,
    `将参：主大${data.lordGeneral}、主参${data.lordAssistant}；客大${data.guestGeneral}、客参${data.guestAssistant}；定大${data.setGeneral}、定参${data.setAssistant}`,
    `判断：${data.judgments.join('；')}`,
    `模型：${data.model.name}；${data.model.precision}`,
    `十六神：${data.sixteenGods.map((item) => `${item.branch}${item.god}`).join('、')}`,
    data.evidenceAnalysis?.promptText || '',
  ].join('\n');
}

export function formatDivinationInfo(
  method: Exclude<DivinationMethodId, 'random'>,
  data: DivinationData,
  _question: string,
  _supplementaryInfo?: SupplementaryInfo,
  options?: { liuyaoTemplate?: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' },
) {
  switch (method) {
    case 'liuyao':
      return formatLiuyaoInfo(data as LiuyaoData, options?.liuyaoTemplate);
    case 'meihua':
      return formatMeihuaInfo(data as MeihuaData);
    case 'xiaoliuren':
      return formatXiaoliurenInfo(data as XiaoliurenData);
    case 'qimen':
      return formatQimenInfo(data as QimenData);
    case 'liuren':
      return formatLiurenInfo(data as LiurenData);
    case 'tarot':
      return formatTarotInfo(data as TarotData);
    case 'ssgw':
      return formatSsgwInfo(data as SsgwData);
    case 'almanac':
      return formatAlmanacInfo(data as AlmanacData);
    case 'lenormand':
      return formatLenormandInfo(data as LenormandData);
    case 'astrolabe':
      return formatAstrolabeInfo(data as AstrolabeData);
    case 'taiyi':
      return formatTaiyiInfo(data as TaiyiResult);
    default:
      return '占卜信息暂不可用';
  }
}
