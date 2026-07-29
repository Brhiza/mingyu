import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFortuneTriggers } from '@core/bazi/fortuneTriggerEvidence';
import type { BaziChartResult } from '@core/bazi/baziTypes';

function createResult(): BaziChartResult {
  return {
    pillars: {
      year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
      day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    },
    dayMaster: { gan: '庚' },
    analysis: {
      usefulGod: {
        favorableWuxing: ['木', '火'],
        unfavorableWuxing: ['金'],
      },
    },
  } as BaziChartResult;
}

function assertEvidenceReferences(result: ReturnType<typeof analyzeFortuneTriggers>) {
  const factKeys = new Set([
    result.relationSummaryFact.key,
    ...result.calculationSteps.map((item) => item.key),
    ...result.layers.map((item) => item.key),
    ...result.layerStructureFacts.map((item) => item.key),
    ...result.hiddenStemRevealFacts.map((item) => item.key),
    ...result.relations.map((item) => item.key),
    ...result.formations.map((item) => item.key),
    ...result.counterEvidenceFacts.map((item) => item.key),
  ]);
  assert.ok(result.relationSummaryFact.factKeys.length > 0);
  assert.ok(result.relationSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    result.counterEvidenceFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(
    result.limitationFacts.every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
}

test('岁运触发证据应逐层保留原局、大运和流年关系来源', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'dayun', type: 'dayun', label: '甲午大运', ganZhi: '甲午' },
    { id: 'year', type: 'year', label: '甲午流年', ganZhi: '甲午' },
  ]);

  assert.equal(result.layers.length, 6);
  assert.equal(result.key, 'bazi:fortune-trigger:evidence');
  assert.equal(result.status, '已计算');
  assert.ok(result.layers.every((item) => item.key && item.status === '已计算'));
  assert.ok(result.calculationSteps.length > result.layers.length);
  assert.ok(
    result.calculationSteps.every((step) =>
      step.dependsOnStepKeys.every((key) =>
        result.calculationSteps.some((candidate) => candidate.key === key),
      ),
    ),
  );
  assert.ok(
    result.relations.some(
      (item) =>
        item.type === 'suiyun-binglin' && item.source.id === 'year' && item.target.id === 'dayun',
    ),
  );
  assert.ok(
    result.relations.some(
      (item) =>
        item.type === 'branch-clash' &&
        item.source.id === 'year' &&
        item.target.id === 'natal-year',
    ),
  );
  assert.ok(
    result.relations.every(
      (item) =>
        item.key &&
        item.status === '已命中' &&
        item.sourceLayerKey === item.source.key &&
        item.targetLayerKey === item.target.key &&
        result.calculationSteps.some((step) => step.key === item.calculationStepKey),
    ),
  );
  assert.equal(result.relationSummaryFact.relationCount, result.relations.length);
  assert.equal(result.relationSummaryFact.comparedPairCount, 9);
  assert.equal(
    result.primaryRelations.length + result.supportingRelations.length,
    result.relations.length,
  );
  assertEvidenceReferences(result);
  assert.match(result.promptText, /【八字岁运触发结构化证据】/);
  assert.match(result.promptText, /岁运并临/);
  assert.match(result.promptText, /只表示干支关系成立及其所在时间层级/);
  assert.match(result.promptText, /岁运层级与应期边界/);
});

test('岁运证据应把天干、地支主五行与全部藏干分层并只列喜忌候选', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'dayun', type: 'dayun', label: '丁亥大运', ganZhi: '丁亥' },
  ]);
  const fact = result.layerStructureFacts[0];

  assert.ok(fact);
  assert.equal(fact.layerType, 'dayun');
  assert.deepEqual(fact.stem, {
    symbol: '丁',
    wuxing: '火',
    tenGod: '正官',
    directPreference: '喜用五行直接对应候选',
  });
  assert.equal(fact.branch.symbol, '亥');
  assert.equal(fact.branch.wuxing, '水');
  assert.equal(fact.branch.mainHiddenStem.symbol, '壬');
  assert.deepEqual(
    fact.branch.hiddenStems.map((item) => [item.rank, item.symbol, item.tenGod]),
    [
      ['本气', '壬', '食神'],
      ['中气', '甲', '偏财'],
    ],
  );
  assert.equal(fact.branch.hiddenStems[1]?.directPreference, '喜用五行直接对应候选');
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '喜忌候选边界' && item.promptText.includes('似喜实忌'),
    ),
  );
  assert.match(result.promptText, /岁运干支分层与喜忌候选/);
  assert.doesNotMatch(result.promptText, /判定为喜运|判定为忌运/);
});

test('同一运柱的运干与运支应分别保留十神和原局关系，不得机械等价', () => {
  const natal = createResult();
  natal.pillars.month = { gan: '壬', zhi: '子', ganZhi: '壬子' };
  natal.pillars.day = { gan: '丙', zhi: '寅', ganZhi: '丙寅' };
  natal.dayMaster = { gan: '丙' } as BaziChartResult['dayMaster'];
  natal.analysis.usefulGod.favorableWuxing = ['火'];
  natal.analysis.usefulGod.unfavorableWuxing = ['水'];

  const result = analyzeFortuneTriggers(natal, [
    { id: 'dayun', type: 'dayun', label: '丙午大运', ganZhi: '丙午' },
  ]);
  const fact = result.layerStructureFacts[0];

  assert.equal(fact?.stem.tenGod, '比肩');
  assert.deepEqual(
    fact?.branch.hiddenStems.map((item) => [item.symbol, item.tenGod]),
    [
      ['丁', '劫财'],
      ['己', '伤官'],
    ],
  );
  assert.ok(
    result.relations.some(
      (item) => item.type === 'branch-clash' && item.target.id === 'natal-month',
    ),
  );
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '干支分看边界' && item.promptText.includes('不得机械视为'),
    ),
  );
});

test('藏干与明透天干同字时只记录透出对应候选，不直接认定透清或成格变格', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'dayun', type: 'dayun', label: '丁亥大运', ganZhi: '丁亥' },
  ]);
  const reveal = result.hiddenStemRevealFacts.find(
    (item) => item.branchLayerKey.endsWith(':dayun:dayun') && item.hiddenStem === '甲',
  );

  assert.ok(reveal);
  assert.equal(reveal.hiddenStemRank, '中气');
  assert.ok(reveal.visibleLayerKeys.some((key) => key.endsWith(':natal:natal-year')));
  assert.match(reveal.limitation, /是否透清/);
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '成格变格边界' && item.promptText.includes('不得直接认定'),
    ),
  );
  assert.doesNotMatch(result.promptText, /已经透清|已经成格|已经变格/);
});

test('岁运触发证据应识别天克地冲但不直接给出吉凶', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'year', type: 'year', label: '庚午流年', ganZhi: '庚午' },
  ]);
  const relation = result.relations.find(
    (item) => item.type === 'tianke-dichong' && item.target.id === 'natal-year',
  );

  assert.ok(relation);
  assert.equal(relation.stemRelation, 'clash');
  assert.equal(relation.branchRelation, 'clash');
  assert.match(relation.interpretationLimit, /不单独决定吉凶/);
  assert.equal(relation.status, '已命中');
  assert.ok(relation.key.startsWith('bazi:fortune-trigger:relation:tianke-dichong:'));
  assert.doesNotMatch(result.promptText, /判定为凶|匹配总分：/);
});

test('岁运触发证据应把未见主要关系保留为反证但不否定较弱触发', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'year', type: 'year', label: '乙巳流年', ganZhi: '乙巳' },
  ]);

  assert.equal(result.counterEvidenceFacts.length, 4);
  assert.ok(result.counterEvidenceFacts.every((item) => item.status === '未见主要关系'));
  assert.equal(result.relationSummaryFact.noMajorRelationPairCount, 4);
  assert.ok(result.relationSummaryFact.supportingRelationCount > 0);
  assert.match(result.counterEvidence.join('\n'), /未见主要关系不等于没有较弱触发或必然平稳/);
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '层级应期边界' && item.promptText.includes('不得补造'),
    ),
  );
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '高风险输出边界' && item.promptText.includes('不得按关系数量'),
    ),
  );
  assertEvidenceReferences(result);
  assert.doesNotMatch(result.promptText, /判定平稳|匹配总分：|成功率：\d|灾祸概率：\d/);
});

test('岁运触发证据在没有所选岁运层级时应明确返回无可比较层级', () => {
  const result = analyzeFortuneTriggers(createResult(), []);

  assert.equal(result.status, '无可比较层级');
  assert.equal(result.relations.length, 0);
  assert.equal(result.counterEvidenceFacts.length, 0);
  assert.equal(result.relationSummaryFact.status, '无可比较层级');
  assert.equal(result.relationSummaryFact.comparedPairCount, 0);
  assertEvidenceReferences(result);
  assert.match(result.promptText, /没有可供逐层比对的原局与岁运层级/);
});

test('岁运触发完整层级应保留详细对象但压缩可复制提示词', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'dayun', type: 'dayun', label: '甲午大运', ganZhi: '甲午' },
    { id: 'year', type: 'year', label: '乙巳流年', ganZhi: '乙巳' },
    { id: 'month', type: 'month', label: '丙辰流月', ganZhi: '丙辰' },
    { id: 'day', type: 'day', label: '丁卯流日', ganZhi: '丁卯' },
  ]);

  assert.equal(result.relationSummaryFact.comparedPairCount, 22);
  assert.equal(result.calculationSteps.filter((item) => item.stage === '层级关系比对').length, 22);
  assert.ok(result.counterEvidenceFacts.length === 22);
  assert.ok(result.promptText.length < 8000);
  assert.match(result.promptText, /计算链概览/);
  assert.doesNotMatch(result.promptText, /bazi:fortune-trigger:|本模块|本引擎|内部配置/);
});

test('岁运触发证据应拒绝非法干支，避免生成伪证据', () => {
  assert.throws(
    () =>
      analyzeFortuneTriggers(createResult(), [
        { id: 'year', type: 'year', label: '错误流年', ganZhi: '甲甲' },
      ]),
    /岁运干支地支无效/,
  );
});

test('流年补齐原局缺支时应记录完整三合结构', () => {
  const result = analyzeFortuneTriggers(createResult(), [
    { id: 'year', type: 'year', label: '甲辰流年', ganZhi: '甲辰' },
  ]);
  const formation = result.formations.find((item) => item.type === 'branch-sanhe');

  assert.ok(formation);
  assert.equal(formation.group, '水局');
  assert.deepEqual(formation.branches, ['申', '子', '辰']);
  assert.equal(formation.triggerLayerKeys.length, 1);
  assert.match(formation.label, /甲辰流年补全申子辰三合水局/);
  assert.match(formation.interpretationLimit, /不等于已经成化/);
  assert.equal(result.relationSummaryFact.formationCount, 1);
  assertEvidenceReferences(result);
});

test('多个岁运层级共同补齐时应记录完整三会结构', () => {
  const natal = createResult();
  natal.pillars = {
    year: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    month: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '丁', zhi: '酉', ganZhi: '丁酉' },
  };
  const result = analyzeFortuneTriggers(natal, [
    { id: 'dayun', type: 'dayun', label: '乙卯大运', ganZhi: '乙卯' },
    { id: 'year', type: 'year', label: '庚辰流年', ganZhi: '庚辰' },
  ]);
  const formation = result.formations.find(
    (item) => item.type === 'branch-sanhui' && item.group === '东方木',
  );

  assert.ok(formation);
  assert.deepEqual(formation.triggerLayerKeys, [
    'bazi:fortune-trigger:layer:dayun:dayun',
    'bazi:fortune-trigger:layer:year:year',
  ]);
  assert.match(formation.label, /乙卯大运、庚辰流年共同补全寅卯辰东方木三会/);
  assertEvidenceReferences(result);
});

test('原局已经完整成局时不应重复报告为岁运补全', () => {
  const natal = createResult();
  natal.pillars.month = { gan: '戊', zhi: '辰', ganZhi: '戊辰' };
  const result = analyzeFortuneTriggers(natal, [
    { id: 'year', type: 'year', label: '乙巳流年', ganZhi: '乙巳' },
  ]);

  assert.equal(
    result.formations.some((item) => item.type === 'branch-sanhe' && item.group === '水局'),
    false,
  );
  assert.equal(result.relationSummaryFact.formationCount, 0);
  assertEvidenceReferences(result);
});
