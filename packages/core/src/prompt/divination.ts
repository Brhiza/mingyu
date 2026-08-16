import { buildTaskText } from '../divination/engine/method-text';
import { buildLiurenTemplateText } from '../divination/engine/liuren-template';
import { buildLiuyaoTemplateText } from '../divination/engine/liuyao-template';
import type { DivinationMethodId } from '../divination/config';
import { analyzeAlmanacEvidence } from '../divination/algorithms/almanac';
import {
  analyzeLenormandEvidence,
  conditionLenormandTraditionalText,
} from '../divination/algorithms/lenormand';
import { analyzeXiaoliurenEvidence } from '../divination/xiaoliuren-evidence';
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
import { formatPromptCurrentTime } from './current-time';
import { buildPromptGuidance } from './guidance';
import { buildPromptDocument, buildPromptSection, joinPromptSections } from './sections';
import { buildPromptSchoolSection, type PromptSchoolMethod } from './schools';
import type { AstrolabePromptTopic } from './astrolabe';
import type { PromptBuildOptions, PromptDocument } from './types';
import { formatEnhancedDivinationInfo } from './divination-enhanced';
import { resolveSsgwStoryContent } from '../divination/ssgw-content';
import { buildSolarTimeInfoText, buildTimeInfoText } from './formatters';

export interface DivinationSummaryBlocks {
  title: string;
  tags: string[];
  lines: string[];
}

type SupportedDivinationMethod = Exclude<DivinationMethodId, 'random'>;

function formatQimenPatternComboSummary(data: QimenData) {
  const toneLabels = {
    'super-good': '支持条件较集中',
    'super-bad': '限制条件较集中',
    mixed: '支持与限制并存',
  } as const;
  return data.patternCombos?.length
    ? `复合格局：${data.patternCombos
        .slice(0, 3)
        .map((item) => `${item.name}（${toneLabels[item.tone]}）`)
        .join('、')}`
    : '';
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
    return `${day.date}：${candidate?.status ?? '待核验候选'}，${day.ganzhi.day}日，${day.dayOfficer}执，宜${day.recommends.slice(0, 5).join('、') || '未列'}，忌${day.avoids.slice(0, 5).join('、') || '未列'}；${constraints.length ? `限制：${constraints.slice(0, 2).join('、')}` : day.clash}`;
  });
}

function wrapMainEvidence(text: string) {
  return text ? `主轴：${text}` : '';
}

function formatLiuyaoFocusSummary(data: LiuyaoData) {
  const worldYao = data.yaosDetail?.find((item) => item.isWorld);
  const responseYao = data.yaosDetail?.find((item) => item.isResponse);
  const changing = data.yaosDetail?.filter((item) => item.isChanging) ?? [];
  const parts = [
    worldYao ? `世爻第${worldYao.position}爻` : '',
    responseYao ? `应爻第${responseYao.position}爻` : '',
  ].filter(Boolean);
  return [
    parts.length ? `世应：${parts.join('，')}` : '',
    `动变：${changing.map((item) => `第${item.position}爻`).join('、') || '无动爻'}`,
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

function formatQimenFocusSummary(data: QimenData) {
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
  return `值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '落宫未定位'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '落宫未定位'}；时干${hourStem}${hourStemPalaces.length ? `见于${hourStemPalaces.map((item) => item.name).join('、')}` : '落宫未定位'}`;
}

function formatQimenSeasonalitySummary(data: QimenData) {
  const seasonality = data.seasonality;
  if (!seasonality) return '';
  return `节令背景：实际节气${seasonality.currentJieQi}，节气五行${seasonality.seasonalElement || '未知'}，日干${seasonality.dayStem}${seasonality.seasonRelation}，月相${seasonality.lunarPhaseDetail || seasonality.lunarPhase}，建除${seasonality.dayOfficer}${seasonality.dayOfficerFortuneLabel}`;
}

function formatMeihuaFocusSummary(data: MeihuaData) {
  return `体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻`;
}

function formatMeihuaSeasonSummary(data: MeihuaData) {
  const basis =
    data.analysis.monthBranch && data.analysis.monthElement
      ? `${data.analysis.monthBranch}月（${data.analysis.monthElement}令）`
      : `${data.analysis.season}季`;
  return `月令：${basis}，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}`;
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

function formatLiurenDetailSummary(data: LiurenData) {
  const lessons = data.fourLessons?.length
    ? `四课关系：${data.fourLessons.map((item) => `${item.name}${item.upper}/${item.lower} ${item.relation}`).join('；')}`
    : '四课关系：未标注';
  const transmissions = data.threeTransmissions?.length
    ? `三传主线：${data.threeTransmissions.map((item, index) => `${item.stage || ['初传', '中传', '末传'][index] || '传'}${item.branch}`).join(' → ')}`
    : '三传主线：未标注';
  const nobleman = data.noblemanBranch
    ? `贵人：${data.noblemanBranch}${data.noblemanGroundBranch ? `临${data.noblemanGroundBranch}` : ''}`
    : '贵人：未知';
  return [lessons, transmissions, nobleman];
}

function formatTarotFocusSummary(data: TarotData) {
  return data.cards
    .slice(0, 3)
    .map((card) => `${card.position}${card.name}（${card.reversed ? '逆位' : '正位'}）`)
    .join('；');
}

export function getDivinationSummaryBlocks(
  method: SupportedDivinationMethod,
  data: DivinationData,
): DivinationSummaryBlocks {
  switch (method) {
    case 'liuyao': {
      const item = data as LiuyaoData;
      const hexagramRelationText = formatLiuyaoHexagramRelationSummary(item);
      const fanfuRelationText = formatLiuyaoFanFuRelationSummary(item);
      return {
        title: '六爻起卦结果',
        tags: [
          `主卦：${item.originalName}`,
          `变卦：${item.changedName || '无'}`,
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
          wrapMainEvidence(formatLiuyaoFocusSummary(item)),
          `卦宫：${item.palace.name}${item.palaceStage ? `；${item.palaceStage}` : ''}`,
          `世应：${item.worldAndResponse.join('、') || '未记录'}`,
          `空亡：${item.voidBranches.join('、') || '无'}`,
          `特殊卦式：${item.specialPattern || '常规卦'}`,
          formatLiuyaoHiddenSpiritSummary(item),
        ].filter(Boolean),
      };
    }
    case 'meihua': {
      const item = data as MeihuaData;
      return {
        title: '梅花起卦结果',
        tags: [
          `主卦：${item.originalName}`,
          `互卦：${item.interName || '无'}`,
          `变卦：${item.changedName || '无'}`,
          `动爻：第${item.movingYao.position}爻`,
        ],
        lines: [
          wrapMainEvidence(formatMeihuaFocusSummary(item)),
          `体卦：${item.tiGua.name}（${item.tiGua.element}）`,
          `用卦：${item.yongGua.name}（${item.yongGua.element}）`,
          `动爻：第${item.movingYao.position}爻`,
          `体用关系：${item.analysis.tiYongRelation}；${item.analysis.changedRelation}`,
          formatMeihuaSeasonSummary(item),
          `过程：${item.analysis.inter1Relation}、${item.analysis.inter2Relation}`,
          item.changedTiGua && item.changedYongGua
            ? `变后：体卦${item.changedTiGua.name}（${item.changedTiGua.element}）；用卦${item.changedYongGua.name}（${item.changedYongGua.element}）；关系${item.analysis.changedTiYongRelation}`
            : '',
          item.calculation?.method || item.calculation?.methodKey
            ? `起卦法：${item.calculation.method || item.calculation.methodKey}`
            : '',
        ].filter(Boolean),
      };
    }
    case 'xiaoliuren': {
      const item = data as XiaoliurenData;
      const evidence = item.evidenceAnalysis ?? analyzeXiaoliurenEvidence(item);
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
          `历法口径：${item.calculation.dayBoundary}；${item.calculation.leapMonthRule}`,
        ].filter(Boolean),
      };
    }
    case 'jinkoujue': {
      const item = data as JinkoujueData;
      const positions = item.positions;
      return {
        title: '金口诀起课结果',
        tags: [
          `起课方式：${item.methodLabel}`,
          `地分：${positions.diFen.branch}`,
          `将神：${positions.jiangShen.branch}`,
          `贵神：${positions.guiShen.branch}`,
          `人元：${positions.renYuan.stem || ''}${positions.renYuan.branch}`,
        ],
        lines: [
          item.mainLine,
          `阴阳发用：${item.yinYangUse.rule}；发用位${item.yinYangUse.usePosition}`,
          `动爻：${item.movements.map((movement) => `${movement.name}（${movement.trigger}）`).join('、') || '未触发五动或三动'}`,
          `月将贵人：月将${item.monthLeader}；${item.dayNight}贵人起${item.noblemanBranch}${item.calculation.noblemanDirection}`,
          `四位：地分${positions.diFen.branch}；将神${positions.jiangShen.branch}；贵神${positions.guiShen.branch}；人元${positions.renYuan.branch}`,
          `四位关系：贵将${item.relations.guiToJiang}；贵人${item.relations.guiToRen}；将地${item.relations.jiangToDi}`,
          item.xunKong.length ? `旬空：${item.xunKong.join('、')}` : '',
          item.summary,
        ].filter(Boolean),
      };
    }
    case 'qimen': {
      const item = data as QimenData;
      return {
        title: '奇门起局结果',
        tags: [
          `局数：${item.isYangDun ? '阳遁' : '阴遁'}${item.juShu}局`,
          `值符：${item.zhiFu}`,
          `值使：${item.zhiShi}`,
        ],
        lines: [
          `干支：${item.ganzhi.year}、${item.ganzhi.month}、${item.ganzhi.day}、${item.ganzhi.hour}`,
          `实际节气：${item.timeInfo.solarTerm}`,
          `定局：${item.timeInfo.juTerm || item.timeInfo.solarTerm}${item.timeInfo.epoch}`,
          wrapMainEvidence(formatQimenFocusSummary(item)),
          `格局：${item.patternTags?.join('、') || '未列'}`,
          formatQimenPatternComboSummary(item),
          `空亡：${item.voidBranches?.join('、') || '无'}`,
          item.horseStar
            ? `驿马：${item.horseStar.sourceBranch}时驿马在${item.horseStar.branch}`
            : '',
          formatQimenSeasonalitySummary(item),
          item.specialConditions?.description ? `时辰：${item.specialConditions.description}` : '',
        ].filter(Boolean),
      };
    }
    case 'liuren': {
      const item = data as LiurenData;
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
          `昼夜：${item.dayNight || '未记录'}；贵人${item.noblemanBranch || '未记录'}`,
          `日干寄宫：${item.dayStemResidence ? `${item.ganzhi.day.charAt(0)}寄${item.dayStemResidence}` : '未知'}`,
          `旬空：${item.xunKong?.length ? item.xunKong.join('、') : '未知'}`,
          `取传法：${item.transmissionRule || '未记录'}；传态：${item.transmissionPattern || '未记录'}`,
          `四课：${item.fourLessons.map((lesson) => `${lesson.name}${lesson.upper}/${lesson.lower}${lesson.relation}`).join('；')}`,
          `三传：${item.threeTransmissions.map((transmission) => `${transmission.stage}${transmission.branch}乘${transmission.god}`).join(' → ')}`,
          `课体：${item.guaTi?.join('、') || '无'}`,
          `神煞：${item.shenShaSummary?.length ? item.shenShaSummary.join('；') : '无'}`,
          ...formatLiurenDetailSummary(item),
        ].filter(Boolean),
      };
    }
    case 'tarot': {
      const item = data as TarotData;
      return {
        title: '塔罗抽牌结果',
        tags: [`牌阵：${item.spreadName}`, `张数：${item.cards.length}张`],
        lines: [
          wrapMainEvidence(formatTarotFocusSummary(item)),
          ...item.cards.map(
            (card) => `${card.position}：${card.name}（${card.reversed ? '逆位' : '正位'}）`,
          ),
        ].filter(Boolean),
      };
    }
    case 'ssgw': {
      const item = data as SsgwData;
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
      return {
        title: '雷诺曼抽牌结果',
        tags: [`牌阵：${item.spreadName}`, `张数：${item.cards.length}张`],
        lines: [
          wrapMainEvidence(
            item.cards
              .slice(0, 3)
              .map((card) => `${card.position}${card.name}`)
              .join('；'),
          ),
          ...item.cards.map((card) => {
            const evidence =
              item.evidenceAnalysis?.traditionalFacts && item.evidenceAnalysis.structuredLayoutFacts
                ? item.evidenceAnalysis
                : analyzeLenormandEvidence(item);
            const fact = evidence.traditionalFacts.find(
              (candidate) =>
                candidate.kind === '单牌牌义' && candidate.positions.includes(card.position),
            );
            return `${card.position}：${card.name}；${fact?.promptText ?? conditionLenormandTraditionalText(card.meaning, { cardNames: [card.name], keywords: card.keywords })}`;
          }),
          ...(item.combinations ?? []).map(
            (combination) => `${combination.card1}+${combination.card2}：${combination.meaning}`,
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
              .map((aspect) => `${aspect.body1}${aspect.symbol}${aspect.body2}`)
              .join('、') || '无'
          }`,
        ],
      };
    }
    case 'taiyi': {
      const item = data as TaiyiResult;
      return {
        title: `太乙神数${item.scope}计结果`,
        tags: [`${item.ganZhi}`, `${item.yinYang}${item.bureau}局`, `太乙在${item.taiyiPosition}`],
        lines: [
          `主算${item.lordCount}；客算${item.guestCount}；定算${item.setCount}`,
          `文昌${item.wenChangPosition}；始击${item.shiJiPosition}；计神${item.jiShenPosition}`,
          `判断：${item.judgments.join('；')}`,
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
  options?: { liuyaoTemplate?: LiuyaoTemplateType },
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
  _method?: SupportedDivinationMethod,
) {
  if (!info) return '';
  return [
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
}

export function buildDivinationPromptDocument(options: DivinationPromptOptions): PromptDocument {
  const question = options.question?.trim() || '请依据占卜资料分析当前问题。';
  const liuyaoTemplate = options.liuyaoTemplate ?? 'general';
  const liurenTemplate = options.liurenTemplate ?? 'general';
  const astrolabeTopic = options.astrolabeTopic ?? 'life';
  const task =
    options.method === 'astrolabe'
      ? `请依据星体、宫位、相位和盘面证据，重点分析${ASTROLABE_TOPIC_LABELS[astrolabeTopic]}并回答【问题】。`
      : buildTaskText(options.method);
  const templateText =
    options.method === 'liuyao'
      ? buildLiuyaoTemplateText(liuyaoTemplate)
      : options.method === 'liuren'
        ? buildLiurenTemplateText(liurenTemplate, options.data as LiurenData)
        : '';
  const supplementaryText = formatSupplementaryInfo(options.supplementaryInfo, options.method);
  const user = joinPromptSections([
    buildPromptGuidance(options.method),
    buildPromptSection('当前时间', formatPromptCurrentTime(options.currentTime)),
    supplementaryText ? buildPromptSection('补充信息', supplementaryText) : '',
    options.astrolabeScopeText ? buildPromptSection('分析对象', options.astrolabeScopeText) : '',
    buildPromptSection(
      '占卜资料',
      formatDivinationInfo(options.method, options.data, question, options.supplementaryInfo, {
        liuyaoTemplate,
      }),
    ),
    options.method === 'ssgw'
      ? ''
      : buildPromptSchoolSection(options.method as PromptSchoolMethod, options.schools),
    buildPromptSection('问题', question),
    templateText ? buildPromptSection('问题范围', templateText) : '',
    options.isCustomQuestion ? '' : buildPromptSection('任务', task),
  ]);
  return buildPromptDocument(user);
}

export function buildDivinationPrompt(options: DivinationPromptOptions) {
  return buildDivinationPromptDocument(options).text;
}
