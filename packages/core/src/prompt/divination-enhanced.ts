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
} from '../types/divination';
import { analyzeQimenEvidence } from '../divination/algorithms/qimen';
import { analyzeAlmanacEvidence } from '../divination/algorithms/almanac';
import { LIUCHONG_MAP, SIXTY_CYCLE } from '../ganzhi';
import {
  formatTianPanStars,
  formatTianPanStems,
  getDunJiaStem,
  hasTianPanStem,
} from '../divination/algorithms/qimen/helpers/palace-utils';
import type { DivinationMethodId } from 'mingyu-core/divination/config';
import { analyzeLiuyaoEvidence } from '../divination/algorithms/liuyao';
import { analyzeLenormandEvidence } from '../divination/lenormand-evidence';
import type { HuangjiJingshiResult } from '../huangji-jingshi';
import { formatHuangjiCivilYear } from '../huangji-jingshi/standard';

function joinPromptSentences(items: Array<string | undefined>) {
  return items
    .filter((item): item is string => Boolean(item?.trim()))
    .map((item) => item.trim().replace(/[。、；，]+$/u, ''))
    .join('；');
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

  return relations.labels.join('；');
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

  if (monthBranch && monthBranch === dayBranch) {
    return describeBranchHit('月建、日辰', monthBranch, monthClash);
  }

  return [
    describeBranchHit('月建', monthBranch, monthClash),
    describeBranchHit('日辰', dayBranch, dayClash),
  ].join('；');
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
  const seasonBasis =
    data.analysis.monthBranch && data.analysis.monthElement
      ? `${data.analysis.monthBranch}月（${data.analysis.monthElement}令）`
      : `${data.analysis.season}季`;

  return [
    `动爻第${data.movingYao.position}爻`,
    `${seasonBasis}体卦${data.analysis.tiSeasonState}、用卦${data.analysis.yongSeasonState}`,
    `互卦${data.interName || data.interHexagram?.name || '无'}主过程，变卦${data.changedName || data.changedHexagram?.name || '无'}主结果`,
    numberEvidence,
    timeEvidence ? `时间数：${timeEvidence}` : '',
    `起卦法：${methodLabel}`,
  ]
    .filter(Boolean)
    .join('；');
}

function formatLiuyaoInfo(
  data: LiuyaoData,
  topic: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' = 'general',
) {
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
      const breakText = item.isHiddenMove
        ? '（暗动）'
        : item.isDayBreak
          ? '（日破）'
          : item.isChanging && item.isDayClash
            ? '（日辰冲动）'
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
    : '';
  const hexagramRelationText = formatLiuyaoHexagramRelation(data);

  const fanfuRelationText = formatLiuyaoFanFuRelation(data);
  const evidenceAnalysis = analyzeLiuyaoEvidence(data, { topic });
  const selectedUsefulGod = evidenceAnalysis.candidates.find(
    (item) => item.key === evidenceAnalysis.selectionFact.selectedCandidateKey,
  );
  const usefulGodMainLine = selectedUsefulGod
    ? `用神：${selectedUsefulGod.relative || selectedUsefulGod.label}；盘面${selectedUsefulGod.references.map((item) => `${item.source === '伏神' ? '伏神' : ''}第${item.position}爻${item.sixRelative}${item.branch}${item.wuxing}`).join('、') || '未见'}；支持${selectedUsefulGod.support.join('、') || '盘面平稳'}；限制${selectedUsefulGod.constraints.join('、') || '未见明显空破墓退'}`
    : `用神主线：${evidenceAnalysis.selectionFact.promptText}`;
  const godChain = evidenceAnalysis.godChain.filter((item) => item.role !== '用神');
  const godChainText = godChain.length
    ? `生克关系：${godChain
        .map(
          (item) =>
            `${item.role}${item.wuxing || ''}${item.status === '盘中有对应' ? `见${item.references.map((ref) => `第${ref.position}爻${ref.sixRelative}${ref.branch}${ref.wuxing}`).join('、')}` : '未见'}`,
        )
        .join('；')}`
    : '';
  const monthDayEvidence = createLiuyaoMonthDayEvidence(data);
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
  return [
    '占法：六爻',
    `核心结构：主卦${data.originalName}${data.palace?.name ? `（${data.palace.name}宫）` : ''}；变卦${data.changedName || '无'}；互卦${data.interName || '无'}${data.specialPattern ? `；卦式${data.specialPattern}` : ''}`,
    data.palaceStage ? `八宫卦位：${data.palaceStage}` : '',
    hexagramRelationText ? `整卦关系：${hexagramRelationText}` : '',
    fanfuRelationText ? `反伏关系：${fanfuRelationText}` : '',
    worldYao || responseYao
      ? `世应：${worldYao ? `世爻${formatLiuyaoYaoBrief(worldYao)}` : '世爻未列'}；${responseYao ? `应爻${formatLiuyaoYaoBrief(responseYao)}` : '应爻未列'}`
      : '',
    usefulGodMainLine,
    godChainText,
    `动变：${changingLines.length ? changingLines.join('、') : '无'}`,
    `旬空${data.voidBranches?.length ? data.voidBranches.join('、') : '未列'}${voidYaoText.length ? `；命中${voidYaoText.join('、')}` : ''}${hiddenSpiritText ? `；伏神${hiddenSpiritText}` : ''}`,
    `月日触发：${monthDayEvidence}`,
    sanheDetail ? sanheDetail : '',
    sanxingDetail ? sanxingDetail : '',
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
  const timingEvidence = createMeihuaTimingEvidence(data);
  const seasonBasis =
    data.analysis.monthBranch && data.analysis.monthElement
      ? `${data.analysis.monthBranch}月（${data.analysis.monthElement}令）`
      : `${data.analysis.season}季`;

  return [
    '占法：梅花易数',
    `核心结构：主卦${data.originalName}；互卦${data.interName || '无'}；变卦${data.changedName || '无'}`,
    `体用：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${data.analysis.tiYongRelation}`,
    `互卦：${processHexagram}${interRoleText}；${data.analysis.inter1Relation}；${data.analysis.inter2Relation}`,
    `变卦：${resultHexagram}${changedTiYongText}；结果关系${data.analysis.changedRelation}`,
    `月令与起卦：${seasonBasis}，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}；起卦法${methodLabel}${typeof calculation?.number === 'number' ? `；起卦数字${calculation.number}` : ''}`,
    timingEvidence
      ? `应期线索：${timingEvidence
          .split('；')
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 2)
          .join('；')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatXiaoliurenInfo(data: XiaoliurenData) {
  return [
    '占法：小六壬',
    `起课：农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}`,
    '起课过程：',
    `- 定月宫：${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月从大安顺数，落${data.sequence.month.name}`,
    `- 定日宫：从月宫${data.sequence.month.name}起初一，顺数至${data.lunarDay}日，落${data.sequence.day.name}`,
    `- 定时宫：从日宫${data.sequence.day.name}起子时，顺数至${data.hourLabel}，落${data.sequence.hour.name}`,
    `取用层级：时宫${data.sequence.hour.name}为本次占得宫与主证；月宫${data.sequence.month.name}、日宫${data.sequence.day.name}为逐宫顺数位置`,
    `占得宫：${data.primary.name}`,
    `歌诀原文：${data.primary.verse}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function getBirthYearGanZhi(year: number) {
  const cycleIndex =
    (((year - 1984) % SIXTY_CYCLE.length) + SIXTY_CYCLE.length) % SIXTY_CYCLE.length;
  return SIXTY_CYCLE[cycleIndex];
}

function formatQimenBirthStemPalaces(data: QimenData, ganZhi: string, label: string) {
  const birthStem = ganZhi.charAt(0);
  const visibleStem = getDunJiaStem(ganZhi);
  const palaces = data.jiuGongGe.filter((palace) => hasTianPanStem(palace, visibleStem));
  const stemText = birthStem === visibleStem ? birthStem : `${birthStem}遁${visibleStem}`;
  if (!palaces.length) return `${label}${stemText}的天盘落宫未定位`;

  return `${label}${stemText}落${palaces
    .map(
      (palace) =>
        `${palace.name}（${palace.direction}，五行${palace.element}；八门${palace.renPan.door}、九星${formatTianPanStars(palace) || '未列'}、八神${palace.shenPan.god}、天盘${formatTianPanStems(palace) || '未列'}、地盘${palace.diPan.stem}${data.voidPalaces?.some((item) => item.palace === palace.gong) ? '，逢空' : ''}${data.horseStar?.palace === palace.gong ? '，马星同宫' : ''}）`,
    )
    .join('、')}`;
}

function formatQimenBirthInfo(data: QimenData, supplementaryInfo?: SupplementaryInfo) {
  const birthYear = supplementaryInfo?.birthYear;
  if (!Number.isSafeInteger(birthYear) || birthYear === undefined) return '';

  const ganZhi = getBirthYearGanZhi(birthYear);
  const previousGanZhi = getBirthYearGanZhi(birthYear - 1);
  return [
    `年命资料：公历${birthYear}年按年中口径取年命干支${ganZhi}，命干${ganZhi.charAt(0)}；立春前出生则取年命干支${previousGanZhi}，命干${previousGanZhi.charAt(0)}`,
    formatQimenBirthStemPalaces(data, ganZhi, '年命落宫（年中口径）：命干'),
    formatQimenBirthStemPalaces(data, previousGanZhi, '年命落宫（立春前备选）：命干'),
  ].join('\n');
}

function formatQimenInfo(data: QimenData, supplementaryInfo?: SupplementaryInfo) {
  const evidenceAnalysis = data.evidenceAnalysis?.palaceFacts
    ? data.evidenceAnalysis
    : analyzeQimenEvidence(data);
  const primaryUsefulPalace = evidenceAnalysis.candidates[0];
  const formatUsefulPalaceFactLines = (items: string[], fallback: string) =>
    (items.length ? items : [fallback])
      .filter(
        (item) =>
          !items.some(
            (other) =>
              other !== item &&
              /^该宫带有/u.test(other) &&
              /^(门迫|击刑|入墓|空亡)[：：]/u.test(item),
          ),
      )
      .map((item) => {
        const compact = joinPromptSentences([item])
          .split('；')[0]
          .replace(/，主[^，。；]*$/u, '');
        return compact.includes('：') ? compact.split('：')[0] : compact.split('，')[0];
      });
  const focusSupport = primaryUsefulPalace
    ? formatUsefulPalaceFactLines(primaryUsefulPalace.support, '盘面平稳')
        .filter((item) => item !== '值符同宫')
        .filter((item) => !/适合|有利|宜|可用|可作为/u.test(item))
        .slice(0, 2)
    : [];
  const focusConstraints = primaryUsefulPalace
    ? formatUsefulPalaceFactLines(primaryUsefulPalace.constraints, '未见明显空亡入墓')
        .filter((item) => item !== `${primaryUsefulPalace.palace.renPan.door}同宫`)
        .slice(0, 2)
        .map((item) => item.replace(/^该宫带有/u, ''))
    : [];
  const focusLines = primaryUsefulPalace
    ? [
        `取用主线：优先看${primaryUsefulPalace.name}（${primaryUsefulPalace.direction}，${primaryUsefulPalace.element}）`,
        `- 门星神干：${[primaryUsefulPalace.palace.renPan.door, primaryUsefulPalace.palace.tianPan.star, primaryUsefulPalace.palace.tianPan.companionStar, primaryUsefulPalace.palace.shenPan.god, primaryUsefulPalace.palace.tianPan.stem, primaryUsefulPalace.palace.tianPan.companionStem, primaryUsefulPalace.palace.diPan.stem].filter(Boolean).join('、')}`,
        `宫况：${[...focusSupport, ...focusConstraints].join('；')}`,
      ]
    : ['取用主线：以值符、值使、时干落宫为先，再看格局与宫间生克'];
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
  const focusText = focusLines.join('；');
  const classicPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '经典格局',
  );
  const classicPatternLines = classicPatternFacts
    .filter((item) => !focusText.includes(item.name))
    .slice(0, 1)
    .map((item) => item.name);
  const seasonalitySummary = data.seasonality
    ? [
        `节气五行${data.seasonality.seasonalElement || '未列'}`,
        `日干${data.seasonality.dayStem}${data.seasonality.seasonRelation}`,
      ].join('；')
    : '';
  const specialConditionsText = data.specialConditions?.description?.trim() || '';
  const juTerm = data.timeInfo?.juTerm || data.timeInfo?.solarTerm || '未列';
  const birthInfo = formatQimenBirthInfo(data, supplementaryInfo);

  return [
    '占法：奇门遁甲',
    `起局方法：${data.method === 'feipan' ? '飞盘法' : '转盘法'}；${data.juMethod === 'zhirun' ? '置闰法定局' : '拆补法定局'}；${data.scope ? ({ hour: '时家', day: '日家', month: '月家', year: '年家' } as const)[data.scope] : '时家'}`,
    ...focusLines,
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；${`${juTerm} ${data.timeInfo?.epoch || ''}`.trim()}`,
    birthInfo,
    seasonalitySummary ? `节令：${seasonalitySummary}` : '',
    `值符值使与时干：值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '未见落宫'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '未见落宫'}；时干${hourStem}${hourStemPalaces.length ? `见于${hourStemPalaces.map((item) => item.name).join('、')}` : '未见落宫'}`,
    `旬空与马星：旬空${voidText}；马星${horseText}`,
    specialConditionsText ? `特殊时辰：${specialConditionsText}` : '',
    classicPatternLines.length ? `其他关键格局：${classicPatternLines.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLiurenInfo(data: LiurenData) {
  const lessonLines = data.fourLessons.map(
    (item) => `${item.name}${item.upper}临${item.lower}乘${item.god}，${item.relation}`,
  );
  const transmissionLines = data.threeTransmissions.map(
    (item) => `${item.stage}${item.branch}乘${item.god}，${item.relation}`,
  );
  const voidHits = data.threeTransmissions
    .filter((item) => data.xunKong?.includes(item.branch))
    .map((item) => `${item.stage}${item.branch}`);
  const mainLineText = [
    data.transmissionRule ? `取传${data.transmissionRule}` : '',
    data.transmissionPattern ? `传态${data.transmissionPattern}` : '',
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
    data.xunKong?.length
      ? `旬空${data.xunKong.join('、')}${voidHits.length ? `（命中${voidHits.join('、')}）` : ''}`
      : '',
  ].filter(Boolean);
  const guaTiText = data.guaTi?.length ? data.guaTi.join('、') : '';
  const guaTiSection = guaTiText ? `课体：${guaTiText}` : '';
  const shenShaText = (
    data.shenShaFacts?.length
      ? data.shenShaFacts.map((item) => `${item.name}在${item.target}`)
      : data.shenShaSummary || []
  )
    .slice(0, 6)
    .join('、');
  return [
    '占法：大六壬',
    `核心结构：${plateSummaryText.join('；')}`,
    data.dayStemResidence ? `日干寄宫：${data.ganzhi.day.charAt(0)}寄${data.dayStemResidence}` : '',
    mainLineText.length ? `课传主线：${mainLineText.join('；')}` : '',
    guaTiSection,
    shenShaText ? `神煞：${shenShaText}` : '',
    lessonLines.length ? '四课：' : '',
    ...lessonLines.map((item) => `- ${item}`),
    transmissionLines.length ? '三传：' : '',
    ...transmissionLines.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatTarotInfo(data: TarotData) {
  const cardLines = data.cards.map(
    (card) =>
      `- ${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}${card.keywords.length ? `；关键词：${card.keywords.join('、')}` : ''}${card.element ? `；牌组属性：${card.element}` : ''}`,
  );

  return [
    '占法：塔罗',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    data.cards.some((card) => card.reversed)
      ? '正逆位口径：逆位表示该牌主题可能受阻、过度、内化或方向偏离，结合所在牌位与整组牌序判断'
      : '',
    '牌位明细：',
    ...cardLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSsgwInfo(data: SsgwData) {
  const details = data.details ?? {};
  const rawBasicInterpretation =
    details['核心寓意']?.trim() || details['解签']?.trim() || details['签意']?.trim() || '';
  const compactText = (value: string) => value.replace(/[\s，。；、！？!?]/gu, '');
  const poemText = compactText(data.poem);
  const basicInterpretation =
    rawBasicInterpretation && !poemText.includes(compactText(rawBasicInterpretation))
      ? rawBasicInterpretation
      : (details['解签总论']
          ?.trim()
          .split(/(?<=[。！？!?])/u)
          .slice(0, 2)
          .join('') ?? '');
  const excludedFields = new Set([
    '吉凶',
    '典故',
    '核心寓意',
    '解签',
    '签意',
    '行动建议',
    '风险提醒',
    '解签总论',
    '整体运势',
    '新年/新阶段',
    '提醒',
    '此签核心',
  ]);
  const supplementaryInterpretationLines = Object.entries(details)
    .filter(([key, value]) => !excludedFields.has(key) && value.trim())
    .map(([key, value]) => `${key}：${value.trim()}`);
  const story = data.story?.trim() || '';

  return [
    '占法：三山国王灵签',
    `签号：第${data.number}签`,
    `签题：《${data.title}》`,
    `签诗：${data.poem}`,
    details['吉凶']?.trim() ? `吉凶级别：${details['吉凶'].trim()}` : '',
    story ? `典故：${story}` : '',
    basicInterpretation ? `基础解签：${basicInterpretation}` : '',
    supplementaryInterpretationLines.length ? '补充解释：' : '',
    ...supplementaryInterpretationLines.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatAlmanacInfo(data: AlmanacData) {
  const evidenceAnalysis = analyzeAlmanacEvidence(data);
  const participantLines = data.participants.map((item) => {
    const usefulEvidenceAvailable =
      item.usefulGods.length > 0 && item.usefulGods.length <= 3 && item.avoidGods.length > 0;
    const useful = usefulEvidenceAvailable
      ? `喜用资料${item.usefulGods.join('、')}，忌神资料${item.avoidGods.join('、')}`
      : '';
    return `- ${item.name}：${item.gender || '性别未填'}；四柱${item.pillars.year} ${item.pillars.month} ${item.pillars.day} ${item.pillars.hour}${useful ? `；${useful}` : ''}`;
  });
  const promptDays = [...data.days].sort((left, right) => left.date.localeCompare(right.date));
  const dayLines = promptDays.flatMap((item, index) => {
    const candidate = evidenceAnalysis.candidates.find(
      (candidateItem) => candidateItem.date === item.date,
    );
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
    const topicFacts = item.topicMatchFacts ?? [];
    const topicRecommendations = unique(
      topicFacts.filter((fact) => fact.status === '支持').flatMap((fact) => fact.matchedItems),
    );
    const topicAvoids = unique(
      topicFacts.filter((fact) => fact.status === '限制').flatMap((fact) => fact.matchedItems),
    );
    const needsLegacyFallback = data.topic === 'custom' || topicFacts.length === 0;
    const recommendationText = topicRecommendations.length
      ? `事项宜${topicRecommendations.join('、')}`
      : needsLegacyFallback
        ? `宜节选${item.recommends.slice(0, 6).join('、') || '未列'}`
        : '';
    const avoidText = topicAvoids.length
      ? `事项忌${topicAvoids.join('、')}`
      : needsLegacyFallback
        ? `忌节选${item.avoids.slice(0, 6).join('、') || '未列'}`
        : '';
    const participantNotes = unique(item.participantNotes).filter(
      (note) => !/未见.*直接|未命中|未采用/u.test(note),
    );
    const hourText =
      data.timePreferences?.length && candidate?.usableHours.length
        ? candidate.usableHours.map((hour) => hour.name).join('、')
        : '';
    const conciseFacts = [
      recommendationText,
      avoidText,
      participantNotes.length ? `参与人${participantNotes.join('；')}` : '',
      hourText ? `备选时辰${hourText}` : '',
    ].filter(Boolean);
    return [
      `- 第${index + 1}日：${item.date} ${item.weekday}；${item.ganzhi.day}日；建除${item.dayOfficer}；十二神${item.twelveStar}；二十八宿${item.twentyEightStarDetail?.fullName ?? item.twentyEightStar}${item.twentyEightStarDetail?.fortune ? `（${item.twentyEightStarDetail.fortune}）` : ''}；${item.clash}`,
      conciseFacts.length ? `  ${conciseFacts.join('；')}` : '',
    ].filter(Boolean);
  });
  return [
    '占法：黄历择日',
    `核心结构：择日事项：${data.topicLabel}；候选日期：${data.startDate} 至 ${data.endDate}`,
    data.weekendPreference === 'prefer'
      ? '日期偏好：优先周末'
      : data.weekendPreference === 'avoid'
        ? '日期偏好：避开周末'
        : '',
    data.timePreferences?.length
      ? `时段条件：${[
          data.timePreferences.includes('work-hours') ? '工作日常规办事时段' : '',
          data.timePreferences.includes('morning') ? '优先上午' : '',
          data.timePreferences.includes('afternoon') ? '优先下午' : '',
        ]
          .filter(Boolean)
          .join('、')}`
      : '',
    participantLines.length ? '参与人资料：' : '',
    ...participantLines,
    `候选日期明细：共${data.days.length}日`,
    ...dayLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLenormandInfo(data: LenormandData) {
  const cardLines = data.cards.map((card) => {
    const placement = [
      card.house ? `落${card.house}宫` : '',
      card.row && card.column ? `第${card.row}排第${card.column}列` : '',
    ]
      .filter(Boolean)
      .join('，');
    return `- ${card.position}：${card.name}；关键词：${card.keywords.join('、')}${card.meaning ? `；基础牌义：${card.meaning}` : ''}${placement ? `；${placement}` : ''}`;
  });
  const combinationLines = (data.combinations ?? [])
    .filter((item) => item.source === '固定组合')
    .map((item) => `- ${item.card1}+${item.card2}：${item.meaning}`);
  const evidenceAnalysis = data.evidenceAnalysis?.structuredLayoutFacts
    ? data.evidenceAnalysis
    : analyzeLenormandEvidence(data);
  const layoutLines = evidenceAnalysis.structuredLayoutFacts
    .filter((item) => item.kind !== '大桌宫位')
    .map((item) => `- ${item.factText}`);
  return [
    '占法：雷诺曼',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    '牌位明细：',
    ...cardLines,
    ...(layoutLines.length ? ['布局关系：', ...layoutLines] : []),
    ...(combinationLines.length ? ['固定组合：', ...combinationLines] : []),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatAstrolabeInfo(data: AstrolabeData) {
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const coreBodies = new Set([
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
  ]);
  const planetLines = data.planets
    .filter((item) => coreBodies.has(item.name))
    .map(
      (item) =>
        `${item.label}${item.formatted}，第${item.house}宫${item.retrograde ? '，逆行' : ''}`,
    );
  const aspectLines = data.aspects
    .slice(0, 5)
    .map(
      (item) =>
        `${item.body1}${item.symbol}${item.body2}（${item.type}，容许度${item.orb.toFixed(2)}°）`,
    );

  return [
    '占法：星盘',
    `出生信息：${data.birth.name}，${data.birth.gender || '性别未填'}，${data.birth.dateTime}，位置${data.birth.location}，时区 UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    data.birth.isTrueSolarTime
      ? `出生时间校正：当地钟表时间${data.birth.standardDateTime || '未记录'}，采用真太阳时${data.birth.trueSolarDateTime || data.birth.dateTime}排盘。`
      : '',
    `上升：${ascendant?.formatted || '未列'}`,
    `主要格局：${data.summary.patterns.join('、') || '未见明显格局'}`,
    planetLines.length ? '星体位置：' : '',
    ...planetLines.map((item) => `- ${item}`),
    aspectLines.length ? '相位明细：' : '',
    ...aspectLines.map((item) => `- ${item}`),
  ]
    .filter(Boolean)

    .join('\n');
}

export function formatTaiyiInfo(data: TaiyiResult) {
  const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计' }[data.scope];
  const specialJudgments = data.judgments.filter(
    (item) => !/^(主算|客算|定算)\s*\d+\s*为/u.test(item),
  );
  return [
    `占法：太乙神数（${scopeLabel}）`,
    `起局时间：${data.dateTime}；本计干支：${data.ganZhi}；${data.yinYang}第${data.bureau}局`,
    `太乙：${data.taiyiPosition}（第${data.taiyiPalace}宫，${data.taiyiGua}卦，${data.taiyiDir}）`,
    `文昌（主目）：${data.wenChangPosition}；始击（客目）：${data.shiJiPosition}；计神：${data.jiShenPosition}`,
    `主客定算：主算${data.lordCount}；客算${data.guestCount}；定算${data.setCount}`,
    `将参：主大${data.lordGeneral}、主参${data.lordAssistant}；客大${data.guestGeneral}、客参${data.guestAssistant}；定大${data.setGeneral}、定参${data.setAssistant}`,
    specialJudgments.length ? `判断：${specialJudgments.join('；')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatHuangjiInfo(data: HuangjiJingshiResult) {
  const forecast = data.forecast;
  if (!forecast) {
    return [
      '占法：皇极经世',
      `目标年坐标：${data.input.year}`,
      `元会运世：第${data.position.yuan.indexFromEpoch + 1}元，第${data.position.hui.indexInYuan}会，第${data.position.yun.indexInHui}运，第${data.position.shi.indexInYun}世`,
    ].join('\n');
  }
  const { governing, yun, sixtyYear, decade, annual } = forecast.hexagrams;
  const dateTime = data.dateTimeForecast;
  return [
    '占法：皇极经世',
    dateTime
      ? `起盘时间：${dateTime.civilTime.dateTime}（${dateTime.civilTime.timezone}）；皇极历${dateTime.calendar.monthBranch}月第${dateTime.calendar.dayOfMonth}日；节气${dateTime.calendar.activeSolarTerm}`
      : '',
    `目标年份：${formatHuangjiCivilYear(annual.year)}（${annual.ganzhi}）`,
    `周期位置：第${forecast.hui.indexInYuan}会（${forecast.hui.branch}会），会内第${data.position.yun.indexInHui}运，运内第${data.position.shi.indexInYun}世，世内第${data.position.year.indexInShi}年`,
    `会内统卦：${governing.hexagram.name}，${formatHuangjiCivilYear(governing.startYear)}至${formatHuangjiCivilYear(governing.endYear)}`,
    `运卦：${yun.hexagram.name}，${formatHuangjiCivilYear(yun.startYear)}至${formatHuangjiCivilYear(yun.endYear)}`,
    `六十年统卦：${sixtyYear.hexagram.name}，${formatHuangjiCivilYear(sixtyYear.startYear)}至${formatHuangjiCivilYear(sixtyYear.endYear)}`,
    `十年卦：${decade.hexagram.name}，${formatHuangjiCivilYear(decade.startYear)}至${formatHuangjiCivilYear(decade.endYear)}`,
    `值年卦：${annual.name}（${annual.upper}上、${annual.lower}下）；互卦${forecast.relatedHexagrams.mutual.name}；错卦${forecast.relatedHexagrams.opposite.name}；综卦${forecast.relatedHexagrams.reversed.name}`,
    `值年卦辞：${annual.judgment}`,
    dateTime
      ? `年月日时卦：月经${dateTime.hexagrams.monthJing.name}；旬纬${dateTime.hexagrams.xunWei.name}；日卦${dateTime.hexagrams.daily.name}；时经${dateTime.hexagrams.hourJing.name}（${dateTime.calendar.hourRange}）`
      : '',
    dateTime ? `日卦卦辞：${dateTime.hexagrams.daily.judgment}` : '',
    dateTime ? `时经卦辞：${dateTime.hexagrams.hourJing.judgment}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatJinkoujueInfo(data: JinkoujueData) {
  const p = data.positions;
  return [
    '占法：金口诀',
    `阴阳发用：${data.yinYangUse.rule}；发用位${data.yinYangUse.usePosition}${data.yinYangUse.isVoid ? '旬空' : '不空'}`,
    `四位：地分${p.diFen.branch}（${p.diFen.yinYang}${p.diFen.element}，月令${p.diFen.seasonState}${p.diFen.isVoid ? '，空' : ''}）；将神${p.jiangShen.stem || ''}${p.jiangShen.branch}（${p.jiangShen.yinYang}${p.jiangShen.element}，月令${p.jiangShen.seasonState}${p.jiangShen.isVoid ? '，空' : ''}）；贵神${p.guiShen.stem || ''}${p.guiShen.branch}乘${p.guiShen.god || ''}（${p.guiShen.yinYang}${p.guiShen.element}，月令${p.guiShen.seasonState}${p.guiShen.isVoid ? '，空' : ''}）；人元${p.renYuan.stem || ''}${p.renYuan.branch}（${p.renYuan.yinYang}${p.renYuan.element}，月令${p.renYuan.seasonState}${p.renYuan.isVoid ? '，空' : ''}）`,
    `五动三动：${data.movements.map((item) => `${item.category}${item.name}`).join('；') || '无'}`,
    `四位关系：贵将${data.relations.guiToJiang}；贵人${data.relations.guiToRen}；将地${data.relations.jiangToDi}；人地${data.relations.renToDi}；贵地${data.relations.guiToDi}`,
    data.xunKong?.length ? `旬空：${data.xunKong.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatEnhancedDivinationInfo(
  method: Exclude<DivinationMethodId, 'random'>,
  data: DivinationData,
  _question = '',
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
      return formatQimenInfo(data as QimenData, _supplementaryInfo);
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
    case 'huangji':
      return formatHuangjiInfo(data as HuangjiJingshiResult);
    default:
      return '占卜信息暂不可用';
  }
}
