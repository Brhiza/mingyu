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
  isDeprecatedAlmanacTopicRuleText,
} from '@core/divination/algorithms/almanac';
import { LIUCHONG_MAP } from '@core/ganzhi';
import type { DivinationMethodId } from '@core/divination/config';
import {
  analyzeLiuyaoEvidence,
  analyzeLiuyaoFanFuRelations,
  getLiuyaoFlyingHiddenRelation,
} from '@core/divination/algorithms/liuyao';
import { analyzeMeihuaEvidence } from '@core/divination/algorithms/meihua';
import {
  analyzeLiurenEvidence,
  conditionLiurenTraditionalText,
} from '@core/divination/algorithms/liuren';
import { analyzeXiaoliurenEvidence } from '@core/divination/algorithms/xiaoliuren';
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
  return `第${item.position}爻${item.sixRelative}${item.najiaTiangan ?? ''}${item.najiaDizhi}${item.wuxing}`;
}

function formatHiddenSpirit(item: NonNullable<LiuyaoData['hiddenSpirits']>[number]) {
  const flyingRelation =
    item.conditionAnalysis?.flyingRelation ??
    getLiuyaoFlyingHiddenRelation(item.wuxing, item.underYao.wuxing);
  return `${item.sixRelative}伏第${item.position}爻${item.najiaTiangan ?? ''}${item.najiaDizhi}${item.wuxing}${item.isVoid ? '（空）' : ''}，伏于${item.underYao.sixRelative}${item.underYao.najiaTiangan ?? ''}${item.underYao.najiaDizhi}${item.underYao.wuxing}下（${flyingRelation}）`;
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
    '只定卦体冲合结构，须结合所问事项、用忌神与旺衰辨向',
  ]
    .filter(Boolean)
    .join('；');
}

function formatLiuyaoFanFuRelation(data: LiuyaoData) {
  const relations = analyzeLiuyaoFanFuRelations(data);
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

function createLiuyaoTimingEvidence(evidenceAnalysis: ReturnType<typeof analyzeLiuyaoEvidence>) {
  return evidenceAnalysis.timingFacts.map((item) => item.promptText).join('；');
}

function createMeihuaTimingEvidence(evidenceAnalysis: ReturnType<typeof analyzeMeihuaEvidence>) {
  return [
    evidenceAnalysis.timingSummaryFact.promptText,
    ...evidenceAnalysis.timingFacts.map((item) => item.promptText),
  ].join('；');
}

function formatLiuyaoInfo(
  data: LiuyaoData,
  topic: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' = 'general',
) {
  const dayBranch = getGanzhiBranch(data.ganzhi.day);
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
      const changeRelations = item.changeRelations?.length
        ? [...new Set(item.changeRelations)]
        : item.changeRelation
          ? [item.changeRelation]
          : [];
      const changedText = item.changedYao
        ? `化${item.changedYao.liuqin}${item.changedYao.tiangan ?? ''}${item.changedYao.dizhi}${item.changedYao.wuxing}${changeRelations.length ? `（${changeRelations.join('、')}）` : item.changedYao.isVoid ? '（变空）' : ''}${item.changeDirection ? `（${item.changeDirection}）` : ''}`
        : '无变爻资料';
      const hasDayClash = item.isDayClash ?? LIUCHONG_MAP[dayBranch] === item.najiaDizhi;
      const stateText = [
        item.isVoid ? '空' : '',
        item.isHiddenMove
          ? '暗动'
          : item.isDayBreak && !item.isChanging
            ? '日破'
            : hasDayClash
              ? '与日辰相冲'
              : '',
        item.isMonthBreak ? '月破' : '',
      ].filter(Boolean);
      return `${formatLiuyaoYaoBrief(item)}${stateText.length ? `（${stateText.join('、')}）` : ''}${changedText}`;
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
  const pendingUsefulGod = evidenceAnalysis.candidates.find(
    (item) =>
      item.candidateRole === '用神候选' &&
      item.relative === evidenceAnalysis.selectionFact.targetRelative,
  );
  const usefulGodCandidate = selectedUsefulGod ?? pendingUsefulGod;
  const usefulGodMainLine = `用神主线：${evidenceAnalysis.selectionFact.promptText}${usefulGodCandidate ? `；候选支持${usefulGodCandidate.support.join('、') || '未见额外增强'}；候选限制${usefulGodCandidate.constraints.join('、') || '未见明显空破墓退'}` : ''}`;
  const godChainText = evidenceAnalysis.godChain.length
    ? `作用链：${evidenceAnalysis.godChain
        .map(
          (item) =>
            `${item.role}${item.wuxing || ''}${item.status === '当前资料有对应' ? `见${item.references.map((ref) => `${ref.source === '月建' || ref.source === '日辰' ? ref.source : `${ref.source}第${ref.position}爻`}${ref.sixRelative}${ref.stem ?? ''}${ref.branch}${ref.wuxing}`).join('、')}` : '未见'}`,
        )
        .join('；')}`
    : '';
  const monthDayEvidence = createLiuyaoMonthDayEvidence(data);
  const timingEvidence = createLiuyaoTimingEvidence(evidenceAnalysis);
  const sanheParts = evidenceAnalysis.structureFacts
    .filter((item) => ['卦内三合', '日辰三合', '月建三合', '虚一待用'].includes(item.kind))
    .map((item) => item.promptText);
  const sanheDetail = sanheParts.length ? `三合结构：${sanheParts.join('；')}` : null;
  const sanxingParts = evidenceAnalysis.structureFacts
    .filter((item) => item.kind === '卦内三刑')
    .map((item) => item.promptText);
  const sanxingDetail = sanxingParts.length ? `三刑结构：${sanxingParts.join('；')}` : null;
  const activityFact = evidenceAnalysis.structureFacts.find((item) => item.kind === '动静结构');
  const guaShenFact = evidenceAnalysis.structureFacts.find((item) => item.kind === '月卦身');
  const guaShenDetail = guaShenFact ? `卦身：${guaShenFact.promptText}` : null;
  const worldSymbol = worldYao
    ? evidenceAnalysis.traditionalSymbols.find((item) => item.relative === worldYao.sixRelative)
    : undefined;
  return [
    '占法：六爻',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}${data.palace?.name ? `（${data.palace.name}宫）` : ''}；变卦${data.changedName || '无'}；互卦${data.interName || '无'}`,
    `关键提示：空亡${data.voidBranches?.join('、') || '无'}；动爻${movingYaos}；世应${worldYao ? `世爻在第${worldYao.position}爻` : '世爻未列'}、${responseYao ? `应爻在第${responseYao.position}爻` : '应爻未列'}；动静结构${activityFact?.activityPattern || '资料不足'}`,
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
    activityFact ? `动静结构：${activityFact.promptText}` : '',
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
  const interRoleText =
    data.interTiGua && data.interYongGua
      ? `；体互${data.interTiGua.name}（${data.interTiGua.element}）；用互${data.interYongGua.name}（${data.interYongGua.element}）`
      : '';
  const changedTiYongText =
    data.changedTiGua && data.changedYongGua
      ? `；变后体卦${data.changedTiGua.name}（${data.changedTiGua.element}）；变后用卦${data.changedYongGua.name}（${data.changedYongGua.element}）；变后体用${data.analysis.changedTiYongRelation}`
      : '';
  const evidenceAnalysis =
    data.evidenceAnalysis?.traditionalFacts &&
    data.evidenceAnalysis.internalMotionFact &&
    data.evidenceAnalysis.externalMotionFact &&
    data.evidenceAnalysis.spatialOmenFact &&
    data.evidenceAnalysis.timingFacts?.some((item) => item.type === '全卦克应关系') &&
    data.evidenceAnalysis.timingFacts.some(
      (item) => item.type === '克应资料覆盖' && item.requiredContextFields?.length,
    )
      ? data.evidenceAnalysis
      : analyzeMeihuaEvidence(data);
  const timingEvidence = createMeihuaTimingEvidence(evidenceAnalysis);
  const yaoLines = [...evidenceAnalysis.yaoStructureFacts]
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
  const seasonBasis =
    data.analysis.monthBranch && data.analysis.monthElement
      ? `${data.analysis.monthBranch}月（${data.analysis.monthElement}令）`
      : `${data.analysis.season}季`;

  return [
    '占法：梅花易数',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}；互卦${data.interName || '无'}；变卦${data.changedName || '无'}`,
    descriptionFact('主卦') ? `主卦卦辞分类：${descriptionFact('主卦')?.promptText}` : '',
    descriptionFact('互卦') ? `互卦卦辞分类：${descriptionFact('互卦')?.promptText}` : '',
    descriptionFact('变卦') ? `变卦卦辞分类：${descriptionFact('变卦')?.promptText}` : '',
    movingYaoFact ? `动爻传统辅助：${movingYaoFact.promptText}` : '',
    `体用：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${data.analysis.tiYongRelation}`,
    `互卦：${processHexagram}${interRoleText}；${data.analysis.inter1Relation}；${data.analysis.inter2Relation}`,
    `变卦：${resultHexagram}${changedTiYongText}；结果关系${data.analysis.changedRelation}`,
    `月令与起卦：${seasonBasis}，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}；起卦法${methodLabel}${typeof calculation?.number === 'number' ? `；起卦数字${calculation.number}` : ''}`,
    `体用动静：${evidenceAnalysis.internalMotionFact.promptText}`,
    `外应动静：${evidenceAnalysis.externalMotionFact.promptText}`,
    `坐端应兆：${evidenceAnalysis.spatialOmenFact.promptText}`,
    `应期资料：${timingEvidence}`,
    '结构明细：',
    `- 月令旺衰：${seasonBasis}，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}`,
    `- 体用关系：${data.analysis.tiYongRelation}`,
    `- 过程关系：${data.analysis.inter1Relation}；${data.analysis.inter2Relation}`,
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
  const evidenceAnalysis = data.evidenceAnalysis?.primaryFact
    ? data.evidenceAnalysis
    : analyzeXiaoliurenEvidence(data);

  return [
    '占法：小六壬',
    `时间干支：${data.ganzhi.year}年 ${data.ganzhi.month}月 ${data.ganzhi.day}日 ${data.ganzhi.hour}时；农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}`,
    `顺数轨迹：月宫${data.sequence.month.name}；日宫${data.sequence.day.name}；时宫${data.sequence.hour.name}`,
    `占得宫：${data.primary.name}`,
    `歌诀原文：${data.primary.verse}`,
    `计算链：${evidenceAnalysis.calculationFact.promptText}`,
    `历法口径：${data.calculation.dayBoundary}；${data.calculation.leapMonthRule}`,
    `来源状态：${evidenceAnalysis.sources.map((item) => `${item.title}：${item.evidence}`).join('；')}`,
    `解释限制：${evidenceAnalysis.limitations.join('；')}`,
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
    ? `取用主线：优先看${primaryUsefulPalace.name}（${primaryUsefulPalace.direction}，${primaryUsefulPalace.element}）；来源${primaryUsefulPalace.sources.join('、')}；门星神干为${[primaryUsefulPalace.palace.renPan.door, primaryUsefulPalace.palace.tianPan.star, primaryUsefulPalace.palace.tianPan.companionStar, primaryUsefulPalace.palace.shenPan.god, primaryUsefulPalace.palace.tianPan.stem, primaryUsefulPalace.palace.tianPan.companionStem, primaryUsefulPalace.palace.diPan.stem].filter(Boolean).join('、')}；支持${primaryUsefulPalace.support.join('、') || '盘面平稳'}；限制${primaryUsefulPalace.constraints.join('、') || '未见明显空亡入墓'}`
    : '取用主线：以值符、值使、时干落宫为先，再看格局与宫间生克';
  const zhiFuPalace = data.jiuGongGe.find(
    (item) => item.tianPan.star === data.zhiFu || item.tianPan.companionStar === data.zhiFu,
  );
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const hourStem = data.ganzhi.hour.charAt(0);
  const hourStemPalaces = data.jiuGongGe.filter(
    (item) =>
      item.tianPan.stem === hourStem ||
      item.tianPan.companionStem === hourStem ||
      item.diPan.stem === hourStem,
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
  const juTerm = data.timeInfo?.juTerm || data.timeInfo?.solarTerm || '未列';

  return [
    '占法：奇门遁甲',
    focusText,
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符${data.zhiFu}；值使${data.zhiShi}`,
    `关键提示：实际节气${data.timeInfo?.solarTerm || '未列'}；定局${`${juTerm} ${data.timeInfo?.epoch || ''}`.trim()}；格局标签${data.patternTags?.join('、') || '无'}`,
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
  return `岁支十二神方位${gods.map((god) => `${god.name}${god.branch}${god.direction}`).join('、')}（只列方位，不据此判吉凶）`;
}

function formatAlmanacGodFacts(
  facts: NonNullable<AlmanacData['days'][number]['godFacts']> | undefined,
  fallbackGods: string[],
) {
  if (!facts?.length) {
    return fallbackGods.length
      ? `值日神煞：${fallbackGods.join('、')}（旧结果未保存原生吉凶分类）`
      : '';
  }

  const groups: Array<[string, string[]]> = [
    ['吉神', facts.filter((item) => item.classification === '吉神').map((item) => item.name)],
    ['凶神', facts.filter((item) => item.classification === '凶神').map((item) => item.name)],
    ['未分级', facts.filter((item) => item.classification === '未分级').map((item) => item.name)],
  ];
  const parts = groups
    .filter(([, names]) => names.length > 0)
    .map(([label, names]) => `${label}${names.join('、')}`);
  return parts.length ? `值日神煞：${parts.join('；')}` : '';
}

function formatAlmanacInfo(data: AlmanacData) {
  const evidenceAnalysis = analyzeAlmanacEvidence(data);
  const candidateDays = data.days;
  const preferred = evidenceAnalysis.preferredDates || [];
  const conditional = evidenceAnalysis.conditionalDates || [];
  const caution = evidenceAnalysis.cautionDates || [];
  const mainLine = `事项主线：围绕${data.topicLabel}，先核对原始宜忌，再并列查看建除、神煞、冲煞与参与人年支、日支刑冲破害参考关系；参与人双支关系不自动改变分组；可用候选${preferred.join('、') || '暂无'}，条件候选${conditional.join('、') || '暂无'}，慎用候选${caution.join('、') || '暂无'}；同组按日期先后列出，不按证据数量生成名次`;
  const participantLines = data.participants.map((item) => {
    const usefulEvidenceAvailable =
      item.usefulGods.length > 0 && item.usefulGods.length <= 3 && item.avoidGods.length > 0;
    const useful = usefulEvidenceAvailable
      ? `喜用资料${item.usefulGods.join('、')}，忌神资料${item.avoidGods.join('、')}（不用于本次简单加权）`
      : '本次不采用喜忌五行作简单加权';
    return `- ${item.name}：${item.gender || '性别未填'}，公历${item.solarDate}，农历${item.lunarDate}，生肖${item.zodiac}，日主${item.dayMaster}${item.dayMasterElement}，四柱${item.pillars.year}年 ${item.pillars.month}月 ${item.pillars.day}日 ${item.pillars.hour}时，${useful}`;
  });
  const dayLines = candidateDays.map((item) => {
    const candidate = evidenceAnalysis.candidates.find(
      (candidateItem) => candidateItem.date === item.date,
    );
    const starFact = candidate?.traditionalFacts.find((fact) => fact.kind === '二十八宿');
    const nineStarFact = candidate?.traditionalFacts.find((fact) => fact.kind === '九星');
    const starDetail = starFact
      ? `（${starFact.promptText}）`
      : item.twentyEightStarDetail
        ? `（${item.twentyEightStarDetail.fullName}，${item.twentyEightStarDetail.zone}方七宿，原生属性${item.twentyEightStarDetail.fortune}）`
        : '';
    const nineStarDetail = nineStarFact
      ? `（${nineStarFact.promptText}）`
      : item.nineStarDetail
        ? `（${item.nineStarDetail.fullName}，北斗${item.nineStarDetail.dipper}，方位${item.nineStarDetail.direction}）`
        : '';
    const godText = formatAlmanacGodFacts(item.godFacts, item.gods);
    const annualDirectionGodsText = formatAlmanacAnnualDirectionGods(candidate);
    const highlights = item.highlights.filter((text) => !isDeprecatedAlmanacTopicRuleText(text));
    const cautions = item.cautions.filter((text) => !isDeprecatedAlmanacTopicRuleText(text));
    const evidence = [
      `宜${item.recommends.join('、') || '无'}`,
      `忌${item.avoids.join('、') || '无'}`,
      godText,
      annualDirectionGodsText,
      highlights.length ? `支持${highlights.join('、')}` : '',
      cautions.length ? `风险${cautions.join('、')}` : '',
      item.participantNotes.length ? `参与人${item.participantNotes.join('；')}` : '',
      item.bestHours?.length
        ? `无强冲突时辰${item.bestHours
            .map(
              (hour) =>
                `${hour.name}${hour.range}（${hour.ganzhi}、${hour.twelveStar}；${hour.highlights.join('、') || '未见独立增强条件'}${hour.cautions.length ? `；风险${hour.cautions.join('、')}` : ''}）`,
            )
            .join('、')}`
        : '',
    ].filter(Boolean);
    const status = candidate?.status;
    return `- 候选日期：${item.date} ${item.weekday}${status ? `，${status}` : ''}，${item.lunarDate}，${item.ganzhi.year}年 ${item.ganzhi.month}月 ${item.ganzhi.day}日；${item.dayOfficer}执日，十二神${item.twelveStar}，二十八宿${item.twentyEightStar}${starDetail}，九星${item.nineStar}${nineStarDetail}，${item.clash}；${evidence.join('；')}`;
  });
  const topicScopeEvidence = data.topic === 'custom' ? '' : `事项范围：${data.topicLabel}`;
  const participantFitEvidence = data.participants.length
    ? data.participants
        .map((participant) => {
          const relatedNotes = candidateDays.flatMap((day) =>
            day.participantNotes
              .filter((note) => note.includes(participant.name))
              .map((note) => `${day.date}${note}`),
          );
          const usefulEvidenceAvailable =
            participant.usefulGods.length > 0 &&
            participant.usefulGods.length <= 3 &&
            participant.avoidGods.length > 0;
          const usefulText = usefulEvidenceAvailable
            ? `喜用资料${participant.usefulGods.join('、')}，忌神资料${participant.avoidGods.join('、')}（不用于本次简单加权）`
            : '本次不采用喜忌五行作简单加权';
          return `${participant.name}：日主${participant.dayMaster}${participant.dayMasterElement}，${usefulText}；${relatedNotes.join('；') || '候选日期未见参与人刑冲破害参考关系'}`;
        })
        .join('；')
    : '';
  const availableWindowEvidence = [
    `候选范围：${data.startDate}至${data.endDate}`,
    `可用候选${preferred.join('、') || '暂无'}`,
    `条件候选${conditional.join('、') || '暂无'}`,
    `慎用候选${caution.join('、') || '暂无'}`,
  ]
    .filter(Boolean)
    .join('；');

  return [
    '占法：黄历择日',
    `核心结构：择日事项：${data.topicLabel}；候选日期：${data.startDate} 至 ${data.endDate}`,
    mainLine,
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
  const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计' }[data.scope];
  return [
    `占法：太乙神数（${scopeLabel}）`,
    `起局时间：${data.dateTime}；本计干支：${data.ganZhi}；${data.accumulatedLabel}：${data.accumulatedValue}`,
    `第${data.yuan}个72数段、第${data.ji}个60数段；${data.yinYang}第${data.bureau}局`,
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
    `月将贵人：月将${data.monthLeader}；${data.dayNight}贵人起${data.noblemanBranch}${data.calculation.noblemanDirection}`,
    evidenceAnalysis.mainLine || data.mainLine,
    `阴阳发用：${data.yinYangUse.rule}；发用位${data.yinYangUse.usePosition}${data.yinYangUse.isVoid ? '旬空' : '不空'}`,
    `四位：地分${p.diFen.branch}（${p.diFen.yinYang}${p.diFen.element}，按${p.diFen.elementBasis}，月令${p.diFen.seasonState}${p.diFen.isVoid ? '，空' : ''}）；将神${p.jiangShen.stem || ''}${p.jiangShen.branch}（${p.jiangShen.yinYang}${p.jiangShen.element}，按${p.jiangShen.elementBasis}，月令${p.jiangShen.seasonState}${p.jiangShen.isVoid ? '，空' : ''}）；贵神${p.guiShen.stem || ''}${p.guiShen.branch}乘${p.guiShen.god || ''}（${p.guiShen.yinYang}${p.guiShen.element}，按${p.guiShen.elementBasis}，月令${p.guiShen.seasonState}${p.guiShen.isVoid ? '，空' : ''}）；人元${p.renYuan.stem || ''}${p.renYuan.branch}（${p.renYuan.yinYang}${p.renYuan.element}，按${p.renYuan.elementBasis}，月令${p.renYuan.seasonState}${p.renYuan.isVoid ? '，空' : ''}）`,
    `动爻：${data.movements.map((item) => `${item.category}${item.name}（${item.trigger}）`).join('；') || '未触发五动或三动'}`,
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
