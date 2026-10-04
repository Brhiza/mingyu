import type { WuyunLiuqiResult } from '../wuyun-liuqi';
import {
  formatLiurenLesson,
  formatLiurenOrdinaryTransmissionAdjudication,
  formatLiurenTransmission,
} from './liuren-facts';
import { formatLiurenJudgmentFacts } from './liuren-judgment';
import { buildTaskText } from '../divination/engine/method-text';
import { formatJinkoujueRelations } from './jinkoujue-facts';
import { buildLiurenTemplateText } from '../divination/engine/liuren-template';
import { buildLiuyaoTemplateText } from '../divination/engine/liuyao-template';
import type { DivinationMethodId } from '../divination/config';
import { analyzeAlmanacEvidence } from '../divination/algorithms/almanac';
import {
  analyzeLenormandEvidence,
  conditionLenormandTraditionalText,
} from '../divination/algorithms/lenormand';
import {
  analyzeXiaoliurenEvidence,
  formatXiaoliurenCalendarBoundary,
} from '../divination/xiaoliuren-evidence';
import { analyzeJinkoujueEvidence } from '../divination/jinkoujue-evidence';
import { analyzeLiuyaoEvidence, resolveLiuyaoEvidence } from '../divination/liuyao-evidence';
import { analyzeMeihuaEvidence } from '../divination/meihua-evidence';
import { getBranchWuxing } from '../ganzhi';
import { getQimenActiveSpecialConditionText } from '../divination/qimen-evidence';
import { analyzeLiurenEvidence } from '../divination/liuren-evidence';
import { analyzeTarotEvidence } from '../divination/tarot-evidence';
import type {
  AlmanacData,
  AstrolabeData,
  DivinationData,
  JinkoujueData,
  LenormandData,
  LiurenData,
  LiuyaoData,
  LiuyaoTemplateType,
  LiurenTemplateType,
  MeihuaData,
  QimenData,
  SsgwData,
  TaiyiResult,
  TarotData,
  XiaoliurenData,
  SupplementaryInfo,
} from '../types/divination';
import { formatPromptCivilTime, formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance, buildPromptTask } from './guidance';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections';
import { buildPromptSchoolSection, type PromptSchoolMethod } from './schools';
import type { AstrolabePromptTopic } from './astrolabe';
import type { KongmingHexagramResult, ZhugeNumberResult } from '../name-number';
import type { PromptBuildOptions, PromptDocument } from './types';
import {
  formatEnhancedDivinationInfo,
  formatTaiyiTradition,
  getMeihuaMethodLabel,
} from './divination-enhanced';
import { resolveSsgwSignFacts, resolveSsgwStoryContent } from '../divination/ssgw-content';
import {
  buildSolarTimeInfoText,
  buildTimeInfoText,
  resolveDivinationTimezoneOffset,
} from './formatters';
import { buildTarotSpreadTask } from './tarot-spread';
import { assertHuangjiJingshiFacts, type HuangjiJingshiResult } from '../huangji-jingshi';
import { formatHuangjiCivilYear } from '../huangji-jingshi/standard';
import { getDunJiaStem } from '../divination/algorithms/qimen/helpers/palace-utils';
import {
  buildPromptSelectionTask,
  getPromptSelectionSection,
  requirePromptSelection,
  type PromptSelection,
} from './framework';

export interface DivinationSummaryBlocks {
  title: string;
  tags: string[];
  lines: string[];
}

type SupportedDivinationMethod = Exclude<DivinationMethodId, 'random'>;

const HISTORICAL_CAST_METHODS = new Set<SupportedDivinationMethod>([
  'liuyao',
  'meihua',
  'jinkoujue',
  'qimen',
  'liuren',
]);

/** 起课钟表时间与当前时间不同才单列；真太阳时同时保留实际民用占时。 */
export function formatDivinationOriginTime(
  method: SupportedDivinationMethod,
  data: DivinationData,
  currentTime: Date,
): string {
  if (!HISTORICAL_CAST_METHODS.has(method) || !('timestamp' in data)) return '';
  const civilTimestamp =
    'termReferenceTimestamp' in data && data.termReferenceTimestamp !== undefined
      ? data.termReferenceTimestamp
      : data.timestamp;
  const savedOffset = resolveDivinationTimezoneOffset(data) ?? 480;
  const repeatsCurrentTime =
    savedOffset === 480 &&
    Math.floor(civilTimestamp / 60_000) === Math.floor(currentTime.getTime() / 60_000);
  const civilTime = formatPromptCivilTime(new Date(civilTimestamp), savedOffset);
  const trueSolarTime =
    'termReferenceTimestamp' in data &&
    data.termReferenceTimestamp !== undefined &&
    Math.floor(data.timestamp / 60_000) !== Math.floor(civilTimestamp / 60_000)
      ? `真太阳时校正时刻：${formatPromptCivilTime(new Date(data.timestamp), savedOffset).replace(
          /^公历：/,
          '',
        )}（用于排盘）`
      : '';
  return [repeatsCurrentTime ? '' : civilTime, trueSolarTime].filter(Boolean).join('\n');
}

function formatAlmanacCandidateSummary(data: AlmanacData) {
  const evidence = analyzeAlmanacEvidence(data);
  const candidates = new Map(evidence.candidates.map((item) => [item.date, item]));
  return data.days.slice(0, 8).map((day) => {
    const candidate = candidates.get(day.date);
    const constraints = candidate
      ? [
          ...candidate.traditionalConstraints,
          ...candidate.participantConflicts,
          ...candidate.directionConstraints,
        ]
      : [];
    const jieBoundaryNote = day.cautions.find((item) => item.includes('交节；'));
    const otherConstraints = constraints.filter((item) => item !== jieBoundaryNote);
    return `${day.date}：${candidate?.status ?? '待核验候选'}，正午${day.ganzhi.day}日，${day.dayOfficer}执，宜${day.recommends.slice(0, 5).join('、') || '未列'}，忌${day.avoids.slice(0, 5).join('、') || '未列'}；${otherConstraints.length ? `限制：${otherConstraints.slice(0, 2).join('、')}` : day.clash}${jieBoundaryNote ? `；${jieBoundaryNote}` : ''}`;
  });
}

function wrapMainEvidence(text: string) {
  return text ? `主轴：${text}` : '';
}

function formatLiuyaoFocusSummary(
  data: LiuyaoData,
  lineFacts: ReturnType<typeof analyzeLiuyaoEvidence>['lineFacts'],
) {
  const worldYao = data.yaosDetail?.find((item) => item.isWorld);
  const responseYao = data.yaosDetail?.find((item) => item.isResponse);
  const changing = data.yaosDetail?.filter((item) => item.isChanging) ?? [];
  const monthBreakYaos = lineFacts.filter((item) => item.monthState.relations.includes('月破'));
  const hiddenMoveYaos = lineFacts.filter((item) => item.activity === '暗动');
  const dayBreakYaos = lineFacts.filter((item) => item.constraints.includes('日破'));

  const parts = [
    worldYao ? `世爻第${worldYao.position}爻` : '',
    responseYao ? `应爻第${responseYao.position}爻` : '',
  ].filter(Boolean);

  const changingDesc = changing.map((item) => {
    const direction = lineFacts.find((fact) => fact.position === item.position)?.changedYao
      ?.direction;
    const dir = direction ? `（${direction}）` : '';
    return `第${item.position}爻${dir}`;
  });

  const specialYaos: string[] = [];
  if (monthBreakYaos.length) {
    specialYaos.push(
      `月破：${monthBreakYaos.map((y) => `第${y.position}爻${y.najia.branch}`).join('、')}`,
    );
  }
  if (hiddenMoveYaos.length) {
    specialYaos.push(
      `暗动：${hiddenMoveYaos.map((y) => `第${y.position}爻${y.najia.branch}`).join('、')}`,
    );
  }
  if (dayBreakYaos.length) {
    specialYaos.push(
      `日破：${dayBreakYaos.map((y) => `第${y.position}爻${y.najia.branch}`).join('、')}`,
    );
  }

  return [
    parts.length ? `世应：${parts.join('，')}` : '',
    `动变：${changingDesc.join('、') || '无动爻'}`,
    specialYaos.join('；'),
  ]
    .filter(Boolean)
    .join('；');
}

function formatLiuyaoHexagramRelationSummary(data: LiuyaoData) {
  const relations = data.hexagramRelations;
  if (!relations) return '';
  return [
    relations.original ? `主卦${relations.original}` : '',
    relations.changed ? `变卦${relations.changed}` : '',
    relations.transition ?? '',
  ]
    .filter(Boolean)
    .join('；');
}

function formatLiuyaoFanFuRelationSummary(data: LiuyaoData) {
  const labels = data.fanfuRelations?.labels;
  return labels?.length ? labels.join('；') : '';
}

function formatLiuyaoHiddenSpiritSummary(data: DivinationData) {
  if (!('hiddenSpirits' in data) || !data.hiddenSpirits?.length) return '伏神：无';
  return `伏神：${data.hiddenSpirits
    .map(
      (item) =>
        `${item.sixRelative}伏第${item.position}爻${item.najiaDizhi}${item.wuxing}${item.isVoid ? '（空）' : ''}`,
    )
    .join('；')}`;
}

function getQimenActiveContext(data: QimenData) {
  const scope = data.scope === undefined ? 'hour' : data.scope;
  const scopeConfig = {
    year: { label: '年干', branchLabel: '年支', scopeLabel: '年家' },
    month: { label: '月干', branchLabel: '月支', scopeLabel: '月家' },
    day: { label: '日干', branchLabel: '日支', scopeLabel: '日家' },
    hour: { label: '时干', branchLabel: '时支', scopeLabel: '时家' },
  } as const;
  if (typeof scope !== 'string' || !Object.hasOwn(scopeConfig, scope)) {
    throw new Error(`未知的奇门排盘级别: ${String(scope)}`);
  }
  const config = scopeConfig[scope] ?? scopeConfig.hour;
  const activeGanZhi = data.ganzhi[scope] ?? data.ganzhi.hour;
  return {
    ...config,
    scope,
    activeStem: activeGanZhi.charAt(0),
    visibleStem: getDunJiaStem(activeGanZhi),
  };
}

function formatQimenFocusSummary(data: QimenData) {
  const zhiFuPalace = data.jiuGongGe.find(
    (item) => item.tianPan.star === data.zhiFu || item.tianPan.companionStar === data.zhiFu,
  );
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const active = getQimenActiveContext(data);
  const activeStemPalaces = data.jiuGongGe.filter(
    (item) =>
      item.tianPan.stem === active.visibleStem ||
      item.tianPan.companionStem === active.visibleStem ||
      item.diPan.stem === active.visibleStem,
  );
  const activeStemLabel =
    active.activeStem === active.visibleStem
      ? `${active.label}${active.activeStem}`
      : `${active.label}${active.activeStem}（遁${active.visibleStem}）`;
  return `值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '落宫未定位'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '落宫未定位'}；${activeStemLabel}${activeStemPalaces.length ? `见于${activeStemPalaces.map((item) => item.name).join('、')}` : '落宫未定位'}`;
}

function formatQimenHorseSummary(data: QimenData) {
  if (!data.horseStar) return '';
  const active = getQimenActiveContext(data);
  return active.scope === 'hour'
    ? `驿马：${data.horseStar.sourceBranch}时驿马在${data.horseStar.branch}`
    : `驿马：${active.branchLabel}${data.horseStar.sourceBranch}起驿马在${data.horseStar.branch}`;
}

function formatQimenSeasonalitySummary(data: QimenData) {
  if (data.scope === 'year' || data.scope === 'month') return '';
  const seasonality = data.seasonality;
  if (!seasonality) return '';
  return `节令背景：实际节气${seasonality.currentJieQi}，节气五行${seasonality.seasonalElement || '未知'}，日干${seasonality.dayStem}${seasonality.seasonRelation}，月相${seasonality.lunarPhaseDetail || seasonality.lunarPhase}，建除${seasonality.dayOfficer}${seasonality.dayOfficerFortuneLabel}`;
}

function formatMeihuaFocusSummary(data: MeihuaData) {
  return `体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻`;
}

function formatMeihuaSeasonSummary(
  data: MeihuaData,
  evidence: ReturnType<typeof analyzeMeihuaEvidence>,
) {
  const origin = evidence.stages.find((stage) => stage.stage === 'origin');
  if (!origin || !evidence.monthBranch) return '';
  const monthElement =
    data.analysis.monthElement === undefined
      ? getBranchWuxing(evidence.monthBranch)
      : data.analysis.monthElement;
  return `月令：${evidence.monthBranch}月（${monthElement}令），体卦${origin.ti.seasonState}，用卦${origin.yong.seasonState}`;
}

function formatLiurenFocusSummary(data: LiurenData) {
  const first = data.threeTransmissions[0];
  if (!first) return '';
  return `发用：初传${[
    first.branch,
    first.god ? `乘${first.god}` : '',
    first.relation || '',
    first.note || '',
  ]
    .filter(Boolean)
    .join('，')}`;
}

function formatTarotFocusSummary(cards: ReturnType<typeof analyzeTarotEvidence>['cards']) {
  return cards
    .slice(0, 3)
    .map((card) => `${card.position}${card.name}（${card.orientation}）`)
    .join('；');
}

export function getDivinationSummaryBlocks(
  method: SupportedDivinationMethod,
  data: DivinationData,
): DivinationSummaryBlocks {
  switch (method) {
    case 'liuyao': {
      const resolved = resolveLiuyaoEvidence(data as LiuyaoData);
      const item = resolved.data;
      const evidence = resolved.analysis;
      const hexagramRelationText = formatLiuyaoHexagramRelationSummary(item);
      const fanfuRelationText = formatLiuyaoFanFuRelationSummary(item);
      return {
        title: '六爻起卦结果',
        tags: [
          `主卦：${item.originalName}`,
          `变卦：${item.changingYaos.length ? item.changedName || '未列' : '无'}`,
          `互卦：${item.interName || '无'}`,
          item.palaceStage ? `卦位：${item.palaceStage}` : '',
          hexagramRelationText ? `整卦：${hexagramRelationText}` : '',
          fanfuRelationText ? `反伏：${fanfuRelationText}` : '',
          `动爻：${
            item.changingYaos
              .filter((yao) => yao.isChanging)
              .map((yao) => yao.position)
              .join('、') || '无'
          }`,
        ],
        lines: [
          wrapMainEvidence(formatLiuyaoFocusSummary(item, evidence.lineFacts)),
          `卦宫：${item.palace.name}${item.palaceStage ? `；${item.palaceStage}` : ''}`,
          `空亡：${item.voidBranches.join('、') || '无'}`,
          `特殊卦式：${item.specialPattern || '常规卦'}`,
          formatLiuyaoHiddenSpiritSummary(item),
        ].filter(Boolean),
      };
    }
    case 'meihua': {
      const item = data as MeihuaData;
      const evidence = analyzeMeihuaEvidence(item);
      if (evidence.calculationFact.status === '计算不一致') {
        throw new Error(`梅花盘面与起卦资料不一致：${evidence.calculationFact.promptText}`);
      }
      const processStage = evidence.stages.find((stage) => stage.stage === 'process');
      const resultStage = evidence.stages.find(
        (stage) => stage.stage === 'result' && stage.status === '已计算',
      );
      return {
        title: '梅花起卦结果',
        tags: [
          `主卦：${item.originalName}`,
          `互卦：${processStage ? item.interName || item.interHexagram?.name || '未列' : '未列'}`,
          `变卦：${resultStage ? item.changedName || item.changedHexagram?.name || '未列' : '未列'}`,
          `动爻：第${item.movingYao.position}爻`,
        ],
        lines: [
          wrapMainEvidence(formatMeihuaFocusSummary(item)),
          `体卦：${item.tiGua.name}（${item.tiGua.element}）`,
          `用卦：${item.yongGua.name}（${item.yongGua.element}）`,
          `动爻：第${item.movingYao.position}爻`,
          `体用关系：${item.analysis.tiYongRelation}${resultStage && item.analysis.changedRelation ? `；${item.analysis.changedRelation}` : ''}`,
          formatMeihuaSeasonSummary(item, evidence),
          processStage
            ? `过程：${item.analysis.inter1Relation}、${item.analysis.inter2Relation}`
            : '互卦体用资料未列',
          resultStage && item.changedTiGua && item.changedYongGua
            ? `变后：体卦${item.changedTiGua.name}（${item.changedTiGua.element}）；用卦${item.changedYongGua.name}（${item.changedYongGua.element}）；关系${item.analysis.changedTiYongRelation}`
            : '',
          item.calculation?.method || item.calculation?.methodKey
            ? `起卦法：${getMeihuaMethodLabel(item.calculation)}`
            : '',
        ].filter(Boolean),
      };
    }
    case 'xiaoliuren': {
      const item = data as XiaoliurenData;
      const evidence = analyzeXiaoliurenEvidence(item);
      return {
        title: '小六壬起课结果',
        tags: [
          `起课方式：${item.methodLabel}`,
          `占得宫：${item.primary.name}`,
          `时辰：${item.hourLabel}`,
        ],
        lines: [
          wrapMainEvidence(evidence.primaryFact.promptText),
          `顺数轨迹：月宫${item.sequence.month.name}；日宫${item.sequence.day.name}；时宫${item.sequence.hour.name}`,
          item.calculation
            ? `历法口径：${[item.calculation.dayBoundary, item.calculation.leapMonthRule, formatXiaoliurenCalendarBoundary(item)].filter(Boolean).join('；')}`
            : '',
        ].filter(Boolean),
      };
    }
    case 'jinkoujue': {
      const item = data as JinkoujueData;
      analyzeJinkoujueEvidence(item);
      const positions = item.positions;
      return {
        title: '金口诀起课结果',
        tags: [
          `起课方式：${item.methodLabel}`,
          `地分：${positions.diFen.branch}`,
          `将神：${positions.jiangShen.branch}`,
          `贵神：${positions.guiShen.god}（本属${positions.guiShen.branch}）`,
          `人元：${positions.renYuan.stem || ''}${positions.renYuan.branch}`,
        ],
        lines: [
          `阴阳发用：${item.yinYangUse.rule}；发用位${item.yinYangUse.usePosition}`,
          `动爻：${item.movements.map((movement) => `${movement.name}（${movement.trigger}）`).join('、') || '未触发五动或三动'}`,
          `月将贵人：月将${item.monthLeader}；${item.dayNight}贵人起${item.noblemanBranch}${item.calculation.noblemanDirection}`,
          formatJinkoujueRelations(item),
          item.xunKong.length ? `旬空：${item.xunKong.join('、')}` : '',
        ].filter(Boolean),
      };
    }
    case 'qimen': {
      const item = data as QimenData;
      const qimenActive = getQimenActiveContext(item);
      const isYearOrMonth = qimenActive.scope === 'year' || qimenActive.scope === 'month';
      const specialConditionText = getQimenActiveSpecialConditionText(item);
      const pillarLine =
        qimenActive.scope === 'year'
          ? `干支年：${item.ganzhi.year}`
          : qimenActive.scope === 'month'
            ? `干支：${item.ganzhi.year}年、${item.ganzhi.month}月`
            : qimenActive.scope === 'day'
              ? `干支：${item.ganzhi.year}年、${item.ganzhi.month}月、${item.ganzhi.day}日`
              : `干支：${item.ganzhi.year}、${item.ganzhi.month}、${item.ganzhi.day}、${item.ganzhi.hour}`;
      return {
        title: '奇门起局结果',
        tags: [
          `局数：${item.isYangDun ? '阳遁' : '阴遁'}${item.juShu}局`,
          `值符：${item.zhiFu}`,
          `值使：${item.zhiShi}`,
        ],
        lines: [
          pillarLine,
          `实际节气：${item.timeInfo.solarTerm}`,
          `定局：${isYearOrMonth ? `干支年${item.ganzhi.year}` : item.timeInfo.juTerm || item.timeInfo.solarTerm}${item.timeInfo.epoch}`,
          wrapMainEvidence(formatQimenFocusSummary(item)),
          item.patternTags?.length ? `格局：${[...new Set(item.patternTags)].join('、')}` : '',
          `空亡：${item.voidBranches?.join('、') || '无'}`,
          formatQimenHorseSummary(item),
          formatQimenSeasonalitySummary(item),
          specialConditionText
            ? `${qimenActive.scope === 'hour' ? '时辰' : `${qimenActive.scopeLabel}特殊条件`}：${specialConditionText}`
            : '',
        ].filter(Boolean),
      };
    }
    case 'liuren': {
      const item = data as LiurenData;
      analyzeLiurenEvidence(item);
      return {
        title: '大六壬起课结果',
        tags: [
          `月将：${item.monthLeader}`,
          `占时：${item.divinationBranch}`,
          `初传：${item.threeTransmissions[0]?.branch || '未记录'}`,
          `末传：${item.threeTransmissions[2]?.branch || '未记录'}`,
        ],
        lines: [
          wrapMainEvidence(formatLiurenFocusSummary(item)),
          `昼夜：${item.dayNight || '未记录'}；贵人${item.noblemanBranch || '未记录'}${item.noblemanGroundBranch ? `临${item.noblemanGroundBranch}` : ''}`,
          `日干寄宫：${item.dayStemResidence ? `${item.ganzhi.day.charAt(0)}寄${item.dayStemResidence}` : '未知'}`,
          `旬空：${item.xunKong?.length ? item.xunKong.join('、') : '未知'}`,
          `取传法：${item.transmissionRule || '未记录'}；传态：${item.transmissionPattern || '未记录'}`,
          formatLiurenOrdinaryTransmissionAdjudication(item),
          `四课：${item.fourLessons.map(formatLiurenLesson).join('；')}`,
          `三传：${item.threeTransmissions.map((_, index) => formatLiurenTransmission(item, index)).join(' → ')}`,
          `课体：${item.guaTi?.join('、') || '无'}`,
          `神煞：${item.shenShaSummary?.length ? item.shenShaSummary.join('；') : '无'}`,
        ].filter(Boolean),
      };
    }
    case 'tarot': {
      const item = data as TarotData;
      const evidence = analyzeTarotEvidence(item);
      return {
        title: '塔罗抽牌结果',
        tags: [
          `牌阵：${evidence.spreadCoverageFact.expectedSpreadName ?? item.spreadName}`,
          `张数：${evidence.cards.length}张`,
        ],
        lines: [
          wrapMainEvidence(formatTarotFocusSummary(evidence.cards)),
          ...evidence.cards.map((card) => `${card.position}：${card.name}（${card.orientation}）`),
        ].filter(Boolean),
      };
    }
    case 'ssgw': {
      const item = resolveSsgwSignFacts(data as SsgwData);
      const storyContent = resolveSsgwStoryContent(item);
      return {
        title: '灵签结果',
        tags: [`签号：第${item.number}签`, `签题：${item.title}`],
        lines: [
          `签诗：${item.poem}`,
          storyContent.canonicalStory ? `典故：${storyContent.canonicalStory}` : '',
          storyContent.extraStory ? `补充：${storyContent.extraStory}` : '',
          item.details?.['吉凶'] ? `吉凶级别：${item.details['吉凶']}` : '',
          item.details?.['核心寓意']
            ? `基础解签：${item.details['核心寓意']}`
            : item.details?.['解签']
              ? `基础解签：${item.details['解签']}`
              : item.details?.['签意']
                ? `基础解签：${item.details['签意']}`
                : '',
          ...Object.entries(item.details ?? {})
            .filter(
              ([key, value]) =>
                !['吉凶', '典故', '核心寓意', '解签', '签意', '行动建议', '风险提醒'].includes(
                  key,
                ) && value.trim(),
            )
            .map(([key, value]) => `${key}：${value}`),
        ].filter(Boolean),
      };
    }
    case 'zhuge': {
      const item = data as ZhugeNumberResult;
      return {
        title: '诸葛神数结果',
        tags: [`三字：${item.text}`, `签序：第${item.number}签`],
        lines: [
          `康熙笔画：${item.strokes.join('、')}`,
          `取数：${item.digits.join('')}`,
          `签诗：${item.sign.poem}`,
          `基础解意：${item.sign.summary}`,
        ],
      };
    }
    case 'kongming': {
      const item = data as KongmingHexagramResult;
      return {
        title: '孔明神卦结果',
        tags: [`卦象：${item.symbol}`, `卦名：${item.name}`, `等第：${item.grade}`],
        lines: [`卦诗：${item.poem}`],
      };
    }
    case 'almanac': {
      const item = data as AlmanacData;
      return {
        title: '黄历择日结果',
        tags: [
          `事项：${item.topicLabel}`,
          `范围：${item.startDate}至${item.endDate}`,
          `参与人：${item.participants.length}位`,
        ],
        lines: formatAlmanacCandidateSummary(item),
      };
    }
    case 'lenormand': {
      const item = data as LenormandData;
      const evidence = analyzeLenormandEvidence(item);
      const combinations =
        evidence.spreadCoverageFact.status === '完整' &&
        evidence.cards.every((card) => card.status === '已映射')
          ? evidence.traditionalFacts.filter((fact) => fact.kind !== '单牌牌义')
          : [];
      return {
        title: '雷诺曼抽牌结果',
        tags: [
          `牌阵：${evidence.spreadCoverageFact.expectedSpreadName ?? item.spreadName}`,
          `张数：${item.cards.length}张`,
        ],
        lines: [
          wrapMainEvidence(
            evidence.cards
              .slice(0, 3)
              .map((card) => `${card.position}${card.name}`)
              .join('；'),
          ),
          ...evidence.cards.map((card) => {
            const fact = evidence.traditionalFacts.find(
              (candidate) =>
                candidate.kind === '单牌牌义' && candidate.positions.includes(card.position),
            );
            return `${card.position}：${card.name}；${(fact?.promptText ?? conditionLenormandTraditionalText(card.meaning, { cardNames: [card.name], keywords: card.keywords })).split('；')[0]}`;
          }),
          ...combinations.map(
            (combination) =>
              `${combination.kind} ${combination.cardNames.join('+')}：${combination.promptText.split('；')[0]}`,
          ),
        ].filter(Boolean),
      };
    }
    case 'astrolabe': {
      const item = data as AstrolabeData;
      return {
        title: '星盘结果',
        tags: [
          `太阳：${item.planets.find((point) => point.name === 'Sun')?.formatted || '未列'}`,
          `月亮：${item.planets.find((point) => point.name === 'Moon')?.formatted || '未列'}`,
          `上升：${item.angles.find((point) => point.name === 'Ascendant')?.formatted || '未列'}`,
        ],
        lines: [
          wrapMainEvidence(
            `太阳${item.planets.find((point) => point.name === 'Sun')?.formatted || '未知'}；月亮${item.planets.find((point) => point.name === 'Moon')?.formatted || '未知'}；上升${item.angles.find((point) => point.name === 'Ascendant')?.formatted || '未知'}`,
          ),
          `逆行：${item.summary.retrograde.join('、') || '无'}`,
          `主要相位：${
            item.aspects
              .slice(0, 5)
              .map((aspect) => `${aspect.body1}与${aspect.body2}：${aspect.type}`)
              .join('、') || '无'
          }`,
        ],
      };
    }
    case 'taiyi': {
      const item = data as TaiyiResult;
      const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计' }[item.scope];
      return {
        title: `太乙神数${scopeLabel}结果`,
        tags: [`${item.ganZhi}`, `${item.yinYang}${item.bureau}局`, `太乙在${item.taiyiPosition}`],
        lines: [
          `主算${item.lordCount}；客算${item.guestCount}；定算${item.setCount}`,
          `文昌${item.wenChangPosition}；始击${item.shiJiPosition}；计神${item.jiShenPosition}`,
          `判断：${item.judgments.join('；')}`,
        ].filter(Boolean),
      };
    }
    case 'huangji': {
      const item = data as HuangjiJingshiResult;
      assertHuangjiJingshiFacts(item);
      const forecast = item.forecast;
      if (!forecast) {
        return {
          title: '皇极经世结果',
          tags: [`目标年：${item.input.year}`],
          lines: item.calculationChain.slice(0, 5),
        };
      }
      const { governing, yun, sixtyYear, decade, annual } = forecast.hexagrams;
      return {
        title: '皇极经世结果',
        tags: [
          item.dateTimeForecast?.civilTime.dateTime || formatHuangjiCivilYear(annual.year),
          annual.ganzhi,
          item.dateTimeForecast
            ? `时经${item.dateTimeForecast.hexagrams.hourJing.name}`
            : `值年${annual.name}`,
        ],
        lines: [
          `周期：第${forecast.hui.indexInYuan}会${forecast.hui.branch}会，会内第${item.position.yun.indexInHui}运，运内第${item.position.shi.indexInYun}世`,
          `卦序：${governing.hexagram.name} → ${yun.hexagram.name} → ${sixtyYear.hexagram.name} → ${decade.hexagram.name} → ${annual.name}`,
          item.dateTimeForecast
            ? `年月日时：${item.dateTimeForecast.hexagrams.monthJing.name} → ${item.dateTimeForecast.hexagrams.xunWei.name} → ${item.dateTimeForecast.hexagrams.daily.name} → ${item.dateTimeForecast.hexagrams.hourJing.name}`
            : '',
          `互错综：${forecast.relatedHexagrams.mutual.name}、${forecast.relatedHexagrams.opposite.name}、${forecast.relatedHexagrams.reversed.name}`,
        ].filter(Boolean),
      };
    }
    case 'wuyun': {
      const item = data as WuyunLiuqiResult;
      const targetYear =
        item.input.year === undefined
          ? item.input.yearGanZhi
          : `${item.input.year}年${item.input.yearGanZhi}`;
      const firstBoundary = item.qiSteps[0]?.boundaryTime;
      const lastBoundary = item.qiSteps.at(-1)?.boundaryTime;
      const annualPeriod =
        firstBoundary && lastBoundary
          ? `${firstBoundary.startBeijing}大寒起，至${lastBoundary.endBeijingExclusive}次年大寒前（北京时间，按现代节气交节标示）`
          : '大寒起，至次年大寒前';
      return {
        title: '五运六气年度结果',
        tags: [
          targetYear,
          `${item.annualMovement.name}·${item.annualMovement.strength}`,
          `司天${item.sitian.name}`,
        ],
        lines: [
          `运气年度：${annualPeriod}`,
          `在泉：${item.zaiquan.name}`,
          `司天化令：${item.annualClassification.sitianTransformation}；${item.annualClassification.governance}`,
          `中运与司天：${item.annualRelation.kind}`,
          item.annualConformities.names.length
            ? `年度符会：${item.annualConformities.names.join('、')}`
            : '',
          `五步主客运：${item.movementSteps.map((step) => `${step.label}${step.hostMovement.element}/${step.guestMovement.element}（${step.hostGuestRelation.kind}）`).join('；')}`,
          `六步主客气：${item.qiSteps.map((step) => `${step.label}${step.hostQi.name}/${step.guestQi.name}（${step.hostGuestRelation.kind}）`).join('；')}`,
          item.pathomechanism?.summary ?? '',
        ].filter(Boolean),
      };
    }
    default:
      return { title: '占卜结果', tags: [], lines: [] };
  }
}

/** 格式化占课时间；无时间戳时使用当前时间，显式无效时间戳直接报错。 */
export function formatDivinationTime(data?: DivinationData) {
  return buildTimeInfoText(data);
}

/** 只返回占课当地民用公历时间，适合星盘等需要单独展示出生时间的场景。 */
export function formatDivinationSolarTime(data?: DivinationData) {
  return buildSolarTimeInfoText(data);
}

export function formatDivinationInfo(
  method: SupportedDivinationMethod,
  data: DivinationData,
  question = '',
  supplementaryInfo?: SupplementaryInfo,
  options?: {
    liuyaoTemplate?: LiuyaoTemplateType;
    omitRepeatedXiaoliurenCivilTime?: boolean;
  },
) {
  return formatEnhancedDivinationInfo(method, data, question, supplementaryInfo, options);
}

const ASTROLABE_TOPIC_LABELS: Record<AstrolabePromptTopic, string> = {
  life: '整体人生',
  career: '事业',
  'job-change': '换工作',
  'startup-partnership': '创业合作',
  'investment-partnership': '投资合作',
  wealth: '财富',
  relationship: '关系',
  'relationship-push': '关系推进',
  'relationship-decision': '关系去留',
  'reconciliation-decision': '复合判断',
  marriage: '婚恋',
  children: '子女',
  family: '家庭',
  'home-move': '搬家置业',
  'settle-relocate': '定居换城',
  social: '人际',
  emotion: '情绪',
  growth: '成长',
  talent: '天赋',
  health: '健康',
  study: '学业',
  'study-advance': '考证进修',
  'exam-landing': '考试上岸',
  recent: '近期',
  chat: '自由问答',
};

export function formatSupplementaryInfo(
  info?: SupplementaryInfo,
  method?: SupportedDivinationMethod,
) {
  if (!info) return '';
  const subjectParts = [
    info.gender ? info.gender : '',
    method !== 'qimen' && info.birthYear ? `出生年份：${info.birthYear}` : '',
  ].filter(Boolean);
  return [
    subjectParts.length ? `求测人：${subjectParts.join('；')}` : '',
    info.currentSituation ? `当前情境：${info.currentSituation}` : '',
    info.currentState ? `当前状态：${info.currentState}` : '',
    info.knownFacts ? `已知事实：${info.knownFacts}` : '',
    info.desiredOutcome ? `期望结果：${info.desiredOutcome}` : '',
    info.constraints ? `现实约束：${info.constraints}` : '',
    info.userSupplement ? `补充说明：${info.userSupplement}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export interface DivinationPromptOptions extends PromptBuildOptions {
  method: SupportedDivinationMethod;
  data: DivinationData;
  supplementaryInfo?: SupplementaryInfo;
  isCustomQuestion?: boolean;
  liuyaoTemplate?: LiuyaoTemplateType;
  liurenTemplate?: LiurenTemplateType;
  astrolabeTopic?: AstrolabePromptTopic;
  astrolabeScopeText?: string;
  schools?: readonly string[];
  topicId?: string;
  subtopicId?: string;
  scope?: string;
}

function formatSsgwPrompt(data: SsgwData) {
  data = resolveSsgwSignFacts(data);
  const storyContent = resolveSsgwStoryContent(data);
  const details = data.details ?? {};
  const baseExplanation = details['核心寓意'] || details['解签'] || details['签意'] || '';
  const excludedKeys = new Set([
    '吉凶',
    '典故',
    '核心寓意',
    '解签',
    '签意',
    '解签总论',
    '此签核心',
    '行动建议',
    '风险提醒',
    '提醒',
    '来源状态',
    '签谱状态',
    '掷筊状态',
  ]);
  const supplementary = Object.entries(details)
    .filter(([key, value]) => !excludedKeys.has(key) && value.trim())
    .map(([key, value]) => `${key}：${value.trim()}`);
  if (storyContent.extraStory) supplementary.unshift(`典故补充：${storyContent.extraStory}`);

  return [
    `签号：第${data.number}签`,
    `签题：${data.title}`,
    `签诗：${data.poem}`,
    details['吉凶'] ? `吉凶级别：${details['吉凶']}` : '',
    storyContent.canonicalStory ? `典故：${storyContent.canonicalStory}` : '',
    baseExplanation ? `基础解签：${baseExplanation}` : '',
    supplementary.length ? `补充解释：\n${supplementary.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildDivinationPromptDocument(options: DivinationPromptOptions): PromptDocument {
  const qimenScope = options.method === 'qimen' ? (options.data as QimenData).scope : undefined;
  const qimenSelectionScope =
    qimenScope === 'year'
      ? 'yearly'
      : qimenScope === 'month'
        ? 'monthly'
        : qimenScope === 'day'
          ? 'daily'
          : 'hourly';
  const promptMethodId =
    options.method === 'huangji'
      ? 'huangji-jingshi'
      : options.method === 'wuyun'
        ? 'wuyun-liuqi'
        : options.method;
  const hasPromptSelection =
    options.topicId !== undefined ||
    options.subtopicId !== undefined ||
    options.scope !== undefined;
  const selection: PromptSelection | undefined = hasPromptSelection
    ? requirePromptSelection({
        methodId: promptMethodId,
        topicId: options.topicId,
        subtopicId: options.subtopicId,
        scope: options.scope ?? (qimenScope ? qimenSelectionScope : undefined),
      })
    : undefined;
  if (options.method === 'ssgw') {
    if (selection) {
      throw new Error('三山国王灵签提示词只接受本次签谱资料，不支持通用主题选择。');
    }
    return buildPromptDocument(formatSsgwPrompt(options.data as SsgwData));
  }

  const question = options.question?.trim() || '请依据占卜资料分析当前问题。';
  const liuyaoTemplate = options.liuyaoTemplate ?? 'general';
  const liurenTemplate = options.liurenTemplate ?? 'general';
  const liurenPlateComplete =
    options.method !== 'liuren' ||
    analyzeLiurenEvidence(options.data as LiurenData).plateFact.status === '完整';
  const astrolabeTopic = options.astrolabeTopic ?? 'life';
  const isSignPrompt = options.method === 'zhuge' || options.method === 'kongming';
  const hasAstrolabePeriod = Boolean(
    options.astrolabeScopeText &&
    /周期关键星象|行运取样|主要行运相位/.test(options.astrolabeScopeText),
  );
  const hasAstrolabeAdvancedTiming = Boolean(
    options.astrolabeScopeText &&
    /太阳返照|次限相位：|太阳弧相位：/.test(options.astrolabeScopeText),
  );
  const baseTask = isSignPrompt
    ? buildPromptTask('', options.method)
    : options.method === 'liuren' && !liurenPlateComplete
      ? buildPromptTask('依据本次起课四柱、月将、占时以及可复核的时间资料回答【问题】。')
      : options.method === 'astrolabe' && !options.isCustomQuestion
        ? buildPromptTask(
            hasAstrolabeAdvancedTiming
              ? `请依据本次已列星象和时限资料，分别判断各盘层的主题与时间触发，再比较共同点和分歧，重点分析${ASTROLABE_TOPIC_LABELS[astrolabeTopic]}并回答【问题】。`
              : `请依据星体、宫位、相位和盘面证据，重点分析${ASTROLABE_TOPIC_LABELS[astrolabeTopic]}并回答【问题】。`,
            hasAstrolabePeriod || hasAstrolabeAdvancedTiming ? 'astrolabe' : 'astrolabe-natal',
          )
        : options.method === 'tarot'
          ? buildTarotSpreadTask(options.data as TarotData)
          : options.method === 'lenormand' && (options.data as LenormandData).cards.length === 1
            ? buildPromptTask('依据唯一牌位与基础牌义回答【问题】。', 'lenormand-single')
            : buildTaskText(options.method, options.data);
  const task = isSignPrompt
    ? baseTask
    : selection
      ? buildPromptSelectionTask(baseTask, selection)
      : baseTask;
  const templateText =
    options.method === 'liuyao'
      ? buildLiuyaoTemplateText(liuyaoTemplate)
      : options.method === 'liuren'
        ? liurenPlateComplete
          ? buildLiurenTemplateText(liurenTemplate, options.data as LiurenData)
          : ''
        : '';
  const supplementaryText = formatSupplementaryInfo(options.supplementaryInfo, options.method);
  const currentTime = options.currentTime ?? new Date();
  const xiaoliurenData =
    options.method === 'xiaoliuren' ? (options.data as XiaoliurenData) : undefined;
  const omitRepeatedXiaoliurenCivilTime = Boolean(
    xiaoliurenData &&
    xiaoliurenData.termReferenceTimestamp === undefined &&
    Math.floor(xiaoliurenData.timestamp / 60_000) === Math.floor(currentTime.getTime() / 60_000),
  );
  const originTime = formatDivinationOriginTime(options.method, options.data, currentTime);
  const promptSchoolMethod =
    options.method === 'huangji'
      ? 'huangji-jingshi'
      : options.method === 'wuyun'
        ? 'wuyun-liuqi'
        : options.method;
  const singleCardGuidance =
    options.method === 'tarot' &&
    (options.data as TarotData).spreadType === 'single' &&
    (options.data as TarotData).cards.length === 1
      ? buildPromptSection('传统依据', '塔罗单牌以牌位职能、正逆位、牌组属性与单牌牌义为主要资料。')
      : options.method === 'lenormand' && (options.data as LenormandData).cards.length === 1
        ? buildPromptSection('传统依据', '雷诺曼单牌以当前牌位、基础牌义和问题语境为主要资料。')
        : '';
  const liurenGuidance =
    options.method === 'liuren' && !liurenPlateComplete
      ? buildPromptSection('传统依据', '大六壬以月将加临占时定天地盘。')
      : '';
  const user = joinPromptSections([
    singleCardGuidance ||
      liurenGuidance ||
      (options.method === 'taiyi'
        ? buildPromptSection('传统依据', formatTaiyiTradition(options.data as TaiyiResult))
        : buildPromptGuidance(options.method)),
    isSignPrompt ? '' : buildPromptSection('当前时间', formatPromptCurrentTime(currentTime)),
    originTime ? buildPromptSection('起课时间', originTime) : '',
    supplementaryText ? buildPromptSection('补充信息', supplementaryText) : '',
    options.astrolabeScopeText ? buildPromptSection('分析对象', options.astrolabeScopeText) : '',
    buildPromptSection(
      '占卜资料',
      [
        formatDivinationInfo(options.method, options.data, question, options.supplementaryInfo, {
          liuyaoTemplate,
          omitRepeatedXiaoliurenCivilTime,
        }),
        ...(options.method === 'liuren'
          ? formatLiurenJudgmentFacts(options.data as LiurenData, {
              includeOrdinaryAdjudication: false,
              chartFactsIncluded: true,
            })
          : []),
      ].join('\n'),
    ),
    buildPromptSchoolSection(promptSchoolMethod as PromptSchoolMethod, options.schools),
    selection ? buildPromptSection('解读选择', getPromptSelectionSection(selection)) : '',
    templateText ? buildPromptSection('问题范围', templateText) : '',
    buildPromptSection('任务', task),
    buildPromptSection('问题', question),
  ]);
  return buildPromptDocument(user);
}

export function buildDivinationPrompt(options: DivinationPromptOptions) {
  return buildDivinationPromptDocument(options).text;
}
