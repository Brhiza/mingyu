import test from 'node:test';
import assert from 'node:assert/strict';

import type { LiurenLesson, LiurenPlateItem } from 'mingyu-core/types';
import { calculateSolarTermEvidence, TimeManager } from 'mingyu-core/calendar';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren';
import { buildTimeInfoText } from 'mingyu-core/prompt';
import { buildDivinationPrompt } from '../packages/core/src/prompt/divination';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import { formatLiurenGuaTiWithTransmissions } from '../packages/core/src/prompt/liuren-facts';
import {
  getLiurenGuaTiFacts,
  getLiurenTransmissionGuaTi,
  getTransmissionPattern,
  REGISTERED_LIUREN_GUA_TI_COUNT,
} from '../packages/core/src/divination/algorithms/liuren/helpers/transmission.ts';
import { LIUCHONG_MAP } from '../packages/core/src/divination/algorithms/_shared/wuxing.ts';
import {
  buildFourLessons,
  resolveInitialTransmission,
} from '../packages/core/src/divination/algorithms/liuren/helpers/lessons.ts';
import { resolveLiurenClassicalRules } from '../packages/core/src/divination/algorithms/liuren/helpers/classical-rules.ts';
import { getLiurenTransmissionClassic } from '../packages/core/src/classics/liuren-rules.ts';
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

const liuren20260410At0826 = generateLiuren(new Date('2026-04-10T08:26:00+08:00'));
const liuren20260101At1200 = generateLiuren(new Date('2026-01-01T12:00:00+08:00'));

test('大六壬真实课盘应输出分层取用、应期与复合取传提示词证据', () => {
  const result = liuren20260410At0826;

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
  const calculationStepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  assert.ok(
    evidence.calculationSteps.every((item) =>
      item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)),
    ),
  );
  assert.equal(evidence.summaryFact.status, '证据链完整');
  const factKeys = new Set([
    evidence.calculationFact.key,
    evidence.plateFact.key,
    ...evidence.platePositionFacts.map((item) => item.key),
    evidence.transmissionRuleFact.key,
    evidence.ordinaryTransmissionAdjudicationFact.key,
    ...evidence.ordinaryTransmissionAdjudicationFact.candidateFacts.map((item) => item.key),
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
  assert.match(evidence.promptText, /起盘事实：[\s\S]*四课取传与初传发用：[\s\S]*【任务】/);
  for (const transmission of result.threeTransmissions) {
    assert.ok(transmission.wuxing);
    assert.ok(transmission.seasonState);
    assert.equal(typeof transmission.isVoid, 'boolean');
  }

  const fuyinNoKe = resolveLiurenClassicalRules('伏吟法');
  const fuyinKe = resolveLiurenClassicalRules('伏吟重审法');
  const fanyinNoKe = resolveLiurenClassicalRules('返吟法');
  const fanyinKe = resolveLiurenClassicalRules('返吟元首法');
  assert.match(fuyinNoKe[0].summary, /四课无克/);
  assert.doesNotMatch(fuyinNoKe[0].summary, /四课有克/);
  assert.match(fuyinKe[0].summary, /四课有克/);
  assert.doesNotMatch(fuyinKe[0].summary, /四课无克/);
  assert.match(fanyinNoKe[0].summary, /四课无克/);
  assert.doesNotMatch(fanyinNoKe[0].summary, /四课有克/);
  assert.match(fanyinKe[0].summary, /四课有克/);
  assert.doesNotMatch(fanyinKe[0].summary, /四课无克/);

  assert.equal(result.transmissionRule, '返吟重审法');
  assert.equal(result.ordinaryTransmissionAdjudication?.status, 'deferredToSpecial');
  assert.deepEqual(
    result.fourLessons.map((item) => item.upper),
    ['申', '寅', '申', '寅'],
  );
  const beforePrompt = structuredClone(result);
  const prompt = buildDivinationPrompt({ method: 'liuren', data: result, question: '问合作进度' });
  assert.match(prompt, /取传条件：返吟课兼四课下贼上：天盘与地盘相冲；四课见下贼上/);
  assert.match(prompt, /四课下贼上候选只有一个不同上神/);
  assert.doesNotMatch(prompt, /四课只有一处下贼上|无克另按井栏射取传/);
  assert.match(prompt, /初传取法：按返吟重审法取寅发用/);
  assert.doesNotMatch(prompt, /初传取法：；|常用取传规则未定|候选取舍：/);
  assert.deepEqual(result, beforePrompt);
});

test('不同全局时区下月将均在雨水交节整秒切换', () => {
  const boundary = calculateSolarTermEvidence(2024, 4).utcTimestamp;
  try {
    for (const offsetMinutes of [-300, 0, 840]) {
      TimeManager.setTimezoneOffsetMinutesOverride(offsetMinutes);
      for (const [timestamp, monthLeader] of [
        [boundary - 1000, '子'],
        [boundary, '亥'],
      ] as const) {
        const result = generateLiuren(new Date(timestamp));
        assert.equal(result.monthLeader, monthLeader);
        assert.equal(result.evidenceAnalysis?.calculationFact.monthLeader, monthLeader);
        assert.equal(
          result.heavenlyPlate.find((item) => item.under === result.divinationBranch)?.branch,
          monthLeader,
        );
      }
    }
  } finally {
    TimeManager.setTimezoneOffsetMinutesOverride(480);
  }
});

test('真太阳时日时校正跨过雨水时，月将和节气仍按实际占时交节', () => {
  // 香港天文台 2024 年年历：雨水为 2 月 19 日 12:13（东八区）。
  // 《大六壬指南》卷一：大寒后子将、雨水后亥将。
  const beforeTerm = generateLiuren(new Date('2024-02-19T13:00:00+08:00'), {
    termReferenceDate: new Date('2024-02-19T11:30:00+08:00'),
  });
  assert.equal(beforeTerm.monthLeader, '子');
  assert.equal(beforeTerm.termReferenceTimestamp, new Date('2024-02-19T11:30:00+08:00').getTime());
  assert.match(beforeTerm.lessonSummary ?? '', /当前节气为立春/);
  assert.match(buildTimeInfoText(beforeTerm), /节气：立春/);
  assert.equal(beforeTerm.ganzhi.hour.charAt(1), '未');
  assert.equal(beforeTerm.heavenlyPlate.find((item) => item.under === '未')?.branch, '子');

  const afterTerm = generateLiuren(new Date('2024-02-19T10:00:00+08:00'), {
    termReferenceDate: new Date('2024-02-19T12:40:00+08:00'),
  });
  assert.equal(afterTerm.monthLeader, '亥');
  assert.match(afterTerm.lessonSummary ?? '', /当前节气为雨水/);
  assert.match(buildTimeInfoText(afterTerm), /节气：雨水/);
  assert.equal(afterTerm.ganzhi.hour.charAt(1), '巳');
  assert.equal(afterTerm.heavenlyPlate.find((item) => item.under === '巳')?.branch, '亥');
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

function createLesson(
  upper: string,
  lower: string,
  relation = '比和',
  name: LiurenLesson['name'] = '一课',
): LiurenLesson {
  return {
    name,
    upper,
    lower,
    god: '贵人',
    relation,
    note: '',
  };
}

const DEFAULT_RESOLVE_HEAVENLY_PLATE = buildHeavenlyPlate({
  monthLeader: '亥',
  divinationBranch: '卯',
  noblemanBranch: '丑',
  dayNight: '昼占',
});

function createResolveContext(
  overrides: Partial<Parameters<typeof resolveInitialTransmission>[1]> = {},
) {
  return {
    dayStem: '甲',
    dayBranch: '子',
    dayStemResidence: '寅',
    heavenlyPlate: DEFAULT_RESOLVE_HEAVENLY_PLATE.map((item) => ({ ...item })),
    ...overrides,
  };
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

test('大六壬课体登记表应固定十四条来源、稳定键和结构条件', () => {
  assert.equal(REGISTERED_LIUREN_GUA_TI_COUNT, 14);
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

test('大六壬课体只保留可核对来源的条件，并识别闭口发用', () => {
  const structuralFacts = getLiurenGuaTiFacts({
    transmissionBranches: ['子', '辰', '午'],
    dayStem: '甲',
  });
  assert.ok(
    structuralFacts.every((item) => item.name !== '初末相冲课' && item.name !== '传归生处课'),
  );

  // 甲子旬的旬尾酉临旬首子发用。
  const bikouFacts = getLiurenGuaTiFacts({
    transmissionBranches: ['酉', '亥', '丑'],
    initialGroundBranch: '子',
    dayStem: '甲',
    dayBranch: '子',
  });
  const bikouFact = bikouFacts.find((item) => item.name === '闭口课');
  assert.ok(bikouFact, '闭口课应命中');
  assert.equal(bikouFact.stableKey, 'liuren:verified-guati:bi-kou');
  assert.match(bikouFact.sourceTitle, /闭口课/);
  assert.match(bikouFact.sourceQuote, /旬尾加旬首/);
  assert.deepEqual(bikouFact.branches, ['酉', '子']);

  const missingGroundFacts = getLiurenGuaTiFacts({
    transmissionBranches: ['酉', '亥', '丑'],
    dayStem: '甲',
    dayBranch: '子',
  });
  assert.ok(!missingGroundFacts.some((item) => item.id === 'bi-kou'));

  const otherGroundFacts = getLiurenGuaTiFacts({
    transmissionBranches: ['酉', '亥', '丑'],
    initialGroundBranch: '寅',
    dayStem: '甲',
    dayBranch: '子',
  });
  assert.ok(!otherGroundFacts.some((item) => item.id === 'bi-kou'));
});

test('大六壬闭口课的旬首乘玄武与旬首位上神乘玄武均须发用', () => {
  const common = { dayStem: '甲', dayBranch: '子' };
  const findBiKou = (context: Parameters<typeof getLiurenGuaTiFacts>[0]) =>
    getLiurenGuaTiFacts(context).find((item) => item.id === 'bi-kou');

  const headOnHeavenlyPlate = findBiKou({
    ...common,
    transmissionBranches: ['子', '寅', '辰'],
    initialGroundBranch: '戌',
    initialGod: '玄武',
  });
  assert.ok(headOnHeavenlyPlate);
  assert.deepEqual(headOnHeavenlyPlate.matchedConditions, ['初传子为甲子旬首，乘玄武发用']);

  const headOnGroundPlate = findBiKou({
    ...common,
    transmissionBranches: ['辰', '午', '申'],
    initialGroundBranch: '子',
    initialGod: '玄武',
  });
  assert.ok(headOnGroundPlate);
  assert.deepEqual(headOnGroundPlate.matchedConditions, ['初传辰为地盘旬首子上神，乘玄武发用']);

  assert.equal(
    findBiKou({
      ...common,
      transmissionBranches: ['子', '寅', '辰'],
      initialGroundBranch: '戌',
      initialGod: '白虎',
    }),
    undefined,
  );
  assert.equal(
    findBiKou({
      ...common,
      transmissionBranches: ['辰', '午', '申'],
      initialGroundBranch: '子',
      initialGod: '白虎',
    }),
    undefined,
  );
  assert.equal(
    findBiKou({
      ...common,
      transmissionBranches: ['子', '寅', '辰'],
      initialGroundBranch: '戌',
      initialGod: '玄武',
      dayBranch: '申',
    }),
    undefined,
  );
});

test('大六壬实盘应识别两种乘玄武发用的闭口课', () => {
  const cases = [
    {
      time: '2026-01-07T16:00:00+08:00',
      day: '辛巳',
      initial: '卯',
      ground: '戌',
      condition: '初传卯为地盘旬首戌上神，乘玄武发用',
    },
    {
      time: '2026-02-03T16:00:00+08:00',
      day: '戊申',
      initial: '辰',
      ground: '子',
      condition: '初传辰为甲辰旬首，乘玄武发用',
    },
  ];

  for (const item of cases) {
    const result = generateLiuren(new Date(item.time));
    const chu = result.threeTransmissions[0];
    assert.equal(result.ganzhi.day, item.day);
    assert.equal(chu.branch, item.initial);
    assert.equal(chu.god, '玄武');
    assert.equal(getPlateItemByBranch(result.heavenlyPlate, chu.branch).under, item.ground);
    assert.deepEqual(result.guaTiFacts?.find((fact) => fact.id === 'bi-kou')?.matchedConditions, [
      item.condition,
    ]);
    for (const prompt of [
      formatEnhancedDivinationInfo('liuren', result),
      buildDivinationPrompt({ method: 'liuren', data: result, question: '核对此课发用' }),
    ]) {
      assert.ok(prompt.includes(`闭口课：${item.condition}`));
      assert.ok(
        prompt.includes(result.guaTiFacts!.find((fact) => fact.id === 'bi-kou')!.sourceTitle),
      );
    }
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
      sourceOldId: '854504',
      context: { transmissionBranches: ['卯', '辰', '巳'], initialGroundBranch: '申' },
    },
    {
      name: '铸印卦',
      sourceOldId: '854504',
      context: { transmissionBranches: ['戌', '亥', '子'], initialGroundBranch: '巳' },
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
    if (item.name === '龙德课') {
      assert.ok(
        formatLiurenGuaTiWithTransmissions(fact).includes('龙德课：初传子同时为太岁、月将并乘贵人'),
      );
    }
    if (item.name === '高盖乘轩卦') {
      assert.equal(formatLiurenGuaTiWithTransmissions(fact), `高盖乘轩卦（${fact.sourceTitle}）`);
      assert.deepEqual(fact.matchedConditions, ['三传依次为午、卯、子']);
    }
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
      context: { transmissionBranches: ['卯', '辰', '巳'], initialGroundBranch: '酉' },
    },
    {
      name: '铸印卦',
      context: { transmissionBranches: ['戌', '亥', '子'], initialGroundBranch: '辰' },
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

test('大六壬全部月将、占时、日柱和昼夜组合应完整成课取传', () => {
  const ruleCounts = new Map<string, number>();
  let caseCount = 0;

  for (const monthLeader of DIZHI) {
    for (const hourBranch of DIZHI) {
      for (const dayStem of TIANGAN) {
        for (const dayNight of ['昼占', '夜占'] as const) {
          const dayStemIndex = TIANGAN.indexOf(dayStem);
          const hourBranchIndex = DIZHI.indexOf(hourBranch);
          const hourStem = TIANGAN[((dayStemIndex % 5) * 2 + hourBranchIndex) % 10];
          const heavenlyPlate = buildHeavenlyPlate({
            monthLeader,
            divinationBranch: hourBranch,
            noblemanBranch: getNoblemanBranch(dayStem, dayNight),
            dayNight,
          });
          const dayStemResidence = getDayStemResidence(dayStem);
          for (const day of SIXTY_DAYS.filter((value) => value.startsWith(dayStem))) {
            const dayBranch = day.charAt(1);
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

            assert.equal(getUpperByUnder(heavenlyPlate, hourBranch), monthLeader, label);
            assert.equal(heavenlyPlate.length, 12, label);
            assert.equal(new Set(heavenlyPlate.map((item) => item.under)).size, 12, label);
            assert.equal(new Set(heavenlyPlate.map((item) => item.branch)).size, 12, label);
            assert.equal(new Set(heavenlyPlate.map((item) => item.god)).size, 12, label);
            if (day === '甲子' && dayNight === '昼占') {
              const monthLeaderIndex = DIZHI.indexOf(monthLeader);
              assert.deepEqual(
                new Map(heavenlyPlate.map((item) => [item.under, item.branch] as const)),
                new Map(
                  DIZHI.map(
                    (under, underIndex) =>
                      [
                        under,
                        DIZHI[
                          (underIndex + monthLeaderIndex - hourBranchIndex + DIZHI.length) %
                            DIZHI.length
                        ],
                      ] as const,
                  ),
                ),
                `${label}十二地盘支与上神应逐位按月将加占时旋转`,
              );
            }
            assert.equal(lessons.length, 4, label);
            assert.equal(branches.length, 3, label);
            assert.ok(
              branches.every((branch) => DIZHI.includes(branch as (typeof DIZHI)[number])),
              label,
            );
            const adjudication = initial.ordinaryAdjudication;
            assert.ok(adjudication, label);
            const isSpecialRule = /伏吟|返吟|八专|别责|昴星/.test(initial.rule);
            assert.equal(
              adjudication.status,
              isSpecialRule ? 'deferredToSpecial' : 'selected',
              label,
            );
            for (const candidate of adjudication.candidates) {
              for (const source of candidate.sourceLessons) {
                assert.deepEqual(
                  { name: source.name, lower: source.lower },
                  {
                    name: lessons[source.position - 1]?.name,
                    lower: lessons[source.position - 1]?.lower,
                  },
                  label,
                );
              }
            }
            if (!isSpecialRule) {
              assert.equal(adjudication.selectedRule, initial.rule, label);
              assert.equal(adjudication.selectedInitial, initial.initial, label);
              assert.equal(
                adjudication.candidates.filter((candidate) => candidate.status === 'selected')
                  .length,
                1,
                label,
              );
              assert.equal(
                adjudication.selectedCandidateKey,
                adjudication.candidates.find((candidate) => candidate.status === 'selected')?.key,
                label,
              );
            }

            ruleCounts.set(initial.rule, (ruleCounts.get(initial.rule) || 0) + 1);
            caseCount += 1;
          }
        }
      }
    }
  }

  assert.equal(caseCount, 17_280);
  assert.deepEqual(Object.fromEntries([...ruleCounts].sort()), {
    伏吟法: 1152,
    伏吟元首法: 144,
    伏吟重审法: 144,
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
    遥克法: 1296,
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
  const result = liuren20260410At0826;

  assert.equal(result.ganzhi.day, '甲寅');
  assert.equal(result.monthLeader, '戌');
  assert.equal(result.divinationBranch, '辰');
  assert.deepEqual(
    result.fourLessons.map((item) => `${item.name}${item.upper}${item.lower}`),
    ['一课申甲', '二课寅申', '三课申寅', '四课寅申'],
  );
  assert.equal(result.transmissionRule, '返吟重审法');
  assert.match(result.classicalRules?.[0]?.source || '', /《大六壬大全》九宗门取传法/);
  assert.deepEqual(
    result.threeTransmissions.map((item) => item.branch),
    ['寅', '申', '寅'],
  );
});

test('丙辰日卯时辰将首尾同课应按别责取亥午午', () => {
  // 《六壬大全·别责课》明列此盘：一课丙寄巳，四课午临巳，三传亥午午。
  const result = buildReferenceLiurenPlate({ day: '丙辰', hour: '辛卯', monthLeader: '辰' });

  assert.deepEqual(
    result.lessons.map((lesson) => `${lesson.upper}${lesson.lower}`),
    ['午丙', '未午', '巳辰', '午巳'],
  );
  assert.equal(result.initial.rule, '别责法');
  assert.deepEqual(result.branches, ['亥', '午', '午']);
});

test('大六壬昴星原例区分阳日酉上与阴日酉下，并按干支上神取中末', () => {
  // 《六壬大全·昴星课》明列：戊申日卯时辰将戌酉午，丁丑日辰时丑将子辰戌。
  const cases = [
    { day: '戊申', hour: '乙卯', monthLeader: '辰', expected: ['戌', '酉', '午'] },
    { day: '丁丑', hour: '甲辰', monthLeader: '丑', expected: ['子', '辰', '戌'] },
  ];
  for (const item of cases) {
    const result = buildReferenceLiurenPlate(item);
    assert.equal(result.initial.rule, '昴星法', item.day);
    assert.deepEqual(result.branches, item.expected, item.day);
  }

  const classic = getLiurenTransmissionClassic('昴星法');
  assert.match(classic?.summary ?? '', /阴日初传取天盘酉下神，中传干上、末传支上/);
  assert.match(resolveLiurenClassicalRules('昴星法')[0]?.summary ?? '', /天盘酉下神/);
});

test('大六壬九宗门资料查询识别知一别名，并优先返回特殊主课', () => {
  const cases = [
    ['比用法', '知一/比用'],
    ['知一法', '知一/比用'],
    ['伏吟重审法', '伏吟'],
    ['伏吟元首法', '伏吟'],
    ['返吟比用法', '返吟'],
    ['返吟涉害法', '返吟'],
    ['反吟', '返吟'],
    ['遥克比用法', '遥克'],
    ['遥克涉害法', '遥克'],
  ];
  for (const [rule, expected] of cases) {
    assert.equal(getLiurenTransmissionClassic(rule)?.rule, expected, rule);
  }
  assert.equal(getLiurenTransmissionClassic('未知取传法'), undefined);
});

test('大六壬古例中的比用、涉害、遥克、别责和八专应排出原文三传', () => {
  const cases = [
    {
      day: '壬辰',
      hour: '乙巳',
      monthLeader: '辰',
      rule: '比用法',
      expected: ['戌', '酉', '申'],
      source: '《六壬大全》卷五《知一课》壬辰日巳时辰将',
    },
    {
      day: '甲辰',
      hour: '丁卯',
      monthLeader: '亥',
      rule: '涉害法',
      expected: ['子', '申', '辰'],
      source: '《六壬大全》卷五《涉害课》甲辰日亥将卯时',
    },
    {
      day: '庚戌',
      hour: '庚辰',
      monthLeader: '申',
      rule: '涉害法',
      expected: ['辰', '申', '子'],
      source: '《六壬大全》卷五《察微》庚戌日辰时申将',
    },
    {
      day: '甲戌',
      hour: '丙寅',
      monthLeader: '亥',
      rule: '遥克法',
      expected: ['申', '巳', '寅'],
      source: '《古今图书集成·艺术典》第717卷《遥克》甲戌日寅时亥将',
    },
    {
      day: '庚戌',
      hour: '甲申',
      monthLeader: '亥',
      rule: '遥克法',
      expected: ['寅', '巳', '申'],
      source: '《古今图书集成·艺术典》第717卷《遥克》庚戌日申时亥将',
    },
    {
      day: '戊午',
      hour: '乙卯',
      monthLeader: '辰',
      rule: '别责法',
      expected: ['寅', '午', '午'],
      source: '《古今图书集成·艺术典》第717卷《别责》戊午日卯时辰将',
    },
    {
      day: '辛丑',
      hour: '丙申',
      monthLeader: '亥',
      rule: '别责法',
      expected: ['巳', '丑', '丑'],
      source: '《古今图书集成·艺术典》第717卷《别责》辛丑日申时亥将',
    },
    {
      day: '甲寅',
      hour: '丙寅',
      monthLeader: '亥',
      rule: '八专法',
      expected: ['丑', '亥', '亥'],
      source: '《古今图书集成·艺术典》第717卷《八专》甲寅日寅时亥将',
    },
    {
      day: '己未',
      hour: '壬申',
      monthLeader: '亥',
      rule: '八专法',
      expected: ['亥', '戌', '戌'],
      source: '《古今图书集成·艺术典》第717卷《八专》己未日申时亥将',
    },
  ];

  for (const item of cases) {
    const result = buildReferenceLiurenPlate(item);
    assert.equal(result.initial.rule, item.rule, item.source);
    assert.deepEqual(result.branches, item.expected, item.source);
  }
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

test('大六壬公元 1 年大寒前沿用上一冬至的丑将', () => {
  assert.equal(generateLiuren(new Date('0001-01-20T00:00:00Z')).monthLeader, '丑');
  assert.equal(generateLiuren(new Date('0001-01-21T08:39:40Z')).monthLeader, '丑');
  assert.equal(generateLiuren(new Date('0001-01-21T08:39:41Z')).monthLeader, '子');
});

test('大六壬逐月神煞应按月建起，且与日支支马分层保存', () => {
  const result = liuren20260101At1200;
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
      (item) => item.rule && item.sources.length > 0 && item.limitations.length >= 3,
    ),
  );
});

test('大六壬罗网应按日支前一辰与对冲定位，不误用流年冒充本命', () => {
  const haiDay = liuren20260101At1200;
  const ziDay = generateLiuren(new Date('2026-01-02T12:00:00+08:00'));

  assert.equal(haiDay.ganzhi.day, '乙亥');
  assert.ok(haiDay.shenShaSummary?.includes('天罗在子'));
  assert.ok(haiDay.shenShaSummary?.includes('地网在午'));

  assert.equal(ziDay.ganzhi.day, '丙子');
  assert.ok(ziDay.shenShaSummary?.includes('天罗在丑'));
  assert.ok(ziDay.shenShaSummary?.includes('地网在未'));
  assert.ok(ziDay.shenShaSummary?.every((item) => !item.startsWith('命带')));
});

test('大六壬课注传注只描述盘面关系，不提前生成现实结论或建议', () => {
  const result = liuren20260410At0826;
  const notes = [
    ...result.fourLessons.map((item) => item.note),
    ...result.threeTransmissions.map((item) => item.note),
  ].join('；');

  assert.match(notes, /五行关系为/);
  assert.doesNotMatch(notes, /推进|转机|发力|阻力|卡点|落地|延后|建议|适合/);
  assert.equal(Object.hasOwn(result, 'dayOfficer'), false);
});

test('大六壬天将应按贵人所临地盘定顺逆，不是简单昼顺夜逆', () => {
  const result = liuren20260410At0826;

  assert.equal(result.noblemanBranch, '丑');
  assert.equal(getGodByUpper(result.heavenlyPlate, '丑'), '贵人');
  assert.equal(getGodByUpper(result.heavenlyPlate, '寅'), '天后');
  assert.equal(getGodByUpper(result.heavenlyPlate, '子'), '螣蛇');
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

  assert.equal(result.transmissionRule, '伏吟重审法');
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
  assert.deepEqual(
    result.ordinaryAdjudication?.candidates
      .filter((item) => item.family === 'directKe')
      .map((item) => [item.upper, item.sameYinYangAsDayStem, item.status]),
    [
      ['巳', false, 'excluded'],
      ['午', true, 'selected'],
    ],
  );
  assert.equal(
    result.ordinaryAdjudication?.stages.find((item) => item.id === 'directBiYong')?.status,
    'selected',
  );
});

test('大六壬普通宗门应保留直接克压制遥克的完整候选轨迹', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('巳', '子', '水克火'),
      createLesson('申', '酉'),
      createLesson('子', '亥'),
      createLesson('卯', '寅'),
    ],
    createResolveContext({ dayStem: '甲' }),
  );

  assert.equal(result.rule, '重审法');
  assert.equal(result.initial, '巳');
  const adjudication = result.ordinaryAdjudication;
  assert.ok(adjudication);
  assert.equal(adjudication.status, 'selected');
  assert.equal(adjudication.selectedRule, '重审法');
  assert.equal(adjudication.selectedInitial, '巳');
  assert.equal(adjudication.stages.find((item) => item.id === 'directKe')?.status, 'selected');
  assert.equal(
    adjudication.stages.find((item) => item.id === 'remoteKe')?.status,
    'suppressedByPrior',
  );
  assert.deepEqual(
    adjudication.candidates.map((item) => [item.kind, item.upper, item.status]),
    [
      ['下贼上', '巳', 'selected'],
      ['蒿矢', '申', 'suppressedByPrior'],
    ],
  );
  assert.match(adjudication.candidates[1].reasons.join('；'), /直接上下克前置成立/);
});

test('大六壬普通宗门应在直接克必要条件失败后转入遥克', () => {
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
  assert.equal(result.initial, '申');
  const adjudication = result.ordinaryAdjudication;
  assert.ok(adjudication);
  assert.equal(adjudication.status, 'selected');
  assert.equal(adjudication.stages.find((item) => item.id === 'directKe')?.status, 'notMatched');
  assert.equal(adjudication.stages.find((item) => item.id === 'remoteKe')?.status, 'selected');
  assert.deepEqual(
    adjudication.candidates.map((item) => [item.kind, item.upper, item.status]),
    [['蒿矢', '申', 'selected']],
  );
});

test('大六壬遥克候选应保留第三课与第四课的原始课位', () => {
  const fixtures = [
    {
      lessons: [
        createLesson('寅', '卯'),
        createLesson('子', '亥', '比和', '二课'),
        createLesson('申', '酉', '比和', '三课'),
        createLesson('卯', '寅', '比和', '四课'),
      ],
      position: 3,
      name: '三课',
    },
    {
      lessons: [
        createLesson('寅', '卯'),
        createLesson('子', '亥', '比和', '二课'),
        createLesson('卯', '寅', '比和', '三课'),
        createLesson('申', '酉', '比和', '四课'),
      ],
      position: 4,
      name: '四课',
    },
  ];

  for (const fixture of fixtures) {
    const result = resolveInitialTransmission(
      fixture.lessons,
      createResolveContext({ dayStem: '甲' }),
    );
    const candidate = result.ordinaryAdjudication?.candidates.find(
      (item) => item.family === 'remoteKe' && item.upper === '申',
    );
    assert.equal(result.rule, '遥克法');
    assert.deepEqual(candidate?.sourceLessons, [
      { position: fixture.position, name: fixture.name, lower: '酉' },
    ]);
  }
});

test('大六壬重复遥克上神只按一个候选取遥克，不误入比用或涉害', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('寅', '卯'),
      createLesson('申', '酉', '比和', '二课'),
      createLesson('申', '酉', '比和', '三课'),
      createLesson('卯', '寅', '比和', '四课'),
    ],
    createResolveContext({ dayStem: '甲' }),
  );

  assert.equal(result.rule, '遥克法');
  assert.equal(result.initial, '申');
  const candidate = result.ordinaryAdjudication?.candidates.find((item) => item.upper === '申');
  assert.deepEqual(
    candidate?.sourceLessons.map((item) => [item.position, item.name]),
    [
      [2, '二课'],
      [3, '三课'],
    ],
  );
  assert.equal(
    result.ordinaryAdjudication?.stages.find((stage) => stage.id === 'remoteKe')?.status,
    'selected',
  );
  assert.equal(
    result.ordinaryAdjudication?.stages.find((stage) => stage.id === 'remoteBiYong')?.status,
    'notApplicable',
  );
});

test('大六壬遥克经典来源不得被宽泛克法匹配冒充贼克', () => {
  assert.deepEqual(
    resolveLiurenClassicalRules('遥克法').map((item) => item.rule),
    ['遥克'],
  );
  assert.deepEqual(
    resolveLiurenClassicalRules('遥克比用法').map((item) => item.rule),
    ['遥克', '知一/比用'],
  );
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

test('大六壬涉害先按受克深浅及所临孟仲季，复等再取干支上', () => {
  const cases = [
    {
      day: '丁卯',
      hour: '辛丑',
      monthLeader: '亥',
      expected: ['亥', '酉', '未'],
      source: '《六壬大全》卷四丁卯日丑时亥将涉害例',
    },
    {
      day: '庚子',
      hour: '丁戌',
      monthLeader: '申',
      expected: ['午', '辰', '寅'],
      source: '《六壬大全》卷四庚子日戌时申将见机例',
    },
    {
      day: '甲午',
      hour: '庚辰',
      monthLeader: '午',
      expected: ['辰', '午', '申'],
      source: '《六壬大全》卷四甲午日辰时午将缀瑕例',
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
    assert.equal(
      result.initial.ordinaryAdjudication?.stages.find((stage) => stage.id === 'directSheHai')
        ?.status,
      'selected',
      item.source,
    );
    assert.ok(
      result.initial.ordinaryAdjudication?.candidates
        .filter((candidate) => candidate.family === 'directKe')
        .every((candidate) => candidate.harmAssessment),
      item.source,
    );
    assert.ok(
      result.initial.ordinaryAdjudication?.candidates
        .filter((candidate) => candidate.harmAssessment)
        .every((candidate) =>
          candidate.reasons.some((reason) => /涉害深度|复等|孟仲季|原课序/.test(reason)),
        ),
      item.source,
    );
  }
});

test('大六壬涉害同深按所临地盘取孟仲季，不按上神自身支类取舍', () => {
  // 庚午日、子时、辰将：上克下候选辰加子和寅加戌均涉害一重。
  // 辰所临子为四仲，寅所临戌为四季；按所临位应取辰发用。
  const result = buildReferenceLiurenPlate({
    day: '庚午',
    hour: '丙子',
    monthLeader: '辰',
  });

  assert.equal(result.initial.rule, '涉害法');
  assert.deepEqual(result.branches, ['辰', '申', '子']);
  const candidates = result.initial.ordinaryAdjudication?.candidates ?? [];
  assert.equal(candidates.find((item) => item.upper === '辰')?.harmAssessment?.depth, 1);
  assert.equal(candidates.find((item) => item.upper === '寅')?.harmAssessment?.depth, 1);
  assert.match(
    candidates.find((item) => item.upper === '寅')?.reasons.join('；') ?? '',
    /所临地盘孟仲季次序未取/,
  );
});

test('大六壬涉害优先取深，不被两种浅害孟位改取', () => {
  for (const { hour, branches } of [
    { hour: '庚寅', branches: ['寅', '子', '戌'] },
    { hour: '庚辰', branches: ['子', '申', '辰'] },
  ]) {
    const result = buildReferenceLiurenPlate({ day: '庚午', hour, monthLeader: '子' });
    assert.equal(result.initial.rule, '涉害法', hour);
    assert.deepEqual(result.branches, branches, hour);
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

test('大六壬多候选遥克比用保留蒿矢与弹射各自方向标签', () => {
  const haoShi = resolveInitialTransmission(
    [
      createLesson('寅', '亥'),
      createLesson('申', '子'),
      createLesson('酉', '亥'),
      createLesson('午', '辰'),
    ],
    createResolveContext({ dayStem: '甲' }),
  );

  assert.equal(haoShi.rule, '遥克比用法');
  assert.equal(haoShi.tag, '蒿矢');
  assert.equal(haoShi.initial, '申');

  const tanShe = resolveInitialTransmission(
    [
      createLesson('午', '寅'),
      createLesson('寅', '子'),
      createLesson('卯', '子'),
      createLesson('丑', '酉'),
    ],
    createResolveContext({ dayStem: '庚' }),
  );

  assert.equal(tanShe.rule, '遥克比用法');
  assert.equal(tanShe.tag, '弹射');
  assert.equal(tanShe.initial, '寅');
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

test('大六壬乙日伏吟有下贼上时按伏吟重审从干上传发用', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('辰', '乙'),
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

  assert.equal(result.rule, '伏吟重审法');
  assert.equal(result.initial, '辰');
  assert.deepEqual(result.branches, ['辰', '丑', '戌']);
});

test('大六壬癸日伏吟有上克下时按伏吟元首从干上传发用', () => {
  const result = resolveInitialTransmission(
    [
      createLesson('丑', '癸'),
      createLesson('丑', '丑'),
      createLesson('辰', '辰'),
      createLesson('辰', '辰'),
    ],
    createResolveContext({
      dayStem: '癸',
      dayBranch: '丑',
      dayStemResidence: '丑',
      heavenlyPlate: FUYIN_PLATE,
    }),
  );

  assert.equal(result.rule, '伏吟元首法');
  assert.equal(result.initial, '丑');
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

test('大六壬癸丑日伏吟仍按伏吟法取传，不因八专日误走八专法', () => {
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

  assert.notEqual(result.rule, '八专法');
  assert.equal(result.rule, '伏吟法');
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
