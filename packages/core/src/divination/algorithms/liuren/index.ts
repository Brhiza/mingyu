import type { LiurenData, LiurenShenShaFact, LiurenTransmission } from '../../../types/divination';
import { getDivinationTime } from '../../../calendar/timeManager';
import { getVoidBranches } from '../../../calendar/lunar';
import { SolarTerm, SolarTime } from 'tyme4ts';
import { getBranchWuxing, getOppositeBranch, getSeasonState, getYiMa } from '../../../ganzhi';
import {
  buildHeavenlyPlate,
  DIZHI,
  getDayStemResidence,
  getNoblemanBranch,
  getPlateItemByBranch,
  getUnderByUpper,
  getUpperByUnder,
  LIUREN_DAYTIME_BRANCHES,
  LIUREN_MONTH_LEADER_BY_ZHONGQI,
  TIANGAN,
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
import { analyzeLiurenEvidence } from '../../liuren-evidence';

/**
 * 按《六壬大全》《六壬粹言》分层计算当前已登记、无需本命资料即可确定的月煞和日煞。
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
    '当前只登记二十四项可复算神煞，不代表《六壬大全》神煞总目录已经穷尽',
  ];
  const addFact = (
    fact: Omit<LiurenShenShaFact, 'sources' | 'limitations'> & {
      source: string;
      extraSources?: string[];
      extraLimitations?: string[];
    },
  ) => {
    const { source, extraSources = [], extraLimitations = [], ...rest } = fact;
    facts.push({
      ...rest,
      sources: [source, ...extraSources],
      limitations: [...commonLimitations, ...extraLimitations],
    });
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

  const dayStemResidence = getDayStemResidence(dayStem);
  const dayStemResidenceIndex = DIZHI.findIndex((branch) => branch === dayStemResidence);
  const dayBranchIndex = DIZHI.findIndex((branch) => branch === dayBranch);
  if (dayStemResidenceIndex >= 0 && dayBranchIndex >= 0) {
    const tianLuo = DIZHI[(dayStemResidenceIndex + 1) % DIZHI.length];
    const diWang = DIZHI[(dayBranchIndex + 1) % DIZHI.length];
    const variantLimitation =
      '《六壬大全》卷七《订讹》另载地网取天罗对冲的异说；本结果采用《六壬粹言》干前、支前主版本';
    addFact({
      name: '天罗',
      target: tianLuo,
      targetType: '地支',
      category: '罗网神煞',
      basis: '日干',
      input: dayStem,
      rule: '日干寄宫前一支为天罗',
      source: '《六壬粹言》“所谋多拙逢罗网”注：干前一位为天罗',
      extraSources: ['《六壬大全》卷首“十天干神煞”天罗表'],
      extraLimitations: [variantLimitation],
    });
    addFact({
      name: '地网',
      target: diWang,
      targetType: '地支',
      category: '罗网神煞',
      basis: '日支',
      input: dayBranch,
      rule: '日支前一支为地网',
      source: '《六壬粹言》“所谋多拙逢罗网”注：支前一位为地网',
      extraSources: ['《六壬大全》卷七《订讹》所载罗网异说'],
      extraLimitations: [variantLimitation],
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
  const tianDeMarker = tianDeMap[monthBranch];
  if (tianDeMarker) {
    const tianDe = DIZHI.includes(tianDeMarker as (typeof DIZHI)[number])
      ? tianDeMarker
      : getDayStemResidence(tianDeMarker);
    addFact({
      name: '天德',
      target: tianDe,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: `按十二月天德表取${tianDeMarker}${tianDeMarker === tianDe ? '' : `，依十干寄宫落${tianDe}`}`,
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
  const yueDeMarker = yueDeMap[monthBranch];
  if (yueDeMarker) {
    const yueDe = getDayStemResidence(yueDeMarker);
    addFact({
      name: '月德',
      target: yueDe,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: `寅午戌月丙、申子辰月壬、亥卯未月甲、巳酉丑月庚；${yueDeMarker}依十干寄宫落${yueDe}`,
      source: '《六壬大全》卷首“逐月神煞”表与卷七“德庆课”',
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

  const dayStemIndex = TIANGAN.findIndex((stem) => stem === dayStem);
  if (dayStemIndex >= 0) {
    const dayStemShenShaTables = [
      {
        name: '干奇',
        targets: ['午', '巳', '辰', '卯', '寅', '丑', '未', '申', '酉', '戌'],
        rule: '甲日午起逆行至己日丑，庚日未起顺行至癸日戌',
        extraLimitations: [
          '《六壬大全》卷首表作“仪神”；本结果依《大六壬神煞指南》定名“干奇”，两名指同一十干表',
        ],
      },
      {
        name: '日解',
        targets: ['亥', '申', '未', '丑', '酉', '亥', '申', '未', '丑', '酉'],
        rule: '甲亥、乙申、丙未、丁丑、戊酉，己至癸同甲至戊',
        extraLimitations: [
          '《六壬大全》卷首同表值的末项表头缺字；本结果依《大六壬神煞指南》定名“日解”',
        ],
      },
      {
        name: '日医',
        targets: ['卯', '亥', '丑', '未', '巳', '卯', '亥', '丑', '未', '巳'],
        rule: '甲卯、乙亥、丙丑、丁未、戊巳，己至癸同甲至戊',
      },
      {
        name: '福星',
        targets: ['子', '丑', '子', '子', '未', '未', '丑', '丑', '巳', '巳'],
        rule: '甲子、乙丑、丙子、丁子、戊未、己未、庚丑、辛丑、壬巳、癸巳',
      },
      {
        name: '飞符',
        targets: ['巳', '辰', '卯', '寅', '丑', '午', '未', '申', '酉', '戌'],
        rule: '甲日巳起逆行至戊日丑，己日午起顺行至癸日戌',
        extraLimitations: [
          '《六壬大全》卷首表作“直符”；本结果依《大六壬神煞指南》定名“飞符”，两名指同一十干表',
        ],
      },
      {
        name: '羊刃',
        targets: ['卯', '辰', '午', '未', '午', '未', '酉', '戌', '子', '丑'],
        rule: '日禄前一支为羊刃：甲卯、乙辰、丙午、丁未、戊午、己未、庚酉、辛戌、壬子、癸丑',
      },
      {
        name: '游都',
        targets: ['丑', '子', '寅', '巳', '申', '丑', '子', '寅', '巳', '申'],
        rule: '甲己丑、乙庚子、丙辛寅、丁壬巳、戊癸申',
      },
      {
        name: '日贼',
        targets: ['辰', '午', '申', '亥', '寅', '辰', '午', '申', '亥', '寅'],
        rule: '甲辰、乙午、丙申、丁亥、戊寅，己至癸同甲至戊',
        extraLimitations: [
          '《六壬大全》卷首表作“天贼”；本结果依《大六壬神煞指南》定名“日贼”，避免与逐月同名项混淆',
        ],
      },
      {
        name: '日盗',
        targets: ['子', '亥', '卯', '申', '巳', '子', '亥', '卯', '申', '巳'],
        rule: '甲子、乙亥、丙卯、丁申、戊巳，己至癸同甲至戊',
        extraLimitations: [
          '《六壬大全》卷首表作“天盗”；本结果依《大六壬神煞指南》定名“日盗”，避免与逐月同名项混淆',
        ],
      },
    ] as const;
    const source = '《六壬指南注解》卷四《大六壬神煞指南》“干煞”表与歌诀';
    const extraSources = ['《六壬大全》卷一“十天干神煞”表'];

    for (const table of dayStemShenShaTables) {
      addFact({
        name: table.name,
        target: table.targets[dayStemIndex],
        targetType: '地支',
        category: '十天干神煞',
        basis: '日干',
        input: dayStem,
        rule: table.rule,
        source,
        extraSources,
        extraLimitations: 'extraLimitations' in table ? [...table.extraLimitations] : [],
      });
    }

    const dayStemFacts = new Map(
      facts
        .filter((fact) => fact.category === '十天干神煞')
        .map((fact) => [fact.name, fact] as const),
    );
    const youDu = dayStemFacts.get('游都')?.target;
    if (youDu) {
      addFact({
        name: '鲁都',
        target: getOppositeBranch(youDu),
        targetType: '地支',
        category: '十天干神煞',
        basis: '日干',
        input: dayStem,
        rule: '游都对冲为鲁都',
        source: '《六壬指南注解》卷四《大六壬神煞指南》“游都冲处鲁都求”',
      });
    }
    const yangRen = dayStemFacts.get('羊刃')?.target;
    if (yangRen) {
      addFact({
        name: '飞刃',
        target: getOppositeBranch(yangRen),
        targetType: '地支',
        category: '十天干神煞',
        basis: '日干',
        input: dayStem,
        rule: '羊刃对冲为飞刃',
        source: '《六壬指南注解》卷四《大六壬神煞指南》“禄前羊刃对飞安”',
      });
    }
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

  const monthLeader = LIUREN_MONTH_LEADER_BY_ZHONGQI[activeZhongqi];
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
        ? ['初传落旬空；空亡有宜有忌，须结合所问事项、类神及出空、填实、冲实等候选条件辨用']
        : ['初传不空不等于现实事件已经发动，仍须结合类神与事项核验'],
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
    `一级发用：初传${firstTransmission.branch}${firstTransmission.isVoid ? '落旬空' : '不空'}；空亡有宜有忌，须结合类神与事项判断，出空、填实、冲实仅作候选触发`,
    `二级三传：${threeTransmissions.map((item) => `${item.stage}${item.branch}（月令${item.seasonState}${item.isVoid ? '、空' : ''}）`).join('→')}`,
    `三级日月：以日支${dayBranch}、月支${ganzhi.month.charAt(1)}对初传和类神的同支、冲合与旺衰作为触发条件`,
    '未选定类神和目标期限时，只登记三传阶段、旺衰及候选触发，不判断确定快慢，也不换算唯一日期',
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

export { analyzeLiurenEvidence, conditionLiurenTraditionalText } from '../../liuren-evidence';
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
