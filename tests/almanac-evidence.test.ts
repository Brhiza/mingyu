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
  assert.doesNotMatch(evidence.promptText, /评分[：=]?\d|\d+分|成功率[：=]?\d|匹配率[：=]?\d/);
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

test('择日证据应让明确事项忌项覆盖内部排序', () => {
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
  assert.ok(
    evidence.traditionalFacts.some((item) => /主疾病|必见灾殃|大凶/.test(item.originalText)),
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
  assert.ok(result.days.some((day) => day.highlights.some((item) => item.includes('辅助支持'))));
});
