import test from 'node:test';
import assert from 'node:assert/strict';

import type { LiurenLesson, LiurenPlateItem } from 'mingyu-core/types';
import { analyzeLiurenEvidence, generateLiuren } from 'mingyu-core/divination/liuren';
import { getVoidBranches } from '../packages/core/src/calendar/lunar.ts';
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

test('大六壬旧资料缺少取传规则名时应保留证据缺口，不按三传反推九宗门', () => {
  const data = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));
  data.transmissionRule = undefined;
  data.transmissionPattern = undefined;
  data.evidenceAnalysis = undefined;

  const evidence = analyzeLiurenEvidence(data);

  assert.equal(evidence.transmissionRuleFact.status, '缺少规则名');
  assert.equal(evidence.transmissionRuleFact.rule, null);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
  assert.equal(evidence.calculationSteps[3]?.status, '资料不足');
  assert.equal(evidence.calculationSteps[6]?.status, '资料不足');
  assert.match(evidence.transmissionRuleFact.promptText, /不得按三传结果反推九宗门名称/);
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

test('大六壬三传六亲均以日干为中心，并与相邻传关系分字段保存', () => {
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
        fourLessons: [{ upper: '卯', lower: '辛' }],
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
      fourLessons: [{ upper: '卯', lower: '壬' }],
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
        item.limitations.some((limitation) => limitation.includes('十三项可复算神煞')),
    ),
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
  const monthCases: Array<
    [string, string, [string, string, string, string, string, string, string, string]]
  > = [
    ['2026-02-19T12:00:00+08:00', '寅', ['申', '亥', '巳', '卯', '酉', '未', '巳', '午']],
    ['2026-03-21T12:00:00+08:00', '卯', ['巳', '申', '寅', '子', '巳', '申', '寅', '申']],
    ['2026-04-21T12:00:00+08:00', '辰', ['寅', '巳', '亥', '酉', '丑', '亥', '亥', '戌']],
    ['2026-05-22T12:00:00+08:00', '巳', ['亥', '寅', '申', '午', '酉', '戌', '申', '子']],
    ['2026-06-22T12:00:00+08:00', '午', ['申', '亥', '巳', '卯', '巳', '亥', '巳', '寅']],
    ['2026-07-24T12:00:00+08:00', '未', ['巳', '申', '寅', '子', '丑', '寅', '寅', '辰']],
    ['2026-08-24T12:00:00+08:00', '申', ['寅', '巳', '亥', '酉', '酉', '丑', '亥', '午']],
    ['2026-09-24T12:00:00+08:00', '酉', ['亥', '寅', '申', '午', '巳', '寅', '申', '申']],
    ['2026-10-24T12:00:00+08:00', '戌', ['申', '亥', '巳', '卯', '丑', '巳', '巳', '戌']],
    ['2026-11-23T12:00:00+08:00', '亥', ['巳', '申', '寅', '子', '酉', '辰', '寅', '子']],
    ['2026-12-23T12:00:00+08:00', '子', ['寅', '巳', '亥', '酉', '巳', '巳', '亥', '寅']],
    ['2027-01-21T12:00:00+08:00', '丑', ['亥', '寅', '申', '午', '丑', '申', '申', '辰']],
  ];
  const monthFactNames = ['驿马', '劫煞', '亡神', '咸池', '破碎', '天德', '月德', '天马'];

  for (const [date, monthBranch, expectedTargets] of monthCases) {
    const result = generateLiuren(new Date(date));
    const facts = new Map(result.shenShaFacts?.map((item) => [item.name, item]));
    assert.equal(result.ganzhi.month.charAt(1), monthBranch, date);
    assert.deepEqual(
      monthFactNames.map((name) => facts.get(name)?.target),
      expectedTargets,
      `${monthBranch}月逐月神煞表`,
    );
    assert.ok(monthFactNames.every((name) => facts.get(name)?.basis === '月建'));
    assert.ok(monthFactNames.every((name) => facts.get(name)?.targetType === '地支'));
    assert.match(facts.get('天德')?.rule ?? '', /天德表取.+(?:依十干寄宫落.)?/);
    assert.match(facts.get('月德')?.rule ?? '', /依十干寄宫落/);
  }

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
  const start = new Date('2026-01-01T12:00:00+08:00').getTime();
  for (let dayOffset = 0; dayOffset < 60; dayOffset += 1) {
    const result = generateLiuren(new Date(start + dayOffset * 86_400_000));
    const dayStem = result.ganzhi.day.charAt(0);
    const dayBranch = result.ganzhi.day.charAt(1);
    const facts = new Map(result.shenShaFacts?.map((item) => [item.name, item]));
    const stemResidenceIndex = DIZHI.indexOf(
      getDayStemResidence(dayStem) as (typeof DIZHI)[number],
    );
    const dayBranchIndex = DIZHI.indexOf(dayBranch as (typeof DIZHI)[number]);

    assert.equal(facts.size, 13, `${result.ganzhi.day}应有十三项已登记神煞`);
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
  }
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
