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
  JinkoujueData,
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
import { analyzeJinkoujueEvidence } from '@core/divination/algorithms/jinkoujue';
import { analyzeTarotEvidence } from '@core/divination/tarot';

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
    return '干支：未给出';
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
    return '未给出';
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
    : '未给出';
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
    return `${label}${branch || '未列'}：${parts.join('，')}`;
  };

  return [
    describeBranchHit('月建', monthBranch, monthClash),
    describeBranchHit('日辰', dayBranch, dayClash),
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
    `动爻第${data.movingYao.position}爻：对应阶段、层位或触发点`,
    `${data.analysis.season}季体卦${data.analysis.tiSeasonState}、用卦${data.analysis.yongSeasonState}`,
    `互卦${data.interName || data.interHexagram?.name || '无'}主过程，变卦${data.changedName || data.changedHexagram?.name || '无'}主结果`,
    numberEvidence,
    timeEvidence ? `时间数：${timeEvidence}` : '',
    `起卦法：${methodLabel}`,
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
  const selectedUsefulGod = evidenceAnalysis.candidates.find(
    (item) => item.key === evidenceAnalysis.selectionFact.selectedCandidateKey,
  );
  const usefulGodMainLine = selectedUsefulGod
    ? `用神主线：${selectedUsefulGod.label}${selectedUsefulGod.relative ? `（${selectedUsefulGod.relative}）` : ''}；${selectedUsefulGod.reason}；盘面匹配${selectedUsefulGod.references.map((item) => `${item.source === '伏神' ? '伏神' : ''}第${item.position}爻${item.sixRelative}${item.branch}${item.wuxing}`).join('、') || '无'}；支持${selectedUsefulGod.support.join('、') || '盘面平稳'}；限制${selectedUsefulGod.constraints.join('、') || '未见明显空破墓退'}`
    : `用神主线：${evidenceAnalysis.selectionFact.promptText}`;
  const godChainText = evidenceAnalysis.godChain.length
    ? `作用链：${evidenceAnalysis.godChain
        .map(
          (item) =>
            `${item.role}${item.wuxing || ''}${item.status === '盘中有对应' ? `见${item.references.map((ref) => `第${ref.position}爻${ref.sixRelative}${ref.branch}${ref.wuxing}`).join('、')}` : '未见'}`,
        )
        .join('；')}`
    : '';
  const monthDayEvidence = createLiuyaoMonthDayEvidence(data);
  const timingEvidence = createLiuyaoTimingEvidence(data);
  const sanheParts = [
    data.sanheWithDay
      ? `日辰${getGanzhiBranch(data.ganzhi.day)}引动${data.sanheWithDay.group}（${data.sanheWithDay.members.join('、')}）`
      : '',
    data.sanheWithMonth
      ? `月建${getGanzhiBranch(data.ganzhi.month)}引动${data.sanheWithMonth.group}（${data.sanheWithMonth.members.join('、')}）`
      : '',
  ].filter(Boolean);
  const sanheDetail = sanheParts.length
    ? `三合局：${sanheParts.join('；')}；传统上视为合局条件较集中`
    : null;
  const sanxingDetail = data.sanxingInYaos?.length
    ? `三刑：${data.sanxingInYaos.map((s) => `${s.branches.join('、')}构成${s.type}`).join('；')}；传统类象为纠缠、对立或反复`
    : null;
  const guaShenDetail = data.guaShen
    ? `卦身：月卦身在${data.guaShen.branch}，${data.guaShen.sixRelative}临第${data.guaShen.position}爻`
    : null;
  const worldSymbol = worldYao
    ? evidenceAnalysis.traditionalSymbols.find((item) => item.relative === worldYao.sixRelative)
    : undefined;
  return [
    '占法：六爻',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}${data.palace?.name ? `（${data.palace.name}宫）` : ''}；变卦${data.changedName || '无'}；互卦${data.interName || '无'}`,
    `关键提示：空亡${data.voidBranches?.join('、') || '无'}；动爻${movingYaos}；世应${worldYao ? `世爻在第${worldYao.position}爻` : '世爻未列'}、${responseYao ? `应爻在第${responseYao.position}爻` : '应爻未列'}；特殊卦式${data.specialPattern || '常规卦'}`,
    data.palaceStage ? `八宫卦位：${data.palaceStage}` : '',
    hexagramRelationText ? `整卦关系：${hexagramRelationText}` : '',
    fanfuRelationText ? `反伏关系：${fanfuRelationText}` : '',
    worldYao
      ? `六亲持世：第${worldYao.position}爻${worldYao.sixRelative}持世${worldSymbol ? `；${worldSymbol.promptText}` : ''}`
      : '',
    usefulGodMainLine,
    godChainText,
    `世应动变：${worldYao ? `世爻${formatLiuyaoYaoBrief(worldYao)}` : '世爻未列'}；${responseYao ? `应爻${formatLiuyaoYaoBrief(responseYao)}` : '应爻未列'}；${changingLines.length ? `动变${changingLines.join('、')}` : '无动变'}`,
    `空亡与伏神：${voidYaoText.length ? `空亡爻位${voidYaoText.join('、')}` : `空亡${data.voidBranches?.join('、') || '无'}未直接落到本卦爻位`}；伏神${hiddenSpiritText}`,
    `月日触发：${monthDayEvidence}`,
    `应期资料：${timingEvidence}`,
    data.specialAdvice ? `补充提示：${conditionLiuyaoTraditionalText(data.specialAdvice)}` : '',
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
  const evidenceAnalysis = data.evidenceAnalysis?.traditionalFacts
    ? data.evidenceAnalysis
    : analyzeMeihuaEvidence(data);
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
        ? `- 第${item.position}爻（动，属${item.tiYong}）：${item.yaoType}爻；${fact?.promptText ?? '未附爻辞资料'}`
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
    `体用：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${data.analysis.tiYongRelation}`,
    `互卦：${processHexagram}；互卦体用${data.analysis.inter1Relation}；互上辅助${data.analysis.inter2Relation}`,
    `变卦：${resultHexagram}${changedTiYongText}；结果关系${data.analysis.changedRelation}`,
    `四时与起卦：${data.analysis.season}季，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}；起卦法${methodLabel}${typeof calculation?.number === 'number' ? `；起卦数字${calculation.number}` : ''}`,
    `应期资料：${timingEvidence}`,
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
      `- ${stage}：${palace.name}${palace.element ? `（五行${palace.element}${palace.yinYang ? `，${palace.yinYang}` : ''}）` : ''}`,
      palace.keywords?.length ? `关键词${palace.keywords.join('、')}` : '',
      `倾向${palace.tendency}`,
      `条件化宫义${meaningFact?.promptText ?? conditionXiaoliurenTraditionalText(palace.meaning)}`,
      seasonState ? `月令${seasonState}` : '',
      attributeFact ? `传统属性${attributeFact.promptText}` : '',
      `建议${palace.advice}`,
    ]
      .filter(Boolean)
      .join('；');
  });

  const stageChartLines = data.stageCharts
    ? (
        [
          ['起因', data.stageCharts.start],
          ['过程', data.stageCharts.process],
          ['结果', data.stageCharts.result],
        ] as const
      ).map(
        ([stage, chart]) =>
          `- ${stage}完整课象：${chart.palace.name}；六亲${chart.relative}；对日主${chart.relationToDay}；月令${chart.seasonState}；支持${chart.support.join('、') || '无'}；限制${chart.constraints.join('、') || '无'}`,
      )
    : [];
  return [
    '占法：小六壬',
    `流派：${data.schoolLabel || (data.school === 'huashan' ? '华山派' : '通行掌诀')}`,
    data.mainLine ? `取用主线：${data.mainLine}` : '',
    `时间干支：${data.ganzhi ? `${data.ganzhi.year}年 ${data.ganzhi.month}月 ${data.ganzhi.day}日 ${data.ganzhi.hour}时` : '以【当前时间】为准'}；农历${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}${data.dayNight ? `；${data.dayNight}` : ''}`,
    data.xunKong?.length || data.yiMa || data.taoHua
      ? `课盘神煞：旬空${data.xunKong?.join('、') || '无'}；年驿马${data.yiMa || '无'}；年桃花${data.taoHua || '无'}`
      : '',
    `核心结构：起因${sequence.start.name}；过程${sequence.process.name}；结果${sequence.result.name}`,
    `关键提示：起课方式${data.methodLabel}；结果宫${data.primary.name}；宫位倾向${data.tendency}${data.fortune ? `；${conditionXiaoliurenTraditionalText(data.fortune)}` : ''}`,
    data.wuxingRelations
      ? `五行推进：起因到过程${data.wuxingRelations.startToProcess}；过程到结果${data.wuxingRelations.processToResult}；${data.wuxingRelations.description}`
      : '',
    `宫位含义：起因${traditionalFact(sequence.start.name, '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(sequence.start.meaning)}；过程${traditionalFact(sequence.process.name, '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(sequence.process.meaning)}；结果${traditionalFact(sequence.result.name, '宫位解释')?.promptText ?? conditionXiaoliurenTraditionalText(sequence.result.meaning)}`,
    data.seasonStates
      ? `月令旺衰：起因${data.seasonStates.start}，过程${data.seasonStates.process}，结果${data.seasonStates.result}`
      : '',
    data.direction ? `传统方位类象：${data.direction}` : '',
    data.shenSha ? `传统神煞：${data.shenSha}` : '',
    `取象提示：${conditionXiaoliurenTraditionalText(data.questionHint)}`,
    data.yingQi ? `应期参考：${data.yingQi}` : `应期资料：${timingEvidence}`,
    data.timingEvidence?.primaryBasis?.length
      ? `应期主证：${data.timingEvidence.primaryBasis.join('；')}`
      : '',
    data.timingEvidence?.triggerConditions?.length
      ? `应期触发条件：${data.timingEvidence.triggerConditions.join('；')}`
      : '',
    data.timingEvidence?.limitations?.length
      ? `应期限制：${data.timingEvidence.limitations.join('；')}`
      : '',
    stageChartLines.length ? '完整课象：' : '',
    ...stageChartLines,
    '结构明细：',
    `- 起课方式：${data.methodLabel}`,
    `- 流派：${data.schoolLabel || (data.school === 'huashan' ? '华山派' : '通行掌诀')}`,
    ...palaceLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatQimenInfo(data: QimenData) {
  const evidenceAnalysis = data.evidenceAnalysis?.palaceFacts
    ? data.evidenceAnalysis
    : analyzeQimenEvidence(data);
  const primaryUsefulPalace = evidenceAnalysis.candidates[0];
  const focusText = primaryUsefulPalace
    ? `取用主线：优先看${primaryUsefulPalace.name}（${primaryUsefulPalace.direction}，${primaryUsefulPalace.element}）；来源${primaryUsefulPalace.sources.join('、')}；门星神干为${[primaryUsefulPalace.palace.renPan.door, primaryUsefulPalace.palace.tianPan.star, primaryUsefulPalace.palace.shenPan.god, primaryUsefulPalace.palace.tianPan.stem, primaryUsefulPalace.palace.diPan.stem].filter(Boolean).join('、')}；支持${primaryUsefulPalace.support.join('、') || '盘面平稳'}；限制${primaryUsefulPalace.constraints.join('、') || '未见明显空亡入墓'}`
    : '取用主线：以值符、值使、时干落宫为先，再看格局与宫间生克';
  const zhiFuPalace = data.jiuGongGe.find((item) => item.tianPan.star === data.zhiFu);
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const hourStem = data.ganzhi.hour.charAt(0);
  const hourStemPalaces = data.jiuGongGe.filter(
    (item) => item.tianPan.stem === hourStem || item.diPan.stem === hourStem,
  );
  const voidText = data.voidPalaces?.length
    ? data.voidPalaces.map((item) => `${item.branch}空落${item.name}`).join('、')
    : data.voidBranches?.length
      ? `${data.voidBranches.join('、')}空`
      : '无';
  const horseText = data.horseStar
    ? `${data.horseStar.sourceBranch}时驿马在${data.horseStar.branch}，落${data.horseStar.name}`
    : '无';
  const basicPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '基础格局',
  );
  const patternSummary = basicPatternFacts
    .map((item) => `${item.name}：${item.promptText}`)
    .join('；');
  // 经典格局（九遁、三奇得使等）—— 比一般格局标签更优先的判断依据
  const classicPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '经典格局',
  );
  const classicPatternSummary = classicPatternFacts.length
    ? classicPatternFacts
        .slice(0, 4)
        .map((item) => `${item.name}（${item.traditionalTone}）：${item.promptText}`)
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
        `节气五行${data.seasonality.seasonalElement || '未列'}`,
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
          return `${item.name}（${tone}）：${item.promptText}`;
        })
        .join('；')
    : '';
  const specialConditionsText = data.specialConditions?.description?.trim()
    ? conditionQimenTraditionalText(data.specialConditions.description.trim())
    : '';
  const solarTerm = data.seasonality?.jieQiPhase.solarTermEvidence;
  const moonPhase = data.seasonality?.moonPhaseEvidence;

  return [
    '占法：奇门遁甲',
    focusText,
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符${data.zhiFu}；值使${data.zhiShi}`,
    `关键提示：节令${`${data.timeInfo?.solarTerm || '未列'} ${data.timeInfo?.epoch || ''}`.trim()}；格局标签${data.patternTags?.join('、') || '无'}`,
    seasonalitySummary ? `节令背景：${seasonalitySummary}` : '',
    solarTerm
      ? `节气交接：${solarTerm.name}交节时刻 ${solarTerm.utcDateTime}（UTC），太阳黄经${solarTerm.targetLongitudeDegrees.toFixed(0)}°。`
      : '',
    moonPhase
      ? `月相：${moonPhase.eightPhaseName}（${moonPhase.waxing ? '盈' : '亏'}），日月黄经差约${moonPhase.phaseAngleDegrees.toFixed(2)}°，照明约${moonPhase.illuminationPercent.toFixed(1)}%。`
      : '',
    data.seasonality && !data.seasonality.lunarPhaseConsistency
      ? `月相口径提示：历法八相为${data.seasonality.lunarPhaseDetail}，日月黄经八分法为${data.seasonality.moonPhaseEvidence.eightPhaseName}；临界时刻应优先查看相位角与前后朔弦望时刻，不强行合并名称。`
      : '',
    ganzhiInteractionSummary ? `四柱互动：${ganzhiInteractionSummary}` : '',
    `值符值使与时干：值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '未见落宫'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '未见落宫'}；时干${hourStem}${hourStemPalaces.length ? `见于${hourStemPalaces.map((item) => item.name).join('、')}` : '未见落宫'}`,
    `旬空与马星：旬空${voidText}；马星${horseText}`,
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
  const guaTiSection = guaTiText ? `课体：${guaTiText}` : '';
  const tianJiangContext = traditionalFacts
    .filter((item) => item.kind === '天将属性')
    .map((item) => `${item.stages?.join('、') || ''}${item.name}：${item.promptText}`);
  const tianJiangSection = tianJiangContext?.length
    ? `天将属性：${tianJiangContext.join('；')}`
    : '';
  const shenShaCategorized = traditionalFacts
    .filter((item) => item.kind === '神煞')
    .map((item) => item.promptText)
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
    evidenceAnalysis.timingEvidence.length
      ? `应期资料：${evidenceAnalysis.timingEvidence
          .map(conditionLiurenTraditionalText)
          .join('；')}`
      : '',
    data.xunKong?.length
      ? `旬空：${data.xunKong.join('、')}${voidHits.length ? `，命中${voidHits.join('、')}` : ''}`
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
    return `- ${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}${card.keywords.length ? `；关键词：${card.keywords.join('、')}` : ''}${card.element ? `；元素主题：${card.element}` : ''}${card.archetype ? `；牌阶主题：${card.archetype}` : ''}${fact ? `；牌义：${fact.promptText}` : ''}`;
  });

  return [
    '占法：塔罗',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    `牌位顺序：${data.cards.map((card) => card.position).join(' → ')}`,
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
    return [
      '占法：三山国王灵签',
      `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
      `掷筊记录：${throwLog}`,
      `结果：${data.ritual.reason}`,
    ].join('\n');
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
      `- ${item.field}：${item.promptText || conditionSsgwInterpretation(item.originalText || item.text)}`,
  );

  return [
    '占法：三山国王灵签',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `签号：第${data.number}签`,
    `签题：《${data.title}》`,
    ritualLog,
    `签诗：${data.poem}`,
    promptCanonicalStory ? `典故：${promptCanonicalStory}` : '',
    promptExtraStory ? `补充签意：${promptExtraStory}` : '',
    detailLines.length ? '签意：' : '',
    ...detailLines,
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
  const preferred = evidenceAnalysis.preferredDates?.slice(0, 3) || [];
  const caution = evidenceAnalysis.cautionDates?.slice(0, 3) || [];
  const mainLine = `事项主线：围绕${data.topicLabel}，先按事项硬规则与参与人八字适配筛日，再比较宜忌、建除、神煞与冲煞；优先日${preferred.join('、') || '暂无'}，慎用日${caution.join('、') || '暂无'}`;
  const participantLines = data.participants.map((item) => {
    const usefulEvidenceAvailable =
      item.usefulGods.length > 0 && item.usefulGods.length <= 3 && item.avoidGods.length > 0;
    const useful = usefulEvidenceAvailable
      ? `喜用${item.usefulGods.join('、')}，忌神${item.avoidGods.join('、')}`
      : '本次不采用过分散的喜忌结论';
    return `- ${item.name}：${item.gender || '性别未填'}，公历${item.solarDate}，农历${item.lunarDate}，生肖${item.zodiac}，日主${item.dayMaster}${item.dayMasterElement}，四柱${item.pillars.year}年 ${item.pillars.month}月 ${item.pillars.day}日 ${item.pillars.hour}时，${useful}`;
  });
  const dayLines = topDays.map((item, index) => {
    const candidate = evidenceAnalysis.candidates.find(
      (candidateItem) => candidateItem.date === item.date,
    );
    const starFact = candidate?.traditionalFacts.find((fact) => fact.kind === '二十八宿');
    const nineStarFact = candidate?.traditionalFacts.find((fact) => fact.kind === '九星');
    const starDetail = starFact
      ? `（${starFact.promptText}）`
      : item.twentyEightStarDetail
        ? `（${conditionAlmanacTraditionalText(item.twentyEightStarDetail.meaning)}）`
        : '';
    const nineStarDetail = nineStarFact
      ? `（${nineStarFact.promptText}）`
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
        ? `可用时辰${item.bestHours
            .map(
              (hour) =>
                `${hour.name}${hour.range}（${hour.ganzhi}、${hour.twelveStar}；${hour.highlights.join('、') || '未见独立增强条件'}${hour.cautions.length ? `；风险${hour.cautions.join('、')}` : ''}）`,
            )
            .join('、')}`
        : '',
    ].filter(Boolean);
    const status = candidate?.status;
    return `- 第${index + 1}候选：${item.date} ${item.weekday}${status ? `，${status}` : ''}，${item.lunarDate}，${item.ganzhi.year}年 ${item.ganzhi.month}月 ${item.ganzhi.day}日；${item.dayOfficer}执日，十二神${item.twelveStar}，二十八宿${item.twentyEightStar}${starDetail}，九星${item.nineStar}${nineStarDetail}，${item.clash}；${evidence.join('；')}`;
  });
  const bestDay = topDays[0];
  const backupDays = topDays.slice(1, 3);
  const topicScopeEvidence = data.topic === 'custom' ? '' : `事项范围：${data.topicLabel}`;
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
            : '本次不采用过分散的喜忌结论';
          return `${participant.name}：日主${participant.dayMaster}${participant.dayMasterElement}，${usefulText}；${relatedNotes.join('；') || '候选日期未见直接参与人刑冲破害提醒'}`;
        })
        .join('；')
    : '';
  const availableWindowEvidence = [
    `候选范围：${data.startDate}至${data.endDate}`,
    bestDay?.bestHours?.length
      ? `首选日可用时辰${bestDay.bestHours.map((hour) => `${hour.name}${hour.range}`).join('、')}`
      : '',
    bestDay
      ? `首选日期${bestDay.date}，备选${backupDays.map((item) => item.date).join('、') || '无'}`
      : '',
  ]
    .filter(Boolean)
    .join('；');

  return [
    '占法：黄历择日',
    `核心结构：择日事项：${data.topicLabel}；候选日期：${data.startDate} 至 ${data.endDate}`,
    mainLine,
    bestDay ? `首选日期：${bestDay.date}` : '',
    topicScopeEvidence,
    participantFitEvidence ? `参与人适配：${participantFitEvidence}` : '',
    `可用时段：${availableWindowEvidence}`,
    participantLines.length ? '参与人八字参考：' : '',
    ...participantLines,
    '候选日期明细：',
    ...dayLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLenormandInfo(data: LenormandData) {
  const cardLines = data.cards.map(
    (card) =>
      `- ${card.position}：${card.name}；关键词：${card.keywords.join('、')}；牌义：${card.meaning}`,
  );
  const combinationLines = (data.combinations ?? []).map((item) => {
    const positions =
      item.position1 && item.position2 ? `${item.position1} ↔ ${item.position2}；` : '';
    const relation = item.relation ? `${item.relation}；` : '';
    return `- ${item.card1}+${item.card2}：${positions}${relation}${item.meaning}${item.source ? `（${item.source}）` : ''}`;
  });
  return [
    '占法：雷诺曼',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    `牌位顺序：${data.cards.map((card) => card.position).join(' → ')}`,
    '牌位明细：',
    ...cardLines,
    ...(combinationLines.length ? ['组合明细：', ...combinationLines] : []),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatAstrolabeInfo(data: AstrolabeData) {
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
    data.birth.isTrueSolarTime
      ? `出生时间校正：当地钟表时间${data.birth.standardDateTime || '未记录'}，采用真太阳时${data.birth.trueSolarDateTime || data.birth.dateTime}排盘。`
      : '',
    `核心结构：太阳${sun?.formatted || '未列'}；月亮${moon?.formatted || '未列'}；上升${ascendant?.formatted || '未列'}；共${data.planets.length}颗星体、${data.houses.length}个宫位、${data.aspects.length}组主要相位`,
    `关键提示：逆行星体${data.summary.retrograde.join('、') || '无'}；格局${data.summary.patterns.join('、') || '未见明显格局'}`,
    `核心位置：太阳${sun?.formatted || '未列'}；月亮${moon?.formatted || '未列'}；上升${ascendant?.formatted || '未列'}；主要相位${aspectSummary || '无'}`,
    `星体位置：${data.planets.map((item) => `${item.label}${item.formatted}，第${item.house}宫${item.retrograde ? '，逆行' : ''}`).join('；')}`,
    `宫头位置：${data.houses.map((item) => `${item.label}${item.formatted}`).join('；')}`,
    data.aspects.length
      ? `相位明细：${data.aspects.map((item) => `${item.body1}${item.symbol}${item.body2}（${item.type}，容许度${item.orb.toFixed(2)}°）`).join('；')}`
      : '',
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
  ].join('\n');
}

function formatJinkoujueInfo(data: JinkoujueData) {
  const evidenceAnalysis = data.evidenceAnalysis ?? analyzeJinkoujueEvidence(data);
  const p = data.positions;
  return [
    '占法：金口诀',
    `起课方式：${data.methodLabel}`,
    `起课时间：日柱${data.ganzhi.day}，时支${data.divinationBranch}，${data.dayNight}`,
    `月将贵人：月将${data.monthLeader}；贵人${data.noblemanBranch}`,
    evidenceAnalysis.mainLine || data.mainLine,
    `四位：地分${p.diFen.branch}（${p.diFen.element}，月令${p.diFen.seasonState}${p.diFen.isVoid ? '，空' : ''}）；将神${p.jiangShen.branch}（${p.jiangShen.element}，月令${p.jiangShen.seasonState}${p.jiangShen.isVoid ? '，空' : ''}）；贵神${p.guiShen.god || ''}${p.guiShen.branch}（${p.guiShen.element}，月令${p.guiShen.seasonState}${p.guiShen.isVoid ? '，空' : ''}）；人元${p.renYuan.stem || ''}${p.renYuan.branch}（${p.renYuan.element}，月令${p.renYuan.seasonState}${p.renYuan.isVoid ? '，空' : ''}）`,
    `四位关系：贵将${data.relations.guiToJiang}；贵人${data.relations.guiToRen}；将地${data.relations.jiangToDi}；人地${data.relations.renToDi}；贵地${data.relations.guiToDi}`,
    data.xunKong?.length ? `旬空：${data.xunKong.join('、')}` : '',
    evidenceAnalysis.promptText ? `结构化证据：${evidenceAnalysis.promptText}` : '',
    data.summary ? `简要提示：${data.summary}` : '',
  ]
    .filter(Boolean)
    .join('\n');
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
    case 'jinkoujue':
      return formatJinkoujueInfo(data as JinkoujueData);
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
