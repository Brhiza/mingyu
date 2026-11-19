// 大六壬课盘：共用 V2 历法，按天地盘、四课、九宗门和三传计算。
import type { LiurenData, LiurenTransmission } from './types';
import { getDivinationTime, getVoidBranches, getBranchWuxing, getSeasonState, getMonthLeaderByZhongqi, getSolarTermName } from '../calendar';
import { buildHeavenlyPlate, DAYTIME_BRANCHES, DIZHI, describeRelation, getDayStemResidence, getNoblemanBranch, getPlateItemByBranch, getUnderByUpper, getUpperByUnder, TIANJIANG_ATTRIBUTES, type LiurenGuiRenTable, type TianJiangName } from './plate';
import { buildFourLessons, resolveInitialTransmission } from './lessons';
import { resolveLiurenClassicalRules } from './classical-rules';
import { buildLiurenFocusEvidence, buildLiurenTimingEvidence, buildTransmissionDetail, buildTransmissionNote, getLiurenGuaTiFacts, getPatternTag, getTransmissionPattern } from './transmission';
import { buildShenShaFacts } from './shensha';

declare const chartBrand: unique symbol;
export type LiurenChart = LiurenData & { readonly [chartBrand]: true };

export function generateLiurenChart(customDate: Date, termReferenceDate?: Date, options?: { guiRenTable?: LiurenGuiRenTable }): LiurenChart {
  const guiRenTable: LiurenGuiRenTable = options?.guiRenTable ?? 'jia-wu-geng-chou-wei';
  const clock = getDivinationTime(customDate);
  const actual = termReferenceDate ? getDivinationTime(termReferenceDate) : clock;
  const { timestamp, timezoneOffsetMinutes } = clock;
  const ganzhi = { ...clock.ganzhi, year: actual.ganzhi.year, month: actual.ganzhi.month };
  const dayStem = ganzhi.day.charAt(0);
  const dayBranch = ganzhi.day.charAt(1);
  const hourStem = ganzhi.hour.charAt(0);
  const hourBranch = ganzhi.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
  const termTimestamp = termReferenceDate?.getTime() ?? timestamp;
  const monthLeader = getMonthLeaderByZhongqi(termTimestamp);
  const noblemanBranch = getNoblemanBranch(dayStem, dayNight, guiRenTable);
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
    const previousBranch = index === 0 ? fourLessons[0].lower : transmissionBranches[index - 1];
    const relation = describeRelation(branch, previousBranch);
    const wuxing = getBranchWuxing(branch);

    return {
      stage: transmissionStages[index],
      branch,
      god: plateItem.god,
      relation,
      note: buildTransmissionNote(transmissionStages[index], relation),
      wuxing,
      seasonState: getSeasonState(wuxing, ganzhi.month.charAt(1)),
      isVoid: xunKong.includes(branch),
      dayRelation: describeRelation(branch, dayBranch),
    };
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
    initialGod: threeTransmissions[0].god,
    yearBranch: ganzhi.year.charAt(1),
    monthBranch: ganzhi.month.charAt(1),
    monthLeader,
    noblemanBranch,
    noblemanGroundBranch,
    fourLessons,
    dayStem,
    dayBranch,
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
    ganzhi.month.charAt(1),
    ganzhi.day.charAt(1),
    ganzhi.day.charAt(0),
  );
  const shenShaSummary = shenShaFacts.map((item) => `${item.name}在${item.target}`);
  const focusEvidence = buildLiurenFocusEvidence({
    rule: initialResult.rule,
    transmissions: threeTransmissions,
    dayStem,
    dayStemResidence,
    dayBranch,
    fourLessons,
  });
  const timingEvidence = buildLiurenTimingEvidence({
    transmissions: threeTransmissions,
    dayBranch,
    monthBranch: ganzhi.month.charAt(1),
  });

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
    timezoneOffsetMinutes,
    ...(termReferenceDate ? { termReferenceTimestamp: termTimestamp } : {}),
    ...(guiRenTable === 'jia-yang-wu-geng-niu' ? { guiRenTable } : {}),
    dayNight,
    monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch,
    noblemanGroundBranch,
    xunKong,
    transmissionRule: initialResult.rule,
    ordinaryTransmissionAdjudication: initialResult.ordinaryAdjudication,
    transmissionPattern,
    transmissionDetail,
    earthlyPlate: [...DIZHI],
    dayStemResidence,
    heavenlyPlate,
    fourLessons,
    threeTransmissions,
    patternTags,
    classicalRules,
    lessonSummary: `${lessonSummary} 当前节气为${getSolarTermName(termTimestamp)}。`,
    transmissionSummary,
    guaTi,
    guaTiFacts,
    shenShaSummary,
    shenShaFacts,
    tianJiangProps,
    focusEvidence,
    timingEvidence,
  };
  return result as LiurenChart;
}
