import type { WuyunLiuqiResult } from '../wuyun-liuqi';
import { formatWuyunLiuqiFacts } from '../wuyun-liuqi';
import { DEFAULT_CHINA_TIMEZONE_HOURS, formatFixedTimezoneOffset } from '../calendar/civil-time';
import { TimeManager } from '../calendar/timeManager';
import { formatAstrolabeForPrompt } from './astrolabe';
import {
  formatLiurenGuaTiWithTransmissions,
  formatLiurenLesson,
  formatLiurenOrdinaryTransmissionAdjudication,
  formatLiurenTransmission,
  omitRepeatedLiurenFocusMonthState,
  omitRepeatedLiurenRidingMonthState,
} from './liuren-facts';
import { formatMeihuaFacts } from './meihua-facts';
import { analyzeMeihuaEvidence } from '../divination/meihua-evidence';
import {
  evaluateMeihuaTimelineTrend,
  getMeihuaTiYongSeasonEvaluation,
} from '../divination/algorithms/meihua';
import {
  formatQimenActiveStem,
  formatQimenHourStem,
  formatQimenRelationFacts,
} from './qimen-facts';
import { resolveXiaoliurenRule } from '../divination/xiaoliuren-rules';
import {
  analyzeXiaoliurenEvidence,
  formatXiaoliurenCalendarBoundary,
} from '../divination/xiaoliuren-evidence';
import { analyzeTarotEvidence } from '../divination/tarot-evidence';
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
import {
  formatQimenClassicPatternBasisForPrompt,
  getQimenActiveSpecialConditionText,
  selectQimenClassicPatternsForPrompt,
} from '../divination/qimen-evidence';
import { analyzeAlmanacEvidence, formatAlmanacGods } from '../divination/algorithms/almanac';
import { SIXTY_CYCLE, isSheng, isKe, isLiuhai, isSanxing } from '../ganzhi';
import {
  formatTianPanStars,
  formatTianPanStems,
  getDunJiaStem,
  hasTianPanStem,
} from '../divination/algorithms/qimen/helpers/palace-utils';
import type { DivinationMethodId } from 'mingyu-core/divination/config';
import { resolveLiuyaoEvidence } from '../divination/liuyao-evidence';
import type { LiuyaoLineFact } from '../divination/liuyao-evidence';
import { analyzeLiurenEvidence } from '../divination/liuren-evidence';
import { analyzeLenormandEvidence } from '../divination/lenormand-evidence';
import { assertHuangjiJingshiFacts, type HuangjiJingshiResult } from '../huangji-jingshi';
import type { KongmingHexagramResult, ZhugeNumberResult } from '../name-number';
import { castKongmingHexagram } from '../name-number/oracles';
import { ZHUGE_SIGNS } from '../name-number/zhuge-signs';
import { getZhugeInterpretation } from '../name-number/zhuge-interpretations';
import { formatHuangjiCivilYear } from '../huangji-jingshi/standard';
import { resolveSsgwSignFacts, resolveSsgwStoryContent } from '../divination/ssgw-content';
import { assertTaiyiFixedFacts, evaluateTaiyiConditions, formatTaiyiTacticBasis } from '../taiyi';
import { getTaiyiCountNature } from '../taiyi/evidence';
import {
  formatJinkoujueRelations,
  formatJinkoujueJudgmentFacts,
  formatJinkoujueBihe,
  formatJinkoujuePosition,
} from './jinkoujue-facts';
import { formatLiuyaoSanxing } from './liuyao-facts';
import { getGanZhiRelationTables } from '../ganzhi/relations';

const GANZHI_RELATION_TABLES = getGanZhiRelationTables();

function formatZhugeInfo(data: ZhugeNumberResult) {
  const sign = Number.isInteger(data.number) ? ZHUGE_SIGNS[data.number - 1] : undefined;
  if (!sign || data.sign?.number !== sign.number || data.sign.poem !== sign.poem) {
    throw new Error('诸葛签号与签诗资料不一致');
  }
  const interpretation = getZhugeInterpretation(data.number);
  const basicInterpretation = interpretation
    ? [
        sign.poem.includes(interpretation.quote) ? '' : interpretation.quote,
        interpretation.imageMeaning,
        interpretation.interpretation,
      ]
        .filter(Boolean)
        .join('；')
    : sign.summary;
  return [
    `签号：第${data.number}签`,
    `签诗：${data.sign.poem}`,
    interpretation?.classicalImage ? `典故：${interpretation.classicalImage}` : '',
    `基础解签：${basicInterpretation}`,
    interpretation?.condition ? `补充解释：${interpretation.condition}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatKongmingInfo(data: KongmingHexagramResult) {
  if (typeof data.symbol !== 'string') {
    throw new Error('孔明卦象与签谱资料不一致');
  }
  const resolved = castKongmingHexagram(data.symbol);
  if (
    data.number !== resolved.number ||
    data.name !== resolved.name ||
    data.grade !== resolved.grade ||
    data.poem !== resolved.poem
  ) {
    throw new Error('孔明卦象与签谱资料不一致');
  }
  const interpretation = resolved.interpretation;
  const classicalImage = interpretation.classicalImage;
  const basicInterpretation = [
    resolved.poem.includes(interpretation.quote) ? '' : interpretation.quote,
    interpretation.imageMeaning,
    interpretation.interpretation,
  ]
    .filter(Boolean)
    .join('；');
  return [
    `签号：第${data.number}签`,
    `签题：${data.name}`,
    `签诗：${data.poem}`,
    `吉凶级别：${data.grade}`,
    classicalImage
      ? `典故：${classicalImage.title}“${classicalImage.quote}”；${classicalImage.meaning}`
      : '',
    `基础解签：${basicInterpretation}`,
    `补充解释：${interpretation.condition}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function getMeihuaMethodLabel(
  calculation?: Pick<NonNullable<MeihuaData['calculation']>, 'method' | 'methodKey'> | null,
) {
  if (!calculation) {
    return '未给出';
  }

  const methodLabelMap: Record<string, string> = {
    time: '年月日时起卦法',
    number: '数字起卦法',
    random: '随机起卦法',
    timeTrigram: '年月日时起卦法',
  };

  if (calculation.methodKey && methodLabelMap[calculation.methodKey]) {
    return methodLabelMap[calculation.methodKey];
  }
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

function formatLiuyaoRawYao(item: LiuyaoData['yaosDetail'][number]) {
  const rawLabel: Record<number, string> = {
    6: '老阴',
    7: '少阳',
    8: '少阴',
    9: '老阳',
  };
  return rawLabel[item.rawValue] || item.changeType || item.yaoType;
}

function formatLiuyaoTriggerRelations(
  item: LiuyaoData['yaosDetail'][number],
  triggerLabel: string,
  triggerBranch: string,
  sanxingType: string | undefined,
) {
  if (!triggerBranch) return [];
  return [
    item.najiaDizhi === triggerBranch ? `值${triggerLabel}${triggerBranch}` : '',
    GANZHI_RELATION_TABLES.LIUHE_MAP[item.najiaDizhi] === triggerBranch
      ? `合${triggerLabel}${triggerBranch}`
      : '',
    GANZHI_RELATION_TABLES.LIUCHONG_MAP[item.najiaDizhi] === triggerBranch
      ? `冲${triggerLabel}${triggerBranch}`
      : '',
    isLiuhai(item.najiaDizhi, triggerBranch) ? `害${triggerLabel}${triggerBranch}` : '',
    isSanxing(item.najiaDizhi, triggerBranch)
      ? `刑${triggerLabel}${triggerBranch}${sanxingType ? `（${sanxingType}）` : ''}`
      : '',
  ].filter(Boolean);
}

function formatLiuyaoLifeStages(fact: LiuyaoLineFact) {
  const stages = fact.traditionalRelations;
  const isRiMu = fact.dayState.relations.includes('入日墓');
  const isDongMu = fact.constraints.includes('入动墓');
  const isHuaMu = fact.constraints.includes('动而化墓');
  return [
    stages.dayLifeStage ? `本爻${fact.najia.wuxing}在日辰支十二长生${stages.dayLifeStage}` : '',
    stages.twelveStage ? `本爻十二长生${stages.twelveStage}` : '',
    stages.movingLifeStages?.length
      ? `本爻${fact.najia.wuxing}在明动爻支十二长生${stages.movingLifeStages.map((stage) => `第${stage.position}爻${stage.branch}${stage.stage}`).join('、')}`
      : '',
    stages.changedLifeStage && fact.changedYao
      ? `本爻${fact.najia.wuxing}在变爻${fact.changedYao.branch}支十二长生${stages.changedLifeStage}`
      : '',
    isRiMu ? '入日墓' : '',
    isDongMu ? '入动墓' : '',
    isHuaMu ? '动而化墓' : '',
    stages.isRuMu && !isRiMu && !isDongMu && !isHuaMu ? '入墓' : '',
  ].filter(Boolean);
}

function formatLiuyaoElementChange(item: LiuyaoData['yaosDetail'][number]) {
  if (!item.changedYao) return '';
  const original = `本爻${item.najiaDizhi}${item.wuxing}`;
  const changed = `变爻${item.changedYao.dizhi}${item.changedYao.wuxing}`;
  const from = item.wuxing;
  const to = item.changedYao.wuxing;
  const relation = isSheng(to, from)
    ? `${changed}生${original}`
    : isKe(to, from)
      ? `${changed}克${original}`
      : isSheng(from, to)
        ? `${original}生${changed}，${changed}泄${original}`
        : isKe(from, to)
          ? `${original}克${changed}`
          : `${original}与${changed}同五行`;
  return `动变五行：${relation}`;
}

function formatLiuyaoLineFacts(
  item: LiuyaoData['yaosDetail'][number],
  data: LiuyaoData,
  fact: LiuyaoLineFact,
) {
  const monthBranch = getGanzhiBranch(data.ganzhi.month);
  const dayBranch = getGanzhiBranch(data.ganzhi.day);
  const triggerRelations =
    monthBranch && monthBranch === dayBranch
      ? formatLiuyaoTriggerRelations(
          item,
          '月建、日辰',
          monthBranch,
          fact.traditionalRelations.sanxingType,
        )
      : [
          ...formatLiuyaoTriggerRelations(
            item,
            '月建',
            monthBranch,
            fact.traditionalRelations.sanxingType,
          ),
          ...formatLiuyaoTriggerRelations(
            item,
            '日辰',
            dayBranch,
            fact.traditionalRelations.sanxingType,
          ),
        ];
  const activity = [
    item.isWorld ? '世' : '',
    item.isResponse ? '应' : '',
    item.isChanging ? '动' : '',
    item.isVoid ? '旬空' : '',
    fact.monthState.relations.includes('月破') ? '月破' : '',
    fact.activity === '暗动' ? '日冲暗动' : '',
    fact.dayState.relations.includes('日冲成破') ? '日冲成破' : '',
    fact.dayState.relations.includes('日辰冲动') ? '日辰冲动' : '',
  ].filter(Boolean);
  const lifeStages = formatLiuyaoLifeStages(fact);
  const changeConditions = [
    ...new Set([
      ...(fact.changedYao?.relations ?? []),
      ...(item.changedYao?.isVoid ? ['化空'] : []),
      ...(fact.changedYao?.direction ? [fact.changedYao.direction] : []),
    ]),
  ];
  const changed = item.changedYao
    ? `化${item.changedYao.liuqin}${item.changedYao.dizhi}${item.changedYao.wuxing}${changeConditions.length ? `（${changeConditions.join('、')}）` : ''}`
    : '';
  return [
    `原爻${item.yaoType}（${formatLiuyaoRawYao(item)}）`,
    fact.monthState.seasonState ? `月令${fact.monthState.seasonState}` : '',
    ...lifeStages,
    ...triggerRelations,
    ...activity,
    changed,
    formatLiuyaoElementChange(item),
  ]
    .filter(Boolean)
    .join('，');
}

function formatLiuyaoSpecialAdvice(data: LiuyaoData) {
  if (!data.specialPattern) return '';
  const normalized: Partial<Record<NonNullable<LiuyaoData['specialPattern']>, string>> = {
    静卦: '以本卦卦意、世应和用神为主',
    独静卦: '以独静爻为关键并参看变卦趋势',
    全动卦: '整体参看本卦与变卦气势，并以用神旺衰为主',
    乾卦用九: '“见群龙无首，吉”；并参看变卦总势',
    坤卦用六: '“利永贞”；并参看变卦总势',
  };
  return normalized[data.specialPattern] || data.specialAdvice || '';
}

function formatHiddenSpirit(item: NonNullable<LiuyaoData['hiddenSpirits']>[number]) {
  const effectText = item.interactionEffect ? `（${item.interactionEffect}）` : '';
  return `${item.sixRelative}伏第${item.position}爻${item.najiaDizhi}${item.wuxing}${item.isVoid ? '（空）' : ''}，伏于${item.underYao.sixRelative}${item.underYao.najiaDizhi}${item.underYao.wuxing}下${effectText}`;
}

function createLiuyaoTimingEvidence(data: LiuyaoData, lineFacts: LiuyaoLineFact[]): string {
  if (!data.yaosDetail || !data.yaosDetail.length) return '';
  const clues: string[] = [];

  const changingYaos = data.yaosDetail.filter((item) => item.isChanging);
  for (const yao of changingYaos) {
    const yaoName = `第${yao.position}爻${yao.sixRelative}${yao.najiaDizhi}`;
    const chongBranch = GANZHI_RELATION_TABLES.LIUCHONG_MAP[yao.najiaDizhi] || '';
    const heBranch = GANZHI_RELATION_TABLES.LIUHE_MAP[yao.najiaDizhi] || '';
    const conditions: string[] = [];
    const changed = lineFacts.find((item) => item.position === yao.position)?.changedYao;
    if (changed?.direction === '化进神' && yao.changedYao) {
      conditions.push(`化进神，逢变爻${yao.changedYao.dizhi}当值可核进神作用`);
    } else if (changed?.direction === '化退神' && yao.changedYao) {
      conditions.push(`化退神，逢变爻${yao.changedYao.dizhi}当值可核退神作用`);
    }
    if (changed?.relations.includes('回头克') && yao.changedYao)
      conditions.push(`回头克，逢变爻${yao.changedYao.dizhi}当值可核克制条件`);
    if (yao.isVoid) conditions.push(`本爻旬空，逢${yao.najiaDizhi}出空或逢${chongBranch}冲空可核`);
    if (yao.changedYao?.isVoid)
      conditions.push(`变爻${yao.changedYao.dizhi}旬空，逢其出空或冲空可核`);
    if (
      lineFacts.some(
        (item) => item.position === yao.position && item.monthState.relations.includes('月破'),
      )
    )
      conditions.push(`本爻月破，出月或逢${heBranch}合破可核`);
    if (!conditions.length) conditions.push(`逢${yao.najiaDizhi}当值或逢${heBranch}合动可核`);
    clues.push(`${yaoName}发动：${conditions.join('；')}`);
  }

  if (!changingYaos.length) {
    const hiddenMoves = lineFacts.filter((item) => item.activity === '暗动');
    if (hiddenMoves.length) {
      for (const yao of hiddenMoves)
        clues.push(`静卦见第${yao.position}爻${yao.najia.branch}暗动，逢冲动或当值可核`);
    } else {
      const worldYao = data.yaosDetail.find((item) => item.isWorld);
      if (worldYao) {
        const monthBreak = lineFacts.some(
          (item) =>
            item.position === worldYao.position && item.monthState.relations.includes('月破'),
        );
        if (worldYao.isVoid) {
          clues.push(`世爻${worldYao.najiaDizhi}旬空，逢其出空或冲空可核`);
        }
        if (monthBreak) clues.push(`世爻${worldYao.najiaDizhi}月破，出月、逢合或逢生可核`);
        if (!worldYao.isVoid && !monthBreak)
          clues.push(`静卦世爻${worldYao.najiaDizhi}逢值或生旺可作观察条件`);
      }
    }
  }

  return [...new Set(clues)].join('；');
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
  if (!relations) {
    return '';
  }

  const details = [...(relations.fanyin ?? []), ...(relations.fuyin ?? [])].map(
    (item) => `${item.label}（${item.kind}，${item.scope}）：${item.description}`,
  );
  return details.length ? [...new Set(details)].join('；') : relations.labels.join('；');
}

function getGanzhiBranch(value?: string) {
  return value ? value.slice(-1) : '';
}

function formatLiuyaoElementDirection(
  source: string,
  sourceElement: string,
  target: string,
  targetElement: string,
) {
  if (isSheng(sourceElement, targetElement)) return `${source}生${target}，${target}泄${source}`;
  if (isKe(sourceElement, targetElement)) return `${source}克${target}`;
  if (isSheng(targetElement, sourceElement)) return `${target}生${source}，${source}泄${target}`;
  if (isKe(targetElement, sourceElement)) return `${target}克${source}`;
  return `${source}与${target}同五行`;
}

function createLiuyaoMonthDayEvidence(data: LiuyaoData) {
  const monthBranch = getGanzhiBranch(data.ganzhi.month);
  const dayBranch = getGanzhiBranch(data.ganzhi.day);
  const monthClash = GANZHI_RELATION_TABLES.LIUCHONG_MAP[monthBranch] || '';
  const dayClash = GANZHI_RELATION_TABLES.LIUCHONG_MAP[dayBranch] || '';
  const directions: string[] = [];
  const describeBranchHit = (label: string, branch: string, clashBranch: string) => {
    const sameYaos = data.yaosDetail
      .filter((item) => item.najiaDizhi === branch)
      .map(formatLiuyaoYaoBrief);
    const clashYaos = data.yaosDetail
      .filter((item) => item.najiaDizhi === clashBranch)
      .map(formatLiuyaoYaoBrief);
    const parts = [
      sameYaos.length ? `同支${sameYaos.join('、')}` : '',
      clashYaos.length ? `冲${clashYaos.join('、')}` : '',
    ].filter(Boolean);
    const element = GANZHI_RELATION_TABLES.BRANCH_WUXING[branch];
    if (element)
      directions.push(
        ...data.yaosDetail.map((item) =>
          formatLiuyaoElementDirection(
            `${label}${branch}${element}`,
            element,
            formatLiuyaoYaoBrief(item),
            item.wuxing,
          ),
        ),
      );
    return parts.length ? `${label}${branch}：${parts.join('，')}` : '';
  };

  const branchText =
    monthBranch && monthBranch === dayBranch
      ? describeBranchHit('月建、日辰', monthBranch, monthClash)
      : [
          describeBranchHit('月建', monthBranch, monthClash),
          describeBranchHit('日辰', dayBranch, dayClash),
        ]
          .filter(Boolean)
          .join('；');
  return { branchText, elementText: directions.join('；') };
}

function formatLiuyaoInfo(
  data: LiuyaoData,
  topic: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen' = 'general',
) {
  const resolved = resolveLiuyaoEvidence(data, { topic });
  data = resolved.data;
  const evidenceAnalysis = resolved.analysis;
  const worldYao = data.yaosDetail.find((item) => item.isWorld);
  const responseYao = data.yaosDetail.find((item) => item.isResponse);
  const voidYaoText = data.yaosDetail
    .filter((item) => item.isVoid || item.changedYao?.isVoid)
    .map((item) => {
      const parts = [
        item.isVoid
          ? `本爻空亡；本爻${item.najiaDizhi}逢值，${GANZHI_RELATION_TABLES.LIUCHONG_MAP[item.najiaDizhi]}冲${item.najiaDizhi}`
          : '',
        item.changedYao?.isVoid
          ? `变爻空亡；变爻${item.changedYao.dizhi}逢值，${GANZHI_RELATION_TABLES.LIUCHONG_MAP[item.changedYao.dizhi]}冲${item.changedYao.dizhi}`
          : '',
      ].filter(Boolean);
      return `${formatLiuyaoYaoBrief(item)}（${parts.join('、')}）`;
    });
  const hiddenSpiritText = data.hiddenSpirits?.length
    ? data.hiddenSpirits.map(formatHiddenSpirit).join('；')
    : '';
  const hexagramRelationText = formatLiuyaoHexagramRelation(data);

  const fanfuRelationText = formatLiuyaoFanFuRelation(data);
  const lineCoverage = evidenceAnalysis.lineCoverageFact;
  const coverageNotes = [
    lineCoverage.status !== '完整'
      ? [
          lineCoverage.actualPositions.length
            ? `逐爻资料已列第${lineCoverage.actualPositions.join('、')}爻`
            : '逐爻资料未列',
          lineCoverage.missingPositions.length
            ? `缺少第${lineCoverage.missingPositions.join('、')}爻`
            : '',
          lineCoverage.duplicatePositions.length
            ? `第${lineCoverage.duplicatePositions.join('、')}爻重复`
            : '',
          lineCoverage.invalidPositions.length
            ? `越界爻位${lineCoverage.invalidPositions.join('、')}`
            : '',
        ]
          .filter(Boolean)
          .join('；')
      : '',
    evidenceAnalysis.hiddenSpiritCoverageFact.status === '字段缺失' ? '伏神记录未提供' : '',
  ].filter(Boolean);
  const coverageText = coverageNotes.length ? `资料覆盖：${coverageNotes.join('；')}。` : '';
  const selectedUsefulGod = evidenceAnalysis.candidates.find(
    (item) => item.key === evidenceAnalysis.selectionFact.selectedCandidateKey,
  );
  const usefulGodMainLine = selectedUsefulGod
    ? [
        `用神：${selectedUsefulGod.relative || selectedUsefulGod.label}`,
        `盘面${selectedUsefulGod.references.map((item) => `${item.source === '伏神' ? '伏神' : ''}第${item.position}爻${item.sixRelative}${item.branch}${item.wuxing}`).join('、') || '未见'}`,
        selectedUsefulGod.support.length ? `支持${selectedUsefulGod.support.join('、')}` : '',
        selectedUsefulGod.constraints.length
          ? `限制${selectedUsefulGod.constraints.join('、')}`
          : '',
      ]
        .filter(Boolean)
        .join('；')
    : `用神主线：${evidenceAnalysis.selectionFact.promptText}`;
  const godChain = evidenceAnalysis.godChain.filter((item) => item.role !== '用神');
  const godChainText =
    godChain.length && selectedUsefulGod
      ? `以所选用神为对象的生克关系：${godChain
          .map(
            (item) =>
              `${item.role}${item.wuxing || ''}（${item.relation}）${item.status === '盘中有对应' ? `见${item.references.map((ref) => `${ref.source === '伏神' ? '伏神' : ''}第${ref.position}爻${ref.sixRelative}${ref.branch}${ref.wuxing}`).join('、')}` : '未见'}`,
          )
          .join('；')}`
      : '';
  const monthDayEvidence = createLiuyaoMonthDayEvidence(data);
  const timingEvidence = createLiuyaoTimingEvidence(data, evidenceAnalysis.lineFacts);
  const dayBranch = getGanzhiBranch(data.ganzhi.day);
  const monthBranch = getGanzhiBranch(data.ganzhi.month);
  const sharedSanhe = data.sanheWithDay && data.sanheWithMonth && dayBranch === monthBranch;
  const sanheParts = [
    data.sanheWithDay
      ? `${sharedSanhe ? '月建、日辰' : '日辰'}${dayBranch}与动变爻同见${data.sanheWithDay.group}三支（${data.sanheWithDay.members.join('、')}）`
      : '',
    data.sanheWithMonth && !sharedSanhe
      ? `月建${monthBranch}与动变爻同见${data.sanheWithMonth.group}三支（${data.sanheWithMonth.members.join('、')}）`
      : '',
  ].filter(Boolean);
  const sanheDetail = sanheParts.length ? `三合三支：${sanheParts.join('；')}` : null;
  const sanxingDetail = data.sanxingInYaos?.length
    ? `刑支关系：${formatLiuyaoSanxing(data.sanxingInYaos)}`
    : null;
  return [
    '占法：六爻',
    ...(data.generation?.method === 'time'
      ? [
          `起卦时刻（UTC）：${new Date(data.timestamp).toISOString()}`,
          ...evidenceAnalysis.generationFacts,
        ]
      : data.generation?.method === 'yarrow'
        ? evidenceAnalysis.generationFacts
        : []),
    `核心结构：主卦${data.originalName}${data.palace?.name ? `（${data.palace.name}宫）` : ''}；变卦${data.changingYaos.length ? data.changedName || '未列' : '无'}；互卦${data.interName || '无'}${data.specialPattern ? `；卦式${data.specialPattern}${formatLiuyaoSpecialAdvice(data) ? `：${formatLiuyaoSpecialAdvice(data)}` : ''}` : ''}`,
    coverageText,
    data.palaceStage ? `八宫卦位：${data.palaceStage}` : '',
    data.guaShen?.branch
      ? `卦身：在【${data.guaShen.branch}】，居第${data.guaShen.position}爻${data.guaShen.sixRelative ? `，六亲${data.guaShen.sixRelative}` : ''}`
      : '',
    hexagramRelationText ? `整卦关系：${hexagramRelationText}` : '',
    fanfuRelationText ? `反伏关系：${fanfuRelationText}` : '',
    worldYao || responseYao
      ? `世应：${worldYao ? `世爻${formatLiuyaoYaoBrief(worldYao)}` : '世爻未列'}；${responseYao ? `应爻${formatLiuyaoYaoBrief(responseYao)}` : '应爻未列'}`
      : '',
    worldYao && responseYao
      ? `世应五行：${formatLiuyaoElementDirection('世爻', worldYao.wuxing, '应爻', responseYao.wuxing)}`
      : '',
    usefulGodMainLine,
    godChainText,
    Array.isArray(data.hiddenSpirits)
      ? `明伏分布：本卦明爻${data.yaosDetail.length}爻，六亲为${[...new Set(data.yaosDetail.map((item) => item.sixRelative))].join('、')}；伏神${data.hiddenSpirits.length}爻${hiddenSpiritText ? `：${hiddenSpiritText}` : ''}`
      : '',
    data.yaosDetail?.length
      ? [
          lineCoverage.status === '完整' ? '六爻全表：' : '六爻逐爻资料（覆盖不完整）：',
          ...data.yaosDetail.map((item, index) => {
            const god = data.sixGods?.[item.position - 1] || '';
            const lineFacts = formatLiuyaoLineFacts(item, data, evidenceAnalysis.lineFacts[index]);
            return `  ${formatLiuyaoYaoBrief(item)}${god ? `，六神${god}` : ''}${lineFacts ? `，${lineFacts}` : ''}`;
          }),
        ].join('\n')
      : '',
    `旬空${data.voidBranches?.length ? data.voidBranches.join('、') : '未列'}${voidYaoText.length ? `；命中${voidYaoText.join('、')}` : ''}`,
    lineCoverage.status !== '完整' && monthDayEvidence.branchText
      ? `月日触发：${monthDayEvidence.branchText}`
      : '',
    monthDayEvidence.elementText ? `月日五行：${monthDayEvidence.elementText}` : '',
    sanheDetail ? sanheDetail : '',
    sanxingDetail ? sanxingDetail : '',
    timingEvidence ? `应期观察条件：${timingEvidence}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

type MeihuaClassicalEntry = {
  kind: '卦辞' | '爻辞';
  text: string;
  references: Array<{
    stage: '主卦' | '互卦' | '变卦';
    hexagram: string;
  }>;
};

function formatMeihuaClassicalText(data: MeihuaData) {
  const entries = new Map<string, MeihuaClassicalEntry>();
  const add = (
    kind: MeihuaClassicalEntry['kind'],
    text: string | undefined,
    reference: MeihuaClassicalEntry['references'][number],
  ) => {
    if (!text?.trim()) return;
    const key = `${kind}:${text}`;
    const entry = entries.get(key);
    if (entry) {
      entry.references.push(reference);
      return;
    }
    entries.set(key, { kind, text, references: [reference] });
  };
  const stages = [
    ['主卦', data.mainHexagram],
    ['互卦', data.interHexagram],
    ['变卦', data.changedHexagram],
  ] as const;
  for (const [stage, hexagram] of stages) {
    if (!hexagram) continue;
    add('卦辞', hexagram.description, { stage, hexagram: hexagram.name });
    if (stage === '主卦') {
      add('爻辞', hexagram.movingYaoCi || hexagram.yaoCi?.[data.movingYao.position - 1], {
        stage,
        hexagram: hexagram.name,
      });
    }
  }

  return [...entries.values()].map((entry) => {
    if (entry.kind === '卦辞') {
      const stageNames = [...new Set(entry.references.map((item) => item.stage))].join('、');
      const names = [...new Set(entry.references.map((item) => item.hexagram))].join('、');
      return `${stageNames}卦辞：${names}，${entry.text}`;
    }
    return `动爻爻辞：第${data.movingYao.position}爻，${entry.text}`;
  });
}

function formatMeihuaInfo(data: MeihuaData) {
  const evidence = analyzeMeihuaEvidence(data);
  if (evidence.calculationFact.status === '计算不一致') {
    throw new Error(`梅花盘面与起卦资料不一致：${evidence.calculationFact.promptText}`);
  }
  const calculation = data.calculation;
  const methodLabel = getMeihuaMethodLabel(calculation);
  const facts = formatMeihuaFacts(data);
  const hasCalculationFact = facts.some((fact) => fact.startsWith('起卦取数：'));
  const stages = evidence.stages;
  const hasResultStage = stages.some(
    (stage) => stage.stage === 'result' && stage.status === '已计算',
  );
  const hasCompleteStages =
    stages.length === 3 && stages.every((stage) => stage.status === '已计算');
  const processStage = stages.find((stage) => stage.stage === 'process');
  const processHexagram = processStage
    ? data.interHexagram?.name || data.interName || '互卦'
    : '无';
  const resultHexagram = hasResultStage
    ? data.changedHexagram?.name || data.changedName || '变卦'
    : '无';
  const interRelationText = (
    processStage ? [data.analysis.inter1Relation, data.analysis.inter2Relation] : []
  )
    .filter(Boolean)
    .map((relation) => `；${relation}`)
    .join('');
  const classicalLines = formatMeihuaClassicalText(data);
  const yingQiConditions = evidence.timingFacts
    .filter((fact) => fact.type === '原应期条件')
    .map((fact) => fact.promptText.replace('，只作取数来源旁证，不换算绝对日期', '；取数来源旁证'));
  const originStage = stages.find((stage) => stage.stage === 'origin');
  const resultStage = stages.find((stage) => stage.stage === 'result');
  const stagePromptTexts = stages.map((stage) =>
    stage.status !== '已计算'
      ? `${stage.label}：卦象结构资料未记录，体用关系待核`
      : stage.stage === 'origin'
        ? `主卦体用依据：${stage.basis}`
        : stage.promptText,
  );
  const originRelation = originStage?.relation;
  const originSeasonEvaluation = originStage
    ? getMeihuaTiYongSeasonEvaluation(
        originStage.relation,
        originStage.ti.seasonState,
        originStage.yong.seasonState,
      )
    : '';
  const originSeasonRelationPrefix = originRelation ? `主卦${originRelation}，` : '';
  const originSeasonConditions =
    originRelation &&
    originRelation !== '比和' &&
    originSeasonEvaluation.startsWith(originSeasonRelationPrefix)
      ? originSeasonEvaluation.slice(originSeasonRelationPrefix.length)
      : originSeasonEvaluation;
  const timingConditions = yingQiConditions.map((condition) =>
    originRelation ? condition.replace(`${originRelation}，`, '') : condition,
  );
  const yingQiText = timingConditions.length ? `应期条件：${timingConditions.join('；')}` : '';
  const generationText =
    calculation && methodLabel !== '未给出'
      ? `起卦法：${methodLabel}${!hasCalculationFact && typeof calculation.number === 'number' ? `；起卦数字${calculation.number}` : ''}`
      : '';
  const timeline =
    hasCompleteStages && originStage && processStage && resultStage
      ? evaluateMeihuaTimelineTrend({
          tiElement: originStage.ti.element,
          originalYongElement: originStage.yong.element,
          interTiElement: processStage.ti.element,
          interYongElement: processStage.yong.element,
          changedTiElement: resultStage.ti.element,
          changedYongElement: resultStage.yong.element,
        })
      : undefined;
  const timelineText = timeline
    ? `阶段关系：盘内关系走势${timeline.trend}；体用强弱与应期合参主互变、所问事项及现实进展`
    : '';

  return [
    '占法：梅花易数',
    `核心结构：主卦${data.originalName}${processHexagram !== '无' ? `；互卦${processHexagram}` : ''}${resultHexagram !== '无' ? `；变卦${resultHexagram}` : ''}`,
    `体用：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${data.analysis.tiYongRelation}`,
    ...facts,
    classicalLines.length ? `卦辞与爻辞：\n${classicalLines.join('\n')}` : '',
    processHexagram !== '无' && interRelationText
      ? `互卦：${processHexagram}${interRelationText}`
      : '',
    stagePromptTexts.length ? `体用阶段：\n${stagePromptTexts.join('\n')}` : '',
    !processStage ? '互卦体用资料未列' : '',
    !hasResultStage && !resultStage ? '变卦体用资料未列' : '',
    generationText,
    originStage?.status === '已计算' ? `主卦体用月令条件：${originSeasonConditions}` : '',
    timelineText,
    yingQiText,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatXiaoliurenInfo(data: XiaoliurenData, omitRepeatedCivilTime = false) {
  analyzeXiaoliurenEvidence(data);
  const rule = resolveXiaoliurenRule(data.rule);
  const formatBeijingDateTime = (timestamp: number) => {
    const parts = TimeManager.getWallClockParts(
      new Date(timestamp),
      DEFAULT_CHINA_TIMEZONE_HOURS * 60,
    );
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${parts.year}-${pad(parts.month)}-${pad(parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}`;
  };
  const civilTimeLines = [
    ...(!omitRepeatedCivilTime || data.termReferenceTimestamp !== undefined
      ? [
          `公历占时（北京时间）：${formatBeijingDateTime(data.termReferenceTimestamp ?? data.timestamp)}`,
        ]
      : []),
    ...(data.termReferenceTimestamp !== undefined
      ? [`真太阳时校正时刻：${formatBeijingDateTime(data.timestamp)}（用于定${data.hourLabel}）`]
      : []),
  ];
  const calendarBasis = data.calculation
    ? [
        data.calculation.dayBoundary,
        data.calculation.leapMonthRule,
        data.calculation.hourNumber === 1
          ? '子时序数为1，晚子时与早子时各按所在民用日的农历日期起课'
          : '',
        formatXiaoliurenCalendarBoundary(data),
      ]
        .filter(Boolean)
        .join('；')
    : '';
  const firstDayPalace = data.palaceOrder.find(
    (palace) => palace.index === (data.sequence.month.index + rule.dayStartOffset) % 6,
  );
  if (!firstDayPalace) throw new Error('小六壬初一对应宫位缺失');
  return [
    '占法：小六壬',
    ...civilTimeLines,
    `起课：农历${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}`,
    '起课过程：月、日、时各段起点计为第一位',
    `  定月宫：${data.isLeapMonth ? '闰' : ''}${data.lunarMonth}月从大安顺数，落${data.sequence.month.name}`,
    `  定日宫：从月宫${data.sequence.month.name}${rule.dayStartOffset ? '下一宫' : ''}起初一（${firstDayPalace.name}），顺数至${data.lunarDay}日，落${data.sequence.day.name}`,
    `  定时宫：从日宫${data.sequence.day.name}起子时，顺数至${data.hourLabel}`,
    calendarBasis ? `历法口径：${calendarBasis}` : '',
    '时点范围：本课说明当前起课时点的占得宫；其他日期或时辰的宫位采用对应农历月日与时辰重新顺数',
    `起课口径：${rule.source}`,
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

function getQimenScopePresentation(data: QimenData) {
  const scope = data.scope ?? 'hour';
  const config = {
    year: { scopeLabel: '年家', branchLabel: '年支' },
    month: { scopeLabel: '月家', branchLabel: '月支' },
    day: { scopeLabel: '日家', branchLabel: '日支' },
    hour: { scopeLabel: '时家', branchLabel: '时支' },
  } as const;
  return { scope, ...(config[scope] ?? config.hour) };
}

const qimenComboKindsByIntent = {
  military: [
    'baihuKaiJing',
    'baihuXiuMen',
    'dingRenBlocked',
    'qinglongReturningHost',
    'flyingBirdGuest',
    'flyingBirdShengMen',
    'zhuqueToujiangHost',
    'tengsheYaoyaoHold',
    'tengsheMoveWuJi',
    'xingDeKaiHe',
    'starPalaceHostGuest',
    'doorPalaceHostGuest',
    'starDoorHostGuestInjury',
    'doorSeasonQi',
    'sanShengDi',
    'tianYiJiChong',
    'wuBuJi',
    'baJiangHuiMen',
    'youDuLuDu',
    'tianMuDiEr',
    'xunGuXu',
    'tianGangTime',
    'lostRoute',
    'tingTingBaiJian',
    'tianMenDiHuTaiYinQingLong',
    'campLayout',
    'yangYinHourHostGuest',
    'xunZhongDiBingDay',
    'daJiangJunDirection',
    'taiSuiDirection',
    'yueJianDirection',
    'taiYinDirection',
    'fourGodDirections',
    'heKuiDirection',
    'wuJiangDirection',
    'shiZhongJiangXing',
    'xiongCiDirection',
    'dayStemAttackAvoidance',
  ],
  route: [
    'quSan',
    'biWu',
    'xunGuXu',
    'tianMaDirection',
    'lostRoute',
    'tianSanMenDiSiHu',
    'earthPrivateDoor',
    'tianMenDiHuTaiYinQingLong',
  ],
  escape: [
    'dingRenBlocked',
    'dingRenShengMen',
    'tengsheMoveWuJi',
    'xunGuXu',
    'tianMaDirection',
    'tianSanMenDiSiHu',
    'earthPrivateDoor',
    'tianMenDiHuTaiYinQingLong',
    'fourGodDirections',
  ],
  direction: ['sanShengDi', 'quSan', 'biWu', 'tianMaDirection', 'tianSanMenDiSiHu'],
  object: ['objectClues'],
  timing: ['zhiFuOpenClose'],
  door: ['doorSeasonQi'],
  stem: ['stemPressure'],
} as const;

function formatQimenInfo(data: QimenData, question = '', supplementaryInfo?: SupplementaryInfo) {
  const evidenceAnalysis = analyzeQimenEvidence(data);
  const zhiFuPalace = data.jiuGongGe.find(
    (item) => item.tianPan.star === data.zhiFu || item.tianPan.companionStar === data.zhiFu,
  );
  const zhiShiPalace = data.jiuGongGe.find((item) => item.renPan.door === data.zhiShi);
  const voidText = data.voidPalaces?.length
    ? data.voidPalaces.map((item) => `${item.branch}空落${item.name}`).join('、')
    : data.voidBranches?.length
      ? `${data.voidBranches.join('、')}空`
      : '无';
  const scopePresentation = getQimenScopePresentation(data);
  const horseText = data.horseStar
    ? scopePresentation.scope === 'hour'
      ? `${data.horseStar.sourceBranch}时驿马在${data.horseStar.branch}，落${data.horseStar.name}`
      : `${scopePresentation.branchLabel}${data.horseStar.sourceBranch}起驿马在${data.horseStar.branch}，落${data.horseStar.name}`
    : '无';
  const allClassicPatternFacts = evidenceAnalysis.patternFacts.filter(
    (item) => item.kind === '经典格局' && item.status === '已命中',
  );
  const classicPatternFacts = selectQimenClassicPatternsForPrompt(allClassicPatternFacts);
  const classicPatternLines = [
    ...new Set(
      classicPatternFacts.map((item) => {
        const tone =
          item.traditionalTone === '有利'
            ? '吉格'
            : item.traditionalTone === '风险'
              ? '凶格'
              : '中性格局';
        const basis = formatQimenClassicPatternBasisForPrompt(item, allClassicPatternFacts, data);
        const missingPalaces = item.palaces
          .map((gong) => data.jiuGongGe.find((palace) => palace.gong === gong)?.name ?? `${gong}宫`)
          .filter((name) => !basis.includes(name));
        const basisText = basis === item.name ? '' : `：${basis}`;
        return `${item.name}（${tone}${missingPalaces.length ? `，${missingPalaces.join('、')}` : ''}）${basisText}`;
      }),
    ),
  ];
  const questionContext = [
    question,
    supplementaryInfo?.currentSituation,
    supplementaryInfo?.knownFacts,
    supplementaryInfo?.userSupplement,
  ]
    .filter(Boolean)
    .join(' ');
  const militaryQuestion =
    /兵事|军事|战争|战斗|战役|打仗|作战|部队|军队|行军|攻守|攻防|敌军|演习|兵法|进攻|防守|交战|驻军|下营|战术/u.test(
      questionContext,
    );
  const routeQuestion = /出行|旅行|旅途|行程|路线|导航|迷路|远行|赶路/u.test(questionContext);
  const escapeQuestion = /避难|逃生|逃离|脱险|躲避|隐避|隐蔽|避犯|逃亡|隐遁/u.test(questionContext);
  const directionQuestion = /择方|方位|方向|朝向|坐向|选址/u.test(questionContext);
  const objectQuestion =
    /射覆|寻物|找东西|找物|失物|物品|是什么东西|丢失.{0,6}(?:物|东西|手机|手表|钱包|钥匙)/u.test(
      questionContext,
    );
  const timingQuestion = /应期|何时|什么时候|择时|时机|推进时间|几时|哪天/u.test(questionContext);
  const doorQuestion = /用门|门气|八门旺衰|门旺衰|门的强弱|八门余气/u.test(questionContext);
  const stemQuestion = /命宫|命干|奇仪受制|十干迫制|用神干|天盘干受制/u.test(questionContext);
  const selectedComboKinds = new Set<string>([
    ...(militaryQuestion ? qimenComboKindsByIntent.military : []),
    ...(routeQuestion ? qimenComboKindsByIntent.route : []),
    ...(escapeQuestion ? qimenComboKindsByIntent.escape : []),
    ...(directionQuestion ? qimenComboKindsByIntent.direction : []),
    ...(objectQuestion ? qimenComboKindsByIntent.object : []),
    ...(timingQuestion ? qimenComboKindsByIntent.timing : []),
    ...(doorQuestion ? qimenComboKindsByIntent.door : []),
    ...(stemQuestion ? qimenComboKindsByIntent.stem : []),
  ]);
  const comboLines = [
    ...new Set(
      (data.patternCombos ?? [])
        .filter(
          (item) =>
            selectedComboKinds.has(item.key.split(':')[1] ?? '') &&
            item.name.trim() &&
            item.summary.trim(),
        )
        .map((item) => {
          const palaceName = item.palace
            ? (data.jiuGongGe.find((palace) => palace.gong === item.palace)?.name ??
              `${item.palace}宫`)
            : '';
          const name =
            item.name.includes(palaceName) || !palaceName
              ? item.name
              : `${item.name}（${palaceName}）`;
          const fullSummary = item.summary.replace(
            /(?:，|；)?不(?:作|替代|重复加算)通用(?:(?:吉凶|吉格|凶格)评分|凶方扣分)。?/gu,
            '',
          );
          const summaryWithoutRepeatedPattern = (data.classicPatterns ?? []).reduce(
            (summary, pattern) => {
              if (
                !palaceName ||
                item.palace === undefined ||
                !pattern.palaces.includes(item.palace) ||
                !item.sources.includes(pattern.name)
              ) {
                return summary;
              }
              return summary.replaceAll(`${palaceName}${pattern.name}`, '该格局');
            },
            fullSummary,
          );
          const summary =
            palaceName && summaryWithoutRepeatedPattern.startsWith(palaceName)
              ? summaryWithoutRepeatedPattern.slice(palaceName.length)
              : summaryWithoutRepeatedPattern;
          const hostGuestInjuryBoundary = item.key.startsWith('combo:starDoorHostGuestInjury:')
            ? summary.indexOf('宫为主，星门为客；')
            : -1;
          const involvedPalaces = [
            ...new Set(item.sources.map((source) => source.split('：', 1)[0]).filter(Boolean)),
          ];
          const compactedHostGuestSummary =
            hostGuestInjuryBoundary >= 0 && involvedPalaces.length
              ? `同宫星门与宫各见一生一克：${involvedPalaces.join('、')}。${summary.slice(hostGuestInjuryBoundary)}`
              : summary;
          const compactedSummary = compactedHostGuestSummary.replace(
            /^(?:该格局(?:同宫生门)?|飞鸟跌穴同宫生门)[，；]/u,
            '',
          );
          // 基础格局已逐条解释，复合格局只保留组合结论，避免再次罗列来源条件。
          return name.trim() && compactedSummary.trim() ? `${name}：${compactedSummary}` : '';
        })
        .filter(Boolean),
    ),
  ];
  const palaceLines = data.jiuGongGe.map((palace) => {
    return `  ${palace.name}（${palace.direction}，${palace.element}）：门${palace.renPan.door || '无'}，星${formatTianPanStars(palace) || '无'}，神${palace.shenPan.god || '无'}，天盘${formatTianPanStems(palace) || '无'}${palace.tianPan.companionStem ? `（${palace.tianPan.companionStem}为寄干）` : ''}，地盘${palace.diPan.stem || '无'}`;
  });
  const isYearOrMonth = scopePresentation.scope === 'year' || scopePresentation.scope === 'month';
  const seasonalitySummary =
    !isYearOrMonth && data.seasonality
      ? [
          `节气五行${data.seasonality.seasonalElement || '未列'}`,
          `日干${data.seasonality.dayStem}${data.seasonality.seasonRelation}`,
        ].join('；')
      : '';
  const specialConditionsText = getQimenActiveSpecialConditionText(data);
  const juTerm = data.timeInfo?.juTerm || data.timeInfo?.solarTerm || '未列';
  const juMethodText = isYearOrMonth
    ? `《奇门遁甲统宗》${scopePresentation.scope === 'year' ? '年家一百八十年' : '月家五年'}三元阴遁定局`
    : data.juMethod === 'zhirun'
      ? '置闰法定局'
      : '拆补法定局';
  const birthInfo = formatQimenBirthInfo(data, supplementaryInfo);

  const triggerConditions = [...new Set(data.yingQi?.triggerConditions ?? [])];
  const yingQiSources = [
    ...new Set(
      (data.yingQi?.sources ?? []).map((source) =>
        source.startsWith('未选定事项用神') ? '当前以值符宫作通用参考，事项用神按问题确定' : source,
      ),
    ),
  ].filter((source) => !triggerConditions.includes(source));

  return [
    '占法：奇门遁甲',
    `起局方法：${data.method === 'feipan' ? '飞盘法' : '转盘法'}；${juMethodText}；${scopePresentation.scopeLabel}`,
    '取用主线：先按问题确定主体、事项用神与主客身份，再到九宫核对落点；值符值使提供全局背景。',
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；${isYearOrMonth ? `干支年${data.ganzhi.year} ${data.timeInfo?.epoch || ''}`.trim() : `${juTerm} ${data.timeInfo?.epoch || ''}`.trim()}${scopePresentation.scope === 'month' ? `；月建${data.ganzhi.month}` : ''}`,
    birthInfo,
    seasonalitySummary ? `节令：${seasonalitySummary}` : '',
    `值符值使与${scopePresentation.scope === 'hour' ? '时干' : `${scopePresentation.scopeLabel}主动干`}：值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '未见落宫'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '未见落宫'}；${scopePresentation.scope === 'hour' ? formatQimenHourStem(data) : formatQimenActiveStem(data)}`,
    ...formatQimenRelationFacts(zhiFuPalace, zhiShiPalace, undefined),
    ...data.jiuGongGe.flatMap((palace) => formatQimenRelationFacts(undefined, undefined, palace)),
    `旬空与马星：旬空${voidText}；马星${horseText}`,
    specialConditionsText
      ? `${scopePresentation.scope === 'hour' ? '特殊时辰' : `${scopePresentation.scopeLabel}特殊条件`}：${specialConditionsText}`
      : '',
    palaceLines.length ? '九宫简表：' : '',
    ...palaceLines,
    classicPatternLines.length ? `盘面命中格局：\n${classicPatternLines.join('\n')}` : '',
    comboLines.length
      ? `复合格局：\n${comboLines.map((item) => item.replaceAll('；', '；\n')).join('\n')}`
      : '',
    data.yingQi
      ? [
          `值符宫应期参考：盘内相对节奏${data.yingQi.rhythm}`,
          ...yingQiSources.map((source) => `  ${source}`),
          triggerConditions.length ? '触发条件：' : '',
          ...triggerConditions.map((condition) => `  ${condition}`),
        ]
          .filter(Boolean)
          .join('\n')
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLiurenInfo(data: LiurenData) {
  const analysis = analyzeLiurenEvidence(data);
  const plateVerified = analysis.plateFact.status === '完整';
  if (!plateVerified) {
    const calculation = analysis.calculationFact;
    return [
      '占法：大六壬',
      `起课四柱：年${calculation.ganzhi.year}、月${calculation.ganzhi.month}、日${calculation.ganzhi.day}、时${calculation.ganzhi.hour}`,
      `月将${calculation.monthLeader}加占时${calculation.divinationBranch}`,
      `${calculation.dayNight}，日干贵人${calculation.noblemanBranch ?? '未列'}；日柱旬空${calculation.xunKong.join('、') || '未列'}`,
      `天地盘资料：${analysis.plateFact.promptText}`,
    ].join('\n');
  }
  const ridingFacts = analysis.traditionalFacts
    .filter((item) => item.kind === '天将乘神')
    .map((item) => ({
      item,
      transmission: data.threeTransmissions.find(
        (transmission) =>
          item.stages?.includes(transmission.stage) && item.branches?.includes(transmission.branch),
      ),
    }));
  const lessonLines = data.fourLessons.map(formatLiurenLesson);
  const transmissionLines = data.threeTransmissions.map((_, index) =>
    formatLiurenTransmission(data, index),
  );
  const voidHits = analysis.transmissions
    .filter((item) => item.isVoid)
    .map((item) => `${item.stage}${item.branch}`);
  const ordinaryAdjudication = formatLiurenOrdinaryTransmissionAdjudication(data);
  const mainLineText = [
    data.transmissionRule && !ordinaryAdjudication ? `取传${data.transmissionRule}` : '',
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
  const guaTiText = plateVerified && data.guaTi?.length ? data.guaTi.join('、') : '';
  const guaTiFacts =
    plateVerified && data.guaTiFacts?.length
      ? data.guaTiFacts.map(formatLiurenGuaTiWithTransmissions)
      : [];
  const guaTiSection = guaTiText && guaTiFacts.length === 0 ? `课体：${guaTiText}` : '';
  const shenShaAll = data.shenShaFacts?.length
    ? data.shenShaFacts.map((item) => `${item.name}在${item.target}`)
    : data.shenShaSummary || [];
  const shenShaText = shenShaAll.slice(0, 6).join('、');
  const shenShaAppendix = shenShaAll.slice(6).join('、');
  const timingEvidence = analysis.timingFacts
    .map((item) => item.promptText)
    .map((item) =>
      item.startsWith('未给出目标期限时') ? '以问题期限、三传先后和现实触发条件核对应期' : item,
    );
  return [
    '占法：大六壬',
    `核心结构：${plateSummaryText.join('；')}`,
    data.dayStemResidence ? `日干寄宫：${data.ganzhi.day.charAt(0)}寄${data.dayStemResidence}` : '',
    mainLineText.length ? `课传主线：${mainLineText.join('；')}` : '',
    ordinaryAdjudication,
    guaTiSection,
    guaTiFacts.length ? `课体判据：\n${guaTiFacts.join('\n')}` : '',
    analysis.transmissions[0]?.isVoid
      ? '毕法断诀：【旬在空亡发用虚】；初传空亡，结合填实、三传及所问期限判断发端条件'
      : '',
    shenShaText ? `神煞：${shenShaText}` : '',
    shenShaAppendix ? `神煞附录：${shenShaAppendix}` : '',
    data.earthlyPlate?.length ? `地盘：${data.earthlyPlate.join('、')}` : '',
    data.heavenlyPlate?.length
      ? `天盘：${data.heavenlyPlate.map((item) => `地盘${item.under}上临天盘${item.branch}${item.god ? `乘${item.god}` : ''}`).join('、')}`
      : '',
    lessonLines.length ? '四课：' : '',
    ...lessonLines.map((item) => `  ${item}`),
    transmissionLines.length ? '三传：' : '',
    ...transmissionLines.map((item) => `  ${item}`),
    data.focusEvidence?.length
      ? `取用定位：${data.focusEvidence
          .map((item) => {
            const evidence =
              item.role === '发用主轴'
                ? omitRepeatedLiurenFocusMonthState(
                    item.evidence,
                    timingEvidence,
                    data.threeTransmissions[0],
                  )
                : item.evidence;
            return `${item.role}${item.target}（${item.level}）：${evidence.filter(Boolean).join('、')}${item.limitations.length ? `；${item.limitations.join('、')}` : ''}`;
          })
          .join('；')}`
      : '',
    timingEvidence.length ? `应期依据：${timingEvidence.join('；')}` : '',
    ...ridingFacts.map(
      ({ item, transmission }) =>
        `乘神生克：${omitRepeatedLiurenRidingMonthState(item.promptText, timingEvidence, transmission)}`,
    ),
  ]
    .filter(Boolean)
    .join('\n');
}

function formatTarotInfo(data: TarotData) {
  const evidence = analyzeTarotEvidence(data);
  const coverage = evidence.spreadCoverageFact;
  const spreadName = coverage.expectedSpreadName ?? data.spreadName;
  const coverageLine =
    coverage.status === '完整'
      ? ''
      : [
          coverage.expectedCardCount === null
            ? `牌位记录：${spreadName}`
            : `牌位覆盖：预设${coverage.expectedCardCount}张（${coverage.expectedPositions.join('、')}）`,
          `实际记录${coverage.actualCardCount}张`,
          `实际牌位：${coverage.actualPositions.join('、')}`,
          coverage.missingPositions.length
            ? `缺少牌位：${coverage.missingPositions.join('、')}`
            : '',
          coverage.duplicatePositions.length
            ? `重复牌位：${coverage.duplicatePositions.join('、')}`
            : '',
          coverage.unexpectedPositions.length
            ? `额外牌位：${coverage.unexpectedPositions.join('、')}`
            : '',
          coverage.positionOrderMismatches.length
            ? `顺序异常位置：${coverage.positionOrderMismatches.join('、')}`
            : '',
          coverage.duplicateCardIds.length
            ? `重复牌号：${coverage.duplicateCardIds.join('、')}`
            : '',
        ]
          .filter(Boolean)
          .join('；');
  const cardLines = evidence.cards.map(
    (card) =>
      `  ${card.position}：${card.name}（${card.orientation}）${card.keywords.length ? `；关键词：${card.keywords.join('、')}` : ''}${card.element !== '元素未列' ? `；牌组属性：${card.element}` : ''}${card.archetype !== '牌阶主题未列' ? `；基础牌义：${card.archetype}` : ''}`,
  );
  const interactions = evidence.elementInteractionFacts
    .filter((fact) => fact.status === '已计算')
    .map(
      (fact) =>
        `  ${fact.fromPosition}${fact.fromCard}（${fact.fromElement}）与${fact.toPosition}${fact.toCard}（${fact.toElement}）：${fact.relation}`,
    );
  const repeatedThemes = evidence.recurringThemeFacts.map((fact) => `${fact.theme}${fact.count}张`);

  return [
    '占法：塔罗',
    `核心结构：牌阵${spreadName}；共${evidence.cards.length}张牌`,
    coverageLine,
    evidence.cards.some((card) => card.orientation === '逆位')
      ? '正逆位口径：逆位表示该牌主题可能受阻、过度、内化或方向偏离，结合所在牌位与整组牌序判断'
      : '',
    '牌位明细：',
    ...cardLines,
    interactions.length ? '相邻牌元素关系：' : '',
    ...interactions,
    repeatedThemes.length ? `重复牌面主题：${repeatedThemes.join('、')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSsgwInfo(data: SsgwData) {
  data = resolveSsgwSignFacts(data);
  const details = data.details ?? {};
  const compactText = (value: string) => value.replace(/[\s，。；、！？!?]/gu, '');
  const poemText = compactText(data.poem);
  const basicInterpretation =
    ['核心寓意', '解签', '签意', '解签总论']
      .map((key) => details[key]?.trim())
      .find((value) => value && !poemText.includes(compactText(value))) ?? '';
  const seen = new Set([compactText(basicInterpretation)]);
  const poemGlosses = (details['解签总论'] ?? '')
    .split(/\s+-\s+/u)
    .slice(1, 3)
    .map((sentence) =>
      sentence
        .split('——')[1]
        ?.trim()
        .split(/[，。；！？!?]/u)[0]
        ?.trim(),
    )
    .filter((value): value is string => Boolean(value))
    .filter((value) => {
      const normalized = compactText(value);
      if (poemText.includes(normalized) || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
  const supplementaryInterpretation = poemGlosses.length
    ? `诗句取象：${poemGlosses.join('；')}。`
    : ['行动建议', '风险提醒']
        .map((key) => details[key]?.trim())
        .filter((value): value is string => Boolean(value))
        .filter((value) => {
          const normalized = compactText(value);
          if (poemText.includes(normalized) || seen.has(normalized)) return false;
          seen.add(normalized);
          return true;
        })
        .join('');
  const storyContent = resolveSsgwStoryContent(data);
  const story = [storyContent.canonicalStory, storyContent.extraStory].filter(Boolean).join('\n');

  return [
    '占法：三山国王灵签',
    `签号：第${data.number}签`,
    `签题：《${data.title}》`,
    `签诗：${data.poem}`,
    details['吉凶']?.trim() ? `吉凶级别：${details['吉凶'].trim()}` : '',
    story ? `典故：${story}` : '',
    basicInterpretation ? `基础解签：${basicInterpretation}` : '',
    supplementaryInterpretation ? `补充解释：${supplementaryInterpretation}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatAlmanacRangeTimestamp(timestamp: number) {
  const date = new Date(timestamp + 8 * 60 * 60 * 1_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function isParticipantConflictNoteCoveredByConstraints(note: string, constraints: string[]) {
  const match = /^(.+?)：候选日地支([子丑寅卯辰巳午未申酉戌亥])(.+)，需谨慎$/u.exec(note);
  if (!match) return false;

  const [, participantName, candidateBranch, relationsText] = match;
  const relations = [
    ...relationsText.matchAll(
      /(冲|刑|害|破)(生肖\/年支|年支|日支)([子丑寅卯辰巳午未申酉戌亥])(?:（([^）]+)）)?/gu,
    ),
  ];
  if (!relations.length) return false;

  return relations.every((relation) => {
    const [, type, targetLabel, targetBranch, detail] = relation;
    const normalizedTargetLabel = targetLabel === '生肖/年支' ? '年支' : targetLabel;
    const relationText = `日支${candidateBranch}与其${normalizedTargetLabel}${targetBranch}${type}`;
    return constraints.some(
      (constraint) =>
        constraint.startsWith(`${participantName}：`) &&
        constraint.includes(relationText) &&
        (!detail || constraint.includes(`（${detail}）`)),
    );
  });
}

function formatAlmanacUsefulGods(
  profile: Pick<
    AlmanacData['participants'][number],
    'usefulGods' | 'avoidGods' | 'incrementStatus'
  >,
) {
  if (profile.incrementStatus === '待判') return '增补五行喜忌待判';
  return profile.usefulGods.length > 0 &&
    profile.usefulGods.length <= 3 &&
    profile.avoidGods.length > 0
    ? `喜用资料${profile.usefulGods.join('、')}，忌神资料${profile.avoidGods.join('、')}`
    : '';
}

function formatAlmanacParticipantLines(item: AlmanacData['participants'][number]) {
  const pillars = `四柱${item.pillars.year} ${item.pillars.month} ${item.pillars.day} ${item.pillars.hour}`;
  const range = item.birthTimeRange;
  if (!range) {
    const useful = formatAlmanacUsefulGods(item);
    return [
      `  ${item.name}：${item.gender || '性别未填'}；${pillars}${useful ? `；${useful}` : ''}`,
    ];
  }

  const sourceText = `${formatAlmanacRangeTimestamp(range.source.startTimestamp)} 至 ${formatAlmanacRangeTimestamp(range.source.endTimestamp)}（终点不含）`;
  if (range.status === 'stable') {
    const useful = formatAlmanacUsefulGods(range.branches[0]?.profile ?? item);
    return [
      `  ${item.name}：${item.gender || '性别未填'}；出生时间范围${sourceText}；${pillars}；范围内资料一致${useful ? `；${useful}` : ''}`,
    ];
  }

  return [
    `  ${item.name}：${item.gender || '性别未填'}；出生时间范围${sourceText}；${pillars}；以下时间条件分别适用`,
    ...range.branches.map((branch) => {
      const useful = formatAlmanacUsefulGods(branch.profile);
      return `    ${formatAlmanacRangeTimestamp(branch.startTimestamp)} 至 ${formatAlmanacRangeTimestamp(branch.endTimestamp)}（终点不含）：司令${branch.profile.monthCommander || '待核'}；${branch.profile.incrementStatus === '待判' ? '增补五行喜忌待判' : useful || '未列可直接采用的喜忌资料'}`;
    }),
  ];
}

function formatAlmanacInfo(data: AlmanacData) {
  const evidenceAnalysis = analyzeAlmanacEvidence(data);
  const participantLines = data.participants.flatMap(formatAlmanacParticipantLines);
  const promptDays = [...data.days].sort((left, right) => left.date.localeCompare(right.date));
  const dayLines = promptDays.flatMap((item, index) => {
    const candidate = evidenceAnalysis.candidates.find(
      (candidateItem) => candidateItem.date === item.date,
    );
    if (!candidate) throw new Error(`黄历${item.date}候选证据缺失，请重新排盘。`);
    const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
    const topicFacts = item.topicMatchFacts ?? [];
    const allRecommendations = unique(item.recommends);
    const allAvoids = unique(item.avoids);
    const topicRecommendations = unique(
      topicFacts.filter((fact) => fact.status === '支持').flatMap((fact) => fact.matchedItems),
    ).filter((recommendation) => !allRecommendations.includes(recommendation));
    const topicAvoids = unique(
      topicFacts.filter((fact) => fact.status === '限制').flatMap((fact) => fact.matchedItems),
    ).filter((avoid) => !allAvoids.includes(avoid));
    const needsLegacyFallback = data.topic === 'custom' || topicFacts.length === 0;
    const recommendationText = topicRecommendations.length
      ? `事项宜${topicRecommendations.join('、')}`
      : needsLegacyFallback
        ? `宜${unique(item.recommends).join('、') || '未列'}`
        : '';
    const avoidText = topicAvoids.length
      ? `事项忌${topicAvoids.join('、')}`
      : needsLegacyFallback
        ? `忌${unique(item.avoids).join('、') || '未列'}`
        : '';
    const strongConstraints = candidate?.decisionFact.strongConstraintTexts ?? [];
    const rawTabooItems = new Set([...allRecommendations, ...allAvoids]);
    const repeatedRawConstraints = new Set(
      topicFacts
        .filter(
          (fact) =>
            fact.status === '限制' &&
            /:topic:(?:day-avoids|day-general-constraint)$/.test(fact.key) &&
            fact.matchedItems.length > 0 &&
            fact.matchedItems.every((item) => rawTabooItems.has(item)),
        )
        .map((fact) => fact.promptText),
    );
    if (
      topicFacts.some(
        (fact) =>
          fact.key.endsWith(':topic:day-avoids') &&
          fact.matchedItems.length > 0 &&
          fact.matchedItems.every((item) => allAvoids.includes(item)),
      )
    ) {
      repeatedRawConstraints.add(`黄历忌项触及${data.topicLabel}`);
    }
    if (rawTabooItems.has('诸事不宜')) {
      repeatedRawConstraints.add('候选日明列诸事不宜');
    }
    const visibleStrongConstraints = strongConstraints.filter(
      (text) => !repeatedRawConstraints.has(text),
    );
    const participantNotes = unique(item.participantNotes).filter(
      (note) =>
        !/未见.*直接|未命中|未采用/u.test(note) &&
        !isParticipantConflictNoteCoveredByConstraints(note, strongConstraints),
    );
    const hours =
      data.timePreferences?.length && candidate?.usableHours.length ? candidate.usableHours : [];
    const hourText = hours
      .map((hour) => {
        const supportPrefix = `${hour.name}原始宜项命中${data.topicLabel}：`;
        const support = hour.support.map((fact) =>
          fact.startsWith(supportPrefix) ? `宜${fact.slice(supportPrefix.length)}` : fact,
        );
        return `${hour.name}${hour.range}${hour.ganzhi}/${hour.twelveStar}${support.length ? `/${support.join('、')}` : ''}${hour.constraints.length ? `/${hour.constraints.join('、')}` : ''}`;
      })
      .join('、');
    const conciseFacts = [
      candidate?.status ?? '',
      item.cautions.find((note) => note.includes('交节；')) ?? '',
      recommendationText,
      avoidText,
      !needsLegacyFallback && allRecommendations.length ? `宜${allRecommendations.join('、')}` : '',
      !needsLegacyFallback && allAvoids.length ? `忌${allAvoids.join('、')}` : '',
      ...formatAlmanacGods(item),
      participantNotes.length ? `参与人${participantNotes.join('；')}` : '',
      visibleStrongConstraints.length ? `明确限制${visibleStrongConstraints.join('、')}` : '',
      hourText ? `时辰${hourText}` : '',
    ].filter(Boolean);
    return [
      `  第${index + 1}日：${candidate.date} ${candidate.calendarFact.weekday}；${candidate.calendarFact.lunarDate}；正午干支${candidate.calendarFact.ganzhi.year}/${candidate.calendarFact.ganzhi.month}/${candidate.calendarFact.ganzhi.day}；建${candidate.calendarFact.dayOfficer}；值神${candidate.calendarFact.twelveStar}；宿${candidate.traditionalFacts.find((fact) => fact.kind === '二十八宿')?.originalText ?? item.twentyEightStar}；${candidate.calendarFact.clash}`,
      conciseFacts.length ? `    ${conciseFacts.join('；')}` : '',
    ].filter(Boolean);
  });
  const statusGroups = new Map<string, string[]>();
  for (const item of promptDays) {
    const candidate = evidenceAnalysis.candidates.find((entry) => entry.date === item.date);
    const status = candidate?.status || '待核验候选';
    const dates = statusGroups.get(status) ?? [];
    dates.push(item.date);
    statusGroups.set(status, dates);
  }
  const classificationLine = [...statusGroups.entries()]
    .map(([status, dates]) => `${status}${dates.length}日（${dates.join('、')}）`)
    .join('；');
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
          data.timePreferences.includes('work-hours')
            ? '同一候选等级内优先工作日，时辰限常规办事时段'
            : '',
          data.timePreferences.includes('morning') ? '优先上午' : '',
          data.timePreferences.includes('afternoon') ? '优先下午' : '',
        ]
          .filter(Boolean)
          .join('、')}`
      : '',
    participantLines.length ? '参与人资料：' : '',
    ...participantLines,
    classificationLine ? `候选分类：${classificationLine}` : '',
    '每日干支依次为年、月、日；建为建除，值神为十二神，宿为二十八宿。',
    data.timePreferences?.length ? '时辰写法：时辰时段时柱/十二神/事项依据。' : '',
    `候选日期明细：共${data.days.length}日`,
    ...dayLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLenormandPromptGaps(
  data: LenormandData,
  evidence: ReturnType<typeof analyzeLenormandEvidence>,
) {
  const gaps: string[] = [];
  const coverage = evidence.spreadCoverageFact;

  if (coverage.status === '未知牌阵') {
    gaps.push('本次牌阵名称与牌位关系待补');
  } else {
    if (coverage.expectedCardCount !== coverage.actualCardCount) {
      gaps.push(`牌数应为${coverage.expectedCardCount}张，实际${coverage.actualCardCount}张`);
    }
    if (coverage.missingPositions.length) {
      gaps.push(`缺少牌位${coverage.missingPositions.join('、')}`);
    }
    if (coverage.duplicatePositions.length) {
      gaps.push(`重复牌位${coverage.duplicatePositions.join('、')}`);
    }
    if (coverage.unexpectedPositions.length) {
      gaps.push(`额外牌位${coverage.unexpectedPositions.join('、')}`);
    }
    if (coverage.positionOrderMismatches.length) {
      gaps.push(`顺序异常位置${coverage.positionOrderMismatches.join('、')}`);
    }
  }
  if (coverage.duplicateCardIds.length) {
    gaps.push(`重复牌号${coverage.duplicateCardIds.join('、')}`);
  }

  for (const card of evidence.cards) {
    const input = data.cards[card.index - 1];
    if (!input) continue;
    const layoutMismatches: string[] = [];
    if (card.mismatches.includes('宫位')) {
      layoutMismatches.push(`宫位记录${input.house ?? '未记录'}，应为${card.house ?? '无'}`);
    }
    if (card.mismatches.includes('行号')) {
      layoutMismatches.push(`行号记录${input.row ?? '未记录'}，应为${card.row ?? '无'}`);
    }
    if (card.mismatches.includes('列号')) {
      layoutMismatches.push(`列号记录${input.column ?? '未记录'}，应为${card.column ?? '无'}`);
    }
    if (layoutMismatches.length) {
      gaps.push(`第${card.index}张${layoutMismatches.join('；')}`);
    }
  }

  const layout = evidence.layoutCoverageFact;
  if (layout.status === '结构缺失' || layout.status === '旧版字符串兼容') {
    if (data.spreadType === 'nine') {
      gaps.push('九宫中心、行列与对角线关系资料未齐');
    } else if (data.spreadType === 'grandTableau') {
      gaps.push('大桌宫位与人物牌近身关系资料未齐');
    }
  }

  return gaps.length ? `盘面资料缺口：${Array.from(new Set(gaps)).join('；')}` : '';
}

function formatLenormandInfo(data: LenormandData) {
  const evidenceAnalysis = analyzeLenormandEvidence(data);
  const coverage = evidenceAnalysis.spreadCoverageFact;
  const spreadName = coverage.expectedSpreadName ?? data.spreadName;
  const gapLine = formatLenormandPromptGaps(data, evidenceAnalysis);
  const cardLines = evidenceAnalysis.cards.map((card) => {
    const meaning = evidenceAnalysis.traditionalFacts
      .find((fact) => fact.kind === '单牌牌义' && fact.cardFactKeys.includes(card.key))
      ?.promptText.split('；')[0];
    const placement = [
      card.house && !card.position.includes(`（${card.house}宫）`) ? `落${card.house}宫` : '',
      card.row && card.column ? `第${card.row}排第${card.column}列` : '',
    ]
      .filter(Boolean)
      .join('，');
    return `  ${card.position}：${card.name}；关键词：${card.keywords.join('、')}${meaning ? `；基础牌义：${meaning}` : ''}${placement ? `；${placement}` : ''}`;
  });
  const combinationLines = (
    evidenceAnalysis.spreadCoverageFact.status === '完整' &&
    evidenceAnalysis.cards.every((card) => card.status === '已映射')
      ? evidenceAnalysis.traditionalFacts.filter((fact) => fact.kind === '固定组合')
      : []
  ).map((item) => `  ${item.cardNames.join('+')}：${item.promptText.split('；')[0]}`);
  const layoutLines = evidenceAnalysis.structuredLayoutFacts
    .filter((item) => item.kind !== '大桌宫位')
    .map((item) => `  ${item.factText}`);
  return [
    '占法：雷诺曼',
    coverage.status === '未知牌阵'
      ? `核心结构：共${data.cards.length}张牌`
      : `核心结构：牌阵${spreadName}；共${data.cards.length}张牌`,
    gapLine,
    '牌位明细：',
    ...cardLines,
    ...(layoutLines.length ? ['布局关系：', ...layoutLines] : []),
    ...(combinationLines.length ? ['固定组合：', ...combinationLines] : []),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatAstrolabeInfo(data: AstrolabeData) {
  return `占法：星盘\n${formatAstrolabeForPrompt(data)}`;
}

export function formatTaiyiTradition(data: TaiyiResult) {
  const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计' }[data.scope];
  return `${data.accumulatedLabel}与${data.yinYang}${scopeLabel}构成盘面基础；太乙、文昌、始击、计神落宫及主客定算构成主线，十六神为辅助定位。`;
}

export function formatTaiyiInfo(data: TaiyiResult) {
  assertTaiyiFixedFacts(data);
  const scopeLabel = { year: '年计', month: '月计', day: '日计', hour: '时计' }[data.scope];
  const conditions = evaluateTaiyiConditions({
    accumulatedValue: data.accumulatedValue,
    taiyiPosition: data.taiyiPosition,
    taiyiPalace: data.taiyiPalace,
    wenChangPosition: data.wenChangPosition,
    wenChangPalace: data.wenChangPalace,
    shiJiPosition: data.shiJiPosition,
    shiJiPalace: data.shiJiPalace,
    lordCount: data.lordCount,
    guestCount: data.guestCount,
    lordGeneral: data.lordGeneral,
    lordAssistant: data.lordAssistant,
    guestGeneral: data.guestGeneral,
    guestAssistant: data.guestAssistant,
  });
  const lordNature = getTaiyiCountNature(data.lordCount);
  const guestNature = getTaiyiCountNature(data.guestCount);
  const setNature = getTaiyiCountNature(data.setCount);
  const imprisonedRoles = [
    data.wenChangPosition === data.taiyiPosition ? '文昌' : undefined,
    data.lordGeneral === data.taiyiPalace ? '主大将' : undefined,
    data.lordAssistant === data.taiyiPalace ? '主参将' : undefined,
    data.guestGeneral === data.taiyiPalace ? '客大将' : undefined,
    data.guestAssistant === data.taiyiPalace ? '客参将' : undefined,
  ].filter((item): item is string => item !== undefined);
  const specialJudgments = [
    data.shiJiPosition === data.taiyiPosition ? '掩：始击与太乙同宫，传统称客目掩太乙。' : '',
    imprisonedRoles.length ? `囚：${imprisonedRoles.join('、')}与太乙同宫。` : '',
    data.lordGeneral === 5 || data.lordAssistant === 5 ? '主将参中宫。' : '',
    data.guestGeneral === 5 || data.guestAssistant === 5 ? '客将参中宫。' : '',
  ].filter(Boolean);
  const sixteenGods = data.sixteenGods?.length
    ? `十六神：${data.sixteenGods.map((item) => `${item.branch}${item.god}`).join('、')}`
    : '';
  const mainGateRoles = conditions?.threeGates.roles.filter((item) => item.usedForThreeGate) ?? [];
  const mismatchedPairs =
    conditions?.yinYangHarmony.pairFacts.filter((item) => !item.matched) ?? [];
  const elementRelation = conditions?.fiveGenerals.hostGuestElementRelation;
  const conditionLines = conditions
    ? [
        `三门：${conditions.threeGates.status}；直使${conditions.threeGates.directGate}；${mainGateRoles.map((item) => `${item.role}${item.gate ?? '中宫无八门'}`).join('、')}`,
        `五将：${conditions.fiveGenerals.launched ? '发' : '不发'}`,
        `阴阳：${conditions.yinYangHarmony.matched ? '和' : `不和（${mismatchedPairs.map((item) => item.role).join('、')}）`}`,
        elementRelation?.complete &&
        elementRelation.hostElement &&
        elementRelation.guestElement &&
        elementRelation.relation !== '未形成五行相制' &&
        elementRelation.relation !== '未判定'
          ? `二目五行：文昌${elementRelation.hostPosition}属${elementRelation.hostElement}，始击${elementRelation.guestPosition}属${elementRelation.guestElement}；${elementRelation.relation}`
          : '',
      ]
    : [];
  const civilDate = data.dateTime.split(' ')[0];
  const [civilYear, civilMonth] = civilDate.split('-');
  const dateTime =
    data.scope === 'year'
      ? `${civilYear}年`
      : data.scope === 'month'
        ? `${civilYear}-${civilMonth}月`
        : data.scope === 'day'
          ? civilDate
          : data.dateTime;
  return [
    `占法：太乙神数（${scopeLabel}）`,
    `起局时间：${dateTime}；本计干支：${data.ganZhi}；${data.yinYang}第${data.bureau}局`,
    ...(data.termReferenceDateTime
      ? [`节气与年月干支参照实际占时：${data.termReferenceDateTime}（东八区）`]
      : []),
    `太乙：${data.taiyiPosition}（第${data.taiyiPalace}宫，${data.taiyiGua}卦，${data.taiyiDir}）`,
    `文昌（主目）：${data.wenChangPosition}；始击（客目）：${data.shiJiPosition}；计神：${data.jiShenPosition}`,
    `主客定算：主算${data.lordCount}${lordNature ? `（${lordNature}）` : ''}；客算${data.guestCount}${guestNature ? `（${guestNature}）` : ''}；定算${data.setCount}${setNature ? `（${setNature}）` : ''}`,
    `大局攻守：${formatTaiyiTacticBasis({ lordCount: data.lordCount, guestCount: data.guestCount })}`,
    `将参：主大${data.lordGeneral}、主参${data.lordAssistant}；客大${data.guestGeneral}、客参${data.guestAssistant}；定大${data.setGeneral}、定参${data.setAssistant}`,
    sixteenGods,
    ...conditionLines,
    specialJudgments.length ? `判断：${specialJudgments.join('；')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatWuyunLiuqiInfo(data: WuyunLiuqiResult) {
  return `占法：五运六气\n${formatWuyunLiuqiFacts(data)}`;
}

export function formatHuangjiInfo(data: HuangjiJingshiResult) {
  assertHuangjiJingshiFacts(data);
  const forecast = data.forecast;
  if (!forecast) {
    return [
      '占法：皇极经世',
      `目标年坐标：${data.input.year}`,
      `元会运世：第${data.position.yuan.indexFromEpoch}元，第${data.position.hui.indexInYuan}会，第${data.position.yun.indexInHui}运，第${data.position.shi.indexInYun}世`,
    ].join('\n');
  }
  const { governing, yun, sixtyYear, decade, annual } = forecast.hexagrams;
  const dateTime = data.dateTimeForecast;
  const sixDay = data.sixDayCycle;
  return [
    '占法：皇极经世',
    dateTime
      ? '年月日时映射：每节气按十五日定位，超过十五日的尾段沿用第十五日；日卦按月经卦下的六十卦序顺行。'
      : '',
    dateTime
      ? `起盘时间：${dateTime.civilTime.dateTime}（${dateTime.civilTime.timezone}）；皇极历${dateTime.calendar.monthBranch}月第${dateTime.calendar.dayOfMonth}日；节气${dateTime.calendar.activeSolarTerm}`
      : sixDay
        ? `起盘时间：${sixDay.civilTime.dateTime}（UTC${formatFixedTimezoneOffset(sixDay.civilTime.timezone)}）`
        : '',
    dateTime?.civilTime.termReferenceDateTime
      ? `节气与皇极年参照实际占时：${dateTime.civilTime.termReferenceDateTime}（${dateTime.civilTime.timezone}）`
      : '',
    sixDay
      ? sixDay.model === '书绪言六日逐爻·显式历元'
        ? `六日逐爻历元：以经校定的${sixDay.anchor.dateTime}当地子半为起点，至目标当地日期已过${sixDay.calendar.actualElapsedDays}个完整公历日。`
        : `六日逐爻历元：以${sixDay.anchor.dayStartDateTime}${sixDay.anchor.dayBoundary === '当地子半' ? '当地子半' : '当地日首个实际时刻'}为起点，按冬至岁周实际跨度映射三百六十逻辑日。`
      : '',
    sixDay ? `六日逐爻位置：三百六十日周期第${sixDay.dayOfCycle}日，${sixDay.hourRange}时段。` : '',
    `目标年份：${formatHuangjiCivilYear(annual.year)}（${annual.ganzhi}）`,
    `周期位置：第${forecast.hui.indexInYuan}会（${forecast.hui.branch}会），会内第${data.position.yun.indexInHui}运，运内第${data.position.shi.indexInYun}世，世内第${data.position.year.indexInShi}年`,
    `会内统卦：${governing.hexagram.name}，${formatHuangjiCivilYear(governing.startYear)}至${formatHuangjiCivilYear(governing.endYear)}`,
    `运卦：${yun.hexagram.name}，${formatHuangjiCivilYear(yun.startYear)}至${formatHuangjiCivilYear(yun.endYear)}`,
    `六十年统卦：${sixtyYear.hexagram.name}，${formatHuangjiCivilYear(sixtyYear.startYear)}至${formatHuangjiCivilYear(sixtyYear.endYear)}`,
    `十年卦：${decade.hexagram.name}，${formatHuangjiCivilYear(decade.startYear)}至${formatHuangjiCivilYear(decade.endYear)}`,
    `值年卦：${annual.name}（${annual.upper}上、${annual.lower}下）`,
    `时势主轴：${sixDay ? `当前时点以六日经卦${sixDay.hexagrams.jing.name}、当日卦${sixDay.hexagrams.daily.name}和时变卦${sixDay.hexagrams.hourly.name}为主要取象，值年卦${annual.name}为长期背景` : dateTime ? `当前时点以时经卦${dateTime.hexagrams.hourJing.name}与日卦${dateTime.hexagrams.daily.name}为主要取象，值年卦${annual.name}为长期背景` : `目标年份以【${annual.name}】值年承接大局气数`}`,
    `值年卦辞：${annual.judgment}`,
    sixDay
      ? `六日逐爻卦：经卦${sixDay.hexagrams.jing.name}第${sixDay.dayLine}爻当日；日变卦${sixDay.hexagrams.daily.name}；${sixDay.hourRange}时变卦${sixDay.hexagrams.hourly.name}。`
      : '',
    sixDay ? `六日经卦辞：${sixDay.hexagrams.jing.judgment}` : '',
    sixDay ? `六日当日卦辞：${sixDay.hexagrams.daily.judgment}` : '',
    sixDay ? `六日时变卦辞：${sixDay.hexagrams.hourly.judgment}` : '',
    dateTime
      ? `年月日时卦：月经${dateTime.hexagrams.monthJing.name}；旬纬${dateTime.hexagrams.xunWei.name}；日卦${dateTime.hexagrams.daily.name}；时经${dateTime.hexagrams.hourJing.name}（${dateTime.calendar.hourRange}）`
      : '',
    dateTime ? `月经卦辞：${dateTime.hexagrams.monthJing.judgment}` : '',
    dateTime ? `旬纬卦辞：${dateTime.hexagrams.xunWei.judgment}` : '',
    dateTime ? `日卦卦辞：${dateTime.hexagrams.daily.judgment}` : '',
    dateTime ? `时经卦辞：${dateTime.hexagrams.hourJing.judgment}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatJinkoujueInfo(data: JinkoujueData) {
  const p = data.positions;
  const relations = formatJinkoujueRelations(data);
  const positionFacts = [p.diFen, p.jiangShen, p.guiShen, p.renYuan].map(formatJinkoujuePosition);
  return [
    '占法：金口诀',
    `阴阳发用：${data.yinYangUse.rule}；发用位${data.yinYangUse.usePosition}${data.yinYangUse.isVoid ? '旬空' : '不空'}`,
    `四位：${positionFacts.join('；')}`,
    `五动三动：${data.movements.map((item) => `${item.category}${item.name}（${item.trigger}）`).join('；') || '未触发五动或三动'}`,
    formatJinkoujueBihe(data),
    relations,
    data.xunKong?.length ? `旬空：${data.xunKong.join('、')}` : '',
    ...formatJinkoujueJudgmentFacts(data, {
      compact: true,
      displayedRelations: [relations, ...data.movements.map((item) => item.trigger)],
      displayedPositionFacts: positionFacts,
    }),
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatEnhancedDivinationInfo(
  method: Exclude<DivinationMethodId, 'random'>,
  data: DivinationData,
  _question = '',
  _supplementaryInfo?: SupplementaryInfo,
  options?: {
    liuyaoTemplate?: 'general' | 'ganqing' | 'shiye' | 'caifu' | 'guaishen';
    omitRepeatedXiaoliurenCivilTime?: boolean;
  },
) {
  switch (method) {
    case 'liuyao':
      return formatLiuyaoInfo(data as LiuyaoData, options?.liuyaoTemplate);
    case 'meihua':
      return formatMeihuaInfo(data as MeihuaData);
    case 'xiaoliuren':
      return formatXiaoliurenInfo(data as XiaoliurenData, options?.omitRepeatedXiaoliurenCivilTime);
    case 'jinkoujue':
      return formatJinkoujueInfo(data as JinkoujueData);
    case 'qimen':
      return formatQimenInfo(data as QimenData, _question, _supplementaryInfo);
    case 'liuren':
      return formatLiurenInfo(data as LiurenData);
    case 'tarot':
      return formatTarotInfo(data as TarotData);
    case 'ssgw':
      return formatSsgwInfo(data as SsgwData);
    case 'zhuge':
      return formatZhugeInfo(data as ZhugeNumberResult);
    case 'kongming':
      return formatKongmingInfo(data as KongmingHexagramResult);
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
    case 'wuyun':
      return formatWuyunLiuqiInfo(data as WuyunLiuqiResult);
    default:
      return '占卜信息暂不可用';
  }
}
