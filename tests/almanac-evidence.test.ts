import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeAlmanacEvidence,
  conditionAlmanacTraditionalText,
  generateAlmanacSelection,
} from '../packages/core/src/divination/algorithms/almanac.ts';
import { buildDivinationPrompt } from '../packages/core/src/prompt/divination.ts';

const moveSingleDaySelection = generateAlmanacSelection({
  topic: 'move',
  startDate: '2026-06-01',
  endDate: '2026-06-01',
});
const travelThreeDaySelection = generateAlmanacSelection({
  topic: 'travel',
  startDate: '2025-01-01',
  endDate: '2025-01-03',
});
const moveTenDaySelection = generateAlmanacSelection({
  topic: 'move',
  startDate: '2026-06-01',
  endDate: '2026-06-10',
});

function createMoveSingleDaySelection() {
  return structuredClone(moveSingleDaySelection);
}

function createTravelThreeDaySelection() {
  return structuredClone(travelThreeDaySelection);
}

function createMoveTenDaySelection() {
  return structuredClone(moveTenDaySelection);
}

test('原始宜项未命中当前事项时列为条件候选并保留证据', () => {
  const result = generateAlmanacSelection({
    topic: 'opening',
    startDate: '2025-01-03',
    endDate: '2025-01-03',
  });
  const candidate = result.evidenceAnalysis?.candidates[0];
  assert.ok(candidate);
  assert.equal(
    candidate.topicMatchFacts.find((fact) => fact.key.endsWith(':day-recommends'))?.status,
    '中性',
  );
  assert.equal(candidate.status, '条件候选');
  assert.equal(
    candidate.decisionFact.steps.find((step) => step.stage === '事项命中')?.status,
    '未提供',
  );
  assert.match(candidate.decisionFact.promptText, /原始宜项未见当前事项/);
  assert.match(result.evidenceAnalysis?.promptText ?? '', /原始宜项未见当前事项的明确匹配/);
});

test('同类事项的不同步骤宜忌并存时保留原始列项与慎用裁决', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2025-04-28',
    endDate: '2025-04-28',
  });
  const candidate = result.evidenceAnalysis?.candidates[0];
  assert.ok(candidate);
  assert.ok(candidate.rawTabooFact.recommends.includes('移徙'));
  assert.ok(candidate.rawTabooFact.avoids.includes('入宅'));
  assert.equal(candidate.status, '慎用候选');
  assert.match(result.evidenceAnalysis?.promptText ?? '', /原始宜项：[\s\S]*原始忌项：/);
  assert.match(result.evidenceAnalysis?.promptText ?? '', /宜忌并存/);
  assert.doesNotMatch(result.evidenceAnalysis?.promptText ?? '', /事项支持：/);
});

test('四离日的明确事项禁忌应压过原始宜嫁娶并保留两层证据', (t) => {
  const currentTime = new Date('2026-10-04T08:00:00Z');
  t.mock.method(Date, 'now', () => currentTime.getTime());
  const normalInput = {
    topic: 'marriage' as const,
    startDate: '2026-12-21',
    endDate: '2026-12-21',
  };
  const originalInput = structuredClone(normalInput);
  const result = generateAlmanacSelection(normalInput);
  const day = result.days[0];
  const candidate = result.evidenceAnalysis?.candidates[0];
  const fourSeparations = day.topicMatchFacts?.find(
    (fact) => fact.key === '2026-12-21:topic:rule-four-separations',
  );

  assert.ok(day.recommends.includes('嫁娶'));
  assert.ok(day.gods.includes('四离'));
  assert.ok(day.gods.includes('不将'));
  assert.ok(fourSeparations);
  assert.equal(fourSeparations.sourceType, '值日神煞事项规则');
  assert.equal(fourSeparations.status, '限制');
  assert.ok(fourSeparations.sources.some((source) => source.includes('协纪辨方书')));
  assert.ok(candidate);
  assert.deepEqual(candidate.rawTabooFact.recommends, day.recommends);
  assert.equal(candidate.status, '慎用候选');
  assert.ok(candidate.decisionFact.limitingFactKeys.includes(fourSeparations.key));
  assert.ok(!candidate.decisionFact.backgroundGodFactKeys.includes('2026-12-21:god:四离'));
  assert.ok(candidate.decisionFact.backgroundGodFactKeys.includes('2026-12-21:god:不将'));
  assert.match(
    candidate.decisionFact.steps.find((step) => step.stage === '事项命中')?.promptText ?? '',
    /四离日：订婚结婚属本日避忌事项/,
  );

  const custom = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-12-21',
    endDate: '2026-12-21',
  });
  assert.ok(custom.days[0].gods.includes('四离'));
  assert.ok(
    !custom.days[0].topicMatchFacts?.some((fact) => fact.sourceType === '值日神煞事项规则'),
  );
  const customDecision = custom.evidenceAnalysis?.candidates[0].decisionFact;
  const customGodStep = customDecision?.steps.find((step) => step.stage === '值日神煞');
  assert.ok(customDecision?.backgroundGodFactKeys.includes('2026-12-21:god:四离'));
  assert.equal(customGodStep?.status, '通过');
  assert.deepEqual(customGodStep?.factKeys, []);
  assert.match(customGodStep?.result ?? '', /明确事项规则支持0项，限制0项/);
  assert.doesNotMatch(customDecision?.promptText ?? '', /值日神煞：吉神|值日神煞：凶神/);

  const reads = { topic: 0, startDate: 0, endDate: 0, participants: 0, weekend: 0, times: 0 };
  const dynamic = generateAlmanacSelection({
    get topic() {
      reads.topic += 1;
      return reads.topic === 1 ? 'marriage' : 'travel';
    },
    get startDate() {
      reads.startDate += 1;
      return reads.startDate === 1 ? '2026-12-21' : '错误日期';
    },
    get endDate() {
      reads.endDate += 1;
      return reads.endDate === 1 ? '2026-12-21' : '错误日期';
    },
    get participants() {
      reads.participants += 1;
      return reads.participants === 1 ? undefined : [];
    },
    get weekendPreference() {
      reads.weekend += 1;
      return reads.weekend === 1 ? undefined : 'prefer';
    },
    get timePreferences() {
      reads.times += 1;
      return reads.times === 1 ? [] : (['work-hours'] as const).slice();
    },
  });
  assert.deepEqual(reads, {
    topic: 1,
    startDate: 1,
    endDate: 1,
    participants: 1,
    weekend: 1,
    times: 1,
  });
  assert.equal(dynamic.topic, 'marriage');
  assert.equal(dynamic.topicLabel, '订婚结婚');
  assert.equal(dynamic.startDate, '2026-12-21');
  assert.equal(dynamic.endDate, '2026-12-21');
  assert.equal(dynamic.weekendPreference, 'any');
  assert.deepEqual(dynamic.timePreferences, []);
  assert.deepEqual(dynamic.participants, []);
  assert.deepEqual(dynamic, result);
  assert.deepEqual(normalInput, originalInput);

  const normalTask = buildDivinationPrompt({
    method: 'almanac',
    data: result,
    question: '这天适合婚嫁吗？',
    currentTime,
  });
  const dynamicTask = buildDivinationPrompt({
    method: 'almanac',
    data: dynamic,
    question: '这天适合婚嫁吗？',
    currentTime,
  });
  assert.match(normalTask, /【任务】/);
  assert.match(normalTask, /订婚结婚/);
  assert.match(normalTask, /2026-12-21/);
  assert.match(normalTask, /四离/);
  assert.doesNotMatch(normalTask, /占卜信息暂不可用/);
  assert.equal(dynamicTask, normalTask);
});

test('黄历择日应内置透明约束与候选证据', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  });
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'almanac:evidence');
  const calculationStepKeys = new Set(evidence.calculationSteps.map((item) => item.key));
  assert.ok(
    evidence.calculationSteps.every(
      (item) =>
        item.dependsOnStepKeys.every((key) => calculationStepKeys.has(key)) &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实吉凶'),
    ),
  );
  assert.equal(evidence.candidates.length, data.days.length);
  assert.match(
    evidence.promptText,
    /【传统依据】[\s\S]*【择日事项】[\s\S]*【候选日期】[\s\S]*【任务】/,
  );
  assert.match(evidence.promptText, /中国标准时间正午月相/);
  assert.doesNotMatch(
    evidence.promptText,
    /算法|规则集|计算链|证据链|来源|统一边界|解释限制|不得|不证明/,
  );
  assert.ok(evidence.candidates.every((candidate) => candidate.astronomicalFacts.length === 2));
  assert.ok(
    evidence.candidates.every(
      (candidate) =>
        candidate.rawTabooFact.key === `${candidate.date}:raw-taboo` &&
        candidate.rawTabooFact.status !== '均未列' &&
        candidate.godFacts.length > 0 &&
        candidate.godFacts.every(
          (item) =>
            item.key.startsWith(`${candidate.date}:god:`) &&
            item.status === '已读取' &&
            item.sources.length >= 2,
        ) &&
        candidate.topicMatchFacts.length === 2 &&
        candidate.topicMatchFacts.every(
          (item) =>
            item.key.startsWith(`${candidate.date}:topic:`) &&
            Array.isArray(item.inputItems) &&
            item.sources.length >= 2 &&
            item.limitation.includes('不证明事项必然成功'),
        ) &&
        candidate.decisionFact.key === `${candidate.date}:decision` &&
        candidate.decisionFact.status === candidate.status &&
        candidate.decisionFact.steps.length === 7 &&
        candidate.decisionFact.steps.at(-1)?.result === candidate.status &&
        candidate.decisionFact.limitation.includes('不设置吉凶总分'),
    ),
  );
  assert.ok(
    evidence.candidates.every(
      (candidate) =>
        candidate.calendarFact.key === `${candidate.date}:calendar` &&
        candidate.calendarFact.promptText.includes('年柱') &&
        candidate.calendarFact.sources.length >= 2 &&
        candidate.calendarFact.limitation.includes('不单独证明现实吉凶'),
    ),
  );
  assert.ok(
    evidence.candidates.every(
      (candidate) =>
        candidate.moonPhaseFact.previousPrincipalPhase.sources.length >= 2 &&
        candidate.moonPhaseFact.nextPrincipalPhase.calculation.includes('二分求根') &&
        candidate.moonPhaseFact.limitations.length >= 3,
    ),
  );
  assert.equal(evidence.summaryFact.visibleCandidateCount, Math.min(evidence.candidates.length, 8));
  const factKeys = new Set([evidence.summaryFact.key, ...evidence.summaryFact.factKeys]);
  assert.ok(
    evidence.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    evidence.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.match(
    evidence.promptText,
    /候选日期[\s\S]*年柱[\s\S]*原始宜项：[\s\S]*原始忌项：[\s\S]*任务/,
  );
  assert.doesNotMatch(evidence.promptText, /评分[：=]?\d|\d+分|成功率[：=]?\d|匹配率[：=]?\d/);
});

test('黄历择日候选资料为空时应明确标记缺失，不生成伪最佳日期', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
  });
  data.days = [];
  data.evidenceAnalysis = undefined;

  const evidence = analyzeAlmanacEvidence(data);

  assert.equal(evidence.summaryFact.status, '候选资料缺失');
  assert.equal(evidence.summaryFact.candidateCount, 0);
  assert.equal(evidence.calculationSteps[0]?.status, '资料不足');
  assert.equal(evidence.calculationSteps[6]?.status, '资料不足');
  assert.equal(evidence.counterSummaryFact.status, '资料不足');
  assert.match(evidence.counterSummaryFact.promptText, /没有候选日资料，无法核验/u);
  assert.doesNotMatch(evidence.counterSummaryFact.promptText, /未见明确事项忌项/);
  assert.deepEqual(evidence.preferredDates, []);
  assert.deepEqual(evidence.conditionalDates, []);
  assert.deepEqual(evidence.cautionDates, []);
  assert.ok(evidence.limitationFacts.every((item) => item.ownerFactKeys.length > 0));
});

test('旧黄历跨立春日期仍以民用日期正午干支复验，分页候选可只含范围子集', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-02-03',
    endDate: '2026-02-05',
  });
  const paged = { ...data, days: [data.days[1]] };
  assert.equal(analyzeAlmanacEvidence(paged).candidates.length, 1);

  paged.days = [{ ...data.days[1], ganzhi: { ...data.days[1].ganzhi, month: '甲子' } }];
  assert.throws(() => analyzeAlmanacEvidence(paged), /month.*请重新排盘/);
  paged.days = [{ ...data.days[1], weekday: '星期日' }];
  assert.throws(() => analyzeAlmanacEvidence(paged), /weekday.*请重新排盘/);
});

test('旧黄历候选日期及非空时辰盘须逐项复验', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-02',
  });
  const original = data.days[0];
  data.days = [original, { ...original }];
  assert.throws(() => analyzeAlmanacEvidence(data), /重复.*请重新排盘/);

  data.days = [{ ...original, date: '2026-06-03' }];
  assert.throws(() => analyzeAlmanacEvidence(data), /超出范围.*请重新排盘/);

  data.days = [{ ...original, hours: original.hours?.slice(1) }];
  assert.throws(() => analyzeAlmanacEvidence(data), /时辰数量不完整.*请重新排盘/);

  data.days = [
    {
      ...original,
      hours: original.hours?.map((hour, index) =>
        index === 0 ? { ...hour, ganzhi: '甲子' } : hour,
      ),
    },
  ];
  assert.throws(() => analyzeAlmanacEvidence(data), /时辰资料.*请重新排盘/);
});

test('旧黄历月相与宿曜附文不得覆盖重新计算的传统依据', () => {
  const data = createMoveSingleDaySelection();
  const originalPhase = data.evidenceAnalysis?.candidates[0].moonPhaseFact.eightPhaseName;
  const day = data.days[0];
  day.moonPhaseEvidence = { ...day.moonPhaseEvidence!, eightPhaseName: '伪月相' };
  day.twentyEightStarDetail = { ...day.twentyEightStarDetail!, fortune: '必定大吉' };
  day.nineStarDetail = { ...day.nineStarDetail!, direction: '伪方位' };
  const evidence = analyzeAlmanacEvidence(data);

  assert.equal(evidence.candidates[0].moonPhaseFact.eightPhaseName, originalPhase);
  assert.doesNotMatch(evidence.promptText, /伪月相|必定大吉|伪方位/);
});

test('旧黄历原始宜忌和值日神煞遭篡改时不能进入证据', () => {
  const data = createMoveSingleDaySelection();
  const day = data.days[0];
  day.recommends.push('伪宜项');
  assert.throws(() => analyzeAlmanacEvidence(data), /原始宜忌.*请重新排盘/);

  day.recommends.pop();
  day.gods.push('伪神煞');
  assert.throws(() => analyzeAlmanacEvidence(data), /值日神煞.*请重新排盘/);
});

test('旧黄历事项与参与人派生事实遭篡改时不能改变候选裁决', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    participants: [
      {
        id: 'person-1',
        name: '甲方',
        gender: '男',
        year: '1990',
        month: '1',
        day: '1',
        timeIndex: '6',
        dateType: 'solar',
      },
    ],
  });
  const day = data.days[0];
  const topicFact = day.topicMatchFacts?.find((item) => item.key.endsWith(':day-recommends'));
  assert.ok(topicFact);
  topicFact.promptText = '伪事项支持';
  assert.throws(() => analyzeAlmanacEvidence(data), /事项匹配.*请重新排盘/);

  topicFact.promptText = data.evidenceAnalysis!.candidates[0].topicMatchFacts.find(
    (item) => item.key === topicFact.key,
  )!.promptText;
  assert.ok(day.participantRelationFacts?.length);
  day.participantRelationFacts[0].promptText = '伪参与人冲突';
  assert.throws(() => analyzeAlmanacEvidence(data), /参与人关系.*请重新排盘/);
});

test('旧黄历方位神与彭祖附文不能伪造传统依据', () => {
  const data = generateAlmanacSelection({
    topic: 'renovation',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
  });
  const day = data.days[0];
  day.pengZu = '伪造百忌';
  day.pengZuGan = '伪造百忌';
  const evidence = analyzeAlmanacEvidence(data);
  assert.doesNotMatch(evidence.promptText, /伪造百忌/);

  assert.ok(day.annualDirectionGods?.length);
  day.annualDirectionGods[0].direction = '伪造方位';
  assert.throws(() => analyzeAlmanacEvidence(data), /全年方位神.*请重新排盘/);
});

test('工作时段偏好下无可用时辰的日期不得仍列为可用候选，并保留原始时辰', () => {
  const result = generateAlmanacSelection({
    topic: 'renovation',
    startDate: '2026-02-08',
    endDate: '2026-03-15',
    timePreferences: ['work-hours'],
  });
  const workHourBranches = new Set(['巳', '午', '未', '申']);

  for (const date of ['2026-02-08', '2026-03-03', '2026-03-15']) {
    const day = result.days.find((item) => item.date === date);
    const candidate = result.evidenceAnalysis?.candidates.find((item) => item.date === date);

    assert.ok(day?.hours?.length, `${date} 应保留原始逐时时辰`);
    assert.ok(day.hours.some((hour) => !workHourBranches.has(hour.branch)));
    assert.ok(candidate);
    assert.equal(candidate.usableHours.length, 0);
    assert.notEqual(candidate.status, '可用候选');
    assert.equal(
      candidate.decisionFact.steps.find((step) => step.stage === '可用时辰')?.result,
      '未筛出无强冲突时辰',
    );
    assert.match(
      candidate.decisionFact.steps.find((step) => step.stage === '可用时辰')?.promptText ?? '',
      /此项作为日期分组的一般限制/,
    );
    assert.ok(candidate.decisionFact.limitingFactKeys.includes(`${date}:decision:hours`));
    assert.doesNotMatch(candidate.decisionFact.promptText, /未见明确限制，归入条件候选/);
  }
});

test('在线提示词保留时段偏好、无可用时辰原因和值日神煞事实', () => {
  const result = generateAlmanacSelection({
    topic: 'renovation',
    startDate: '2026-03-03',
    endDate: '2026-03-03',
    timePreferences: ['work-hours', 'morning'],
  });
  const candidate = result.evidenceAnalysis?.candidates[0];
  const prompt = result.evidenceAnalysis?.promptText ?? '';

  assert.ok(candidate);
  assert.equal(candidate.status, '条件候选');
  assert.equal(candidate.usableHours.length, 0);
  assert.match(
    prompt,
    /排序与时段偏好：同一候选等级内工作日优先、候选时辰限巳、午、未、申时、上午时辰优先/,
  );
  assert.match(prompt, /2026-03-03 条件候选：[\s\S]*值日神煞：[^；]+（(?:吉神|凶神)）/);
  assert.match(prompt, /候选时辰：未筛出无强冲突时辰/);
  assert.doesNotMatch(prompt, /2026-03-03 可用候选/);
});

test('旧盘额外时辰限制不能改变候选时辰结论', () => {
  const data = createTravelThreeDaySelection();
  const firstUsableHour = data.evidenceAnalysis?.candidates[0]?.usableHours[0];
  assert.ok(firstUsableHour);
  const day = data.days[0];
  const hour = day?.hours?.find((item) => item.name === firstUsableHour.name);
  assert.ok(hour);
  hour.cautions.push('该时辰的具体安排需核对');
  assert.throws(() => analyzeAlmanacEvidence(data), /时辰限制.*请重新排盘/);
});

test('缺少逐时资料时应标记未提供，不误报无可用时辰', () => {
  const data = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
  });
  data.days[0].hours = [];

  const evidence = analyzeAlmanacEvidence(data);
  const candidate = evidence.candidates[0];
  assert.equal(
    candidate.decisionFact.steps.find((step) => step.stage === '可用时辰')?.status,
    '未提供',
  );
  assert.ok(candidate.limitations.includes('未提供逐时资料'));
  assert.ok(!evidence.counterEvidenceFacts.some((fact) => fact.type === '无可用时辰'));
  assert.match(evidence.promptText, /候选时辰：未提供逐时资料/);
  assert.doesNotMatch(evidence.promptText, /排序与时段偏好：/);
});

test('择日证据应保留日课、宿曜、九星、百忌、方位神与逐时时课来源', () => {
  const result = createTravelThreeDaySelection();
  const candidate = result.evidenceAnalysis?.candidates[0];

  assert.ok(candidate);
  assert.ok(candidate.calendarFacts.some((item) => item.includes('年柱')));
  assert.ok(candidate.calendarFacts.some((item) => item.includes('建除值日')));
  assert.ok(candidate.traditionalRuleFacts.some((item) => item.includes('二十八宿')));
  assert.ok(candidate.traditionalRuleFacts.some((item) => item.includes('九星')));
  assert.ok(candidate.traditionalRuleFacts.some((item) => item.includes('彭祖百忌')));
  assert.ok(candidate.directionFacts.some((item) => item.includes('太岁')));
  assert.ok(candidate.usableHours.length > 0);
  assert.ok(
    candidate.usableHours.every(
      (item) =>
        item.key.startsWith(`${candidate.date}:hour:`) &&
        item.ganzhi &&
        item.branch &&
        item.twelveStar &&
        item.promptText.includes(item.ganzhi) &&
        item.sources.length >= 2 &&
        Array.isArray(item.participantRelationFacts) &&
        item.limitation.includes('本次事项的候选条件') &&
        !('rawTabooFact' in item) &&
        !('recommends' in item) &&
        !('avoids' in item),
    ),
  );
  assert.match(result.evidenceAnalysis?.promptText ?? '', /原始宜项：/);
  assert.match(result.evidenceAnalysis?.promptText ?? '', /候选时辰/);
  assert.doesNotMatch(
    JSON.stringify(result.evidenceAnalysis?.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});

test('择日证据应让明确事项忌项决定慎用分组', () => {
  const data = createMoveTenDaySelection();
  const target = data.days.find((day) =>
    day.cautions.some((item) => item.includes('黄历忌项触及')),
  );
  assert.ok(target);

  const evidence = analyzeAlmanacEvidence(data);
  const candidate = evidence.candidates.find((item) => item.date === target.date);

  assert.equal(candidate?.status, '慎用候选');
  assert.ok(evidence.cautionDates.includes(target.date));
  assert.match(evidence.promptText, new RegExp(`${target.date} 慎用候选`));
});

test('择日证据在缺少参与人时不得编造个人适配', () => {
  const evidence = analyzeAlmanacEvidence(
    generateAlmanacSelection({
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    }),
  );

  assert.doesNotMatch(evidence.promptText, /参与人关系：|不得|现实条件未提供|成功率|吉凶总分/);
  assert.match(evidence.promptText, /【任务】/);
});

test('择日参与人支持与冲突应保留逐项结构化依据', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2026-06-01',
    endDate: '2026-06-12',
    participants: [
      {
        id: 'person-1',
        name: '甲方',
        gender: '男',
        year: '1990',
        month: '1',
        day: '1',
        timeIndex: '6',
        dateType: 'solar',
      },
    ],
  });

  const facts = result.evidenceAnalysis?.candidates.flatMap(
    (candidate) => candidate.participantRelationFacts,
  );
  assert.ok(facts && facts.length > 0);
  assert.ok(
    facts.every(
      (item) =>
        item.key.includes(':participant:person-1:') &&
        item.participantName === '甲方' &&
        item.candidateValue &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明个人结果'),
    ),
  );
  assert.ok(facts.some((item) => item.basis === '年支' || item.basis === '日支'));
  assert.ok(facts.some((item) => item.status === '未采用'));
  const directConflictCandidates = result.evidenceAnalysis?.candidates.filter((candidate) =>
    candidate.participantRelationFacts.some(
      (item) =>
        item.relation === '冲' ||
        item.relation === '刑' ||
        item.relation === '害' ||
        item.relation === '破',
    ),
  );
  assert.ok(directConflictCandidates && directConflictCandidates.length > 0);
  assert.ok(
    directConflictCandidates.every(
      (candidate) =>
        candidate.status === '慎用候选' &&
        candidate.decisionFact.steps.find((step) => step.stage === '参与人关系')?.status ===
          '触发慎用',
    ),
  );
  assert.doesNotMatch(JSON.stringify(facts), /"score"\s*:/);
});

test('择日不应把候选日干支五行简单命中喜忌作为限制或支持', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-06-02',
    endDate: '2025-06-02',
    participants: [
      {
        id: 'person-constraint',
        name: '测试人',
        gender: '男',
        year: '1990',
        month: '5',
        day: '12',
        timeIndex: '5',
        dateType: 'solar',
      },
    ],
  });
  const candidate = result.evidenceAnalysis?.candidates[0];

  assert.equal(result.participants.length, 1);
  assert.ok(candidate);
  assert.deepEqual(candidate.participantConflicts, []);
  assert.ok(
    candidate.participantRelationFacts.some(
      (item) => item.key.endsWith(':elements-not-adopted') && item.status === '未采用',
    ),
  );
  assert.ok(!candidate.decisionFact.limitingFactKeys.some((key) => key.includes('elements')));
  assert.ok(!candidate.participantSupport.some((item) => /命中喜用|触及忌神/.test(item)));
});

test('旧黄历字符串结果应生成兼容事实且不反推缺失参数', () => {
  const result = generateAlmanacSelection({
    topic: 'contract',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
  });
  const day = result.days[0];
  day.topicMatchFacts = undefined;
  day.godFacts = undefined;
  day.participantRelationFacts = undefined;
  for (const hour of day.hours ?? []) {
    hour.participantRelationFacts = undefined;
    hour.topicMatchFacts = undefined;
  }

  const evidence = analyzeAlmanacEvidence(result);
  const candidate = evidence.candidates[0];
  assert.ok(candidate.topicMatchFacts.every((item) => item.key.includes(':legacy-topic:')));
  assert.ok(candidate.godFacts.every((item) => item.key.includes(':legacy-god:')));
  assert.ok(
    candidate.topicMatchFacts.every((item) =>
      item.sources.some((source) => source.includes('未保存原始关键词匹配参数')),
    ),
  );
  assert.ok(
    candidate.usableHours.every(
      (hour) => !('topicMatchFacts' in hour) && Array.isArray(hour.participantRelationFacts),
    ),
  );
});

test('择日传统资料应保留原文并为提示词生成条件化事实', () => {
  const result = generateAlmanacSelection({
    topic: 'renovation',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  });
  const evidence = result.evidenceAnalysis;

  assert.ok(evidence);
  assert.ok(evidence.traditionalFacts.length > 0);
  assert.deepEqual(
    new Set(evidence.traditionalFacts.map((item) => item.kind)),
    new Set(['二十八宿', '九星', '全年方位神', '彭祖百忌']),
  );
  assert.ok(
    evidence.traditionalFacts.every(
      (item) =>
        item.date &&
        item.originalText &&
        item.promptText &&
        item.sources.length > 0 &&
        item.limitation.includes('不证明现实中'),
    ),
  );
  const candidateTraditionalFacts = evidence.candidates.flatMap((item) => item.traditionalFacts);
  assert.ok(candidateTraditionalFacts.some((item) => item.kind === '二十八宿'));
  assert.doesNotMatch(
    candidateTraditionalFacts
      .filter((item) => item.kind === '二十八宿')
      .map((item) => item.originalText)
      .join('；'),
    /tyme4ts|原生吉凶属性/,
  );
  assert.doesNotMatch(
    candidateTraditionalFacts
      .filter(
        (item) => item.kind === '二十八宿' || item.kind === '九星' || item.kind === '全年方位神',
      )
      .map((item) => item.originalText)
      .join('；'),
    /主疾病|主死丧|主灾病死亡|主哭泣死亡|必见灾殃|大凶/,
  );
  assert.doesNotMatch(
    evidence.promptText,
    /主疾病|主死丧|主灾病死亡|主哭泣死亡|必见灾殃|头必生疮|毒气入肠|鬼祟入房|大凶/,
  );
});

test('九星、全年方位神与彭祖百忌不得直接证明灾病、官非、财损或生育结果', () => {
  const traditionalTexts = [
    '二黑巨门星，主疾病、破财、是非',
    '五黄廉贞星，大凶，主凶灾、病患',
    '犯死符主灾病死亡',
    '犯白虎主哭泣死亡及小儿凶',
    '修福德主添丁生子',
    '丙不修灶必见灾殃',
    '未不服药毒气入肠',
  ];
  const promptText = traditionalTexts.map(conditionAlmanacTraditionalText).join('；');

  assert.match(promptText, /传统类象涉及健康、财物与争议议题/);
  assert.match(promptText, /传统方位规则将死符方列为涉及健康与安全类象的回避条件/);
  assert.match(promptText, /传统方位规则将福德方列为修造参考/);
  assert.match(promptText, /丙日传统上避修灶/);
  assert.doesNotMatch(promptText, /不据此|后半句属于传统警语/);
  assert.doesNotMatch(promptText, /主疾病|主灾病死亡|主哭泣死亡|主添丁生子|必见灾殃|毒气入肠|大凶/);
});

test('旧黄历只有合并彭祖百忌时也应拆分并去除后果保证', () => {
  const data = generateAlmanacSelection({
    topic: 'renovation',
    startDate: '2026-04-28',
    endDate: '2026-04-28',
  });
  const day = data.days[0];
  day.pengZuGan = undefined;
  day.pengZuZhi = undefined;
  day.pengZu = '壬不泱水更难提防 申不安床鬼祟入房';

  const evidence = analyzeAlmanacEvidence(data);
  const pengZuFacts = evidence.traditionalFacts.filter((item) => item.kind === '彭祖百忌');

  assert.equal(pengZuFacts.length, 2);
  assert.deepEqual(
    pengZuFacts.map((item) => item.promptText),
    ['壬日传统上避汲水', '申日传统上避安床'],
  );
  assert.doesNotMatch(evidence.promptText, /鬼祟入房|更难提防/);
});

test('择日公开证据不得暴露内部加分措辞', () => {
  const result = createMoveTenDaySelection();

  assert.doesNotMatch(result.evidenceAnalysis?.promptText ?? '', /辅助加分|加\d+分|扣\d+分/);
  assert.ok(result.days.every((day) => day.highlights.every((item) => !item.includes('辅助支持'))));
});

test('婚嫁不能以成服作支持，余事勿取须约束未列事项', () => {
  const result = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2026-01-11',
    endDate: '2026-01-11',
  });
  const day = result.days[0];
  assert.ok(day.recommends.includes('成服'));
  assert.equal(
    day.topicMatchFacts?.some((fact) => fact.status === '支持'),
    false,
  );
  assert.equal(result.evidenceAnalysis?.candidates[0].status, '慎用候选');
  assert.ok(
    day.topicMatchFacts?.some((fact) => fact.status === '限制' && /余事勿取/.test(fact.promptText)),
  );
  const burial = generateAlmanacSelection({
    topic: 'burial',
    startDate: '2026-01-11',
    endDate: '2026-01-11',
  });
  assert.ok(
    burial.days[0].topicMatchFacts?.some(
      (fact) => fact.status === '支持' && fact.matchedItems.includes('安葬'),
    ),
  );
  assert.equal(
    burial.days[0].topicMatchFacts?.some((fact) => /余事勿取/.test(fact.promptText)),
    false,
  );
});

test('时辰明确忌项进入事项限制并从应选时辰排除', () => {
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-01-11',
    endDate: '2026-01-15',
  });
  const forbidden = result.days.flatMap((day) =>
    (day.hours ?? [])
      .filter((hour) => hour.avoids?.includes('出行'))
      .map((hour) => ({ day, hour })),
  );
  assert.ok(forbidden.length > 0, '样本必须包含明确忌出行的时辰');
  for (const { day, hour } of forbidden) {
    assert.ok(
      hour.topicMatchFacts?.some(
        (fact) => fact.status === '限制' && fact.matchedItems.includes('出行'),
      ),
    );
    const candidate = result.evidenceAnalysis!.candidates.find((item) => item.date === day.date)!;
    const evidence = candidate.usableHours.find((item) => item.name === hour.name)!;
    assert.equal(evidence, undefined, '明确忌出行的时辰不能进入可选时辰');
  }
  assert.ok(result.evidenceAnalysis!.candidates.some((item) => item.usableHours.length > 0));
});
