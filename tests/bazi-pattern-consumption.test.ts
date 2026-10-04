import assert from 'node:assert/strict';
import test from 'node:test';
import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter';
import { analyzeBaziNatalEvidence } from '../packages/core/src/bazi/natalEvidence';
import { buildBaziPrompt, formatBaziPatternConditions } from '../packages/core/src/prompt/bazi';
import { formatBaziSchoolPrompt } from '../packages/core/src/prompt/bazi-school';
import { analyzePillarRelations } from '../packages/core/src/bazi/baziPromptEnhancement';
import type { PatternFulfillmentResult } from '../packages/core/src/bazi/baziPatternFulfillment';

let repeatedSeed: ReturnType<typeof baziCalculator.calculateBazi> | undefined;

function seed() {
  return structuredClone(
    (repeatedSeed ??= baziCalculator.calculateBazi({
      year: 2000,
      month: 1,
      day: 7,
      timeIndex: 5,
      gender: 'male',
    })),
  );
}

for (const status of ['成格', '破格', '破而复成', '平常', '未判定'] as const) {
  test(`格局${status}经本命证据和各解读入口保留原始裁决`, () => {
    const result = seed();
    const fulfillment: PatternFulfillmentResult = {
      patternName: '正官格',
      status,
      basis: '按所选普通格局条件核验',
      decisionDetail: '格神与救应条件已分别核验，成败按本次有效路径裁决',
      contradiction: '官伤并见，须区分有效制化',
      remedies: [],
      summary: '成败与格局名称分别记录',
      conditions: ['制化来源与作用对象保持有效'],
      conditionFacts: [{ key: 'control', status: '不满足', detail: '制化来源缺少有效根气' }],
      pathEvaluations: [
        {
          key: '印护官',
          label: '印护官',
          status: '不满足',
          source: [],
          target: [],
          sourceStems: [],
          targetStems: [],
          position: '未判定',
          positionPairs: [],
          detail: '所需制化路径尚未成立',
        },
      ],
    };
    result.analysis.mingGe = { pattern: '正官格', isSpecial: false, fulfillment };
    const evidence = analyzeBaziNatalEvidence(result);
    const fact = evidence.analysisFacts.find((item) => item.type === '格局');
    assert.deepEqual(fact?.patternFulfillment, fulfillment);
    assert.ok(fact?.promptText.includes(fulfillment.contradiction));
    const decisive = `当前成败判定：${status}`;
    for (const text of [
      fact?.promptText ?? '',
      formatBaziForPrompt(result),
      buildBaziPrompt({ result }),
      ...(['ziping', 'mangpai', 'xinpai'] as const).map((school) =>
        formatBaziSchoolPrompt(result, school),
      ),
    ]) {
      assert.ok(text.includes(decisive), '格局名称不能替代成败判定');
      assert.ok(text.includes(fulfillment.decisionDetail!), '通用规则不能替代本次裁决理由');
    }
    const supplemental = formatBaziPatternConditions(result);
    assert.equal(supplemental, '', '格神前提未成立时不展开模拟的未满足条件');
    for (const school of ['ziping', 'mangpai', 'xinpai'] as const) {
      const text = formatBaziSchoolPrompt(result, school);
      assert.doesNotMatch(text, /条件核验：|制化路径：|格局条件：|候选取用：/);
    }
    assert.deepEqual(
      result.analysis.mingGe.fulfillment,
      fulfillment,
      '格式化不能重判或改写核心裁决',
    );
  });
}

test('制化条件变化后所有消费者反映新状态而不是沿用成格名称', () => {
  const result = seed();
  result.analysis.mingGe = {
    pattern: '正官格',
    isSpecial: false,
    fulfillment: {
      patternName: '正官格',
      status: '成格',
      basis: '必要条件满足',
      contradiction: '',
      remedies: [],
      summary: '',
    },
  };
  assert.match(formatBaziSchoolPrompt(result, 'ziping'), /当前成败判定：成格/);
  result.analysis.mingGe.fulfillment!.status = '破格';
  result.analysis.mingGe.fulfillment!.basis = '原必要条件失效';
  const evidence = analyzeBaziNatalEvidence(result);
  const text = evidence.analysisFacts.find((item) => item.type === '格局')?.promptText ?? '';
  assert.match(text, /当前成败判定：破格/);
  assert.doesNotMatch(text, /当前成败判定：成格/);
  assert.match(formatBaziForPrompt(result), /当前成败判定：破格/);
});

test('在线提示词与本命证据从四柱重算关系，不沿用旧排盘的重复或错误关系', () => {
  const result = seed();
  const expected = analyzePillarRelations(result);
  const relation = Object.values(expected).flat()[0];
  assert.ok(relation);
  result.pillarRelations = {
    fuxin: ['伪造的原局关系', '伪造的原局关系'],
    fanyin: [],
    sameStem: [],
    sameBranch: [],
    xingChong: [],
  };

  const prompt = formatBaziForPrompt(result);
  const schoolPrompt = formatBaziSchoolPrompt(result, 'mangpai');
  const evidence = analyzeBaziNatalEvidence(result);
  for (const text of [
    prompt,
    schoolPrompt,
    ...evidence.relationFacts.map((fact) => fact.promptText),
  ]) {
    assert.doesNotMatch(text, /伪造的原局关系/);
  }
  assert.ok(prompt.includes(relation));
  assert.ok(schoolPrompt.includes(relation));
  assert.ok(evidence.relationFacts.some((fact) => fact.relation === relation));
});

test('本命格局提示证据省略已写入成败理由的重复条件并保留独立盘面依据', () => {
  const result = baziCalculator.calculateBazi({
    year: 2013,
    month: 9,
    day: 25,
    timeIndex: 3,
    gender: 'male',
  });
  const pattern = result.analysis.mingGe;
  const fact = analyzeBaziNatalEvidence(result).analysisFacts.find((item) => item.type === '格局');
  const pathDetail = pattern.fulfillment?.pathEvaluations?.find(
    (item) => item.label === '印星制伤官护官',
  )?.detail;

  assert.ok(fact);
  assert.ok(pathDetail);
  assert.match(fact.promptText, /当前成败判定：破格；判定理由：/);
  assert.equal(fact.promptText.split(pathDetail).length - 1, 1);
  assert.match(fact.promptText, /条件核验：满足；伤官见官可用项：时柱透干丁/);
  assert.doesNotMatch(fact.promptText, /格局条件：|候选取用：/);

  const evidenceDetail = result.evidenceAnalysis?.evidence.items.find(
    (item) => item.title === '格局事实',
  )?.detail;
  assert.equal(evidenceDetail?.split(pathDetail).length - 1, 1);
});
