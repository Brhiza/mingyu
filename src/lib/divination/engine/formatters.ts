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
import { conditionSsgwInterpretation, rebuildAuditedSsgwData } from 'mingyu-core/divination/ssgw';
import { analyzeQimenEvidence, rebuildAuditedQimenData } from '@core/divination/algorithms/qimen';
import {
  analyzeAlmanacEvidence,
  isDeprecatedAlmanacTopicRuleText,
  rebuildAuditedAlmanacData,
} from '@core/divination/algorithms/almanac';
import { LIUCHONG_MAP } from '@core/ganzhi';
import type { DivinationMethodId } from '@core/divination/config';
import {
  analyzeLiuyaoEvidence,
  analyzeLiuyaoFanFuRelations,
  getLiuyaoFlyingHiddenRelation,
  rebuildAuditedLiuyaoData,
} from '@core/divination/algorithms/liuyao';
import {
  analyzeMeihuaEvidence,
  rebuildAuditedMeihuaData,
} from '@core/divination/algorithms/meihua';
import {
  analyzeLiurenEvidence,
  conditionLiurenTraditionalText,
  rebuildAuditedLiurenData,
} from '@core/divination/algorithms/liuren';
import { rebuildAuditedXiaoliurenData } from '@core/divination/algorithms/xiaoliuren';
import { rebuildAuditedJinkoujueData } from '@core/divination/algorithms/jinkoujue';
import { rebuildAuditedTarotData } from '@core/divination/tarot';
import { rebuildAuditedLenormandData } from '@core/divination/algorithms/lenormand';
import { rebuildAuditedTaiyiData } from 'mingyu-core/taiyi';
import { rebuildAuditedAstrolabeData } from 'mingyu-core/divination/astrolabe';

function resolveDivinationTimestamp(data?: DivinationData): number | null {
  if (data && 'generation' in data && data.generation && typeof data.generation === 'object') {
    const generation = data.generation as { timestamp?: unknown };
    if ('timestamp' in generation) {
      return typeof generation.timestamp === 'number' &&
        Number.isSafeInteger(generation.timestamp) &&
        generation.timestamp >= 0 &&
        !Number.isNaN(new Date(generation.timestamp).getTime())
        ? generation.timestamp
        : null;
    }
  }

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
  input: LiuyaoData,
  topic: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' = 'general',
) {
  const data = rebuildAuditedLiuyaoData(input);
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

function formatMeihuaInfo(input: MeihuaData) {
  const data = rebuildAuditedMeihuaData(input);
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
  const evidenceAnalysis = data.evidenceAnalysis ?? analyzeMeihuaEvidence(data);
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
    `万物外应：${evidenceAnalysis.sensoryOmenFact.promptText}`,
    `饮食专项：${evidenceAnalysis.foodContextFact.promptText}`,
    `观物专项：${evidenceAnalysis.objectContextFact.promptText}`,
    `诸事响应专项：${evidenceAnalysis.topicResponseContextFact.promptText}`,
    `占卜十应：${evidenceAnalysis.tenResponseContextFact.promptText}`,
    `论事十大应：${evidenceAnalysis.matterTenResponseContextFact.promptText}`,
    `卦应八卦目录：${evidenceAnalysis.trigramResponseCatalogFact.promptText}`,
    `反对性情资料：${evidenceAnalysis.hexagramDispositionFacts.map((item) => item.promptText).join('；')}；${evidenceAnalysis.hexagramDispositionVersionFact.promptText}`,
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
  const audited = rebuildAuditedXiaoliurenData(data);
  const evidenceAnalysis = audited.evidenceAnalysis!;

  return [
    '占法：小六壬',
    `时间干支：${audited.ganzhi.year}年 ${audited.ganzhi.month}月 ${audited.ganzhi.day}日 ${audited.ganzhi.hour}时；农历${audited.isLeapMonth ? '闰' : ''}${audited.lunarMonth}月${audited.lunarDay}日，${audited.hourLabel}`,
    `顺数轨迹：月宫${audited.sequence.month.name}；日宫${audited.sequence.day.name}；时宫${audited.sequence.hour.name}`,
    `占得宫：${audited.primary.name}`,
    `歌诀原文：${audited.primary.verse}`,
    `计算链：${evidenceAnalysis.calculationFact.promptText}`,
    `历法口径：${audited.calculation.dayBoundary}；${audited.calculation.leapMonthRule}`,
    `来源状态：${evidenceAnalysis.sources.map((item) => `${item.title}：${item.evidence}`).join('；')}`,
    `解释限制：${evidenceAnalysis.limitations.join('；')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatQimenInfo(input: QimenData) {
  // 旧缓存或外部结果可能携带已退役摘要；提示词始终从原始盘面重新建立证据。
  const data = rebuildAuditedQimenData(input);
  const evidenceAnalysis = analyzeQimenEvidence(data);
  const positionIndexText = evidenceAnalysis.positionIndexes.length
    ? evidenceAnalysis.positionIndexes
        .map((item) => `${item.name}（${item.indexSources.join('、')}）`)
        .join('；')
    : '未定位';
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
  // 已逐条校勘的十一项天地盘固定格，以及时家上下文、三奇升殿、三诈和三项条件一致五假位置结构。
  const classicPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '经典格局',
  );
  const classicPatternSummary = classicPatternFacts.length
    ? classicPatternFacts
        .map((item) => `${item.name}（原典分类：${item.traditionalTone}）：${item.promptText}`)
        .join('；')
    : '';
  const stemRelationSummary = evidenceAnalysis.palaceFacts
    .flatMap((palace) =>
      palace.stemRelationFacts.map(
        (item) => `${item.heavenStem}${item.earthStem}落${palace.name}：${item.promptText}`,
      ),
    )
    .join('；');
  const seasonalitySummary = data.seasonality
    ? [
        `${data.seasonality.currentJieQi}${data.seasonality.jieQiPhase.phase}`,
        `节气五行${data.seasonality.seasonalElement || '未列'}`,
        `日干${data.seasonality.dayStem}${data.seasonality.seasonRelation}`,
        `月相${data.seasonality.lunarPhaseDetail || data.seasonality.lunarPhase}`,
        `建除${data.seasonality.dayOfficer}`,
      ].join('；')
    : '';
  const ganzhiInteractionSummary = data.seasonality?.ganzhiInteractions?.length
    ? data.seasonality.ganzhiInteractions
        .map((item) => `${item.type}${item.values.join('、')}`)
        .join('；')
    : '';
  const comboPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '复合格局',
  );
  const patternComboSummary = comboPatternFacts.length
    ? comboPatternFacts
        .map(
          (item) =>
            `${item.name}（传统分类：${item.traditionalTone}，不等于现实吉凶）：${item.promptText}`,
        )
        .join('；')
    : '';
  const specialConditionsText =
    evidenceAnalysis.calculationEvidenceFacts.find(
      (item) => item.key === 'qimen:calculation:fixed-ganzhi-conditions',
    )?.promptText ?? '';
  const solarTerm = data.seasonality?.jieQiPhase.solarTermEvidence;
  const moonPhase = data.seasonality?.moonPhaseEvidence;
  const juTerm = data.timeInfo?.juTerm || data.timeInfo?.solarTerm || '未列';
  const palaceText = evidenceAnalysis.palaceFacts
    .map(
      (item) =>
        `${item.name}（${item.direction}${item.element}）：天盘${[item.tianPan.stem, item.tianPan.companionStem, item.tianPan.star, item.tianPan.companionStar].filter(Boolean).join('、')}；地盘${item.diPan.stem}；人盘${item.renPan.door}；神盘${item.shenPan.god}；${item.isVoid ? `旬空${item.voidBranches.join('、')}` : '不空'}；${item.hasHorse ? `马星（源支${item.horseSourceBranch ?? '未列'}）` : '无马星'}`,
    )
    .join('；');
  const palaceRelationText = evidenceAnalysis.palaceRelations
    .map((item) => `${item.from}—${item.to}：${item.relation}`)
    .join('；');

  return [
    '占法：奇门遁甲',
    `位置索引：${positionIndexText}。这些位置只标记值符、值使、日干、时干或已校勘格局所在宫，不自动指定具体问题的用神宫或方位结论`,
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符${data.zhiFu}；值使${data.zhiShi}`,
    `关键提示：实际节气${data.timeInfo?.solarTerm || '未列'}；定局${`${juTerm} ${data.timeInfo?.epoch || ''}`.trim()}；位置标签${basicPatternFacts.map((item) => item.name).join('、') || '无'}`,
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
    `九宫原始盘：${palaceText}`,
    `九宫宫对五行关系（全部36组无序宫对）：${palaceRelationText}`,
    specialConditionsText,
    patternSummary ? `位置与五行事实：${patternSummary}` : '',
    classicPatternSummary ? `经典格局：${classicPatternSummary}` : '',
    patternComboSummary ? `已校勘组合规则：${patternComboSummary}` : '',
    stemRelationSummary ? `天地盘干：${stemRelationSummary}` : '',
    `应期边界：${evidenceAnalysis.timingSummaryFact.promptText}`,
    `方位边界：${evidenceAnalysis.directionBoundaryFact.promptText}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLiurenInfo(input: LiurenData) {
  const data = rebuildAuditedLiurenData(input);
  const evidenceAnalysis = analyzeLiurenEvidence(data);
  const foundationConventionFact = evidenceAnalysis.foundationConventionFact;
  const transmissionConventionFact = evidenceAnalysis.transmissionConventionFact;
  const traditionalFacts = evidenceAnalysis.traditionalFacts;
  const firstTransmission = data.threeTransmissions[0];
  const lastTransmission = data.threeTransmissions[2];
  const lessonText = data.fourLessons
    .map((item) => `${item.name}${item.upper}临${item.lower}乘${item.god}，${item.relation}`)
    .join('；');
  const transmissionText = evidenceAnalysis.transmissions
    .map(
      (item) =>
        `${item.stage}${item.branch}乘${item.god}，六亲${item.kinship}，${item.dayStemRelation}，月令${item.seasonState ?? '未定'}，${item.isVoid ? '落旬空' : '不空'}（空亡有宜有忌）${item.previousRelation ? `，与上一传关系${item.previousRelation}` : ''}，与日支五行关系${item.dayRelation}${item.dayBranchRelations?.length ? `，固定地支关系${item.dayBranchRelations.join('、')}` : ''}`,
    )
    .join('；');
  const xunKong = evidenceAnalysis.calculationFact.xunKong;
  const voidHits = evidenceAnalysis.transmissions
    .filter((item) => item.isVoid)
    .map((item) => `${item.stage}${item.branch}`);
  const summaryText = [
    `四课依次为${data.fourLessons.map((item) => `${item.name}${item.upper}临${item.lower}`).join('、')}`,
    `三传${data.transmissionPattern ?? '模式未列'}，依次为${evidenceAnalysis.transmissions.map((item) => `${item.stage}${item.branch}`).join('→')}`,
    data.transmissionDetail,
  ]
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
    `旬空${xunKong.join('、')}`,
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
    `起盘口径：${foundationConventionFact.promptText}`,
    `四课取传口径：${transmissionConventionFact.promptText}`,
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
    `旬空：${xunKong.join('、')}${voidHits.length ? `，命中${voidHits.join('、')}` : ''}`,
    summaryText ? `简要提示：${summaryText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatTarotInfo(data: TarotData) {
  const audited = rebuildAuditedTarotData(data);
  const evidenceAnalysis = audited.evidenceAnalysis!;
  const cardLines = audited.cards.map((card, index) => {
    const fact = evidenceAnalysis.traditionalFacts.find((item) => item.index === index + 1);
    return `- ${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}${card.keywords.length ? `；关键词：${card.keywords.join('、')}` : ''}${card.element ? `；元素主题：${card.element}` : ''}${card.archetype ? `；牌阶主题：${card.archetype}` : ''}${fact ? `；牌义：${fact.promptText}` : ''}`;
  });

  return [
    '占法：塔罗',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${audited.spreadName}；共${audited.cards.length}张牌`,
    `牌位顺序：${audited.cards.map((card) => card.position).join(' → ')}`,
    '牌位明细：',
    ...cardLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSsgwInfo(data: SsgwData) {
  const audited = rebuildAuditedSsgwData(data);
  const evidenceAnalysis = audited.evidenceAnalysis!;
  if (audited.ritual?.rejected) {
    const throwLog = audited.ritual.throws.map((t) => t.result).join(' → ');
    return [
      '占法：三山国王灵签',
      `时间干支：${formatGanzhi(audited.ganzhi).replace('干支：', '')}`,
      `掷筊记录：${throwLog}`,
      `结果：${audited.ritual.reason}`,
    ].join('\n');
  }

  const { canonicalStory, extraStory } = resolveSsgwStoryContent(audited);
  const promptCanonicalStory = canonicalStory
    ? conditionSsgwInterpretation(canonicalStory)
    : evidenceAnalysis.promptStory;
  const promptExtraStory = extraStory ? conditionSsgwInterpretation(extraStory) : '';
  const ritualLog = audited.ritual?.throws?.length
    ? `掷筊记录：${audited.ritual.throws.map((t) => t.result).join(' → ')}${audited.ritual.reason ? `（${audited.ritual.reason}）` : ''}`
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
    `时间干支：${formatGanzhi(audited.ganzhi).replace('干支：', '')}`,
    `签号：第${audited.number}签`,
    `签题：《${audited.title}》`,
    ritualLog,
    `签诗：${audited.poem}`,
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

function formatAlmanacInfo(input: AlmanacData) {
  const data = rebuildAuditedAlmanacData(input);
  const evidenceAnalysis = analyzeAlmanacEvidence(data);
  const candidateDays = data.days;
  const preferred = evidenceAnalysis.preferredDates || [];
  const conditional = evidenceAnalysis.conditionalDates || [];
  const caution = evidenceAnalysis.cautionDates || [];
  const mainLine = `事项主线：围绕${data.topicLabel}，先核对原始宜忌，再并列查看建除、神煞、冲煞与参与人年支、日支刑冲破害参考关系；参与人双支关系不自动改变分组；可用候选${preferred.join('、') || '暂无'}，条件候选${conditional.join('、') || '暂无'}，慎用候选${caution.join('、') || '暂无'}；同组按日期先后列出，不按证据数量生成名次`;
  const participantLines = data.participants.map((item) => {
    const useful = '自动喜忌规则保持关闭，本次不读取喜忌五行';
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
          const usefulText = '自动喜忌规则保持关闭，本次不读取喜忌五行';
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
  const audited = rebuildAuditedLenormandData(data);
  const cardLines = audited.cards.map(
    (card) =>
      `- ${card.position}：${card.name}；关键词：${card.keywords.join('、')}；牌义：${card.meaning}`,
  );
  const combinationLines = (audited.combinations ?? []).map((item) => {
    const positions =
      item.position1 && item.position2 ? `${item.position1} ↔ ${item.position2}；` : '';
    const relation = item.relation ? `${item.relation}；` : '';
    return `- ${item.card1}+${item.card2}：${positions}${relation}${item.meaning}${item.source ? `（${item.source}）` : ''}`;
  });
  return [
    '占法：雷诺曼',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${audited.spreadName}；共${audited.cards.length}张牌`,
    `牌位顺序：${audited.cards.map((card) => card.position).join(' → ')}`,
    '牌位明细：',
    ...cardLines,
    ...(combinationLines.length ? ['组合明细：', ...combinationLines] : []),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatAstrolabeInfo(data: AstrolabeData) {
  data = rebuildAuditedAstrolabeData(data);
  const sun = data.planets.find((item) => item.name === 'Sun');
  const moon = data.planets.find((item) => item.name === 'Moon');
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const formatAspect = (item: AstrolabeData['aspects'][number]) => {
    const geometry =
      item.actualAngle !== undefined &&
      item.exactAngle !== undefined &&
      item.allowedOrb !== undefined
        ? `实际夹角${item.actualAngle.toFixed(2)}°，精确角${item.exactAngle.toFixed(2)}°，偏差${item.orb.toFixed(2)}°，采用容许度${item.allowedOrb.toFixed(2)}°`
        : `偏差${item.orb.toFixed(2)}°，旧结果未记录完整几何量`;
    const phase = item.applying === null ? '入出相未判定' : item.applying ? '入相' : '出相';
    return `${item.body1}${item.symbol}${item.body2}（${item.type}，${geometry}，${phase}${item.isOutOfSign ? '，跨星座相位' : ''}）`;
  };
  const aspectCalculation = data.aspectCalculation;

  return [
    '占法：星盘',
    `出生信息：${data.birth.name}，${data.birth.gender || '性别未填'}，${data.birth.dateTime}，位置${data.birth.location}，时区 UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    data.birth.isTrueSolarTime
      ? `出生时间参考：民用时间${data.birth.standardDateTime || data.birth.dateTime}进入现代星历计算；真太阳时${data.birth.trueSolarDateTime || '未记录'}仅作传统时间参考。`
      : '',
    `核心结构：太阳${sun?.formatted || '未列'}；月亮${moon?.formatted || '未列'}；上升${ascendant?.formatted || '未列'}；共${data.planets.length}颗星体、${data.houses.length}个宫位、${data.aspects.length}组主要相位`,
    `关键提示：逆行星体${data.summary.retrograde.join('、') || '无'}；格局${data.summary.patterns.join('、') || '未见明显格局'}`,
    `核心位置：太阳${sun?.formatted || '未列'}；月亮${moon?.formatted || '未列'}；上升${ascendant?.formatted || '未列'}`,
    `星体位置：${data.planets.map((item) => `${item.label}${item.formatted}，第${item.house}宫${item.retrograde ? '，逆行' : ''}`).join('；')}`,
    `宫头位置：${data.houses.map((item) => `${item.label}${item.formatted}`).join('；')}`,
    aspectCalculation
      ? `本命相位穷举：选定点位${aspectCalculation.selectedPointNames.join('、')}；共核验${aspectCalculation.evaluatedPairCount}组无序点对，完整保留${aspectCalculation.matchedAspectCount}组命中项；相位定义${aspectCalculation.aspectDefinitions.map((item) => `${item.type}${item.exactAngle}°±${item.allowedOrb}°`).join('、')}。`
      : '',
    data.aspects.length ? `相位明细：${data.aspects.map(formatAspect).join('；')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatTaiyiInfo(data: TaiyiResult) {
  const audited = rebuildAuditedTaiyiData(data);
  const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计' }[audited.scope];
  return [
    `占法：太乙神数（${scopeLabel}）`,
    `起局时间：${audited.dateTime}；本计干支：${audited.ganZhi}；${audited.accumulatedLabel}：${audited.accumulatedValue}`,
    `第${audited.yuan}个72数段、第${audited.ji}个60数段；${audited.yinYang}第${audited.bureau}局`,
    `太乙：${audited.taiyiPosition}（第${audited.taiyiPalace}宫，${audited.taiyiGua}卦，${audited.taiyiDir}）`,
    `文昌（主目）：${audited.wenChangPosition}；始击（客目）：${audited.shiJiPosition}；计神：${audited.jiShenPosition}`,
    `主客定算：主算${audited.lordCount}；客算${audited.guestCount}；定算${audited.setCount}`,
    `将参：主大${audited.lordGeneral}、主参${audited.lordAssistant}；客大${audited.guestGeneral}、客参${audited.guestAssistant}；定大${audited.setGeneral}、定参${audited.setAssistant}`,
    `判断：${audited.judgments.join('；')}`,
    `模型：${audited.model.name}；${audited.model.precision}`,
    `十六神：${audited.sixteenGods.map((item) => `${item.branch}${item.god}`).join('、')}`,
  ].join('\n');
}

function formatJinkoujueInfo(data: JinkoujueData) {
  const audited = rebuildAuditedJinkoujueData(data);
  const evidenceAnalysis = audited.evidenceAnalysis!;
  const p = audited.positions;
  return [
    '占法：金口诀',
    `起课方式：${audited.methodLabel}`,
    `起课时间：日柱${audited.ganzhi.day}，时支${audited.divinationBranch}，${audited.dayNight}`,
    `月将贵人：月将${audited.monthLeader}；${audited.dayNight}贵人起${audited.noblemanBranch}${audited.calculation.noblemanDirection}`,
    evidenceAnalysis.mainLine,
    `阴阳发用：${audited.yinYangUse.rule}；发用位${audited.yinYangUse.usePosition}${audited.yinYangUse.isVoid ? '旬空' : '不空'}`,
    `四位：地分${p.diFen.branch}（${p.diFen.yinYang}${p.diFen.element}，按${p.diFen.elementBasis}，月令${p.diFen.seasonState}${p.diFen.isVoid ? '，空' : ''}）；将神${p.jiangShen.stem || ''}${p.jiangShen.branch}（${p.jiangShen.yinYang}${p.jiangShen.element}，按${p.jiangShen.elementBasis}，月令${p.jiangShen.seasonState}${p.jiangShen.isVoid ? '，空' : ''}）；贵神${p.guiShen.stem || ''}${p.guiShen.branch}乘${p.guiShen.god || ''}（${p.guiShen.yinYang}${p.guiShen.element}，按${p.guiShen.elementBasis}，月令${p.guiShen.seasonState}${p.guiShen.isVoid ? '，空' : ''}）；人元${p.renYuan.stem || ''}${p.renYuan.branch}（${p.renYuan.yinYang}${p.renYuan.element}，按${p.renYuan.elementBasis}，月令${p.renYuan.seasonState}${p.renYuan.isVoid ? '，空' : ''}）`,
    `动爻：${audited.movements.map((item) => `${item.category}${item.name}（${item.trigger}）`).join('；') || '未触发五动或三动'}`,
    `四位关系：贵将${audited.relations.guiToJiang}；贵人${audited.relations.guiToRen}；将地${audited.relations.jiangToDi}；人地${audited.relations.renToDi}；贵地${audited.relations.guiToDi}`,
    audited.xunKong.length ? `旬空：${audited.xunKong.join('、')}` : '',
    evidenceAnalysis.promptText ? `结构化证据：${evidenceAnalysis.promptText}` : '',
    audited.summary ? `简要提示：${audited.summary}` : '',
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
