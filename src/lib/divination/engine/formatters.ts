import type {
  AlmanacData,
  AstrolabeData,
  DivinationData,
  LiurenData,
  LiuyaoData,
  MeihuaData,
  QimenData,
  SsgwData,
  SupplementaryInfo,
  TarotData,
  TaiyiResult,
} from '../../../types/divination';
import { LunarUtil, getDivinationTime } from 'mingyu-core/calendar';
import { analyzeQimenEvidence } from '@core/divination/algorithms/qimen';
import { analyzeAlmanacEvidence } from '@core/divination/algorithms/almanac';
import { LIUCHONG_MAP } from '@core/ganzhi';
import type { DivinationMethodId } from '@core/divination/config';
import { analyzeLiuyaoEvidence } from '@core/divination/algorithms/liuyao';
import { analyzeMeihuaEvidence } from '@core/divination/algorithms/meihua';
import { analyzeLiurenEvidence } from '@core/divination/algorithms/liuren';

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

export function buildSection(title: string, content: string) {
  const body = content.trim();
  if (!body) {
    return '';
  }

  return `${title}\n${body}`;
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
  const voidText = data.voidBranches?.length ? `空亡${data.voidBranches.join('、')}` : '';
  const hiddenText = data.hiddenSpirits?.length
    ? `伏神${data.hiddenSpirits.map(formatHiddenSpirit).join('；')}`
    : '';

  return [
    movingText ? `动变触发：${movingText}` : '静卦：世应、用神旺衰、月日冲合',
    voidText,
    hiddenText,
  ]
    .filter(Boolean)
    .join('；');
}

function createMeihuaTimingEvidence(data: MeihuaData) {
  const seasonBasis =
    data.analysis.monthBranch && data.analysis.monthElement
      ? `${data.analysis.monthBranch}月（${data.analysis.monthElement}令）`
      : `${data.analysis.season}季`;

  return [
    `动爻第${data.movingYao.position}爻`,
    `${seasonBasis}体卦${data.analysis.tiSeasonState}、用卦${data.analysis.yongSeasonState}`,
    `互卦${data.interName || data.interHexagram?.name || '无'}主过程，变卦${data.changedName || data.changedHexagram?.name || '无'}主结果`,
  ]
    .filter(Boolean)
    .join('；');
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
      const changeRelations = item.changeRelations?.length
        ? [...new Set(item.changeRelations)]
        : item.changeRelation
          ? [item.changeRelation]
          : [];
      const changedText = item.changedYao
        ? `化${item.changedYao.liuqin}${item.changedYao.dizhi}${item.changedYao.wuxing}${changeRelations.length ? `（${changeRelations.join('、')}）` : item.changedYao.isVoid ? '（变空）' : ''}${item.changeDirection ? `（${item.changeDirection}）` : ''}`
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
    ? `用神主线：${selectedUsefulGod.label}${selectedUsefulGod.relative ? `（${selectedUsefulGod.relative}）` : ''}；取用依据${selectedUsefulGod.reason}；盘中对应${selectedUsefulGod.references.map((item) => `${item.source === '伏神' ? '伏神' : ''}第${item.position}爻${item.sixRelative}${item.branch}${item.wuxing}`).join('、') || '无直接对应'}`
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
  const sanheDetail = sanheParts.length ? `三合局：${sanheParts.join('；')}` : null;
  const sanxingDetail = data.sanxingInYaos?.length
    ? `三刑：${data.sanxingInYaos.map((s) => `${s.branches.join('、')}构成${s.type}`).join('；')}`
    : null;
  const guaShenDetail = data.guaShen
    ? `卦身：月卦身在${data.guaShen.branch}，${data.guaShen.sixRelative}临第${data.guaShen.position}爻`
    : null;
  return [
    '占法：六爻',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}${data.palace?.name ? `（${data.palace.name}宫）` : ''}；变卦${data.changedName || '无'}；互卦${data.interName || '无'}`,
    `核心资料：空亡${data.voidBranches?.join('、') || '无'}；动爻${movingYaos}；世应${worldYao ? `世爻在第${worldYao.position}爻` : '世爻未列'}、${responseYao ? `应爻在第${responseYao.position}爻` : '应爻未列'}；特殊卦式${data.specialPattern || '常规卦'}`,
    data.palaceStage ? `八宫卦位：${data.palaceStage}` : '',
    hexagramRelationText ? `整卦关系：${hexagramRelationText}` : '',
    fanfuRelationText ? `反伏关系：${fanfuRelationText}` : '',
    worldYao ? `六亲持世：第${worldYao.position}爻${worldYao.sixRelative}持世` : '',
    usefulGodMainLine,
    godChainText,
    `世应动变：${worldYao ? `世爻${formatLiuyaoYaoBrief(worldYao)}` : '世爻未列'}；${responseYao ? `应爻${formatLiuyaoYaoBrief(responseYao)}` : '应爻未列'}；${changingLines.length ? `动变${changingLines.join('、')}` : '无动变'}`,
    `空亡与伏神：${voidYaoText.length ? `空亡爻位${voidYaoText.join('、')}` : `空亡${data.voidBranches?.join('、') || '无'}未直接落到本卦爻位`}；伏神${hiddenSpiritText}`,
    `月日触发：${monthDayEvidence}`,
    `应期资料：${timingEvidence}`,
    sanheDetail ? sanheDetail : '',
    sanxingDetail ? sanxingDetail : '',
    guaShenDetail ? guaShenDetail : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatMeihuaInfo(data: MeihuaData, supplementaryInfo?: SupplementaryInfo) {
  const method =
    supplementaryInfo?.meihuaSettings?.method ??
    data.calculation?.method ??
    data.calculation?.methodKey;
  const methodLabelMap: Record<string, string> = {
    time: '时间起卦法',
    number: '数字起卦法',
    random: '随机起卦法',
    timeTrigram: '时间起卦法（兼容）',
  };
  const methodLabel = method ? methodLabelMap[method] || method : '未给出';
  const meihuaNumber =
    typeof supplementaryInfo?.meihuaSettings?.number === 'number'
      ? supplementaryInfo.meihuaSettings.number
      : typeof data.calculation?.number === 'number'
        ? data.calculation.number
        : undefined;
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
        ? `- 第${item.position}爻（动，属${item.tiYong}）：${item.yaoType}爻${fact?.promptText ? `；${fact.promptText}` : ''}`
        : `- 第${item.position}爻（静，属${item.tiYong}）：${item.yaoType}爻`;
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
    movingYaoFact ? `动爻传统资料：${movingYaoFact.promptText}` : '',
    `体用：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${data.analysis.tiYongRelation}`,
    `互卦：${processHexagram}${interRoleText}；${data.analysis.inter1Relation}；${data.analysis.inter2Relation}`,
    `变卦：${resultHexagram}${changedTiYongText}；结果关系${data.analysis.changedRelation}`,
    `月令与起卦：${seasonBasis}，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}；起卦法${methodLabel}${typeof meihuaNumber === 'number' ? `；起卦数字${meihuaNumber}` : ''}`,
    `应期资料：${timingEvidence}`,
    '结构明细：',
    ...yaoLines,
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
    ? `取用主线：${primaryUsefulPalace.name}（${primaryUsefulPalace.direction}，${primaryUsefulPalace.element}）；门星神干为${[primaryUsefulPalace.palace.renPan.door, primaryUsefulPalace.palace.tianPan.star, primaryUsefulPalace.palace.tianPan.companionStar, primaryUsefulPalace.palace.shenPan.god, primaryUsefulPalace.palace.tianPan.stem, primaryUsefulPalace.palace.tianPan.companionStem, primaryUsefulPalace.palace.diPan.stem].filter(Boolean).join('、')}`
    : '取用主线：值符、值使、时干落宫，格局与宫间生克';
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
    .map(
      (item) =>
        `${item.name}（${item.traditionalTone}${item.palaces.length ? `；${item.palaces.map((palace) => `${palace}宫`).join('、')}` : ''}）`,
    )
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
            `${item.name}（${item.traditionalTone}${item.palaces.length ? `；${item.palaces.map((palace) => `${palace}宫`).join('、')}` : ''}）`,
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
        .map(
          (item) =>
            `${item.name}（${item.traditionalTone}${item.palaces.length ? `；${item.palaces.map((palace) => `${palace}宫`).join('、')}` : ''}）`,
        )
        .join('；')
    : '';
  const specialConditionsText = data.specialConditions?.description?.trim()
    ? data.specialConditions.description.trim()
    : '';
  const solarTerm = data.seasonality?.jieQiPhase.solarTermEvidence;
  const moonPhase = data.seasonality?.moonPhaseEvidence;
  const juTerm = data.timeInfo?.juTerm || data.timeInfo?.solarTerm || '未列';

  return [
    '占法：奇门遁甲',
    focusText,
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符${data.zhiFu}；值使${data.zhiShi}`,
    `定局资料：实际节气${data.timeInfo?.solarTerm || '未列'}；定局${`${juTerm} ${data.timeInfo?.epoch || ''}`.trim()}；格局标签${data.patternTags?.join('、') || '无'}`,
    seasonalitySummary ? `节令背景：${seasonalitySummary}` : '',
    solarTerm
      ? `节气交接：${solarTerm.name}交节时刻 ${solarTerm.utcDateTime}（UTC），太阳黄经${solarTerm.targetLongitudeDegrees.toFixed(0)}°。`
      : '',
    moonPhase
      ? `月相：${moonPhase.eightPhaseName}（${moonPhase.waxing ? '盈' : '亏'}），日月黄经差约${moonPhase.phaseAngleDegrees.toFixed(2)}°，照明约${moonPhase.illuminationPercent.toFixed(1)}%。`
      : '',
    data.seasonality && !data.seasonality.lunarPhaseConsistency
      ? `月相口径：历法八相为${data.seasonality.lunarPhaseDetail}，日月黄经八分法为${data.seasonality.moonPhaseEvidence.eightPhaseName}。`
      : '',
    ganzhiInteractionSummary ? `四柱互动：${ganzhiInteractionSummary}` : '',
    `值符值使与时干：值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '未见落宫'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '未见落宫'}；时干${hourStem}${hourStemPalaces.length ? `见于${hourStemPalaces.map((item) => item.name).join('、')}` : '未见落宫'}`,
    `旬空与马星：旬空${voidText}；马星${horseText}`,
    specialConditionsText ? `特殊时辰：${specialConditionsText}` : '',
    patternSummary ? `基础格局：${patternSummary}` : '',
    classicPatternSummary ? `经典格局：${classicPatternSummary}` : '',
    patternComboSummary ? `复合格局：${patternComboSummary}` : '',
    stemRelationSummary ? `天地盘干：${stemRelationSummary}` : '',
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
        `${item.stage}${item.branch}乘${item.god}，${item.relation}${item.note ? `，${item.note}` : ''}`,
    )
    .join('；');
  const voidHits = data.threeTransmissions
    .filter((item) => data.xunKong?.includes(item.branch))
    .map((item) => `${item.stage}${item.branch}`);
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
        .map((item) => `${item.sources.join('、')}：${item.name}，${item.originalText}`)
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
    .map((item) => item.originalText)
    .join('；');
  const timingText = evidenceAnalysis.timingFacts
    .map((item) => item.promptText)
    .filter((text) => !/未给出|不硬换|不得换算|只判断/.test(text))
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
    timingText ? `应期资料：${timingText}` : '',
    data.xunKong?.length
      ? `旬空：${data.xunKong.join('、')}${voidHits.length ? `，命中${voidHits.join('、')}` : ''}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatTarotInfo(data: TarotData) {
  const cardLines = data.cards.map(
    (card) =>
      `- ${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}${card.keywords.length ? `；关键词：${card.keywords.join('、')}` : ''}${card.element ? `；元素主题：${card.element}` : ''}${card.archetype ? `；牌阶主题：${card.archetype}` : ''}`,
  );

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
  return [
    '占法：三山国王灵签',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `签号：第${data.number}签`,
    `签题：《${data.title}》`,
    `签诗：${data.poem}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatAlmanacAnnualDirectionGods(
  candidate: ReturnType<typeof analyzeAlmanacEvidence>['candidates'][number] | undefined,
) {
  const gods = candidate?.traditionalFacts.filter((fact) => fact.kind === '全年方位神') ?? [];
  if (!gods.length) return '';
  return `岁支十二神方位${gods.map((god) => `${god.name}${god.branch}${god.direction}`).join('、')}`;
}

function formatAlmanacInfo(data: AlmanacData) {
  const evidenceAnalysis = analyzeAlmanacEvidence(data);
  const topDays = data.days.slice(0, 8);
  const participantLines = data.participants.map((item) => {
    const usefulEvidenceAvailable =
      item.usefulGods.length > 0 && item.usefulGods.length <= 3 && item.avoidGods.length > 0;
    const useful = usefulEvidenceAvailable
      ? `，喜用资料${item.usefulGods.join('、')}，忌神资料${item.avoidGods.join('、')}`
      : '';
    return `- ${item.name}：公历${item.solarDate}，农历${item.lunarDate}，生肖${item.zodiac}，日主${item.dayMaster}${item.dayMasterElement}，四柱${item.pillars.year}年 ${item.pillars.month}月 ${item.pillars.day}日 ${item.pillars.hour}时${useful}`;
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
        ? `（${item.twentyEightStarDetail.fullName}，${item.twentyEightStarDetail.zone}方七宿，${item.twentyEightStarDetail.fortune}）`
        : '';
    const nineStarDetail = nineStarFact
      ? `（${nineStarFact.promptText}）`
      : item.nineStarDetail
        ? `（${item.nineStarDetail.fullName}，北斗${item.nineStarDetail.dipper}，方位${item.nineStarDetail.direction}）`
        : '';
    const godText = item.gods.length ? `吉神${item.gods.join('、')}` : '';
    const annualDirectionGodsText = formatAlmanacAnnualDirectionGods(candidate);
    const evidence = [
      `宜${item.recommends.slice(0, 8).join('、') || '无'}`,
      `忌${item.avoids.slice(0, 8).join('、') || '无'}`,
      godText,
      annualDirectionGodsText,
      item.cautions?.length ? `黄历忌项：${item.cautions.join('、')}` : '',
      item.bestHours?.length
        ? `时辰资料${item.bestHours
            .map((hour) => `${hour.name}${hour.range}（${hour.ganzhi}、${hour.twelveStar}）`)
            .join('、')}`
        : '',
    ].filter(Boolean);
    return `- 第${index + 1}候选：${item.date} ${item.weekday}，${item.lunarDate}，${item.ganzhi.year}年 ${item.ganzhi.month}月 ${item.ganzhi.day}日；${item.dayOfficer}执日，十二神${item.twelveStar}，二十八宿${item.twentyEightStar}${starDetail}，九星${item.nineStar}${nineStarDetail}，${item.clash}；${evidence.join('；')}`;
  });
  return [
    '占法：黄历择日',
    `核心结构：事项范围：${data.topicLabel}；候选日期：${data.startDate} 至 ${data.endDate}`,
    participantLines.length ? '参与人资料：' : '',
    ...participantLines,
    '候选日期明细：',
    ...dayLines,
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
  const trueSolarCorrection =
    data.birth.trueSolarEvidence && data.birth.trueSolarDateTime
      ? `出生时间校正：${data.birth.trueSolarEvidence.correctionFacts
          .map((item) => item.promptText)
          .join('；')}；采用真太阳时${data.birth.trueSolarDateTime}。`
      : '';
  const aspectSummary = data.aspects
    .slice(0, 3)
    .map(
      (item) =>
        `${item.body1}${item.symbol}${item.body2}（${item.type}，${describeAspectCloseness(item)}等级）`,
    )
    .join('；');

  return [
    '占法：星盘',
    `出生信息：${data.birth.dateTime}，位置${data.birth.location}，时区 UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    trueSolarCorrection,
    `核心结构：太阳${sun?.formatted || '未列'}；月亮${moon?.formatted || '未列'}；上升${ascendant?.formatted || '未列'}；共${data.planets.length}颗星体、${data.houses.length}个宫位、${data.aspects.length}组主要相位`,
    `盘面概况：逆行星体${data.summary.retrograde.join('、') || '无'}；格局${data.summary.patterns.join('、') || '无明显格局'}`,
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
    `十六神：${data.sixteenGods.map((item) => `${item.branch}${item.god}`).join('、')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatDivinationInfo(
  method: Exclude<DivinationMethodId, 'random'>,
  data: DivinationData,
  _question: string,
  supplementaryInfo?: SupplementaryInfo,
  options?: { liuyaoTemplate?: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' },
) {
  switch (method) {
    case 'liuyao':
      return formatLiuyaoInfo(data as LiuyaoData, options?.liuyaoTemplate);
    case 'meihua':
      return formatMeihuaInfo(data as MeihuaData, supplementaryInfo);
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
    case 'astrolabe':
      return formatAstrolabeInfo(data as AstrolabeData);
    case 'taiyi':
      return formatTaiyiInfo(data as TaiyiResult);
    default:
      return '占卜信息暂不可用';
  }
}
