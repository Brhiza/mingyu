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
    '当前只登记七十七项可复算神煞规则；天合及天赦均为条件性事实，不代表《六壬大全》神煞总目录已经穷尽',
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

  const dayBranchShenShaIndex = DIZHI.findIndex((branch) => branch === dayBranch);
  if (dayBranchShenShaIndex >= 0) {
    const dayBranchShenShaTables = [
      {
        name: '支德',
        targets: ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
        rule: '日支前五支为支德：子巳、丑午、寅未、卯申、辰酉、巳戌、午亥、未子、申丑、酉寅、戌卯、亥辰',
        extraSources: [
          '《六壬大全》卷一“十二地支神煞”支德表',
          '《六壬粹言》“德庆课”支前五位为支德',
        ],
      },
      {
        name: '支仪',
        targets: ['午', '巳', '辰', '卯', '寅', '丑', '未', '申', '酉', '戌', '亥', '子'],
        rule: '子日午起逆行至巳日丑，午日未起顺行至亥日子',
        extraSources: ['《六壬大全》卷一“十二地支神煞”支仪表与“六仪课”'],
      },
      {
        name: '支破',
        targets: ['酉', '辰', '亥', '午', '丑', '申', '卯', '戌', '巳', '子', '未', '寅'],
        rule: '日支属阳则退三位，属阴则进三位：子酉、丑辰、寅亥、卯午、辰丑、巳申、午卯、未戌、申巳、酉子、戌未、亥寅',
        extraSources: [
          '《六壬大全》卷一“十二地支神煞”支破表',
          '《六壬粹言》“冲破格”阳日后三辰、阴日前三辰',
        ],
      },
      {
        name: '支破碎',
        targets: ['巳', '丑', '酉', '巳', '丑', '酉', '巳', '丑', '酉', '巳', '丑', '酉'],
        rule: '日支四孟在酉、四仲在巳、四季在丑',
        extraSources: ['《六壬大全》卷一“十二地支神煞”金神表'],
        extraLimitations: [
          '《大六壬神煞指南》表作“破碎”，《六壬大全》同一日支表作“金神”；本结果加“支”字，避免与逐月“破碎”重名',
        ],
      },
      {
        name: '勾神',
        targets: ['卯', '戌', '巳', '子', '未', '寅', '酉', '辰', '亥', '午', '丑', '申'],
        rule: '阳支日从卯起隔支顺行六阴支，阴支日从戌起隔支顺行六阳支',
        extraSources: ['《六壬粹言》勾神起法'],
      },
      {
        name: '绞神',
        targets: ['酉', '辰', '亥', '午', '丑', '申', '卯', '戌', '巳', '子', '未', '寅'],
        rule: '勾神对冲为绞神',
        extraSources: ['《六壬粹言》“勾神对宫为绞神”'],
        extraLimitations: ['绞神与支破同支，但名称与起法层级不同，不合并为一项'],
      },
      {
        name: '四煞',
        targets: ['未', '辰', '丑', '戌', '未', '辰', '丑', '戌', '未', '辰', '丑', '戌'],
        rule: '申子辰日未、巳酉丑日辰、寅午戌日丑、亥卯未日戌',
        extraSources: ['《六壬大全》“金神四煞占来凶”注'],
      },
      {
        name: '支亡',
        targets: ['亥', '申', '巳', '寅', '亥', '申', '巳', '寅', '亥', '申', '巳', '寅'],
        rule: '申子辰日亥、巳酉丑日申、寅午戌日巳、亥卯未日寅',
        extraLimitations: ['本项以日支起，名称用“支亡”以区别月建所起的“亡神”'],
      },
      {
        name: '支死神',
        targets: ['卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅'],
        rule: '死神从子日卯起顺行十二支',
        extraLimitations: [
          '本项以日支起，名称用“支死神”以区别正月巳起顺行十二月的逐月死神及五行生旺死绝所称死神',
        ],
      },
      {
        name: '支病符',
        targets: ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
        rule: '病符从子日亥起顺行十二支',
        extraLimitations: ['本项以日支起，名称用“支病符”以区别以旧太岁定位的岁煞病符'],
      },
      {
        name: '支雷电',
        targets: ['辰', '辰', '未', '未', '戌', '戌', '丑', '丑', '寅', '寅', '卯', '卯'],
        rule: '子丑日辰、寅卯日未、辰巳日戌、午未日丑、申酉日寅、戌亥日卯',
        extraLimitations: [
          '只登记日支表中的雷电位置，不代替结合螣蛇、朱雀、卯、丁等盘面条件的天时判断，也不得据此直接断现实雷电',
        ],
      },
      {
        name: '支雨师',
        targets: ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
        rule: '雨师从子日申起顺行十二支，以“申为水母”为起点依据',
        extraLimitations: [
          '只登记日支表中的雨师位置，不混入按月三轮雨师或固定丑会毕宿的天时口径，也不得据此直接断现实降雨',
        ],
      },
      {
        name: '支晴朗',
        targets: ['午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳'],
        rule: '晴朗从子日午起顺行十二支，取后天离宫午为起点',
        extraLimitations: [
          '只登记日支表中的晴朗位置，不代替天空加四季等天时判断，也不得据此直接断现实天气晴朗',
        ],
      },
      {
        name: '白衣翰林',
        targets: ['酉', '未', '巳', '卯', '丑', '亥', '酉', '未', '巳', '卯', '丑', '亥'],
        rule: '白衣从子日酉起，每日逆行二支：子午酉、丑未未、寅申巳、卯酉卯、辰戌丑、巳亥亥',
        extraLimitations: [
          '当前只据《六壬指南注解》所载固定表与“白衣入翰林”起法登记，尚无第二底本交叉印证',
        ],
      },
    ] as const;
    const source = '《六壬指南注解》卷四《大六壬神煞指南》“支煞”表与歌诀';

    for (const table of dayBranchShenShaTables) {
      addFact({
        name: table.name,
        target: table.targets[dayBranchShenShaIndex],
        targetType: '地支',
        category: '十二地支神煞',
        basis: '日支',
        input: dayBranch,
        rule: table.rule,
        source,
        extraSources: 'extraSources' in table ? [...table.extraSources] : [],
        extraLimitations: 'extraLimitations' in table ? [...table.extraLimitations] : [],
      });
    }
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

  const stemCombinationMap: Record<string, string> = {
    甲: '己',
    己: '甲',
    乙: '庚',
    庚: '乙',
    丙: '辛',
    辛: '丙',
    丁: '壬',
    壬: '丁',
    戊: '癸',
    癸: '戊',
  };
  const tianHeMarker = tianDeMarker ? stemCombinationMap[tianDeMarker] : undefined;
  if (tianHeMarker) {
    const tianHe = getDayStemResidence(tianHeMarker);
    addFact({
      name: '天合',
      target: tianHe,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: `天德${tianDeMarker}取五合${tianHeMarker}，依十干寄宫落${tianHe}`,
      source: '《六壬指南注解》卷四“月煞”天合表与“天德合干神五合”起法',
      extraLimitations: ['天德落申、亥、寅、巳四个地支的月份没有天合表值，本结果不补造目标'],
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

    const yueHeMarker = stemCombinationMap[yueDeMarker];
    const yueHe = getDayStemResidence(yueHeMarker);
    addFact({
      name: '月合',
      target: yueHe,
      targetType: '地支',
      category: '逐月神煞',
      basis: '月建',
      input: monthBranch,
      rule: `月德${yueDeMarker}取五合${yueHeMarker}，依十干寄宫落${yueHe}`,
      source: '《六壬指南注解》卷四“月煞”月合表与“月德合干神五合”起法',
      extraSources: ['《六壬大全》卷一“逐月神煞”月合表'],
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

  const monthShenShaOrder = [
    '寅',
    '卯',
    '辰',
    '巳',
    '午',
    '未',
    '申',
    '酉',
    '戌',
    '亥',
    '子',
    '丑',
  ];
  const monthShenShaIndex = monthShenShaOrder.indexOf(monthBranch);
  if (monthShenShaIndex >= 0) {
    const monthShenShaTables = [
      {
        name: '会神',
        targets: ['未', '戌', '寅', '亥', '酉', '子', '丑', '午', '巳', '卯', '申', '辰'],
        rule: '正月至十二月依次取未、戌、寅、亥、酉、子、丑、午、巳、卯、申、辰',
        source: '《六壬指南注解》卷四“月煞”会神表与歌诀',
        extraSources: ['《六壬大全》卷一“逐月神煞”会神表', '《六壬粹言》“趋谒”会神十二月表'],
      },
      {
        name: '信神',
        targets: ['申', '戌', '寅', '丑', '亥', '辰', '巳', '未', '巳', '未', '申', '戌'],
        rule: '正月至十二月依次取申、戌、寅、丑、亥、辰、巳、未、巳、未、申、戌',
        source: '《六壬指南注解》卷四“月煞”信神表与歌诀',
        extraSources: ['《六壬大全》卷一“逐月神煞”信神表'],
        extraLimitations: [
          '《六壬大全》另列酉起顺十二的“信煞”，《六壬粹言》则称该项为“信神”；本结果采用《大六壬神煞指南》固定信神表，不合并两套同名近名规则',
        ],
      },
      {
        name: '游神',
        targets: ['丑', '丑', '丑', '子', '子', '子', '亥', '亥', '亥', '戌', '戌', '戌'],
        rule: '春丑、夏子、秋亥、冬戌',
        source: '《六壬指南注解》卷四“月煞”游神表',
        extraSources: ['《六壬大全》卷七正文游神四季表', '《六壬粹言》“行人”游神四季表'],
        extraLimitations: [
          '《六壬大全》卷首简表另见“秋戌冬亥”的次序差异；本结果采用《六壬指南注解》《六壬粹言》及《六壬大全》正文一致的秋亥冬戌版本',
          '只登记游神所在支，不因单项出现自动判断行人已归、将归或不归',
        ],
      },
      {
        name: '戏神',
        targets: ['巳', '巳', '巳', '子', '子', '子', '酉', '酉', '酉', '辰', '辰', '辰'],
        rule: '春巳、夏子、秋酉、冬辰',
        source: '《六壬指南注解》卷四“月煞”戏神表',
        extraSources: ['《六壬大全》卷一“逐月神煞”戏神表', '《六壬粹言》“行人”戏神四季表'],
        extraLimitations: ['只登记戏神所在支，不因单项出现自动判断亲友或行人到达时间'],
      },
      {
        name: '天解',
        targets: ['申', '未', '午', '巳', '辰', '卯', '寅', '丑', '子', '亥', '戌', '酉'],
        rule: '正月从申起逐月逆行一支',
        source: '《六壬指南注解》卷四《大六壬神煞指南》“天解正申逆十二”',
        extraSources: ['《六壬粹言》“论讼”天解申逆十二'],
        extraLimitations: [
          '《六壬大全》卷首另列申、戌、子、寅、辰、午重复两轮的天解表；本结果采用《六壬指南注解》《六壬粹言》一致的申起逐月逆行版本，不合并两表',
          '只登记天解所在支，不因单项出现自动判断灾祸或诉讼已经解除',
        ],
      },
      {
        name: '解神',
        targets: ['申', '申', '酉', '酉', '戌', '戌', '亥', '亥', '午', '午', '未', '未'],
        rule: '正二月申、三四月酉、五六月戌、七八月亥、九十月午、冬腊月未',
        source: '《六壬大全》卷一“逐月神煞”解神表',
        extraSources: [
          '《六壬心镜》“论讼”解神十二月表',
          '《六壬秘本》解神正二申、三四酉、五六戌、七八亥、九十午、十一十二未',
        ],
        extraLimitations: [
          '《六壬指南注解》表中把本组数值题作“地解”，另列申申戌戌子子寅寅辰辰午午为“解神”；本结果采用《六壬大全》《六壬心镜》及《六壬秘本》一致的解神主版本，不另生成地解',
          '《六壬秘本》另处又见九十月子、冬腊月丑的异表；本结果不混合该版本',
          '只登记解神所在支，不因单项出现自动判断囚禁、疾病或其他现实事项已经解除',
        ],
      },
      {
        name: '飞祸',
        targets: ['申', '申', '申', '寅', '寅', '寅', '巳', '巳', '巳', '亥', '亥', '亥'],
        rule: '春申、夏寅、秋巳、冬亥',
        source: '《六壬指南注解》卷四《大六壬神煞指南》四时飞祸表与歌诀',
        extraSources: [
          '《六壬大全》卷一与卷七飞祸四时表',
          '《六壬秘本》飞祸春申、夏寅、秋巳、冬亥',
        ],
        extraLimitations: ['只登记飞祸所在支，不因单项出现自动判断灾祸、出行或求事结果'],
      },
      {
        name: '奸神',
        targets: ['寅', '寅', '寅', '亥', '亥', '亥', '申', '申', '申', '巳', '巳', '巳'],
        rule: '春寅、夏亥、秋申、冬巳',
        source: '《六壬指南注解》卷四《大六壬神煞指南》四时奸神表与歌诀',
        extraSources: ['《六壬大全》卷一与卷七奸神四时表'],
        extraLimitations: ['只登记奸神所在支，不因单项出现自动判断奸私、婚恋或诉讼事实'],
      },
      {
        name: '时盗',
        targets: ['巳', '巳', '巳', '卯', '卯', '卯', '酉', '酉', '酉', '子', '子', '子'],
        rule: '春巳、夏卯、秋酉、冬子',
        source: '《六壬指南注解》卷四《大六壬神煞指南》四时时盗表与歌诀',
        extraSources: ['《六壬大全》卷一“逐月神煞”时盗四时表'],
        extraLimitations: ['只登记时盗所在支，不因单项出现自动判断盗窃已经发生或必将发生'],
      },
      {
        name: '归忌',
        targets: ['丑', '寅', '子', '丑', '寅', '子', '丑', '寅', '子', '丑', '寅', '子'],
        rule: '正月丑、二月寅、三月子，每三月循环',
        source: '《六壬指南注解》卷四《大六壬神煞指南》归忌表与歌诀',
        extraSources: ['《六壬大全》兵占“归忌日凶”三月循环表', '《六壬兵占》归忌三月循环表'],
        extraLimitations: ['只登记归忌所在支，不因单项出现自动判断归家、出行或现实后果'],
      },
      {
        name: '飞廉',
        targets: ['戌', '巳', '午', '未', '申', '酉', '辰', '亥', '子', '丑', '寅', '卯'],
        rule: '正月戌、二月巳、三月午、四月未、五月申、六月酉、七月辰、八月亥、九月子、十月丑、冬月寅、腊月卯',
        source: '《六壬指南注解》卷四《大六壬神煞指南》飞廉表与歌诀',
        extraSources: [
          '《六壬大全》兵占飞廉十二月表',
          '《六壬兵占》飞廉十二月表',
          '《六壬括囊赋略疏》飞廉月煞十二月表',
        ],
        extraLimitations: [
          '《六壬心镜》与《六壬秘本》另见五六月寅卯、冬腊月申酉的“大煞”或飞廉表，《六壬秘本》另处又作正申顺十二；本结果采用《六壬指南注解》《六壬大全》《六壬兵占》及《六壬括囊赋略疏》一致的主表',
          '只登记飞廉所在支，不因单项出现自动判断行人、风势、灾祸或事情快慢',
        ],
      },
      {
        name: '往亡',
        targets: ['寅', '巳', '申', '亥', '卯', '午', '酉', '子', '辰', '未', '戌', '丑'],
        rule: '正月寅、二月巳、三月申、四月亥，五月起卯按同步递推',
        source: '《六壬指南注解》卷四《大六壬神煞指南》往亡表与歌诀',
        extraSources: [
          '《六壬大全》卷一与兵占往亡十二月表',
          '《六壬心镜》兵占往亡十二月注',
          '《六壬兵占》往亡十二月表',
        ],
        extraLimitations: ['只登记往亡所在支，不因单项出现自动判断出行、婚嫁、军事或人身后果'],
      },
      {
        name: '月刑',
        targets: ['巳', '子', '辰', '申', '午', '丑', '寅', '酉', '未', '亥', '卯', '戌'],
        rule: '按月建所刑之支：寅巳、卯子、辰辰、巳申、午午、未丑、申寅、酉酉、戌未、亥亥、子卯、丑戌',
        source: '《六壬指南注解》卷四《大六壬神煞指南》月刑歌诀',
        extraSources: ['《六壬大全》卷一“逐月神煞”月刑十二月表'],
        extraLimitations: [
          '只登记月建所刑的支，不因单项出现自动判断产婚、官讼、疾病或其他现实后果',
        ],
      },
      {
        name: '天车',
        targets: ['巳', '巳', '巳', '辰', '辰', '辰', '未', '未', '未', '酉', '酉', '酉'],
        rule: '春巳、夏辰、秋未、冬酉',
        source: '《六壬指南注解》卷四《大六壬神煞指南》天车表、歌诀与“神煞辨讹”',
        extraSources: ['《六壬心镜》“若值天车来入课”四时表'],
        extraLimitations: [
          '《六壬大全》《六壬秘本》把春丑、夏辰、秋未、冬戌表题作天车；《六壬心镜》与《大六壬神煞指南》明确将该表分属关锁，本结果不混合两神',
          '只登记天车所在支，不因单项出现自动判断出行、车马或交通后果',
        ],
      },
      {
        name: '关锁',
        targets: ['丑', '丑', '丑', '辰', '辰', '辰', '未', '未', '未', '戌', '戌', '戌'],
        rule: '春丑、夏辰、秋未、冬戌',
        source: '《六壬心镜》关锁神四时表',
        extraSources: [
          '《六壬指南注解》卷四“神煞辨讹”关锁四时表',
          '《六壬大全》卷七关神四时表',
          '《六壬粹言》与《六壬秘本》关神四时表',
        ],
        extraLimitations: [
          '《六壬大全》《六壬粹言》《六壬秘本》多称“关神”；本结果采用《六壬心镜》与《大六壬神煞指南》用名“关锁”，以与天车分层',
          '只登记关锁所在支，不因单项出现自动判断囚系、讼狱、行止或其他现实后果',
        ],
      },
      {
        name: '五鬼',
        targets: ['午', '辰', '寅', '酉', '卯', '申', '丑', '巳', '子', '亥', '未', '戌'],
        rule: '正月至十二月依次取午、辰、寅、酉、卯、申、丑、巳、子、亥、未、戌',
        source: '《六壬指南注解》卷四“五鬼”十二月表与歌诀',
        extraSources: ['《六壬存验》五鬼十二月表', '《六壬大全》卷一“月鬼”十二月表'],
        extraLimitations: [
          '《六壬大全》称本项为“月鬼”，表值与五鬼相同；本结果采用“五鬼”主名，不重复生成月鬼事实',
          '只登记五鬼所在支，不因单项出现自动判断盗贼、疾病、死亡或其他现实后果',
        ],
      },
      {
        name: '天鬼',
        targets: ['酉', '午', '卯', '子', '酉', '午', '卯', '子', '酉', '午', '卯', '子'],
        rule: '正月酉、二月午、三月卯、四月子，每四月循环',
        source: '《六壬指南注解》卷四“天鬼”正酉逆四仲表与伏殃条件',
        extraSources: [
          '《六壬心镜》“天鬼一名伏殃”十二月表',
          '《六壬大全》卷一“天鬼”表及卷七“伏殃即天鬼”说明',
          '《六壬存验》《六壬粹言》《六壬秘本》《六壬断案》天鬼十二月表',
        ],
        extraLimitations: [
          '“伏殃”是天鬼临年命、日辰或发用等条件成立后的课体称谓；本结果只登记天鬼所在支，不无条件生成伏殃事实',
          '《六壬括囊赋略疏》一处把三七冬、四八腊写作子、卯，与其余多书一致的卯、子次序不同；本结果保存该异文边界，不混合两表',
          '只登记天鬼所在支，不因单项出现自动判断疾病、灾殃或其他现实后果',
        ],
      },
      {
        name: '生气',
        targets: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'],
        rule: '正月从子起逐月顺行一支',
        source: '《六壬指南注解》卷四“生气正子顺行十二”',
        extraSources: [
          '《六壬大全》卷一生气表及卷七生气、死气对冲说明',
          '《六壬秘本》生气正子顺行十二',
        ],
        extraLimitations: [
          '只登记生气所在支，不因单项出现自动判断事情成就、怀孕、疾病、吉凶或其他现实结果',
        ],
      },
      {
        name: '死气',
        targets: ['午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳'],
        rule: '正月从午起逐月顺行一支，与生气逐月对冲',
        source: '《六壬指南注解》卷四“死气正午顺行十二”',
        extraSources: [
          '《六壬大全》卷一死气表及卷七生气、死气对冲说明',
          '《六壬秘本》死气正午顺行十二',
        ],
        extraLimitations: [
          '只登记死气所在支，不因单项出现自动判断事情不成、疾病、死亡、吉凶或其他现实结果',
        ],
      },
      {
        name: '死神',
        targets: ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
        rule: '正月从巳起逐月顺行一支',
        source: '《六壬指南注解》卷四“死神正巳顺行十二”表与歌诀',
        extraSources: [
          '《六壬大全》卷一死神十二月表',
          '《六壬秘本》死神正月起巳顺行十二支',
          '《六壬指南》死神正巳顺十二',
        ],
        extraLimitations: [
          '本项是依据月建定位的逐月死神，与依据日支定位的“支死神”分层登记，不混合两套规则',
          '只登记死神所在支，不因单项出现自动判断死亡、疾病、丧事或其他现实后果',
        ],
      },
      {
        name: '天喜',
        targets: ['戌', '戌', '戌', '丑', '丑', '丑', '辰', '辰', '辰', '未', '未', '未'],
        rule: '春戌、夏丑、秋辰、冬未',
        source: '《六壬指南注解》卷四“神煞辨讹”天喜四季养神表',
        extraSources: [
          '《六壬大全》卷一“逐月神煞”天喜四时表',
          '《六壬心镜》天喜春戌、夏丑、秋辰、冬未',
          '《六壬粹言》《六壬秘本》天喜四时表',
        ],
        extraLimitations: [
          '《六壬粹言》一处称“天耳即天喜”，但天耳另有多套起法；本结果只登记天喜，不重复生成天耳事实',
          '只登记天喜所在支，不因单项出现自动判断婚姻、生产、升迁、喜庆或其他现实结果',
        ],
      },
      {
        name: '成神',
        targets: ['巳', '巳', '巳', '申', '申', '申', '亥', '亥', '亥', '寅', '寅', '寅'],
        rule: '春巳、夏申、秋亥、冬寅，即正月从巳起顺四孟',
        source: '《六壬指南》“成神正巳顺四孟”',
        extraSources: [
          '《六壬大全》卷一“成神巳申亥寅三轮”',
          '《六壬秘本》成神正巳顺轮四孟',
          '《六壬粹言》成神巳申亥寅三轮',
        ],
        extraLimitations: [
          '原典判断事情能否成就还须结合旺相、生合、吉将、课传及占类；本结果只登记成神所在支',
          '不因单项出现自动判断谋望、婚姻、财产或其他现实事项必成',
        ],
      },
      {
        name: '浴盆',
        targets: ['辰', '辰', '辰', '未', '未', '未', '戌', '戌', '戌', '丑', '丑', '丑'],
        rule: '春辰、夏未、秋戌、冬丑',
        source: '《六壬指南注解》卷四“月煞”浴盆四时表',
        extraSources: [
          '《六壬粹言》浴盆春辰、夏未、秋戌、冬丑',
          '《六壬秘本》浴盆四时表',
          '《六壬大全》卷七浴盆四时表',
        ],
        extraLimitations: [
          '原典所述产育、小儿病或溺水等判断还要求地盘亥子、天后、玄武、白虎等组合；本结果只登记浴盆所在支',
          '不因单项出现自动判断生产、疾病、溺水、死亡或其他现实后果',
        ],
      },
      {
        name: '丧魄',
        targets: ['未', '辰', '丑', '戌', '未', '辰', '丑', '戌', '未', '辰', '丑', '戌'],
        rule: '正月未、二月辰、三月丑、四月戌，每四月循环，即正未逆四季',
        source: '《六壬指南》“丧魄正未逆四季”',
        extraSources: [
          '《六壬大全》卷一与卷七丧魄未辰丑戌循环表',
          '《六壬秘本》《六壬粹言》丧魄正未逆四季表',
          '《六壬灵觉经》丧魄正未逆四季及成课条件',
        ],
        extraLimitations: [
          '《六壬大全》另称本项为“丧魂”或“丧车”，《六壬灵觉经》一处又称“丧门”；本结果采用丧魄主名，不与岁前二辰的丧门岁煞混合或重复生成',
          '临年命、日辰或发用等条件成立后才称丧魄课；本结果只登记丧魄所在支，不无条件生成课体',
          '“魄化”另有白虎乘死神等组合条件，不与丧魄混同',
          '不因单项出现自动判断疾病、衰弱、丧事、死亡或其他现实后果',
        ],
      },
      {
        name: '游魂',
        targets: ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
        rule: '正月从亥起逐月顺行一支',
        source: '《六壬心镜》飞魂卦“顺行正月起登明”',
        extraSources: [
          '《六壬大全》卷一与卷七游魂正亥顺十二',
          '《六壬秘本》《六壬粹言》飞魂正亥顺十二',
          '《六壬灵觉经》游魂正亥顺十二及飞魂课条件',
        ],
        extraLimitations: [
          '《六壬指南》及其注解写“飞魂正亥逆十二”，与《六壬心镜》《六壬大全》《六壬秘本》《六壬粹言》《六壬灵觉经》的顺行主版本冲突；本结果采用多书一致的正亥顺十二，并保存该异文边界',
          '“飞魂”可作游魂异名，也可指游魂临年命、日辰或发用等条件成立后的课体；本结果只登记游魂位置，不重复生成飞魂事实或无条件生成课体',
          '不因单项出现自动判断鬼祟、梦境、疾病、死亡或其他现实后果',
        ],
      },
      {
        name: '圣心',
        targets: ['亥', '巳', '子', '午', '丑', '未', '寅', '申', '卯', '酉', '辰', '戌'],
        rule: '正月亥起，单月顺行一支，双月取前一单月所临支的冲位',
        source: '《六壬指南注解》卷四“圣心正月起亥宫，单月顺行双月冲”',
        extraSources: [
          '《六壬大全》卷一圣心十二月表及逐月神煞分列',
          '《六壬指南注解》卷四“神煞全图”圣心正月加亥',
        ],
        extraLimitations: [
          '《六壬大全》总表第二位“巳”被识作“己”，但其二月逐月分列为巳，且与《六壬指南注解》完整表一致；本结果按巳记录并保存该文字边界',
          '只登记圣心所在支，不因单项出现自动判断和合、财富、经营、婚姻或其他现实结果',
        ],
      },
      {
        name: '受死',
        targets: ['戌', '辰', '亥', '巳', '子', '午', '丑', '未', '寅', '申', '卯', '酉'],
        rule: '正月戌、二月辰、三月亥、四月巳、五月子、六月午、七月丑、八月未、九月寅、十月申、十一月卯、十二月酉',
        source: '《六壬大全》卷一及卷七“受死日”十二月表',
        extraSources: ['《六壬指南注解》卷四“月煞”受死十二月表', '《六壬兵占》受死日十二月表'],
        extraLimitations: [
          '原典题作“受死日”，本结果只依月建登记受死所临支；还须核对日支等实际落点，不因本事实存在便断当前日已经命中',
          '不因单项出现自动判断一切大凶、死亡、疾病、出行、军事或其他现实后果',
        ],
      },
      {
        name: '罪至',
        targets: ['午', '子', '未', '丑', '申', '寅', '酉', '卯', '戌', '辰', '亥', '巳'],
        rule: '正月午、二月子、三月未、四月丑、五月申、六月寅、七月酉、八月卯、九月戌、十月辰、十一月亥、十二月巳',
        source: '《六壬大全》卷七“罪至日”十二月表',
        extraSources: ['《六壬兵占》罪至日十二月表', '《六壬指南注解》卷四“月煞”罪至十二月表'],
        extraLimitations: [
          '《六壬指南注解》表中十月“辰”被识作“胡”，《六壬大全》《六壬兵占》均明确作辰；本结果按辰记录并保存该文字边界',
          '原典题作“罪至日”，本结果只依月建登记罪至所临支；还须核对日支等实际落点，不因本事实存在便断当前日已经命中',
          '不因单项出现自动判断诉讼、罪责、凶险或其他现实后果',
        ],
      },
      {
        name: '血忌',
        targets: ['丑', '未', '寅', '申', '卯', '酉', '辰', '戌', '巳', '亥', '午', '子'],
        rule: '正月丑起，单月顺行一支，双月取前一单月所临支的冲位',
        source: '《六壬大全》卷七血忌十二月表',
        extraSources: [
          '《六壬指南注解》卷四“月煞”血忌十二月表',
          '《六壬心镜》血忌十二月表',
          '《六壬秘本》血忌十二月表',
        ],
        extraLimitations: [
          '血支是正月丑起逐月顺行十二支的另一项神煞，起法与血忌不同；本结果只登记血忌，不把血支作为异名或重复事实生成',
          '《六壬指南注解》一则五月占案把巳误题为血忌，注者明确指出应为血支；五月血忌仍按卯记录并保存该误标边界',
          '原典所述针灸、失血、胎产或血光等判断还须结合胎神、养神、蛇虎、刑煞、日辰、年命等条件；本结果只登记血忌所在支',
          '不因单项出现自动判断疾病、失血、胎产、针灸禁忌或其他现实后果',
        ],
      },
    ] as const;

    for (const table of monthShenShaTables) {
      addFact({
        name: table.name,
        target: table.targets[monthShenShaIndex],
        targetType: '地支',
        category: '逐月神煞',
        basis: '月建',
        input: monthBranch,
        rule: table.rule,
        source: table.source,
        extraSources: [...table.extraSources],
        extraLimitations: 'extraLimitations' in table ? [...table.extraLimitations] : [],
      });
    }

    const tianSheDay =
      monthShenShaIndex <= 2
        ? '戊寅'
        : monthShenShaIndex <= 5
          ? '甲午'
          : monthShenShaIndex <= 8
            ? '戊申'
            : '甲子';
    const dayGanzhi = `${dayStem}${dayBranch}`;
    if (dayGanzhi === tianSheDay) {
      addFact({
        name: '天赦',
        target: dayBranch,
        targetType: '地支',
        category: '四时神煞',
        basis: '月建与日柱',
        input: `${monthBranch}月${dayGanzhi}日`,
        rule: '春戊寅日、夏甲午日、秋戊申日、冬甲子日才成立',
        source: '《六壬指南注解》卷四《大六壬神煞指南》天赦四时日柱歌诀',
        extraSources: [
          '《六壬大全》卷一与卷七天赦四时日柱规则',
          '《六壬存验》天赦春戊寅、夏甲午、秋戊申、冬甲子',
          '《六壬粹言》“仕宦门”与“论讼”天赦日柱说明',
        ],
        extraLimitations: [
          '天赦须季节与完整日柱同时符合；只见寅、午、申、子日支或神盘上出现该支均不足以成立',
          '只登记天赦条件成立，不因单项出现自动判断刑禁、灾祸或诉讼已经解除',
        ],
      });
    }
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

    const guideDayStemShenShaTables = [
      {
        name: '日合',
        targets: ['未', '申', '戌', '亥', '丑', '寅', '辰', '巳', '未', '巳'],
        rule: '取与日干五合之干所寄宫：甲未、乙申、丙戌、丁亥、戊丑、己寅、庚辰、辛巳、壬未、癸巳',
        extraSources: ['《六壬大全》别责课“刚日取干合上神”及日合用例'],
        extraLimitations: [
          '《大六壬神煞指南》表作“合”、正文作“干合”；本结果用《六壬大全》正文通称“日合”，均指日干五合之干的寄宫',
        ],
      },
      {
        name: '长生',
        targets: ['亥', '亥', '寅', '寅', '申', '申', '巳', '巳', '申', '申'],
        rule: '六壬按五行长生有顺无逆：甲乙木亥、丙丁火寅、戊己土申、庚辛金巳、壬癸水申',
        extraLimitations: [
          '采用《大六壬神煞指南》庄氏所定五行长生、有顺无逆的六壬口径，不采用命理十干阴阳顺逆长生法',
        ],
      },
      {
        name: '恩赦',
        targets: ['寅', '辰', '巳', '未', '巳', '未', '申', '戌', '亥', '丑'],
        rule: '甲寅、乙辰、丙巳、丁未、戊巳、己未、庚申、辛戌、壬亥、癸丑',
      },
      {
        name: '贤贵',
        targets: ['丑', '申', '寅', '寅', '午', '丑', '申', '寅', '寅', '午'],
        rule: '甲丑、乙申、丙寅、丁寅、戊午，己至癸同甲至戊',
      },
      {
        name: '文星',
        targets: ['亥', '亥', '寅', '寅', '午', '午', '巳', '巳', '申', '申'],
        rule: '甲乙亥、丙丁寅、戊己午、庚辛巳、壬癸申',
      },
      {
        name: '日奸',
        targets: ['亥', '酉', '辰', '申', '巳', '亥', '酉', '辰', '申', '巳'],
        rule: '甲亥、乙酉、丙辰、丁申、戊巳，己至癸同甲至戊',
      },
      {
        name: '日淫',
        targets: ['午', '午', '未', '未', '戌', '戌', '寅', '寅', '巳', '巳'],
        rule: '甲乙午、丙丁未、戊己戌、庚辛寅、壬癸巳',
      },
    ] as const;

    for (const table of guideDayStemShenShaTables) {
      addFact({
        name: table.name,
        target: table.targets[dayStemIndex],
        targetType: '地支',
        category: '十天干神煞',
        basis: '日干',
        input: dayStem,
        rule: table.rule,
        source,
        extraSources: 'extraSources' in table ? [...table.extraSources] : [],
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
