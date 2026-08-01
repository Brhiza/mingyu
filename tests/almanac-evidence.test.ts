import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeAlmanacEvidence as analyzeAuditedAlmanacEvidence,
  conditionAlmanacTraditionalText,
  generateAlmanacSelection,
  rebuildAuditedAlmanacData,
  selectAuditedAlmanacData,
} from 'mingyu-core/divination/almanac';
import {
  analyzeAlmanacEvidence,
  classifyAlmanacHourCandidate,
} from '../packages/core/src/divination/almanac-evidence.ts';

test('黄历择日应内置透明约束与候选证据', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  const evidence = data.evidenceAnalysis;

  assert.ok(evidence);
  assert.equal(evidence.key, 'almanac:evidence');
  assert.equal(evidence.status, '已计算');
  assert.equal(evidence.calculationSteps.length, 7);
  assert.equal(evidence.calculationChain.length, evidence.calculationSteps.length);
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
  assert.match(evidence.promptText, /【黄历择日透明约束与候选证据】/);
  assert.match(evidence.promptText, /传统硬限制：/);
  assert.match(evidence.promptText, /候选分组：/);
  assert.match(evidence.promptText, /中国标准时间12:00参照月相/);
  assert.match(evidence.promptText, /月相只作为中国标准时间正午的天文背景，不参与候选排序/);
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
  assert.equal(evidence.summaryFact.status, '证据链完整');
  assert.equal(evidence.summaryFact.candidateCount, evidence.candidates.length);
  assert.equal(evidence.summaryFact.visibleCandidateCount, evidence.candidates.length);
  assert.ok(evidence.candidates.some((candidate) => candidate.usableHours.length > 4));
  assert.ok(
    evidence.candidates.every((candidate) =>
      evidence.evidence.items.some((item) => item.title === `${candidate.date}${candidate.status}`),
    ),
  );
  assert.equal(evidence.summaryFact.preferredDateCount, evidence.preferredDates.length);
  assert.equal(evidence.summaryFact.conditionalDateCount, evidence.conditionalDates.length);
  assert.equal(evidence.summaryFact.cautionDateCount, evidence.cautionDates.length);
  assert.equal(
    evidence.summaryFact.usableHourFactCount,
    evidence.candidates.reduce((total, item) => total + item.usableHours.length, 0),
  );
  assert.equal(evidence.summaryFact.traditionalFactCount, evidence.traditionalFacts.length);
  assert.equal(evidence.summaryFact.counterEvidenceCount, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.counterSummaryFact.factKeys.length, evidence.counterEvidenceFacts.length);
  assert.equal(evidence.limitationFacts.length, 6);
  assert.equal(evidence.limitations.length, evidence.limitationFacts.length);
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
  assert.doesNotMatch(
    evidence.limitationFacts
      .map((item) => `${item.promptText}；${item.sources.join('、')}`)
      .join('；'),
    /候选日时关系|逐日逐时关系事实/,
  );
  assert.match(
    evidence.limitationFacts.find((item) => item.type === '参与人适配边界')?.promptText ?? '',
    /不自动改变候选分组.*不类推候选时支/,
  );
  assert.match(evidence.promptText, /计算链：[\s\S]*反证汇总：[\s\S]*证据汇总：[\s\S]*解释限制：/);
  assert.doesNotMatch(evidence.promptText, /评分[：=]?\d|\d+分|成功率[：=]?\d|匹配率[：=]?\d/);
});

test('黄历公开重建只信任原始择日输入并支持可复算分页', () => {
  const expected = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    participants: [
      {
        id: 'self',
        name: '本人',
        gender: '男',
        year: '1990',
        month: '1',
        day: '1',
        timeIndex: '6',
        dateType: 'solar',
      },
    ],
  });

  assert.deepEqual(expected.generation.participants, [
    {
      id: 'self',
      name: '本人',
      gender: '男',
      year: '1990',
      month: '1',
      day: '1',
      timeIndex: '6',
      dateType: 'solar',
      isLeapMonth: false,
    },
  ]);
  assert.deepEqual(rebuildAuditedAlmanacData(expected), expected);

  const polluted = structuredClone(expected);
  polluted.topic = 'custom';
  polluted.topicLabel = '伪造事项';
  polluted.startDate = '2000-01-01';
  polluted.endDate = '2000-01-01';
  polluted.timestamp = 0;
  polluted.participants[0].name = '伪造参与人';
  polluted.days = [];
  polluted.evidenceAnalysis!.promptText = '伪造旧证据';

  assert.deepEqual(rebuildAuditedAlmanacData(polluted), expected);
  assert.deepEqual(analyzeAuditedAlmanacEvidence(polluted), expected.evidenceAnalysis);

  const page = selectAuditedAlmanacData(polluted, { offset: 1, limit: 2 });
  assert.deepEqual(page.view, { offset: 1, limit: 2 });
  assert.deepEqual(page.days, expected.days.slice(1, 3));
  assert.deepEqual(rebuildAuditedAlmanacData(page), page);
  assert.deepEqual(
    page.evidenceAnalysis?.candidates.map((item) => item.date),
    page.days.map((item) => item.date),
  );

  assert.throws(
    () => rebuildAuditedAlmanacData({ ...expected, generation: undefined } as never),
    /缺少可信原始择日输入/,
  );
  assert.throws(() => selectAuditedAlmanacData(expected, { offset: 5, limit: 1 }), /分页起始位置/);
  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'move',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        participants: [
          {
            id: 'same',
            name: '甲',
            gender: '男',
            year: '1990',
            month: '1',
            day: '1',
            timeIndex: '1',
            dateType: 'solar',
          },
          {
            id: 'same',
            name: '乙',
            gender: '女',
            year: '1991',
            month: '2',
            day: '2',
            timeIndex: '2',
            dateType: 'solar',
          },
        ],
      }),
    /参与人 id 不得重复/,
  );
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
  assert.equal(evidence.counterSummaryFact.status, '未见明确反证');
  assert.deepEqual(evidence.preferredDates, []);
  assert.deepEqual(evidence.conditionalDates, []);
  assert.deepEqual(evidence.cautionDates, []);
  assert.ok(evidence.limitationFacts.every((item) => item.ownerFactKeys.length > 0));
});

test('择日证据应保留日课、宿曜、九星、百忌、方位神与逐时时课来源', () => {
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2025-01-01',
    endDate: '2025-01-03',
  });
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
        item.ecliptic &&
        item.eclipticLuck &&
        item.promptText.includes(`${item.ecliptic}${item.eclipticLuck}`) &&
        item.promptText.includes(item.ganzhi) &&
        item.sources.length >= 2 &&
        item.rawTabooFact.key.startsWith(item.key) &&
        item.topicMatchFacts.length === 3 &&
        item.topicMatchFacts.every((fact) => fact.scope === '时辰') &&
        item.limitation.includes('不证明该时辰必然成功'),
    ),
  );
  assert.match(result.evidenceAnalysis?.promptText ?? '', /原始宜项/);
  assert.match(result.evidenceAnalysis?.promptText ?? '', /逐时时课|时段/);
  assert.doesNotMatch(
    JSON.stringify(result.evidenceAnalysis?.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
});

test('逐时时课应忽略旧结果中的参与人时支冲突', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
  });
  const hour = result.days[0].bestHours?.[0];
  assert.ok(hour);
  const originalStatus = classifyAlmanacHourCandidate(hour).status;
  hour.participantNotes = ['旧结果：候选时支与参与人年支相冲'];
  hour.participantRelationFacts = [
    {
      key: 'legacy-hour-participant-conflict',
      scope: '时辰',
      participantId: 'legacy-person',
      participantName: '旧参与人',
      basis: '年支',
      candidateValue: hour.branch,
      participantValues: ['午'],
      relation: '冲',
      status: '限制',
      detail: '旧结果中的时支冲突',
      promptText: '旧结果中的时支冲突',
      sources: ['旧结果'],
      limitation: '旧结果',
    },
  ];

  assert.equal(classifyAlmanacHourCandidate(hour).status, originalStatus);
  const evidence = analyzeAlmanacEvidence(result);
  const evidenceHour = evidence.candidates[0].usableHours.find((item) =>
    item.key.includes(`:${hour.ganzhi}:${hour.name}`),
  );
  assert.ok(evidenceHour);
  assert.deepEqual(evidenceHour.participantRelationFacts, []);
  assert.deepEqual(evidenceHour.participantSupport, []);
  assert.doesNotMatch(evidenceHour.constraints.join('；'), /旧结果中的时支冲突/);
  assert.ok(evidenceHour.sources.some((source) => source.includes('原生黄黑道属性')));
  assert.match(evidenceHour.limitation, /仅在候选日层记录参考/);
  const hourDecisionStep = evidence.candidates[0].decisionFact.steps.find(
    (item) => item.stage === '可用时辰',
  );
  const hourCalculationStep = evidence.calculationSteps.find(
    (item) => item.stage === '逐时时课核验',
  );
  assert.ok(hourDecisionStep);
  assert.ok(hourCalculationStep);
  assert.doesNotMatch(hourDecisionStep.sources.join('；'), /参与人/);
  assert.doesNotMatch(
    [hourCalculationStep.promptText, ...hourCalculationStep.sources].join('；'),
    /参与人/,
  );
  assert.match(hourCalculationStep.promptText, /十二神原生黄黑道属性/);
});

test('择日证据应让明确事项忌项决定慎用分组', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });
  const target = data.days.find((day) =>
    day.cautions.some((item) => item.includes('黄历忌项触及')),
  );
  assert.ok(target);

  const evidence = analyzeAlmanacEvidence(data);
  const candidate = evidence.candidates.find((item) => item.date === target.date);

  assert.equal(candidate?.status, '慎用候选');
  assert.ok(evidence.cautionDates.includes(target.date));
  assert.match(evidence.promptText, new RegExp(`${target.date}慎用候选`));
});

test('值日神煞吉凶只作辅助事实，不冒充候选分组的支持或限制', () => {
  const evidence = analyzeAlmanacEvidence(
    generateAlmanacSelection({
      topic: 'custom',
      startDate: '2026-01-01',
      endDate: '2026-01-01',
    }),
  );
  const candidate = evidence.candidates[0];
  const godStep = candidate.decisionFact.steps.find((item) => item.stage === '值日神煞');
  const finalStep = candidate.decisionFact.steps.find((item) => item.stage === '候选分组');

  assert.equal(candidate.status, '可用候选');
  assert.ok(candidate.godFacts.some((item) => item.classification === '吉神'));
  assert.ok(candidate.godFacts.some((item) => item.classification === '凶神'));
  assert.equal(godStep?.status, '通过');
  assert.match(godStep?.result ?? '', /吉神\d+项，凶神\d+项/);
  assert.ok(candidate.decisionFact.supportingFactKeys.every((key) => !key.includes(':god:')));
  assert.ok(candidate.decisionFact.limitingFactKeys.every((key) => !key.includes(':god:')));
  assert.equal(finalStep?.promptText, '未见明确限制，归入可用候选');
  assert.ok(evidence.counterEvidenceFacts.every((item) => item.date !== candidate.date));
});

test('择日证据在缺少参与人时不得编造个人适配', () => {
  const evidence = analyzeAlmanacEvidence(
    generateAlmanacSelection({
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    }),
  );

  assert.match(evidence.promptText, /没有参与人资料时不得编造个人适配结论/);
  assert.match(evidence.promptText, /现实条件未提供时只列待核验项/);
  assert.match(evidence.promptText, /不合成为成功率或吉凶总分/);
});

test('择日参与人刑冲破害应保留逐项结构化依据但不作为候选限制', () => {
  const baseline = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2026-06-01',
    endDate: '2026-06-12',
  });
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
  const baselineByDate = new Map(
    baseline.evidenceAnalysis?.candidates.map((candidate) => [candidate.date, candidate.status]),
  );
  assert.ok(
    directConflictCandidates.every(
      (candidate) =>
        candidate.participantRelationFacts
          .filter(
            (item) =>
              item.relation === '冲' ||
              item.relation === '刑' ||
              item.relation === '害' ||
              item.relation === '破',
          )
          .every((item) => item.status === '未采用') &&
        candidate.participantConflicts.length === 0 &&
        candidate.status === baselineByDate.get(candidate.date) &&
        candidate.decisionFact.steps.find((step) => step.stage === '参与人关系')?.status ===
          '通过' &&
        candidate.decisionFact.limitingFactKeys.every((key) => !key.includes(':participant:')),
    ),
  );
  assert.doesNotMatch(JSON.stringify(facts), /"score"\s*:/);
});

test('旧结果中的参与人刑冲破害不得继续把候选降为慎用', () => {
  const createLegacyData = () =>
    generateAlmanacSelection({
      topic: 'custom',
      startDate: '2026-01-03',
      endDate: '2026-01-03',
    });
  const baseline = analyzeAlmanacEvidence(createLegacyData());

  const structuredData = createLegacyData();
  const structuredDay = structuredData.days[0];
  structuredDay.participantNotes = ['旧参与人：候选日地支丑害生肖/年支午，需谨慎'];
  structuredDay.participantRelationFacts = [
    {
      key: `${structuredDay.date}:participant:legacy-person:year:害`,
      participantId: 'legacy-person',
      participantName: '旧参与人',
      scope: '候选日',
      basis: '年支',
      candidateValue: '丑',
      participantValues: ['午'],
      relation: '害',
      status: '限制',
      promptText: '旧参与人：日支丑与其年支午害',
      sources: ['旧结果'],
      limitation: '旧结果',
    },
  ];
  const structuredEvidence = analyzeAlmanacEvidence(structuredData);
  const structuredCandidate = structuredEvidence.candidates[0];

  assert.equal(structuredCandidate.status, baseline.candidates[0].status);
  assert.equal(structuredCandidate.participantRelationFacts[0].status, '未采用');
  assert.match(structuredCandidate.participantRelationFacts[0].promptText, /不自动改变候选分组/);
  assert.deepEqual(structuredCandidate.participantConflicts, []);
  assert.ok(
    structuredCandidate.decisionFact.limitingFactKeys.every(
      (key) => !key.includes(':participant:'),
    ),
  );

  const textData = createLegacyData();
  const textDay = textData.days[0];
  textDay.participantRelationFacts = undefined;
  textDay.participantNotes = ['旧参与人：候选日地支丑害生肖/年支午，需谨慎'];
  const textCandidate = analyzeAlmanacEvidence(textData).candidates[0];

  assert.equal(textCandidate.status, baseline.candidates[0].status);
  assert.equal(textCandidate.participantRelationFacts[0].status, '未采用');
  assert.match(textCandidate.participantRelationFacts[0].promptText, /不自动改变候选分组/);
  assert.deepEqual(textCandidate.participantConflicts, []);
});

test('旧结果中的参与人简单喜忌支持只保留为未采用参考', () => {
  const data = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-01-03',
    endDate: '2026-01-03',
  });
  const day = data.days[0];
  day.participantNotes = ['旧参与人：候选日五行命中喜用火，辅助支持'];
  day.participantRelationFacts = [
    {
      key: `${day.date}:participant:legacy-person:preference`,
      participantId: 'legacy-person',
      participantName: '旧参与人',
      scope: '候选日',
      basis: '整体',
      candidateValue: day.ganzhi.day,
      participantValues: ['火'],
      relation: '命中喜用',
      status: '支持',
      promptText: '旧参与人：候选日五行命中喜用火，辅助支持',
      sources: ['旧结果'],
      limitation: '旧结果',
    },
  ];

  const candidate = analyzeAlmanacEvidence(data).candidates[0];

  assert.equal(candidate.participantRelationFacts[0].status, '未采用');
  assert.match(candidate.participantRelationFacts[0].promptText, /仅保留原说明供核对/);
  assert.deepEqual(candidate.participantSupport, []);
  assert.ok(
    candidate.decisionFact.supportingFactKeys.every((key) => !key.includes(':participant:')),
  );
  assert.equal(
    candidate.decisionFact.steps.find((step) => step.stage === '参与人关系')?.status,
    '通过',
  );
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
    hour.topicMatchFacts = undefined;
    hour.participantRelationFacts = undefined;
  }

  const evidence = analyzeAlmanacEvidence(result);
  const candidate = evidence.candidates[0];
  assert.ok(candidate.topicMatchFacts.every((item) => item.key.includes(':legacy-topic:')));
  assert.ok(candidate.godFacts.every((item) => item.key.includes(':legacy-god:')));
  assert.ok(candidate.godFacts.every((item) => item.classification === '未分级'));
  assert.ok(candidate.godFacts.every((item) => /未保存原生吉凶分类/.test(item.promptText)));
  assert.ok(
    candidate.topicMatchFacts.every((item) =>
      item.sources.some((source) => source.includes('未保存原始关键词匹配参数')),
    ),
  );
  assert.ok(
    candidate.usableHours.every((hour) =>
      hour.topicMatchFacts.every((item) => item.key.includes(':legacy-topic:')),
    ),
  );
});

test('旧结果中的已删除建除与神煞事项硬规则不得继续改变候选分类', () => {
  const legacyTextData = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
  });
  const legacyTextDay = legacyTextData.days[0];
  legacyTextDay.topicMatchFacts = undefined;
  legacyTextDay.highlights = ['事项规则支持执日闭', '执日闭宜自定义事项'];
  legacyTextDay.cautions = [
    '事项规则限制执日闭',
    '事项规则触及忌神游祸',
    '执日闭宜收敛修补安床，忌出行动土移徙',
  ];

  const legacyTextEvidence = analyzeAlmanacEvidence(legacyTextData);
  const legacyTextCandidate = legacyTextEvidence.candidates[0];
  assert.equal(legacyTextCandidate.status, '可用候选');
  assert.equal(legacyTextCandidate.topicMatchFacts.length, 0);
  assert.doesNotMatch(
    [
      ...legacyTextCandidate.traditionalSupport,
      ...legacyTextCandidate.traditionalConstraints,
      legacyTextCandidate.decisionFact.promptText,
      legacyTextEvidence.promptText,
    ].join('；'),
    /事项规则(?:支持|限制)执日|事项规则(?:命中喜神|触及忌神)|执日闭/,
  );

  const legacyFactData = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
  });
  const legacyFactDay = legacyFactData.days[0];
  legacyFactDay.cautions = [];
  legacyFactDay.topicMatchFacts = [
    ...(legacyFactDay.topicMatchFacts ?? []),
    {
      key: '2026-01-01:topic:rule-day-officer',
      scope: '候选日',
      topic: 'custom',
      topicLabel: '自定义事项',
      sourceType: '建除值日',
      status: '限制',
      inputItems: ['闭'],
      keywords: ['闭'],
      matchedItems: ['闭'],
      promptText: '事项规则限制执日闭',
      sources: ['旧事项硬规则表'],
      limitation: '旧结果兼容样本',
    },
  ];

  const legacyFactCandidate = analyzeAlmanacEvidence(legacyFactData).candidates[0];
  assert.equal(legacyFactCandidate.status, '可用候选');
  assert.ok(
    legacyFactCandidate.topicMatchFacts.every(
      (fact) => fact.sourceType !== '建除值日' && !fact.key.includes(':topic:rule-'),
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
  assert.ok(candidateTraditionalFacts.some((item) => /原生吉凶属性/.test(item.originalText)));
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
  assert.match(promptText, /不据此判断生育结果/);
  assert.match(promptText, /后半句属于传统警语，不作为现实后果保证/);
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
    [
      '壬日传统上避汲水；后半句属于传统警语，不作为现实后果保证',
      '申日传统上避安床；后半句属于传统警语，不作为现实后果保证',
    ],
  );
  assert.doesNotMatch(evidence.promptText, /鬼祟入房|更难提防/);
});

test('择日公开证据不得暴露内部加分措辞', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-10',
  });

  assert.doesNotMatch(result.evidenceAnalysis?.promptText ?? '', /辅助加分|加\d+分|扣\d+分/);
  assert.ok(result.days.every((day) => day.highlights.every((item) => !item.includes('辅助支持'))));
});
