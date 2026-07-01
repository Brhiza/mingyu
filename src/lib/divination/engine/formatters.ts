import type {
  AlmanacDayCandidate,
  AlmanacData,
  AstrolabeData,
  DivinationData,
  LenormandData,
  LiurenData,
  LiuyaoData,
  MeihuaData,
  QimenData,
  QimenJiuGongGe,
  SsgwData,
  SupplementaryInfo,
  TarotData,
  XiaoliurenData,
  XiaoliurenPalaceDetail,
} from '../../../types/divination';
import { LunarUtil, getDivinationTime } from 'mingyu-core/calendar';
import { resolveSsgwStoryContent } from '../ssgw-content';
import { formatTarotCardLabel, getTarotFocusCards } from '../tarot-focus';
import {
  createQimenPriorityPalaces,
  createQimenQuestionHints,
} from '../../../utils/qimen-guidance';
import { normalizePromptEvidenceItems } from '../../prompt-evidence/format';
import type { PromptEvidenceItem } from '../../prompt-evidence/types';
import type { DivinationMethodId } from '../config';

function resolveDivinationTimestamp(data?: DivinationData): number | null {
  if (!data || typeof data.timestamp !== 'number' || !Number.isFinite(data.timestamp)) {
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
      external: '外应起卦',
      timeTrigram: '时辰纳卦法',
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
        : `用户补充：${supplementaryInfo.userSupplement.trim()}`,
    );
  }

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
    external: '外应起卦法',
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

function normalizePromptCompareText(text: string) {
  return text.replace(/[：:，,；;。、\s]/g, '');
}

const EARTHLY_BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function getGanzhiBranch(value?: string) {
  return value ? value.slice(-1) : '';
}

function getOppositeBranch(branch: string) {
  const index = EARTHLY_BRANCHES.indexOf(branch);
  return index >= 0 ? EARTHLY_BRANCHES[(index + 6) % EARTHLY_BRANCHES.length] : '';
}

function joinLimited(items: string[], limit = 3) {
  return items.slice(0, limit).join('、');
}

function createLiuyaoUsefulGodHints(
  question: string,
  data: LiuyaoData,
  supplementaryInfo?: SupplementaryInfo,
) {
  const candidates = createLiuyaoUsefulGodCandidates(question, data, supplementaryInfo);
  return candidates.map((candidate) => {
    const matchedYaos = data.yaosDetail.filter((item) => item.sixRelative === candidate.relative);
    const yaoText = matchedYaos.length
      ? matchedYaos.map(formatLiuyaoYaoBrief).join('、')
      : '本卦未见';
    if (candidate.label === '未识别专项用神') {
      return `${candidate.label}：${candidate.note}`;
    }
    return `${candidate.label}：以${candidate.relative}为用神候选，${candidate.note}；盘中${yaoText}`;
  });
}

function createLiuyaoUsefulGodCandidates(
  question: string,
  data: LiuyaoData,
  supplementaryInfo?: SupplementaryInfo,
) {
  const text = question.trim();
  const candidates: Array<{ label: string; relative: string; note: string }> = [];
  const gender = supplementaryInfo?.gender;

  const addCandidate = (label: string, relative: string, note: string) => {
    candidates.push({ label, relative, note });
  };

  if (/感情|婚姻|恋爱|复合|对象|伴侣|桃花|关系/.test(text)) {
    if (gender === '女') {
      addCandidate('感情婚姻', '官鬼', '女问感情多先看官鬼，再参世应生克');
    } else if (gender === '男') {
      addCandidate('感情婚姻', '妻财', '男问感情多先看妻财，再参世应生克');
    } else {
      addCandidate('感情婚姻', '官鬼', '未给性别时官鬼可作对象/关系压力候选');
      addCandidate('感情婚姻', '妻财', '未给性别时妻财可作对象/现实互动候选');
    }
  }

  if (/工作|事业|岗位|升职|跳槽|面试|领导|官司|压力|规则/.test(text)) {
    addCandidate('事业职位', '官鬼', '主职位、压力、约束、领导与风险');
  }

  if (/钱|财|收入|投资|生意|项目|客户|订单|资源/.test(text)) {
    addCandidate('财务资源', '妻财', '主钱财、资源、客户、收益与可兑现结果');
  }

  if (/考试|合同|证件|房|车|文书|消息|资料|学历|手续/.test(text)) {
    addCandidate('文书手续', '父母', '主合同、证件、房产、消息、考试文书与保护条件');
  }

  if (/孩子|子女|创作|作品|输出|方案|宠物|药|医生/.test(text)) {
    addCandidate('子孙产出', '子孙', '主子女、作品、解决方案、舒缓压力与医药线索');
  }

  if (/朋友|同事|竞争|合作|兄弟|伙伴|借钱|分成/.test(text)) {
    addCandidate('同辈竞争', '兄弟', '主同辈、竞争者、合作者、分财与人际牵扯');
  }

  if (candidates.length === 0) {
    const worldYao = data.yaosDetail.find((item) => item.isWorld);
    const fallbackRelative = worldYao?.sixRelative || data.yaosDetail[0]?.sixRelative || '世应';
    addCandidate(
      '未识别专项用神',
      fallbackRelative,
      worldYao
        ? `先以世爻${formatLiuyaoYaoBrief(worldYao)}为我方主轴，再结合应爻、动爻与问题语义取用`
        : '先以世应、动爻、六亲旺衰与问题语义取用',
    );
  }

  return candidates;
}

function createLiuyaoMonthDayEvidence(data: LiuyaoData) {
  const monthBranch = getGanzhiBranch(data.ganzhi.month);
  const dayBranch = getGanzhiBranch(data.ganzhi.day);
  const monthClash = getOppositeBranch(monthBranch);
  const dayClash = getOppositeBranch(dayBranch);
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

function createLiuyaoUsefulGodScoreEvidenceItems(
  question: string,
  data: LiuyaoData,
  supplementaryInfo?: SupplementaryInfo,
): PromptEvidenceItem[] {
  const monthBranch = getGanzhiBranch(data.ganzhi.month);
  const dayBranch = getGanzhiBranch(data.ganzhi.day);
  // 六合关系（《增删卜易》：用神爻与月建或日辰六合为暗助）
  const LIU_HE: Record<string, string> = {
    子: '丑',
    丑: '子',
    寅: '亥',
    亥: '寅',
    卯: '戌',
    戌: '卯',
    辰: '酉',
    酉: '辰',
    巳: '申',
    申: '巳',
    午: '未',
    未: '午',
  };
  const candidates = createLiuyaoUsefulGodCandidates(question, data, supplementaryInfo).slice(0, 3);
  const movingYaos = data.yaosDetail.filter((item) => item.isChanging).map(formatLiuyaoYaoBrief);
  const worldYao = data.yaosDetail.find((item) => item.isWorld);
  const responseYao = data.yaosDetail.find((item) => item.isResponse);
  const evidenceItems = candidates.map((candidate, index): PromptEvidenceItem => {
    const matchedYaos = data.yaosDetail.filter((item) => item.sixRelative === candidate.relative);
    if (matchedYaos.length === 0) {
      return {
        level: '限制',
        title: candidate.label,
        detail: `${candidate.relative}本卦未见，需看伏神、变爻或问题语义补取，不可硬当主证`,
        source: '六爻用神评分',
        weight: 30 - index,
        tags: [candidate.relative],
      };
    }

    const primary = matchedYaos[0];
    const support = [
      primary.isWorld ? '临世，和求测者自身强相关' : '',
      primary.isResponse ? '临应，和对方、外部条件强相关' : '',
      primary.isChanging ? '发动，可作事件变化主证' : '',
      primary.isHiddenMove ? '暗动，旺相被日冲暗中发动' : '',
      primary.seasonState === '旺' ? '月令旺相有力' : '',
      primary.seasonState === '相' ? '月令相地有力' : '',
      primary.najiaDizhi === monthBranch ? '得月建同支触发' : '',
      primary.najiaDizhi === dayBranch ? '得日辰同支触发' : '',
      LIU_HE && primary.najiaDizhi && LIU_HE[primary.najiaDizhi] === monthBranch
        ? '得月建六合暗助'
        : '',
      LIU_HE && primary.najiaDizhi && LIU_HE[primary.najiaDizhi] === dayBranch
        ? '得日辰六合暗助'
        : '',
      primary.changeRelation === '回头生' ? '变爻回头生，愈动愈有力' : '',
      primary.changedYao ? `变出${primary.changedYao.liuqin}${primary.changedYao.dizhi}` : '',
    ].filter(Boolean);
    const limits = [
      primary.isVoid ? '本爻空亡' : '',
      primary.changedYao?.isVoid ? '变爻空亡' : '',
      primary.seasonState === '休' || primary.seasonState === '囚' || primary.seasonState === '死'
        ? `月令${primary.seasonState}，有力不足`
        : '',
      primary.changeRelation === '回头克' ? '变爻回头克，动而受制' : '',
      primary.changeRelation === '回头冲' ? '变爻回头冲，动而不稳' : '',
      !primary.isChanging && movingYaos.length > 0
        ? `非动爻，需参动爻${movingYaos.join('、')}`
        : '',
      !primary.isWorld && !primary.isResponse && (worldYao || responseYao)
        ? `需回扣${worldYao ? `世爻${formatLiuyaoYaoBrief(worldYao)}` : ''}${worldYao && responseYao ? '与' : ''}${responseYao ? `应爻${formatLiuyaoYaoBrief(responseYao)}` : ''}`
        : '',
    ].filter(Boolean);

    // 六爻用神评分权重体系（按《增删卜易》《卜筮正宗》用神有力七法）
    // 世应：临世最强、临应次之
    // 动变：发动为变化主证，暗动为暗中发动，化进强于化退
    // 月令：旺相有力，休囚死无力；日辰同支为触发
    // 回头生克：回头生→吉兆增强，回头克→大凶减分，回头冲→不稳
    // 空亡：本爻空→悬而不实，变爻空→变不落实
    let weight = 50;
    if (primary.isWorld) weight += 20;
    if (primary.isResponse) weight += 15;
    if (primary.isChanging) weight += 25;
    if (primary.isHiddenMove) weight += 15;
    if (primary.seasonState === '旺') weight += 15;
    if (primary.seasonState === '相') weight += 10;
    if (
      primary.seasonState === '休' ||
      primary.seasonState === '囚' ||
      primary.seasonState === '死'
    )
      weight -= 15;
    if (primary.changeRelation === '回头生') weight += 20;
    if (primary.changeRelation === '回头克') weight -= 20;
    if (primary.changeRelation === '回头冲') weight -= 15;
    if (primary.changeRelation === '化空') weight -= 10;
    if (primary.changeDirection === '化进神') weight += 10;
    if (primary.changeDirection === '化退神') weight -= 10;
    if (primary.isVoid) weight -= 20;
    if (primary.changedYao?.isVoid) weight -= 10;
    if (primary.najiaDizhi === monthBranch) weight += 10;
    if (primary.najiaDizhi === dayBranch) weight += 10;
    if (LIU_HE[primary.najiaDizhi] === monthBranch) weight += 8;
    if (LIU_HE[primary.najiaDizhi] === dayBranch) weight += 8;
    weight -= index * 5;

    const level: PromptEvidenceItem['level'] =
      weight >= 55 ? '主证' : weight >= 30 ? '辅证' : '限制';
    return {
      level,
      title: candidate.label,
      detail: `${formatLiuyaoYaoBrief(primary)}为主候选（第${index + 1}顺位，权重${weight}）；主证${support.join('、') || '待世应、动变、月日继续确认'}；反证/限制${limits.join('、') || '未见明显空亡或脱节'}`,
      source: '六爻用神评分',
      weight,
      tags: [candidate.relative],
    };
  });

  return evidenceItems;
}

function formatLiuyaoUsefulGodScoreEvidence(items: PromptEvidenceItem[]) {
  return [
    ...items.map((item) => `${item.title}：${item.detail}`),
    '评分口径：用神先按问题取六亲，再看是否临世应、是否发动或暗动、月令旺相休囚死、是否得月日触发、回头生克；空亡、伏藏、月令休囚死、回头克冲或非动爻均降权',
  ].join('；');
}

function createLiuyaoRelationGodEvidence(
  question: string,
  data: LiuyaoData,
  supplementaryInfo?: SupplementaryInfo,
) {
  const candidate = createLiuyaoUsefulGodCandidates(question, data, supplementaryInfo)[0];
  const matchedYaos = candidate
    ? data.yaosDetail.filter((item) => item.sixRelative === candidate.relative)
    : [];
  const primary =
    matchedYaos[0] || data.yaosDetail.find((item) => item.isWorld) || data.yaosDetail[0];

  if (!candidate || !primary) {
    return '资料不足，需先定用神后再分原神、忌神、仇神';
  }

  const sourceElement =
    Object.entries(WUXING_GENERATES).find(([, generated]) => generated === primary.wuxing)?.[0] ||
    '';
  const jiElement =
    Object.entries(WUXING_CONTROLS).find(([, controlled]) => controlled === primary.wuxing)?.[0] ||
    '';
  const chouElement = WUXING_CONTROLS[primary.wuxing] || '';
  const describeElementYaos = (label: string, element: string) => {
    const yaos = data.yaosDetail
      .filter((item) => item.wuxing === element)
      .map(
        (item) =>
          `${formatLiuyaoYaoBrief(item)}${item.isChanging ? '动' : ''}${item.isVoid ? '空' : ''}`,
      );
    return `${label}${element || '未知'}：${
      yaos.length ? yaos.join('、') : '本卦未见，需从伏神、变爻或月日触发复核'
    }`;
  };

  return [
    `以${candidate.label}${formatLiuyaoYaoBrief(primary)}为用神基准`,
    describeElementYaos('原神', sourceElement),
    describeElementYaos('忌神', jiElement),
    describeElementYaos('仇神', chouElement),
    '原神能生用神可升权，忌神或仇神旺动贴世应时必须列为反证',
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
    `起卦法${methodLabel}只决定取数来源，应期仍需体用、互变、四时和外应互证`,
  ]
    .filter(Boolean)
    .join('；');
}

function createMeihuaScoringEvidence(data: MeihuaData) {
  const changedText =
    data.changedTiGua && data.changedYongGua
      ? `变后体${data.changedTiGua.name}${data.changedTiGua.element}、用${data.changedYongGua.name}${data.changedYongGua.element}，按${data.analysis.changedTiYongRelation}复核`
      : '未见变后体用资料，结果只按变卦与动爻复核';

  return [
    `体用${data.analysis.tiYongRelation}为基础分`,
    `四时${data.analysis.season}季体${data.analysis.tiSeasonState}、用${data.analysis.yongSeasonState}调整强弱`,
    `动爻第${data.movingYao.position}爻提示触发层位`,
    changedText,
    '评分只用于排序主证、辅证和反证，不作机械数值断语',
  ].join('；');
}

function createMeihuaStageEvidence(data: MeihuaData) {
  const processHexagram = data.interHexagram?.name || data.interName || '无';
  const resultHexagram = data.changedHexagram?.name || data.changedName || '无';

  return [
    `起因看主卦${data.originalName}与体用${data.analysis.tiYongRelation}`,
    `过程看互卦${processHexagram}，互卦体用${data.analysis.inter1Relation}、互上辅助${data.analysis.inter2Relation}`,
    `结果看变卦${resultHexagram}与${data.analysis.changedRelation}`,
    '起因、过程、结果必须分层说明，不能只按卦名泛讲',
  ].join('；');
}

function createMeihuaExternalConfidenceEvidence(data: MeihuaData) {
  const calculation = data.calculation;
  const mappedCount = calculation?.externalMappedOmens?.length || 0;
  const hasSummary = Boolean(calculation?.externalSummary?.trim());

  if (calculation?.methodKey === 'external' && mappedCount > 0) {
    return `中高：已给外应并映射${mappedCount}项八卦类象，但仍需与体用、互卦、变卦同向才升权`;
  }
  if (calculation?.methodKey === 'external' && hasSummary) {
    return '中：已给外应描述但映射不足，只能作辅证，不能独立决定结论或日期';
  }
  return '低：当前非外应起卦，外应只作补充提示，不进入主证';
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
    '五级外应：外应与体用互变同向时才升权；否则只作旁证',
  ].join('；');
}

function createMeihuaSymbolEvidence(data: MeihuaData) {
  const calculation = data.calculation;
  const methodLabel = getMeihuaMethodLabel(calculation);
  const processHexagram = data.interHexagram?.name || data.interName || '无';
  const resultHexagram = data.changedHexagram?.name || data.changedName || '无';
  const externalMappedText = calculation?.externalMappedOmens?.length
    ? `外应已映射${calculation.externalMappedOmens.map((item) => `${item.label}取${item.trigram}`).join('、')}`
    : calculation?.externalSummary?.trim()
      ? '外应只作旁证，需与体用互变同向才升权'
      : '';
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
    externalMappedText,
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
    `主判断${data.primary.name}：${data.primary.tendency}，只适合短期复盘，不作长期命运定论`,
  ].join('；');
}

function createXiaoliurenReviewEvidence(data: XiaoliurenData) {
  const { sequence } = data;

  return [
    `先核实起因${sequence.start.name}对应的${joinLimited(sequence.start.keywords)}是否已出现`,
    `过程若出现${sequence.process.name}对应的${joinLimited(sequence.process.keywords)}，说明卡点已显化`,
    `结果以${sequence.result.name}对应的${joinLimited(sequence.result.keywords)}作为短期复盘指标`,
    `主判断${data.primary.name}只给近事观察，不延伸为长期定局`,
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

  return `${levelMap[data.primary.tendency]}；主判断${data.primary.name}只给近事行动等级，不延伸为长期定局`;
}

function createXiaoliurenReviewWindowEvidence(data: XiaoliurenData) {
  return [
    `先观察起因${data.sequence.start.name}是否已出现`,
    `再看过程${data.sequence.process.name}对应卡点是否显化`,
    `最后用结果${data.sequence.result.name}验证短期走向`,
    '若用户给出目标期限，以目标期限内复盘为准；未给期限时只给短期近事观察，不换算绝对日期',
  ].join('；');
}

function createTarotConflictEvidence(data: TarotData) {
  const reversedCards = data.cards.filter((card) => card.reversed);
  const uprightCards = data.cards.filter((card) => !card.reversed);
  const actionCards = data.cards.filter((card) =>
    /建议|行动|结果|未来|对策|提醒/.test(card.position),
  );
  const structure =
    data.cards.length >= 3
      ? data.cards
          .slice(0, 5)
          .map((card) => `${card.position}${card.name}${card.reversed ? '逆位' : '正位'}`)
          .join(' -> ')
      : data.cards
          .map((card) => `${card.position}${card.name}${card.reversed ? '逆位' : '正位'}`)
          .join('；');

  return [
    structure ? `牌阵链路：${structure}` : '',
    reversedCards.length
      ? `逆位阻滞：${reversedCards.map((card) => `${card.position}${card.name}提示${joinLimited(card.keywords)}`).join('、')}`
      : '逆位阻滞：未见逆位，重点看牌位之间是否互相支持',
    uprightCards.length
      ? `正位支持：${uprightCards.map((card) => `${card.position}${card.name}提示${joinLimited(card.keywords)}`).join('、')}`
      : '',
    actionCards.length
      ? `行动牌：${actionCards.map((card) => `${card.position}${card.name}${card.reversed ? '逆位，先处理阻滞' : '正位，可顺势使用'}`).join('、')}`
      : '行动牌：未见明确建议位，需从牌阵主轴提炼可执行动作',
  ]
    .filter(Boolean)
    .join('；');
}

function createTarotNarrativeWeightEvidence(data: TarotData) {
  const focusCards = getTarotFocusCards(data);
  const reversedCards = data.cards.filter((card) => card.reversed);
  const actionCards = data.cards.filter((card) =>
    /建议|行动|结果|未来|对策|提醒/.test(card.position),
  );
  const focusText = focusCards.length
    ? `主牌${focusCards.map((card) => `${card.position}${card.name}${card.reversed ? '逆位' : '正位'}`).join('、')}先定叙事主轴`
    : '';
  const obstacleText = reversedCards.length
    ? `逆位${reversedCards.map((card) => `${card.position}${card.name}`).join('、')}优先视为阻滞、内化或延迟`
    : '未见逆位，阻力需从牌位冲突和关键词落差中寻找';
  const actionText = actionCards.length
    ? `行动牌${actionCards.map((card) => `${card.position}${card.name}${card.reversed ? '逆位先降速处理阻滞' : '正位可顺势推进'}`).join('、')}`
    : '未见明确行动位，需从主轴牌提炼可执行建议';

  return [focusText, obstacleText, actionText, '权重口径：先牌位，后正逆位，再用关键词互证']
    .filter(Boolean)
    .join('；');
}

const TAROT_MAJOR_NUMBERS: Record<string, number> = {
  愚者: 0,
  魔术师: 1,
  女祭司: 2,
  女教皇: 2,
  女皇: 3,
  皇后: 3,
  皇帝: 4,
  教皇: 5,
  恋人: 6,
  战车: 7,
  力量: 8,
  隐者: 9,
  命运之轮: 10,
  正义: 11,
  吊人: 12,
  倒吊人: 12,
  死神: 13,
  节制: 14,
  恶魔: 15,
  塔: 16,
  高塔: 16,
  星星: 17,
  月亮: 18,
  太阳: 19,
  审判: 20,
  世界: 21,
};

const TAROT_SUIT_META = [
  { keyword: '权杖', element: '火', meaning: '行动、意志、成长和主动推进' },
  { keyword: '圣杯', element: '水', meaning: '情感、关系、感受和承接' },
  { keyword: '宝剑', element: '风', meaning: '沟通、判断、冲突和切割' },
  { keyword: '星币', element: '土', meaning: '资源、金钱、身体和现实落地' },
  { keyword: '金币', element: '土', meaning: '资源、金钱、身体和现实落地' },
  { keyword: '钱币', element: '土', meaning: '资源、金钱、身体和现实落地' },
];

const TAROT_MINOR_NUMBER_META = [
  { labels: ['王牌', '一', '1', 'A'], label: '王牌', meaning: '启动、种子、机会露头' },
  { labels: ['二', '2'], label: '二', meaning: '选择、平衡、协商或拉扯' },
  { labels: ['三', '3'], label: '三', meaning: '协作、成形、初步扩展' },
  { labels: ['四', '4'], label: '四', meaning: '稳定、结构、停滞或安全边界' },
  { labels: ['五', '5'], label: '五', meaning: '冲突、损耗、竞争或失衡' },
  { labels: ['六', '6'], label: '六', meaning: '调整、过渡、修复或互助' },
  { labels: ['七', '7'], label: '七', meaning: '试探、防守、策略或不确定推进' },
  { labels: ['八', '8'], label: '八', meaning: '推进、重复练习、压力加速' },
  { labels: ['九', '9'], label: '九', meaning: '临界、积累、个人承受或接近结果' },
  { labels: ['十', '10'], label: '十', meaning: '完成、收束、压力满载或结果落地' },
];

const TAROT_COURT_META = [
  { labels: ['侍从', '侍者', '牌童'], label: '侍从', meaning: '消息、学习、新手姿态或试探' },
  { labels: ['骑士'], label: '骑士', meaning: '行动、推进、追逐和外部变化' },
  { labels: ['王后', '皇后'], label: '王后', meaning: '内在管理、关系承接、滋养和感受处理' },
  { labels: ['国王'], label: '国王', meaning: '外在掌控、决策、规则和责任承担' },
];

type TarotLayer = '大阿卡纳' | '小阿卡纳' | '宫廷牌' | '未识别牌组';

function resolveTarotCardMeta(card: TarotData['cards'][number]) {
  const suit = TAROT_SUIT_META.find((item) => card.name.includes(item.keyword));
  const courtMeta = TAROT_COURT_META.find((item) =>
    item.labels.some((label) => card.name.includes(label)),
  );
  const majorName = suit
    ? undefined
    : Object.keys(TAROT_MAJOR_NUMBERS).find((name) => card.name.includes(name));
  const numberMeta = TAROT_MINOR_NUMBER_META.find((item) =>
    item.labels.some((label) => card.name.includes(label)),
  );

  const layer: TarotLayer = majorName
    ? '大阿卡纳'
    : courtMeta
      ? '宫廷牌'
      : suit
        ? '小阿卡纳'
        : '未识别牌组';

  return {
    layer,
    majorNumber: majorName ? TAROT_MAJOR_NUMBERS[majorName] : null,
    suit: suit?.keyword || '',
    element: suit?.element || '',
    suitMeaning: suit?.meaning || '',
    court: courtMeta?.label || '',
    courtMeaning: courtMeta?.meaning || '',
    numberLabel: suit && !courtMeta ? numberMeta?.label || '' : '',
    numberMeaning: suit && !courtMeta ? numberMeta?.meaning || '' : '',
  };
}

function createTarotLayerEvidence(data: TarotData) {
  const groups = data.cards.reduce(
    (acc, card) => {
      const meta = resolveTarotCardMeta(card);
      acc[meta.layer].push(card.name);
      return acc;
    },
    {
      大阿卡纳: [] as string[],
      小阿卡纳: [] as string[],
      宫廷牌: [] as string[],
      未识别牌组: [] as string[],
    } satisfies Record<TarotLayer, string[]>,
  );

  return [
    groups.大阿卡纳.length ? `大阿卡纳${groups.大阿卡纳.join('、')}定人生主题或关键转折` : '',
    groups.小阿卡纳.length ? `小阿卡纳${groups.小阿卡纳.join('、')}定现实执行层` : '',
    groups.宫廷牌.length ? `宫廷牌${groups.宫廷牌.join('、')}定人物角色或互动方式` : '',
    groups.未识别牌组.length
      ? `未识别牌组${groups.未识别牌组.join('、')}需按牌位关键词保守解释`
      : '',
  ]
    .filter(Boolean)
    .join('；');
}

function createTarotElementNumberEvidence(data: TarotData) {
  const parts = data.cards.map((card) => {
    const meta = resolveTarotCardMeta(card);
    if (typeof meta.majorNumber === 'number') {
      return `${card.position}${card.name}为大阿卡纳${meta.majorNumber}号`;
    }
    if (meta.court) {
      const suitText = meta.suit
        ? `，属${meta.suit}${meta.element}元素（${meta.suitMeaning}）`
        : '';
      return `${card.position}${card.name}为${meta.court}宫廷牌（${meta.courtMeaning}）${suitText}`;
    }
    if (meta.suit) {
      const numberText = meta.numberLabel
        ? `，数字${meta.numberLabel}（${meta.numberMeaning}）`
        : '，数字未识别';
      return `${card.position}${card.name}属${meta.suit}${meta.element}元素（${meta.suitMeaning}）${numberText}`;
    }
    return `${card.position}${card.name}元素数字未识别，按牌位和关键词解释`;
  });

  return `${parts.join('；')}；元素和数字只能辅助牌位叙事，不能单独推出日期`;
}

function createTarotCourtEvidence(data: TarotData) {
  const courtCards = data.cards
    .map((card) => ({ card, meta: resolveTarotCardMeta(card) }))
    .filter((item) => item.meta.court);

  return courtCards.length
    ? `${courtCards.map((item) => `${item.card.position}${item.card.name}提示${item.meta.court}式人物、身份或互动姿态（${item.meta.courtMeaning}${item.meta.suit ? `；${item.meta.suit}偏${item.meta.suitMeaning}` : ''}）`).join('；')}；宫廷牌需落回现实人物或行动方式`
    : '未见宫廷人物牌，不把牌面强行解释成特定人物';
}

function createLenormandCoreEvidence(data: LenormandData) {
  const coreCards = data.cards.slice(0, 3);
  return coreCards.length
    ? `${coreCards.map((card, index) => `${index + 1}号核心${card.position}${card.name}：${joinLimited(card.keywords, 2)}`).join('；')}；前三张优先构成事件主轴`
    : '未抽到核心牌，不能补造事件主轴';
}

const LENORMAND_ADJACENT_COMBINATIONS: Record<string, string> = {
  '骑士+山': '消息受阻、推进延迟，先等卡点松动',
  '山+骑士': '阻滞后才有消息，进展不会立刻到来',
  '山+太阳': '阻力后转明，先难后有结果',
  '太阳+山': '明朗结果前仍有现实门槛',
  '信+书': '隐藏文件、待公开信息或需要查证的文本',
  '书+信': '资料披露、文件通知或秘密消息浮出',
  '戒指+心': '感情承诺、关系绑定或情感契约',
  '心+戒指': '感情进入承诺议题，需看是否愿意绑定',
  '鱼+锚': '稳定收入、长期资源或可持续现金流',
  '锚+鱼': '资源固定化、收入稳定但流动性降低',
  '船+鸟': '远方沟通、异地消息或反复联络',
  '鸟+船': '消息带来出行、远方变化或计划迁移',
  '钥匙+门': '关键入口打开，问题出现可操作解法',
  '钥匙+书': '关键资料、密码、证据或专业知识',
  '花束+信': '好消息、邀请、礼貌通知',
  '信+花束': '通知带来缓和、邀约或正面回应',
  '蛇+花束': '表面和气但需防复杂动机',
  '熊+鱼': '大额资源、资金掌控或强势财务方',
  '云+太阳': '不确定逐渐转明，但仍要等信息清楚',
  '太阳+云': '好结果被不确定因素遮挡，需补信息',
  '镰刀+十字': '突然压力、痛点爆发或不得不止损',
  '十字+镰刀': '长期压力触发切割、终止或痛苦决定',
  '棺材+钥匙': '结束旧局是破局关键',
  '钥匙+棺材': '解法指向收尾、止损或关闭入口',
  '路+戒指': '关系或合作进入选择节点',
  '戒指+路': '承诺面临分岔，需重新选择条件',
  '狗+心': '可信任的感情、友情支持或忠诚陪伴',
  '心+狗': '情感中重视信任与长期支持',
  '男人+女人': '两位当事人直接互动，关系主轴明显',
  '女人+男人': '两位当事人直接互动，关系主轴明显',
  '孩子+太阳': '新机会转明、轻快开始或小结果见好',
  '太阳+孩子': '正面开端，但仍处在初期',
  '塔+书': '机构资料、官方档案或隐藏规则',
  '书+塔': '资料来自机构、制度或专业渠道',
  '月亮+花束': '认可、好感、社交曝光带来正面反馈',
  '花束+月亮': '邀约或礼物带来情绪改善与认可',
};

function normalizeLenormandCardName(name: string) {
  return name.replace(/牌$/, '').trim();
}

function describeLenormandAdjacentPair(
  card: LenormandData['cards'][number],
  next: LenormandData['cards'][number],
) {
  const left = normalizeLenormandCardName(card.name);
  const right = normalizeLenormandCardName(next.name);
  const dictionaryText = LENORMAND_ADJACENT_COMBINATIONS[`${left}+${right}`];

  return dictionaryText
    ? `${card.name}+${next.name}：${dictionaryText}`
    : `${card.name}+${next.name}：${joinLimited(card.keywords, 2)}遇${joinLimited(next.keywords, 2)}`;
}

function createLenormandAdjacentEvidence(data: LenormandData) {
  if (data.cards.length < 2) {
    return '单牌牌阵无相邻组合，只能按核心牌保守解释';
  }

  return data.cards
    .slice(0, 5)
    .map((card, index) => {
      const next = data.cards[index + 1];
      return next ? describeLenormandAdjacentPair(card, next) : '';
    })
    .filter(Boolean)
    .slice(0, 4)
    .join('；');
}

function createLenormandCardCategoryEvidence(data: LenormandData) {
  const personCards = data.cards.filter((card) =>
    /男人|女人|男士|女士|骑士|孩子|小孩|熊|蛇|狗/.test(card.name),
  );
  const eventCards = data.cards.filter((card) =>
    /骑士|信|书|船|钥匙|路|山|镰刀|棺材|太阳|云|鸟|十字/.test(card.name),
  );
  const timeCards = data.cards.filter((card) =>
    /太阳|月亮|星星|百合|树|船|骑士|钟|时间/.test(
      `${card.name}${card.keywords.join('')}${card.meaning}`,
    ),
  );

  return {
    personText: personCards.length
      ? `${personCards.map((card) => `${card.position}${card.name}`).join('、')}；人物牌只能指向现实角色、互动姿态或消息来源`
      : '未见明确人物牌，不强行指定某个人',
    eventText: eventCards.length
      ? `${eventCards.map((card) => `${card.position}${card.name}提示${joinLimited(card.keywords, 2)}`).join('；')}；事件牌优先落成现实动作、消息、阻碍或结果`
      : '未见强事件牌，按核心牌链路保守判断',
    timeText: timeCards.length
      ? `${timeCards.map((card) => `${card.position}${card.name}`).join('、')}可作节奏旁证；仍需用户期限或事件链支持`
      : '未见明确时间牌，不硬断具体日期',
  };
}

function createLenormandMirrorEvidence(data: LenormandData) {
  if (data.cards.length < 3) {
    return '牌数不足三张，镜像关系不作为主证';
  }

  const pairs: string[] = [];
  for (let index = 0; index < Math.floor(data.cards.length / 2); index += 1) {
    const left = data.cards[index];
    const right = data.cards[data.cards.length - 1 - index];
    pairs.push(`${left.position}${left.name}镜像${right.position}${right.name}`);
  }

  return `${pairs.slice(0, 3).join('；')}；镜像只用于复核主轴两端是否呼应，不压过相邻组合`;
}

function createSsgwDecisionEvidence(data: SsgwData) {
  const detailMap = data.details || {};
  const detailText = Object.values(detailMap).join('；');
  const poemParts = data.poem
    .split(/[，。；;、,.!?！？\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const shouldWait = /守|待|缓|莫强求|不可躁进|云开|月明|周旋/.test(`${data.poem}；${detailText}`);
  const shouldAdvance = /进|成|吉|利|可|得|喜/.test(`${data.poem}；${detailText}`) && !shouldWait;
  const avoidText = detailText.match(/不可[^。；;，,]*|忌[^。；;，,]*|莫[^。；;，,]*/)?.[0] || '';
  const suitableText = detailText.match(/宜[^。；;，,]*/)?.[0] || '';

  return [
    poemParts.length ? `逐句线索：${poemParts.join('；')}` : '',
    shouldWait
      ? '取舍方向：宜守待时，先稳局势再推进'
      : shouldAdvance
        ? '取舍方向：可顺势推进，但仍需按签意避险'
        : '取舍方向：先按签诗主旨保守取象，不作过度承诺',
    suitableText ? `宜：${suitableText.replace(/^宜/, '')}` : '',
    avoidText ? `忌：${avoidText.replace(/^(不可|忌|莫)/, '')}` : '',
    '复盘条件：以签诗和典故对应的现实条件是否出现为准，不硬换算绝对日期',
  ]
    .filter(Boolean)
    .join('；');
}

function createSsgwTopicEvidence(data: SsgwData) {
  const detailMap = data.details || {};
  const detailText = Object.values(detailMap).join('；');
  const poemParts = data.poem
    .split(/[，。；;、,.!?！？\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const combinedText = `${data.poem}；${detailText}`;
  const isCautious = /守|待|缓|莫强求|不可躁进|暂避|敛锋芒|云开|月明|周旋/.test(combinedText);
  const isPositive = /吉|喜|成|利|可|得|明/.test(combinedText);
  const level = isCautious
    ? isPositive
      ? '偏守待，缓中有转机'
      : '偏谨慎，先守后看'
    : isPositive
      ? '偏可进，但仍须避忌'
      : '吉凶未明，按签诗主旨保守取象';
  const detailHints = Object.entries(detailMap)
    .filter(([key]) => key !== '典故')
    .map(([key, value]) => `${key}${value}`)
    .slice(0, 3);

  return [
    `吉凶层级：${level}`,
    poemParts.length ? `事项重点：${poemParts.join('；')}` : '',
    detailHints.length ? `事项映射：${detailHints.join('；')}` : '',
    isCautious
      ? '守进条件：见阻力松动、信息转明或现实周旋空间出现后再推进'
      : '守进条件：按签意可行处推进，遇到忌项立即降速',
  ]
    .filter(Boolean)
    .join('；');
}

function createSsgwTimingEvidence(data: SsgwData) {
  const detailMap = data.details || {};
  const combinedText = `${data.poem}；${Object.values(detailMap).join('；')}`;
  const matchSignals = (rules: Array<{ label: string; pattern: RegExp }>) =>
    rules.filter((item) => item.pattern.test(combinedText)).map((item) => item.label);
  const fastSignals = matchSignals([
    { label: '速', pattern: /速/ },
    { label: '即', pattern: /即/ },
    { label: '马上', pattern: /马上/ },
    { label: '急', pattern: /急/ },
    { label: '宜进', pattern: /宜进/ },
    { label: '可成', pattern: /可成/ },
    { label: '喜', pattern: /喜/ },
    { label: '早', pattern: /早/ },
    { label: '立', pattern: /立/ },
  ]);
  const waitSignals = matchSignals([
    { label: '待', pattern: /待/ },
    { label: '守', pattern: /守/ },
    { label: '缓', pattern: /缓/ },
    { label: '云开', pattern: /云开/ },
    { label: '月明', pattern: /月(?:自)?明/ },
    { label: '莫强求', pattern: /莫强求/ },
    { label: '周旋', pattern: /周旋/ },
    { label: '暂避', pattern: /暂避/ },
    { label: '敛锋芒', pattern: /敛锋芒/ },
    { label: '忍', pattern: /忍/ },
    { label: '迟', pattern: /迟/ },
  ]);
  const blockSignals = matchSignals([
    { label: '不可', pattern: /不可/ },
    { label: '忌', pattern: /忌/ },
    { label: '难', pattern: /难/ },
    { label: '凶', pattern: /凶/ },
    { label: '祸', pattern: /祸/ },
    { label: '险', pattern: /险/ },
    { label: '阻', pattern: /阻/ },
    { label: '困', pattern: /困/ },
    { label: '忧', pattern: /忧/ },
    { label: '躁进', pattern: /躁进/ },
  ]);

  if (waitSignals.length || blockSignals.length) {
    return [
      '偏慢待时',
      waitSignals.length ? `守待信号${waitSignals.slice(0, 4).join('、')}` : '',
      blockSignals.length ? `阻滞信号${blockSignals.slice(0, 4).join('、')}` : '',
      '应期须等现实阻力松动或用户指定期限内出现转明信号',
    ]
      .filter(Boolean)
      .join('；');
  }

  if (fastSignals.length) {
    return `偏快可进；速动信号${fastSignals.slice(0, 4).join('、')}；仍需避开签中忌项，不把“快”换算成固定日期`;
  }

  return '迟速未明；只按签诗主旨给阶段性判断，需用户补充目标期限后再落应期';
}

const WUXING_GENERATES: Record<string, string> = {
  木: '火',
  火: '土',
  土: '金',
  金: '水',
  水: '木',
};

const WUXING_CONTROLS: Record<string, string> = {
  木: '土',
  土: '水',
  水: '火',
  火: '金',
  金: '木',
};

function describeWuxingRelation(source: string, target: string) {
  if (!source || !target) {
    return '五行关系未明';
  }
  if (source === target) {
    return `${source}${target}比和`;
  }
  if (WUXING_GENERATES[source] === target) {
    return `${source}生${target}`;
  }
  if (WUXING_GENERATES[target] === source) {
    return `${target}生${source}`;
  }
  if (WUXING_CONTROLS[source] === target) {
    return `${source}克${target}`;
  }
  if (WUXING_CONTROLS[target] === source) {
    return `${target}克${source}`;
  }
  return `${source}与${target}关系待复核`;
}

function createLiuyaoSpecialFocusHints(question: string) {
  const text = question.trim();
  const hints: string[] = [];

  if (
    /鬼神|怪事|怪异|不干净|冲犯|阴气|附体|家神|祖先|净宅|送替|梦见|噩梦|邪乎|发冷|惊吓|不安/.test(
      text,
    )
  ) {
    hints.push(
      '鬼神怪异：重点看官鬼是否旺动贴世，子孙能否制鬼，并结合玄武、腾蛇、白虎、勾陈、空破入墓判断更偏情绪、环境还是民俗冲犯。',
    );
  }

  if (/感情|婚姻|恋爱|复合|对象|伴侣|桃花|关系/.test(text)) {
    hints.push('感情关系：重点看官鬼/妻财、世应生克、动变合冲，以及关系是否还有推进空间。');
  }

  if (/工作|事业|岗位|升职|跳槽|面试|领导|规则|编制|项目/.test(text)) {
    hints.push('事业工作：重点看官鬼、父母、世应与动爻，判断机会、压力、规则与窗口时机。');
  }

  if (/钱|财|收入|投资|生意|项目|客户|订单|资源|回款|交易/.test(text)) {
    hints.push('财运交易：重点看妻财、兄弟、子孙与世应，判断收益兑现、分财耗财与操作节奏。');
  }

  return hints;
}

function formatLiuyaoInfo(
  question: string,
  data: LiuyaoData,
  supplementaryInfo?: SupplementaryInfo,
) {
  const movingYaos = data.changingYaos?.length
    ? data.changingYaos
        .map((item) => `第${item.position}爻${item.type ? `（${item.type}）` : ''}`)
        .join('、')
    : '无动爻';
  const worldYao = data.yaosDetail.find((item) => item.isWorld);
  const responseYao = data.yaosDetail.find((item) => item.isResponse);
  const usefulGodHints = createLiuyaoUsefulGodHints(question, data, supplementaryInfo);
  const specialFocusHints = createLiuyaoSpecialFocusHints(question);
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
  const usefulGodScoreEvidenceItems = createLiuyaoUsefulGodScoreEvidenceItems(
    question,
    data,
    supplementaryInfo,
  );
  const usefulGodScoreEvidence = formatLiuyaoUsefulGodScoreEvidence(usefulGodScoreEvidenceItems);
  const relationGodEvidence = createLiuyaoRelationGodEvidence(question, data, supplementaryInfo);
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
    ? `三合局：${sanheParts.join('；')}；事势增强，应期可参考合局五行旺衰`
    : null;
  const sanxingDetail = data.sanxingInYaos?.length
    ? `三刑：${data.sanxingInYaos.map((s) => `${s.branches.join('、')}构成${s.type}`).join('；')}，主纠缠、对立或反复，先看刑中是否有救（合冲解刑）`
    : null;
  const guaShenDetail = data.guaShen
    ? `卦身（月卦）在${data.guaShen.branch}，${data.guaShen.sixRelative}临第${data.guaShen.position}爻，主此事有明确卦身为证，事体不虚`
    : null;
  const focusParts = [
    worldYao ? `世爻在第${worldYao.position}爻` : '世爻未知',
    responseYao ? `应爻在第${responseYao.position}爻` : '应爻未知',
    `动爻${movingYaos}`,
    `空亡${data.voidBranches?.join('、') || '无'}`,
    data.specialPattern ? `卦式${data.specialPattern}` : '',
    worldYao ? `六亲持世：${worldYao.sixRelative}` : '',
    data.guaShen ? `卦身在${data.guaShen.branch}` : '',
  ].filter(Boolean);
  const yaoLines = [...data.yaosDetail]
    .sort((a, b) => b.position - a.position)
    .map((item) => {
      const flags = [
        item.isWorld ? '世' : '',
        item.isResponse ? '应' : '',
        item.isVoid ? '空' : '',
        item.isDayBreak ? (item.isHiddenMove ? '暗动' : '日破') : '',
        item.isMonthBreak ? '月破' : '',
        item.seasonState ? `月令${item.seasonState}` : '',
        item.isChanging ? `动变${item.changeType}` : '',
        item.shiErGong ? item.shiErGong : '',
      ].filter(Boolean);
      const shenshaFlags = [
        item.isSanxing && item.sanxingType ? `${item.sanxingType}` : '',
        item.isLiuhe ? `六合${item.liuhePartner || ''}` : '',
        item.isLiuhai ? '六害' : '',
        item.isRuMu ? '入墓' : '',
      ]
        .filter(Boolean)
        .join('、');
      const changedYaoText = item.changedYao
        ? `；变爻${item.changedYao.dizhi}${item.changedYao.wuxing}，六亲${item.changedYao.liuqin}${item.changedYao.isVoid ? '，变爻空亡' : ''}${item.changeDirection ? `，${item.changeDirection}` : ''}${item.changeRelation ? `，${item.changeRelation}` : ''}`
        : '';
      return `- 第${item.position}爻：${item.yaoType}爻，六亲${item.sixRelative}，六神${item.sixGod}，纳甲${item.najiaDizhi}${item.wuxing}${flags.length ? `，${flags.join(' / ')}` : ''}${shenshaFlags ? `（${shenshaFlags}）` : ''}${changedYaoText}`;
    });

  return [
    '占法：六爻',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}${data.palace?.name ? `（${data.palace.name}宫）` : ''}；变卦${data.changedName || '无'}；互卦${data.interName || '无'}`,
    `关键提示：空亡${data.voidBranches?.join('、') || '无'}；动爻${movingYaos}；世应${worldYao ? `世爻在第${worldYao.position}爻` : '世爻未知'}、${responseYao ? `应爻在第${responseYao.position}爻` : '应爻未知'}；特殊卦式${data.specialPattern || '常规卦'}`,
    worldYao
      ? `六亲持世：${worldYao.sixRelative}持世，${worldYao.sixRelative === '父母' ? '主辛苦、劳累、文书、消息' : worldYao.sixRelative === '官鬼' ? '主压力、忧虑、疾病、官非' : worldYao.sixRelative === '妻财' ? '主财运、妻子、情感' : worldYao.sixRelative === '子孙' ? '主平安、解忧、医药' : '主竞争、破财、朋友'}`
      : '',
    `断卦抓手：${focusParts.join('；')}`,
    `用神候选：${usefulGodHints.join('；')}`,
    specialFocusHints.length ? `专项抓手：${specialFocusHints.join('；')}` : '',
    `主轴证据：${worldYao ? `世爻${formatLiuyaoYaoBrief(worldYao)}` : '世爻未知'}；${responseYao ? `应爻${formatLiuyaoYaoBrief(responseYao)}` : '应爻未知'}；${changingLines.length ? `动变${changingLines.join('、')}` : '无动变，以静卦世应用神为主'}`,
    `用神评分表：${usefulGodScoreEvidence}`,
    `原神忌神仇神：${relationGodEvidence}`,
    `辅助证据：${voidYaoText.length ? `空亡爻位${voidYaoText.join('、')}` : `空亡${data.voidBranches?.join('、') || '无'}未直接落到本卦爻位`}；伏神${hiddenSpiritText}`,
    `月日触发：${monthDayEvidence}`,
    `应期候选：${timingEvidence}`,
    `应期优先级：${timingPriorityEvidence}`,
    data.specialAdvice ? `补充提示：${data.specialAdvice}` : '',
    sanheDetail || sanxingDetail || guaShenDetail ? '组合时机：' : '',
    sanheDetail ? sanheDetail : '',
    sanxingDetail ? sanxingDetail : '',
    guaShenDetail ? guaShenDetail : '',
    '结构明细：',
    ...yaoLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatMeihuaInfo(data: MeihuaData) {
  const calculation = data.calculation;
  const externalOmens = calculation?.externalOmens;
  const externalSummary = calculation?.externalSummary?.trim() || '';
  const isExternalMethod = calculation?.methodKey === 'external';
  const hasExternalSummary = Boolean(externalSummary);
  const methodLabel = getMeihuaMethodLabel(calculation);
  const processHexagram = data.interHexagram?.name || data.interName || '无';
  const resultHexagram = data.changedHexagram?.name || data.changedName || '无';
  const changedTiYongText =
    data.changedTiGua && data.changedYongGua
      ? `；变后体卦${data.changedTiGua.name}（${data.changedTiGua.element}）；变后用卦${data.changedYongGua.name}（${data.changedYongGua.element}）；变后体用${data.analysis.changedTiYongRelation}`
      : '';
  const externalMappedText = calculation?.externalMappedOmens?.length
    ? calculation.externalMappedOmens
        .map((item) => `${item.label}->${item.trigram}卦（${item.trigramIndex}）`)
        .join('；')
    : '';
  const externalDetailParts = [
    externalOmens?.direction ? `方向${externalOmens.direction}` : '',
    externalOmens?.person ? `人物${externalOmens.person}` : '',
    externalOmens?.animal ? `动物${externalOmens.animal}` : '',
    externalOmens?.object ? `物象${externalOmens.object}` : '',
    externalOmens?.sound ? `声音${externalOmens.sound}` : '',
    externalOmens?.color ? `颜色${externalOmens.color}` : '',
    typeof externalOmens?.count === 'number' ? `数量${externalOmens.count}` : '',
  ].filter(Boolean);
  const timingEvidence = createMeihuaTimingEvidence(data);
  const symbolEvidence = createMeihuaSymbolEvidence(data);
  const scoringEvidence = createMeihuaScoringEvidence(data);
  const stageEvidence = createMeihuaStageEvidence(data);
  const externalConfidenceEvidence = createMeihuaExternalConfidenceEvidence(data);
  const timingPriorityEvidence = createMeihuaTimingPriorityEvidence(data);
  const yaoLines = [...data.yaosDetail]
    .sort((a, b) => b.position - a.position)
    .map(
      (item) =>
        `- 第${item.position}爻（${data.movingYao.position === item.position ? '动' : '静'}，属${item.tiYong}）：${item.yaoType}爻${data.mainHexagram?.yaoCi?.[item.position - 1] ? `，爻辞"${data.mainHexagram.yaoCi[item.position - 1]}"` : ''}`,
    );

  // 动爻逐条输出爻辞（多动爻时更完整）
  const movingYaoCiLines = data.mainHexagram?.yaoCi
    ? data.yaosDetail
        .filter((item) => item.isChanging)
        .map((item) => `第${item.position}爻爻辞：${data.mainHexagram!.yaoCi![item.position - 1]}`)
    : [];

  // 应期数组输出（结构化 yingQi 优先于手写）
  const yingQiText = data.analysis.yingQi?.length
    ? `应期参考：${data.analysis.yingQi.slice(0, 3).join('；')}`
    : null;

  return [
    '占法：梅花易数',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：主卦${data.originalName}${data.mainHexagram?.description ? `（${data.mainHexagram.description}）` : ''}；互卦${data.interName || '无'}${data.interHexagram?.description ? `（${data.interHexagram.description}）` : ''}；变卦${data.changedName || '无'}${data.changedHexagram?.description ? `（${data.changedHexagram.description}）` : ''}`,
    data.mainHexagram?.movingYaoCi ? `动爻爻辞：${data.mainHexagram.movingYaoCi}` : '',
    ...(movingYaoCiLines.length > 1 ? movingYaoCiLines : []),
    '断卦抓手：先定体用，再看互卦过程、变卦结果与四时旺衰',
    `主轴证据：体卦${data.tiGua.name}（${data.tiGua.element}）；用卦${data.yongGua.name}（${data.yongGua.element}）；动爻第${data.movingYao.position}爻；体用关系${data.analysis.tiYongRelation}`,
    `体用评分：${scoringEvidence}`,
    `过程证据：互卦${processHexagram}；互卦体用${data.analysis.inter1Relation}；互上辅助${data.analysis.inter2Relation}`,
    `结果证据：变卦${resultHexagram}${changedTiYongText}；结果关系${data.analysis.changedRelation}`,
    `互变阶段：${stageEvidence}`,
    `辅助证据：四时${data.analysis.season}季，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}；起卦法${methodLabel}${typeof calculation?.number === 'number' ? `；起卦数字${calculation.number}` : ''}`,
    `外应置信度：${externalConfidenceEvidence}`,
    yingQiText || `应期候选：${timingEvidence}`,
    `应期优先级：${timingPriorityEvidence}`,
    `类象权重：${symbolEvidence}`,
    isExternalMethod && hasExternalSummary ? `外应：${externalSummary}` : '',
    externalMappedText ? `外应映射：${externalMappedText}` : '',
    externalDetailParts.length ? `外应明细：${externalDetailParts.join('；')}` : '',
    '结构明细：',
    `- 四时旺衰：${data.analysis.season}季，体卦${data.analysis.tiSeasonState}，用卦${data.analysis.yongSeasonState}`,
    `- 体用关系：${data.analysis.tiYongRelation}`,
    `- 过程关系：互卦体用${data.analysis.inter1Relation}，互上辅助${data.analysis.inter2Relation}`,
    `- 结果关系：${data.analysis.changedRelation}`,
    data.changedTiGua && data.changedYongGua
      ? `- 变后体用：体卦${data.changedTiGua.name}（${data.changedTiGua.element}），用卦${data.changedYongGua.name}（${data.changedYongGua.element}），关系${data.analysis.changedTiYongRelation}`
      : '',
    ...yaoLines,
    !isExternalMethod && hasExternalSummary ? `补充提示：${externalSummary}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatXiaoliurenInfo(data: XiaoliurenData) {
  const sequence = data.sequence;
  const timingEvidence = createXiaoliurenTimingEvidence(data);
  const reviewEvidence = createXiaoliurenReviewEvidence(data);
  const actionLevelEvidence = createXiaoliurenActionLevelEvidence(data);
  const reviewWindowEvidence = createXiaoliurenReviewWindowEvidence(data);

  return [
    '占法：小六壬',
    `时间干支：以【当前时间】为准；农历${data.lunarMonth}月${data.lunarDay}日，${data.hourLabel}`,
    `核心结构：起因${sequence.start.name}；过程${sequence.process.name}；结果${sequence.result.name}`,
    `关键提示：起课方式${data.methodLabel}；主判断${data.primary.name}；倾向${data.tendency}${data.fortune ? `；${data.fortune}` : ''}`,
    '断课抓手：先看结果宫位定主判断，再看起因与过程宫位解释事情为何如此、会如何推进。',
    `主轴证据：起因${sequence.start.name}（${sequence.start.keywords.join('、')}）；过程${sequence.process.name}（${sequence.process.keywords.join('、')}）；结果${sequence.result.name}（${sequence.result.keywords.join('、')}）`,
    `辅助证据：起因提示${sequence.start.meaning}；过程提示${sequence.process.meaning}；结果提示${sequence.result.meaning}`,
    data.seasonStates
      ? `月令旺衰：起因${data.seasonStates.start}，过程${data.seasonStates.process}，结果${data.seasonStates.result}`
      : '',
    data.direction ? `方位参考：${data.direction}` : '',
    data.shenSha ? `神煞参考：${data.shenSha}` : '',
    `问题映射：${data.questionHint}`,
    data.yingQi ? `应期参考：${data.yingQi}` : `应期候选：${timingEvidence}`,
    `复盘信号：${reviewEvidence}`,
    `行动建议等级：${actionLevelEvidence}`,
    `复盘窗口：${reviewWindowEvidence}`,
    '结构明细：',
    `- 起课方式：${data.methodLabel}`,
    `- 起因：${sequence.start.name}，关键词：${sequence.start.keywords.join('、')}；建议：${sequence.start.advice}`,
    `- 过程：${sequence.process.name}，关键词：${sequence.process.keywords.join('、')}；建议：${sequence.process.advice}`,
    `- 结果：${sequence.result.name}，关键词：${sequence.result.keywords.join('、')}；建议：${sequence.result.advice}`,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatQimenInfo(question: string, data: QimenData, supplementaryInfo?: SupplementaryInfo) {
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
  const palaceLines = data.jiuGongGe
    .map(
      (item) =>
        `- ${item.name}（${item.direction}，五行${item.element}）：天盘${item.tianPan.stem}${item.tianPan.star}，地盘${item.diPan.stem}，人盘${item.renPan.door}，神盘${item.shenPan.god}`,
    )
    .join('\n');
  const patternSummary =
    data.patternDetails?.map((item) => `${item.tag}：${item.summary}`).join('；') || '';
  // 经典格局（九遁、三奇得使等）—— 比一般格局标签更优先的判断依据
  const classicPatternSummary = data.classicPatterns?.length
    ? data.classicPatterns
        .slice(0, 4)
        .map(
          (item) =>
            `${item.name}（${item.type === 'good' ? '吉' : item.type === 'bad' ? '凶' : '平'}，评分${item.score}）：${item.summary}`,
        )
        .join('；')
    : '';
  // 天地盘干关系（八十一格精选）—— 取最有代表性的格式
  const stemRelationSummary = data.stemRelations?.length
    ? data.stemRelations
        .filter(
          (item) =>
            item.pattern &&
            /青龙返首|飞鸟跌穴|白虎干格|朱雀投江|腾蛇夭矫|九地九天|伏干飞干|伏宫飞宫/.test(
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
  // 方向吉凶建议——由算法按用神落宫评分的结构化方位数据
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
  const palaceSummary =
    data.palaceInsights?.map((item) => `${item.name}${item.level}，${item.summary}`).join('；') ||
    '';
  const questionHints = createQimenQuestionHints(question, data, supplementaryInfo);
  const priorityPalaces = createQimenPriorityPalaces(question, data, supplementaryInfo).slice(0, 3);
  const specialConditionsText = data.specialConditions?.description?.trim();
  const questionHintText =
    questionHints.length > 0
      ? questionHints.map((item) => `${item.label}：${item.value}`).join('；')
      : '';
  const priorityPalaceText = priorityPalaces
    .map((item) => `${item.name}（${item.score}分，${item.reasons.join('、')}）`)
    .join('；');
  const priorityPalaceEvidence = priorityPalaces
    .map((item) => {
      const gong = data.jiuGongGe.find((palace) => palace.gong === item.gong);
      const voidHit = data.voidPalaces?.some((voidPalace) => voidPalace.palace === item.gong);
      const horseHit = data.horseStar?.palace === item.gong;
      const patternHit = data.patternDetails
        ?.filter(
          (detail) =>
            detail.tag.includes(`（${item.name}`) || detail.tag.includes(`落${item.name}`),
        )
        .map((detail) => detail.tag);
      const parts = [
        gong
          ? `门${gong.renPan.door}、星${gong.tianPan.star}、神${gong.shenPan.god}、天盘${gong.tianPan.stem}、地盘${gong.diPan.stem}`
          : '',
        voidHit ? '逢空，落地偏虚或需待填实' : '',
        horseHit ? '逢马星，主移动、变动或外部推动' : '',
        patternHit?.length ? `格局${patternHit.join('、')}` : '',
      ].filter(Boolean);
      return `${item.name}：${parts.join('；')}`;
    })
    .join('；');
  const relationPalaces = [
    ...priorityPalaces,
    ...[zhiFuPalace, zhiShiPalace, ...hourStemPalaces]
      .filter((palace): palace is QimenJiuGongGe => Boolean(palace))
      .map((palace) => ({
        name: palace.name,
        gong: palace.gong,
        score: 0,
        reasons: ['值符值使或时干落宫'],
      })),
  ].filter(
    (item, index, array) => array.findIndex((candidate) => candidate.gong === item.gong) === index,
  );
  const mainRelationPalace = relationPalaces[0];
  const auxiliaryRelationPalaces = relationPalaces.slice(1, 3);
  const adversePalaces = relationPalaces.filter((item) => {
    const voidHit = data.voidPalaces?.some((voidPalace) => voidPalace.palace === item.gong);
    const patternHit = data.patternDetails?.some(
      (detail) =>
        detail.tag.includes(`（${item.name}`) ||
        detail.tag.includes(`落${item.name}`) ||
        detail.summary.includes(item.name),
    );
    return voidHit || patternHit;
  });
  const palaceRelationEvidence = mainRelationPalace
    ? [
        `主宫${mainRelationPalace.name}：${mainRelationPalace.reasons.join('、')}`,
        ...auxiliaryRelationPalaces.map((item) => {
          const mainPalace = data.jiuGongGe.find(
            (palace) => palace.gong === mainRelationPalace.gong,
          );
          const currentPalace = data.jiuGongGe.find((palace) => palace.gong === item.gong);
          const relation =
            mainPalace && currentPalace
              ? describeWuxingRelation(mainPalace.element, currentPalace.element)
              : '宫间五行待复核';
          return `辅宫${item.name}：${relation}，${item.reasons.join('、')}`;
        }),
        adversePalaces.length
          ? `反证宫${adversePalaces.map((item) => item.name).join('、')}：逢空、马星或格局标签命中时先降权复核`
          : '反证宫：未见明显空亡或格局反证命中',
        '宫间关系只用于排序主宫、辅宫和反证宫，不可替代门星神干的具体组合判断',
      ].join('；')
    : '';
  const mainPalaceScoreText = mainRelationPalace
    ? `${mainRelationPalace.name}（${mainRelationPalace.score}分）：${mainRelationPalace.reasons.join('、')}；分数只用于取用排序，仍需回看门星神干`
    : '未定位主宫，先以值符、值使、时干和值事宫复核';
  const auxiliaryPalaceScoreText = auxiliaryRelationPalaces.length
    ? auxiliaryRelationPalaces
        .map((item) => `${item.name}（${item.score}分）：${item.reasons.join('、')}`)
        .join('；')
    : '未定位明确辅宫，辅助证据以值符值使、时干、空亡和马星为准';
  const adversePalaceText = adversePalaces.length
    ? `${adversePalaces.map((item) => item.name).join('、')}：命中空亡、马星或格局标签时，相关结论必须降权复核`
    : '未见明显反证宫；仍需检查空亡、门迫、击刑、伏吟反吟和问题用神是否冲突';
  const directionStrategyText = priorityPalaces.length
    ? priorityPalaces
        .map((item, index) => {
          const palace = data.jiuGongGe.find((gong) => gong.gong === item.gong);
          const role = index === 0 ? '主方位' : '辅方位';
          return `${role}${palace?.direction || '未知'}（${item.name}）：按${item.reasons.join('、')}取象`;
        })
        .join('；')
    : '方位未由问题明确触发，只能按值符值使、时干落宫和现实可行方向取舍';
  const timeWindowText = [
    data.yingQi
      ? `应期范围${data.yingQi.minDays}-${data.yingQi.maxDays}日，节奏${data.yingQi.rhythm}（依据：${data.yingQi.sources.join('、')}）`
      : data.voidPalaces?.length
        ? `逢空${data.voidPalaces.map((item) => item.name).join('、')}先待填实`
        : '',
    data.horseStar ? `马星落${data.horseStar.name}，主移动、变动或外部推动` : '',
    specialConditionsText ? `特殊时辰${specialConditionsText}` : '',
    '未给目标期限时，只能给宜动、宜守、宜等和触发条件，不换算绝对日期',
  ]
    .filter(Boolean)
    .join('；');
  const normalizedPalaceSummary = normalizePromptCompareText(palaceSummary);
  const dedupedPalaceSummary = palaceSummary
    ? priorityPalaces.some(
        (item) =>
          normalizedPalaceSummary.includes(normalizePromptCompareText(item.name)) &&
          item.reasons.some((reason) =>
            normalizedPalaceSummary.includes(normalizePromptCompareText(reason)),
          ),
      )
      ? ''
      : palaceSummary
    : '';
  const focusParts = [
    `值符${data.zhiFu}`,
    `值使${data.zhiShi}`,
    `${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局`,
    data.patternTags?.length ? `格局${data.patternTags.join('、')}` : '',
    priorityPalaces[0] ? `先看${priorityPalaces[0].name}` : '',
  ].filter(Boolean);

  return [
    '占法：奇门遁甲',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：${data.isYangDun ? '阳遁' : '阴遁'}${data.juShu}局；值符${data.zhiFu}；值使${data.zhiShi}`,
    `关键提示：节令${`${data.timeInfo?.solarTerm || '未知'} ${data.timeInfo?.epoch || ''}`.trim()}；格局标签${data.patternTags?.join('、') || '无'}`,
    `起局抓手：${focusParts.join('；')}`,
    `主轴证据：值符${data.zhiFu}${zhiFuPalace ? `落${zhiFuPalace.name}` : '落宫未定位'}；值使${data.zhiShi}${zhiShiPalace ? `落${zhiShiPalace.name}` : '落宫未定位'}；时干${hourStem}${hourStemPalaces.length ? `见于${hourStemPalaces.map((item) => item.name).join('、')}` : '落宫未定位'}`,
    `用神宫候选：${priorityPalaceText || '未根据问题识别出优先宫，先以值符值使、时干和值事宫为主'}`,
    priorityPalaceEvidence ? `用神宫证据：${priorityPalaceEvidence}` : '',
    `主宫评分：${mainPalaceScoreText}`,
    `辅宫评分：${auxiliaryPalaceScoreText}`,
    `反证宫：${adversePalaceText}`,
    palaceRelationEvidence ? `宫间关系：${palaceRelationEvidence}` : '',
    `方位策略：${directionStrategyText}`,
    `时间窗口：${timeWindowText}`,
    `辅助证据：旬空${voidText}；马星${horseText}`,
    specialConditionsText ? `特殊时辰：${specialConditionsText}` : '',
    questionHintText ? `问事参考：${questionHintText}` : '',
    patternSummary ? `判断依据：${patternSummary}` : '',
    classicPatternSummary ? `经典格局：${classicPatternSummary}` : '',
    stemRelationSummary ? `天地盘干：${stemRelationSummary}` : '',
    directionSummary ? `方位吉凶：${directionSummary}` : '',
    dedupedPalaceSummary ? `补充提示：${dedupedPalaceSummary}` : '',
    '结构明细：',
    palaceLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatLiurenInfo(data: LiurenData) {
  const firstTransmission = data.threeTransmissions[0];
  const lastTransmission = data.threeTransmissions[2];
  const lessonText = data.fourLessons
    .map((item) => `${item.name}${item.upper}临${item.lower}乘${item.god}，${item.relation}`)
    .join('；');
  const transmissionText = data.threeTransmissions
    .map((item) => `${item.stage}${item.branch}乘${item.god}，${item.relation}，${item.note}`)
    .join('；');
  const voidHits = data.threeTransmissions
    .filter((item) => data.xunKong?.includes(item.branch))
    .map((item) => `${item.stage}${item.branch}`);
  const summaryText = [data.lessonSummary, data.transmissionSummary, data.transmissionDetail]
    .filter(Boolean)
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
  const classicalRuleText = data.classicalRules?.length
    ? data.classicalRules.map((item) => `${item.source}：${item.rule}，${item.summary}`).join('；')
    : '';
  const guaTiText = data.guaTi?.length ? data.guaTi.join('、') : '';
  const guaTiSection = guaTiText
    ? `课体：${guaTiText}——${guaTiText.includes('伏吟') ? '伏吟主静、主迟、主闷局，宜守待时机' : guaTiText.includes('反吟') || guaTiText.includes('返吟') ? '反吟主动、主反复、主事有反复，宜先稳住再动' : guaTiText.includes('元首') ? '元首课上克下，主事从上层或外部推动' : guaTiText.includes('重审') ? '重审课下贼上，主事须反复确认、先阻后成' : guaTiText.includes('涉害') ? '涉害课主阻力深、纠缠久，宜耐心周旋' : guaTiText.includes('遥克') ? '遥克课主远事、间接牵动，宜看远程资源' : guaTiText.includes('昴星') ? '昴星课主动在女、暗处或非常规路径' : guaTiText.includes('别责') ? '别责课主事出非常规，需另辟蹊径' : '课体为大局底色，可作旁证'}`
    : '';
  const tianJiangContext = data.threeTransmissions
    .map((t) => {
      const attr = data.tianJiangProps?.[t.god];
      if (!attr) return null;
      return `${t.stage}${t.god}：${attr.wuxing}${attr.yinYang}，${attr.category}，${attr.description?.slice(0, 20) || ''}`;
    })
    .filter(Boolean);
  const tianJiangSection = tianJiangContext?.length
    ? `天将属性：${tianJiangContext.join('；')}`
    : '';
  const shenShaCategorized = data.shenShaSummary?.length
    ? (() => {
        const yearSha = data.shenShaSummary.filter((s) => s.includes('年'));
        const monthSha = data.shenShaSummary.filter((s) => s.includes('德') || s.includes('马'));
        const daySha = data.shenShaSummary.filter(
          (s) => !s.includes('年') && !s.includes('德') && !s.includes('马'),
        );
        const parts = [];
        if (yearSha.length) parts.push(`年支${yearSha.join('、')}`);
        if (monthSha.length) parts.push(`月支${monthSha.join('、')}`);
        if (daySha.length) parts.push(`日干${daySha.join('、')}`);
        return parts.join('；');
      })()
    : '';

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
    data.xunKong?.length
      ? `旬空：${data.xunKong.join('、')}${voidHits.length ? `，命中${voidHits.join('、')}主虚而不实，待填实再看` : ''}`
      : '',
    summaryText ? `简要提示：${summaryText}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function formatTarotInfo(data: TarotData) {
  // 牌阵类型决定读取策略
  const spreadSpecificHint: Record<string, string> = {
    love: '感情牌阵优先看牌面情感基调、人物牌互动和阻碍位',
    career: '事业牌阵优先看行动位、资源位和结果位的呼应',
    decision: '选择牌阵优先看选项对比、关键建议位和潜在风险',
    three: '三牌时间流优先看过去成因→当下关键→未来趋势的承接',
    celtic: '凯尔特十字优先看核心问题位、外界影响和最终结果',
    chakra: '脉轮牌阵优先看顶轮（大方向）和海底轮（根基）的能量流向',
    year: '年运牌阵优先看第一季度的行动位和第四季度的收获位',
    mindBodySpirit: '身心灵魂牌阵优先看身（现实）和灵（方向）两个极位',
    horseshoe: '马蹄铁牌阵优先看过去、现在、隐藏因素和结果四个关键锚点',
  };
  const focusCards = getTarotFocusCards(data);
  const focusParts = focusCards.map((card) => formatTarotCardLabel(card));
  const auxiliaryParts = [
    `牌阵${data.spreadName}`,
    ...focusCards.map((card) => `${card.position}关键词${card.keywords.join('、')}`),
  ].filter(Boolean);
  const cardLines = data.cards.map(
    (card) =>
      `- ${card.position}：${card.name}${card.reversed ? '（逆位）' : '（正位）'}，关键词：${card.keywords.join('、')}`,
  );
  const conflictEvidence = createTarotConflictEvidence(data);
  const narrativeWeightEvidence = createTarotNarrativeWeightEvidence(data);
  const layerEvidence = createTarotLayerEvidence(data);
  const elementNumberEvidence = createTarotElementNumberEvidence(data);
  const courtEvidence = createTarotCourtEvidence(data);
  const relationText =
    focusCards.length >= 2
      ? focusCards
          .slice(0, 3)
          .map((card, index) => {
            if (index === 0) {
              return `${card.position}先提示${card.keywords.join('与')}`;
            }
            if (index === 1) {
              return `${card.position}位再看如何调整${card.keywords.join('与')}`;
            }
            return `${card.position}位再看后续${card.keywords.join('与')}`;
          })
          .join('，')
      : focusCards[0]
        ? `${focusCards[0].position}是当前主轴，先围绕这张牌回答问题`
        : '';

  return [
    '占法：塔罗',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    spreadSpecificHint[data.spreadType as string]
      ? `读取策略：${spreadSpecificHint[data.spreadType as string]}`
      : '',
    '断牌抓手：先统合牌阵主轴，再看关键位置、正逆位变化与牌面呼应',
    `主轴证据：${focusParts.join('；') || '牌面主轴未定位'}`,
    `辅助证据：${auxiliaryParts.join('；') || '暂无辅助证据'}`,
    layerEvidence ? `牌组层级：${layerEvidence}` : '',
    `元素数字：${elementNumberEvidence}`,
    `宫廷人物：${courtEvidence}`,
    `牌面冲突：${conflictEvidence}`,
    `叙事权重：${narrativeWeightEvidence}`,
    `牌间叙事：${relationText || '牌数不足时只按单牌与问题关系解释'}`,
    '现实边界：塔罗只能给当下倾向、心理动力、互动节奏和行动建议；未给期限时不把牌义硬换成绝对日期',
    '牌位明细：',
    ...cardLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatSsgwInfo(data: SsgwData) {
  // 三连阴杯拒绝起卦
  if (data.ritual?.rejected) {
    const throwLog = data.ritual.throws.map((t) => t.result).join(' → ');
    return (
      '占法：三山国王灵签\n' +
      `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}\n` +
      `掷筊记录：${throwLog}\n` +
      `结果：${data.ritual.reason}\n\n` +
      '神明未应，本次不起卦。建议稍后再试，或反思所问是否妥当。'
    );
  }

  const { canonicalStory, extraStory } = resolveSsgwStoryContent(data);
  // 非拒绝状态下的掷筊记录（神明已应）
  const ritualLog = data.ritual?.throws?.length
    ? `掷筊记录：${data.ritual.throws.map((t) => t.result).join(' → ')}${data.ritual.reason ? `（${data.ritual.reason}）` : ''}`
    : '';
  const detailLines = data.details
    ? Object.entries(data.details)
        .filter(([key]) => key !== '典故')
        .map(([key, value]) => `- ${key}：${value}`)
    : [];
  const detailMap = data.details || {};
  const auxiliaryParts = [
    `签题《${data.title}》`,
    canonicalStory ? `典故${canonicalStory}` : '',
    detailMap.解签 ? `解签${detailMap.解签}` : '',
  ].filter(Boolean);
  const decisionEvidence = createSsgwDecisionEvidence(data);
  const topicEvidence = createSsgwTopicEvidence(data);
  const timingEvidence = createSsgwTimingEvidence(data);
  const poemParts = data.poem
    .split(/[，。；;、,.!?！？\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 6);
  const detailText = Object.values(detailMap).join('；');
  const isCautious = /守|待|缓|莫强求|不可躁进|暂避|敛锋芒|周旋/.test(
    `${data.poem}；${detailText}`,
  );
  const isPositive = /吉|喜|成|利|可|得|明|云开|月明/.test(`${data.poem}；${detailText}`);
  const auspiciousLevel = isCautious
    ? isPositive
      ? '中平偏守，等待转明'
      : '偏谨慎，先守后看'
    : isPositive
      ? '偏吉可进，但须守条件'
      : '吉凶未明，按签诗保守取象';
  const tabooText =
    detailText.match(/不可[^。；;，,]*|忌[^。；;，,]*|莫[^。；;，,]*/)?.[0] ||
    (isCautious ? '忌躁进强求' : '未见明确忌项，仍需按签意避险');
  const suitableText =
    detailText.match(/宜[^。；;，,]*/)?.[0] || (isCautious ? '宜守正待时' : '宜顺势推进');
  const realityHint = detailMap.解签
    ? detailMap.解签.includes('守正待时')
      ? '当前更宜先守正待时，再等局势转明，不宜躁进强求'
      : `当前更宜依签意行事，先稳住节奏，再看后续变化`
    : '';

  return [
    '占法：三山国王灵签',
    `时间干支：${formatGanzhi(data.ganzhi).replace('干支：', '')}`,
    `核心结构：第${data.number}签；签题《${data.title}》`,
    '断签抓手：先定签诗主旨，再看典故映射、现实处境与宜进宜守',
    `主轴证据：签诗“${data.poem}”`,
    ritualLog,
    `辅助证据：${auxiliaryParts.join('；') || '暂无辅助证据'}`,
    poemParts.length
      ? `逐句签意：${poemParts.map((item, index) => `第${index + 1}句${item}`).join('；')}`
      : '',
    `事项分类：按用户问题映射到求事、关系、事业、财务或行程；未给具体事项时只按签诗主旨给通用取舍`,
    `吉凶层级：${auspiciousLevel}`,
    `宜忌条件：${suitableText}；${tabooText}`,
    `迟速判断：${timingEvidence}`,
    `典故映射：${canonicalStory ? '已按所给典故作现实处境类比' : '未给典故，不能补造故事'}；典故只用于现实处境类比，不替代签诗主旨`,
    `签意取舍：${decisionEvidence}`,
    `事项映射：${topicEvidence}`,
    '复盘条件：以签诗、典故和现实条件是否对应为准；未给期限时不硬断绝对日期',
    realityHint ? `现实映射：${realityHint}` : '',
    '结构明细：',
    `- 签号：第${data.number}签`,
    `- 签题：${data.title}`,
    canonicalStory ? `- 典故：${canonicalStory}` : '',
    extraStory ? `补充提示：${extraStory}` : '',
    ...detailLines,
  ]
    .filter(Boolean)
    .join('\n');
}

function formatAlmanacEvidenceItems(items: PromptEvidenceItem[]) {
  return normalizePromptEvidenceItems(items).map((item) =>
    item.detail ? `${item.title}：${item.detail}` : item.title,
  );
}

function createAlmanacTabooEvidenceItems(
  days: AlmanacDayCandidate[],
  topicKeywords: string[],
): PromptEvidenceItem[] {
  const items = days
    .map((item, index): PromptEvidenceItem | null => {
      const directAvoids = topicKeywords.filter((keyword) =>
        item.avoids.some((avoid) => avoid.includes(keyword) || keyword.includes(avoid)),
      );
      const cautionText = item.cautions.length ? item.cautions.join('、') : '';
      const participantText = item.participantNotes.filter(
        (note) => /冲|忌|不宜|避/.test(note) && !/未见|未冲|不冲|无明显/.test(note),
      );
      const scoreRisk = item.score < 60 ? `评分${item.score}偏低` : '';
      const risks = [
        directAvoids.length ? `事项忌项命中${directAvoids.join('、')}` : '',
        cautionText ? `风险${cautionText}` : '',
        participantText.length ? `参与人${participantText.join('；')}` : '',
        scoreRisk,
      ].filter(Boolean);

      if (!risks.length) {
        return null;
      }

      return {
        level: '反证',
        title: item.date,
        detail: risks.join('；'),
        source: '择日禁忌筛查',
        weight: 100 - index,
        tags: [`评分${item.score}`],
      };
    })
    .filter((item): item is PromptEvidenceItem => Boolean(item));

  return items.slice(0, 4);
}

function createAlmanacSelectionEvidenceItems(
  bestDay: AlmanacDayCandidate | undefined,
  backupDays: AlmanacDayCandidate[],
  cautionDays: AlmanacDayCandidate[],
  formatDayReason: (item: AlmanacDayCandidate) => string,
): PromptEvidenceItem[] {
  const items: Array<PromptEvidenceItem | null> = [
    bestDay
      ? {
          level: '主证',
          title: `首选${formatDayReason(bestDay)}`,
          source: '择日取舍证据',
          weight: 100,
        }
      : null,
    backupDays.length
      ? {
          level: '辅证',
          title: `备选${backupDays.map(formatDayReason).join('；')}`,
          source: '择日取舍证据',
          weight: 80,
        }
      : null,
    cautionDays.length
      ? {
          level: '反证',
          title: `慎用${cautionDays.map(formatDayReason).join('；')}`,
          source: '择日取舍证据',
          weight: 60,
        }
      : null,
    {
      level: '限制',
      title: '只在候选日期范围内排序；若现实约束与分数冲突，必须说明取舍',
      source: '择日取舍证据',
      weight: 10,
    },
  ];

  return items.filter((item): item is PromptEvidenceItem => Boolean(item));
}

function formatAlmanacInfo(data: AlmanacData) {
  const topDays = data.days.slice(0, 8);
  const topicAvoidKeywords: Record<AlmanacData['topic'], string[]> = {
    marriage: ['嫁娶', '结婚', '订婚', '纳采'],
    move: ['入宅', '移徙', '搬家', '安床'],
    opening: ['开市', '开业', '交易', '立券'],
    contract: ['签约', '交易', '立券', '纳财'],
    travel: ['出行', '赴任', '远行'],
    medical: ['求医', '治病', '动土', '手术'],
    study: ['入学', '考试', '求学', '开光'],
    burial: ['安葬', '修坟', '启钻', '立碑'],
    renovation: ['修造', '动土', '竖柱', '上梁'],
    custom: data.topicLabel
      .split(/[、，,；;\s]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  };
  const topicKeywords = topicAvoidKeywords[data.topic] || [];
  const participantLines = data.participants.map((item) => {
    const useful = item.usefulGods.length ? item.usefulGods.join('、') : '未标注';
    const avoid = item.avoidGods.length ? item.avoidGods.join('、') : '未标注';
    return `- ${item.name}：${item.gender || '性别未填'}，公历${item.solarDate}，农历${item.lunarDate}，生肖${item.zodiac}，日主${item.dayMaster}${item.dayMasterElement}，四柱${item.pillars.year}年 ${item.pillars.month}月 ${item.pillars.day}日 ${item.pillars.hour}时，喜用参考${useful}，忌神参考${avoid}`;
  });
  const dayLines = topDays.map((item, index) => {
    const starDetail = item.twentyEightStarDetail
      ? `（${item.twentyEightStarDetail.wuxing}，${item.twentyEightStarDetail.fortune}，${item.twentyEightStarDetail.meaning}）`
      : '';
    const nineStarDetail = item.nineStarDetail
      ? `（${item.nineStarDetail.wuxing}，${item.nineStarDetail.fortune}，${item.nineStarDetail.meaning}）`
      : '';
    const godText = item.gods.length ? `吉神${item.gods.join('、')}` : '';
    const evidence = [
      `宜${item.recommends.slice(0, 8).join('、') || '无'}`,
      `忌${item.avoids.slice(0, 8).join('、') || '无'}`,
      godText,
      item.highlights.length ? `加分${item.highlights.join('、')}` : '',
      item.cautions.length ? `风险${item.cautions.join('、')}` : '',
      item.participantNotes.length ? `参与人${item.participantNotes.join('；')}` : '',
    ].filter(Boolean);
    return `- 第${index + 1}候选：${item.date} ${item.weekday}，${item.lunarDate}，${item.ganzhi.year}年 ${item.ganzhi.month}月 ${item.ganzhi.day}日，评分${item.score}；${item.dayOfficer}执日，十二神${item.twelveStar}，二十八宿${item.twentyEightStar}${starDetail}，九星${item.nineStar}${nineStarDetail}，${item.clash}；${evidence.join('；')}`;
  });
  const bestDay = topDays[0];
  const backupDays = topDays.slice(1, 3);
  const cautionDays = [...topDays]
    .filter((item) => item.cautions.length > 0 || item.score < 60)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2);
  const formatDayReason = (item: AlmanacDayCandidate) => {
    const good = item.highlights.length ? item.highlights.join('、') : '未见事项宜项强命中';
    const risk = item.cautions.length ? item.cautions.join('、') : '未见事项忌项强命中';
    const participant = item.participantNotes.length
      ? item.participantNotes.join('；')
      : '未填写参与人八字';
    return `${item.date}（${item.score}分）：${good}；${risk}；${participant}`;
  };
  const selectionEvidenceItems = createAlmanacSelectionEvidenceItems(
    bestDay,
    backupDays,
    cautionDays,
    formatDayReason,
  );
  const selectionEvidence = formatAlmanacEvidenceItems(selectionEvidenceItems);
  const tabooEvidenceItems = createAlmanacTabooEvidenceItems(topDays, topicKeywords);
  const tabooEvidence = formatAlmanacEvidenceItems(tabooEvidenceItems);
  const topicWeightEvidence = [
    `事项${data.topicLabel}优先匹配宜项${topicKeywords.join('、') || data.topicLabel}`,
    '先查事项忌项和冲犯，再看宜项、吉神、执日、星宿与评分',
    data.topic === 'custom'
      ? '自定义事项需结合用户补充拆关键词，无法识别时按通用黄历取舍'
      : '事项权重高于单日总分，高分但犯事项忌项必须降级',
  ].join('；');
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
          return `${participant.name}：日主${participant.dayMaster}${participant.dayMasterElement}，喜用${participant.usefulGods.join('、') || '未标注'}，忌神${participant.avoidGods.join('、') || '未标注'}；${relatedNotes.join('；') || '候选日期未见直接参与人冲克提醒'}`;
        })
        .join('；')
    : '未填写参与人八字，不能编造个人适配，只按通用黄历规则判断';
  const tabooDowngradeEvidence = tabooEvidence.length
    ? `${tabooEvidence.join('；')}；命中事项忌项、参与人冲克或低分强风险时，即使总分靠前也必须降为备选或慎用`
    : '未见强禁忌命中；仍需检查用户现实限制，不能只按分数定案';
  const realityConstraintEvidence = [
    '现实刚性约束包括场地、证件、人员到场、交通、预算、天气和办理窗口',
    '已提供资料未给现实时不得编造；若用户补充现实条件与黄历分数冲突，应说明为什么现实约束压过分数',
  ].join('；');
  const availableWindowEvidence = [
    `只允许在${data.startDate}至${data.endDate}范围内排序`,
    '当前资料没有逐时辰吉凶时，不得推荐具体吉时',
    bestDay
      ? `首选窗口先看${bestDay.date}，备选看${backupDays.map((item) => item.date).join('、') || '暂无'}`
      : '',
  ]
    .filter(Boolean)
    .join('；');

  return [
    '占法：黄历择日',
    `核心结构：择日事项：${data.topicLabel}；候选日期：${data.startDate} 至 ${data.endDate}；先按黄历宜忌、神煞、冲煞与参与人八字做初筛`,
    bestDay
      ? `初筛结论：当前排序第一为${bestDay.date}，评分${bestDay.score}；仍需结合用户现实约束复核，不可只按分数机械决定`
      : '初筛结论：暂无候选日期',
    '择日抓手：先排除直接冲犯和忌项明显命中的日期，再比较宜项、吉神、执日、星宿与参与人日主喜忌。',
    `事项权重：${topicWeightEvidence}`,
    `参与人适配：${participantFitEvidence}`,
    `禁忌筛查：${tabooEvidence.length ? tabooEvidence.join('；') : '候选日期未见事项忌项、参与人冲克或低分强风险；仍需按现实约束复核'}；先排禁忌，再看评分，高分日期若命中事项忌项或参与人冲克必须降级`,
    `禁忌降级：${tabooDowngradeEvidence}`,
    selectionEvidence.length ? `取舍证据：${selectionEvidence.join('；')}` : '',
    `现实约束：${realityConstraintEvidence}`,
    `可用时段边界：${availableWindowEvidence}`,
    participantLines.length
      ? '参与人八字参考：'
      : '参与人八字参考：未填写，AI 只能按通用黄历规则判断',
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
      `- ${card.position}：${card.name}，关键词：${card.keywords.join('、')}；牌义：${card.meaning}`,
  );
  const focus = data.cards
    .slice(0, 3)
    .map((card) => `${card.position}${card.name}`)
    .join('；');
  const firstThree = data.cards.slice(0, 3);
  const eventChain = firstThree
    .map((card, index) => {
      const keywordText = joinLimited(card.keywords, 2);
      if (index === 0) {
        return `${card.position}${card.name}定主轴：${keywordText}`;
      }
      if (index === 1) {
        return `${card.position}${card.name}补阻力或修饰：${keywordText}`;
      }
      return `${card.position}${card.name}看结果或落点：${keywordText}`;
    })
    .join('；');
  const neighborPairs =
    data.cards.length >= 2
      ? data.cards
          .slice(0, 5)
          .map((card, index) => {
            const left = data.cards[index - 1];
            const right = data.cards[index + 1];
            const leftText = left ? `${left.name}左邻` : '';
            const rightText = right ? `${right.name}右邻` : '';
            return [leftText, card.name, rightText].filter(Boolean).join(' / ');
          })
          .slice(0, 3)
          .join('；')
      : '';
  const combinationWeight =
    data.cards.length >= 2
      ? data.cards
          .slice(0, 4)
          .map((card, index) => {
            const next = data.cards[index + 1];
            if (!next) {
              return '';
            }
            return describeLenormandAdjacentPair(card, next);
          })
          .filter(Boolean)
          .slice(0, 3)
          .join('；')
      : '';
  const coreEvidence = createLenormandCoreEvidence(data);
  const adjacentEvidence = createLenormandAdjacentEvidence(data);
  const categoryEvidence = createLenormandCardCategoryEvidence(data);
  const mirrorEvidence = createLenormandMirrorEvidence(data);

  return [
    '占法：雷诺曼',
    '时间干支：以【当前时间】为准',
    `核心结构：牌阵${data.spreadName}；共${data.cards.length}张牌`,
    '断牌抓手：先看核心牌，再看左右邻牌如何补充事件、人、消息、阻碍或结果。',
    `主轴证据：${focus || '未定位主轴'}`,
    `核心牌：${coreEvidence}`,
    eventChain ? `事件链证据：${eventChain}` : '',
    `相邻组合：${adjacentEvidence}`,
    `人物牌：${categoryEvidence.personText}`,
    `事件牌：${categoryEvidence.eventText}`,
    `时间牌：${categoryEvidence.timeText}`,
    `镜像提示：${mirrorEvidence}`,
    neighborPairs ? `邻近关系：${neighborPairs}` : '',
    combinationWeight
      ? `组合权重：${combinationWeight}；先看相邻组合是否构成现实事件，再看单牌关键词`
      : '',
    '结构明细：',
    ...cardLines,
  ].join('\n');
}

export function formatAstrolabeInfo(data: AstrolabeData) {
  const planetLines = data.planets.map(
    (item) =>
      `- ${item.label}：${item.formatted}，第${item.house}宫${item.retrograde ? '，逆行' : ''}`,
  );
  const angleLines = data.angles.map((item) => `- ${item.label}：${item.formatted}`);
  const aspectLines = data.aspects.map(
    (item) =>
      `- ${item.body1}${item.symbol}${item.body2}（${item.type}），容许度${item.orb}°，强度${item.strength}%${item.applying === null ? '' : item.applying ? '，入相' : '，出相'}`,
  );
  const sun = data.planets.find((item) => item.name === 'Sun');
  const moon = data.planets.find((item) => item.name === 'Moon');
  const ascendant = data.angles.find((item) => item.name === 'Ascendant');
  const aspectSummary = data.aspects
    .slice(0, 3)
    .map(
      (item) => `${item.body1}${item.symbol}${item.body2}（${item.type}，强度${item.strength}%）`,
    )
    .join('；');

  return [
    '占法：星盘',
    `出生信息：${data.birth.name}，${data.birth.gender || '性别未填'}，${data.birth.dateTime}，位置${data.birth.location}，时区 UTC${data.birth.timezone >= 0 ? '+' : ''}${data.birth.timezone}`,
    `核心结构：太阳${sun?.formatted || '未知'}；月亮${moon?.formatted || '未知'}；上升${ascendant?.formatted || '未知'}；共${data.planets.length}颗星体、${data.houses.length}个宫位、${data.aspects.length}组主要相位`,
    `关键提示：逆行星体${data.summary.retrograde.join('、') || '无'}；格局${data.summary.patterns.join('、') || '未见明显格局'}`,
    `主轴证据：太阳${sun?.formatted || '未知'}；月亮${moon?.formatted || '未知'}；上升${ascendant?.formatted || '未知'}`,
    `辅助证据：${aspectSummary ? `主要相位${aspectSummary}` : '主要相位未见强证据'}；逆行${data.summary.retrograde.join('、') || '无'}；格局${data.summary.patterns.join('、') || '未见明显格局'}`,
    '星体位置：',
    ...planetLines,
    '四轴：',
    ...angleLines,
    '主要相位：',
    ...(aspectLines.length ? aspectLines : ['- 未检测到强度足够的主要相位']),
    `元素分布：火${data.summary.elements.火.join('、') || '无'}；土${data.summary.elements.土.join('、') || '无'}；风${data.summary.elements.风.join('、') || '无'}；水${data.summary.elements.水.join('、') || '无'}`,
    `模式分布：开创${data.summary.modalities.开创.join('、') || '无'}；固定${data.summary.modalities.固定.join('、') || '无'}；变动${data.summary.modalities.变动.join('、') || '无'}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export function formatDivinationInfo(
  method: Exclude<DivinationMethodId, 'random'>,
  data: DivinationData,
  question: string,
  supplementaryInfo?: SupplementaryInfo,
) {
  switch (method) {
    case 'liuyao':
      return formatLiuyaoInfo(question, data as LiuyaoData, supplementaryInfo);
    case 'meihua':
      return formatMeihuaInfo(data as MeihuaData);
    case 'xiaoliuren':
      return formatXiaoliurenInfo(data as XiaoliurenData);
    case 'qimen':
      return formatQimenInfo(question, data as QimenData, supplementaryInfo);
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
    default:
      return '占卜信息暂不可用';
  }
}
