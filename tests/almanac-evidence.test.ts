import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeAlmanacEvidence,
  conditionAlmanacTraditionalText,
  generateAlmanacSelection,
} from 'mingyu-core/divination/almanac';

test('黄历择日应内置透明约束与候选证据', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
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
  assert.equal(evidence.summaryFact.visibleCandidateCount, Math.min(evidence.candidates.length, 8));
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
  assert.match(evidence.promptText, /计算链：[\s\S]*反证汇总：[\s\S]*证据汇总：[\s\S]*解释限制：/);
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
        item.promptText.includes(item.ganzhi) &&
        item.sources.length >= 2 &&
        Array.isArray(item.participantRelationFacts) &&
        item.limitation.includes('不证明该时辰必然成功') &&
        !('rawTabooFact' in item) &&
        !('recommends' in item) &&
        !('avoids' in item),
    ),
  );
  assert.match(result.evidenceAnalysis?.promptText ?? '', /原始宜项/);
  assert.match(result.evidenceAnalysis?.promptText ?? '', /逐时时课|时段/);
  assert.doesNotMatch(
    JSON.stringify(result.evidenceAnalysis?.evidence),
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d/,
  );
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
