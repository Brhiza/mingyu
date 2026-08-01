import type { LiurenData, LiurenTransmission } from '../../../types/divination';
import { getDivinationTime } from '../../../calendar/timeManager';
import { getMonthGeneralByZhongqi } from '../../../calendar/month-general';
import { getVoidBranches } from '../../../calendar/lunar';
import { getBranchWuxing, getSeasonState } from '../../../ganzhi';
import {
  buildHeavenlyPlate,
  DIZHI,
  getDayStemResidence,
  getNoblemanBranch,
  getPlateItemByBranch,
  getUnderByUpper,
  getUpperByUnder,
  LIUREN_DAYTIME_BRANCHES,
  TIANJIANG_ATTRIBUTES,
  type TianJiangName,
} from './helpers/plate';
import { buildFourLessons, resolveInitialTransmission } from './helpers/lessons';
import { resolveLiurenClassicalRules } from './helpers/classical-rules';
import {
  buildTransmissionDetail,
  buildTransmissionNote,
  describeTransmissionDayBranchRelation,
  describeTransmissionDayStemRelation,
  describeTransmissionTransition,
  getLiurenBranchPairRelations,
  getLiurenGuaTiFacts,
  getLiurenKinship,
  getPatternTag,
  getTransmissionPattern,
} from './helpers/transmission';
import { buildShenShaFacts } from './helpers/shensha';
import { analyzeLiurenEvidence } from '../../liuren-evidence';

function getMonthLeaderByZhongqi(timeInfo: ReturnType<typeof getDivinationTime>['timeInfo']) {
  return getMonthGeneralByZhongqi(timeInfo.solar).monthGeneral;
}

/**
 * 生成大六壬完整课盘
 *
 * 按月将加时、天地盘、四课、三传、天将、神煞顺序完成排盘。
 * 支持传入自定义时间，不传则使用当前时间。
 *
 * @param customDate 自定义排盘时间（可选），不传则使用当前时间。
 * @returns 完整的大六壬课盘数据对象 LiurenData。
 *
 * @example
 * ```ts
 * const result = generateLiuren();
 * // result 包含 fourLessons（四课）、threeTransmissions（三传）等字段
 * ```
 */
export function generateLiuren(customDate?: Date): LiurenData {
  const { ganzhi, timeInfo, timestamp } = getDivinationTime(customDate);
  const dayStem = ganzhi.day.charAt(0);
  const dayBranch = ganzhi.day.charAt(1);
  const hourStem = ganzhi.hour.charAt(0);
  const hourBranch = ganzhi.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = LIUREN_DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
  const monthLeader = getMonthLeaderByZhongqi(timeInfo);
  const noblemanBranch = getNoblemanBranch(dayStem, dayNight);
  const xunKong = getVoidBranches(ganzhi.day);
  const heavenlyPlate = buildHeavenlyPlate({
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    dayNight,
  });
  const noblemanGroundBranch = getUnderByUpper(heavenlyPlate, noblemanBranch);

  const dayStemResidence = getDayStemResidence(dayStem);
  const fourLessons = buildFourLessons({
    heavenlyPlate,
    dayStem,
    dayBranch,
    dayStemResidence,
    xunKong,
  });

  const initialResult = resolveInitialTransmission(fourLessons, {
    dayStem,
    dayBranch,
    dayStemResidence,
    hourStem,
    hourBranch,
    heavenlyPlate,
  });
  const chu = initialResult.initial;
  let zhong: string;
  let mo: string;
  if (initialResult.branches) {
    if (initialResult.branches.length !== 3 || initialResult.branches[0] !== chu) {
      throw new Error(`${initialResult.rule}返回的三传结构不完整或与初传不一致。`);
    }
    [, zhong, mo] = initialResult.branches;
  } else {
    zhong = getUpperByUnder(heavenlyPlate, chu);
    mo = getUpperByUnder(heavenlyPlate, zhong);
  }
  const transmissionPattern = getTransmissionPattern(chu, zhong, mo, initialResult.rule);
  const transmissionBranches = [chu, zhong, mo];
  const transmissionStages: LiurenTransmission['stage'][] = ['初传', '中传', '末传'];
  const threeTransmissions = transmissionBranches.map((branch, index) => {
    const plateItem = getPlateItemByBranch(heavenlyPlate, branch);
    const previousBranch = index > 0 ? transmissionBranches[index - 1] : undefined;
    const wuxing = getBranchWuxing(branch);
    const transmission: LiurenTransmission = {
      stage: transmissionStages[index],
      branch,
      god: plateItem.god,
      kinship: getLiurenKinship(dayStem, branch),
      dayStemRelation: describeTransmissionDayStemRelation(
        transmissionStages[index],
        branch,
        dayStem,
      ),
      previousRelation: previousBranch
        ? describeTransmissionTransition(
            transmissionStages[index - 1],
            previousBranch,
            transmissionStages[index],
            branch,
          )
        : undefined,
      previousBranchRelations: previousBranch
        ? getLiurenBranchPairRelations(previousBranch, branch)
        : [],
      relation: describeTransmissionDayStemRelation(transmissionStages[index], branch, dayStem),
      note: '',
      wuxing,
      seasonState: getSeasonState(wuxing, ganzhi.month.charAt(1)),
      isVoid: xunKong.includes(branch),
      dayRelation: describeTransmissionDayBranchRelation(
        transmissionStages[index],
        branch,
        dayBranch,
      ),
      dayBranchRelations: getLiurenBranchPairRelations(branch, dayBranch),
    };
    transmission.note = buildTransmissionNote(transmission);
    return transmission;
  }) satisfies LiurenTransmission[];
  const classicalRules = resolveLiurenClassicalRules(initialResult.rule);

  const transmissionDetail = buildTransmissionDetail(
    initialResult.rule,
    transmissionPattern,
    threeTransmissions,
    classicalRules,
  );

  const patternTags = [
    `${threeTransmissions[0].god}发用`,
    initialResult.tag,
    threeTransmissions.some((item) => xunKong.includes(item.branch)) ? '空亡入传' : '传不逢空',
    getPatternTag(transmissionPattern),
  ];
  const initialGroundBranch = getPlateItemByBranch(heavenlyPlate, chu).under;
  const guaTiFacts = getLiurenGuaTiFacts({
    transmissionBranches,
    initialGroundBranch,
    yearBranch: ganzhi.year.charAt(1),
    monthBranch: ganzhi.month.charAt(1),
    monthLeader,
    noblemanBranch,
    noblemanGroundBranch,
    fourLessons,
  });
  const guaTi = guaTiFacts.map((fact) => fact.name);
  patternTags.push(...guaTi);

  const lessonSummary = `四课源于日干寄宫${dayStemResidence}与日支${dayBranch}，关系呈${fourLessons
    .map((item) => item.relation)
    .join('、')}，重点先看${initialResult.tag}落点。`;
  const transmissionSummary = `三传${transmissionPattern}，主线依次为${threeTransmissions
    .map((item) => `${item.stage}${item.branch}`)
    .join(' → ')}。`;
  const shenShaFacts = buildShenShaFacts(
    ganzhi.year.charAt(0),
    ganzhi.year.charAt(1),
    ganzhi.month.charAt(1),
    ganzhi.day.charAt(1),
    ganzhi.day.charAt(0),
  );
  const shenShaSummary = shenShaFacts.map((item) => `${item.name}在${item.target}`);
  const firstTransmission = threeTransmissions[0];
  const focusEvidence: NonNullable<LiurenData['focusEvidence']> = [
    {
      target: `初传${firstTransmission.branch}乘${firstTransmission.god}`,
      role: '发用主轴',
      level: '主证',
      evidence: [
        `${initialResult.rule}取为初传`,
        `月令${firstTransmission.seasonState}`,
        `六亲${firstTransmission.kinship}`,
        firstTransmission.dayRelation!,
      ],
      limitations: firstTransmission.isVoid
        ? ['初传落旬空；这里只记录位置条件，不等于已选类神，也不生成现实吉凶或应期']
        : ['初传不空只表示位置事实，不等于已选类神或现实事件已经发动'],
    },
    {
      target: `日干${dayStem}寄${dayStemResidence}`,
      role: '日干寄宫位置索引',
      level: '辅证',
      evidence: ['日干寄宫位置', `一课${fourLessons[0].upper}临${fourLessons[0].lower}`],
      limitations: ['不自动解释为我方、求测者或具体事项类神'],
    },
    {
      target: `日支${dayBranch}`,
      role: '日支位置索引',
      level: '辅证',
      evidence: [`三课${fourLessons[2].upper}临${fourLessons[2].lower}`, '需与发用和三传同看'],
      limitations: ['不自动解释为所占之事、对方、环境或具体事项类神'],
    },
  ];
  const timingEvidence = [
    `一级发用：初传${firstTransmission.branch}${firstTransmission.isVoid ? '落旬空' : '不空'}；这里只记录位置状态，出空、填实、冲实仅作候选触发，不等于已选类神或现实事件发动`,
    `二级三传：${threeTransmissions.map((item) => `${item.stage}${item.branch}（月令${item.seasonState}${item.isVoid ? '、空' : ''}）`).join('→')}`,
    `三级日月：只登记日支${dayBranch}、月支${ganzhi.month.charAt(1)}与初传的同支、冲合及旺衰事实；类神未由通用盘选定`,
    '未同时明确具体类神底本版本、事项类别与参与者角色、完整类神取用规则、已指定类神对象和目标期限时，只登记三传阶段、旺衰及候选触发，不判断确定快慢，也不换算唯一日期',
  ];

  // 为入传天将附加可核验的基础属性。
  const tianJiangProps = threeTransmissions.reduce<
    Record<
      string,
      {
        wuxing: string;
        yinYang: string;
        category: string;
        description?: string;
      }
    >
  >((acc, t) => {
    const attr = TIANJIANG_ATTRIBUTES[t.god as TianJiangName];
    if (attr) {
      acc[t.god] = {
        wuxing: attr.wuxing,
        yinYang: attr.yinYang,
        category: attr.category,
        description: attr.description,
      };
    }
    return acc;
  }, {});

  const result: LiurenData = {
    ganzhi,
    timestamp,
    dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    noblemanGroundBranch,
    xunKong,
    transmissionRule: initialResult.rule,
    transmissionPattern,
    transmissionDetail,
    earthlyPlate: [...DIZHI],
    dayStemResidence,
    heavenlyPlate,
    fourLessons,
    threeTransmissions,
    patternTags,
    classicalRules,
    lessonSummary: `${lessonSummary} 当前节气为${timeInfo.jieQi}。`,
    transmissionSummary,
    guaTi,
    guaTiFacts,
    shenShaSummary,
    shenShaFacts,
    tianJiangProps,
    focusEvidence,
    timingEvidence,
  };
  result.evidenceAnalysis = analyzeLiurenEvidence(result);
  return result;
}

export {
  analyzeLiurenEvidence,
  conditionLiurenTraditionalText,
  rebuildAuditedLiurenData,
} from '../../liuren-evidence';
export {
  getLiurenGuaTiFacts,
  getLiurenTransmissionGuaTi,
  REGISTERED_LIUREN_GUA_TI_COUNT,
} from './helpers/transmission';
export type {
  LiurenCalculationFact,
  LiurenCounterEvidenceFact,
  LiurenCounterSummaryFact,
  LiurenEvidenceCalculationStep,
  LiurenEvidenceAnalysis,
  LiurenFoundationConventionFact,
  LiurenFocusFact,
  LiurenFocusSummaryFact,
  LiurenLessonEvidence,
  LiurenPlateCoverageFact,
  LiurenPlateFact,
  LiurenRelationEvidenceFact,
  LiurenTimingFact,
  LiurenTraditionalFact,
  LiurenTransmissionConventionFact,
  LiurenTransitionFact,
  LiurenTransmissionEvidence,
  LiurenTransmissionRuleFact,
} from '../../liuren-evidence';
