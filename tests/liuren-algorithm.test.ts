import test from 'node:test';
import assert from 'node:assert/strict';

import type { LiurenLesson, LiurenPlateItem } from 'mingyu-core/types';
import {
  analyzeLiurenEvidence,
  generateLiuren,
  rebuildAuditedLiurenData,
} from 'mingyu-core/divination/liuren';
import { getVoidBranches } from '../packages/core/src/calendar/lunar.ts';
import { EARTHLY_BRANCHES } from '../packages/core/src/ganzhi/data.ts';
import {
  getYiMa,
  getSeasonState,
  isSheng,
  LIUCHONG_MAP,
  LIUHAI_MAP,
  LIUHE_MAP,
  LIUPO_MAP,
  SANXING_MAP,
} from '../packages/core/src/ganzhi/relations.ts';
import { assertPromptIsPortableTaskText } from './prompt-assertions';
import {
  getLiurenGuaTiFacts,
  getLiurenBranchPairRelations,
  getLiurenKinship,
  describeTransmissionDayBranchRelation,
  describeTransmissionDayStemRelation,
  describeTransmissionTransition,
  getLiurenTransmissionGuaTi,
  getTransmissionPattern,
  REGISTERED_LIUREN_GUA_TI_COUNT,
} from '../packages/core/src/divination/algorithms/liuren/helpers/transmission.ts';
import {
  buildFourLessons,
  resolveInitialTransmission,
} from '../packages/core/src/divination/algorithms/liuren/helpers/lessons.ts';
import {
  buildHeavenlyPlate,
  getDayStemResidence,
  getGanZhiWuxing,
  getNoblemanBranch,
  getPlateItemByBranch,
  isBranchKe,
  TIANJIANG,
} from '../packages/core/src/divination/algorithms/liuren/helpers/plate.ts';
import { buildShenShaFacts } from '../packages/core/src/divination/algorithms/liuren/helpers/shensha.ts';

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const LIUREN_INTERVAL_GUA_TI_BY_TRANSMISSIONS: Readonly<Record<string, string>> = {
  辰午申: '登三天格',
  午申戌: '出三天格',
  申戌子: '涉三渊格',
  戌子寅: '入三渊格',
  子寅辰: '向阳格',
  寅辰午: '出阳格',
  丑卯巳: '出户格',
  卯巳未: '盈阳格',
  巳未酉: '充盈格',
  未酉亥: '入冥格',
  酉亥丑: '凝阴格',
  亥丑卯: '溟蒙格',
  寅子戌: '冥阴格',
  子戌申: '偃蹇格',
  戌申午: '悖戾格',
  申午辰: '凝阳格',
  午辰寅: '顾祖格',
  辰寅子: '涉疑格',
  丑亥酉: '极阴格',
  亥酉未: '时遁格',
  酉未巳: '励明格',
  未巳卯: '回明格',
  巳卯丑: '转悖格',
  卯丑亥: '断涧格',
};
const LIUREN_GUIDE_CONSECUTIVE_NAME_BY_TRANSMISSIONS: Readonly<Record<string, string>> = {
  亥子丑: '龙潜',
  子丑寅: '含春',
  丑寅卯: '将泰',
  寅卯辰: '正和',
  卯辰巳: '离渐',
  辰巳午: '升阶',
  未申酉: '回春',
  申酉戌: '流金',
  酉戌亥: '革故',
  戌亥子: '隐明',
  亥戌酉: '回阴',
  戌酉申: '返驾',
  酉申未: '出狱',
  午巳辰: '登庸',
  巳辰卯: '正己',
  辰卯寅: '返照',
  卯寅丑: '联芳',
  寅丑子: '游魂',
  丑子亥: '入墓',
  子亥戌: '重阴',
};
const SIXTY_DAYS = Array.from(
  { length: 60 },
  (_, index) => `${TIANGAN[index % 10]}${DIZHI[index % 12]}`,
);
const DAY_LU_BRANCH_BY_STEM: Readonly<Record<string, string>> = {
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
const LIUREN_CUI_YAN_GUA_TI_NAMES = new Set([
  '太阳临身格',
  '太阳射宅格',
  '时用生日格',
  '时用克日格',
  '富贵课',
  '四路驿马格',
  '根断源消格',
  '不入格',
  '传出格',
  '传入格',
]);
const MONTH_BRANCH_BY_LEADER: Readonly<Record<string, string>> = {
  亥: '寅',
  戌: '卯',
  酉: '辰',
  申: '巳',
  未: '午',
  午: '未',
  巳: '申',
  辰: '酉',
  卯: '戌',
  寅: '亥',
  丑: '子',
  子: '丑',
};
const GUIREN_BRANCH_BY_STEM: Record<string, { day: string; night: string }> = {
  甲: { day: '丑', night: '未' },
  戊: { day: '丑', night: '未' },
  庚: { day: '丑', night: '未' },
  乙: { day: '子', night: '申' },
  己: { day: '子', night: '申' },
  丙: { day: '亥', night: '酉' },
  丁: { day: '亥', night: '酉' },
  壬: { day: '巳', night: '卯' },
  癸: { day: '巳', night: '卯' },
  辛: { day: '午', night: '寅' },
};
const FANYIN_PLATE = DIZHI.map((under) => ({
  under,
  branch: LIUCHONG_MAP[under],
  god: '贵人',
})) satisfies LiurenPlateItem[];
const FUYIN_PLATE = DIZHI.map((under) => ({
  under,
  branch: under,
  god: '贵人',
})) satisfies LiurenPlateItem[];

test('大六壬应输出分层取用与应期证据', () => {
  const result = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));

  assert.deepEqual(
    result.focusEvidence?.map((item) => item.level),
    ['主证', '辅证', '辅证'],
  );
  assert.match(result.focusEvidence?.[0]?.role ?? '', /发用主轴/);
  assert.equal(result.timingEvidence?.length, 4);
  assert.match(result.timingEvidence?.join('；') ?? '', /一级发用.*二级三传.*三级日月/);
  const evidence = result.evidenceAnalysis;
  assert.ok(evidence);
  assert.equal(evidence.key, 'liuren:evidence');
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.calculationSteps.length, 7);
  assert.equal(evidence.calculationChain.length, evidence.calculationSteps.length);
  const calculationStepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  assert.ok(
    evidence.calculationSteps.every((item) =>
      item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)),
    ),
  );
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.platePositionFactCount, evidence.platePositionFacts.length);
  assert.equal(evidence.summaryFact.lessonFactCount, evidence.lessons.length);
  assert.equal(evidence.summaryFact.transmissionFactCount, evidence.transmissions.length);
  assert.equal(evidence.summaryFact.transitionFactCount, evidence.transitionFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.summaryFact.timingFactCount, evidence.timingFacts.length);
  assert.equal(evidence.summaryFact.focusFactCount, evidence.focusFacts.length);
  assert.equal(evidence.summaryFact.traditionalFactCount, evidence.traditionalFacts.length);
  assert.equal(evidence.limitationFacts.length, 6);
  assert.deepEqual(
    evidence.limitations,
    evidence.limitationFacts.map((item) => item.promptText),
  );
  const factKeys = new Set([
    evidence.calculationFact.key,
    evidence.foundationConventionFact.key,
    evidence.transmissionConventionFact.key,
    evidence.plateFact.key,
    ...evidence.platePositionFacts.map((item) => item.key),
    evidence.transmissionRuleFact.key,
    ...evidence.lessons.flatMap((item) => [
      item.key,
      ...item.relationFacts.map((fact) => fact.key),
    ]),
    ...evidence.transmissions.flatMap((item) => [
      item.key,
      ...item.relationFacts.map((fact) => fact.key),
    ]),
    ...evidence.transitionFacts.map((item) => item.key),
    evidence.counterSummaryFact.key,
    ...evidence.counterEvidenceFacts.map((item) => item.key),
    ...evidence.timingFacts.map((item) => item.key),
    evidence.focusSummaryFact.key,
    ...evidence.focusFacts.map((item) => item.key),
    ...evidence.traditionalFacts.map((item) => item.key),
    evidence.summaryFact.key,
  ]);
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.match(evidence.promptText, /计算链：[\s\S]*证据汇总：[\s\S]*解释限制：/);
  assertPromptIsPortableTaskText(evidence.promptText);
  for (const transmission of result.threeTransmissions) {
    assert.ok(transmission.wuxing);
    assert.ok(transmission.seasonState);
    assert.equal(typeof transmission.isVoid, 'boolean');
  }
});

test('大六壬统一重建应覆盖闰年每日与十二时辰，并与实时排盘逐字段一致', () => {
  const dates = [
    ...Array.from({ length: 366 }, (_, dayOffset) => new Date(2024, 0, dayOffset + 1, 12, 30)),
    ...Array.from({ length: 12 }, (_, branchIndex) => new Date(2025, 5, 18, branchIndex * 2, 30)),
  ];

  for (const date of dates) {
    const generated = generateLiuren(date);
    const { evidenceAnalysis: _evidenceAnalysis, ...expected } = generated;
    assert.deepEqual(rebuildAuditedLiurenData(generated), expected, date.toISOString());
  }
});

test('大六壬旧资料缺少取传派生字段时应从时间戳完整重建，不按旧三传反推', () => {
  const data = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));
  const expectedRule = data.transmissionRule;
  const expectedPattern = data.transmissionPattern;
  data.transmissionRule = undefined;
  data.transmissionPattern = undefined;
  data.evidenceAnalysis = undefined;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.transmissionRuleFact.status, '已确定');
  assert.equal(evidence.transmissionRuleFact.rule, expectedRule);
  assert.equal(evidence.transmissionRuleFact.pattern, expectedPattern);
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.ok(evidence.calculationSteps.every((item) => item.status === '已计算'));
  assertPromptIsPortableTaskText(evidence.promptText);
});

function getUpperByUnder(
  plate: Array<{ branch: string; under: string; god: string }>,
  under: string,
) {
  return plate.find((item) => item.under === under)?.branch;
}

function getGodByUpper(
  plate: Array<{ branch: string; under: string; god: string }>,
  branch: string,
) {
  return plate.find((item) => item.branch === branch)?.god;
}

function createLesson(upper: string, lower: string, relation = '比和'): LiurenLesson {
  return {
    name: '一课',
    upper,
    lower,
    god: '贵人',
    relation,
    note: '',
  };
}

function createResolveContext(
  overrides: Partial<Parameters<typeof resolveInitialTransmission>[1]> = {},
) {
  return {
    dayStem: '甲',
    dayBranch: '子',
    dayStemResidence: '寅',
    heavenlyPlate: buildHeavenlyPlate({
      monthLeader: '亥',
      divinationBranch: '卯',
      noblemanBranch: '丑',
      dayNight: '昼占',
    }),
    ...overrides,
  };
}

function getUnderByUpper(
  plate: Array<{ branch: string; under: string; god: string }>,
  upper: string,
) {
  return plate.find((item) => item.branch === upper)?.under;
}

function buildReferenceLiurenPlate(args: { day: string; hour: string; monthLeader: string }) {
  const dayStem = args.day.charAt(0);
  const dayBranch = args.day.charAt(1);
  const hourStem = args.hour.charAt(0);
  const hourBranch = args.hour.charAt(1);
  const dayNight: '昼占' | '夜占' = new Set(['卯', '辰', '巳', '午', '未', '申']).has(hourBranch)
    ? '昼占'
    : '夜占';
  const heavenlyPlate = buildHeavenlyPlate({
    monthLeader: args.monthLeader,
    divinationBranch: hourBranch,
    noblemanBranch: GUIREN_BRANCH_BY_STEM[dayStem][dayNight === '昼占' ? 'day' : 'night'],
    dayNight,
  });
  const dayStemResidence = getDayStemResidence(dayStem);
  const lessons = buildFourLessons({
    heavenlyPlate,
    dayStem,
    dayBranch,
    dayStemResidence,
    xunKong: [],
  });
  const initial = resolveInitialTransmission(lessons, {
    dayStem,
    dayBranch,
    dayStemResidence,
    hourStem,
    hourBranch,
    heavenlyPlate,
  });
  const branches = initial.branches || [
    initial.initial,
    getUpperByUnder(heavenlyPlate, initial.initial),
    getUpperByUnder(heavenlyPlate, getUpperByUnder(heavenlyPlate, initial.initial)),
  ];

  return {
    heavenlyPlate,
    lessons,
    initial,
    branches,
  };
}

test('大六壬会输出完整的四课三传与天盘结构', () => {
  const result = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));

  assert.equal(result.heavenlyPlate.length, 12);
  assert.equal(result.fourLessons.length, 4);
  assert.equal(result.threeTransmissions.length, 3);
  assert.ok(result.xunKong?.length === 2);
  assert.match(
    result.transmissionRule || '',
    /重审法|元首法|贼克法|克法|比用法|涉害法|别责法|八专法/,
  );
  assert.ok(result.transmissionDetail?.includes(result.transmissionRule || ''));
  assert.match(result.transmissionDetail || '', /初传发用/);
  assert.match(result.transmissionSummary || '', /三传.+主线依次为/);

  const chu = result.threeTransmissions[0].branch;
  const zhong = result.threeTransmissions[1].branch;
  const mo = result.threeTransmissions[2].branch;
  assert.equal(zhong, getUpperByUnder(result.heavenlyPlate, chu));
  assert.equal(mo, getUpperByUnder(result.heavenlyPlate, zhong));
});

test('大六壬四课与三传六亲均以日干为中心，并与相邻传关系分字段保存', () => {
  const elementByValue: Record<string, string> = {
    甲: '木',
    乙: '木',
    丙: '火',
    丁: '火',
    戊: '土',
    己: '土',
    庚: '金',
    辛: '金',
    壬: '水',
    癸: '水',
    子: '水',
    丑: '土',
    寅: '木',
    卯: '木',
    辰: '土',
    巳: '火',
    午: '火',
    未: '土',
    申: '金',
    酉: '金',
    戌: '土',
    亥: '水',
  };
  const generates: Record<string, string> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
  const controls: Record<string, string> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
  const expectedKinship = (stem: string, branch: string) => {
    const day = elementByValue[stem];
    const transmission = elementByValue[branch];
    if (day === transmission) return '兄弟';
    if (generates[transmission] === day) return '父母';
    if (generates[day] === transmission) return '子孙';
    if (controls[day] === transmission) return '妻财';
    return '官鬼';
  };

  const seen = new Set<string>();
  for (const stem of TIANGAN) {
    for (const branch of DIZHI) {
      const actual = getLiurenKinship(stem, branch);
      assert.equal(actual, expectedKinship(stem, branch));
      seen.add(actual);
    }
  }
  assert.deepEqual([...seen].sort(), ['兄弟', '妻财', '子孙', '官鬼', '父母'].sort());

  const result = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));
  const dayStem = result.ganzhi.day.charAt(0);
  assert.ok(
    result.fourLessons.every(
      (item) =>
        item.kinship === expectedKinship(dayStem, item.upper) &&
        item.dayStemRelation?.includes(`日干${dayStem}`) &&
        item.dayStemRelation.includes(`${item.name}上神${item.upper}`),
    ),
  );
  assert.ok(
    result.threeTransmissions.every(
      (item) =>
        item.kinship === expectedKinship(dayStem, item.branch) &&
        item.relation === item.dayStemRelation &&
        item.dayStemRelation?.includes(`日干${dayStem}`),
    ),
  );
  assert.equal(result.threeTransmissions[0].previousRelation, undefined);
  assert.ok(result.threeTransmissions.slice(1).every((item) => item.previousRelation));
});

test('大六壬固定地支关系应分列同支、合冲害破刑，不与五行方向混写', () => {
  assert.deepEqual(getLiurenBranchPairRelations('子', '子'), ['同支']);
  assert.deepEqual(getLiurenBranchPairRelations('子', '丑'), ['六合']);
  assert.deepEqual(getLiurenBranchPairRelations('子', '午'), ['六冲']);
  assert.deepEqual(getLiurenBranchPairRelations('子', '未'), ['六害']);
  assert.deepEqual(getLiurenBranchPairRelations('子', '酉'), ['六破']);
  assert.deepEqual(getLiurenBranchPairRelations('子', '卯'), ['相刑']);
  assert.deepEqual(getLiurenBranchPairRelations('辰', '辰'), ['同支', '相刑']);
  assert.ok(getLiurenBranchPairRelations('寅', '巳').includes('相刑'));
  assert.ok(!getLiurenBranchPairRelations('巳', '寅').includes('相刑'));

  let pairCount = 0;
  for (const source of EARTHLY_BRANCHES) {
    for (const target of EARTHLY_BRANCHES) {
      pairCount += 1;
      assert.equal(
        getLiurenBranchPairRelations(source, target).includes('相刑'),
        SANXING_MAP[source] === target,
        `${source}→${target}定向刑序`,
      );
    }
  }
  assert.equal(pairCount, 144);
});

test('大六壬三传成局应按六壬指南输出课体标签', () => {
  const cases: Array<{ branches: string[]; guaTi: string }> = [
    { branches: ['子', '午', '卯'], guaTi: '三交卦' },
    { branches: ['寅', '申', '巳'], guaTi: '玄胎卦' },
    { branches: ['辰', '戌', '丑'], guaTi: '稼穑卦' },
    { branches: ['亥', '卯', '未'], guaTi: '曲直卦' },
    { branches: ['巳', '酉', '丑'], guaTi: '从革卦' },
    { branches: ['寅', '午', '戌'], guaTi: '炎上卦' },
    { branches: ['申', '子', '辰'], guaTi: '润下卦' },
  ];

  for (const item of cases) {
    assert.ok(
      getLiurenTransmissionGuaTi(item.branches).includes(item.guaTi),
      `${item.branches.join('')} 应识别为 ${item.guaTi}`,
    );
  }

  assert.deepEqual(getLiurenTransmissionGuaTi(['子', '子', '卯']), []);
});

test('大六壬全部1728种三传排列应只命中独立登记的课体条件', () => {
  const counts = new Map<string, number>();

  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        const branches = [initial, middle, final];
        const uniqueBranches = [...new Set(branches)];
        const expected: string[] = [];
        if (
          uniqueBranches.length === 3 &&
          uniqueBranches.every((branch) => ['子', '午', '卯', '酉'].includes(branch))
        ) {
          expected.push('三交卦');
        }
        if (
          uniqueBranches.length === 3 &&
          uniqueBranches.every((branch) => ['寅', '申', '巳', '亥'].includes(branch))
        ) {
          expected.push('玄胎卦');
        }
        if (
          uniqueBranches.length === 3 &&
          uniqueBranches.every((branch) => ['辰', '戌', '丑', '未'].includes(branch))
        ) {
          expected.push('稼穑卦');
        }
        for (const [name, expectedBranches] of [
          ['曲直卦', ['亥', '卯', '未']],
          ['从革卦', ['巳', '酉', '丑']],
          ['炎上卦', ['寅', '午', '戌']],
          ['润下卦', ['申', '子', '辰']],
        ] as const) {
          if (
            uniqueBranches.length === 3 &&
            expectedBranches.every((branch) => uniqueBranches.includes(branch))
          ) {
            expected.push(name);
          }
        }
        const initialIndex = DIZHI.indexOf(initial);
        if (
          middle === DIZHI[(initialIndex + 1) % DIZHI.length] &&
          final === DIZHI[(initialIndex + 2) % DIZHI.length]
        ) {
          expected.push('进茹');
        }
        if (
          middle === DIZHI[(initialIndex - 1 + DIZHI.length) % DIZHI.length] &&
          final === DIZHI[(initialIndex - 2 + DIZHI.length) % DIZHI.length]
        ) {
          expected.push('退茹');
        }
        const consecutiveName = LIUREN_GUIDE_CONSECUTIVE_NAME_BY_TRANSMISSIONS[branches.join('')];
        if (consecutiveName) expected.push(consecutiveName);
        if (
          ['寅卯辰', '辰卯寅', '巳午未', '未午巳', '申酉戌', '戌酉申', '亥子丑', '丑子亥'].includes(
            branches.join(''),
          )
        ) {
          expected.push('连珠课');
        }
        if (
          middle === DIZHI[(initialIndex + 2) % DIZHI.length] &&
          final === DIZHI[(initialIndex + 4) % DIZHI.length]
        ) {
          expected.push('进间');
        }
        if (
          middle === DIZHI[(initialIndex - 2 + DIZHI.length) % DIZHI.length] &&
          final === DIZHI[(initialIndex - 4 + DIZHI.length) % DIZHI.length]
        ) {
          expected.push('退间');
        }
        const intervalName = LIUREN_INTERVAL_GUA_TI_BY_TRANSMISSIONS[branches.join('')];
        if (intervalName) expected.push(intervalName);
        if (branches.join('') === '巳戌卯') expected.push('铸印卦');
        if (branches.join('') === '午卯子') expected.push('高盖乘轩卦');
        if (
          isSheng(getGanZhiWuxing(initial), getGanZhiWuxing(middle)) &&
          isSheng(getGanZhiWuxing(middle), getGanZhiWuxing(final))
        ) {
          expected.push('遗失格');
        }
        if (
          isSheng(getGanZhiWuxing(final), getGanZhiWuxing(middle)) &&
          isSheng(getGanZhiWuxing(middle), getGanZhiWuxing(initial))
        ) {
          expected.push('荣盛格');
        }
        if (isBranchKe(initial, middle) && isBranchKe(middle, final)) {
          expected.push('迭噬格');
        }
        if (
          ['寅巳申', '巳申寅', '申寅巳', '丑戌未', '戌未丑', '未丑戌'].includes(branches.join(''))
        ) {
          expected.push('三字刑格');
        }

        const actual = getLiurenTransmissionGuaTi(branches);
        assert.deepEqual(actual, expected, `${branches.join('')}的课体命中边界不一致`);
        actual.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
      }
    }
  }

  for (const intervalName of Object.values(LIUREN_INTERVAL_GUA_TI_BY_TRANSMISSIONS)) {
    assert.equal(counts.get(intervalName), 1, `${intervalName}应只命中唯一固定三传`);
    counts.delete(intervalName);
  }
  for (const consecutiveName of Object.values(LIUREN_GUIDE_CONSECUTIVE_NAME_BY_TRANSMISSIONS)) {
    assert.equal(counts.get(consecutiveName), 1, `${consecutiveName}应只命中唯一固定三传`);
    counts.delete(consecutiveName);
  }
  assert.deepEqual(Object.fromEntries([...counts].sort()), {
    三交卦: 24,
    三字刑格: 6,
    进间: 12,
    进茹: 12,
    迭噬格: 64,
    从革卦: 6,
    曲直卦: 6,
    荣盛格: 64,
    润下卦: 6,
    炎上卦: 6,
    玄胎卦: 24,
    退茹: 12,
    退间: 12,
    稼穑卦: 24,
    铸印卦: 1,
    连珠课: 8,
    遗失格: 64,
    高盖乘轩卦: 1,
  });
});

test('大六壬绝神加生格应按十二发用乘十二所临地盘穷举严格命中', () => {
  const expectedPairs = new Set(['巳寅', '申巳', '亥申', '寅亥']);
  let profileCount = 0;
  let matchCount = 0;

  for (const initial of DIZHI) {
    for (const initialGroundBranch of DIZHI) {
      const fact = getLiurenGuaTiFacts({
        transmissionBranches: [initial, '子', '丑'],
        initialGroundBranch,
      }).find((candidate) => candidate.name === '绝神加生格');
      const shouldMatch = expectedPairs.has(`${initial}${initialGroundBranch}`);
      assert.equal(Boolean(fact), shouldMatch, `${initial}加${initialGroundBranch}命中边界不一致`);
      if (fact) matchCount += 1;
      profileCount += 1;
    }
  }

  assert.equal(profileCount, 144);
  assert.equal(matchCount, 4);
});

test('大六壬四课全空格应按四课上下八处空实轮廓整批穷举', () => {
  let profileCount = 0;
  let matchCount = 0;

  for (let profile = 0; profile < 2 ** 8; profile += 1) {
    const fourLessons = Array.from({ length: 4 }, (_, lessonIndex) => ({
      upper: profile & (1 << (lessonIndex * 2)) ? '戌' : '子',
      lower: profile & (1 << (lessonIndex * 2 + 1)) ? '亥' : '丑',
    }));
    const fact = getLiurenGuaTiFacts({
      transmissionBranches: ['子', '丑', '寅'],
      dayGanZhi: '甲子',
      fourLessons,
    }).find((candidate) => candidate.name === '四课全空格');
    const shouldMatch = fourLessons.every(
      (lesson) => ['戌', '亥'].includes(lesson.upper) || ['戌', '亥'].includes(lesson.lower),
    );
    assert.equal(Boolean(fact), shouldMatch, `四课空实轮廓${profile.toString(2).padStart(8, '0')}`);
    if (fact) matchCount += 1;
    profileCount += 1;
  }

  assert.equal(profileCount, 256);
  assert.equal(matchCount, 3 ** 4);
});

test('大六壬德入天门格应按十日干乘十二发用穷举严格命中', () => {
  let profileCount = 0;
  let matchCount = 0;

  for (const dayStem of TIANGAN) {
    for (const initial of DIZHI) {
      const fact = getLiurenGuaTiFacts({
        transmissionBranches: [initial, '子', '丑'],
        dayStem,
      }).find((candidate) => candidate.name === '德入天门格');
      const shouldMatch = ['丁', '壬'].includes(dayStem) && initial === '亥';
      assert.equal(Boolean(fact), shouldMatch, `${dayStem}日${initial}发用边界不一致`);
      if (fact) matchCount += 1;
      profileCount += 1;
    }
  }

  assert.equal(profileCount, 120);
  assert.equal(matchCount, 2);
});

test('大六壬四组三合局自刑专名应按三传与干支上神轮廓整批穷举', () => {
  const specs = new Map([
    ['金刚格', { branches: ['巳', '酉', '丑'], repeatedBranch: '酉' }],
    ['火强格', { branches: ['寅', '午', '戌'], repeatedBranch: '午' }],
    ['水流趋东格', { branches: ['申', '子', '辰'], repeatedBranch: '辰' }],
    ['木落归根格', { branches: ['亥', '卯', '未'], repeatedBranch: '亥' }],
  ] as const);
  const matchCounts = new Map([...specs.keys()].map((name) => [name, 0]));
  const upperProfiles = [
    ...[...specs.values()].flatMap((spec) => [
      [spec.repeatedBranch, '子'],
      ['子', spec.repeatedBranch],
    ]),
    ['子', '丑'],
  ];
  let profileCount = 0;

  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        const transmissions = [initial, middle, final];
        const transmissionSet = new Set(transmissions);
        for (const [stemUpper, branchUpper] of upperProfiles) {
          const names = new Set(
            getLiurenGuaTiFacts({
              transmissionBranches: transmissions,
              fourLessons: [
                { upper: stemUpper, lower: '甲' },
                { upper: '子', lower: stemUpper },
                { upper: branchUpper, lower: '子' },
                { upper: '丑', lower: branchUpper },
              ],
            }).map((fact) => fact.name),
          );
          for (const [name, spec] of specs) {
            const shouldMatch =
              transmissionSet.size === 3 &&
              spec.branches.every((branch) => transmissionSet.has(branch)) &&
              [stemUpper, branchUpper].includes(spec.repeatedBranch);
            assert.equal(
              names.has(name),
              shouldMatch,
              `${transmissions.join('')}、干上${stemUpper}、支上${branchUpper}的${name}边界不一致`,
            );
            if (names.has(name)) matchCounts.set(name, (matchCounts.get(name) || 0) + 1);
          }
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 15_552);
  assert.deepEqual(Object.fromEntries(matchCounts), {
    金刚格: 12,
    火强格: 12,
    水流趋东格: 12,
    木落归根格: 12,
  });
});

test('大六壬一字刑、二字刑、三字刑应分别按完整输入轮廓穷举', () => {
  let oneCharacterProfiles = 0;
  let oneCharacterMatches = 0;
  for (let profile = 0; profile < 2 ** 4; profile += 1) {
    const upperBranches = Array.from({ length: 4 }, (_, index) =>
      profile & (1 << index) ? '辰' : '子',
    );
    const fact = getLiurenGuaTiFacts({
      transmissionBranches: ['子', '丑', '寅'],
      fourLessons: upperBranches.map((upper, index) => ({
        upper,
        lower: index === 0 ? '甲' : '子',
      })),
    }).find((candidate) => candidate.name === '一字刑格');
    assert.equal(
      Boolean(fact),
      upperBranches.every((branch) => branch === '辰'),
    );
    if (fact) oneCharacterMatches += 1;
    oneCharacterProfiles += 1;
  }
  assert.equal(oneCharacterProfiles, 16);
  assert.equal(oneCharacterMatches, 1);

  let twoCharacterProfiles = 0;
  let twoCharacterMatches = 0;
  for (const stemUpper of DIZHI) {
    for (const branchUpper of DIZHI) {
      const fact = getLiurenGuaTiFacts({
        transmissionBranches: ['子', '丑', '寅'],
        fourLessons: [
          { upper: stemUpper, lower: '甲' },
          { upper: '辰', lower: stemUpper },
          { upper: branchUpper, lower: '子' },
          { upper: '午', lower: branchUpper },
        ],
      }).find((candidate) => candidate.name === '二字刑格');
      const shouldMatch =
        `${stemUpper}${branchUpper}` === '子卯' || `${stemUpper}${branchUpper}` === '卯子';
      assert.equal(Boolean(fact), shouldMatch);
      if (fact) twoCharacterMatches += 1;
      twoCharacterProfiles += 1;
    }
  }
  assert.equal(twoCharacterProfiles, 144);
  assert.equal(twoCharacterMatches, 2);

  const expectedSequences = new Set(['寅巳申', '巳申寅', '申寅巳', '丑戌未', '戌未丑', '未丑戌']);
  let threeCharacterProfiles = 0;
  let threeCharacterMatches = 0;
  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        const sequence = `${initial}${middle}${final}`;
        const fact = getLiurenGuaTiFacts({
          transmissionBranches: [initial, middle, final],
        }).find((candidate) => candidate.name === '三字刑格');
        assert.equal(Boolean(fact), expectedSequences.has(sequence), `${sequence}三字刑边界不一致`);
        if (fact) threeCharacterMatches += 1;
        threeCharacterProfiles += 1;
      }
    }
  }
  assert.equal(threeCharacterProfiles, 1_728);
  assert.equal(threeCharacterMatches, 6);
});

test('大六壬三传日辰内战格应按五处下克上轮廓整批穷举', () => {
  let matchCount = 0;
  for (let profile = 0; profile < 2 ** 5; profile += 1) {
    const stemUpper = profile & 1 ? '辰' : '子';
    const branchUpper = profile & 2 ? '辰' : '子';
    const transmissionGroundBranches = [2, 3, 4].map((bit) => (profile & (1 << bit) ? '寅' : '午'));
    const fact = getLiurenGuaTiFacts({
      transmissionBranches: ['辰', '辰', '辰'],
      transmissionGroundBranches,
      dayStem: '甲',
      dayBranch: '寅',
      fourLessons: [
        { upper: stemUpper, lower: '甲' },
        { upper: '子', lower: stemUpper },
        { upper: branchUpper, lower: '寅' },
        { upper: '丑', lower: branchUpper },
      ],
    }).find((candidate) => candidate.name === '三传日辰内战格');
    assert.equal(
      Boolean(fact),
      profile === 31,
      `五处内战轮廓${profile.toString(2).padStart(5, '0')}`,
    );
    if (fact) matchCount += 1;
  }
  assert.equal(matchCount, 1);
});

test('大六壬课体识别应拒绝残缺、超长或非法的外部上下文', () => {
  assert.throws(() => getLiurenTransmissionGuaTi([]), /三传必须恰好包含/);
  assert.throws(() => getLiurenTransmissionGuaTi(['子', '午']), /三传必须恰好包含/);
  assert.throws(() => getLiurenTransmissionGuaTi(['子', '午', '卯', '酉']), /三传必须恰好包含/);
  assert.throws(() => getLiurenTransmissionGuaTi(['子', '午', '甲']), /第3传必须是有效地支/);
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        fourLessons: [{ upper: '卯', lower: '辛' }],
      }),
    /四课一经提供.*完整四课/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['子', '寅', '辰'],
        noblemanGroundBranch: '甲',
      }),
    /贵人所临地盘必须是有效地支/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['子', '寅', '辰'],
        greatAuspiciousGroundBranch: '甲',
      }),
    /大吉所临地盘必须是有效地支/,
  );
  assert.throws(
    () => getLiurenGuaTiFacts({ transmissionBranches: ['子', '寅', '辰'], dayStem: '子' }),
    /日干必须是有效天干/,
  );
  assert.throws(
    () => getLiurenGuaTiFacts({ transmissionBranches: ['子', '寅', '辰'], hourBranch: '甲' }),
    /占时地支必须是有效地支/,
  );
  assert.throws(
    () => getLiurenGuaTiFacts({ transmissionBranches: ['子', '寅', '辰'], dayGanZhi: '甲丑' }),
    /日柱必须是完整且有效的六十甲子/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        transmissionGods: ['天后', '六合'],
      }),
    /三传天将一经提供.*恰好包含/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        transmissionGods: ['天后', '六合', '贵人', '青龙'],
      }),
    /三传天将一经提供.*恰好包含/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        transmissionGods: ['天后', '非法天将', '六合'],
      }),
    /第2传天将必须是有效十二天将/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        transmissionRule: '   ',
      }),
    /取传规则一经提供.*非空字符串/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        transmissionGroundBranches: ['寅', '卯'],
      }),
    /三传所临地盘一经提供.*恰好包含/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        transmissionGroundBranches: ['寅', '甲', '辰'],
      }),
    /第2传所临地盘必须是有效地支/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        transmissionGroundBranches: ['寅', '卯', '辰'],
        initialGroundBranch: '丑',
      }),
    /初传所临地盘与三传所临地盘第一项不一致/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['子', '寅', '辰'],
        dayGanZhi: '甲子',
        dayStem: '乙',
      }),
    /日柱与日干不一致/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['子', '寅', '辰'],
        dayGanZhi: '甲子',
        dayBranch: '午',
      }),
    /日柱与日支不一致/,
  );
});

test('大六壬课体登记表应固定一百六十九条来源、稳定键和结构条件', () => {
  assert.equal(REGISTERED_LIUREN_GUA_TI_COUNT, 169);
  const facts = getLiurenGuaTiFacts({ transmissionBranches: ['亥', '卯', '未'] });
  const fact = facts.find((item) => item.name === '曲直卦');

  assert.ok(fact);
  assert.equal(fact.stableKey, 'liuren:verified-guati:qu-zhi');
  assert.deepEqual(fact.branches, ['亥', '卯', '未']);
  assert.deepEqual(fact.matchedConditions, ['三传亥卯未全']);
  assert.match(fact.sourceTitle, /《六壬指南》卷一/);
  assert.match(fact.sourceUrl, /oldid=854504/);
  assert.equal(fact.sourceQuote, '三传亥卯未曰曲直卦。');

  const jinRu = getLiurenGuaTiFacts({ transmissionBranches: ['亥', '子', '丑'] }).find(
    (item) => item.name === '进茹',
  );
  const tuiRu = getLiurenGuaTiFacts({ transmissionBranches: ['亥', '戌', '酉'] }).find(
    (item) => item.name === '退茹',
  );
  assert.ok(jinRu);
  assert.ok(tuiRu);
  assert.equal(jinRu.stableKey, 'liuren:verified-guati:jin-ru');
  assert.equal(tuiRu.stableKey, 'liuren:verified-guati:tui-ru');
  assert.equal(jinRu.category, '三传顺逆');
  assert.equal(tuiRu.category, '三传顺逆');
  assert.deepEqual(jinRu.matchedConditions, ['三传亥、子、丑依十二地支顺序逐支相连']);
  assert.deepEqual(tuiRu.matchedConditions, ['三传亥、戌、酉依十二地支逆序逐支相连']);
  assert.match(`${jinRu.sourceQuote}；${tuiRu.sourceQuote}`, /六壬指南.+六壬粹言/);
  assert.doesNotMatch(
    `${jinRu.matchedConditions.join('；')}；${tuiRu.matchedConditions.join('；')}`,
    /吉|凶|疾病|婚姻|功名|现实事件/,
  );

  for (const [branchesText, expectedName] of Object.entries(
    LIUREN_GUIDE_CONSECUTIVE_NAME_BY_TRANSMISSIONS,
  )) {
    const branches = [...branchesText];
    const namedFact = getLiurenGuaTiFacts({ transmissionBranches: branches }).find(
      (item) => item.name === expectedName,
    );
    assert.ok(namedFact, `${branchesText}应识别为${expectedName}`);
    assert.deepEqual(namedFact.matchedConditions, [`三传固定为${branches.join('、')}`]);
    assert.match(namedFact.sourceTitle, /六壬指南.+六壬大全/);
    assert.match(namedFact.sourceUrl, /oldid=854505$/);
    assert.doesNotMatch(namedFact.matchedConditions.join('；'), /吉|凶|疾病|婚姻|功名|现实事件/);
  }
  const fanJia = getLiurenGuaTiFacts({ transmissionBranches: ['戌', '酉', '申'] }).find(
    (item) => item.name === '返驾',
  );
  assert.ok(fanJia);
  assert.match(fanJia.sourceQuote, /电子正文.+酉戌申.+占例.+戌酉申.+六壬大全.+共同校正/);

  const lianZhu = getLiurenGuaTiFacts({ transmissionBranches: ['寅', '卯', '辰'] }).find(
    (item) => item.name === '连珠课',
  );
  assert.ok(lianZhu);
  assert.equal(lianZhu.stableKey, 'liuren:verified-guati:lian-zhu');
  assert.deepEqual(lianZhu.matchedConditions, ['三传寅、卯、辰在同一方依孟仲季次序顺连或逆连']);
  assert.match(lianZhu.sourceTitle, /六壬心镜.+六壬大全/);
  assert.match(lianZhu.sourceQuote, /岁月日相连.+不自动命中/);
  assert.equal(
    getLiurenGuaTiFacts({ transmissionBranches: ['子', '丑', '寅'] }).some(
      (item) => item.name === '连珠课',
    ),
    false,
  );

  const jinJian = getLiurenGuaTiFacts({ transmissionBranches: ['亥', '丑', '卯'] }).find(
    (item) => item.name === '进间',
  );
  const tuiJian = getLiurenGuaTiFacts({ transmissionBranches: ['亥', '酉', '未'] }).find(
    (item) => item.name === '退间',
  );
  assert.ok(jinJian);
  assert.ok(tuiJian);
  assert.equal(jinJian.stableKey, 'liuren:verified-guati:jin-jian');
  assert.equal(tuiJian.stableKey, 'liuren:verified-guati:tui-jian');
  assert.deepEqual(jinJian.matchedConditions, ['三传亥、丑、卯依十二地支顺序每次间隔一位']);
  assert.deepEqual(tuiJian.matchedConditions, ['三传亥、酉、未依十二地支逆序每次间隔一位']);
  assert.match(`${jinJian.sourceQuote}；${tuiJian.sourceQuote}`, /六壬指南.+六壬粹言/);
  assert.doesNotMatch(
    `${jinJian.matchedConditions.join('；')}；${tuiJian.matchedConditions.join('；')}`,
    /吉|凶|疾病|婚姻|功名|现实事件/,
  );
});

test('《御定六壬直指》本批五项课体应按最小自由变量整批穷举且疑义版本失败关闭', () => {
  const hasFact = (context: Parameters<typeof getLiurenGuaTiFacts>[0], name: string): boolean =>
    getLiurenGuaTiFacts(context).some((fact) => fact.name === name);
  const lessonNames: LiurenLesson['name'][] = ['一课', '二课', '三课', '四课'];
  const buildLessons = (uppers: string[]): LiurenLesson[] =>
    uppers.map((upper, index) => ({
      ...createLesson(upper, upper),
      name: lessonNames[index],
    }));

  let lessonProfileCount = 0;
  for (const first of DIZHI.slice(0, 4)) {
    for (const second of DIZHI.slice(0, 4)) {
      for (const third of DIZHI.slice(0, 4)) {
        for (const fourth of DIZHI.slice(0, 4)) {
          const uppers = [first, second, third, fourth];
          const expected = new Set(uppers).size === 3;
          assert.equal(
            hasFact(
              { transmissionBranches: ['子', '寅', '辰'], fourLessons: buildLessons(uppers) },
              '不备课',
            ),
            expected,
            `四课上神${uppers.join('、')}`,
          );
          lessonProfileCount += 1;
        }
      }
    }
  }
  assert.equal(lessonProfileCount, 256);

  let siJueCount = 0;
  for (const monthLeader of DIZHI) {
    for (const hourBranch of DIZHI) {
      const expected =
        (DIZHI.indexOf(monthLeader) - DIZHI.indexOf(hourBranch) + DIZHI.length) % DIZHI.length ===
        7;
      const matched = hasFact(
        { transmissionBranches: ['子', '寅', '辰'], monthLeader, hourBranch },
        '四绝课',
      );
      assert.equal(matched, expected, `${monthLeader}将加${hourBranch}时`);
      if (matched) siJueCount += 1;
    }
  }
  assert.equal(siJueCount, 12);

  const sourceLessons = buildLessons(['子', '丑', '寅', '卯']);
  for (const sourceLessonIndex of [undefined, 0, 1, 2, 3]) {
    const initialBranch =
      sourceLessonIndex === undefined ? '卯' : sourceLessons[sourceLessonIndex].upper;
    assert.equal(
      hasFact(
        {
          transmissionBranches: [initialBranch, '辰', '巳'],
          fourLessons: sourceLessons,
          initialSourceLessonIndex: sourceLessonIndex,
        },
        '蓦越课',
      ),
      sourceLessonIndex === 3,
    );
  }
  for (const invalidIndex of [-1, 4, 1.5]) {
    assert.throws(
      () =>
        getLiurenGuaTiFacts({
          transmissionBranches: ['卯', '辰', '巳'],
          fourLessons: sourceLessons,
          initialSourceLessonIndex: invalidIndex,
        }),
      /初传来源课序号一经提供，就必须是 0 至 3 的整数/,
    );
  }
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['卯', '辰', '巳'],
        initialSourceLessonIndex: 3,
      }),
    /必须同时提供完整四课/,
  );
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['子', '辰', '巳'],
        fourLessons: sourceLessons,
        initialSourceLessonIndex: 3,
      }),
    /初传来源课的上神必须与初传一致/,
  );

  const directRules = ['涉害法', '遥克涉害法', '返吟涉害法', '重审法'];
  for (const transmissionRule of directRules) {
    for (const initialGroundBranch of DIZHI) {
      const isDirectSheHai = transmissionRule === '涉害法';
      const isMeng = ['寅', '巳', '申', '亥'].includes(initialGroundBranch);
      assert.equal(
        hasFact(
          { transmissionBranches: ['子', '寅', '辰'], transmissionRule, initialGroundBranch },
          '见机课',
        ),
        isDirectSheHai && isMeng,
      );
      assert.equal(
        hasFact(
          { transmissionBranches: ['子', '寅', '辰'], transmissionRule, initialGroundBranch },
          '察微课',
        ),
        isDirectSheHai && !isMeng,
      );
    }
  }

  const siJue = getLiurenGuaTiFacts({
    transmissionBranches: ['子', '寅', '辰'],
    monthLeader: '未',
    hourBranch: '子',
  }).find((fact) => fact.name === '四绝课');
  const moYue = getLiurenGuaTiFacts({
    transmissionBranches: ['卯', '辰', '巳'],
    fourLessons: sourceLessons,
    initialSourceLessonIndex: 3,
  }).find((fact) => fact.name === '蓦越课');
  assert.ok(siJue);
  assert.ok(moYue);
  assert.match(siJue.sourceUrl, /shushubook\/blob\/[0-9a-f]{40}\/六壬\/六壬大全/);
  assert.match(moYue.sourceUrl, /shushubook\/blob\/[0-9a-f]{40}\/六壬\/六壬寻源/);
});

test('六壬指南昴星蛇虎两个子格应按取传方法与初传十二天将整批穷举', () => {
  const expectedByInitialGod: Readonly<Record<string, string>> = {
    螣蛇: '冬蛇掩目',
    白虎: '虎视转蓬',
  };
  let caseCount = 0;

  for (const transmissionRule of ['昴星法', '元首法']) {
    for (const initialGod of TIANJIANG) {
      const facts = getLiurenGuaTiFacts({
        transmissionBranches: ['午', '戌', '寅'],
        transmissionGods: [initialGod, '青龙', '太阴'],
        transmissionRule,
      });
      const matchedNames = facts
        .map((fact) => fact.name)
        .filter((name) => ['冬蛇掩目', '虎视转蓬'].includes(name));
      const expectedName =
        transmissionRule === '昴星法' ? expectedByInitialGod[initialGod] : undefined;
      assert.deepEqual(
        matchedNames,
        expectedName ? [expectedName] : [],
        `${transmissionRule}且${initialGod}发用的蛇虎子格边界不一致`,
      );
      if (expectedName) {
        const fact = facts.find((candidate) => candidate.name === expectedName);
        assert.ok(fact);
        assert.deepEqual(fact.matchedConditions, ['取传规则为昴星法', `初传午乘${initialGod}`]);
        assert.match(fact.sourceUrl, /oldid=854504$/);
      }
      caseCount += 1;
    }
  }

  assert.equal(caseCount, 24);
  assert.equal(
    getLiurenGuaTiFacts({
      transmissionBranches: ['午', '戌', '寅'],
      transmissionRule: '昴星法',
    }).some((fact) => ['冬蛇掩目', '虎视转蓬'].includes(fact.name)),
    false,
    '缺少初传天将时必须失败关闭',
  );
});

test('六壬指南卷二七项闭合结构应按三传、干支与天罡位置整批穷举', () => {
  const guideNames = new Set([
    '关隔格',
    '遗失格',
    '荣盛格',
    '迭噬格',
    '俸就格',
    '历虚格',
    '归宠格',
  ]);
  const auditedFacts = new Map<string, ReturnType<typeof getLiurenGuaTiFacts>[number]>();

  let transmissionCaseCount = 0;
  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        const facts = getLiurenGuaTiFacts({ transmissionBranches: [initial, middle, final] });
        const names = new Set(facts.map((fact) => fact.name));
        const expected: Readonly<Record<string, boolean>> = {
          遗失格:
            isSheng(getGanZhiWuxing(initial), getGanZhiWuxing(middle)) &&
            isSheng(getGanZhiWuxing(middle), getGanZhiWuxing(final)),
          荣盛格:
            isSheng(getGanZhiWuxing(final), getGanZhiWuxing(middle)) &&
            isSheng(getGanZhiWuxing(middle), getGanZhiWuxing(initial)),
          迭噬格: isBranchKe(initial, middle) && isBranchKe(middle, final),
        };
        for (const [name, shouldMatch] of Object.entries(expected)) {
          assert.equal(
            names.has(name),
            shouldMatch,
            `${initial}${middle}${final}的${name}边界不一致`,
          );
        }
        for (const fact of facts) {
          if (guideNames.has(fact.name) && !auditedFacts.has(fact.name)) {
            auditedFacts.set(fact.name, fact);
          }
        }
        transmissionCaseCount += 1;
      }
    }
  }
  assert.equal(transmissionCaseCount, 1_728);

  let dayRelationCaseCount = 0;
  for (const dayStem of TIANGAN) {
    const stemResidence = getDayStemResidence(dayStem);
    for (const dayBranch of DIZHI) {
      for (const stemUpper of DIZHI) {
        for (const branchUpper of DIZHI) {
          const facts = getLiurenGuaTiFacts({
            transmissionBranches: ['子', '子', '子'],
            dayStem,
            dayBranch,
            fourLessons: [
              { lower: dayStem, upper: stemUpper },
              { lower: stemUpper, upper: stemUpper },
              { lower: dayBranch, upper: branchUpper },
              { lower: branchUpper, upper: branchUpper },
            ],
          });
          const names = new Set(facts.map((fact) => fact.name));
          const expected: Readonly<Record<string, boolean>> = {
            俸就格:
              branchUpper === stemResidence &&
              isSheng(getGanZhiWuxing(dayBranch), getGanZhiWuxing(dayStem)),
            历虚格:
              branchUpper === stemResidence &&
              isSheng(getGanZhiWuxing(dayStem), getGanZhiWuxing(dayBranch)),
            归宠格:
              stemUpper === dayBranch &&
              isSheng(getGanZhiWuxing(dayStem), getGanZhiWuxing(dayBranch)),
          };
          for (const [name, shouldMatch] of Object.entries(expected)) {
            assert.equal(
              names.has(name),
              shouldMatch,
              `${dayStem}${dayBranch}、干上${stemUpper}、支上${branchUpper}的${name}边界不一致`,
            );
          }
          for (const fact of facts) {
            if (guideNames.has(fact.name) && !auditedFacts.has(fact.name)) {
              auditedFacts.set(fact.name, fact);
            }
          }
          dayRelationCaseCount += 1;
        }
      }
    }
  }
  assert.equal(dayRelationCaseCount, 17_280);

  let heavenlyDragonCaseCount = 0;
  for (const groundBranch of DIZHI) {
    const facts = getLiurenGuaTiFacts({
      transmissionBranches: ['子', '子', '子'],
      heavenlyDragonGroundBranch: groundBranch,
    });
    const names = new Set(facts.map((fact) => fact.name));
    assert.equal(
      names.has('关隔格'),
      ['子', '午', '卯', '酉'].includes(groundBranch),
      `天罡临${groundBranch}的关隔格边界不一致`,
    );
    for (const fact of facts) {
      if (guideNames.has(fact.name) && !auditedFacts.has(fact.name)) {
        auditedFacts.set(fact.name, fact);
      }
    }
    heavenlyDragonCaseCount += 1;
  }
  assert.equal(heavenlyDragonCaseCount, 12);

  assert.deepEqual([...auditedFacts.keys()].sort(), [...guideNames].sort());
  for (const fact of auditedFacts.values()) {
    assert.match(fact.sourceTitle, /《六壬指南》卷二/);
    assert.match(fact.sourceUrl, /oldid=854505$/);
    assert.doesNotMatch(
      fact.matchedConditions.join('；'),
      /主(?:婚姻|官非|疾病|死丧|升迁|财利)|必然|必定|现实事件/,
    );
  }
});

test('大六壬课传空陷九类课体应按同一批旬空与坐空轮廓严格命中', () => {
  const getNames = (
    transmissionBranches: string[],
    transmissionGroundBranches: string[],
    extra: Partial<Parameters<typeof getLiurenGuaTiFacts>[0]> = {},
  ) =>
    new Set(
      getLiurenGuaTiFacts({
        transmissionBranches,
        transmissionGroundBranches,
        dayGanZhi: '甲子',
        ...extra,
      }).map((fact) => fact.name),
    );

  let voidProfileCount = 0;
  for (let profile = 0; profile < 64; profile += 1) {
    const branchIsVoid = [0, 1, 2].map((index) => Boolean(profile & (1 << index)));
    const groundIsVoid = [0, 1, 2].map((index) => Boolean(profile & (1 << (index + 3))));
    const branches = branchIsVoid.map((isVoid) => (isVoid ? '戌' : '子'));
    const grounds = groundIsVoid.map((isVoid) => (isVoid ? '亥' : '丑'));
    const isEmpty = branchIsVoid.map((isVoid, index) => isVoid || groundIsVoid[index]);
    const names = getNames(branches, grounds);

    assert.equal(names.has('三传皆空格'), isEmpty.every(Boolean), `空陷轮廓${profile}`);
    assert.equal(
      names.has('发用上下皆空格'),
      branchIsVoid[0] && groundIsVoid[0],
      `空陷轮廓${profile}`,
    );
    assert.equal(
      names.has('杜传不行格'),
      !isEmpty[0] && isEmpty[1] && isEmpty[2],
      `空陷轮廓${profile}`,
    );
    assert.equal(names.has('断桥格'), isEmpty[1], `空陷轮廓${profile}`);
    assert.equal(names.has('斩首格'), isEmpty[0], `空陷轮廓${profile}`);
    assert.equal(names.has('刖足格'), isEmpty[2], `空陷轮廓${profile}`);
    voidProfileCount += 1;
  }
  assert.equal(voidProfileCount, 64);

  const voidBranches = new Set(['戌', '亥']);
  let transmissionProfileCount = 0;
  let shengChuanCount = 0;
  let jiaoTaCount = 0;
  let laiQuCount = 0;
  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        const branches = [initial, middle, final];
        const grounds = branches.map((branch) => (voidBranches.has(branch) ? '丑' : '戌'));
        const names = getNames(branches, grounds, { monthLeader: '午', hourBranch: '子' });
        const indices = branches.map((branch) => DIZHI.indexOf(branch));
        const isForward =
          indices[1] === (indices[0] + 1) % 12 && indices[2] === (indices[1] + 1) % 12;
        const isBackward =
          indices[1] === (indices[0] + 11) % 12 && indices[2] === (indices[1] + 11) % 12;

        assert.equal(names.has('声传空谷格'), isForward, branches.join(''));
        assert.equal(names.has('脚踏空亡格'), isBackward, branches.join(''));
        assert.ok(names.has('来去俱空格'), branches.join(''));
        if (names.has('声传空谷格')) shengChuanCount += 1;
        if (names.has('脚踏空亡格')) jiaoTaCount += 1;
        if (names.has('来去俱空格')) laiQuCount += 1;
        transmissionProfileCount += 1;
      }
    }
  }
  assert.equal(transmissionProfileCount, 1_728);
  assert.equal(shengChuanCount, 12);
  assert.equal(jiaoTaCount, 12);
  assert.equal(laiQuCount, 1_728);
  assert.ok(
    !getNames(['巳', '亥', '巳'], ['亥', '巳', '亥'], {
      dayGanZhi: '己亥',
      monthLeader: '辰',
      hourBranch: '亥',
    }).has('来去俱空格'),
  );

  const classicalFacts = [
    getLiurenGuaTiFacts({
      dayGanZhi: '己亥',
      transmissionBranches: ['巳', '亥', '巳'],
      transmissionGroundBranches: ['亥', '巳', '亥'],
    }).find((fact) => fact.name === '三传皆空格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '癸酉',
      transmissionBranches: ['亥', '子', '丑'],
      transmissionGroundBranches: ['戌', '亥', '子'],
    }).find((fact) => fact.name === '发用上下皆空格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '甲子',
      transmissionBranches: ['申', '亥', '寅'],
      transmissionGroundBranches: ['未', '申', '戌'],
    }).find((fact) => fact.name === '杜传不行格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '甲子',
      transmissionBranches: ['子', '丑', '寅'],
      transmissionGroundBranches: ['子', '戌', '寅'],
    }).find((fact) => fact.name === '断桥格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '甲子',
      transmissionBranches: ['戌', '子', '丑'],
      transmissionGroundBranches: ['子', '子', '丑'],
    }).find((fact) => fact.name === '斩首格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '甲子',
      transmissionBranches: ['子', '丑', '亥'],
      transmissionGroundBranches: ['子', '丑', '丑'],
    }).find((fact) => fact.name === '刖足格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '壬子',
      transmissionBranches: ['寅', '卯', '辰'],
      transmissionGroundBranches: ['丑', '寅', '卯'],
    }).find((fact) => fact.name === '声传空谷格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '戊申',
      transmissionBranches: ['卯', '寅', '丑'],
      transmissionGroundBranches: ['辰', '卯', '寅'],
    }).find((fact) => fact.name === '脚踏空亡格'),
    getLiurenGuaTiFacts({
      dayGanZhi: '己亥',
      transmissionBranches: ['巳', '亥', '巳'],
      transmissionGroundBranches: ['亥', '巳', '亥'],
      monthLeader: '巳',
      hourBranch: '亥',
    }).find((fact) => fact.name === '来去俱空格'),
  ];
  assert.ok(classicalFacts.every(Boolean));
  assert.ok(classicalFacts.every((fact) => fact?.category === '课传空陷'));
  assert.equal(new Set(classicalFacts.map((fact) => fact?.stableKey)).size, 9);
  assert.ok(classicalFacts.every((fact) => /oldid=8545(?:05|80|81)$/.test(fact?.sourceUrl || '')));
  assert.ok(
    classicalFacts.every(
      (fact) =>
        !/宜|不宜|疾病|官讼|灾祸|婚姻|吉凶|现实事件/.test(fact?.matchedConditions.join('；') || ''),
    ),
  );
});

test('大六壬三阳与六纯课应按旺相、贵人顺布及七处阴阳轮廓整批命中', () => {
  const makeLessons = (uppers: readonly string[]) =>
    uppers.map((upper) => ({ upper, lower: '子' }));
  const isFlourishing = (branch: string, monthBranch: string) => {
    const state = getSeasonState(getGanZhiWuxing(branch), monthBranch);
    return state === '旺' || state === '相';
  };

  let seasonProfileCount = 0;
  let expectedSeasonMatchCount = 0;
  let actualSeasonMatchCount = 0;
  for (const monthBranch of DIZHI) {
    for (const initial of DIZHI) {
      seasonProfileCount += 1;
      const matched = getLiurenGuaTiFacts({
        transmissionBranches: [initial, '子', '丑'],
        monthBranch,
        noblemanBranch: '子',
        noblemanGroundBranch: '亥',
        fourLessons: makeLessons(['寅', '子', '辰', '子']),
      }).some((candidate) => candidate.name === '三阳课');
      const expected = isFlourishing(initial, monthBranch);
      if (expected) expectedSeasonMatchCount += 1;
      if (matched) actualSeasonMatchCount += 1;
      assert.equal(matched, expected, `${monthBranch}月、${initial}发用的三阳旺相边界错误`);
    }
  }
  assert.equal(seasonProfileCount, 144);
  assert.equal(actualSeasonMatchCount, expectedSeasonMatchCount);

  const forwardGroundBranches = new Set(['亥', '子', '丑', '寅', '卯', '辰']);
  let positionProfileCount = 0;
  let expectedPositionMatchCount = 0;
  let actualPositionMatchCount = 0;
  for (const noblemanBranch of DIZHI) {
    const noblemanIndex = DIZHI.indexOf(noblemanBranch);
    for (const noblemanGroundBranch of DIZHI) {
      for (const stemUpper of DIZHI) {
        for (const branchUpper of DIZHI) {
          positionProfileCount += 1;
          const stemStep = (DIZHI.indexOf(stemUpper) - noblemanIndex + DIZHI.length) % DIZHI.length;
          const branchStep =
            (DIZHI.indexOf(branchUpper) - noblemanIndex + DIZHI.length) % DIZHI.length;
          const expected =
            forwardGroundBranches.has(noblemanGroundBranch) &&
            stemStep >= 1 &&
            stemStep <= 5 &&
            branchStep >= 1 &&
            branchStep <= 5;
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: ['寅', '子', '丑'],
            monthBranch: '寅',
            noblemanBranch,
            noblemanGroundBranch,
            fourLessons: makeLessons([stemUpper, '子', branchUpper, '子']),
          }).find((candidate) => candidate.name === '三阳课');
          if (expected) expectedPositionMatchCount += 1;
          if (fact) actualPositionMatchCount += 1;
          assert.equal(
            !!fact,
            expected,
            `贵人${noblemanBranch}临${noblemanGroundBranch}、干上${stemUpper}、支上${branchUpper}的三阳位置边界错误`,
          );
        }
      }
    }
  }
  assert.equal(positionProfileCount, 20_736);
  assert.equal(expectedPositionMatchCount, 1_800);
  assert.equal(actualPositionMatchCount, 1_800);

  const yangBranches = new Set(['子', '寅', '辰', '午', '申', '戌']);
  let sixYangMatchCount = 0;
  let sixYinMatchCount = 0;
  for (let profile = 0; profile < 2 ** 7; profile += 1) {
    const branches = Array.from({ length: 7 }, (_, index) =>
      profile & (1 << index) ? '子' : '丑',
    );
    const facts = getLiurenGuaTiFacts({
      transmissionBranches: branches.slice(4),
      fourLessons: makeLessons(branches.slice(0, 4)),
    });
    const hasSixYang = facts.some((candidate) => candidate.name === '六阳课');
    const hasSixYin = facts.some((candidate) => candidate.name === '六阴课');
    if (hasSixYang) sixYangMatchCount += 1;
    if (hasSixYin) sixYinMatchCount += 1;
    assert.equal(hasSixYang, profile === 127, `第${profile}种轮廓的六阳判断错误`);
    assert.equal(hasSixYin, profile === 0, `第${profile}种轮廓的六阴判断错误`);
  }
  assert.equal(sixYangMatchCount, 1);
  assert.equal(sixYinMatchCount, 1);

  for (const branch of DIZHI) {
    const facts = getLiurenGuaTiFacts({
      transmissionBranches: [branch, branch, branch],
      fourLessons: makeLessons([branch, branch, branch, branch]),
    });
    assert.equal(
      facts.some((candidate) => candidate.name === '六阳课'),
      yangBranches.has(branch),
      `${branch}的六阳阴阳映射错误`,
    );
    assert.equal(
      facts.some((candidate) => candidate.name === '六阴课'),
      !yangBranches.has(branch),
      `${branch}的六阴阴阳映射错误`,
    );
  }

  const classicalSanYang = getLiurenGuaTiFacts({
    transmissionBranches: ['寅', '卯', '辰'],
    monthBranch: '寅',
    noblemanBranch: '子',
    noblemanGroundBranch: '亥',
    fourLessons: makeLessons(['巳', '午', '寅', '卯']),
  }).find((candidate) => candidate.name === '三阳课');
  const classicalSixYang = getLiurenGuaTiFacts({
    transmissionBranches: ['戌', '申', '寅'],
    fourLessons: makeLessons(['子', '戌', '戌', '申']),
  }).find((candidate) => candidate.name === '六阳课');
  const classicalSixYin = getLiurenGuaTiFacts({
    transmissionBranches: ['未', '巳', '卯'],
    fourLessons: makeLessons(['酉', '未', '未', '巳']),
  }).find((candidate) => candidate.name === '六阴课');
  assert.ok(classicalSanYang);
  assert.ok(classicalSixYang);
  assert.ok(classicalSixYin);
  assert.match(classicalSanYang.sourceUrl, /oldid=854575/);
  assert.match(classicalSixYang.sourceUrl, /oldid=854579/);
  assert.match(classicalSixYin.sourceUrl, /oldid=854579/);
  assert.doesNotMatch(
    [classicalSanYang, classicalSixYang, classicalSixYin]
      .flatMap((fact) => fact.matchedConditions)
      .join('；'),
    /吉|凶|疾病|婚姻|功名|现实事件/,
  );
});

test('大六壬四顺四逆与天心盘珠应按贵人顺逆和课传容器整批命中', () => {
  const auspiciousGenerals = new Set(['贵人', '六合', '青龙', '太常', '太阴', '天后']);
  const inauspiciousGenerals = new Set(['螣蛇', '朱雀', '勾陈', '天空', '白虎', '玄武']);
  const forwardGroundBranches = new Set(['亥', '子', '丑', '寅', '卯', '辰']);
  const reverseGroundBranches = new Set(['巳', '午', '未', '申', '酉', '戌']);
  const makeLessons = (uppers: readonly string[]) =>
    uppers.map((upper, index) => ({ upper, lower: DIZHI[index] }));
  const stateOf = (branch: string, monthBranch: string) =>
    getSeasonState(getGanZhiWuxing(branch), monthBranch);
  const hasFact = (context: Parameters<typeof getLiurenGuaTiFacts>[0], name: string) =>
    getLiurenGuaTiFacts(context).some((candidate) => candidate.name === name);

  let generalProfiles = 0;
  let fourShunGeneralMatches = 0;
  let fourNiGeneralMatches = 0;
  for (const initialGod of TIANJIANG) {
    for (const finalGod of TIANJIANG) {
      generalProfiles += 1;
      const transmissionGods = [initialGod, '天空', finalGod];
      const fourShun = hasFact(
        {
          transmissionBranches: ['申', '子', '寅'],
          transmissionGods,
          monthBranch: '寅',
          noblemanBranch: '子',
          noblemanGroundBranch: '亥',
        },
        '四顺课',
      );
      const fourNi = hasFact(
        {
          transmissionBranches: ['寅', '子', '申'],
          transmissionGods,
          monthBranch: '寅',
          noblemanBranch: '子',
          noblemanGroundBranch: '巳',
        },
        '四逆课',
      );
      assert.equal(
        fourShun,
        inauspiciousGenerals.has(initialGod) && auspiciousGenerals.has(finalGod),
      );
      assert.equal(
        fourNi,
        auspiciousGenerals.has(initialGod) && inauspiciousGenerals.has(finalGod),
      );
      if (fourShun) fourShunGeneralMatches += 1;
      if (fourNi) fourNiGeneralMatches += 1;
    }
  }
  assert.equal(generalProfiles, 144);
  assert.equal(fourShunGeneralMatches, 36);
  assert.equal(fourNiGeneralMatches, 36);

  let positionProfiles = 0;
  let fourShunPositionMatches = 0;
  let fourNiPositionMatches = 0;
  for (const noblemanBranch of DIZHI) {
    for (const noblemanGroundBranch of DIZHI) {
      for (const final of DIZHI) {
        positionProfiles += 1;
        const flourishingMonth = DIZHI.find((month) =>
          ['旺', '相'].includes(stateOf(final, month)),
        );
        const decliningMonth = DIZHI.find((month) => ['囚', '死'].includes(stateOf(final, month)));
        assert.ok(flourishingMonth);
        assert.ok(decliningMonth);
        const decliningInitial = DIZHI.find((branch) =>
          ['囚', '死'].includes(stateOf(branch, flourishingMonth)),
        );
        const flourishingInitial = DIZHI.find((branch) =>
          ['旺', '相'].includes(stateOf(branch, decliningMonth)),
        );
        assert.ok(decliningInitial);
        assert.ok(flourishingInitial);
        const step =
          (DIZHI.indexOf(final) - DIZHI.indexOf(noblemanBranch) + DIZHI.length) % DIZHI.length;
        const fourShun = hasFact(
          {
            transmissionBranches: [decliningInitial, '子', final],
            transmissionGods: ['螣蛇', '天空', '贵人'],
            monthBranch: flourishingMonth,
            noblemanBranch,
            noblemanGroundBranch,
          },
          '四顺课',
        );
        const fourNi = hasFact(
          {
            transmissionBranches: [flourishingInitial, '子', final],
            transmissionGods: ['贵人', '天空', '螣蛇'],
            monthBranch: decliningMonth,
            noblemanBranch,
            noblemanGroundBranch,
          },
          '四逆课',
        );
        assert.equal(
          fourShun,
          forwardGroundBranches.has(noblemanGroundBranch) && step >= 1 && step <= 5,
        );
        assert.equal(
          fourNi,
          reverseGroundBranches.has(noblemanGroundBranch) && step >= 6 && step <= 11,
        );
        if (fourShun) fourShunPositionMatches += 1;
        if (fourNi) fourNiPositionMatches += 1;
      }
    }
  }
  assert.equal(positionProfiles, 1_728);
  assert.equal(fourShunPositionMatches, 360);
  assert.equal(fourNiPositionMatches, 432);

  const lessonUppers = ['丑', '子', '亥', '戌'];
  const lessons = makeLessons(lessonUppers);
  let fourEstablishmentProfiles = 0;
  let lessonContainerMatches = 0;
  let transmissionContainerMatches = 0;
  for (const yearBranch of DIZHI) {
    for (const monthBranch of DIZHI) {
      for (const dayBranch of DIZHI) {
        for (const hourBranch of DIZHI) {
          fourEstablishmentProfiles += 1;
          const establishments = [yearBranch, monthBranch, dayBranch, hourBranch];
          const lessonMatch = getLiurenGuaTiFacts({
            transmissionBranches: ['申', '午', '辰'],
            yearBranch,
            monthBranch,
            dayBranch,
            hourBranch,
            fourLessons: lessons,
          })
            .find((candidate) => candidate.name === '天心格')
            ?.matchedConditions.some((condition) => condition.includes('四课上神'));
          const transmissionMatch = hasFact(
            {
              transmissionBranches: ['巳', '丑', '酉'],
              yearBranch,
              monthBranch,
              dayBranch,
              hourBranch,
            },
            '天心格',
          );
          assert.equal(
            !!lessonMatch,
            establishments.every((branch) => lessonUppers.includes(branch)),
          );
          assert.equal(
            transmissionMatch,
            establishments.every((branch) => ['巳', '丑', '酉'].includes(branch)),
          );
          if (lessonMatch) lessonContainerMatches += 1;
          if (transmissionMatch) transmissionContainerMatches += 1;
        }
      }
    }
  }
  assert.equal(fourEstablishmentProfiles, 20_736);
  assert.equal(lessonContainerMatches, 256);
  assert.equal(transmissionContainerMatches, 81);

  assert.equal(
    hasFact(
      {
        transmissionBranches: ['丑', '申', '酉'],
        yearBranch: '丑',
        monthBranch: '子',
        dayBranch: '申',
        hourBranch: '酉',
        fourLessons: makeLessons(['子', '寅', '辰', '午']),
      },
      '天心格',
    ),
    false,
    '四建拆分在四课与三传时不得误判天心格',
  );

  let transmissionProfiles = 0;
  let panZhuMatches = 0;
  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        transmissionProfiles += 1;
        const matched = hasFact(
          {
            transmissionBranches: [initial, middle, final],
            yearBranch: '戌',
            monthBranch: '丑',
            dayBranch: '子',
            hourBranch: '丑',
            fourLessons: lessons,
          },
          '盘珠课',
        );
        const expected = [initial, middle, final].every((branch) => lessonUppers.includes(branch));
        assert.equal(matched, expected);
        if (matched) panZhuMatches += 1;
      }
    }
  }
  assert.equal(transmissionProfiles, 1_728);
  assert.equal(panZhuMatches, 64);

  const panZhuFacts = getLiurenGuaTiFacts({
    transmissionBranches: ['子', '亥', '戌'],
    yearBranch: '戌',
    monthBranch: '丑',
    dayBranch: '子',
    hourBranch: '丑',
    fourLessons: lessons,
  });
  assert.ok(panZhuFacts.some((candidate) => candidate.name === '天心格'));
  assert.ok(panZhuFacts.some((candidate) => candidate.name === '盘珠课'));
  const transmissionTianXin = getLiurenGuaTiFacts({
    transmissionBranches: ['巳', '丑', '酉'],
    yearBranch: '巳',
    monthBranch: '丑',
    dayBranch: '酉',
    hourBranch: '巳',
  });
  assert.ok(transmissionTianXin.some((candidate) => candidate.name === '天心格'));
  assert.ok(!transmissionTianXin.some((candidate) => candidate.name === '盘珠课'));
});

test('大六壬天狱课应按囚死墓发用与天罡临六壬日本穷举严格命中', () => {
  const branchElement: Readonly<Record<string, string>> = {
    子: '水',
    丑: '土',
    寅: '木',
    卯: '木',
    辰: '土',
    巳: '火',
    午: '火',
    未: '土',
    申: '金',
    酉: '金',
    戌: '土',
    亥: '水',
  };
  const seasonState: Readonly<Record<string, Readonly<Record<string, string>>>> = {
    木: { 木: '旺', 火: '相', 土: '死', 金: '囚', 水: '休' },
    火: { 木: '休', 火: '旺', 土: '相', 金: '死', 水: '囚' },
    土: { 木: '囚', 火: '休', 土: '旺', 金: '相', 水: '死' },
    金: { 木: '死', 火: '囚', 土: '休', 金: '旺', 水: '相' },
    水: { 木: '相', 火: '死', 土: '囚', 金: '休', 水: '旺' },
  };
  const dayOrigin: Readonly<Record<string, string>> = {
    甲: '亥',
    乙: '亥',
    丙: '寅',
    丁: '寅',
    戊: '申',
    己: '申',
    庚: '巳',
    辛: '巳',
    壬: '申',
    癸: '申',
  };
  const tombBranch: Readonly<Record<string, string>> = {
    甲: '未',
    乙: '未',
    丙: '戌',
    丁: '戌',
    戊: '辰',
    己: '辰',
    庚: '丑',
    辛: '丑',
    壬: '辰',
    癸: '辰',
  };
  let profileCount = 0;
  let expectedMatchCount = 0;
  let actualMatchCount = 0;

  for (const dayStem of TIANGAN) {
    for (const monthBranch of DIZHI) {
      for (const initial of DIZHI) {
        for (const heavenlyDragonGroundBranch of DIZHI) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: [initial, '子', '丑'],
            dayStem,
            monthBranch,
            heavenlyDragonGroundBranch,
          }).find((candidate) => candidate.name === '天狱课');
          const state = seasonState[branchElement[monthBranch]][branchElement[initial]];
          const expected =
            (state === '囚' || state === '死' || initial === tombBranch[dayStem]) &&
            heavenlyDragonGroundBranch === dayOrigin[dayStem];
          assert.equal(Boolean(fact), expected);
          if (expected) expectedMatchCount += 1;
          if (fact) actualMatchCount += 1;
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 17_280);
  assert.equal(actualMatchCount, 640);
  assert.equal(actualMatchCount, expectedMatchCount);

  const classicalCase = getLiurenGuaTiFacts({
    transmissionBranches: ['未', '子', '丑'],
    dayStem: '乙',
    monthBranch: '寅',
    heavenlyDragonGroundBranch: '亥',
  }).find((candidate) => candidate.name === '天狱课');
  assert.ok(classicalCase);
  assert.equal(classicalCase.stableKey, 'liuren:verified-guati:tian-yu');
  assert.deepEqual(classicalCase.matchedConditions, ['初传未于月建寅为死', '天罡辰临日干乙日本亥']);
  assert.match(classicalCase.sourceUrl, /oldid=854578/);
  assert.doesNotMatch(
    classicalCase.matchedConditions.join('；'),
    /刑狱|疾病|死亡|出行|吉|凶|现实事件/,
  );

  const tombOnly = getLiurenGuaTiFacts({
    transmissionBranches: ['未', '子', '丑'],
    dayStem: '乙',
    monthBranch: '巳',
    heavenlyDragonGroundBranch: '亥',
  }).find((candidate) => candidate.name === '天狱课');
  assert.deepEqual(tombOnly?.matchedConditions, ['初传未为日干乙五行墓位', '天罡辰临日干乙日本亥']);

  const generated = generateLiuren(new Date('2024-01-03T22:30:00+08:00'));
  const generatedFact = generated.guaTiFacts.find((candidate) => candidate.name === '天狱课');
  assert.deepEqual(generatedFact?.matchedConditions, [
    '初传辰于月建子为囚',
    '天罡辰临日干丙日本寅',
  ]);
  assert.equal(
    generated.evidenceAnalysis?.traditionalFacts.find(
      (candidate) => candidate.key === 'liuren:verified-guati:tian-yu',
    )?.promptText,
    '盘面命中“天狱课”：初传辰于月建子为囚；天罡辰临日干丙日本寅；只登记课体结构，不据此单断现实吉凶',
  );

  for (const context of [
    {
      transmissionBranches: ['未', '子', '丑'],
      monthBranch: '寅',
      heavenlyDragonGroundBranch: '亥',
    },
    { transmissionBranches: ['未', '子', '丑'], dayStem: '乙', heavenlyDragonGroundBranch: '亥' },
    { transmissionBranches: ['未', '子', '丑'], dayStem: '乙', monthBranch: '寅' },
  ]) {
    assert.equal(
      getLiurenGuaTiFacts(context).some((candidate) => candidate.name === '天狱课'),
      false,
    );
  }
  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['未', '子', '丑'],
        dayStem: '乙',
        monthBranch: '寅',
        heavenlyDragonGroundBranch: '非法',
      }),
    /天罡所临地盘必须是有效地支/,
  );
});

test('大六壬斩关课应按魁罡临日辰发用穷举严格命中，并保留所乘天将', () => {
  let profileCount = 0;
  let matchCount = 0;

  for (const dayStem of TIANGAN) {
    const dayStemResidence = getDayStemResidence(dayStem);
    for (const dayBranch of DIZHI) {
      for (const initial of DIZHI) {
        for (const initialGroundBranch of DIZHI) {
          for (const initialGod of TIANJIANG) {
            const fact = getLiurenGuaTiFacts({
              transmissionBranches: [initial, '子', '丑'],
              transmissionGods: [initialGod, '贵人', '天后'],
              dayStem,
              dayBranch,
              initialGroundBranch,
            }).find((candidate) => candidate.name === '斩关课');
            const expected =
              ['辰', '戌'].includes(initial) &&
              [dayStemResidence, dayBranch].includes(initialGroundBranch);
            assert.equal(Boolean(fact), expected);
            if (fact) matchCount += 1;
            profileCount += 1;
          }
        }
      }
    }
  }

  assert.equal(profileCount, 207_360);
  assert.equal(matchCount, 5_520);

  const ancientPlate = buildHeavenlyPlate({
    monthLeader: '未',
    divinationBranch: '亥',
    noblemanBranch: getNoblemanBranch('甲', '夜占'),
    dayNight: '夜占',
  });
  const ancientResidence = getDayStemResidence('甲');
  const ancientLessons = buildFourLessons({
    heavenlyPlate: ancientPlate,
    dayStem: '甲',
    dayBranch: '寅',
    dayStemResidence: ancientResidence,
    xunKong: getVoidBranches('甲寅'),
  });
  const ancientInitial = resolveInitialTransmission(ancientLessons, {
    dayStem: '甲',
    dayBranch: '寅',
    dayStemResidence: ancientResidence,
    hourStem: '乙',
    hourBranch: '亥',
    heavenlyPlate: ancientPlate,
  });
  assert.equal(ancientInitial.initial, '戌');
  const ancientFact = getLiurenGuaTiFacts({
    transmissionBranches: [
      ancientInitial.initial,
      getUpperByUnder(ancientPlate, ancientInitial.initial),
      getUpperByUnder(ancientPlate, getUpperByUnder(ancientPlate, ancientInitial.initial)),
    ],
    transmissionGods: [
      getPlateItemByBranch(ancientPlate, ancientInitial.initial).god,
      '天后',
      '白虎',
    ],
    dayStem: '甲',
    dayBranch: '寅',
    initialGroundBranch: getPlateItemByBranch(ancientPlate, ancientInitial.initial).under,
  }).find((candidate) => candidate.name === '斩关课');
  assert.ok(ancientFact);
  assert.equal(ancientFact.stableKey, 'liuren:verified-guati:zhan-guan');
  assert.deepEqual(ancientFact.matchedConditions, ['初传戌临日干甲寄宫寅及日支寅并乘六合']);
  assert.match(ancientFact.sourceUrl, /oldid=854576/);
  assert.doesNotMatch(
    `${ancientFact.matchedConditions.join('；')}；${ancientFact.sourceQuote}`,
    /逃亡|出行|疾病|官讼|吉|凶|现实事件/,
  );

  const generated = generateLiuren(new Date('2024-01-01T10:30:00+08:00'));
  const generatedFact = generated.guaTiFacts.find((candidate) => candidate.name === '斩关课');
  assert.deepEqual(generatedFact?.matchedConditions, ['初传戌临日干甲寄宫寅并乘六合']);
  assert.equal(
    generated.evidenceAnalysis?.traditionalFacts.find(
      (candidate) => candidate.key === 'liuren:verified-guati:zhan-guan',
    )?.promptText,
    '盘面命中“斩关课”：初传戌临日干甲寄宫寅并乘六合；只登记课体结构，不据此单断现实吉凶',
  );

  for (const context of [
    {
      transmissionBranches: ['戌', '午', '寅'],
      transmissionGods: ['六合', '天后', '白虎'],
      dayStem: '甲',
      dayBranch: '寅',
    },
  ]) {
    assert.equal(
      getLiurenGuaTiFacts(context).some((candidate) => candidate.name === '斩关课'),
      false,
    );
  }

  const baseFact = getLiurenGuaTiFacts({
    transmissionBranches: ['戌', '午', '寅'],
    dayStem: '甲',
    dayBranch: '寅',
    initialGroundBranch: '寅',
  }).find((candidate) => candidate.name === '斩关课');
  assert.deepEqual(baseFact?.matchedConditions, ['初传戌临日干甲寄宫寅及日支寅']);
});

test('大六壬亨通、闭口与引从课应按严格结构批量穷举并由真实盘复算', () => {
  const elementByBranch: Readonly<Record<string, string>> = {
    子: '水',
    丑: '土',
    寅: '木',
    卯: '木',
    辰: '土',
    巳: '火',
    午: '火',
    未: '土',
    申: '金',
    酉: '金',
    戌: '土',
    亥: '水',
  };
  const elementByStem: Readonly<Record<string, string>> = {
    甲: '木',
    乙: '木',
    丙: '火',
    丁: '火',
    戊: '土',
    己: '土',
    庚: '金',
    辛: '金',
    壬: '水',
    癸: '水',
  };
  const generatedElement: Readonly<Record<string, string>> = {
    木: '火',
    火: '土',
    土: '金',
    金: '水',
    水: '木',
  };
  let hengTongMatches = 0;
  for (const dayStem of TIANGAN) {
    for (const initial of DIZHI) {
      for (const middle of DIZHI) {
        for (const final of DIZHI) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: [initial, middle, final],
            dayStem,
          }).find((candidate) => candidate.name === '亨通课');
          const forward =
            generatedElement[elementByBranch[initial]] === elementByBranch[middle] &&
            generatedElement[elementByBranch[middle]] === elementByBranch[final] &&
            generatedElement[elementByBranch[final]] === elementByStem[dayStem];
          const reverse =
            generatedElement[elementByBranch[final]] === elementByBranch[middle] &&
            generatedElement[elementByBranch[middle]] === elementByBranch[initial] &&
            generatedElement[elementByBranch[initial]] === elementByStem[dayStem];
          assert.equal(Boolean(fact), forward || reverse);
          if (fact) hengTongMatches += 1;
        }
      }
    }
  }
  assert.equal(hengTongMatches, 256);

  let biKouMatches = 0;
  for (const [dayIndex, dayGanZhi] of SIXTY_DAYS.entries()) {
    const xunStartIndex = dayIndex - (dayIndex % 10);
    const xunHeadBranch = SIXTY_DAYS[xunStartIndex].charAt(1);
    const xunTailBranch = SIXTY_DAYS[xunStartIndex + 9].charAt(1);
    for (const initial of DIZHI) {
      for (const initialGroundBranch of DIZHI) {
        const fact = getLiurenGuaTiFacts({
          transmissionBranches: [initial, '子', '丑'],
          dayGanZhi,
          initialGroundBranch,
        }).find((candidate) => candidate.name === '闭口课');
        assert.equal(
          Boolean(fact),
          initial === xunTailBranch && initialGroundBranch === xunHeadBranch,
        );
        if (fact) biKouMatches += 1;
      }
    }
  }
  assert.equal(biKouMatches, 60);

  const isAdjacentPairAround = (first: string, second: string, target: string) => {
    const targetIndex = DIZHI.indexOf(target as (typeof DIZHI)[number]);
    const before = DIZHI[(targetIndex - 1 + DIZHI.length) % DIZHI.length];
    const after = DIZHI[(targetIndex + 1) % DIZHI.length];
    return (first === before && second === after) || (first === after && second === before);
  };
  let yinCongMatches = 0;
  for (const dayStem of TIANGAN) {
    const dayStemResidence = getDayStemResidence(dayStem);
    for (const dayBranch of DIZHI) {
      for (const initialGroundBranch of DIZHI) {
        for (const finalGroundBranch of DIZHI) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: ['子', '寅', '辰'],
            dayStem,
            dayBranch,
            initialGroundBranch,
            finalGroundBranch,
          }).find((candidate) => candidate.name === '引从课');
          const expected =
            isAdjacentPairAround(initialGroundBranch, finalGroundBranch, dayStemResidence) ||
            isAdjacentPairAround(initialGroundBranch, finalGroundBranch, dayBranch);
          assert.equal(Boolean(fact), expected);
          if (fact) yinCongMatches += 1;
        }
      }
    }
  }
  assert.equal(yinCongMatches, 460);

  const classicalCases = [
    getLiurenGuaTiFacts({
      transmissionBranches: ['申', '亥', '寅'],
      dayStem: '丙',
    }).find((candidate) => candidate.name === '亨通课'),
    getLiurenGuaTiFacts({
      transmissionBranches: ['巳', '丑', '酉'],
      dayGanZhi: '甲申',
      initialGroundBranch: '申',
    }).find((candidate) => candidate.name === '闭口课'),
    getLiurenGuaTiFacts({
      transmissionBranches: ['寅', '午', '子'],
      dayStem: '庚',
      dayBranch: '辰',
      initialGroundBranch: '酉',
      finalGroundBranch: '未',
    }).find((candidate) => candidate.name === '引从课'),
  ];
  classicalCases.forEach((fact) => {
    assert.ok(fact);
    assert.match(fact.sourceUrl, /oldid=854576/);
    assert.doesNotMatch(fact.matchedConditions.join('；'), /功名|婚姻|财利|疾病|诉讼|吉|凶/);
  });

  const realCases = [
    { date: '2020-01-01T18:30:00+08:00', name: '亨通课' },
    { date: '2020-01-03T08:30:00+08:00', name: '闭口课' },
    { date: '2020-01-01T04:30:00+08:00', name: '引从课' },
  ];
  for (const item of realCases) {
    const generated = generateLiuren(new Date(item.date));
    const fact = generated.guaTiFacts.find((candidate) => candidate.name === item.name);
    assert.ok(fact, `${item.date}应命中${item.name}`);
    assert.equal(
      generated.evidenceAnalysis?.traditionalFacts.find(
        (candidate) => candidate.key === fact.stableKey,
      )?.promptText,
      `盘面命中“${item.name}”：${fact.matchedConditions.join('；')}；只登记课体结构，不据此单断现实吉凶`,
    );
  }

  assert.throws(
    () =>
      getLiurenGuaTiFacts({
        transmissionBranches: ['寅', '午', '子'],
        dayStem: '庚',
        dayBranch: '辰',
        initialGroundBranch: '酉',
        finalGroundBranch: '非法',
      }),
    /末传所临地盘必须是有效地支/,
  );
});

test('大六壬芜淫、解离与冲破课应按日辰交克和冲神乘破结构批量穷举', () => {
  let wuYinMatches = 0;
  let jieLiMatches = 0;
  for (const dayStem of TIANGAN) {
    for (const dayBranch of DIZHI) {
      for (const stemUpper of DIZHI) {
        for (const branchUpper of DIZHI) {
          const fourLessons = [
            { upper: stemUpper, lower: dayStem },
            { upper: '子', lower: stemUpper },
            { upper: branchUpper, lower: dayBranch },
            { upper: '丑', lower: branchUpper },
          ];
          const facts = getLiurenGuaTiFacts({
            transmissionBranches: ['寅', '卯', '辰'],
            dayStem,
            dayBranch,
            fourLessons,
          });
          const wuYin = facts.find((candidate) => candidate.name === '芜淫课');
          const jieLi = facts.find((candidate) => candidate.name === '解离课');
          assert.equal(
            Boolean(wuYin),
            isBranchKe(stemUpper, dayBranch) && isBranchKe(branchUpper, dayStem),
          );
          assert.equal(
            Boolean(jieLi),
            isBranchKe(dayStem, branchUpper) && isBranchKe(dayBranch, stemUpper),
          );
          if (wuYin) wuYinMatches += 1;
          if (jieLi) jieLiMatches += 1;
        }
      }
    }
  }
  assert.equal(wuYinMatches, 672);
  assert.equal(jieLiMatches, 672);

  let chongPoMatches = 0;
  for (const dayBranch of DIZHI) {
    for (const initial of DIZHI) {
      for (const initialGroundBranch of DIZHI) {
        const fact = getLiurenGuaTiFacts({
          transmissionBranches: [initial, '子', '丑'],
          dayBranch,
          initialGroundBranch,
        }).find((candidate) => candidate.name === '冲破课');
        assert.equal(
          Boolean(fact),
          initial === LIUCHONG_MAP[dayBranch] && initialGroundBranch === LIUPO_MAP[initial],
        );
        if (fact) chongPoMatches += 1;
      }
    }
  }
  assert.equal(chongPoMatches, 12);

  const classicalCases = [
    getLiurenGuaTiFacts({
      transmissionBranches: ['寅', '卯', '辰'],
      dayStem: '甲',
      dayBranch: '子',
      fourLessons: [
        { upper: '戌', lower: '甲' },
        { upper: '子', lower: '戌' },
        { upper: '申', lower: '子' },
        { upper: '丑', lower: '申' },
      ],
    }).find((candidate) => candidate.name === '芜淫课'),
    getLiurenGuaTiFacts({
      transmissionBranches: ['寅', '卯', '辰'],
      dayStem: '甲',
      dayBranch: '子',
      fourLessons: [
        { upper: '午', lower: '甲' },
        { upper: '子', lower: '午' },
        { upper: '辰', lower: '子' },
        { upper: '丑', lower: '辰' },
      ],
    }).find((candidate) => candidate.name === '解离课'),
    getLiurenGuaTiFacts({
      transmissionBranches: ['午', '申', '戌'],
      dayStem: '庚',
      dayBranch: '子',
      initialGroundBranch: '卯',
    }).find((candidate) => candidate.name === '冲破课'),
  ];
  classicalCases.forEach((fact) => {
    assert.ok(fact);
    assert.match(fact.sourceUrl, /oldid=854578/);
    assert.doesNotMatch(fact.matchedConditions.join('；'), /婚姻|淫乱|疾病|诉讼|吉|凶/);
  });

  const realCases = [
    { date: '2018-01-01T04:30:00+08:00', name: '芜淫课' },
    { date: '2018-01-02T12:30:00+08:00', name: '解离课' },
    { date: '2018-01-03T08:30:00+08:00', name: '冲破课' },
  ];
  for (const item of realCases) {
    const generated = generateLiuren(new Date(item.date));
    const fact = generated.guaTiFacts.find((candidate) => candidate.name === item.name);
    assert.ok(fact, `${item.date}应命中${item.name}`);
    assert.equal(
      generated.evidenceAnalysis?.traditionalFacts.find(
        (candidate) => candidate.key === fact.stableKey,
      )?.promptText,
      `盘面命中“${item.name}”：${fact.matchedConditions.join('；')}；只登记课体结构，不据此单断现实吉凶`,
    );
  }
});

test('大六壬干支生合与固定关系十七类课体应按同一批输入轮廓严格命中', () => {
  const generates: Readonly<Record<string, string>> = {
    木: '火',
    火: '土',
    土: '金',
    金: '水',
    水: '木',
  };
  const tombByElement: Readonly<Record<string, string>> = {
    木: '未',
    火: '戌',
    土: '辰',
    金: '丑',
    水: '辰',
  };
  const matchCounts = new Map([
    ['俱生格', 0],
    ['互生格', 0],
    ['自在格', 0],
    ['壮基格', 0],
    ['培本格', 0],
    ['互旺格', 0],
    ['和美课', 0],
    ['外好里槎枒格', 0],
    ['互乘墓神格', 0],
    ['四胜煞格', 0],
    ['干支全伤', 0],
    ['干支上下相合格', 0],
    ['干支上神相合格', 0],
    ['干支上下六害', 0],
    ['干支上神相害格', 0],
    ['交车六害格', 0],
    ['交车相脱格', 0],
  ]);
  let profileCount = 0;

  for (const dayStem of TIANGAN) {
    const dayStemElement = getGanZhiWuxing(dayStem);
    const stemResidence = getDayStemResidence(dayStem);
    for (const dayBranch of DIZHI) {
      const dayBranchElement = getGanZhiWuxing(dayBranch);
      for (const stemUpper of DIZHI) {
        const stemUpperElement = getGanZhiWuxing(stemUpper);
        for (const branchUpper of DIZHI) {
          const branchUpperElement = getGanZhiWuxing(branchUpper);
          const facts = new Map(
            getLiurenGuaTiFacts({
              transmissionBranches: ['子', '丑', '寅'],
              dayStem,
              dayBranch,
              fourLessons: [
                { upper: stemUpper, lower: dayStem },
                { upper: '子', lower: stemUpper },
                { upper: branchUpper, lower: dayBranch },
                { upper: '丑', lower: branchUpper },
              ],
            }).map((fact) => [fact.name, fact]),
          );
          const day = `${dayStem}${dayBranch}`;
          const expected = new Map<string, boolean>([
            [
              '俱生格',
              generates[stemUpperElement] === dayStemElement &&
                generates[branchUpperElement] === dayBranchElement,
            ],
            [
              '互生格',
              generates[stemUpperElement] === dayBranchElement &&
                generates[branchUpperElement] === dayStemElement,
            ],
            ['自在格', stemUpper === dayBranch && generates[dayBranchElement] === dayStemElement],
            [
              '壮基格',
              stemUpper === dayBranch && dayBranchElement === dayStemElement,
            ],
            [
              '培本格',
              branchUpper === stemResidence && dayBranchElement === dayStemElement,
            ],
            [
              '互旺格',
              (day === '甲申' && stemUpper === '酉' && branchUpper === '卯') ||
                (day === '庚寅' && stemUpper === '卯' && branchUpper === '酉'),
            ],
            [
              '和美课',
              LIUHE_MAP[stemUpper] === dayBranch && LIUHE_MAP[branchUpper] === stemResidence,
            ],
            [
              '外好里槎枒格',
              LIUHE_MAP[stemUpper] === branchUpper && LIUHAI_MAP[stemResidence] === dayBranch,
            ],
            [
              '互乘墓神格',
              stemUpper === tombByElement[dayBranchElement] &&
                branchUpper === tombByElement[dayStemElement],
            ],
            [
              '四胜煞格',
              (stemUpper === '酉' && branchUpper === '午') ||
                (stemUpper === '午' && branchUpper === '酉'),
            ],
            ['干支全伤', isBranchKe(stemUpper, dayStem) && isBranchKe(branchUpper, dayBranch)],
            [
              '干支上下相合格',
              LIUHE_MAP[stemUpper] === stemResidence && LIUHE_MAP[branchUpper] === dayBranch,
            ],
            ['干支上神相合格', LIUHE_MAP[stemUpper] === branchUpper],
            [
              '干支上下六害',
              LIUHAI_MAP[stemUpper] === stemResidence && LIUHAI_MAP[branchUpper] === dayBranch,
            ],
            ['干支上神相害格', LIUHAI_MAP[stemUpper] === branchUpper],
            [
              '交车六害格',
              LIUHAI_MAP[stemUpper] === dayBranch && LIUHAI_MAP[branchUpper] === stemResidence,
            ],
            [
              '交车相脱格',
              generates[dayBranchElement] === stemUpperElement &&
                generates[dayStemElement] === branchUpperElement,
            ],
          ]);

          for (const [name, shouldMatch] of expected) {
            const fact = facts.get(name);
            assert.equal(
              Boolean(fact),
              shouldMatch,
              `${day}日、干上${stemUpper}、支上${branchUpper}的${name}边界不一致`,
            );
            if (fact) matchCounts.set(name, (matchCounts.get(name) || 0) + 1);
          }
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 17_280);
  assert.equal(matchCounts.get('互旺格'), 2);
  for (const [name, count] of matchCounts) assert.ok(count > 0, `${name}必须存在可命中轮廓`);

  const getClassicalFact = (
    name: string,
    dayStem: string,
    dayBranch: string,
    stemUpper: string,
    branchUpper: string,
  ) =>
    getLiurenGuaTiFacts({
      transmissionBranches: ['子', '丑', '寅'],
      dayStem,
      dayBranch,
      fourLessons: [
        { upper: stemUpper, lower: dayStem },
        { upper: '子', lower: stemUpper },
        { upper: branchUpper, lower: dayBranch },
        { upper: '丑', lower: branchUpper },
      ],
    }).find((fact) => fact.name === name);
  const classicalFacts = [
    getClassicalFact('俱生格', '丙', '寅', '寅', '亥'),
    getClassicalFact('互生格', '辛', '卯', '亥', '辰'),
    getClassicalFact('自在格', '甲', '子', '子', '寅'),
    getClassicalFact('壮基格', '甲', '寅', '寅', '子'),
    getClassicalFact('培本格', '甲', '卯', '子', '寅'),
    getClassicalFact('互旺格', '甲', '申', '酉', '卯'),
    getClassicalFact('和美课', '甲', '子', '丑', '亥'),
    getClassicalFact('外好里槎枒格', '壬', '申', '寅', '亥'),
    getClassicalFact('互乘墓神格', '戊', '寅', '未', '辰'),
    getClassicalFact('四胜煞格', '甲', '子', '酉', '午'),
    getClassicalFact('干支全伤', '丁', '亥', '子', '辰'),
    getClassicalFact('干支上下相合格', '甲', '申', '亥', '巳'),
    getClassicalFact('干支上神相合格', '戊', '辰', '丑', '子'),
    getClassicalFact('干支上下六害', '甲', '申', '巳', '亥'),
    getClassicalFact('干支上神相害格', '辛', '卯', '未', '子'),
    getClassicalFact('交车六害格', '丁', '丑', '午', '子'),
    getClassicalFact('交车相脱格', '壬', '午', '未', '寅'),
  ];
  assert.ok(classicalFacts.every(Boolean));
  assert.ok(
    classicalFacts.every((fact) => ['干支生合', '干支固定关系'].includes(fact?.category || '')),
  );
  assert.ok(classicalFacts.every((fact) => /oldid=8545(?:74|76|78|81)$/.test(fact?.sourceUrl || '')));
  assert.ok(
    classicalFacts.every(
      (fact) =>
        !/疾病|官讼|灾祸|婚姻|吉凶|现实事件/.test(
          `${fact?.matchedConditions.join('；')}；${fact?.sourceQuote}`,
        ),
    ),
  );
});

test('大六壬泆女与狡童应按初末传天将和卯酉发用严格命中', () => {
  const expectedMatchCounts = new Map([
    ['泆女格', 0],
    ['狡童格', 0],
  ]);
  let profileCount = 0;

  for (const initial of DIZHI) {
    for (const final of DIZHI) {
      for (const initialGod of TIANJIANG) {
        for (const finalGod of TIANJIANG) {
          const facts = getLiurenGuaTiFacts({
            transmissionBranches: [initial, '子', final],
            transmissionGods: [initialGod, '贵人', finalGod],
          });
          const matchedNames = new Set(facts.map((fact) => fact.name));
          const expectYiNv =
            ['卯', '酉'].includes(initial) && initialGod === '天后' && finalGod === '六合';
          const expectJiaoTong =
            ['卯', '酉'].includes(initial) && initialGod === '六合' && finalGod === '天后';

          assert.equal(matchedNames.has('泆女格'), expectYiNv);
          assert.equal(matchedNames.has('狡童格'), expectJiaoTong);
          if (expectYiNv) expectedMatchCounts.set('泆女格', expectedMatchCounts.get('泆女格')! + 1);
          if (expectJiaoTong) {
            expectedMatchCounts.set('狡童格', expectedMatchCounts.get('狡童格')! + 1);
          }
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 20_736);
  assert.deepEqual(Object.fromEntries(expectedMatchCounts), { 泆女格: 24, 狡童格: 24 });

  const yiNv = getLiurenGuaTiFacts({
    transmissionBranches: ['卯', '子', '申'],
    transmissionGods: ['天后', '贵人', '六合'],
  }).find((fact) => fact.name === '泆女格');
  const jiaoTong = getLiurenGuaTiFacts({
    transmissionBranches: ['酉', '子', '寅'],
    transmissionGods: ['六合', '贵人', '天后'],
  }).find((fact) => fact.name === '狡童格');
  assert.ok(yiNv);
  assert.ok(jiaoTong);
  assert.equal(yiNv.stableKey, 'liuren:verified-guati:yi-nv');
  assert.equal(jiaoTong.stableKey, 'liuren:verified-guati:jiao-tong');
  assert.equal(yiNv.category, '三传天将');
  assert.equal(jiaoTong.category, '三传天将');
  assert.doesNotMatch(
    `${yiNv.matchedConditions.join('；')}；${jiaoTong.matchedConditions.join('；')}`,
    /婚姻|私奔|淫乱|吉|凶|现实事件/,
  );

  const realCases = [
    {
      date: new Date('2024-01-08T10:00:00+08:00'),
      name: '狡童格',
      condition: '初传卯乘六合，末传未乘天后',
    },
    {
      date: new Date('2024-03-12T02:00:00+08:00'),
      name: '泆女格',
      condition: '初传酉乘天后，末传巳乘六合',
    },
  ] as const;
  for (const item of realCases) {
    const data = generateLiuren(item.date);
    const fact = data.guaTiFacts.find((candidate) => candidate.name === item.name);
    assert.ok(fact, `${item.name}应由真实起盘命中`);
    assert.deepEqual(fact.matchedConditions, [item.condition]);
    const promptFact = data.evidenceAnalysis?.traditionalFacts.find(
      (candidate) => candidate.key === fact.stableKey,
    );
    assert.equal(
      promptFact?.promptText,
      `盘面命中“${item.name}”：${item.condition}；只登记课体结构，不据此单断现实吉凶`,
    );
  }
});

test('大六壬九丑课应区分丑发用正文与不发用临支订讹', () => {
  const jiuChouDays = new Set([
    '乙卯',
    '乙酉',
    '戊子',
    '戊午',
    '己卯',
    '己酉',
    '辛卯',
    '辛酉',
    '壬子',
    '壬午',
  ]);
  let profileCount = 0;
  let matchCount = 0;

  for (const dayGanZhi of SIXTY_DAYS) {
    const dayBranch = dayGanZhi.charAt(1);
    for (const hourBranch of DIZHI) {
      for (const greatAuspiciousGroundBranch of DIZHI) {
        for (const initial of ['丑', '子']) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: [initial, '申', '辰'],
            dayGanZhi,
            dayStem: dayGanZhi.charAt(0),
            dayBranch,
            hourBranch,
            greatAuspiciousGroundBranch,
          }).find((item) => item.name === '九丑课');
          const expected =
            jiuChouDays.has(dayGanZhi) &&
            ['子', '午', '卯', '酉'].includes(hourBranch) &&
            greatAuspiciousGroundBranch === dayBranch;
          assert.equal(
            !!fact,
            expected,
            `${dayGanZhi}日、${hourBranch}时、${initial}发用、大吉临${greatAuspiciousGroundBranch}边界不一致`,
          );
          if (fact) matchCount += 1;
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 17_280);
  assert.equal(matchCount, 80);

  const fact = getLiurenGuaTiFacts({
    transmissionBranches: ['丑', '申', '辰'],
    dayGanZhi: '乙酉',
    dayBranch: '酉',
    hourBranch: '子',
    greatAuspiciousGroundBranch: '酉',
  }).find((item) => item.name === '九丑课');
  assert.ok(fact);
  assert.equal(fact.stableKey, 'liuren:verified-guati:jiu-chou');
  assert.equal(fact.category, '大吉临仲');
  assert.deepEqual(fact.branches, ['丑', '酉', '子']);
  assert.deepEqual(fact.matchedConditions, [
    '日柱乙酉为九丑十日之一，四仲时子占，天盘大吉丑临日支酉并发用',
  ]);
  const correctionFact = getLiurenGuaTiFacts({
    transmissionBranches: ['子', '申', '辰'],
    dayGanZhi: '乙酉',
    dayBranch: '酉',
    hourBranch: '子',
    greatAuspiciousGroundBranch: '酉',
  }).find((item) => item.name === '九丑课');
  assert.deepEqual(correctionFact?.matchedConditions, [
    '日柱乙酉为九丑十日之一，四仲时子占，天盘大吉丑临日支酉，依《订讹》不发用而临支上者亦是',
  ]);
  assert.doesNotMatch(
    `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
    /灾|婚姻|疾病|刑狱|死亡|吉凶|现实事件/,
  );
});

test('大六壬伏殃卦应按十二月天鬼临日辰发用轮廓整批穷举', () => {
  const monthBranches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const heavenlyGhostByMonth = [
    '酉',
    '午',
    '卯',
    '子',
    '酉',
    '午',
    '卯',
    '子',
    '酉',
    '午',
    '卯',
    '子',
  ];
  let profileCount = 0;
  let matchCount = 0;

  monthBranches.forEach((monthBranch, monthIndex) => {
    for (const initial of DIZHI) {
      for (const initialGround of DIZHI) {
        const fact = getLiurenGuaTiFacts({
          transmissionBranches: [initial, '丑', '寅'],
          transmissionGroundBranches: [initialGround, '寅', '卯'],
          dayStem: '甲',
          dayBranch: '子',
          monthBranch,
        }).find((item) => item.name === '伏殃卦');
        const expected =
          initial === heavenlyGhostByMonth[monthIndex] && ['寅', '子'].includes(initialGround);
        assert.equal(
          !!fact,
          expected,
          `${monthBranch}月、${initial}发用、临${initialGround}的伏殃边界不一致`,
        );
        if (fact) matchCount += 1;
        profileCount += 1;
      }
    }
  });

  assert.equal(profileCount, 1_728);
  assert.equal(matchCount, 24);
  const fact = getLiurenGuaTiFacts({
    transmissionBranches: ['酉', '丑', '寅'],
    transmissionGroundBranches: ['子', '寅', '卯'],
    dayStem: '甲',
    dayBranch: '子',
    monthBranch: '寅',
  }).find((item) => item.name === '伏殃卦');
  assert.ok(fact);
  assert.deepEqual(fact.matchedConditions, ['月建寅所起天鬼酉临日支子发用']);
  assert.doesNotMatch(
    `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
    /疾病|伤亡|吉凶结论|现实事件/,
  );
});

test('大六壬撞干撞支应按日干寄宫与日支前一位整批穷举', () => {
  let profileCount = 0;
  let stemMatchCount = 0;
  let branchMatchCount = 0;

  for (const dayStem of TIANGAN) {
    const stemResidence = getDayStemResidence(dayStem);
    const stemBarrier = DIZHI[(DIZHI.indexOf(stemResidence as (typeof DIZHI)[number]) + 11) % 12];
    for (const dayBranch of DIZHI) {
      const branchBarrier = DIZHI[(DIZHI.indexOf(dayBranch) + 11) % 12];
      for (const initial of DIZHI) {
        for (const final of DIZHI) {
          const facts = getLiurenGuaTiFacts({
            transmissionBranches: [initial, '子', final],
            dayStem,
            dayBranch,
          });
          const stemFact = facts.find((item) => item.name === '撞干格');
          const branchFact = facts.find((item) => item.name === '撞支格');
          const expectedStem = initial === stemBarrier || final === stemBarrier;
          const expectedBranch = initial === branchBarrier || final === branchBarrier;
          assert.equal(
            !!stemFact,
            expectedStem,
            `${dayStem}寄宫${stemResidence}、三传${initial}子${final}的撞干边界不一致`,
          );
          assert.equal(
            !!branchFact,
            expectedBranch,
            `${dayBranch}支、三传${initial}子${final}的撞支边界不一致`,
          );
          if (stemFact) stemMatchCount += 1;
          if (branchFact) branchMatchCount += 1;
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 17_280);
  assert.equal(stemMatchCount, 2_760);
  assert.equal(branchMatchCount, 2_760);
  const fact = getLiurenGuaTiFacts({
    transmissionBranches: ['丑', '亥', '酉'],
    dayStem: '辛',
    dayBranch: '巳',
  }).find((item) => item.name === '撞干格');
  assert.ok(fact);
  assert.equal(fact.category, '日辰关隔');
  assert.deepEqual(fact.matchedConditions, ['日干辛寄宫戌的前一位关隔为酉，末传撞关']);
  assert.doesNotMatch(
    `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
    /事急|吉凶|疾病|现实事件/,
  );
});

test('大六壬魄化课应按逐月死神死气、囚死、白虎与临日辰条件整批穷举', () => {
  const monthBranches = ['寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑'];
  const deadSpiritByMonth = [
    '巳',
    '午',
    '未',
    '申',
    '酉',
    '戌',
    '亥',
    '子',
    '丑',
    '寅',
    '卯',
    '辰',
  ];
  const deadQiByMonth = ['午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳'];
  let profileCount = 0;
  let expectedMatchCount = 0;
  let matchCount = 0;

  monthBranches.forEach((monthBranch, monthIndex) => {
    for (const initial of DIZHI) {
      for (const initialGround of DIZHI) {
        for (const initialGod of TIANJIANG) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: [initial, '丑', '寅'],
            transmissionGods: [initialGod, '六合', '青龙'],
            transmissionGroundBranches: [initialGround, '寅', '卯'],
            dayStem: '甲',
            dayBranch: '子',
            monthBranch,
          }).find((item) => item.name === '魄化课');
          const seasonState = getSeasonState(getGanZhiWuxing(initial), monthBranch);
          const expected =
            [deadSpiritByMonth[monthIndex], deadQiByMonth[monthIndex]].includes(initial) &&
            ['囚', '死'].includes(seasonState) &&
            initialGod === '白虎' &&
            ['寅', '子'].includes(initialGround);
          assert.equal(
            !!fact,
            expected,
            `${monthBranch}月、${initial}发用乘${initialGod}、临${initialGround}、月令${seasonState}的魄化边界不一致`,
          );
          if (expected) expectedMatchCount += 1;
          if (fact) matchCount += 1;
          profileCount += 1;
        }
      }
    }
  });

  assert.equal(profileCount, 20_736);
  assert.equal(matchCount, expectedMatchCount);
  assert.ok(matchCount > 0);
  const fact = getLiurenGuaTiFacts({
    transmissionBranches: ['未', '丑', '寅'],
    transmissionGods: ['白虎', '六合', '青龙'],
    transmissionGroundBranches: ['寅', '寅', '卯'],
    dayStem: '甲',
    dayBranch: '子',
    monthBranch: '卯',
  }).find((item) => item.name === '魄化课');
  assert.ok(fact);
  assert.deepEqual(fact.matchedConditions, [
    '月建卯所起死气未发用乘白虎，月令为死并临日干甲寄宫寅',
  ]);
  assert.doesNotMatch(
    `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
    /疾病|伤亡|死亡结论|吉凶结论|现实事件/,
  );
});

test('大六壬旬首旬尾与干支首末传四格应按完整位置轮廓整批穷举', () => {
  let cycleProfileCount = 0;
  let cycleMatchCount = 0;
  for (const [dayIndex, dayGanZhi] of SIXTY_DAYS.entries()) {
    const xunHead = SIXTY_DAYS[Math.floor(dayIndex / 10) * 10].charAt(1);
    const xunTail = DIZHI[(DIZHI.indexOf(xunHead as (typeof DIZHI)[number]) + 9) % 12];
    for (const stemUpper of DIZHI) {
      for (const branchUpper of DIZHI) {
        const fact = getLiurenGuaTiFacts({
          transmissionBranches: ['子', '丑', '寅'],
          dayGanZhi,
          fourLessons: [
            { upper: stemUpper, lower: dayGanZhi.charAt(0) },
            { upper: '子', lower: stemUpper },
            { upper: branchUpper, lower: dayGanZhi.charAt(1) },
            { upper: '子', lower: branchUpper },
          ],
        }).find((item) => item.name === '周而复始格');
        const expected =
          (stemUpper === xunTail && branchUpper === xunHead) ||
          (stemUpper === xunHead && branchUpper === xunTail);
        if (!!fact !== expected) {
          assert.fail(`${dayGanZhi}日干上${stemUpper}、支上${branchUpper}的旬首旬尾边界不一致`);
        }
        if (fact) cycleMatchCount += 1;
        cycleProfileCount += 1;
      }
    }
  }
  assert.equal(cycleProfileCount, 8_640);
  assert.equal(cycleMatchCount, 120);

  let transferProfileCount = 0;
  let branchToStemCount = 0;
  let stemToBranchCount = 0;
  for (const initial of DIZHI) {
    for (const final of DIZHI) {
      for (const stemUpper of DIZHI) {
        for (const branchUpper of DIZHI) {
          const names = new Set(
            getLiurenGuaTiFacts({
              transmissionBranches: [initial, '子', final],
              fourLessons: [
                { upper: stemUpper, lower: '甲' },
                { upper: '子', lower: stemUpper },
                { upper: branchUpper, lower: '子' },
                { upper: '子', lower: branchUpper },
              ],
            }).map((item) => item.name),
          );
          const expectedBranchToStem = initial === branchUpper && final === stemUpper;
          const expectedStemToBranch = initial === stemUpper && final === branchUpper;
          if (names.has('支传干格') !== expectedBranchToStem) {
            assert.fail(
              `初${initial}末${final}、干上${stemUpper}支上${branchUpper}的支传干边界不一致`,
            );
          }
          if (names.has('干传支格') !== expectedStemToBranch) {
            assert.fail(
              `初${initial}末${final}、干上${stemUpper}支上${branchUpper}的干传支边界不一致`,
            );
          }
          if (expectedBranchToStem) branchToStemCount += 1;
          if (expectedStemToBranch) stemToBranchCount += 1;
          transferProfileCount += 1;
        }
      }
    }
  }
  assert.equal(transferProfileCount, 20_736);
  assert.equal(branchToStemCount, 144);
  assert.equal(stemToBranchCount, 144);
});

test('大六壬自生传墓与自墓传生应按十干首末传轮廓整批穷举', () => {
  const originByStem: Readonly<Record<string, string>> = {
    甲: '亥',
    乙: '亥',
    丙: '寅',
    丁: '寅',
    戊: '申',
    己: '申',
    庚: '巳',
    辛: '巳',
    壬: '申',
    癸: '申',
  };
  const tombByStem: Readonly<Record<string, string>> = {
    甲: '未',
    乙: '未',
    丙: '戌',
    丁: '戌',
    戊: '辰',
    己: '辰',
    庚: '丑',
    辛: '丑',
    壬: '辰',
    癸: '辰',
  };
  let profileCount = 0;
  let birthToTombCount = 0;
  let tombToBirthCount = 0;
  for (const dayStem of TIANGAN) {
    for (const initial of DIZHI) {
      for (const final of DIZHI) {
        const names = new Set(
          getLiurenGuaTiFacts({
            transmissionBranches: [initial, '子', final],
            dayStem,
          }).map((item) => item.name),
        );
        const expectedBirthToTomb =
          initial === originByStem[dayStem] && final === tombByStem[dayStem];
        const expectedTombToBirth =
          initial === tombByStem[dayStem] && final === originByStem[dayStem];
        if (names.has('自生传墓格') !== expectedBirthToTomb) {
          assert.fail(`${dayStem}日初${initial}末${final}的自生传墓边界不一致`);
        }
        if (names.has('自墓传生格') !== expectedTombToBirth) {
          assert.fail(`${dayStem}日初${initial}末${final}的自墓传生边界不一致`);
        }
        if (expectedBirthToTomb) birthToTombCount += 1;
        if (expectedTombToBirth) tombToBirthCount += 1;
        profileCount += 1;
      }
    }
  }
  assert.equal(profileCount, 1_440);
  assert.equal(birthToTombCount, 10);
  assert.equal(tombToBirthCount, 10);
});

test('大六壬魁度天门、罡塞鬼户与干支罗网应按天地盘和干支位置整批穷举', () => {
  let gateProfileCount = 0;
  let kuiMatchCount = 0;
  let gangMatchCount = 0;
  for (const initial of DIZHI) {
    for (const initialGround of DIZHI) {
      for (const dragonGround of DIZHI) {
        const names = new Set(
          getLiurenGuaTiFacts({
            transmissionBranches: [initial, '子', '丑'],
            transmissionGroundBranches: [initialGround, '寅', '卯'],
            heavenlyDragonGroundBranch: dragonGround,
          }).map((item) => item.name),
        );
        const expectedKui = initial === '戌' && initialGround === '亥';
        const expectedGang = dragonGround === '寅';
        if (names.has('魁度天门格') !== expectedKui) {
          assert.fail(`初传${initial}临${initialGround}的魁度天门边界不一致`);
        }
        if (names.has('罡塞鬼户格') !== expectedGang) {
          assert.fail(`天罡临${dragonGround}的罡塞鬼户边界不一致`);
        }
        if (expectedKui) kuiMatchCount += 1;
        if (expectedGang) gangMatchCount += 1;
        gateProfileCount += 1;
      }
    }
  }
  assert.equal(gateProfileCount, 1_728);
  assert.equal(kuiMatchCount, 12);
  assert.equal(gangMatchCount, 144);

  let netProfileCount = 0;
  let netMatchCount = 0;
  for (const dayStem of TIANGAN) {
    const stemResidence = getDayStemResidence(dayStem);
    const stemNet = DIZHI[(DIZHI.indexOf(stemResidence as (typeof DIZHI)[number]) + 1) % 12];
    for (const dayBranch of DIZHI) {
      const branchNet = DIZHI[(DIZHI.indexOf(dayBranch) + 1) % 12];
      for (const stemUpper of DIZHI) {
        for (const branchUpper of DIZHI) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: ['子', '丑', '寅'],
            dayStem,
            dayBranch,
            fourLessons: [
              { upper: stemUpper, lower: dayStem },
              { upper: '子', lower: stemUpper },
              { upper: branchUpper, lower: dayBranch },
              { upper: '子', lower: branchUpper },
            ],
          }).find((item) => item.name === '干支罗网格');
          const expected = stemUpper === stemNet && branchUpper === branchNet;
          if (!!fact !== expected) {
            assert.fail(`${dayStem}${dayBranch}干上${stemUpper}支上${branchUpper}的罗网边界不一致`);
          }
          if (fact) netMatchCount += 1;
          netProfileCount += 1;
        }
      }
    }
  }
  assert.equal(netProfileCount, 17_280);
  assert.equal(netMatchCount, 120);
});

test('大六壬三六合与合中犯杀应按全部三传和干支上神轮廓整批穷举', () => {
  const sanheSpecs: ReadonlyArray<{
    sanhe: readonly string[];
    companion: string;
    offenders: readonly string[];
  }> = [
    { sanhe: ['寅', '午', '戌'], companion: '未', offenders: ['午', '丑', '子'] },
    { sanhe: ['亥', '卯', '未'], companion: '戌', offenders: ['子', '辰', '酉'] },
    { sanhe: ['申', '子', '辰'], companion: '丑', offenders: ['卯', '未', '午'] },
    { sanhe: ['巳', '酉', '丑'], companion: '辰', offenders: ['酉', '戌', '卯'] },
  ];
  let profileCount = 0;
  let sanLiuheMatchCount = 0;
  let offenderMatchCount = 0;
  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        const transmissions = [initial, middle, final];
        const spec = sanheSpecs.find(
          (candidate) =>
            new Set(transmissions).size === 3 &&
            candidate.sanhe.every((branch) =>
              transmissions.includes(branch as (typeof DIZHI)[number]),
            ),
        );
        for (const stemUpper of DIZHI) {
          for (const branchUpper of DIZHI) {
            const names = new Set(
              getLiurenGuaTiFacts({
                transmissionBranches: transmissions,
                fourLessons: [
                  { upper: stemUpper, lower: '甲' },
                  { upper: '子', lower: stemUpper },
                  { upper: branchUpper, lower: '子' },
                  { upper: '子', lower: branchUpper },
                ],
              }).map((item) => item.name),
            );
            const expectedSanLiuhe =
              !!spec && [stemUpper, branchUpper].includes(spec.companion as (typeof DIZHI)[number]);
            const expectedOffender =
              !!spec && [stemUpper, branchUpper].some((branch) => spec.offenders.includes(branch));
            if (names.has('三六合格') !== expectedSanLiuhe) {
              assert.fail(
                `三传${transmissions.join('')}、干上${stemUpper}支上${branchUpper}的三六合边界不一致`,
              );
            }
            if (names.has('合中犯杀格') !== expectedOffender) {
              assert.fail(
                `三传${transmissions.join('')}、干上${stemUpper}支上${branchUpper}的合中犯杀边界不一致`,
              );
            }
            if (expectedSanLiuhe) sanLiuheMatchCount += 1;
            if (expectedOffender) offenderMatchCount += 1;
            profileCount += 1;
          }
        }
      }
    }
  }
  assert.equal(profileCount, 248_832);
  assert.equal(sanLiuheMatchCount, 552);
  assert.equal(offenderMatchCount, 1_512);
});

test('大六壬六旬仪奇课体应按六十日柱乘十二发用穷举严格命中', () => {
  const xunHeads = ['甲子', '甲戌', '甲申', '甲午', '甲辰', '甲寅'] as const;
  const xunQiByHead: Readonly<Record<string, string>> = {
    甲子: '丑',
    甲戌: '丑',
    甲申: '子',
    甲午: '子',
    甲辰: '亥',
    甲寅: '亥',
  };
  let profileCount = 0;
  let liuYiMatchCount = 0;
  let sanQiMatchCount = 0;

  for (const [dayIndex, dayGanZhi] of SIXTY_DAYS.entries()) {
    const xunHead = xunHeads[Math.floor(dayIndex / 10)];
    assert.ok(xunHead);
    const xunInstrument = xunHead.charAt(1);
    const xunQi = xunQiByHead[xunHead];
    assert.ok(xunQi);

    for (const initial of DIZHI) {
      const facts = getLiurenGuaTiFacts({
        transmissionBranches: [initial, '巳', '酉'],
        dayGanZhi,
        dayStem: dayGanZhi.charAt(0),
        dayBranch: dayGanZhi.charAt(1),
      });
      const liuYi = facts.find((item) => item.name === '六仪课');
      const sanQi = facts.find((item) => item.name === '三奇课');
      assert.equal(
        !!liuYi,
        initial === xunInstrument,
        `${dayGanZhi}日、${initial}发用的六仪边界不一致`,
      );
      assert.equal(!!sanQi, initial === xunQi, `${dayGanZhi}日、${initial}发用的旬奇边界不一致`);
      if (liuYi) liuYiMatchCount += 1;
      if (sanQi) sanQiMatchCount += 1;
      profileCount += 1;
    }
  }

  assert.equal(profileCount, 720);
  assert.equal(liuYiMatchCount, 60);
  assert.equal(sanQiMatchCount, 60);

  const liuYi = getLiurenGuaTiFacts({
    transmissionBranches: ['子', '申', '丑'],
    dayGanZhi: '乙丑',
  }).find((item) => item.name === '六仪课');
  assert.ok(liuYi);
  assert.equal(liuYi.stableKey, 'liuren:verified-guati:liu-yi');
  assert.equal(liuYi.category, '旬仪发用');
  assert.deepEqual(liuYi.matchedConditions, ['日柱乙丑属甲子旬，旬首地支子发用']);
  assert.equal(liuYi.sourceQuote, '旬首发用为六仪。');

  const sanQi = getLiurenGuaTiFacts({
    transmissionBranches: ['丑', '申', '子'],
    dayGanZhi: '乙丑',
  }).find((item) => item.name === '三奇课');
  assert.ok(sanQi);
  assert.equal(sanQi.stableKey, 'liuren:verified-guati:xun-san-qi');
  assert.equal(sanQi.category, '旬奇发用');
  assert.deepEqual(sanQi.matchedConditions, ['日柱乙丑属甲子旬，旬奇丑发用']);
  assert.match(sanQi.sourceQuote, /三奇发用.+子戌旬奇在丑/);

  const middleAndFinalOnly = getLiurenGuaTiFacts({
    transmissionBranches: ['申', '子', '丑'],
    dayGanZhi: '乙丑',
  });
  assert.ok(!middleAndFinalOnly.some((item) => item.name === '六仪课'));
  assert.ok(!middleAndFinalOnly.some((item) => item.name === '三奇课'));
  assert.ok(
    !getLiurenGuaTiFacts({ transmissionBranches: ['子', '申', '丑'] }).some(
      (item) => item.name === '六仪课',
    ),
  );
  assert.ok(
    !getLiurenGuaTiFacts({ transmissionBranches: ['丑', '申', '子'] }).some(
      (item) => item.name === '三奇课',
    ),
  );

  for (const fact of [liuYi, sanQi]) {
    assert.doesNotMatch(
      `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
      /疾病|刑狱|灾|吉庆|吉凶|现实事件/,
    );
  }
});

test('大六壬日干受克发用课体应在完整轮廓中严格命中', () => {
  let tianWangProfileCount = 0;
  for (const dayStem of TIANGAN) {
    for (const hourBranch of DIZHI) {
      for (const initial of DIZHI) {
        const fact = getLiurenGuaTiFacts({
          transmissionBranches: [initial, '寅', '辰'],
          dayStem,
          hourBranch,
        }).find((item) => item.name === '天网卦');
        assert.equal(
          !!fact,
          isBranchKe(hourBranch, dayStem) && isBranchKe(initial, dayStem),
          `${dayStem}日、${hourBranch}时、${initial}发用的天网边界不一致`,
        );
        tianWangProfileCount += 1;
      }
    }
  }
  assert.equal(tianWangProfileCount, 1_440);

  let luanShouProfileCount = 0;
  for (const dayStem of TIANGAN) {
    for (const dayBranch of DIZHI) {
      for (const firstUpper of DIZHI) {
        for (const initial of DIZHI) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: [initial, '寅', '辰'],
            dayStem,
            dayBranch,
            fourLessons: [
              { upper: firstUpper, lower: dayStem },
              { upper: '寅', lower: '寅' },
              { upper: '卯', lower: dayBranch },
              { upper: '辰', lower: '卯' },
            ],
          }).find((item) => item.name === '上门乱首');
          assert.equal(
            !!fact,
            firstUpper === dayBranch && initial === dayBranch && isBranchKe(dayBranch, dayStem),
            `${dayStem}${dayBranch}日、干上${firstUpper}、${initial}发用的上门乱首边界不一致`,
          );
          luanShouProfileCount += 1;
        }
      }
    }
  }
  assert.equal(luanShouProfileCount, 17_280);

  const tianWang = getLiurenGuaTiFacts({
    transmissionBranches: ['申', '子', '辰'],
    dayStem: '甲',
    hourBranch: '酉',
  }).find((item) => item.name === '天网卦');
  assert.ok(tianWang);
  assert.equal(tianWang.stableKey, 'liuren:verified-guati:tian-wang');
  assert.equal(tianWang.sourceQuote, '凡时与用神并克天干者曰天网卦。');
  assert.deepEqual(tianWang.matchedConditions, ['占时酉与初传申均克日干甲']);

  const shangMenLuanShou = getLiurenGuaTiFacts({
    transmissionBranches: ['寅', '午', '戌'],
    dayStem: '戊',
    dayBranch: '寅',
    fourLessons: [
      { upper: '寅', lower: '戊' },
      { upper: '午', lower: '寅' },
      { upper: '辰', lower: '寅' },
      { upper: '巳', lower: '辰' },
    ],
  }).find((item) => item.name === '上门乱首');
  assert.ok(shangMenLuanShou);
  assert.equal(shangMenLuanShou.stableKey, 'liuren:verified-guati:shang-men-luan-shou');
  assert.equal(shangMenLuanShou.sourceQuote, '支临干克干，为上门乱首，更兼发用尤的。');
  assert.deepEqual(shangMenLuanShou.matchedConditions, ['日支寅临日干戊并克干，且以日支发用']);

  for (const fact of [tianWang, shangMenLuanShou]) {
    assert.doesNotMatch(
      `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
      /刑狱|病|灾|犯上|吉凶|现实事件/,
    );
  }

  assert.ok(
    !getLiurenGuaTiFacts({ transmissionBranches: ['申', '子', '辰'] }).some(
      (item) => item.name === '天网卦',
    ),
  );
  assert.ok(
    !getLiurenGuaTiFacts({
      transmissionBranches: ['寅', '午', '戌'],
      fourLessons: [
        { upper: '寅', lower: '戊' },
        { upper: '午', lower: '寅' },
        { upper: '辰', lower: '寅' },
        { upper: '巳', lower: '辰' },
      ],
    }).some((item) => item.name === '上门乱首'),
  );
});

test('大六壬赘婿卦应按日支临干受克发用的17280种轮廓严格命中', () => {
  let profileCount = 0;
  let matchCount = 0;

  for (const dayStem of TIANGAN) {
    for (const dayBranch of DIZHI) {
      for (const firstUpper of DIZHI) {
        for (const initial of DIZHI) {
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: [initial, '寅', '辰'],
            dayStem,
            dayBranch,
            fourLessons: [
              { upper: firstUpper, lower: dayStem },
              { upper: '寅', lower: '寅' },
              { upper: '卯', lower: dayBranch },
              { upper: '辰', lower: '卯' },
            ],
          }).find((item) => item.name === '赘婿卦');
          const expected =
            firstUpper === dayBranch && initial === dayBranch && isBranchKe(dayStem, dayBranch);
          assert.equal(
            !!fact,
            expected,
            `${dayStem}${dayBranch}日、干上${firstUpper}、${initial}发用的赘婿边界不一致`,
          );
          if (fact) matchCount += 1;
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 17_280);
  assert.equal(matchCount, 24);

  const fact = getLiurenGuaTiFacts({
    transmissionBranches: ['申', '子', '辰'],
    dayStem: '丙',
    dayBranch: '申',
    fourLessons: [
      { upper: '申', lower: '丙' },
      { upper: '子', lower: '申' },
      { upper: '亥', lower: '申' },
      { upper: '寅', lower: '亥' },
    ],
  }).find((item) => item.name === '赘婿卦');
  assert.ok(fact);
  assert.equal(fact.stableKey, 'liuren:verified-guati:zhui-xu');
  assert.deepEqual(fact.matchedConditions, ['日支申临日干丙受干克，且以日支发用']);
  assert.match(fact.sourceUrl, /六壬大全\/9&oldid=854578$/);
  assert.match(fact.sourceQuote, /六壬指南.+六壬大全/);
  assert.doesNotMatch(
    `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
    /婚姻|屈辱|刑狱|疾病|功名|吉凶|现实事件/,
  );
});

test('大六壬回环课应穷举全部1370304种三传与四课上神集合轮廓', () => {
  const upperSets: string[][] = [];
  for (let mask = 1; mask < 1 << DIZHI.length; mask += 1) {
    const uppers = DIZHI.filter((_, index) => (mask & (1 << index)) !== 0);
    if (uppers.length <= 4) upperSets.push(uppers);
  }
  assert.equal(upperSets.length, 793);

  let profileCount = 0;
  let matchCount = 0;
  let matchedFact: ReturnType<typeof getLiurenGuaTiFacts>[number] | undefined;
  for (const initial of DIZHI) {
    for (const middle of DIZHI) {
      for (const final of DIZHI) {
        const branches = [initial, middle, final];
        for (const uppers of upperSets) {
          const lessons = Array.from({ length: 4 }, (_, index) => ({
            upper: uppers[index] ?? uppers[0],
            lower: DIZHI[index],
          }));
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: branches,
            fourLessons: lessons,
          }).find((item) => item.name === '回环课');
          const expected = branches.every((branch) => uppers.includes(branch));
          if (!!fact !== expected) {
            assert.fail(
              `三传${branches.join('、')}与四课上神集合${uppers.join('、')}的回环边界不一致`,
            );
          }
          if (fact) {
            matchCount += 1;
            matchedFact ??= fact;
          }
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 1_370_304);
  assert.equal(matchCount, 38_160);
  assert.ok(matchedFact);
  assert.equal(matchedFact.stableKey, 'liuren:verified-guati:hui-huan');
  assert.match(matchedFact.sourceQuote, /六壬指南.+六壬粹言/);
  assert.doesNotMatch(
    `${matchedFact.matchedConditions.join('；')}；${matchedFact.sourceQuote}`,
    /成败|吉|凶|婚姻|疾病|功名|现实事件/,
  );
});

test('大六壬游子课应按十二月建与全部三传轮廓严格命中', () => {
  const tianMaByMonth: Readonly<Record<string, string>> = {
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
  const seasonalBranches = new Set(['辰', '戌', '丑', '未']);
  let profileCount = 0;
  let matchCount = 0;

  for (const monthBranch of DIZHI) {
    for (const initial of DIZHI) {
      for (const middle of DIZHI) {
        for (const final of DIZHI) {
          const transmissionBranches = [initial, middle, final];
          const fact = getLiurenGuaTiFacts({
            transmissionBranches,
            monthBranch,
          }).find((item) => item.name === '游子课');
          const expected =
            initial === tianMaByMonth[monthBranch] &&
            transmissionBranches.every((branch) => seasonalBranches.has(branch));
          assert.equal(
            !!fact,
            expected,
            `月建${monthBranch}、三传${transmissionBranches.join('、')}的游子课边界不一致`,
          );
          if (fact) matchCount += 1;
          profileCount += 1;
        }
      }
    }
  }

  assert.equal(profileCount, 20_736);
  assert.equal(matchCount, 64);

  const fact = getLiurenGuaTiFacts({
    transmissionBranches: ['戌', '丑', '未'],
    monthBranch: '辰',
  }).find((item) => item.name === '游子课');
  assert.ok(fact);
  assert.equal(fact.stableKey, 'liuren:verified-guati:you-zi');
  assert.equal(fact.category, '三传天马');
  assert.deepEqual(fact.matchedConditions, [
    '三传戌、丑、未均为辰戌丑未四季，月建辰所起天马戌发用',
  ]);
  assert.match(fact.sourceUrl, /六壬大全\/9&oldid=854578$/);
  assert.match(fact.sourceQuote, /六壬指南.+六壬大全/);
  assert.doesNotMatch(
    fact.matchedConditions.join('；'),
    /吉凶|疾病|刑狱|逃亡|远行|成败|婚姻|功名|现实事件/,
  );

  assert.ok(
    !getLiurenGuaTiFacts({ transmissionBranches: ['戌', '丑', '未'] }).some(
      (item) => item.name === '游子课',
    ),
  );
  assert.ok(
    !getLiurenGuaTiFacts({
      transmissionBranches: ['戌', '丑', '未'],
      monthBranch: '卯',
    }).some((item) => item.name === '游子课'),
  );
});

test('大六壬四课五种关系轮廓应严格识别四项克贼课体', () => {
  const relationLessons = [
    { relation: '上克下', lesson: { upper: '寅', lower: '丑' } },
    { relation: '下克上', lesson: { upper: '子', lower: '丑' } },
    { relation: '上生下', lesson: { upper: '寅', lower: '午' } },
    { relation: '下生上', lesson: { upper: '午', lower: '寅' } },
    { relation: '比和', lesson: { upper: '寅', lower: '卯' } },
  ] as const;
  const targetNames = new Set(['无禄卦', '绝嗣卦', '幼度厄', '长度厄']);
  const matchedFacts = new Map<string, ReturnType<typeof getLiurenGuaTiFacts>[number]>();

  for (let profile = 0; profile < 5 ** 4; profile += 1) {
    let remainder = profile;
    const selected = Array.from({ length: 4 }, () => {
      const selectedRelation = relationLessons[remainder % relationLessons.length];
      remainder = Math.floor(remainder / relationLessons.length);
      return selectedRelation;
    });
    const upperKeCount = selected.filter((item) => item.relation === '上克下').length;
    const lowerKeCount = selected.filter((item) => item.relation === '下克上').length;
    const expected = [
      ...(upperKeCount === 4 ? ['无禄卦'] : []),
      ...(lowerKeCount === 4 ? ['绝嗣卦'] : []),
      ...(upperKeCount === 3 ? ['幼度厄'] : []),
      ...(lowerKeCount === 3 ? ['长度厄'] : []),
    ];
    const actualFacts = getLiurenGuaTiFacts({
      transmissionBranches: ['子', '寅', '辰'],
      fourLessons: selected.map((item) => item.lesson),
    }).filter((fact) => targetNames.has(fact.name));

    assert.deepEqual(
      actualFacts.map((fact) => fact.name),
      expected,
      `关系轮廓${selected.map((item) => item.relation).join('、')}命中边界不一致`,
    );
    actualFacts.forEach((fact) => matchedFacts.set(fact.name, fact));
  }

  const expectedFacts = [
    ['无禄卦', 'liuren:verified-guati:wu-lu', '凡四上克下曰无禄卦。', '四课均为上神克下位'],
    ['绝嗣卦', 'liuren:verified-guati:jue-si', '凡四下克上曰绝嗣卦。', '四课均为下位克上神'],
    ['幼度厄', 'liuren:verified-guati:you-du-e', '三上克为幼度厄。', '四课中恰有三课为上神克下位'],
    [
      '长度厄',
      'liuren:verified-guati:zhang-du-e',
      '三下克为长度厄。',
      '四课中恰有三课为下位克上神',
    ],
  ] as const;
  for (const [name, stableKey, sourceQuote, matchedCondition] of expectedFacts) {
    const fact = matchedFacts.get(name);
    assert.ok(fact);
    assert.equal(fact.stableKey, stableKey);
    assert.equal(fact.sourceQuote, sourceQuote);
    assert.deepEqual(fact.matchedConditions, [matchedCondition]);
    assert.match(fact.sourceUrl, /oldid=854504$/);
    assert.doesNotMatch(
      `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
      /贫苦|疾病|死丧|婚姻|官非|吉凶|现实事件/,
    );
  }
});

test('大六壬新增六类课体应按完整起课条件命中', () => {
  const cases = [
    {
      name: '龙德课',
      sourceOldId: '854575',
      context: {
        transmissionBranches: ['子', '寅', '辰'],
        yearBranch: '子',
        monthLeader: '子',
        noblemanBranch: '子',
      },
    },
    {
      name: '斫轮卦',
      sourceOldId: '854576',
      context: { transmissionBranches: ['卯', '辰', '巳'], initialGroundBranch: '申' },
    },
    {
      name: '铸印卦',
      sourceOldId: '854576',
      context: { transmissionBranches: ['巳', '戌', '卯'] },
    },
    {
      name: '高盖乘轩卦',
      sourceOldId: '854576',
      context: { transmissionBranches: ['午', '卯', '子'] },
    },
    {
      name: '无禄卦',
      sourceOldId: '854504',
      context: {
        transmissionBranches: ['子', '寅', '辰'],
        fourLessons: [
          { upper: '寅', lower: '丑' },
          { upper: '卯', lower: '辰' },
          { upper: '寅', lower: '未' },
          { upper: '卯', lower: '戌' },
        ],
      },
    },
    {
      name: '励德卦',
      sourceOldId: '854504',
      context: { transmissionBranches: ['子', '寅', '辰'], noblemanGroundBranch: '卯' },
    },
  ] as const;

  for (const item of cases) {
    const fact = getLiurenGuaTiFacts(item.context).find(
      (candidate) => candidate.name === item.name,
    );
    assert.ok(fact, `${item.name}应按登记条件命中`);
    assert.ok(fact.matchedConditions.length > 0);
    assert.match(fact.stableKey, /^liuren:verified-guati:/);
    assert.match(fact.sourceUrl, new RegExp(`oldid=${item.sourceOldId}`));
  }

  const zhuYin = getLiurenGuaTiFacts({ transmissionBranches: ['巳', '戌', '卯'] }).find(
    (candidate) => candidate.name === '铸印卦',
  );
  assert.ok(zhuYin);
  assert.deepEqual(zhuYin.branches, ['巳', '戌', '卯']);
  assert.deepEqual(zhuYin.matchedConditions, ['三传依次为巳、戌、卯，戌加巳为中传']);
  assert.match(zhuYin.sourceQuote, /戌加巳中传[\s\S]*三传巳戌卯/);

  const zhuoLunVariants = [
    {
      context: { transmissionBranches: ['卯', '辰', '巳'], initialGroundBranch: '酉' },
      condition: '初传卯加临地盘酉发用',
    },
    {
      context: {
        transmissionBranches: ['卯', '辰', '巳'],
        initialGroundBranch: '戌',
        fourLessons: [
          { upper: '卯', lower: '辛' },
          { upper: '辰', lower: '卯' },
          { upper: '巳', lower: '午' },
          { upper: '午', lower: '巳' },
        ],
      },
      condition: '初传卯从日干辛上发用',
    },
  ] as const;
  for (const { context, condition } of zhuoLunVariants) {
    const zhuoLun = getLiurenGuaTiFacts(context).find((candidate) => candidate.name === '斫轮卦');
    assert.ok(zhuoLun);
    assert.deepEqual(zhuoLun.matchedConditions, [condition]);
    assert.match(zhuoLun.sourceQuote, /卯加庚辛申酉发用/);
  }
});

test('大六壬新增六类课体不得由相似三传或缺失起课条件误判', () => {
  const nearMisses = [
    {
      name: '龙德课',
      context: {
        transmissionBranches: ['子', '寅', '辰'],
        yearBranch: '子',
        monthLeader: '丑',
        noblemanBranch: '子',
      },
    },
    {
      name: '斫轮卦',
      context: { transmissionBranches: ['卯', '辰', '巳'], initialGroundBranch: '午' },
    },
    {
      name: '铸印卦',
      context: { transmissionBranches: ['戌', '亥', '子'], initialGroundBranch: '巳' },
    },
    {
      name: '高盖乘轩卦',
      context: { transmissionBranches: ['子', '卯', '午'] },
    },
    {
      name: '无禄卦',
      context: {
        transmissionBranches: ['子', '寅', '辰'],
        fourLessons: [
          { upper: '寅', lower: '丑' },
          { upper: '子', lower: '亥' },
          { upper: '寅', lower: '未' },
          { upper: '卯', lower: '戌' },
        ],
      },
    },
    {
      name: '励德卦',
      context: { transmissionBranches: ['子', '寅', '辰'], noblemanGroundBranch: '申' },
    },
  ] as const;

  for (const item of nearMisses) {
    assert.ok(
      !getLiurenGuaTiFacts(item.context).some((candidate) => candidate.name === item.name),
      `${item.name}不应因近似条件误命中`,
    );
  }

  assert.ok(
    !getLiurenGuaTiFacts({
      transmissionBranches: ['卯', '辰', '巳'],
      initialGroundBranch: '戌',
      fourLessons: [
        { upper: '卯', lower: '壬' },
        { upper: '辰', lower: '卯' },
        { upper: '巳', lower: '午' },
        { upper: '午', lower: '巳' },
      ],
    }).some((candidate) => candidate.name === '斫轮卦'),
    '卯临戌且并非从庚辛干上发用时不应误判为斫轮卦',
  );
});

test('大六壬刑害、鬼墓与递克四类课体应按全部输入轮廓严格命中', () => {
  let lessonProfileCount = 0;
  let qinHaiMatchCount = 0;
  let xingShangMatchCount = 0;
  for (const dayStem of TIANGAN) {
    const stemResidence = getDayStemResidence(dayStem);
    for (const dayBranch of DIZHI) {
      for (const stemUpper of DIZHI) {
        for (const branchUpper of DIZHI) {
          for (const initial of DIZHI) {
            const facts = getLiurenGuaTiFacts({
              transmissionBranches: [initial, '子', '丑'],
              dayStem,
              dayBranch,
              fourLessons: [
                { upper: stemUpper, lower: dayStem },
                { upper: '子', lower: stemUpper },
                { upper: branchUpper, lower: dayBranch },
                { upper: '丑', lower: branchUpper },
              ],
            });
            const qinHai = facts.find((fact) => fact.name === '侵害课');
            const xingShang = facts.find((fact) => fact.name === '刑伤课');
            const expectedQinHai =
              (initial === stemUpper && LIUHAI_MAP[stemUpper] === stemResidence) ||
              (initial === branchUpper && LIUHAI_MAP[branchUpper] === dayBranch);
            const expectedXingShang =
              (initial === stemUpper && SANXING_MAP[stemUpper] === stemResidence) ||
              (initial === branchUpper && SANXING_MAP[branchUpper] === dayBranch);

            assert.equal(
              Boolean(qinHai),
              expectedQinHai,
              `${dayStem}${dayBranch}日、干上${stemUpper}、支上${branchUpper}、${initial}发用的侵害边界不一致`,
            );
            assert.equal(
              Boolean(xingShang),
              expectedXingShang,
              `${dayStem}${dayBranch}日、干上${stemUpper}、支上${branchUpper}、${initial}发用的刑伤边界不一致`,
            );
            if (qinHai) qinHaiMatchCount += 1;
            if (xingShang) xingShangMatchCount += 1;
            lessonProfileCount += 1;
          }
        }
      }
    }
  }
  assert.equal(lessonProfileCount, 207_360);
  assert.ok(qinHaiMatchCount > 0);
  assert.ok(xingShangMatchCount > 0);

  const tombByStem: Readonly<Record<string, string>> = {
    甲: '未',
    乙: '未',
    丙: '戌',
    丁: '戌',
    戊: '辰',
    己: '辰',
    庚: '丑',
    辛: '丑',
    壬: '辰',
    癸: '辰',
  };
  const tombByElement: Readonly<Record<string, string>> = {
    木: '未',
    火: '戌',
    土: '辰',
    金: '丑',
    水: '辰',
  };
  const ghostBranchesByStem: Readonly<Record<string, readonly string[]>> = {
    甲: ['申'],
    乙: ['酉'],
    丙: ['子'],
    丁: ['亥'],
    戊: ['寅'],
    己: ['卯'],
    庚: ['午'],
    辛: ['巳'],
    壬: ['辰', '戌'],
    癸: ['丑', '未'],
  };
  let guiMuProfileCount = 0;
  let guiMuMatchCount = 0;
  for (const dayStem of TIANGAN) {
    for (const dayBranch of DIZHI) {
      for (const initial of DIZHI) {
        const fact = getLiurenGuaTiFacts({
          transmissionBranches: [initial, '子', '丑'],
          dayStem,
          dayBranch,
        }).find((candidate) => candidate.name === '鬼墓课');
        const expected =
          initial === tombByStem[dayStem] ||
          initial === tombByElement[getGanZhiWuxing(dayBranch)] ||
          ghostBranchesByStem[dayStem].includes(initial);
        assert.equal(
          Boolean(fact),
          expected,
          `${dayStem}${dayBranch}日、${initial}发用的鬼墓边界不一致`,
        );
        if (fact) guiMuMatchCount += 1;
        guiMuProfileCount += 1;
      }
    }
  }
  assert.equal(guiMuProfileCount, 1_440);
  assert.ok(guiMuMatchCount > 0);

  const controls: Readonly<Record<string, string>> = {
    木: '土',
    土: '水',
    水: '火',
    火: '金',
    金: '木',
  };
  let yangJiuProfileCount = 0;
  let yangJiuMatchCount = 0;
  for (const dayStem of TIANGAN) {
    const dayElement = getGanZhiWuxing(dayStem);
    for (const initial of DIZHI) {
      const initialElement = getGanZhiWuxing(initial);
      for (const middle of DIZHI) {
        const middleElement = getGanZhiWuxing(middle);
        for (const final of DIZHI) {
          const finalElement = getGanZhiWuxing(final);
          const fact = getLiurenGuaTiFacts({
            transmissionBranches: [initial, middle, final],
            dayStem,
          }).find((candidate) => candidate.name === '殃咎课');
          const expected =
            (controls[initialElement] === middleElement &&
              controls[middleElement] === finalElement &&
              controls[finalElement] === dayElement) ||
            (controls[finalElement] === middleElement &&
              controls[middleElement] === initialElement &&
              controls[initialElement] === dayElement);
          assert.equal(
            Boolean(fact),
            expected,
            `${dayStem}日、三传${initial}${middle}${final}的殃咎边界不一致`,
          );
          if (fact) yangJiuMatchCount += 1;
          yangJiuProfileCount += 1;
        }
      }
    }
  }
  assert.equal(yangJiuProfileCount, 17_280);
  assert.ok(yangJiuMatchCount > 0);

  const classicalFacts = [
    getLiurenGuaTiFacts({
      transmissionBranches: ['未', '子', '丑'],
      dayStem: '甲',
      dayBranch: '子',
      fourLessons: [
        { upper: '未', lower: '甲' },
        { upper: '子', lower: '未' },
        { upper: '未', lower: '子' },
        { upper: '寅', lower: '未' },
      ],
    }).find((fact) => fact.name === '侵害课'),
    getLiurenGuaTiFacts({
      transmissionBranches: ['巳', '子', '丑'],
      dayStem: '甲',
      dayBranch: '申',
      fourLessons: [
        { upper: '巳', lower: '甲' },
        { upper: '子', lower: '巳' },
        { upper: '巳', lower: '申' },
        { upper: '寅', lower: '巳' },
      ],
    }).find((fact) => fact.name === '刑伤课'),
    getLiurenGuaTiFacts({
      transmissionBranches: ['申', '子', '丑'],
      dayStem: '甲',
      dayBranch: '寅',
    }).find((fact) => fact.name === '鬼墓课'),
    getLiurenGuaTiFacts({ transmissionBranches: ['寅', '丑', '子'], dayStem: '丙' }).find(
      (fact) => fact.name === '殃咎课',
    ),
  ];
  classicalFacts.forEach((fact) => {
    assert.ok(fact);
    assert.match(fact.stableKey, /^liuren:verified-guati:/);
    assert.match(fact.sourceUrl, /oldid=85457[89]$/);
    assert.doesNotMatch(
      `${fact.matchedConditions.join('；')}；${fact.sourceQuote}`,
      /疾病|官讼|灾祸|婚姻|吉凶|现实事件/,
    );
  });
});

test('大六壬伏吟返吟只按天地盘取传规则识别，不以三传首尾关系替代', () => {
  assert.equal(getTransmissionPattern('子', '子', '子', '伏吟法'), '伏吟');
  assert.equal(getTransmissionPattern('子', '午', '子', '返吟重审法'), '反吟');
  assert.equal(getTransmissionPattern('子', '寅', '午', '重审法'), '递传');
  assert.equal(getTransmissionPattern('子', '寅', '子'), '回环');
  assert.equal(getTransmissionPattern('子', '丑', '寅'), '递传');
});

test('大六壬普通递传即使初末六冲也不得误标返吟', () => {
  const result = generateLiuren(new Date('2026-01-01T08:00:00+08:00'));

  assert.equal(result.ganzhi.day, '乙亥');
  assert.equal(result.transmissionRule, '重审法');
  assert.deepEqual(
    result.threeTransmissions.map((item) => item.branch),
    ['丑', '戌', '未'],
  );
  assert.equal(LIUCHONG_MAP.丑, '未');
  assert.equal(result.transmissionPattern, '递传');
  assert.ok(!result.patternTags?.includes('反吟'));
});

test('大六壬天地盘会把月将加在占时地盘上，并保持天地互查可逆', () => {
  for (const monthLeader of DIZHI) {
    for (const divinationBranch of DIZHI) {
      const plate = buildHeavenlyPlate({
        monthLeader,
        divinationBranch,
        noblemanBranch: '丑',
        dayNight: '昼占',
      });

      assert.equal(getUpperByUnder(plate, divinationBranch), monthLeader);
      assert.equal(getUnderByUpper(plate, monthLeader), divinationBranch);
      assert.equal(new Set(plate.map((item) => item.under)).size, 12);
      assert.equal(new Set(plate.map((item) => item.branch)).size, 12);
    }
  }
});

test('大六壬全部月将、占时、日柱和昼夜组合应完整成课取传', () => {
  const ruleCounts = new Map<string, number>();
  const remoteKeDirectionCounts = new Map<string, number>();
  const guaTiCounts = new Map<string, number>();
  const auditedCuiYanNames = new Set<string>();
  let caseCount = 0;
  let guaTiContextCount = 0;

  for (const monthLeader of DIZHI) {
    for (const hourBranch of DIZHI) {
      for (const day of SIXTY_DAYS) {
        for (const dayNight of ['昼占', '夜占'] as const) {
          const dayStem = day.charAt(0);
          const dayBranch = day.charAt(1);
          const dayStemIndex = TIANGAN.indexOf(dayStem as (typeof TIANGAN)[number]);
          const hourBranchIndex = DIZHI.indexOf(hourBranch);
          const hourStem = TIANGAN[((dayStemIndex % 5) * 2 + hourBranchIndex) % 10];
          const heavenlyPlate = buildHeavenlyPlate({
            monthLeader,
            divinationBranch: hourBranch,
            noblemanBranch: getNoblemanBranch(dayStem, dayNight),
            dayNight,
          });
          const dayStemResidence = getDayStemResidence(dayStem);
          const lessons = buildFourLessons({
            heavenlyPlate,
            dayStem,
            dayBranch,
            dayStemResidence,
            xunKong: [],
          });
          const initial = resolveInitialTransmission(lessons, {
            dayStem,
            dayBranch,
            dayStemResidence,
            hourStem,
            hourBranch,
            heavenlyPlate,
          });
          const branches = initial.branches || [
            initial.initial,
            getUpperByUnder(heavenlyPlate, initial.initial),
            getUpperByUnder(heavenlyPlate, getUpperByUnder(heavenlyPlate, initial.initial)),
          ];
          const label = `${monthLeader}将 ${day}${hourStem}${hourBranch} ${dayNight}`;

          for (const yearBranch of DIZHI) {
            guaTiContextCount += 1;
            const guaTiFacts = getLiurenGuaTiFacts({
              transmissionBranches: branches,
              transmissionRule: initial.rule,
              transmissionGods: branches.map(
                (branch) => getPlateItemByBranch(heavenlyPlate, branch).god,
              ),
              transmissionGroundBranches: branches.map(
                (branch) => getPlateItemByBranch(heavenlyPlate, branch).under,
              ),
              dayGanZhi: day,
              dayStem,
              dayBranch,
              hourBranch,
              initialSourceLessonIndex: initial.sourceLessonIndex,
              initialGroundBranch: getPlateItemByBranch(heavenlyPlate, branches[0]).under,
              finalGroundBranch: getPlateItemByBranch(heavenlyPlate, branches[2]).under,
              yearBranch,
              monthBranch: MONTH_BRANCH_BY_LEADER[monthLeader],
              monthLeader,
              noblemanBranch: getNoblemanBranch(dayStem, dayNight),
              noblemanGroundBranch: getPlateItemByBranch(
                heavenlyPlate,
                getNoblemanBranch(dayStem, dayNight),
              ).under,
              greatAuspiciousGroundBranch: getPlateItemByBranch(heavenlyPlate, '丑').under,
              heavenlyDragonGroundBranch: getPlateItemByBranch(heavenlyPlate, '辰').under,
              fourLessons: lessons,
            });
            const guaTiFactNames = new Set(guaTiFacts.map((fact) => fact.name));
            const lessonUppers = new Set(lessons.map((lesson) => lesson.upper));
            const initialBranch = branches[0];
            const middleBranch = branches[1];
            const finalBranch = branches[2];
            const fourYiMa = [
              getYiMa(yearBranch),
              getYiMa(MONTH_BRANCH_BY_LEADER[monthLeader]),
              getYiMa(dayBranch),
              getYiMa(hourBranch),
            ];
            const commonYiMa = fourYiMa[0];
            const expectedCuiYanMatches: Readonly<Record<string, boolean>> = {
              太阳临身格: monthLeader === lessons[0].upper,
              太阳射宅格: monthLeader === lessons[2].upper,
              时用生日格:
                hourBranch === initialBranch &&
                isSheng(getGanZhiWuxing(initialBranch), getGanZhiWuxing(dayStem)),
              时用克日格: hourBranch === initialBranch && isBranchKe(initialBranch, dayStem),
              富贵课:
                lessons[0].upper === getYiMa(dayBranch) &&
                lessons[2].upper === DAY_LU_BRANCH_BY_STEM[dayStem],
              四路驿马格:
                fourYiMa.every((branch) => branch === commonYiMa) && initialBranch === commonYiMa,
              根断源消格: lessons.every((lesson) =>
                isSheng(getGanZhiWuxing(lesson.lower), getGanZhiWuxing(lesson.upper)),
              ),
              不入格: !lessonUppers.has(initialBranch),
              传出格:
                lessonUppers.has(initialBranch) &&
                [middleBranch, finalBranch].some((branch) => !lessonUppers.has(branch)),
              传入格:
                !lessonUppers.has(initialBranch) &&
                [middleBranch, finalBranch].some((branch) => lessonUppers.has(branch)),
            };
            for (const [name, expected] of Object.entries(expectedCuiYanMatches)) {
              assert.equal(
                guaTiFactNames.has(name),
                expected,
                `${label}、太岁${yearBranch}的${name}命中边界不一致`,
              );
            }
            for (const fact of guaTiFacts) {
              guaTiCounts.set(fact.name, (guaTiCounts.get(fact.name) || 0) + 1);
              if (
                LIUREN_CUI_YAN_GUA_TI_NAMES.has(fact.name) &&
                !auditedCuiYanNames.has(fact.name)
              ) {
                assert.match(fact.sourceTitle, /《六壬粹言》卷[四七八]/);
                assert.match(fact.sourceUrl, /shushubook\/blob\/[0-9a-f]{40}\/六壬\/六壬粹言/);
                assert.doesNotMatch(
                  fact.matchedConditions.join('；'),
                  /主(?:婚姻|官非|疾病|死丧|升迁|财利)|必然|必定|现实事件/,
                );
                auditedCuiYanNames.add(fact.name);
              }
            }
          }

          assert.equal(getUpperByUnder(heavenlyPlate, hourBranch), monthLeader, label);
          assert.equal(new Set(heavenlyPlate.map((item) => item.under)).size, 12, label);
          assert.equal(new Set(heavenlyPlate.map((item) => item.branch)).size, 12, label);
          assert.equal(new Set(heavenlyPlate.map((item) => item.god)).size, 12, label);
          assert.equal(lessons.length, 4, label);
          assert.equal(branches.length, 3, label);
          if (initial.sourceLessonIndex !== undefined) {
            assert.ok(initial.sourceLessonIndex >= 0 && initial.sourceLessonIndex <= 3, label);
            assert.equal(
              lessons[initial.sourceLessonIndex].upper,
              initial.initial,
              `${label}的初传来源课序必须指向真实发用上神`,
            );
          }
          if (initial.rule.startsWith('遥克')) {
            assert.ok(initial.remoteKeDirection, `${label}的遥克方向不得在多候选筛选后丢失`);
            remoteKeDirectionCounts.set(
              initial.remoteKeDirection!,
              (remoteKeDirectionCounts.get(initial.remoteKeDirection!) || 0) + 1,
            );
          } else {
            assert.equal(initial.remoteKeDirection, undefined, label);
          }
          assert.ok(
            branches.every((branch) => DIZHI.includes(branch as (typeof DIZHI)[number])),
            label,
          );
          const xunKong = getVoidBranches(day);
          assert.equal(xunKong.length, 2, label);
          branches.forEach((branch, index) => {
            assert.ok(
              ['父母', '子孙', '妻财', '官鬼', '兄弟'].includes(getLiurenKinship(dayStem, branch)),
              label,
            );
            assert.match(
              describeTransmissionDayStemRelation(
                ['初传', '中传', '末传'][index] as '初传' | '中传' | '末传',
                branch,
                dayStem,
              ),
              /生|克|比和/,
              label,
            );
            assert.match(
              describeTransmissionDayBranchRelation(
                ['初传', '中传', '末传'][index] as '初传' | '中传' | '末传',
                branch,
                dayBranch,
              ),
              /生|克|比和/,
              label,
            );
            assert.ok(
              getLiurenBranchPairRelations(branch, dayBranch).every((relation) =>
                ['同支', '六合', '六冲', '六害', '六破', '相刑'].includes(relation),
              ),
              label,
            );
            if (index > 0) {
              assert.match(
                describeTransmissionTransition(
                  index === 1 ? '初传' : '中传',
                  branches[index - 1],
                  index === 1 ? '中传' : '末传',
                  branch,
                ),
                /生|克|比和/,
                label,
              );
            }
          });

          ruleCounts.set(initial.rule, (ruleCounts.get(initial.rule) || 0) + 1);
          caseCount += 1;
        }
      }
    }
  }

  assert.equal(caseCount, 17_280);
  assert.equal(guaTiContextCount, 207_360);
  assert.deepEqual(
    [...auditedCuiYanNames].sort(),
    [...LIUREN_CUI_YAN_GUA_TI_NAMES].sort(),
    '《六壬粹言》本批十项结构均应能由合法九宗门盘面自然生成',
  );
  const mainVersionBoundaryNames = [
    '出三天格',
    '入三渊格',
    '凝阳格',
    '涉疑格',
    '偃蹇格',
    '含春',
    '离渐',
    '隐明',
    '回阴',
    '出狱',
    '返照',
    '游魂',
    '虎视转蓬',
  ];
  assert.equal(guaTiCounts.size, REGISTERED_LIUREN_GUA_TI_COUNT - mainVersionBoundaryNames.length);
  assert.deepEqual(
    mainVersionBoundaryNames.filter((name) => !guaTiCounts.has(name)),
    mainVersionBoundaryNames,
    '十三条课体已经直接结构穷举，但当前主版本九宗门合法排盘不会自然生成',
  );
  assert.ok((guaTiCounts.get('铸印卦') || 0) > 0, '铸印卦不得成为仅人工上下文可命中的死规则');
  assert.deepEqual(Object.fromEntries([...ruleCounts].sort()), {
    伏吟法: 1440,
    元首法: 2856,
    八专法: 384,
    别责法: 216,
    昴星法: 384,
    比用法: 1944,
    涉害法: 1824,
    返吟元首法: 48,
    返吟比用法: 384,
    返吟法: 144,
    返吟涉害法: 144,
    返吟重审法: 720,
    遥克比用法: 264,
    遥克法: 1272,
    遥克涉害法: 24,
    重审法: 5232,
  });
  assert.ok((remoteKeDirectionCounts.get('蒿矢') || 0) > 0);
  assert.ok((remoteKeDirectionCounts.get('弹射') || 0) > 0);
  for (const name of ['不备课', '四绝课', '蓦越课', '见机课', '察微课']) {
    assert.ok((guaTiCounts.get(name) || 0) > 0, `${name}应能由主版本合法盘面自然生成`);
  }
});

test('大六壬十干寄宫与四课上下递取应符合传统口径', () => {
  const residenceCases: Array<[string, string]> = [
    ['甲', '寅'],
    ['乙', '辰'],
    ['丙', '巳'],
    ['丁', '未'],
    ['戊', '巳'],
    ['己', '未'],
    ['庚', '申'],
    ['辛', '戌'],
    ['壬', '亥'],
    ['癸', '丑'],
  ];
  const plate = buildHeavenlyPlate({
    monthLeader: '亥',
    divinationBranch: '卯',
    noblemanBranch: '亥',
    dayNight: '昼占',
  });

  for (const [dayStem, expectedResidence] of residenceCases) {
    const dayStemResidence = getDayStemResidence(dayStem);
    const lessons = buildFourLessons({
      heavenlyPlate: plate,
      dayStem,
      dayBranch: '午',
      dayStemResidence,
      xunKong: [],
    });

    assert.equal(dayStemResidence, expectedResidence);
    assert.equal(lessons[0].lower, dayStem);
    assert.equal(lessons[0].upper, getUpperByUnder(plate, expectedResidence));
    assert.equal(lessons[1].lower, lessons[0].upper);
    assert.equal(lessons[1].upper, getUpperByUnder(plate, lessons[0].upper));
    assert.equal(lessons[2].lower, '午');
    assert.equal(lessons[2].upper, getUpperByUnder(plate, '午'));
    assert.equal(lessons[3].lower, lessons[2].upper);
    assert.equal(lessons[3].upper, getUpperByUnder(plate, lessons[2].upper));
  }
});

test('大六壬传统样例会按月将加占时生成天盘、四课与三传', () => {
  const result = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));

  assert.equal(result.ganzhi.day, '甲寅');
  assert.equal(result.monthLeader, '戌');
  assert.equal(result.divinationBranch, '辰');
  assert.deepEqual(
    result.fourLessons.map((item) => `${item.name}${item.upper}${item.lower}`),
    ['一课申甲', '二课寅申', '三课申寅', '四课寅申'],
  );
  assert.equal(result.transmissionRule, '返吟重审法');
  assert.match(
    result.classicalRules?.[0]?.source || '',
    /《六壬粹言》《大六壬大全》《六壬指南》九宗门取传法/,
  );
  assert.deepEqual(
    result.threeTransmissions.map((item) => item.branch),
    ['寅', '申', '寅'],
  );
});

test('大六壬排盘骨架应与 GitHub 高星参考项目 kinliuren 样例一致', () => {
  const cases = [
    {
      name: '清明三月甲寅日戊辰时',
      day: '甲寅',
      hour: '戊辰',
      monthLeader: '戌',
      expectedPlate: [
        '辰戌',
        '巳亥',
        '午子',
        '未丑',
        '申寅',
        '酉卯',
        '戌辰',
        '亥巳',
        '子午',
        '丑未',
        '寅申',
        '卯酉',
      ],
      expectedLessons: ['一课申甲', '二课寅申', '三课申寅', '四课寅申'],
      expectedTransmissions: ['寅', '申', '寅'],
    },
    {
      name: '雨水正月癸亥日甲子时',
      day: '癸亥',
      hour: '甲子',
      monthLeader: '亥',
      expectedPlate: [
        '子亥',
        '丑子',
        '寅丑',
        '卯寅',
        '辰卯',
        '巳辰',
        '午巳',
        '未午',
        '申未',
        '酉申',
        '戌酉',
        '亥戌',
      ],
      expectedLessons: ['一课子癸', '二课亥子', '三课戌亥', '四课酉戌'],
      expectedTransmissions: ['戌', '酉', '申'],
    },
    {
      name: '冬至十一月丙午日戊戌时',
      day: '丙午',
      hour: '戊戌',
      monthLeader: '丑',
      expectedPlate: [
        '戌丑',
        '亥寅',
        '子卯',
        '丑辰',
        '寅巳',
        '卯午',
        '辰未',
        '巳申',
        '午酉',
        '未戌',
        '申亥',
        '酉子',
      ],
      expectedLessons: ['一课申丙', '二课亥申', '三课酉午', '四课子酉'],
      expectedTransmissions: ['申', '亥', '寅'],
    },
    {
      name: '惊蛰二月己未日甲午时',
      day: '己未',
      hour: '甲午',
      monthLeader: '亥',
      expectedPlate: [
        '午亥',
        '未子',
        '申丑',
        '酉寅',
        '戌卯',
        '亥辰',
        '子巳',
        '丑午',
        '寅未',
        '卯申',
        '辰酉',
        '巳戌',
      ],
      expectedLessons: ['一课子己', '二课巳子', '三课子未', '四课巳子'],
      expectedTransmissions: ['巳', '戌', '卯'],
    },
  ];

  for (const item of cases) {
    const result = buildReferenceLiurenPlate(item);

    assert.deepEqual(
      item.expectedPlate.map((pair) => {
        const under = pair.charAt(0);
        return `${under}${getUpperByUnder(result.heavenlyPlate, under)}`;
      }),
      item.expectedPlate,
      `${item.name}天地盘应一致`,
    );
    assert.deepEqual(
      result.lessons.map((lesson) => `${lesson.name}${lesson.upper}${lesson.lower}`),
      item.expectedLessons,
      `${item.name}四课应一致`,
    );
    assert.deepEqual(result.branches, item.expectedTransmissions, `${item.name}三传应一致`);
  }
});

test('大六壬月将按中气切换，不按整个月支粗略取值', () => {
  const beforeYushui = generateLiuren(new Date('2026-02-18T23:50:00+08:00'));
  const afterYushui = generateLiuren(new Date('2026-02-18T23:52:00+08:00'));
  const beforeGuyu = generateLiuren(new Date('2026-04-20T09:38:00+08:00'));
  const afterGuyu = generateLiuren(new Date('2026-04-20T09:40:00+08:00'));

  assert.equal(beforeYushui.monthLeader, '子');
  assert.equal(afterYushui.monthLeader, '亥');
  assert.equal(beforeGuyu.monthLeader, '戌');
  assert.equal(afterGuyu.monthLeader, '酉');
});

test('大六壬十二中气月将应完整采用实际交节后的通行对应', () => {
  const cases: Array<[string, string]> = [
    ['2026-02-19T12:00:00+08:00', '亥'],
    ['2026-03-21T12:00:00+08:00', '戌'],
    ['2026-04-21T12:00:00+08:00', '酉'],
    ['2026-05-22T12:00:00+08:00', '申'],
    ['2026-06-22T12:00:00+08:00', '未'],
    ['2026-07-24T12:00:00+08:00', '午'],
    ['2026-08-24T12:00:00+08:00', '巳'],
    ['2026-09-24T12:00:00+08:00', '辰'],
    ['2026-10-24T12:00:00+08:00', '卯'],
    ['2026-11-23T12:00:00+08:00', '寅'],
    ['2026-12-23T12:00:00+08:00', '丑'],
    ['2027-01-21T12:00:00+08:00', '子'],
  ];

  for (const [date, expectedMonthLeader] of cases) {
    assert.equal(generateLiuren(new Date(date)).monthLeader, expectedMonthLeader, date);
  }
});

test('大六壬十日干昼夜贵人应完整采用通行表', () => {
  for (const dayStem of TIANGAN) {
    const expected = GUIREN_BRANCH_BY_STEM[dayStem];
    assert.equal(getNoblemanBranch(dayStem, '昼占'), expected.day, `${dayStem}日昼贵`);
    assert.equal(getNoblemanBranch(dayStem, '夜占'), expected.night, `${dayStem}日夜贵`);
  }
});

test('大六壬逐月神煞应按月建起，且与日支支马分层保存', () => {
  const result = generateLiuren(new Date('2026-01-01T12:00:00+08:00'));
  const facts = new Map(result.shenShaFacts?.map((item) => [item.name, item]));

  assert.equal(result.ganzhi.month.charAt(1), '子');
  assert.equal(result.ganzhi.day, '乙亥');
  assert.deepEqual(
    ['驿马', '劫煞', '亡神', '咸池', '破碎'].map((name) => [
      name,
      facts.get(name)?.target,
      facts.get(name)?.basis,
      facts.get(name)?.input,
    ]),
    [
      ['驿马', '寅', '月建', '子'],
      ['劫煞', '巳', '月建', '子'],
      ['亡神', '亥', '月建', '子'],
      ['咸池', '酉', '月建', '子'],
      ['破碎', '巳', '月建', '子'],
    ],
  );
  assert.deepEqual(
    [facts.get('支马')?.target, facts.get('支马')?.basis, facts.get('支马')?.input],
    ['巳', '日支', '亥'],
  );
  assert.ok(result.shenShaSummary?.includes('破碎在巳'));
  assert.ok(result.shenShaSummary?.every((item) => !item.startsWith('桃花')));
  assert.ok(
    result.shenShaFacts?.every(
      (item) =>
        item.rule &&
        item.sources.length > 0 &&
        item.limitations.length >= 4 &&
        item.limitations.some((limitation) => limitation.includes('一百七十项可复算神煞规则')),
    ),
  );
});

test('六壬神定经灾煞、月煞、干鬼与支鬼应按完整干支表复算', () => {
  const disasterByMonth = ['午', '卯', '子', '酉', '午', '卯', '子', '酉', '午', '卯', '子', '酉'];
  const monthShaByMonth = ['未', '辰', '丑', '戌', '未', '辰', '丑', '戌', '未', '辰', '丑', '戌'];
  const ganGuiByStem = ['申', '酉', '子', '亥', '寅', '卯', '午', '巳', '戌', '未'];
  const zhiGuiByBranch = ['辰', '卯', '申', '酉', '寅', '亥', '子', '卯', '午', '巳', '寅', '未'];

  DIZHI.forEach((monthBranch, index) => {
    const facts = new Map(
      buildShenShaFacts('甲', '子', monthBranch, '子', '甲').map((item) => [item.name, item]),
    );
    for (const [name, target] of [
      ['灾煞', disasterByMonth[index]],
      ['月煞', monthShaByMonth[index]],
    ] as const) {
      const fact = facts.get(name);
      assert.equal(fact?.target, target, `${monthBranch}月${name}`);
      assert.deepEqual(
        [fact?.basis, fact?.input, fact?.category, fact?.targetType],
        ['月建', monthBranch, '逐月神煞', '地支'],
      );
      assert.ok(fact?.sources.some((source) => source.includes('《六壬神定经》')));
    }
    assert.equal(facts.has('天煞'), false, `${monthBranch}月不得重复生成同位天煞`);
  });

  TIANGAN.forEach((dayStem, index) => {
    const fact = buildShenShaFacts('甲', '子', '子', '子', dayStem).find(
      (item) => item.name === '干鬼',
    );
    assert.equal(fact?.target, ganGuiByStem[index], `${dayStem}日干鬼`);
    assert.deepEqual(
      [fact?.basis, fact?.input, fact?.category, fact?.targetType],
      ['日干', dayStem, '十天干神煞', '地支'],
    );
    assert.ok(fact?.sources.some((source) => source.includes('《六壬神定经》')));
    assert.ok(fact?.limitations.some((item) => item.includes('不覆盖或替代日官')));
  });

  DIZHI.forEach((dayBranch, index) => {
    const fact = buildShenShaFacts('甲', '子', '子', dayBranch, '甲').find(
      (item) => item.name === '支鬼',
    );
    assert.equal(fact?.target, zhiGuiByBranch[index], `${dayBranch}日支鬼`);
    assert.deepEqual(
      [fact?.basis, fact?.input, fact?.category, fact?.targetType],
      ['日支', dayBranch, '十二地支神煞', '地支'],
    );
    assert.ok(fact?.sources.some((source) => source.includes('《六壬神定经》')));
    assert.ok(fact?.limitations.some((item) => item.includes('不自动判断')));
  });
});

test('大六壬十六项岁神煞应按年支完整循环，并与同位别名及其他层级分开', () => {
  const cases = [
    [
      2020,
      '子',
      [
        '子',
        '午',
        '辰',
        '巳',
        '巳',
        '亥',
        '寅',
        '戌',
        '戌',
        '申',
        '卯',
        '酉',
        '未',
        '辰',
        '戌',
        '未',
      ],
    ],
    [
      2021,
      '丑',
      [
        '丑',
        '未',
        '巳',
        '午',
        '午',
        '子',
        '卯',
        '亥',
        '亥',
        '酉',
        '戌',
        '酉',
        '申',
        '丑',
        '未',
        '辰',
      ],
    ],
    [
      2022,
      '寅',
      [
        '寅',
        '申',
        '午',
        '未',
        '未',
        '丑',
        '辰',
        '子',
        '子',
        '戌',
        '巳',
        '子',
        '酉',
        '戌',
        '辰',
        '丑',
      ],
    ],
    [
      2023,
      '卯',
      [
        '卯',
        '酉',
        '未',
        '申',
        '申',
        '寅',
        '巳',
        '丑',
        '丑',
        '亥',
        '子',
        '子',
        '戌',
        '未',
        '丑',
        '戌',
      ],
    ],
    [
      2024,
      '辰',
      [
        '辰',
        '戌',
        '申',
        '酉',
        '酉',
        '卯',
        '午',
        '寅',
        '寅',
        '子',
        '辰',
        '子',
        '亥',
        '辰',
        '戌',
        '未',
      ],
    ],
    [
      2025,
      '巳',
      [
        '巳',
        '亥',
        '酉',
        '戌',
        '戌',
        '辰',
        '未',
        '卯',
        '卯',
        '丑',
        '申',
        '卯',
        '子',
        '丑',
        '未',
        '辰',
      ],
    ],
    [
      2026,
      '午',
      [
        '午',
        '子',
        '戌',
        '亥',
        '亥',
        '巳',
        '申',
        '辰',
        '辰',
        '寅',
        '午',
        '卯',
        '丑',
        '戌',
        '辰',
        '丑',
      ],
    ],
    [
      2027,
      '未',
      [
        '未',
        '丑',
        '亥',
        '子',
        '子',
        '午',
        '酉',
        '巳',
        '巳',
        '卯',
        '丑',
        '卯',
        '寅',
        '未',
        '丑',
        '戌',
      ],
    ],
    [
      2028,
      '申',
      [
        '申',
        '寅',
        '子',
        '丑',
        '丑',
        '未',
        '戌',
        '午',
        '午',
        '辰',
        '寅',
        '午',
        '卯',
        '辰',
        '戌',
        '未',
      ],
    ],
    [
      2029,
      '酉',
      [
        '酉',
        '卯',
        '丑',
        '寅',
        '寅',
        '申',
        '亥',
        '未',
        '未',
        '巳',
        '酉',
        '午',
        '辰',
        '丑',
        '未',
        '辰',
      ],
    ],
    [
      2030,
      '戌',
      [
        '戌',
        '辰',
        '寅',
        '卯',
        '卯',
        '酉',
        '子',
        '申',
        '申',
        '午',
        '未',
        '午',
        '巳',
        '戌',
        '辰',
        '丑',
      ],
    ],
    [
      2031,
      '亥',
      [
        '亥',
        '巳',
        '卯',
        '辰',
        '辰',
        '戌',
        '丑',
        '酉',
        '酉',
        '未',
        '亥',
        '酉',
        '午',
        '未',
        '丑',
        '戌',
      ],
    ],
  ] as const;
  const names = [
    '太岁',
    '岁破',
    '岁官符',
    '小耗',
    '岁死符',
    '病符',
    '丧门',
    '吊客',
    '岁阴',
    '岁虎',
    '岁刑',
    '大将军',
    '岁墓',
    '岁黄幡',
    '岁豹尾',
    '岁煞',
  ] as const;

  for (const [year, yearBranch, targets] of cases) {
    const result = generateLiuren(new Date(`${year}-02-20T12:00:00+08:00`));
    const shenShaFacts = result.shenShaFacts ?? [];
    const facts = new Map(shenShaFacts.map((item) => [item.name, item]));
    assert.equal(result.ganzhi.year.charAt(1), yearBranch, `${year}年立春后年支`);
    assert.deepEqual(
      names.map((name) => [
        name,
        facts.get(name)?.target,
        facts.get(name)?.category,
        facts.get(name)?.basis,
        facts.get(name)?.input,
        facts.get(name)?.targetType,
      ]),
      names.map((name, index) => [name, targets[index], '岁神煞', '年支', yearBranch, '地支']),
      `${yearBranch}年十六项岁神煞`,
    );
    assert.equal(new Set(shenShaFacts.map((item) => item.name)).size, shenShaFacts.length);
    assert.ok(
      ['大耗', '破煞', '官符', '岁宅', '死符', '太阴', '白虎', '将军', '豹尾'].every(
        (name) => !facts.has(name),
      ),
      `${yearBranch}年不得把岁神煞同位别名重复生成为事实`,
    );
    assert.equal(facts.get('黄幡')?.basis, '月建', `${yearBranch}年普通黄幡仍应属于逐月层`);
    assert.equal(
      facts.get('岁阴')?.target,
      facts.get('吊客')?.target,
      `${yearBranch}年岁阴应与吊客同位`,
    );
    assert.equal(
      LIUCHONG_MAP[facts.get('岁黄幡')?.target ?? ''],
      facts.get('岁豹尾')?.target,
      `${yearBranch}年岁黄幡与岁豹尾应保持对冲`,
    );
  }

  const sampleFacts = new Map(
    generateLiuren(new Date('2020-02-20T12:00:00+08:00')).shenShaFacts?.map((item) => [
      item.name,
      item,
    ]),
  );
  assert.match(sampleFacts.get('太岁')?.sources.join('；') ?? '', /六壬大全.+年支本位/);
  assert.match(sampleFacts.get('岁破')?.sources.join('；') ?? '', /岁破大耗与年冲.+岁破又名大耗/);
  assert.match(
    sampleFacts.get('岁官符')?.sources.join('；') ?? '',
    /岁前四畜官官符神.+五行精纪.+从太岁数起至第五辰.+奇门遁甲统宗.+张果星宗/,
  );
  assert.match(sampleFacts.get('小耗')?.sources.join('；') ?? '', /岁前五辰.+小耗又名岁宅/);
  assert.match(
    sampleFacts.get('岁死符')?.sources.join('；') ?? '',
    /前五死符并小耗.+奇门遁甲统宗.+张果星宗.+五行精纪.+病符对冲/,
  );
  assert.match(sampleFacts.get('病符')?.sources.join('；') ?? '', /病符后一不离宗.+旧太岁/);
  assert.match(sampleFacts.get('丧门')?.sources.join('；') ?? '', /岁前二辰丧门.+岁前二辰是丧门/);
  assert.match(sampleFacts.get('吊客')?.sources.join('；') ?? '', /岁后二辰为吊客.+岁后二辰是吊客/);
  assert.match(
    sampleFacts.get('岁阴')?.sources.join('；') ?? '',
    /后二太阴并吊客.+岁阴旺相生主将.+太阴在太岁后二位.+六壬兵占/,
  );
  assert.match(
    sampleFacts.get('岁虎')?.sources.join('；') ?? '',
    /岁后四辰.+岁后四神.+亥年未为岁虎/,
  );
  assert.match(
    sampleFacts.get('岁刑')?.sources.join('；') ?? '',
    /六壬大全.+六壬指南注解.+太岁所刑/,
  );
  assert.match(
    sampleFacts.get('大将军')?.sources.join('；') ?? '',
    /三年一移.+六壬兵占.+六壬粹言.+六壬银河櫂/,
  );
  assert.match(
    sampleFacts.get('岁墓')?.sources.join('；') ?? '',
    /岁后五位.+子年未、卯年戌、午年丑、酉年辰/,
  );
  assert.match(sampleFacts.get('岁黄幡')?.sources.join('；') ?? '', /黄幡只向三合来.+其冲名黄幡/);
  assert.match(sampleFacts.get('岁豹尾')?.sources.join('；') ?? '', /岁豹尾四组位置.+六壬兵占/);
  assert.match(sampleFacts.get('岁煞')?.sources.join('；') ?? '', /未、辰、丑、戌三轮.+六壬心镜/);
  assert.match(sampleFacts.get('岁破')?.limitations.join('；') ?? '', /不另生成.+大耗.+破煞/);
  assert.match(
    sampleFacts.get('岁官符')?.limitations.join('；') ?? '',
    /逐月官符.+金口诀官符.+催官符.+不生成普通“官符”.+不因单项出现自动判断官司/,
  );
  assert.match(sampleFacts.get('小耗')?.limitations.join('；') ?? '', /不另生成.+岁宅/);
  assert.match(
    sampleFacts.get('岁死符')?.limitations.join('；') ?? '',
    /年干死符.+逐月死符.+不生成普通“死符”.+不因单项出现自动判断疾病、死亡/,
  );
  assert.match(sampleFacts.get('病符')?.limitations.join('；') ?? '', /支病符.+分层保存/);
  assert.match(
    sampleFacts.get('岁阴')?.limitations.join('；') ?? '',
    /区别.+十二天将“太阴”.+不另生成同位别名“太阴”.+与吊客虽同在岁后二辰.+分为两项事实保存/,
  );
  assert.match(
    sampleFacts.get('岁虎')?.limitations.join('；') ?? '',
    /十二天将白虎及旬虎.+不另生成.+白虎/,
  );
  assert.match(sampleFacts.get('岁刑')?.limitations.join('；') ?? '', /不因单项出现自动判断刑责/);
  assert.match(
    sampleFacts.get('大将军')?.limitations.join('；') ?? '',
    /不另生成简称“将军”.+行人归期/,
  );
  assert.match(
    sampleFacts.get('岁墓')?.limitations.join('；') ?? '',
    /不把岁墓与日干墓、五墓、墓门或天将蛇虎合并/,
  );
  assert.match(sampleFacts.get('岁黄幡')?.limitations.join('；') ?? '', /按月表的“黄幡”分层保存/);
  assert.match(
    sampleFacts.get('岁豹尾')?.limitations.join('；') ?? '',
    /尚未闭合的逐月“豹尾”.+不据岁煞表补造/,
  );
  assert.match(sampleFacts.get('岁煞')?.limitations.join('；') ?? '', /不代替.+月煞、灾煞、劫煞/);
});

test('大六壬岁德与岁干合应按十年干循环，并与岁支六合及落支算法分层', () => {
  const cases = [
    [2020, '庚', '庚', '乙'],
    [2021, '辛', '丙', '丙'],
    [2022, '壬', '壬', '丁'],
    [2023, '癸', '戊', '戊'],
    [2024, '甲', '甲', '己'],
    [2025, '乙', '庚', '庚'],
    [2026, '丙', '丙', '辛'],
    [2027, '丁', '壬', '壬'],
    [2028, '戊', '戊', '癸'],
    [2029, '己', '甲', '甲'],
  ] as const;

  for (const [year, yearStem, expectedSuiDe, expectedSuiGanHe] of cases) {
    const result = generateLiuren(new Date(`${year}-02-20T12:00:00+08:00`));
    const facts = new Map(result.shenShaFacts?.map((item) => [item.name, item]));
    assert.equal(result.ganzhi.year.charAt(0), yearStem, `${year}年立春后年干`);
    assert.deepEqual(
      ['岁德', '岁干合'].map((name) => [
        facts.get(name)?.target,
        facts.get(name)?.targetType,
        facts.get(name)?.category,
        facts.get(name)?.basis,
        facts.get(name)?.input,
      ]),
      [expectedSuiDe, expectedSuiGanHe].map((target) => [
        target,
        '天干',
        '岁神煞',
        '年干',
        yearStem,
      ]),
      `${yearStem}年岁德与岁干合`,
    );
  }

  const dingYearFacts = new Map(
    generateLiuren(new Date('2027-02-20T12:00:00+08:00')).shenShaFacts?.map((item) => [
      item.name,
      item,
    ]),
  );
  assert.match(
    dingYearFacts.get('岁德')?.sources.join('；') ?? '',
    /岁德，即岁君，阴年从阳.+四库全书.+丁丑年.+丁年岁德取壬/,
  );
  assert.match(
    dingYearFacts.get('岁德')?.limitations.join('；') ?? '',
    /岁德正官.+不把岁德天干直接改写成固定地支/,
  );

  const jiaYearFacts = new Map(
    generateLiuren(new Date('2024-02-20T12:00:00+08:00')).shenShaFacts?.map((item) => [
      item.name,
      item,
    ]),
  );
  assert.match(
    jiaYearFacts.get('岁干合')?.sources.join('；') ?? '',
    /岁合，即甲年见己.+六壬兵占.+甲申年“岁合在己”/,
  );
  assert.match(
    jiaYearFacts.get('岁干合')?.limitations.join('；') ?? '',
    /原典名称为“岁合”.+太岁地支与其六合支.+五子元遁.+不补造固定地支/,
  );
  assert.equal(jiaYearFacts.has('岁合'), false, '不得重复生成边界不明的普通“岁合”事实');
});

test('大六壬岁方四神与岁五鬼应按年支定位，并与同名异层规则分开', () => {
  const cases = [
    [2020, '子', ['艮', '坤', '乾', '巽', '辰']],
    [2021, '丑', ['艮', '坤', '乾', '巽', '卯']],
    [2022, '寅', ['巽', '乾', '艮', '坤', '寅']],
    [2023, '卯', ['巽', '乾', '艮', '坤', '丑']],
    [2024, '辰', ['巽', '乾', '艮', '坤', '子']],
    [2025, '巳', ['坤', '艮', '巽', '乾', '亥']],
    [2026, '午', ['坤', '艮', '巽', '乾', '戌']],
    [2027, '未', ['坤', '艮', '巽', '乾', '酉']],
    [2028, '申', ['乾', '巽', '坤', '艮', '申']],
    [2029, '酉', ['乾', '巽', '坤', '艮', '未']],
    [2030, '戌', ['乾', '巽', '坤', '艮', '午']],
    [2031, '亥', ['艮', '坤', '乾', '巽', '巳']],
  ] as const;
  const names = ['力士', '蚕室', '奏书', '博士', '岁五鬼'] as const;

  for (const [year, yearBranch, targets] of cases) {
    const result = generateLiuren(new Date(`${year}-02-20T12:00:00+08:00`));
    const facts = new Map(result.shenShaFacts?.map((item) => [item.name, item]));
    assert.deepEqual(
      names.map((name) => [facts.get(name)?.target, facts.get(name)?.targetType]),
      targets.map((target, index) => [target, index === 4 ? '地支' : '八卦方位']),
      `${yearBranch}年岁方四神与岁五鬼`,
    );
    assert.ok(
      names.every(
        (name) =>
          facts.get(name)?.category === '岁神煞' &&
          facts.get(name)?.basis === '年支' &&
          facts.get(name)?.input === yearBranch,
      ),
    );
    assert.equal(facts.get('五鬼')?.basis, '月建', `${yearBranch}年普通五鬼仍应属于逐月层`);
  }

  const sampleFacts = new Map(
    generateLiuren(new Date('2020-02-20T12:00:00+08:00')).shenShaFacts?.map((item) => [
      item.name,
      item,
    ]),
  );
  assert.match(
    sampleFacts.get('力士')?.sources.join('；') ?? '',
    /太岁前维力士位.+协纪辨方书.+玉匣记/,
  );
  assert.match(sampleFacts.get('蚕室')?.sources.join('；') ?? '', /对冲蚕室.+常与力士对冲.+玉匣记/);
  assert.match(
    sampleFacts.get('奏书')?.sources.join('；') ?? '',
    /奏书后维.+蓬瀛书.+六十年表.+玉匣记/,
  );
  assert.match(
    sampleFacts.get('博士')?.sources.join('；') ?? '',
    /冲博士.+常与奏书对冲.+六十年表.+玉匣记/,
  );
  assert.match(
    sampleFacts.get('岁五鬼')?.sources.join('；') ?? '',
    /五鬼逆行子加辰.+子年在辰逆行十二辰.+卜筮全书/,
  );
  assert.match(
    sampleFacts.get('力士')?.limitations.join('；') ?? '',
    /“前维”.+艮、巽、坤、乾四隅.+不换算成单一地支/,
  );
  assert.match(sampleFacts.get('蚕室')?.limitations.join('；') ?? '', /蚕女行年加太岁.+蚕官、蚕命/);
  assert.match(sampleFacts.get('奏书')?.limitations.join('；') ?? '', /功曹、天空.+普通奏章文书/);
  assert.match(
    sampleFacts.get('博士')?.limitations.join('；') ?? '',
    /职业称谓、太常类象.+博士十二神/,
  );
  assert.match(
    sampleFacts.get('岁五鬼')?.limitations.join('；') ?? '',
    /区别.+按月建定位的“五鬼”.+破败五鬼/,
  );
});

test('大六壬罗网应按日干寄宫前一支与日支前一支定位，并保留异说边界', () => {
  const haiDay = generateLiuren(new Date('2026-01-01T12:00:00+08:00'));
  const ziDay = generateLiuren(new Date('2026-01-02T12:00:00+08:00'));
  const haiFacts = new Map(haiDay.shenShaFacts?.map((item) => [item.name, item]));
  const ziFacts = new Map(ziDay.shenShaFacts?.map((item) => [item.name, item]));

  assert.equal(haiDay.ganzhi.day, '乙亥');
  assert.deepEqual(
    [haiFacts.get('天罗')?.target, haiFacts.get('天罗')?.basis, haiFacts.get('天罗')?.input],
    ['巳', '日干', '乙'],
  );
  assert.deepEqual(
    [haiFacts.get('地网')?.target, haiFacts.get('地网')?.basis, haiFacts.get('地网')?.input],
    ['子', '日支', '亥'],
  );
  assert.match(haiFacts.get('天罗')?.sources.join('；') ?? '', /十天干神煞/);
  assert.match(haiFacts.get('地网')?.limitations.join('；') ?? '', /地网取天罗对冲的异说/);

  assert.equal(ziDay.ganzhi.day, '丙子');
  assert.deepEqual(
    [ziFacts.get('天罗')?.target, ziFacts.get('天罗')?.basis, ziFacts.get('天罗')?.input],
    ['午', '日干', '丙'],
  );
  assert.deepEqual(
    [ziFacts.get('地网')?.target, ziFacts.get('地网')?.basis, ziFacts.get('地网')?.input],
    ['丑', '日支', '子'],
  );
  assert.ok(ziDay.shenShaSummary?.every((item) => !item.startsWith('命带')));
});

test('大六壬已登记神煞应覆盖十二月建与六十日柱固定表', () => {
  const monthCases: Array<[string, string, string[], string | undefined]> = [
    [
      '2026-02-19T12:00:00+08:00',
      '寅',
      [
        '申',
        '亥',
        '巳',
        '卯',
        '酉',
        '未',
        '巳',
        '午',
        '戌',
        '未',
        '申',
        '丑',
        '巳',
        '申',
        '申',
        '申',
        '寅',
        '巳',
        '丑',
        '戌',
        '寅',
        '巳',
        '巳',
        '丑',
        '午',
        '酉',
        '子',
        '午',
        '巳',
      ],
      '亥',
    ],
    [
      '2026-03-21T12:00:00+08:00',
      '卯',
      [
        '巳',
        '申',
        '寅',
        '子',
        '巳',
        '申',
        '寅',
        '申',
        '未',
        '戌',
        '戌',
        '丑',
        '巳',
        '未',
        '申',
        '申',
        '寅',
        '巳',
        '寅',
        '巳',
        '巳',
        '子',
        '巳',
        '丑',
        '辰',
        '午',
        '丑',
        '未',
        '午',
      ],
      undefined,
    ],
    [
      '2026-04-21T12:00:00+08:00',
      '辰',
      [
        '寅',
        '巳',
        '亥',
        '酉',
        '丑',
        '亥',
        '亥',
        '戌',
        '未',
        '寅',
        '寅',
        '丑',
        '巳',
        '午',
        '酉',
        '申',
        '寅',
        '巳',
        '子',
        '午',
        '申',
        '辰',
        '巳',
        '丑',
        '寅',
        '卯',
        '寅',
        '申',
        '未',
      ],
      '未',
    ],
    [
      '2026-05-22T12:00:00+08:00',
      '巳',
      [
        '亥',
        '寅',
        '申',
        '午',
        '酉',
        '戌',
        '申',
        '子',
        '辰',
        '亥',
        '丑',
        '子',
        '子',
        '巳',
        '酉',
        '寅',
        '亥',
        '卯',
        '丑',
        '未',
        '亥',
        '申',
        '辰',
        '辰',
        '酉',
        '子',
        '卯',
        '酉',
        '申',
      ],
      '巳',
    ],
    [
      '2026-06-22T12:00:00+08:00',
      '午',
      [
        '申',
        '亥',
        '巳',
        '卯',
        '巳',
        '亥',
        '巳',
        '寅',
        '戌',
        '酉',
        '亥',
        '子',
        '子',
        '辰',
        '戌',
        '寅',
        '亥',
        '卯',
        '寅',
        '申',
        '卯',
        '午',
        '辰',
        '辰',
        '卯',
        '酉',
        '辰',
        '戌',
        '酉',
      ],
      undefined,
    ],
    [
      '2026-07-24T12:00:00+08:00',
      '未',
      [
        '巳',
        '申',
        '寅',
        '子',
        '丑',
        '寅',
        '寅',
        '辰',
        '未',
        '子',
        '辰',
        '子',
        '子',
        '卯',
        '戌',
        '寅',
        '亥',
        '卯',
        '子',
        '酉',
        '午',
        '丑',
        '辰',
        '辰',
        '申',
        '午',
        '巳',
        '亥',
        '戌',
      ],
      '未',
    ],
    [
      '2026-08-24T12:00:00+08:00',
      '申',
      [
        '寅',
        '巳',
        '亥',
        '酉',
        '酉',
        '丑',
        '亥',
        '午',
        '未',
        '丑',
        '巳',
        '亥',
        '酉',
        '寅',
        '亥',
        '巳',
        '申',
        '酉',
        '丑',
        '辰',
        '酉',
        '寅',
        '未',
        '未',
        '丑',
        '卯',
        '午',
        '子',
        '亥',
      ],
      '巳',
    ],
    [
      '2026-09-24T12:00:00+08:00',
      '酉',
      [
        '亥',
        '寅',
        '申',
        '午',
        '巳',
        '寅',
        '申',
        '申',
        '辰',
        '午',
        '未',
        '亥',
        '酉',
        '丑',
        '亥',
        '巳',
        '申',
        '酉',
        '寅',
        '亥',
        '子',
        '酉',
        '未',
        '未',
        '巳',
        '子',
        '未',
        '丑',
        '子',
      ],
      undefined,
    ],
    [
      '2026-10-24T12:00:00+08:00',
      '戌',
      [
        '申',
        '亥',
        '巳',
        '卯',
        '丑',
        '巳',
        '巳',
        '戌',
        '戌',
        '巳',
        '巳',
        '亥',
        '酉',
        '子',
        '午',
        '巳',
        '申',
        '酉',
        '子',
        '子',
        '辰',
        '未',
        '未',
        '未',
        '子',
        '酉',
        '申',
        '寅',
        '丑',
      ],
      '戌',
    ],
    [
      '2026-11-23T12:00:00+08:00',
      '亥',
      [
        '巳',
        '申',
        '寅',
        '子',
        '酉',
        '辰',
        '寅',
        '子',
        '未',
        '卯',
        '未',
        '戌',
        '辰',
        '亥',
        '午',
        '亥',
        '巳',
        '子',
        '丑',
        '丑',
        '未',
        '亥',
        '酉',
        '戌',
        '亥',
        '午',
        '酉',
        '卯',
        '寅',
      ],
      '申',
    ],
    [
      '2026-12-23T12:00:00+08:00',
      '子',
      [
        '寅',
        '巳',
        '亥',
        '酉',
        '巳',
        '巳',
        '亥',
        '寅',
        '未',
        '申',
        '申',
        '戌',
        '辰',
        '戌',
        '未',
        '亥',
        '巳',
        '子',
        '寅',
        '寅',
        '戌',
        '卯',
        '酉',
        '戌',
        '未',
        '卯',
        '戌',
        '辰',
        '卯',
      ],
      undefined,
    ],
    [
      '2027-01-21T12:00:00+08:00',
      '丑',
      [
        '亥',
        '寅',
        '申',
        '午',
        '丑',
        '申',
        '申',
        '辰',
        '辰',
        '辰',
        '戌',
        '戌',
        '辰',
        '酉',
        '未',
        '亥',
        '巳',
        '子',
        '子',
        '卯',
        '丑',
        '戌',
        '酉',
        '戌',
        '戌',
        '子',
        '亥',
        '巳',
        '辰',
      ],
      '辰',
    ],
  ];
  const monthFactNames = [
    '驿马',
    '劫煞',
    '亡神',
    '咸池',
    '破碎',
    '天德',
    '月德',
    '天马',
    '月合',
    '会神',
    '信神',
    '游神',
    '戏神',
    '天解',
    '解神',
    '飞祸',
    '奸神',
    '时盗',
    '归忌',
    '飞廉',
    '往亡',
    '月刑',
    '天车',
    '关锁',
    '五鬼',
    '天鬼',
    '生气',
    '死气',
    '死神',
    '天喜',
    '成神',
    '浴盆',
    '丧魄',
    '游魂',
    '圣心',
    '受死',
    '罪至',
    '血忌',
    '天巫',
    '游煞',
    '天书',
    '天厕',
    '月害',
    '井煞',
    '天坑',
  ];
  const addedMonthFactNames = [
    '天合',
    '月合',
    '会神',
    '信神',
    '游神',
    '戏神',
    '天解',
    '解神',
    '飞祸',
    '奸神',
    '时盗',
    '归忌',
    '飞廉',
    '往亡',
    '月刑',
    '天车',
    '关锁',
    '五鬼',
    '天鬼',
    '生气',
    '死气',
    '死神',
    '天喜',
    '成神',
    '浴盆',
    '丧魄',
    '游魂',
    '圣心',
    '受死',
    '罪至',
    '血忌',
    '天巫',
    '游煞',
    '天书',
    '天厕',
    '月害',
    '井煞',
    '天坑',
  ];
  const addedMonthTargets: Record<string, readonly string[]> = {
    寅: ['戌', '巳', '辰', '未', '亥', '亥', '戌', '午', '丑', '辰', '卯'],
    卯: ['戌', '巳', '辰', '辰', '子', '巳', '辰', '子', '未', '巳', '辰'],
    辰: ['戌', '巳', '辰', '丑', '丑', '子', '亥', '未', '寅', '午', '巳'],
    巳: ['丑', '申', '未', '戌', '寅', '午', '巳', '丑', '申', '未', '午'],
    午: ['丑', '申', '未', '未', '卯', '丑', '子', '申', '卯', '申', '未'],
    未: ['丑', '申', '未', '辰', '辰', '未', '午', '寅', '酉', '酉', '申'],
    申: ['辰', '亥', '戌', '丑', '巳', '寅', '丑', '酉', '辰', '戌', '酉'],
    酉: ['辰', '亥', '戌', '戌', '午', '申', '未', '卯', '戌', '亥', '戌'],
    戌: ['辰', '亥', '戌', '未', '未', '卯', '寅', '戌', '巳', '子', '亥'],
    亥: ['未', '寅', '丑', '辰', '申', '酉', '申', '辰', '亥', '丑', '子'],
    子: ['未', '寅', '丑', '丑', '酉', '辰', '卯', '亥', '午', '寅', '丑'],
    丑: ['未', '寅', '丑', '戌', '戌', '戌', '酉', '巳', '子', '卯', '寅'],
  };
  const auditedMonthTargets: Record<string, readonly string[]> = {
    寅: ['戌', '寅', '巳', '未', '丑'],
    卯: ['亥', '巳', '辰', '申', '寅'],
    辰: ['子', '申', '卯', '酉', '卯'],
    巳: ['丑', '亥', '寅', '戌', '辰'],
    午: ['寅', '寅', '丑', '亥', '巳'],
    未: ['卯', '巳', '子', '子', '午'],
    申: ['辰', '申', '亥', '丑', '未'],
    酉: ['巳', '亥', '戌', '寅', '申'],
    戌: ['午', '寅', '酉', '卯', '酉'],
    亥: ['未', '巳', '申', '辰', '戌'],
    子: ['申', '申', '未', '巳', '亥'],
    丑: ['酉', '亥', '午', '午', '子'],
  };
  const newlyAuditedMonthFactNames = [
    '煞神',
    '墓门',
    '女灾',
    '贼神',
    '奸门',
    '产煞',
    '血支',
    '邪神',
    '火鬼',
    '火怪',
    '雷煞',
    '火烛',
    '天牢',
    '火神',
    '悬索',
  ];
  const newlyAuditedMonthTargets: Record<string, readonly string[]> = {
    寅: ['申', '亥', '亥', '卯', '申', '寅', '丑', '未', '午', '戌', '亥', '巳', '丑', '丑', '卯'],
    卯: ['申', '申', '申', '卯', '亥', '巳', '寅', '午', '午', '未', '申', '午', '寅', '丑', '子'],
    辰: ['申', '巳', '巳', '卯', '寅', '申', '卯', '巳', '午', '辰', '巳', '未', '卯', '丑', '酉'],
    巳: ['亥', '寅', '寅', '午', '巳', '亥', '辰', '辰', '酉', '丑', '寅', '申', '辰', '子', '午'],
    午: ['亥', '亥', '亥', '午', '申', '寅', '巳', '卯', '酉', '戌', '亥', '酉', '巳', '子', '卯'],
    未: ['亥', '申', '申', '午', '亥', '巳', '午', '寅', '酉', '未', '申', '戌', '午', '子', '子'],
    申: ['寅', '巳', '巳', '酉', '寅', '申', '未', '丑', '子', '辰', '巳', '亥', '未', '戌', '酉'],
    酉: ['寅', '寅', '寅', '酉', '巳', '亥', '申', '子', '子', '丑', '寅', '子', '申', '戌', '午'],
    戌: ['寅', '亥', '亥', '酉', '申', '寅', '酉', '亥', '子', '戌', '亥', '丑', '酉', '戌', '卯'],
    亥: ['巳', '申', '申', '子', '亥', '巳', '戌', '戌', '卯', '未', '申', '寅', '戌', '亥', '子'],
    子: ['巳', '巳', '巳', '子', '寅', '申', '亥', '酉', '卯', '辰', '巳', '卯', '亥', '亥', '酉'],
    丑: ['巳', '寅', '寅', '子', '巳', '亥', '子', '申', '卯', '丑', '寅', '辰', '子', '亥', '午'],
  };
  const latestAuditedMonthFactNames = ['皇书', '战雄', '吏神', '月符', '钥神', '三丘', '寡宿'];
  const latestAuditedMonthTargets: Record<string, readonly string[]> = {
    寅: ['寅', '寅', '寅', '辰', '巳', '丑', '丑'],
    卯: ['寅', '寅', '寅', '辰', '巳', '丑', '丑'],
    辰: ['寅', '寅', '寅', '辰', '巳', '丑', '丑'],
    巳: ['巳', '巳', '巳', '未', '申', '辰', '辰'],
    午: ['巳', '巳', '巳', '未', '申', '辰', '辰'],
    未: ['巳', '巳', '巳', '未', '申', '辰', '辰'],
    申: ['申', '申', '申', '戌', '亥', '未', '未'],
    酉: ['申', '申', '申', '戌', '亥', '未', '未'],
    戌: ['申', '申', '申', '戌', '亥', '未', '未'],
    亥: ['亥', '亥', '亥', '丑', '寅', '戌', '戌'],
    子: ['亥', '亥', '亥', '丑', '寅', '戌', '戌'],
    丑: ['亥', '亥', '亥', '丑', '寅', '戌', '戌'],
  };
  const currentAuditedMonthFactNames = [
    '风伯',
    '战雌',
    '迷惑',
    '枯骨',
    '上丧',
    '哭神',
    '病煞',
    '阳煞',
    '天鸡',
    '月厌',
  ];
  const currentAuditedMonthTargets: Record<string, readonly string[]> = {
    寅: ['申', '申', '丑', '未', '辰', '未', '亥', '亥', '酉', '戌'],
    卯: ['未', '申', '戌', '申', '未', '未', '子', '寅', '申', '酉'],
    辰: ['午', '申', '未', '酉', '戌', '未', '丑', '巳', '未', '申'],
    巳: ['巳', '亥', '辰', '戌', '丑', '戌', '寅', '申', '午', '未'],
    午: ['辰', '亥', '丑', '亥', '辰', '戌', '卯', '亥', '巳', '午'],
    未: ['卯', '亥', '戌', '子', '未', '戌', '辰', '寅', '辰', '巳'],
    申: ['寅', '寅', '未', '丑', '戌', '丑', '巳', '巳', '卯', '辰'],
    酉: ['丑', '寅', '辰', '寅', '丑', '丑', '午', '申', '寅', '卯'],
    戌: ['子', '寅', '丑', '卯', '辰', '丑', '未', '亥', '丑', '寅'],
    亥: ['亥', '巳', '戌', '辰', '未', '辰', '申', '寅', '子', '丑'],
    子: ['戌', '巳', '未', '巳', '戌', '辰', '酉', '巳', '亥', '子'],
    丑: ['酉', '巳', '辰', '午', '丑', '辰', '戌', '申', '戌', '亥'],
  };
  const nextAuditedMonthFactNames = ['谩语', '信煞', '天鼠'];
  const nextAuditedMonthTargets: Record<string, readonly string[]> = {
    寅: ['午', '酉', '子'],
    卯: ['未', '戌', '亥'],
    辰: ['申', '亥', '戌'],
    巳: ['酉', '子', '酉'],
    午: ['戌', '丑', '申'],
    未: ['亥', '寅', '未'],
    申: ['子', '卯', '午'],
    酉: ['丑', '辰', '巳'],
    戌: ['寅', '巳', '辰'],
    亥: ['卯', '午', '卯'],
    子: ['辰', '未', '寅'],
    丑: ['巳', '申', '丑'],
  };
  const finalAuditedMonthFactNames = [
    '下丧',
    '灭门',
    '转煞',
    '四废',
    '死别',
    '天牛',
    '大时',
    '小时',
    '天目',
    '雌虎',
    '梦神',
    '黄幡',
    '阴煞',
    '忧神',
    '风煞',
    '长绳',
  ];
  const finalAuditedMonthTargets: Record<string, readonly string[]> = {
    寅: [
      '未',
      '亥',
      '卯',
      '酉',
      '戌',
      '丑',
      '卯',
      '寅',
      '辰',
      '辰',
      '辰',
      '戌',
      '巳',
      '丑',
      '寅',
      '酉',
    ],
    卯: [
      '辰',
      '午',
      '卯',
      '酉',
      '戌',
      '寅',
      '子',
      '卯',
      '辰',
      '巳',
      '戌',
      '未',
      '辰',
      '丑',
      '丑',
      '午',
    ],
    辰: [
      '丑',
      '丑',
      '卯',
      '酉',
      '戌',
      '卯',
      '酉',
      '辰',
      '辰',
      '午',
      '丑',
      '辰',
      '卯',
      '丑',
      '子',
      '卯',
    ],
    巳: [
      '戌',
      '申',
      '午',
      '子',
      '未',
      '辰',
      '午',
      '巳',
      '未',
      '未',
      '未',
      '丑',
      '寅',
      '子',
      '亥',
      '子',
    ],
    午: [
      '未',
      '卯',
      '午',
      '子',
      '未',
      '巳',
      '卯',
      '午',
      '未',
      '申',
      '辰',
      '戌',
      '丑',
      '子',
      '戌',
      '酉',
    ],
    未: [
      '辰',
      '戌',
      '午',
      '子',
      '未',
      '午',
      '子',
      '未',
      '未',
      '酉',
      '戌',
      '未',
      '子',
      '子',
      '酉',
      '午',
    ],
    申: [
      '丑',
      '巳',
      '酉',
      '卯',
      '辰',
      '未',
      '酉',
      '申',
      '戌',
      '戌',
      '丑',
      '辰',
      '亥',
      '戌',
      '申',
      '卯',
    ],
    酉: [
      '戌',
      '子',
      '酉',
      '卯',
      '辰',
      '申',
      '午',
      '酉',
      '戌',
      '亥',
      '未',
      '丑',
      '戌',
      '戌',
      '未',
      '子',
    ],
    戌: [
      '未',
      '未',
      '酉',
      '卯',
      '辰',
      '酉',
      '卯',
      '戌',
      '戌',
      '子',
      '辰',
      '戌',
      '酉',
      '戌',
      '午',
      '酉',
    ],
    亥: [
      '辰',
      '寅',
      '子',
      '午',
      '丑',
      '戌',
      '子',
      '亥',
      '丑',
      '丑',
      '戌',
      '未',
      '申',
      '亥',
      '巳',
      '午',
    ],
    子: [
      '丑',
      '酉',
      '子',
      '午',
      '丑',
      '亥',
      '酉',
      '子',
      '丑',
      '寅',
      '丑',
      '辰',
      '未',
      '亥',
      '辰',
      '卯',
    ],
    丑: [
      '戌',
      '辰',
      '子',
      '午',
      '丑',
      '子',
      '午',
      '丑',
      '丑',
      '卯',
      '未',
      '丑',
      '午',
      '亥',
      '卯',
      '子',
    ],
  };
  const newestAuditedMonthFactNames = ['皇恩'];
  const newestAuditedMonthTargets: Record<string, readonly string[]> = {
    寅: ['未'],
    卯: ['酉'],
    辰: ['亥'],
    巳: ['丑'],
    午: ['卯'],
    未: ['巳'],
    申: ['未'],
    酉: ['酉'],
    戌: ['亥'],
    亥: ['丑'],
    子: ['卯'],
    丑: ['巳'],
  };
  const subsequentAuditedMonthFactNames = ['月破'];
  const subsequentAuditedMonthTargets: Record<string, readonly string[]> = {
    寅: ['申'],
    卯: ['酉'],
    辰: ['戌'],
    巳: ['亥'],
    午: ['子'],
    未: ['丑'],
    申: ['寅'],
    酉: ['卯'],
    戌: ['辰'],
    亥: ['巳'],
    子: ['午'],
    丑: ['未'],
  };

  for (const [date, monthBranch, expectedTargets, expectedTianHe] of monthCases) {
    const result = generateLiuren(new Date(date));
    const facts = new Map(result.shenShaFacts?.map((item) => [item.name, item]));
    assert.equal(result.ganzhi.month.charAt(1), monthBranch, date);
    assert.deepEqual(
      [
        ...monthFactNames,
        ...newlyAuditedMonthFactNames,
        ...latestAuditedMonthFactNames,
        ...currentAuditedMonthFactNames,
        ...nextAuditedMonthFactNames,
        ...finalAuditedMonthFactNames,
        ...newestAuditedMonthFactNames,
        ...subsequentAuditedMonthFactNames,
      ].map((name) => facts.get(name)?.target),
      [
        ...expectedTargets,
        ...addedMonthTargets[monthBranch],
        ...auditedMonthTargets[monthBranch],
        ...newlyAuditedMonthTargets[monthBranch],
        ...latestAuditedMonthTargets[monthBranch],
        ...currentAuditedMonthTargets[monthBranch],
        ...nextAuditedMonthTargets[monthBranch],
        ...finalAuditedMonthTargets[monthBranch],
        ...newestAuditedMonthTargets[monthBranch],
        ...subsequentAuditedMonthTargets[monthBranch],
      ],
      `${monthBranch}月逐月神煞表`,
    );
    assert.ok(monthFactNames.every((name) => facts.get(name)?.basis === '月建'));
    assert.ok(monthFactNames.every((name) => facts.get(name)?.targetType === '地支'));
    assert.match(facts.get('天德')?.rule ?? '', /天德表取.+(?:依十干寄宫落.)?/);
    assert.match(facts.get('月德')?.rule ?? '', /依十干寄宫落/);
    assert.equal(facts.get('天合')?.target, expectedTianHe, `${monthBranch}月天合表`);
    for (const name of [
      ...addedMonthFactNames,
      ...newlyAuditedMonthFactNames,
      ...latestAuditedMonthFactNames,
      ...currentAuditedMonthFactNames,
      ...nextAuditedMonthFactNames,
      ...finalAuditedMonthFactNames,
      ...newestAuditedMonthFactNames,
      ...subsequentAuditedMonthFactNames,
    ]) {
      const fact = facts.get(name);
      if (name === '天合' && expectedTianHe === undefined) {
        assert.equal(fact, undefined, `${monthBranch}月天德落地支，不补造天合`);
        continue;
      }
      assert.equal(fact?.category, '逐月神煞', `${monthBranch}月${name}类别`);
      assert.equal(fact?.basis, '月建', `${monthBranch}月${name}依据`);
      assert.equal(fact?.input, monthBranch, `${monthBranch}月${name}输入`);
      assert.equal(fact?.targetType, '地支', `${monthBranch}月${name}目标类型`);
    }
    for (const deferredName of [
      '地解',
      '大德',
      '天贼',
      '相负',
      '枉屈',
      '瓦煞',
      '门煞',
      '关神',
      '月鬼',
      '伏殃',
      '天耳',
      '丧魂',
      '丧车',
      '魄化',
      '飞魂',
      '玉字',
      '金堂',
      '天医',
      '地医',
      '白浪',
      '覆舟',
      '飞横',
      '游祸',
      '天盗',
      '天狱',
      '小煞',
      '豹尾',
      '天机',
      '地狱',
      '市曹',
      '绳索',
      '索煞',
      '盗神',
      '凤辇',
      '銮舆',
      '喝散',
      '雨煞',
      '天咒',
      '天猴',
      '大煞',
      '进爵',
      '刑亡',
      '天火',
      '血腥',
      '狱神',
      '天师',
      '大祸',
    ]) {
      assert.equal(facts.has(deferredName), false, `${deferredName}暂缓或异名不应重复登记`);
    }
  }

  const boundaryFacts = new Map(
    generateLiuren(new Date('2026-02-19T12:00:00+08:00')).shenShaFacts?.map((item) => [
      item.name,
      item,
    ]),
  );
  assert.match(boundaryFacts.get('天合')?.limitations.join('；') ?? '', /不补造目标/);
  assert.match(boundaryFacts.get('信神')?.limitations.join('；') ?? '', /信煞.+不合并/);
  assert.match(boundaryFacts.get('游神')?.limitations.join('；') ?? '', /秋戌冬亥/);
  assert.match(boundaryFacts.get('游神')?.limitations.join('；') ?? '', /不因单项出现自动判断行人/);
  assert.match(boundaryFacts.get('戏神')?.limitations.join('；') ?? '', /不因单项出现自动判断/);
  assert.match(boundaryFacts.get('黄幡')?.sources.join('；') ?? '', /黄幡戌未辰丑/);
  assert.match(boundaryFacts.get('黄幡')?.limitations.join('；') ?? '', /太岁三合局墓支.+逐月层/);
  assert.match(boundaryFacts.get('黄幡')?.limitations.join('；') ?? '', /不因单项出现自动判断昏暗/);
  assert.match(boundaryFacts.get('阴煞')?.rule ?? '', /正月从巳起逐月逆行一支/);
  assert.match(boundaryFacts.get('阴煞')?.sources.join('；') ?? '', /游祸巳逆十二.+阴煞/);
  assert.match(boundaryFacts.get('阴煞')?.sources.join('；') ?? '', /巳为正月之阴煞/);
  assert.match(boundaryFacts.get('阴煞')?.limitations.join('；') ?? '', /阴煞寅亥申巳三轮.+异文/);
  assert.match(
    boundaryFacts.get('阴煞')?.limitations.join('；') ?? '',
    /电子转录月表把辰错移至十二月/,
  );
  assert.match(
    boundaryFacts.get('阴煞')?.limitations.join('；') ?? '',
    /易冒.+六爻体系.+不跨术式合并/,
  );
  assert.match(boundaryFacts.get('阴煞')?.limitations.join('；') ?? '', /不因单项出现自动判断阴谋/);
  assert.match(boundaryFacts.get('忧神')?.rule ?? '', /春丑、夏子、秋戌、冬亥/);
  assert.match(
    boundaryFacts.get('忧神')?.sources.join('；') ?? '',
    /六壬大全.+忧神春丑.+六壬秘本.+忧神，春丑夏子秋戌冬亥/,
  );
  assert.match(
    boundaryFacts.get('忧神')?.limitations.join('；') ?? '',
    /忧神辰戌丑未三轮.+歌诀.+神煞辨讹.+梦神.+标签错置.+不视作忧神异表/,
  );
  assert.match(
    boundaryFacts.get('忧神')?.limitations.join('；') ?? '',
    /六壬管辂神书.+六壬银河櫂.+组合断语或地支类象.+不因单项出现自动判断忧愁、哭泣、疾病、欺骗/,
  );
  assert.match(boundaryFacts.get('天解')?.limitations.join('；') ?? '', /申、戌、子.+不合并两表/);
  assert.match(boundaryFacts.get('解神')?.limitations.join('；') ?? '', /题作“地解”.+不另生成地解/);
  assert.match(boundaryFacts.get('飞祸')?.limitations.join('；') ?? '', /不因单项出现自动判断灾祸/);
  assert.match(boundaryFacts.get('奸神')?.limitations.join('；') ?? '', /不因单项出现自动判断奸私/);
  assert.match(boundaryFacts.get('时盗')?.limitations.join('；') ?? '', /不因单项出现自动判断盗窃/);
  assert.match(boundaryFacts.get('归忌')?.limitations.join('；') ?? '', /不因单项出现自动判断归家/);
  assert.match(boundaryFacts.get('飞廉')?.limitations.join('；') ?? '', /正申顺十二.+一致的主表/);
  assert.match(boundaryFacts.get('飞廉')?.limitations.join('；') ?? '', /不因单项出现自动判断行人/);
  assert.match(boundaryFacts.get('往亡')?.sources.join('；') ?? '', /六壬心镜/);
  assert.match(boundaryFacts.get('往亡')?.limitations.join('；') ?? '', /不因单项出现自动判断出行/);
  assert.match(boundaryFacts.get('月刑')?.rule ?? '', /寅巳.+丑戌/);
  assert.match(boundaryFacts.get('月刑')?.limitations.join('；') ?? '', /不因单项出现自动判断产婚/);
  assert.match(boundaryFacts.get('天车')?.limitations.join('；') ?? '', /分属关锁.+不混合两神/);
  assert.match(boundaryFacts.get('天车')?.limitations.join('；') ?? '', /不因单项出现自动判断出行/);
  assert.match(boundaryFacts.get('关锁')?.limitations.join('；') ?? '', /多称“关神”.+与天车分层/);
  assert.match(boundaryFacts.get('关锁')?.limitations.join('；') ?? '', /不因单项出现自动判断囚系/);
  assert.match(boundaryFacts.get('五鬼')?.sources.join('；') ?? '', /六壬存验/);
  assert.match(boundaryFacts.get('五鬼')?.limitations.join('；') ?? '', /“月鬼”.+不重复生成/);
  assert.match(boundaryFacts.get('五鬼')?.limitations.join('；') ?? '', /不因单项出现自动判断盗贼/);
  assert.match(boundaryFacts.get('天鬼')?.limitations.join('；') ?? '', /伏殃.+临年命、日辰或发用/);
  assert.match(
    boundaryFacts.get('天鬼')?.limitations.join('；') ?? '',
    /六壬括囊赋略疏.+卯、子次序不同/,
  );
  assert.match(boundaryFacts.get('天鬼')?.limitations.join('；') ?? '', /不因单项出现自动判断疾病/);
  assert.match(boundaryFacts.get('生气')?.rule ?? '', /正月从子起逐月顺行/);
  assert.match(
    boundaryFacts.get('生气')?.limitations.join('；') ?? '',
    /不因单项出现自动判断事情成就/,
  );
  assert.match(boundaryFacts.get('死气')?.rule ?? '', /正月从午起逐月顺行.+与生气逐月对冲/);
  assert.match(
    boundaryFacts.get('死气')?.limitations.join('；') ?? '',
    /不因单项出现自动判断事情不成/,
  );
  assert.match(
    boundaryFacts.get('死神')?.limitations.join('；') ?? '',
    /逐月死神.+“支死神”分层登记/,
  );
  assert.match(boundaryFacts.get('死神')?.limitations.join('；') ?? '', /不因单项出现自动判断死亡/);
  assert.match(boundaryFacts.get('天喜')?.rule ?? '', /春戌、夏丑、秋辰、冬未/);
  assert.match(boundaryFacts.get('天喜')?.limitations.join('；') ?? '', /天耳.+不重复生成/);
  assert.match(boundaryFacts.get('天喜')?.limitations.join('；') ?? '', /不因单项出现自动判断婚姻/);
  assert.match(boundaryFacts.get('成神')?.rule ?? '', /正月从巳起顺四孟/);
  assert.match(boundaryFacts.get('成神')?.sources.join('；') ?? '', /六壬指南.+六壬大全/);
  assert.match(boundaryFacts.get('成神')?.limitations.join('；') ?? '', /旺相、生合、吉将、课传/);
  assert.match(boundaryFacts.get('浴盆')?.rule ?? '', /春辰、夏未、秋戌、冬丑/);
  assert.match(
    boundaryFacts.get('浴盆')?.limitations.join('；') ?? '',
    /地盘亥子、天后、玄武、白虎/,
  );
  assert.match(boundaryFacts.get('丧魄')?.rule ?? '', /正未逆四季/);
  assert.match(boundaryFacts.get('丧魄')?.limitations.join('；') ?? '', /“丧魂”.+“丧车”.+“丧门”/);
  assert.match(
    boundaryFacts.get('丧魄')?.limitations.join('；') ?? '',
    /临年命、日辰或发用.+不无条件生成课体/,
  );
  assert.match(boundaryFacts.get('丧魄')?.limitations.join('；') ?? '', /“魄化”.+不与丧魄混同/);
  assert.match(boundaryFacts.get('游魂')?.rule ?? '', /正月从亥起逐月顺行/);
  assert.match(
    boundaryFacts.get('游魂')?.limitations.join('；') ?? '',
    /飞魂正亥逆十二.+顺行主版本冲突/,
  );
  assert.match(
    boundaryFacts.get('游魂')?.limitations.join('；') ?? '',
    /“飞魂”.+不重复生成飞魂事实/,
  );
  assert.match(boundaryFacts.get('圣心')?.rule ?? '', /正月亥起.+单月顺行.+双月.+冲位/);
  assert.match(boundaryFacts.get('圣心')?.sources.join('；') ?? '', /六壬指南注解.+六壬大全/);
  assert.match(boundaryFacts.get('圣心')?.limitations.join('；') ?? '', /“巳”被识作“己”/);
  assert.match(boundaryFacts.get('圣心')?.limitations.join('；') ?? '', /不因单项出现自动判断和合/);
  assert.match(boundaryFacts.get('受死')?.sources.join('；') ?? '', /六壬大全.+六壬兵占/);
  assert.match(
    boundaryFacts.get('受死')?.limitations.join('；') ?? '',
    /还须核对日支.+当前日已经命中/,
  );
  assert.match(
    boundaryFacts.get('受死')?.limitations.join('；') ?? '',
    /不因单项出现自动判断一切大凶/,
  );
  assert.match(boundaryFacts.get('罪至')?.sources.join('；') ?? '', /六壬大全.+六壬兵占/);
  assert.match(boundaryFacts.get('罪至')?.limitations.join('；') ?? '', /“辰”被识作“胡”/);
  assert.match(boundaryFacts.get('罪至')?.limitations.join('；') ?? '', /不因单项出现自动判断诉讼/);
  assert.match(boundaryFacts.get('血忌')?.rule ?? '', /正月丑起.+单月顺行.+双月.+冲位/);
  assert.match(boundaryFacts.get('血忌')?.sources.join('；') ?? '', /六壬大全.+六壬心镜/);
  assert.match(
    boundaryFacts.get('血忌')?.limitations.join('；') ?? '',
    /血支是正月丑起逐月顺行十二支.+不把血支作为异名/,
  );
  assert.match(boundaryFacts.get('血忌')?.limitations.join('；') ?? '', /五月占案.+应为血支/);
  assert.match(
    boundaryFacts.get('血忌')?.limitations.join('；') ?? '',
    /胎神、养神、蛇虎、刑煞、日辰、年命/,
  );
  assert.match(boundaryFacts.get('天巫')?.rule ?? '', /正月从辰起逐月顺行/);
  assert.match(boundaryFacts.get('天巫')?.sources.join('；') ?? '', /六壬秘本.+六壬存验/);
  assert.match(boundaryFacts.get('天巫')?.limitations.join('；') ?? '', /不因单项出现自动判断婚姻/);
  assert.match(boundaryFacts.get('游煞')?.rule ?? '', /正月从卯起逐月顺行/);
  assert.match(boundaryFacts.get('游煞')?.sources.join('；') ?? '', /六壬秘本.+六壬指南注解/);
  assert.match(boundaryFacts.get('游煞')?.limitations.join('；') ?? '', /游煞、游神与游魂分层登记/);
  assert.match(
    boundaryFacts.get('游煞')?.limitations.join('；') ?? '',
    /伏吟、刚柔日、旬丁、驿马、进退传/,
  );
  assert.match(boundaryFacts.get('天书')?.rule ?? '', /正月从戌起逐月顺行/);
  assert.match(boundaryFacts.get('天书')?.sources.join('；') ?? '', /六壬大全.+六壬指南注解/);
  assert.match(boundaryFacts.get('天书')?.limitations.join('；') ?? '', /不因单项出现自动判断升迁/);
  assert.match(boundaryFacts.get('天厕')?.rule ?? '', /寅巳申亥三轮/);
  assert.match(boundaryFacts.get('天厕')?.sources.join('；') ?? '', /六壬大全.+六壬指南注解/);
  assert.match(
    boundaryFacts.get('天厕')?.limitations.join('；') ?? '',
    /不因单项出现自动判断现实人物的品行/,
  );
  assert.match(boundaryFacts.get('月害')?.rule ?? '', /正月从巳起逐月逆行/);
  assert.match(boundaryFacts.get('月害')?.sources.join('；') ?? '', /六壬大全.+六壬指南注解/);
  assert.match(
    boundaryFacts.get('月害')?.limitations.join('；') ?? '',
    /不因单项出现自动判断婚姻、医疗/,
  );
  assert.match(boundaryFacts.get('井煞')?.rule ?? '', /正月从未起逐月顺行/);
  assert.match(
    boundaryFacts.get('井煞')?.sources.join('；') ?? '',
    /六壬秘本.+六壬大全.+六壬指南注解/,
  );
  assert.match(boundaryFacts.get('井煞')?.limitations.join('；') ?? '', /白虎、天魁、六害、克日/);
  assert.match(boundaryFacts.get('井煞')?.limitations.join('；') ?? '', /不因单项出现自动判断落井/);
  assert.match(boundaryFacts.get('天坑')?.rule ?? '', /正月从丑起逐月顺行/);
  assert.match(boundaryFacts.get('天坑')?.sources.join('；') ?? '', /六壬大全.+六壬指南注解/);
  assert.match(
    boundaryFacts.get('天坑')?.limitations.join('；') ?? '',
    /不因单项出现自动判断出行损害、交通事故/,
  );
  assert.match(boundaryFacts.get('煞神')?.rule ?? '', /春申、夏亥、秋寅、冬巳/);
  assert.match(boundaryFacts.get('煞神')?.sources.join('；') ?? '', /六壬大全.+六壬指南注解/);
  assert.match(boundaryFacts.get('墓门')?.rule ?? '', /亥申巳寅三轮/);
  assert.match(
    boundaryFacts.get('墓门')?.sources.join('；') ?? '',
    /六壬大全.+六壬指南注解.+六壬秘本/,
  );
  assert.match(
    boundaryFacts.get('墓门')?.limitations.join('；') ?? '',
    /不因单项出现自动判断坟墓异动/,
  );
  assert.match(
    boundaryFacts.get('女灾')?.limitations.join('；') ?? '',
    /不因单项出现生成性别化疾病断语/,
  );
  assert.match(
    boundaryFacts.get('贼神')?.sources.join('；') ?? '',
    /六壬大全.+六壬指南注解.+六壬兵占/,
  );
  assert.match(boundaryFacts.get('贼神')?.limitations.join('；') ?? '', /不因单项出现自动判断盗窃/);
  assert.match(boundaryFacts.get('奸门')?.rule ?? '', /申亥寅巳三轮/);
  assert.match(
    boundaryFacts.get('奸门')?.limitations.join('；') ?? '',
    /不因单项出现判断现实人物奸淫、品行/,
  );
  assert.match(boundaryFacts.get('产煞')?.rule ?? '', /寅巳申亥三轮/);
  assert.match(boundaryFacts.get('产煞')?.limitations.join('；') ?? '', /天后、太阴、勾陈、白虎/);
  assert.match(boundaryFacts.get('血支')?.rule ?? '', /正月从丑起逐月顺行/);
  assert.match(
    boundaryFacts.get('血支')?.sources.join('；') ?? '',
    /六壬大全.+六壬心镜.+六壬秘本.+六壬指南注解/,
  );
  assert.match(boundaryFacts.get('血支')?.limitations.join('；') ?? '', /血支与血忌.+分层登记/);
  assert.match(
    boundaryFacts.get('血支')?.limitations.join('；') ?? '',
    /不因单项出现自动判断血症、胎产、伤亡/,
  );
  assert.match(boundaryFacts.get('邪神')?.rule ?? '', /正月从未起逐月逆行/);
  assert.match(
    boundaryFacts.get('邪神')?.limitations.join('；') ?? '',
    /不因单项出现判断鬼祟、现实人物邪恶/,
  );
  assert.match(boundaryFacts.get('火鬼')?.rule ?? '', /春午、夏酉、秋子、冬卯/);
  assert.match(boundaryFacts.get('火鬼')?.limitations.join('；') ?? '', /螣蛇、朱雀克支、丁神/);
  assert.match(boundaryFacts.get('火怪')?.rule ?? '', /戌未辰丑三轮/);
  assert.match(
    boundaryFacts.get('火怪')?.limitations.join('；') ?? '',
    /不因单项出现自动判断火灾、怪异/,
  );
  assert.match(boundaryFacts.get('雷煞')?.rule ?? '', /正亥逆四孟/);
  assert.match(
    boundaryFacts.get('雷煞')?.limitations.join('；') ?? '',
    /寅亥申巳四轮.+校订正亥逆四孟者是/,
  );
  assert.match(boundaryFacts.get('雷煞')?.limitations.join('；') ?? '', /不因单项出现保证雷电天气/);
  assert.match(boundaryFacts.get('火烛')?.rule ?? '', /正月从巳起逐月顺行/);
  assert.match(boundaryFacts.get('火烛')?.sources.join('；') ?? '', /六壬大全.+六壬指南注解/);
  assert.match(boundaryFacts.get('火烛')?.limitations.join('；') ?? '', /螣蛇、朱雀、克日或克宅/);
  assert.match(boundaryFacts.get('天牢')?.rule ?? '', /正月从丑起逐月顺行/);
  assert.match(boundaryFacts.get('天牢')?.sources.join('；') ?? '', /六壬大全.+六壬心镜.+六壬秘本/);
  assert.match(
    boundaryFacts.get('天牢')?.limitations.join('；') ?? '',
    /正月起丑，逆行十二支.+采用三处一致的顺行表/,
  );
  assert.match(boundaryFacts.get('天牢')?.limitations.join('；') ?? '', /辰又可固定称天牢或天罗/);
  assert.match(
    boundaryFacts.get('天牢')?.limitations.join('；') ?? '',
    /发用、日辰、年命、勾陈、罗网、死气/,
  );
  assert.match(boundaryFacts.get('火神')?.rule ?? '', /春丑、夏子、秋戌、冬亥/);
  assert.match(boundaryFacts.get('火神')?.sources.join('；') ?? '', /六壬大全.+六壬秘本/);
  assert.match(
    boundaryFacts.get('火神')?.limitations.join('；') ?? '',
    /五行属火的支神、螣蛇或朱雀.+不合并这些同名泛称/,
  );
  assert.match(
    boundaryFacts.get('火神')?.limitations.join('；') ?? '',
    /丁神作鬼、月鬼、生气、克干/,
  );
  assert.match(boundaryFacts.get('长绳')?.rule ?? '', /正酉逆四仲/);
  assert.match(boundaryFacts.get('长绳')?.sources.join('；') ?? '', /六壬心镜.+六壬秘本.+六壬大全/);
  assert.match(
    boundaryFacts.get('长绳')?.limitations.join('；') ?? '',
    /悬索（索煞）起点不同.+不合并为“绳索”/,
  );
  assert.match(boundaryFacts.get('长绳')?.limitations.join('；') ?? '', /末传、发用、盗神、玄武/);
  assert.match(boundaryFacts.get('皇恩')?.rule ?? '', /正月从未起顺行六阴支/);
  assert.match(boundaryFacts.get('皇恩')?.sources.join('；') ?? '', /六壬大全.+六壬存验.+六壬粹言/);
  assert.match(
    boundaryFacts.get('皇恩')?.limitations.join('；') ?? '',
    /六十二朋丑.+另两处完整表均作巳.+采用巳/,
  );
  assert.match(
    boundaryFacts.get('皇恩')?.limitations.join('；') ?? '',
    /六壬秘本.+主表冲突.+不合并或择项拼表/,
  );
  assert.match(
    boundaryFacts.get('皇恩')?.limitations.join('；') ?? '',
    /不因单项出现自动判断赦免、脱罪、升迁、封赠/,
  );
  assert.match(boundaryFacts.get('月破')?.rule ?? '', /取月建对冲支.+正月申、二月酉/);
  assert.match(
    boundaryFacts.get('月破')?.sources.join('；') ?? '',
    /六壬神课金口诀古本.+六壬管辂神书.+六壬粹言/,
  );
  assert.match(
    boundaryFacts.get('月破')?.limitations.join('；') ?? '',
    /岁破、日破、时破分层.+不互相替代/,
  );
  assert.match(
    boundaryFacts.get('月破')?.limitations.join('；') ?? '',
    /“支破”.+属于日支破法.+不并入月破/,
  );
  assert.match(
    boundaryFacts.get('月破')?.limitations.join('；') ?? '',
    /不因单项出现自动判断破坏、离散、疾病、诉讼、财物/,
  );
  assert.match(boundaryFacts.get('悬索')?.rule ?? '', /卯子酉午三轮/);
  assert.match(
    boundaryFacts.get('悬索')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬存验.+六壬粹言.+六壬心镜.+六壬秘本/,
  );
  assert.match(
    boundaryFacts.get('悬索')?.limitations.join('；') ?? '',
    /题作“索煞”.+不另重复生成索煞/,
  );
  assert.match(
    boundaryFacts.get('悬索')?.limitations.join('；') ?? '',
    /盗神、玄武、白虎、日鬼、死神、日辰年命/,
  );
  assert.match(boundaryFacts.get('皇书')?.rule ?? '', /春寅、夏巳、秋申、冬亥/);
  assert.match(
    boundaryFacts.get('皇书')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬心镜.+六壬存验.+六壬秘本/,
  );
  assert.match(
    boundaryFacts.get('皇书')?.limitations.join('；') ?? '',
    /皇诏即皇书.+不与.+天诏混同/,
  );
  assert.match(
    boundaryFacts.get('战雄')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬兵占/,
  );
  assert.match(
    boundaryFacts.get('战雄')?.limitations.join('；') ?? '',
    /临日干或支辰.+不因单项出现自动判断军事行动/,
  );
  assert.match(
    boundaryFacts.get('吏神')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬秘本/,
  );
  assert.match(
    boundaryFacts.get('吏神')?.limitations.join('；') ?? '',
    /正七月亥.+采用.+一致的四时表/,
  );
  assert.match(boundaryFacts.get('月符')?.rule ?? '', /春辰、夏未、秋戌、冬丑/);
  assert.match(
    boundaryFacts.get('月符')?.sources.join('；') ?? '',
    /六壬大全.+六壬翠雨歌.+六壬银河櫂/,
  );
  assert.match(boundaryFacts.get('月符')?.limitations.join('；') ?? '', /移居、起造或阴晴.+只登记/);
  assert.match(boundaryFacts.get('钥神')?.sources.join('；') ?? '', /六壬心镜.+六壬大全/);
  assert.match(
    boundaryFacts.get('钥神')?.limitations.join('；') ?? '',
    /巳申寅亥.+秋亥冬寅次序冲突.+不合并两表/,
  );
  assert.match(boundaryFacts.get('钥神')?.limitations.join('；') ?? '', /空亡及刑冲破害/);
  assert.match(
    boundaryFacts.get('三丘')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬神课金口诀古本/,
  );
  assert.match(
    boundaryFacts.get('三丘')?.limitations.join('；') ?? '',
    /春亥、夏子、秋寅、冬酉.+三书一致的主表/,
  );
  assert.match(boundaryFacts.get('寡宿')?.rule ?? '', /春丑、夏辰、秋未、冬戌/);
  assert.match(
    boundaryFacts.get('寡宿')?.limitations.join('；') ?? '',
    /旬空天盘、四时孤寡.+不无条件生成旬空或课体事实/,
  );
  assert.match(boundaryFacts.get('风伯')?.rule ?? '', /正月从申起逐月逆行/);
  assert.match(
    boundaryFacts.get('风伯')?.sources.join('；') ?? '',
    /六壬大全.+六壬兵占.+六壬粹言.+六壬存验.+六壬指南注解/,
  );
  assert.match(
    boundaryFacts.get('风伯')?.limitations.join('；') ?? '',
    /未固定称风伯.+不合并固定类象/,
  );
  assert.match(
    boundaryFacts.get('风伯')?.limitations.join('；') ?? '',
    /固定未位、正申逆十二及借风煞起风伯三说.+采用.+逐月表/,
  );
  assert.match(boundaryFacts.get('风煞')?.rule ?? '', /正月从寅起逐月逆行/);
  assert.match(
    boundaryFacts.get('风煞')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬兵占.+六壬存验.+六壬一字诀玉连环.+七月占例明确以申为风煞.+壬占汇选.+五月天时占例明确以戌为风煞/,
  );
  assert.match(
    boundaryFacts.get('风煞')?.limitations.join('；') ?? '',
    /六壬大全.+六壬秘本.+正申逆十二.+五月戌、七月申位置占例.+正寅逆十二.+不混合正申异表/,
  );
  assert.match(
    boundaryFacts.get('风煞')?.limitations.join('；') ?? '',
    /六壬存验.+四月占语写“巳为风杀”.+四月亥完整表.+内部异文/,
  );
  assert.match(
    boundaryFacts.get('风煞')?.limitations.join('；') ?? '',
    /风伯、白虎、朱雀、日辰、发用、旬空、旺衰及课传.+不因单项出现自动保证起风/,
  );
  assert.match(boundaryFacts.get('战雌')?.rule ?? '', /春申、夏亥、秋寅、冬巳.+战雄.+对冲/);
  assert.match(
    boundaryFacts.get('战雌')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬兵占/,
  );
  assert.match(
    boundaryFacts.get('战雌')?.limitations.join('；') ?? '',
    /临日干、支辰、课传及主客位置.+不因单项出现自动判断军事行动/,
  );
  assert.match(boundaryFacts.get('转煞')?.rule ?? '', /春卯、夏午、秋酉、冬子.+顺行四仲/);
  assert.match(
    boundaryFacts.get('转煞')?.sources.join('；') ?? '',
    /六壬指南注解.+壬占汇选.+六壬断案.+御定六壬直指/,
  );
  assert.match(
    boundaryFacts.get('转煞')?.limitations.join('；') ?? '',
    /顺十二者非.+不扩成逐月顺十二/,
  );
  assert.match(
    boundaryFacts.get('转煞')?.limitations.join('；') ?? '',
    /天地转杀.+天转、地转另须完整天干地支组合.+不合并或缩减/,
  );
  assert.match(
    boundaryFacts.get('转煞')?.limitations.join('；') ?? '',
    /太岁、本命、宅、日干、课传、天将、旺衰及空亡.+不因单项出现自动判断出行/,
  );
  assert.match(boundaryFacts.get('四废')?.rule ?? '', /春酉、夏子、秋卯、冬午.+顺行四仲/);
  assert.match(
    boundaryFacts.get('四废')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬心镜.+六壬秘本/,
  );
  assert.match(
    boundaryFacts.get('四废')?.limitations.join('；') ?? '',
    /正申顺十二者非.+不混入正申顺十二异表/,
  );
  assert.match(
    boundaryFacts.get('四废')?.limitations.join('；') ?? '',
    /春庚辛、夏壬癸、秋甲乙、冬丙丁.+不把天干表或完整四废日缩减、合并/,
  );
  assert.match(
    boundaryFacts.get('四废')?.limitations.join('；') ?? '',
    /四时冲破、天刑或丧车.+四废、门神、丧车、天刑并列.+不据同值表补造其他名称/,
  );
  assert.match(boundaryFacts.get('死别')?.rule ?? '', /春戌、夏未、秋辰、冬丑.+春戌逆行四季/);
  assert.match(
    boundaryFacts.get('死别')?.sources.join('；') ?? '',
    /六壬指南注解.+壬归.+八月丁巳日.+末传辰/,
  );
  assert.match(
    boundaryFacts.get('死别')?.limitations.join('；') ?? '',
    /六壬大全.+生分死别.+六壬秘本.+六壬管辂神书.+普通断语或组合结果.+不作为死别神煞起法/,
  );
  assert.match(
    boundaryFacts.get('死别')?.limitations.join('；') ?? '',
    /类神三传、月建、天将、旺衰、墓绝及其他神煞.+只登记死别所在支/,
  );
  assert.match(
    boundaryFacts.get('死别')?.limitations.join('；') ?? '',
    /不因单项出现自动判断分离、婚姻、亲属、疾病、死亡或其他现实结果/,
  );
  assert.match(boundaryFacts.get('迷惑')?.rule ?? '', /正丑逆四季/);
  assert.match(
    boundaryFacts.get('迷惑')?.limitations.join('；') ?? '',
    /正月戌逆十二.+正丑逆四季者是、逆十二者非.+不混合两表/,
  );
  assert.match(boundaryFacts.get('枯骨')?.rule ?? '', /正月从未起逐月顺行/);
  assert.match(
    boundaryFacts.get('枯骨')?.limitations.join('；') ?? '',
    /正未顺十二者是.+正申、正辰两说俱非.+不混合异表/,
  );
  assert.match(boundaryFacts.get('上丧')?.rule ?? '', /辰未戌丑三轮/);
  assert.match(
    boundaryFacts.get('上丧')?.limitations.join('；') ?? '',
    /“上人服”.+与下丧、丧门.+分层/,
  );
  assert.match(boundaryFacts.get('下丧')?.rule ?? '', /未辰丑戌三轮/);
  assert.match(boundaryFacts.get('下丧')?.sources.join('；') ?? '', /六壬大全.+六壬指南注解/);
  assert.match(
    boundaryFacts.get('下丧')?.limitations.join('；') ?? '',
    /“下人服”.+与上丧、丧魄、丧门.+分层.+不因单项出现自动判断晚辈/,
  );
  assert.match(boundaryFacts.get('哭神')?.rule ?? '', /春未、夏戌、秋丑、冬辰/);
  assert.match(
    boundaryFacts.get('哭神')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+六壬粹言.+六壬秘本/,
  );
  assert.match(
    boundaryFacts.get('哭神')?.limitations.join('；') ?? '',
    /五墓与哭神同表.+不另重复生成/,
  );
  assert.match(
    boundaryFacts.get('哭神')?.limitations.join('；') ?? '',
    /加亥子.+白虎、死气、日辰年命/,
  );
  assert.match(boundaryFacts.get('病煞')?.rule ?? '', /正月从亥起逐月顺行/);
  assert.match(
    boundaryFacts.get('病煞')?.limitations.join('；') ?? '',
    /支病符.+长生十二宫.+不同规则.+分层登记/,
  );
  assert.match(boundaryFacts.get('阳煞')?.rule ?? '', /正亥顺四孟/);
  assert.match(
    boundaryFacts.get('阳煞')?.limitations.join('；') ?? '',
    /不因原典单项释义自动判断男性口舌/,
  );
  assert.match(boundaryFacts.get('天鸡')?.rule ?? '', /正月从酉起逐月逆行/);
  assert.match(
    boundaryFacts.get('天鸡')?.limitations.join('；') ?? '',
    /朱雀、信神、二马、课传、旺衰及空陷/,
  );
  assert.match(boundaryFacts.get('月厌')?.rule ?? '', /正月从戌起逐月逆行/);
  assert.match(
    boundaryFacts.get('月厌')?.sources.join('；') ?? '',
    /六壬心镜.+六壬大全.+六壬秘本.+六壬神课金口诀古本/,
  );
  assert.match(
    boundaryFacts.get('月厌')?.limitations.join('；') ?? '',
    /螣蛇、白虎、朱雀、勾陈、玄武、丁符/,
  );
  assert.match(boundaryFacts.get('谩语')?.rule ?? '', /正月从午起逐月顺行/);
  assert.match(
    boundaryFacts.get('谩语')?.sources.join('；') ?? '',
    /六壬大全.+六壬秘本.+六壬指南注解/,
  );
  assert.match(
    boundaryFacts.get('谩语')?.limitations.join('；') ?? '',
    /天空、太阴、朱雀、刑害、空亡及课传.+不因单项出现自动判断现实人物撒谎/,
  );
  assert.match(boundaryFacts.get('信煞')?.rule ?? '', /正月从酉起逐月顺行/);
  assert.match(
    boundaryFacts.get('信煞')?.sources.join('；') ?? '',
    /六壬大全.+六壬粹言.+六壬管辂神书/,
  );
  assert.match(
    boundaryFacts.get('信煞')?.limitations.join('；') ?? '',
    /酉顺十二表称为“信神”.+另有申、戌、寅.+主名“信煞”.+与现有信神分层/,
  );
  assert.match(
    boundaryFacts.get('信煞')?.limitations.join('；') ?? '',
    /朱雀、天鸡、二马、课传、旺衰、刑冲破害及空亡.+不因单项出现自动判断来信/,
  );
  assert.match(boundaryFacts.get('天鼠')?.rule ?? '', /正月从子起逐月逆行/);
  assert.match(boundaryFacts.get('天鼠')?.sources.join('；') ?? '', /六壬秘本.+六壬指南注解.+壬归/);
  assert.match(
    boundaryFacts.get('天鼠')?.limitations.join('；') ?? '',
    /天鼠即小耗.+岁煞小耗另依太岁定位.+不生成或合并岁煞小耗/,
  );
  assert.match(
    boundaryFacts.get('天鼠')?.limitations.join('；') ?? '',
    /临支、月厌、螣蛇、白虎、空亡.+不因单项出现自动判断鼠患/,
  );
  assert.match(boundaryFacts.get('天牛')?.rule ?? '', /正月从丑起逐月顺行/);
  assert.match(
    boundaryFacts.get('天牛')?.sources.join('；') ?? '',
    /六壬指南注解.+壬占汇选.+正月丑为天牛煞.+六壬秘本/,
  );
  assert.match(
    boundaryFacts.get('天牛')?.limitations.join('；') ?? '',
    /牛驯顺.+进而顺转.+逆行者非.+正丑顺十二.+不混入逆行异说/,
  );
  assert.match(
    boundaryFacts.get('天牛')?.limitations.join('；') ?? '',
    /断易天机.+易冒.+六爻月煞体系.+不合并跨术式同名表/,
  );
  assert.match(
    boundaryFacts.get('天牛')?.limitations.join('；') ?? '',
    /“丑为牛”.+地支类象.+不能据任何丑位补造逐月天牛/,
  );
  assert.match(
    boundaryFacts.get('天牛')?.limitations.join('；') ?? '',
    /朱雀、六害、天马、旺衰及课传.+不因单项出现自动判断牲畜/,
  );
  assert.match(
    boundaryFacts.get('大时')?.sources.join('；') ?? '',
    /六壬大全.+六壬兵占.+六壬指南注解.+太白阴经.+左行四仲/,
  );
  assert.match(
    boundaryFacts.get('大时')?.limitations.join('；') ?? '',
    /六壬心镜.+正月卯顺行十二.+四书共同支持.+正卯逆四仲主表.+不混合该异文/,
  );
  assert.match(
    boundaryFacts.get('大时')?.limitations.join('；') ?? '',
    /咸池、悬索同值.+不代表三者可以合并.+九丑.+特定日柱.+大吉临干支.+不因大时出现自动生成九丑课/,
  );
  assert.match(
    boundaryFacts.get('梦神')?.rule ?? '',
    /正月辰、二月戌、三月丑、四月未.+辰戌丑未三轮/,
  );
  assert.match(
    boundaryFacts.get('梦神')?.sources.join('；') ?? '',
    /六壬指南注解.+正五九兮三合轮.+壬占汇选.+五月乙卯日.+天罡，为梦神.+五月梦神在辰/,
  );
  assert.match(
    boundaryFacts.get('梦神')?.limitations.join('；') ?? '',
    /神煞辨讹.+辰戌丑未三轮者是.+正丑顺十二者不用.+三轮主表.+不混合该异说/,
  );
  assert.match(
    boundaryFacts.get('梦神')?.limitations.join('；') ?? '',
    /梦神告知.+普通叙事.+行逢鬼祟梦神惊.+未提供另一套起法.+天医、行年阴神、课传与天将.+不因单项出现自动判断梦境、预兆、鬼神、疾病、吉凶/,
  );
  assert.match(
    boundaryFacts.get('小时')?.rule ?? '',
    /小时即月建.+寅、卯、辰、巳、午、未、申、酉、戌、亥、子、丑/,
  );
  assert.match(
    boundaryFacts.get('小时')?.sources.join('；') ?? '',
    /六壬大全.+六壬兵占.+六壬粹言.+抬士即月建.+六壬灵觉经.+二月乙卯日.+在小时杀上/,
  );
  assert.match(
    boundaryFacts.get('小时')?.limitations.join('；') ?? '',
    /六壬心镜.+正月起卯逆行四仲.+大时写作正月卯顺十二.+二月卯位占例直接冲突.+小时即月建.+不据该异文改取四仲表/,
  );
  assert.match(
    boundaryFacts.get('小时')?.limitations.join('；') ?? '',
    /称小时为抬士.+不另生成抬士异名事实/,
  );
  assert.match(
    boundaryFacts.get('小时')?.limitations.join('；') ?? '',
    /是否临干支、入课传.+螣蛇、白虎.+不因单项出现自动判断阻滞、惊恐、出行、军事、疾病、死亡/,
  );
  assert.match(
    boundaryFacts.get('天目')?.rule ?? '',
    /春辰、夏未、秋戌、冬丑.+春乙、夏丁、秋辛、冬癸.+十干寄宫.+辰、未、戌、丑/,
  );
  assert.match(
    boundaryFacts.get('天目')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+四月未、十月丑.+六壬心镜.+六壬兵占.+壬占汇选.+三月庚申日.+五月甲寅日.+九月癸亥日.+六壬断案.+秋以戌为天目/,
  );
  assert.match(
    boundaryFacts.get('天目')?.limitations.join('；') ?? '',
    /乙、丁、辛、癸.+十干寄宫.+实际地支位置.+不另生成一套天干目标/,
  );
  assert.match(
    boundaryFacts.get('天目')?.limitations.join('；') ?? '',
    /丑未、卯酉.+天目、天耳或地目.+军事探听或方位层.+不覆盖逐月天目/,
  );
  assert.match(
    boundaryFacts.get('天目')?.limitations.join('；') ?? '',
    /左天目、右天目类象.+不把地支类象重复生成/,
  );
  assert.match(
    boundaryFacts.get('天目')?.limitations.join('；') ?? '',
    /临干支年命、入课传.+墓神、丁神、月厌、螣蛇、白虎.+不因单项出现自动判断鬼祟、伏尸、盗贼、家宅、疾病、死亡/,
  );
  assert.match(boundaryFacts.get('雌虎')?.rule ?? '', /正月从辰起逐月顺行/);
  assert.match(
    boundaryFacts.get('雌虎')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬大全.+十二月逐项分列.+二虎释.+雌虎煞亦然/,
  );
  assert.match(
    boundaryFacts.get('雌虎')?.limitations.join('；') ?? '',
    /雌虎地医酉逆十二.+十二月分列.+二虎释.+正辰顺十二主表.+不混合卷首异文/,
  );
  assert.match(
    boundaryFacts.get('雌虎')?.limitations.join('；') ?? '',
    /雌虎与白虎相并.+行年、日辰、羊刃及旺衰.+不因单项出现自动判断虎狼、刀伤、疾病、死亡/,
  );
  assert.match(
    boundaryFacts.get('灭门')?.rule ?? '',
    /阳月取月建后三辰.+阴月取月建前三辰.+亥午丑申卯戌巳子未寅酉辰/,
  );
  assert.match(
    boundaryFacts.get('灭门')?.sources.join('；') ?? '',
    /六壬神课金口诀古本.+六壬大全.+三才赋/,
  );
  assert.match(
    boundaryFacts.get('灭门')?.limitations.join('；') ?? '',
    /“前二辰”.+逐项分列.+“前三位”.+不采用前二辰/,
  );
  assert.match(
    boundaryFacts.get('灭门')?.limitations.join('；') ?? '',
    /大祸正戌逆十二.+只登记证据闭合的灭门.+不因单项出现自动判断伤亡/,
  );

  const tianSheCases = [
    ['2020-02-05T12:00:00+08:00', '寅', '戊寅', '寅'],
    ['2020-06-20T12:00:00+08:00', '午', '甲午', '午'],
    ['2020-09-02T12:00:00+08:00', '申', '戊申', '申'],
    ['2020-01-22T12:00:00+08:00', '丑', '甲子', '子'],
  ];
  for (const [date, monthBranch, dayGanzhi, target] of tianSheCases) {
    const result = generateLiuren(new Date(date));
    const tianShe = result.shenShaFacts?.find((item) => item.name === '天赦');
    assert.equal(result.ganzhi.month.charAt(1), monthBranch, date);
    assert.equal(result.ganzhi.day, dayGanzhi, date);
    assert.deepEqual(
      [tianShe?.target, tianShe?.category, tianShe?.basis, tianShe?.input, tianShe?.targetType],
      [target, '四时神煞', '月建与日柱', `${monthBranch}月${dayGanzhi}日`, '地支'],
      `${date}天赦须按季节与完整日柱成立`,
    );
    assert.match(tianShe?.limitations.join('；') ?? '', /完整日柱.+均不足以成立/);
    assert.match(tianShe?.limitations.join('；') ?? '', /不因单项出现自动判断刑禁/);
  }
  const sameBranchWrongStem = generateLiuren(new Date('2020-02-17T12:00:00+08:00'));
  assert.equal(sameBranchWrongStem.ganzhi.month.charAt(1), '寅');
  assert.equal(sameBranchWrongStem.ganzhi.day.charAt(1), '寅');
  assert.notEqual(sameBranchWrongStem.ganzhi.day, '戊寅');
  assert.ok(sameBranchWrongStem.shenShaFacts?.every((item) => item.name !== '天赦'));
  assert.ok(boundaryFacts.has('天赦') === false, '春季甲子日不得套用冬季天赦');

  const tianDiZhuanCases = [
    ['天转', '2018-03-24T12:00:00+08:00', '卯', '乙卯', '卯'],
    ['天转', '2018-05-14T12:00:00+08:00', '巳', '丙午', '午'],
    ['天转', '2018-09-26T12:00:00+08:00', '酉', '辛酉', '酉'],
    ['天转', '2018-01-20T12:00:00+08:00', '丑', '壬子', '子'],
    ['地转', '2018-02-28T12:00:00+08:00', '寅', '辛卯', '卯'],
    ['地转', '2018-05-26T12:00:00+08:00', '巳', '戊午', '午'],
    ['地转', '2018-08-09T12:00:00+08:00', '申', '癸酉', '酉'],
    ['地转', '2018-12-10T12:00:00+08:00', '子', '丙子', '子'],
  ] as const;
  for (const [name, date, monthBranch, dayGanzhi, target] of tianDiZhuanCases) {
    const result = generateLiuren(new Date(date));
    const fact = result.shenShaFacts?.find((item) => item.name === name);
    assert.equal(result.ganzhi.month.charAt(1), monthBranch, date);
    assert.equal(result.ganzhi.day, dayGanzhi, date);
    assert.deepEqual(
      [fact?.target, fact?.category, fact?.basis, fact?.input, fact?.targetType],
      [target, '四时神煞', '月建与日柱', `${monthBranch}月${dayGanzhi}日`, '地支'],
      `${date}${name}须按季节与完整日柱成立`,
    );
    assert.match(
      fact?.sources.join('；') ?? '',
      name === '天转'
        ? /六壬大全.+春乙卯夏丙午秋辛酉冬壬子.+六壬指南注解.+旺连天干/
        : /六壬大全.+春辛卯夏戊午秋癸酉冬丙子.+六壬指南注解.+旺连纳音/,
    );
    assert.match(fact?.limitations.join('；') ?? '', /季节与完整日柱同时符合.+均不足以成立/);
    assert.match(
      fact?.limitations.join('；') ?? '',
      /转煞只按月建固定.+另须完整日柱.+可以同支并存但不得合并或互相替代/,
    );
    assert.match(
      fact?.limitations.join('；') ?? '',
      /不因单项出现自动判断出行、赴任、家宅、疾病、死亡、吉凶/,
    );
  }
  for (const [date, name] of [
    ['2018-01-23T12:00:00+08:00', '天转'],
    ['2018-06-28T12:00:00+08:00', '地转'],
  ] as const) {
    const result = generateLiuren(new Date(date));
    assert.ok(
      result.shenShaFacts?.every((item) => item.name !== name),
      `${result.ganzhi.day}日柱处于错误季节时不得生成${name}`,
    );
  }
  const sameBranchWrongZhuanStem = generateLiuren(new Date('2018-03-12T12:00:00+08:00'));
  assert.equal(sameBranchWrongZhuanStem.ganzhi.month.charAt(1), '卯');
  assert.equal(sameBranchWrongZhuanStem.ganzhi.day, '癸卯');
  assert.ok(
    sameBranchWrongZhuanStem.shenShaFacts?.every(
      (item) => item.name !== '天转' && item.name !== '地转',
    ),
    '春季同为卯支但日干不符时不得生成天转或地转',
  );

  const branchHorse: Record<string, string> = {
    子: '寅',
    丑: '亥',
    寅: '申',
    卯: '巳',
    辰: '寅',
    巳: '亥',
    午: '申',
    未: '巳',
    申: '寅',
    酉: '亥',
    戌: '申',
    亥: '巳',
  };
  const dayVirtue: Record<string, string> = {
    甲: '寅',
    乙: '申',
    丙: '巳',
    丁: '亥',
    戊: '巳',
    己: '寅',
    庚: '申',
    辛: '巳',
    壬: '亥',
    癸: '巳',
  };
  const daySalary: Record<string, string> = {
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
  const dayOfficer: Record<string, string> = {
    甲: '申、酉',
    乙: '申、酉',
    丙: '亥、子',
    丁: '亥、子',
    戊: '寅、卯',
    己: '寅、卯',
    庚: '巳、午',
    辛: '巳、午',
    壬: '辰、戌、丑、未',
    癸: '辰、戌、丑、未',
  };
  const dayStemShenShaTargets: Record<string, readonly string[]> = {
    干奇: ['午', '巳', '辰', '卯', '寅', '丑', '未', '申', '酉', '戌'],
    日解: ['亥', '申', '未', '丑', '酉', '亥', '申', '未', '丑', '酉'],
    日医: ['卯', '亥', '丑', '未', '巳', '卯', '亥', '丑', '未', '巳'],
    福星: ['子', '丑', '子', '子', '未', '未', '丑', '丑', '巳', '巳'],
    飞符: ['巳', '辰', '卯', '寅', '丑', '午', '未', '申', '酉', '戌'],
    羊刃: ['卯', '辰', '午', '未', '午', '未', '酉', '戌', '子', '丑'],
    游都: ['丑', '子', '寅', '巳', '申', '丑', '子', '寅', '巳', '申'],
    日贼: ['辰', '午', '申', '亥', '寅', '辰', '午', '申', '亥', '寅'],
    日盗: ['子', '亥', '卯', '申', '巳', '子', '亥', '卯', '申', '巳'],
    鲁都: ['未', '午', '申', '亥', '寅', '未', '午', '申', '亥', '寅'],
    飞刃: ['酉', '戌', '子', '丑', '子', '丑', '卯', '辰', '午', '未'],
    日合: ['未', '申', '戌', '亥', '丑', '寅', '辰', '巳', '未', '巳'],
    长生: ['亥', '亥', '寅', '寅', '申', '申', '巳', '巳', '申', '申'],
    恩赦: ['寅', '辰', '巳', '未', '巳', '未', '申', '戌', '亥', '丑'],
    贤贵: ['丑', '申', '寅', '寅', '午', '丑', '申', '寅', '寅', '午'],
    文星: ['亥', '亥', '寅', '寅', '午', '午', '巳', '巳', '申', '申'],
    日奸: ['亥', '酉', '辰', '申', '巳', '亥', '酉', '辰', '申', '巳'],
    日淫: ['午', '午', '未', '未', '戌', '戌', '寅', '寅', '巳', '巳'],
  };
  const dayBranchShenShaTargets: Record<string, readonly string[]> = {
    支德: ['巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰'],
    支仪: ['午', '巳', '辰', '卯', '寅', '丑', '未', '申', '酉', '戌', '亥', '子'],
    支破: ['酉', '辰', '亥', '午', '丑', '申', '卯', '戌', '巳', '子', '未', '寅'],
    支破碎: ['巳', '丑', '酉', '巳', '丑', '酉', '巳', '丑', '酉', '巳', '丑', '酉'],
    勾神: ['卯', '戌', '巳', '子', '未', '寅', '酉', '辰', '亥', '午', '丑', '申'],
    绞神: ['酉', '辰', '亥', '午', '丑', '申', '卯', '戌', '巳', '子', '未', '寅'],
    四煞: ['未', '辰', '丑', '戌', '未', '辰', '丑', '戌', '未', '辰', '丑', '戌'],
    支亡: ['亥', '申', '巳', '寅', '亥', '申', '巳', '寅', '亥', '申', '巳', '寅'],
    支死神: ['卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅'],
    支病符: ['亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌'],
    支雷电: ['辰', '辰', '未', '未', '戌', '戌', '丑', '丑', '寅', '寅', '卯', '卯'],
    支雨师: ['申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳', '午', '未'],
    支晴朗: ['午', '未', '申', '酉', '戌', '亥', '子', '丑', '寅', '卯', '辰', '巳'],
    白衣翰林: ['酉', '未', '巳', '卯', '丑', '亥', '酉', '未', '巳', '卯', '丑', '亥'],
  };
  const xunShenShaOffsets = {
    旬仪: 0,
    旬盗神: 1,
    旬丁: 3,
    旬响动: 6,
    旬五亡: 7,
    旬闭口: 9,
  } as const;
  const xunQiByStart: Record<string, string> = {
    子: '丑',
    戌: '丑',
    申: '子',
    午: '子',
    辰: '亥',
    寅: '亥',
  };
  const start = new Date('2026-01-01T12:00:00+08:00').getTime();
  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const result = generateLiuren(new Date(start + dayOffset * 86_400_000));
    const dayStem = result.ganzhi.day.charAt(0);
    const dayBranch = result.ganzhi.day.charAt(1);
    const shenShaFacts = result.shenShaFacts ?? [];
    const facts = new Map(shenShaFacts.map((item) => [item.name, item]));
    const stemResidenceIndex = DIZHI.indexOf(
      getDayStemResidence(dayStem) as (typeof DIZHI)[number],
    );
    const dayBranchIndex = DIZHI.indexOf(dayBranch as (typeof DIZHI)[number]);
    const dayStemIndex = TIANGAN.indexOf(dayStem as (typeof TIANGAN)[number]);
    const xunStartBranchIndex = (dayBranchIndex - dayStemIndex + DIZHI.length) % DIZHI.length;
    const xunStartBranch = DIZHI[xunStartBranchIndex];

    const hasTianHe = facts.has('天合');
    const hasTianShe = facts.has('天赦');
    const hasTianZhuan = facts.has('天转');
    const hasDiZhuan = facts.has('地转');
    assert.equal(
      shenShaFacts.length,
      170 + Number(hasTianHe) + Number(hasTianShe) + Number(hasTianZhuan) + Number(hasDiZhuan),
      `${result.ganzhi.day}应有一百七十项固定神煞及条件性天合、天赦、天转、地转`,
    );
    assert.equal(facts.size, shenShaFacts.length, `${result.ganzhi.day}神煞名称不得重复`);
    assert.deepEqual(
      ['支马', '天罗', '地网', '日德', '日禄'].map((name) => facts.get(name)?.target),
      [
        branchHorse[dayBranch],
        DIZHI[(stemResidenceIndex + 1) % DIZHI.length],
        DIZHI[(dayBranchIndex + 1) % DIZHI.length],
        dayVirtue[dayStem],
        daySalary[dayStem],
      ],
      `${result.ganzhi.day}日支与日干神煞表`,
    );
    assert.deepEqual(
      [facts.get('日官')?.target, facts.get('日官')?.targetType],
      [dayOfficer[dayStem], '地支集合'],
      `${result.ganzhi.day}日官应登记克日干五行的完整地支集合`,
    );
    assert.deepEqual(
      Object.keys(dayStemShenShaTargets).map((name) => facts.get(name)?.target),
      Object.values(dayStemShenShaTargets).map((targets) => targets[dayStemIndex]),
      `${result.ganzhi.day}新增十天干神煞表`,
    );
    assert.ok(
      Object.keys(dayStemShenShaTargets).every((name) => {
        const fact = facts.get(name);
        return (
          fact?.basis === '日干' &&
          fact.input === dayStem &&
          fact.category === '十天干神煞' &&
          fact.targetType === '地支'
        );
      }),
      `${result.ganzhi.day}新增神煞均应按日干定位到实际地支`,
    );
    assert.deepEqual(
      Object.keys(dayBranchShenShaTargets).map((name) => facts.get(name)?.target),
      Object.values(dayBranchShenShaTargets).map((targets) => targets[dayBranchIndex]),
      `${result.ganzhi.day}新增十二地支神煞表`,
    );
    assert.ok(
      Object.keys(dayBranchShenShaTargets).every((name) => {
        const fact = facts.get(name);
        return (
          fact?.basis === '日支' &&
          fact.input === dayBranch &&
          fact.category === '十二地支神煞' &&
          fact.targetType === '地支'
        );
      }),
      `${result.ganzhi.day}新增神煞均应按日支定位到实际地支`,
    );
    assert.deepEqual(
      Object.entries(xunShenShaOffsets).map(([name, offset]) => [name, facts.get(name)?.target]),
      Object.entries(xunShenShaOffsets).map(([name, offset]) => [
        name,
        DIZHI[(xunStartBranchIndex + offset) % DIZHI.length],
      ]),
      `${result.ganzhi.day}六项旬干位置`,
    );
    assert.equal(facts.get('旬奇')?.target, xunQiByStart[xunStartBranch]);
    assert.ok(
      [...Object.keys(xunShenShaOffsets), '旬奇'].every((name) => {
        const fact = facts.get(name);
        return (
          fact?.basis === '日柱' &&
          fact.input === result.ganzhi.day &&
          fact.category === '旬神煞' &&
          fact.targetType === '地支'
        );
      }),
      `${result.ganzhi.day}旬神煞均应按完整日柱定位到实际地支`,
    );
    assert.ok(
      [
        '直符',
        '仪神',
        '天盗',
        '天贼',
        '雨师',
        '雷电',
        '晴朗',
        '稼穑',
        '三奇',
        '六仪',
        '盗神',
        '响动',
        '五亡',
        '闭口',
      ].every((name) => !facts.has(name)),
      `${result.ganzhi.day}不得混入异名或尚未闭合的规则`,
    );
    assert.ok(!result.guaTi.includes('六仪') && !result.guaTi.includes('三奇'));
  }

  const sampleFacts = new Map(
    generateLiuren(new Date('2026-01-01T12:00:00+08:00')).shenShaFacts?.map((item) => [
      item.name,
      item,
    ]),
  );
  assert.ok(sampleFacts.get('飞符')?.limitations.some((item) => item.includes('直符')));
  assert.ok(sampleFacts.get('干奇')?.limitations.some((item) => item.includes('仪神')));
  assert.ok(sampleFacts.get('日盗')?.limitations.some((item) => item.includes('天盗')));
  assert.ok(sampleFacts.get('日贼')?.limitations.some((item) => item.includes('天贼')));
  assert.ok(sampleFacts.get('日解')?.limitations.some((item) => item.includes('表头缺字')));
  assert.ok(sampleFacts.get('日合')?.limitations.some((item) => item.includes('干合')));
  assert.ok(sampleFacts.get('长生')?.limitations.some((item) => item.includes('有顺无逆')));
  assert.ok(sampleFacts.get('支破碎')?.limitations.some((item) => item.includes('金神')));
  assert.ok(sampleFacts.get('支亡')?.limitations.some((item) => item.includes('亡神')));
  assert.ok(sampleFacts.get('绞神')?.limitations.some((item) => item.includes('支破同支')));
  assert.ok(sampleFacts.get('支死神')?.limitations.some((item) => item.includes('逐月死神')));
  assert.ok(sampleFacts.get('支病符')?.limitations.some((item) => item.includes('旧太岁')));
  assert.ok(sampleFacts.get('支雨师')?.limitations.some((item) => item.includes('按月三轮')));
  assert.ok(sampleFacts.get('支雷电')?.limitations.some((item) => item.includes('直接断现实雷电')));
  assert.ok(sampleFacts.get('支晴朗')?.limitations.some((item) => item.includes('直接断现实天气')));
  assert.ok(sampleFacts.get('白衣翰林')?.limitations.some((item) => item.includes('第二底本')));
  assert.match(
    sampleFacts.get('旬仪')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬心镜.+六壬寻源.+六壬大全/,
  );
  assert.match(
    sampleFacts.get('旬奇')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬心镜.+六壬寻源.+六壬粹言/,
  );
  assert.match(
    sampleFacts.get('旬五亡')?.sources.join('；') ?? '',
    /六壬大全.+六壬指南注解.+六壬秘本/,
  );
  assert.match(
    sampleFacts.get('旬丁')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬心镜.+六壬大全.+六壬粹言/,
  );
  assert.match(
    sampleFacts.get('旬闭口')?.sources.join('；') ?? '',
    /六壬指南注解.+六壬粹言.+六壬直指御定/,
  );
  assert.match(
    sampleFacts.get('旬盗神')?.limitations.join('；') ?? '',
    /六壬心镜.+另称“亡神”.+不覆盖月建所起的亡神.+玄武阴神.+不生成普通“盗神”/,
  );
  assert.match(
    sampleFacts.get('旬仪')?.limitations.join('；') ?? '',
    /发用或入传.+六仪课.+只有支仪而无旬仪不能单独称六仪课/,
  );
  assert.match(
    sampleFacts.get('旬奇')?.limitations.join('；') ?? '',
    /发用或入传.+三奇课.+不与现有干奇合并/,
  );
  assert.match(
    sampleFacts.get('旬闭口')?.limitations.join('；') ?? '',
    /旬尾加旬首发用.+旬首乘玄武.+不因旬癸每日存在而自动生成“闭口课”/,
  );
  assert.match(sampleFacts.get('白衣翰林')?.rule ?? '', /每日逆行二支/);
  assert.equal(sampleFacts.get('绞神')?.target, sampleFacts.get('支破')?.target);
  assert.match(sampleFacts.get('鲁都')?.rule ?? '', /游都对冲/);
  assert.match(sampleFacts.get('飞刃')?.rule ?? '', /羊刃对冲/);
});

test('大六壬课注传注只描述盘面关系，不提前生成现实结论或建议', () => {
  const result = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));
  const notes = [
    ...result.fourLessons.map((item) => item.note),
    ...result.threeTransmissions.map((item) => item.note),
  ].join('；');

  assert.match(notes, /五行关系为/);
  assert.doesNotMatch(notes, /推进|转机|发力|阻力|卡点|落地|延后|建议|适合/);
  assert.equal(Object.hasOwn(result, 'dayOfficer'), false);
});

test('大六壬天将应按贵人所临地盘定顺逆，不是简单昼顺夜逆', () => {
  const result = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));

  assert.equal(result.noblemanBranch, '丑');
  assert.equal(getGodByUpper(result.heavenlyPlate, '丑'), '贵人');
  assert.equal(getGodByUpper(result.heavenlyPlate, '寅'), '天后');
  assert.equal(getGodByUpper(result.heavenlyPlate, '子'), '螣蛇');
});

test('大六壬贵人临十二地盘应按亥至辰顺布、巳至戌逆布天将', () => {
  const forwardGroundBranches = ['亥', '子', '丑', '寅', '卯', '辰'];
  const reverseGroundBranches = ['巳', '午', '未', '申', '酉', '戌'];

  for (const ground of forwardGroundBranches) {
    const plate = buildHeavenlyPlate({
      monthLeader: '丑',
      divinationBranch: ground,
      noblemanBranch: '丑',
      dayNight: '昼占',
    });
    assert.equal(getUnderByUpper(plate, '丑'), ground, `贵人应临地盘${ground}`);
    assert.equal(getGodByUpper(plate, '丑'), '贵人', `地盘${ground}顺布贵人`);
    assert.equal(getGodByUpper(plate, '寅'), '螣蛇', `地盘${ground}顺布下一将`);
    assert.equal(getGodByUpper(plate, '子'), '天后', `地盘${ground}顺布前一将`);
  }

  for (const ground of reverseGroundBranches) {
    const plate = buildHeavenlyPlate({
      monthLeader: '丑',
      divinationBranch: ground,
      noblemanBranch: '丑',
      dayNight: '昼占',
    });
    assert.equal(getUnderByUpper(plate, '丑'), ground, `贵人应临地盘${ground}`);
    assert.equal(getGodByUpper(plate, '丑'), '贵人', `地盘${ground}逆布贵人`);
    assert.equal(getGodByUpper(plate, '寅'), '天后', `地盘${ground}逆布下一支`);
    assert.equal(getGodByUpper(plate, '子'), '螣蛇', `地盘${ground}逆布前一支`);
  }
});

test('昼夜贵人落地会跟随日干规则切换', () => {
  const result = generateLiuren(new Date('2026-04-10T22:26:00+08:00'));
  const dayStem = result.ganzhi.day.charAt(0);
  const expected = GUIREN_BRANCH_BY_STEM[dayStem];

  assert.ok(expected, `未覆盖的日干：${dayStem}`);
  const expectedBranch = result.dayNight === '昼占' ? expected.day : expected.night;
  assert.equal(result.noblemanBranch, expectedBranch);
});

test('大六壬伏吟课的传态应尊重伏吟取法，不被初末相冲误标为反吟', () => {
  const result = generateLiuren(new Date('2026-01-01T02:00:00+08:00'));

  assert.equal(result.transmissionRule, '伏吟法');
  assert.equal(result.transmissionPattern, '伏吟');
});

test('大六壬多处贼克时按比用取与日干同阴阳的发用', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('巳', '子', '水克火'),
      createLesson('午', '子', '水克火'),
      createLesson('寅', '亥', '水生木'),
      createLesson('卯', '亥', '水生木'),
    ],
    createResolveContext({ dayStem: '甲' }),
  );

  assert.equal(result.rule, '比用法');
  assert.equal(result.initial, '午');
});

test('大六壬比用发用不得因时柱五行或课体名称擅改为二课上神', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('申', '丙', '火克金'),
      createLesson('亥', '申', '金生水'),
      createLesson('酉', '午', '火克金'),
      createLesson('子', '酉', '金生水'),
    ],
    createResolveContext({
      dayStem: '丙',
      dayBranch: '午',
      dayStemResidence: '巳',
      hourStem: '戊',
      hourBranch: '戌',
    }),
  );

  assert.equal(result.rule, '比用法');
  assert.equal(result.tag, '比用');
  assert.equal(result.initial, '申');
});

test('大六壬重复课只按一处贼克处理，不误入比用或涉害', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('申', '寅', '金克木'),
      createLesson('寅', '申', '金克木'),
      createLesson('申', '寅', '金克木'),
      createLesson('寅', '申', '金克木'),
    ],
    createResolveContext({ dayStem: '甲' }),
  );

  assert.equal(result.rule, '重审法');
  assert.equal(result.initial, '寅');
});

test('大六壬多处贼克且同阴阳候选不唯一时进入涉害法', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('巳', '子', '水克火'),
      createLesson('未', '卯', '木克土'),
      createLesson('亥', '未', '土克水'),
      createLesson('卯', '亥', '水生木'),
    ],
    createResolveContext({ dayStem: '乙' }),
  );

  assert.equal(result.rule, '涉害法');
  assert.ok(['巳', '未', '亥'].includes(result.initial));
});

test('大六壬涉害从所临地盘之后起算，并依深浅、孟仲季取用', () => {
  const cases = [
    {
      day: '丁卯',
      hour: '辛丑',
      monthLeader: '亥',
      expected: ['亥', '酉', '未'],
      source: '《六壬粹言》丁卯日两下贼上例',
    },
    {
      day: '庚子',
      hour: '丁丑',
      monthLeader: '亥',
      expected: ['午', '辰', '寅'],
      source: '《大六壬大全》庚子日涉害例',
    },
    {
      day: '甲午',
      hour: '庚午',
      monthLeader: '申',
      expected: ['辰', '午', '申'],
      source: '《大六壬大全》甲午日复等例',
    },
  ];

  for (const item of cases) {
    const result = buildReferenceLiurenPlate({
      day: item.day,
      hour: item.hour,
      monthLeader: item.monthLeader,
    });

    assert.equal(result.initial.rule, '涉害法', item.source);
    assert.deepEqual(result.branches, item.expected, item.source);
  }
});

test('大六壬涉害依《六壬粹言》古法不另用择比改传', () => {
  const cases = [
    {
      day: '乙卯',
      hour: '戊寅',
      expected: ['亥', '酉', '未'],
    },
    {
      day: '甲辰',
      hour: '戊辰',
      expected: ['子', '申', '辰'],
    },
    {
      day: '庚午',
      hour: '庚辰',
      expected: ['子', '申', '辰'],
    },
  ];

  for (const item of cases) {
    const result = buildReferenceLiurenPlate({
      day: item.day,
      hour: item.hour,
      monthLeader: '子',
    });

    assert.equal(result.initial.rule, '涉害法', item.day);
    assert.deepEqual(result.branches, item.expected, item.day);
  }
});

test('大六壬无上下克时不会把四课比和误判为比用法', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('寅', '卯'),
      createLesson('申', '酉'),
      createLesson('子', '亥'),
      createLesson('卯', '寅'),
    ],
    createResolveContext({ dayStem: '甲' }),
  );

  assert.equal(result.rule, '遥克法');
  assert.equal(result.tag, '蒿矢');
  assert.equal(result.initial, '申');
  assert.equal(result.sourceLessonIndex, 1);
  assert.equal(result.remoteKeDirection, '蒿矢');
});

test('大六壬多候选遥克经比用或涉害后仍应保留真实课序及蒿矢弹射方向', () => {
  const context = createResolveContext({ dayStem: '甲' });
  const haoShi = resolveInitialTransmission(
    [
      createLesson('子', '申'),
      createLesson('申', '辰'),
      createLesson('酉', '丑'),
      createLesson('子', '亥'),
    ],
    context,
  );
  const tanShe = resolveInitialTransmission(
    [
      createLesson('子', '申'),
      createLesson('辰', '巳'),
      createLesson('戌', '午'),
      createLesson('卯', '亥'),
    ],
    context,
  );

  assert.deepEqual(
    {
      initial: haoShi.initial,
      rule: haoShi.rule,
      sourceLessonIndex: haoShi.sourceLessonIndex,
      remoteKeDirection: haoShi.remoteKeDirection,
    },
    {
      initial: '申',
      rule: '遥克比用法',
      sourceLessonIndex: 1,
      remoteKeDirection: '蒿矢',
    },
  );
  assert.deepEqual(
    {
      initial: tanShe.initial,
      rule: tanShe.rule,
      sourceLessonIndex: tanShe.sourceLessonIndex,
      remoteKeDirection: tanShe.remoteKeDirection,
    },
    {
      initial: '辰',
      rule: '遥克涉害法',
      sourceLessonIndex: 1,
      remoteKeDirection: '弹射',
    },
  );
});

test('大六壬多候选遥克方向与真实来源课应进入最终标签和提示词证据', () => {
  const cases = [
    { date: '2026-01-02T09:00:30+08:00', direction: '弹射', sourceIndex: 2, sourceName: '三课' },
    { date: '2026-01-05T23:00:30+08:00', direction: '蒿矢', sourceIndex: 3, sourceName: '四课' },
  ] as const;

  for (const item of cases) {
    const result = generateLiuren(new Date(item.date));
    const evidence = result.evidenceAnalysis!;

    assert.equal(result.transmissionRule, '遥克比用法');
    assert.equal(result.remoteKeDirection, item.direction);
    assert.equal(result.initialSourceLessonIndex, item.sourceIndex);
    assert.ok(result.patternTags.includes(item.direction));
    assert.deepEqual(evidence.initialSourceLessons, [item.sourceName]);
    assert.match(
      evidence.transmissionRuleFact.promptText,
      new RegExp(`遥克方向为${item.direction}`),
    );
    assert.match(
      evidence.transmissionRuleFact.promptText,
      new RegExp(`初传实际取自${item.sourceName}`),
    );
  }
});

test('大六壬遥克只看二三四课，不把一课上神误作遥克发用', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('申', '酉'),
      createLesson('寅', '卯'),
      createLesson('子', '亥'),
      createLesson('卯', '寅'),
    ],
    createResolveContext({ dayStem: '甲' }),
  );

  assert.equal(result.rule, '昴星法');
  assert.notEqual(result.initial, '申');
});

test('大六壬伏吟课按三刑推进三传，不再简单重复同一上神', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('寅', '寅'),
      createLesson('寅', '寅'),
      createLesson('子', '子'),
      createLesson('子', '子'),
    ],
    createResolveContext({
      dayStem: '甲',
      dayBranch: '子',
      dayStemResidence: '寅',
      heavenlyPlate: FUYIN_PLATE,
    }),
  );

  assert.equal(result.rule, '伏吟法');
  assert.deepEqual(result.branches, ['寅', '巳', '申']);
});

test('大六壬六乙伏吟从辰发用并标为杜传，不误归为自信', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('辰', '辰'),
      createLesson('辰', '辰'),
      createLesson('丑', '丑'),
      createLesson('丑', '丑'),
    ],
    createResolveContext({
      dayStem: '乙',
      dayBranch: '丑',
      dayStemResidence: '辰',
      heavenlyPlate: FUYIN_PLATE,
    }),
  );

  assert.equal(result.rule, '伏吟法');
  assert.equal(result.tag, '杜传');
  assert.deepEqual(result.branches, ['辰', '丑', '戌']);
});

test('大六壬六癸伏吟从丑发用并标为伏吟有克，不误归为自信', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('丑', '丑'),
      createLesson('丑', '丑'),
      createLesson('丑', '丑'),
      createLesson('丑', '丑'),
    ],
    createResolveContext({
      dayStem: '癸',
      dayBranch: '丑',
      dayStemResidence: '丑',
      heavenlyPlate: FUYIN_PLATE,
    }),
  );

  assert.equal(result.rule, '伏吟法');
  assert.equal(result.tag, '伏吟有克');
  assert.deepEqual(result.branches, ['丑', '戌', '未']);
});

test('大六壬伏吟普通阴日按自信从支上传发用', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('未', '未'),
      createLesson('未', '未'),
      createLesson('酉', '酉'),
      createLesson('酉', '酉'),
    ],
    createResolveContext({
      dayStem: '丁',
      dayBranch: '酉',
      dayStemResidence: '未',
      heavenlyPlate: FUYIN_PLATE,
    }),
  );

  assert.equal(result.rule, '伏吟法');
  assert.equal(result.tag, '自信');
  assert.deepEqual(result.branches, ['酉', '未', '丑']);
});

test('大六壬返吟无克时以日支驿马发用，并以支上干上成中末传', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('丑', '未'),
      createLesson('未', '丑'),
      createLesson('未', '丑'),
      createLesson('丑', '未'),
    ],
    createResolveContext({
      dayStem: '丁',
      dayBranch: '丑',
      dayStemResidence: '未',
      heavenlyPlate: FANYIN_PLATE,
    }),
  );

  assert.equal(result.rule, '返吟法');
  assert.equal(result.tag, '无亲');
  assert.deepEqual(result.branches, ['亥', '未', '丑']);
});

test('大六壬阴日八专从支阴神逆数三位发用', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('巳', '未', '火生土'),
      createLesson('卯', '巳', '木生火'),
      createLesson('巳', '未', '火生土'),
      createLesson('卯', '巳', '木生火'),
    ],
    createResolveContext({ dayStem: '丁', dayBranch: '未', dayStemResidence: '未' }),
  );

  assert.equal(result.rule, '八专法');
  assert.deepEqual(result.branches, ['丑', '巳', '巳']);
});

test('大六壬癸丑属于八专日，但有课内克时仍先按克法取传', () => {
  const result = buildReferenceLiurenPlate({
    day: '癸丑',
    hour: '癸丑',
    monthLeader: '子',
  });

  assert.equal(result.initial.rule, '重审法');
  assert.equal(result.initial.initial, '子');
});

test('大六壬癸丑无课内克时不取遥克，按八专阴日逆数发用', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('寅', '卯'),
      createLesson('辰', '丑'),
      createLesson('子', '亥'),
      createLesson('卯', '寅'),
    ],
    createResolveContext({
      dayStem: '癸',
      dayBranch: '丑',
      dayStemResidence: '丑',
    }),
  );

  assert.equal(result.rule, '八专法');
  assert.equal(result.tag, '八专');
  assert.deepEqual(result.branches, ['丑', '寅', '寅']);
});

test('大六壬应与传统排盘样本的申将午时天地盘和十二天将一致', () => {
  const result = generateLiuren(new Date('2026-06-03T12:30:00+08:00'));

  assert.equal(result.ganzhi.day, '戊申');
  assert.equal(result.ganzhi.hour, '戊午');
  assert.equal(result.monthLeader, '申');
  assert.equal(result.divinationBranch, '午');
  assert.equal(result.noblemanBranch, '丑');
  assert.equal(result.noblemanGroundBranch, '亥');
  assert.deepEqual(result.xunKong, ['寅', '卯']);
  assert.deepEqual(
    result.heavenlyPlate.map((item) => `${item.under}${item.branch}${item.god}`),
    [
      '子寅螣蛇',
      '丑卯朱雀',
      '寅辰六合',
      '卯巳勾陈',
      '辰午青龙',
      '巳未天空',
      '午申白虎',
      '未酉太常',
      '申戌玄武',
      '酉亥太阴',
      '戌子天后',
      '亥丑贵人',
    ],
  );
  assert.deepEqual(
    result.threeTransmissions.map((item) => `${item.branch}${item.god}`),
    ['子天后', '寅螣蛇', '辰六合'],
  );
});

test('大六壬底层参数非法时应明确报错，不应用默认贵人或首个天盘项兜底', () => {
  assert.equal(getNoblemanBranch('甲', '昼占'), '丑');
  assert.throws(() => getNoblemanBranch('A', '昼占'), /日干必须是有效天干/);
  assert.throws(() => getDayStemResidence('A'), /日干必须是有效天干/);
  assert.throws(
    () =>
      buildHeavenlyPlate({
        monthLeader: 'A',
        divinationBranch: '子',
        noblemanBranch: '丑',
        dayNight: '昼占',
      }),
    /月将必须是有效地支/,
  );

  const plate = buildHeavenlyPlate({
    monthLeader: '亥',
    divinationBranch: '卯',
    noblemanBranch: '亥',
    dayNight: '昼占',
  });
  assert.throws(() => getPlateItemByBranch(plate, 'A'), /天盘地支必须是有效地支/);
  assert.throws(() => getGanZhiWuxing('A'), /无法识别干支/);
});

test('大六壬取传入口应拒绝坏四课和坏天盘，不应静默套用取传规则', () => {
  const context = createResolveContext();
  const validLessons = [
    createLesson('巳', '子', '水克火'),
    createLesson('午', '子', '水克火'),
    createLesson('寅', '亥', '水生木'),
    createLesson('卯', '亥', '水生木'),
  ];

  assert.throws(
    () => resolveInitialTransmission(validLessons.slice(0, 3), context),
    /必须传入完整四课/,
  );
  assert.throws(
    () =>
      resolveInitialTransmission(
        [{ ...validLessons[0], upper: 'A' }, ...validLessons.slice(1)],
        context,
      ),
    /第 1 课上神必须是有效地支/,
  );
  assert.throws(
    () =>
      resolveInitialTransmission(
        [{ ...validLessons[0], lower: 'A' }, ...validLessons.slice(1)],
        context,
      ),
    /第 1 课下位必须是有效天干或地支/,
  );
  assert.throws(
    () => resolveInitialTransmission(validLessons, createResolveContext({ dayStem: 'A' })),
    /日干必须是有效天干/,
  );
  assert.throws(
    () => resolveInitialTransmission(validLessons, createResolveContext({ hourStem: 'A' })),
    /时干必须是有效天干/,
  );
  assert.throws(
    () =>
      resolveInitialTransmission(
        validLessons,
        createResolveContext({ heavenlyPlate: context.heavenlyPlate.slice(0, 11) }),
      ),
    /天盘必须包含完整 12 个地支/,
  );

  const duplicatedPlate = context.heavenlyPlate.map((item) => ({ ...item }));
  duplicatedPlate[0].branch = duplicatedPlate[1].branch;
  assert.throws(
    () =>
      resolveInitialTransmission(
        validLessons,
        createResolveContext({ heavenlyPlate: duplicatedPlate }),
      ),
    /天盘上下地支必须各自完整且不重复/,
  );
});
