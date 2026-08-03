import type { LiurenData, LiurenShenShaFact, LiurenTransmission } from '../../../types/divination';
import { getDivinationTime } from '../../../calendar/timeManager';
import { getVoidBranches } from '../../../calendar/lunar';
import { SolarTerm, SolarTime } from 'tyme4ts';
import { getBranchWuxing, getSeasonState, getYiMa } from '../../../ganzhi';
import {
  buildHeavenlyPlate,
  DIZHI,
  describeRelation,
  getDayStemResidence,
  getNoblemanBranch,
  getPlateItemByBranch,
  getUnderByUpper,
  getUpperByUnder,
  TIANJIANG_ATTRIBUTES,
  type TianJiangName,
} from './helpers/plate';
import { buildFourLessons, resolveInitialTransmission } from './helpers/lessons';
import { resolveLiurenClassicalRules } from './helpers/classical-rules';
import {
  buildTransmissionDetail,
  buildTransmissionNote,
  getLiurenGuaTiFacts,
  getPatternTag,
  getTransmissionPattern,
} from './helpers/transmission';
import { analyzeLiurenEvidence } from '../../liuren-evidence';

const MONTH_LEADER_BY_ZHONGQI: Record<string, string> = {
  雨水: '亥',
  春分: '戌',
  谷雨: '酉',
  小满: '申',
  夏至: '未',
  大暑: '午',
  处暑: '巳',
  秋分: '辰',
  霜降: '卯',
  小雪: '寅',
  冬至: '丑',
  大寒: '子',
};
const DAYTIME_BRANCHES = new Set(['卯', '辰', '巳', '午', '未', '申']);

/**
 * 按《六壬大全》分层计算无需本命资料即可确定的月煞和日煞。
 * 每项保留起法输入与来源，避免把八字常用的年、日支起法混入六壬逐月神煞。
 */
function buildShenShaFacts(
  monthBranch: string,
  dayBranch: string,
  dayStem: string,
): LiurenShenShaFact[] {
  const facts: LiurenShenShaFact[] = [];
  const commonLimitations = [
    '只定位神煞所在干支',
    '须核对是否入课、入传或临干支',
    '不得单项定吉凶',
  ];
  const addFact = (
    fact: Omit<LiurenShenShaFact, 'sources' | 'limitations'> & {
      source: string;
    },
  ) => {
    const { source, ...rest } = fact;
    facts.push({ ...rest, sources: [source], limitations: [...commonLimitations] });
  };

  const branchHorse = getYiMa(dayBranch);
  if (branchHorse) {
    addFact({
      name: '支马',
      target: branchHorse,
      targetType: '地支',
      category: '十二地支神煞',
      basis: '日支',
      input: dayBranch,
      rule: '日支所属三合局取支马：申子辰寅、亥卯未巳、寅午戌申、巳酉丑亥',
      source: '《六壬大全》卷一“十二地支神煞”支马表',
    });
  }

  const monthHorse = getYiMa(monthBranch);
  if (monthHorse) {
    addFact({
      name: '驿马',
      target: monthHorse,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '按逐月神煞表取驿马：寅午戌月申、亥卯未月巳、申子辰月寅、巳酉丑月亥',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const jieShaMap: Record<string, string> = {
    子: '巳',
    申: '巳',
    辰: '巳',
    亥: '申',
    卯: '申',
    未: '申',
    寅: '亥',
    午: '亥',
    戌: '亥',
    巳: '寅',
    酉: '寅',
    丑: '寅',
  };
  const jieSha = jieShaMap[monthBranch];
  if (jieSha) {
    addFact({
      name: '劫煞',
      target: jieSha,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '按逐月神煞表取劫煞：寅午戌月亥、亥卯未月申、申子辰月巳、巳酉丑月寅',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const wangShenMap: Record<string, string> = {
    子: '亥',
    申: '亥',
    辰: '亥',
    亥: '寅',
    卯: '寅',
    未: '寅',
    寅: '巳',
    午: '巳',
    戌: '巳',
    巳: '申',
    酉: '申',
    丑: '申',
  };
  const wangShen = wangShenMap[monthBranch];
  if (wangShen) {
    addFact({
      name: '亡神',
      target: wangShen,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '按逐月神煞表取亡神：寅午戌月巳、亥卯未月寅、申子辰月亥、巳酉丑月申',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const xianChiMap: Record<string, string> = {
    寅: '卯',
    午: '卯',
    戌: '卯',
    亥: '子',
    卯: '子',
    未: '子',
    申: '酉',
    子: '酉',
    辰: '酉',
    巳: '午',
    酉: '午',
    丑: '午',
  };
  const xianChi = xianChiMap[monthBranch];
  if (xianChi) {
    addFact({
      name: '咸池',
      target: xianChi,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '按逐月神煞表取咸池：寅午戌月卯、亥卯未月子、申子辰月酉、巳酉丑月午',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const poSuiMap: Record<string, string> = {
    寅: '酉',
    申: '酉',
    巳: '酉',
    亥: '酉',

    子: '巳',
    卯: '巳',
    午: '巳',
    酉: '巳',

    辰: '丑',
    戌: '丑',
    丑: '丑',
    未: '丑',
  };
  const poSui = poSuiMap[monthBranch];
  if (poSui) {
    addFact({
      name: '破碎',
      target: poSui,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '月建四孟在酉、四仲在巳、四季在丑',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const dayBranchIndex = DIZHI.findIndex((branch) => branch === dayBranch);
  if (dayBranchIndex >= 0) {
    const tianLuo = DIZHI[(dayBranchIndex + 1) % DIZHI.length];
    const diWang = DIZHI[(dayBranchIndex + 7) % DIZHI.length];
    addFact({
      name: '天罗',
      target: tianLuo,
      targetType: '地支',
      category: '罗网神煞',
      basis: '日支',
      input: dayBranch,
      rule: '日前一支为天罗',
      source: '《六壬大全》卷七“天罗地网卦”',
    });
    addFact({
      name: '地网',
      target: diWang,
      targetType: '地支',
      category: '罗网神煞',
      basis: '日支',
      input: dayBranch,
      rule: '天罗对冲之支为地网',
      source: '《六壬大全》卷七“天罗地网卦”',
    });
  }

  const tianDeMap: Record<string, string> = {
    寅: '丁',
    卯: '申',
    辰: '壬',
    巳: '辛',
    午: '亥',
    未: '甲',
    申: '癸',
    酉: '寅',
    戌: '丙',
    亥: '乙',
    子: '巳',
    丑: '庚',
  };
  const tianDe = tianDeMap[monthBranch];
  if (tianDe) {
    addFact({
      name: '天德',
      target: tianDe,
      targetType: DIZHI.includes(tianDe as (typeof DIZHI)[number]) ? '地支' : '天干',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '按十二月天德表定位',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const yueDeMap: Record<string, string> = {
    寅: '丙',
    午: '丙',
    戌: '丙',
    申: '壬',
    子: '壬',
    辰: '壬',
    亥: '甲',
    卯: '甲',
    未: '甲',
    巳: '庚',
    酉: '庚',
    丑: '庚',
  };
  const yueDe = yueDeMap[monthBranch];
  if (yueDe) {
    addFact({
      name: '月德',
      target: yueDe,
      targetType: '天干',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '寅午戌月丙、申子辰月壬、亥卯未月甲、巳酉丑月庚',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const tianMaMap: Record<string, string> = {
    寅: '午',
    卯: '申',
    辰: '戌',
    巳: '子',
    午: '寅',
    未: '辰',
    申: '午',
    酉: '申',
    戌: '戌',
    亥: '子',
    子: '寅',
    丑: '辰',
  };
  const tianMa = tianMaMap[monthBranch];
  if (tianMa) {
    addFact({
      name: '天马',
      target: tianMa,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: '正月午起，逐月顺行两支',
      source: '《六壬大全》卷一“逐月神煞”表',
    });
  }

  const riDeMap: Record<string, string> = {
    甲: '寅',
    己: '寅',
    乙: '申',
    庚: '申',
    丙: '巳',
    辛: '巳',
    丁: '亥',
    壬: '亥',
    戊: '巳',
    癸: '巳',
  };
  const riDe = riDeMap[dayStem];
  if (riDe) {
    addFact({
      name: '日德',
      target: riDe,
      targetType: '地支',
      category: '十天干神煞',
      basis: '日干',
      input: dayStem,
      rule: '甲己寅、乙庚申、丙辛巳、丁壬亥、戊癸巳',
      source: '《六壬大全》卷一“十天干神煞”日德表',
    });
  }

  const luMap: Record<string, string> = {
    甲: '寅',
    乙: '卯',
    丙: '巳',
    丁: '午',
    戊: '巳',
    己: '午',
    庚: '申',
    辛: '酉',
    壬: '亥',
    癸: '子',
  };
  const lu = luMap[dayStem];
  if (lu) {
    addFact({
      name: '日禄',
      target: lu,
      targetType: '地支',
      category: '十天干神煞',
      basis: '日干',
      input: dayStem,
      rule: '甲寅、乙卯、丙戊巳、丁己午、庚申、辛酉、壬亥、癸子',
      source: '《六壬大全》卷一“十天干神煞”日禄表',
    });
  }

  return facts;
}

function getMonthLeaderByZhongqi(timeInfo: ReturnType<typeof getDivinationTime>['timeInfo']) {
  const currentTime = SolarTime.fromYmdHms(
    timeInfo.solar.year,
    timeInfo.solar.month,
    timeInfo.solar.day,
    timeInfo.solar.hour,
    timeInfo.solar.minute,
    0,
  );
  const currentJulianDay = currentTime.getJulianDay().getDay();
  const year = timeInfo.solar.year;
  let activeZhongqi = '冬至';
  let activeJulianDay = Number.NEGATIVE_INFINITY;

  for (const scanYear of [year - 1, year, year + 1]) {
    for (let termIndex = 0; termIndex < 24; termIndex += 2) {
      const term = SolarTerm.fromIndex(scanYear, termIndex);
      const termJulianDay = term.getJulianDay().getDay();
      if (termJulianDay <= currentJulianDay && termJulianDay > activeJulianDay) {
        activeJulianDay = termJulianDay;
        activeZhongqi = term.getName();
      }
    }
  }

  const monthLeader = MONTH_LEADER_BY_ZHONGQI[activeZhongqi];
  if (!monthLeader) {
    throw new Error(`找不到中气 "${activeZhongqi}" 对应的大六壬月将。`);
  }
  return monthLeader;
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
  const dayNight: '昼占' | '夜占' = DAYTIME_BRANCHES.has(hourBranch) ? '昼占' : '夜占';
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
        firstTransmission.dayRelation,
      ],
      limitations: firstTransmission.isVoid ? ['初传空亡，主证需待填实'] : [],
    },
    {
      target: `日干${dayStem}寄${dayStemResidence}`,
      role: '我方与求测者',
      level: '辅证',
      evidence: ['日干寄宫为我方定位', `一课${fourLessons[0].upper}临${fourLessons[0].lower}`],
      limitations: [],
    },
    {
      target: `日支${dayBranch}`,
      role: '所占之事与对方环境',
      level: '辅证',
      evidence: [`三课${fourLessons[2].upper}临${fourLessons[2].lower}`, '需与发用和三传同看'],
      limitations: ['具体类神仍须按问题主题从明列盘面中选取'],
    },
  ];
  const timingEvidence = [
    `一级发用：先看初传${firstTransmission.branch}${firstTransmission.isVoid ? '空亡，待出空或冲实' : '不空，可直接作为起始信号'}`,
    `二级三传：${threeTransmissions.map((item) => `${item.stage}${item.branch}（月令${item.seasonState}${item.isVoid ? '、空' : ''}）`).join('→')}`,
    `三级日月：以日支${dayBranch}、月支${ganzhi.month.charAt(1)}对初传和类神的同支、冲合与旺衰作为触发条件`,
    '未给出目标期限时，只判断先后、快慢和触发条件，不硬换成唯一日期',
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

export { analyzeLiurenEvidence } from '../../liuren-evidence';
export {
  getLiurenGuaTiFacts,
  getLiurenTransmissionGuaTi,
  REGISTERED_LIUREN_GUA_TI_COUNT,
} from './helpers/transmission';
export type {
  LiurenCounterEvidenceFact,
  LiurenCounterSummaryFact,
  LiurenEvidenceAnalysis,
  LiurenFocusFact,
  LiurenFocusSummaryFact,
  LiurenLessonEvidence,
  LiurenRelationEvidenceFact,
  LiurenTimingFact,
  LiurenTraditionalFact,
  LiurenTransitionFact,
  LiurenTransmissionEvidence,
  LiurenTransmissionRuleFact,
} from '../../liuren-evidence';
