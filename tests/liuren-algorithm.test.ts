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
import { SANXING_MAP } from '../packages/core/src/ganzhi/relations.ts';
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
import { LIUCHONG_MAP } from '../packages/core/src/divination/algorithms/_shared/wuxing.ts';
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
} from '../packages/core/src/divination/algorithms/liuren/helpers/plate.ts';

const DIZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
const SIXTY_DAYS = Array.from(
  { length: 60 },
  (_, index) => `${TIANGAN[index % 10]}${DIZHI[index % 12]}`,
);
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
        if (branches.join('') === '巳戌卯') expected.push('铸印卦');
        if (branches.join('') === '午卯子') expected.push('高盖乘轩卦');

        const actual = getLiurenTransmissionGuaTi(branches);
        assert.deepEqual(actual, expected, `${branches.join('')}的课体命中边界不一致`);
        actual.forEach((name) => counts.set(name, (counts.get(name) || 0) + 1));
      }
    }
  }

  assert.deepEqual(Object.fromEntries([...counts].sort()), {
    三交卦: 24,
    从革卦: 6,
    曲直卦: 6,
    润下卦: 6,
    炎上卦: 6,
    玄胎卦: 24,
    稼穑卦: 24,
    铸印卦: 1,
    高盖乘轩卦: 1,
  });
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
});

test('大六壬课体登记表应固定十三条来源、稳定键和结构条件', () => {
  assert.equal(REGISTERED_LIUREN_GUA_TI_COUNT, 13);
  const facts = getLiurenGuaTiFacts({ transmissionBranches: ['亥', '卯', '未'] });
  const fact = facts.find((item) => item.name === '曲直卦');

  assert.ok(fact);
  assert.equal(fact.stableKey, 'liuren:verified-guati:qu-zhi');
  assert.deepEqual(fact.branches, ['亥', '卯', '未']);
  assert.deepEqual(fact.matchedConditions, ['三传亥卯未全']);
  assert.match(fact.sourceTitle, /《六壬指南》卷一/);
  assert.match(fact.sourceUrl, /oldid=854504/);
  assert.equal(fact.sourceQuote, '三传亥卯未曰曲直卦。');
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
      sourceOldId: '854575',
      context: { transmissionBranches: ['卯', '辰', '巳'], initialGroundBranch: '申' },
    },
    {
      name: '铸印卦',
      sourceOldId: '854575',
      context: { transmissionBranches: ['巳', '戌', '卯'] },
    },
    {
      name: '高盖乘轩卦',
      sourceOldId: '854504',
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
  const guaTiCounts = new Map<string, number>();
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
              initialGroundBranch: getPlateItemByBranch(heavenlyPlate, branches[0]).under,
              yearBranch,
              monthLeader,
              noblemanBranch: getNoblemanBranch(dayStem, dayNight),
              noblemanGroundBranch: getPlateItemByBranch(
                heavenlyPlate,
                getNoblemanBranch(dayStem, dayNight),
              ).under,
              fourLessons: lessons,
            });
            for (const fact of guaTiFacts) {
              guaTiCounts.set(fact.name, (guaTiCounts.get(fact.name) || 0) + 1);
            }
          }

          assert.equal(getUpperByUnder(heavenlyPlate, hourBranch), monthLeader, label);
          assert.equal(new Set(heavenlyPlate.map((item) => item.under)).size, 12, label);
          assert.equal(new Set(heavenlyPlate.map((item) => item.branch)).size, 12, label);
          assert.equal(new Set(heavenlyPlate.map((item) => item.god)).size, 12, label);
          assert.equal(lessons.length, 4, label);
          assert.equal(branches.length, 3, label);
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
  assert.equal(
    guaTiCounts.size,
    REGISTERED_LIUREN_GUA_TI_COUNT,
    `全部登记课体都应能由合法月将、占时、日柱、昼夜和太岁组合命中，实际为${JSON.stringify(
      Object.fromEntries([...guaTiCounts].sort()),
    )}`,
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
        item.limitations.some((limitation) => limitation.includes('一百六十六项可复算神煞规则')),
    ),
  );
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
      166 + Number(hasTianHe) + Number(hasTianShe) + Number(hasTianZhuan) + Number(hasDiZhuan),
      `${result.ganzhi.day}应有一百六十六项固定神煞及条件性天合、天赦、天转、地转`,
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
