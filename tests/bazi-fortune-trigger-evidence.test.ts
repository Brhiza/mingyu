import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFortuneTriggers } from '@core/bazi/fortuneTriggerEvidence';
import type { BaziChartResult, Pillars } from '@core/bazi/baziTypes';

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
    ...result.officerPatternRuleFacts.map((item) => item.key),
    ...result.wealthPatternRuleFacts.map((item) => item.key),
    ...result.resourcePatternRuleFacts.map((item) => item.key),
    ...result.foodPatternRuleFacts.map((item) => item.key),
    ...result.killerPatternRuleFacts.map((item) => item.key),
    ...result.hurtPatternRuleFacts.map((item) => item.key),
    ...result.bladePatternRuleFacts.map((item) => item.key),
    ...result.luPatternRuleFacts.map((item) => item.key),
    ...result.miscPatternRuleFacts.map((item) => item.key),
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

function createOfficerResult(pillars: Pillars): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern: '正官格', isSpecial: false };
  return result;
}

function createWealthResult(pillars: Pillars): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern: '正财格', isSpecial: false };
  return result;
}

function createResourceResult(pillars: Pillars): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern: '正印格', isSpecial: false };
  return result;
}

function createFoodResult(pillars: Pillars): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern: '食神格', isSpecial: false };
  return result;
}

function createKillerResult(pillars: Pillars): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern: '七杀格', isSpecial: false };
  return result;
}

function createHurtResult(pillars: Pillars): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern: '伤官格', isSpecial: false };
  return result;
}

function createBladeResult(pillars: Pillars): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern: '月刃格', isSpecial: false };
  return result;
}

function createLuResult(
  pillars: Pillars,
  pattern: '建禄格' | '劫财格' = '建禄格',
): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern, isSpecial: false };
  return result;
}

function createMiscResult(pillars: Pillars, pattern = '正印格'): BaziChartResult {
  const result = createResult();
  result.pillars = pillars;
  result.dayMaster = { gan: pillars.day.gan } as BaziChartResult['dayMaster'];
  result.analysis.mingGe = { pattern, isSpecial: pattern.startsWith('从') };
  return result;
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

test('正官取运应记录官星逢合、复露七杀、重官及运支刑冲月令候选', () => {
  const natal = createOfficerResult({
    year: { gan: '辛', zhi: '卯', ganZhi: '辛卯' },
    month: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'combine', type: 'dayun', label: '丙午大运', ganZhi: '丙午' },
    { id: 'killer', type: 'year', label: '庚寅流年', ganZhi: '庚寅' },
    { id: 'officer', type: 'month', label: '辛卯流月', ganZhi: '辛卯' },
  ]);

  assert.ok(result.officerPatternRuleFacts.some((item) => item.type === '官星逢合候选'));
  assert.ok(result.officerPatternRuleFacts.some((item) => item.type === '七杀复露候选'));
  assert.ok(result.officerPatternRuleFacts.some((item) => item.type === '正官重露候选'));
  assert.ok(
    result.officerPatternRuleFacts.some(
      (item) => item.type === '正官月令刑冲候选' && item.trigger.includes('相冲'),
    ),
  );
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '正官取运边界' && item.promptText.includes('不可拘泥'),
    ),
  );
  assertEvidenceReferences(result);
  assert.doesNotMatch(result.promptText, /认定已经合化|判定为最终喜运|判定为最终忌运/);
});

test('正官用财与佩印并见时应保留相反候选并等待全局取舍', () => {
  const natal = createOfficerResult({
    year: { gan: '甲', zhi: '申', ganZhi: '甲申' },
    month: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'dayun', type: 'dayun', label: '丁亥大运', ganZhi: '丁亥' },
  ]);
  const outputFacts = result.officerPatternRuleFacts.filter((item) =>
    item.trigger.includes('运干丁伤官'),
  );

  assert.ok(
    outputFacts.some((item) => item.type === '正官用财取运候选' && item.status === '带忌候选'),
  );
  assert.ok(
    outputFacts.some((item) => item.type === '正官佩印取运候选' && item.status === '支持候选'),
  );
  assert.ok(
    result.officerPatternRuleFacts.some(
      (item) =>
        item.type === '正官用财印取运候选' &&
        item.status === '条件待复核' &&
        item.trigger.includes('身稍轻'),
    ),
  );
  assert.match(result.promptText, /多个子结构候选相反时须保留冲突/);
  assert.doesNotMatch(result.promptText, /匹配总分|成功率|判定为喜运|判定为忌运/);
});

test('正官带伤食用印遇财时应区分一般带忌与印绶叠出例外', () => {
  const natal = createOfficerResult({
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    hour: { gan: '丙', zhi: '辰', ganZhi: '丙辰' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'dayun', type: 'dayun', label: '壬子大运', ganZhi: '壬子' },
  ]);
  const fact = result.officerPatternRuleFacts.find(
    (item) => item.type === '带伤食用印取运候选' && item.trigger.includes('印绶两处以上明透'),
  );

  assert.ok(fact);
  assert.equal(fact.status, '条件待复核');
  assert.match(fact.promptText, /印绶叠出，财运无害/);
  assert.doesNotMatch(fact.promptText, /财运必吉|财运无害已定/);
});

test('劫财合杀与伤官合杀应分别套用取运边界', () => {
  const robberyCombined = createOfficerResult({
    year: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
    month: { gan: '乙', zhi: '酉', ganZhi: '乙酉' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  });
  const hurtCombined = createOfficerResult({
    year: { gan: '辛', zhi: '巳', ganZhi: '辛巳' },
    month: { gan: '丙', zhi: '申', ganZhi: '丙申' },
    day: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    hour: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
  });
  const robberyResult = analyzeFortuneTriggers(robberyCombined, [
    { id: 'dayun', type: 'dayun', label: '丁亥大运', ganZhi: '丁亥' },
  ]);
  const hurtResult = analyzeFortuneTriggers(hurtCombined, [
    { id: 'dayun', type: 'dayun', label: '壬午大运', ganZhi: '壬午' },
  ]);

  assert.ok(
    robberyResult.officerPatternRuleFacts.some(
      (item) =>
        item.type === '劫财合杀取运候选' &&
        item.trigger.includes('可行印运') &&
        item.trigger.includes('复露七杀'),
    ),
  );
  assert.ok(
    hurtResult.officerPatternRuleFacts.some(
      (item) => item.type === '伤官合杀取运候选' && item.status === '带忌候选',
    ),
  );
  assert.ok(
    hurtResult.officerPatternRuleFacts.some(
      (item) => item.type === '伤官合杀取运候选' && item.status === '支持候选',
    ),
  );
});

test('财生官应保留一般忌杀伤与后透印、带食例外的相反候选', () => {
  const postResource = createWealthResult({
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
  });
  const withFood = createWealthResult({
    year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    month: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
  });
  const hurtResult = analyzeFortuneTriggers(postResource, [
    { id: 'hurt', type: 'dayun', label: '癸酉大运', ganZhi: '癸酉' },
  ]);
  const killerResult = analyzeFortuneTriggers(withFood, [
    { id: 'killer', type: 'dayun', label: '丙寅大运', ganZhi: '丙寅' },
  ]);

  assert.ok(
    hurtResult.wealthPatternRuleFacts.some(
      (item) => item.type === '财旺生官取运候选' && item.status === '带忌候选',
    ),
  );
  assert.ok(
    hurtResult.wealthPatternRuleFacts.some(
      (item) => item.type === '财官后透印取运候选' && item.status === '条件待复核',
    ),
  );
  assert.ok(
    killerResult.wealthPatternRuleFacts.some(
      (item) => item.type === '财旺生官取运候选' && item.status === '带忌候选',
    ),
  );
  assert.ok(
    killerResult.wealthPatternRuleFacts.some(
      (item) => item.type === '财生官带食取运候选' && item.status === '条件待复核',
    ),
  );
  assert.match(killerResult.promptText, /多个子结构候选相反时须全部保留/);
});

test('财用食生应分别保留助身、财食、杀不忌及官印反晦边界', () => {
  const natal = createWealthResult({
    year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    month: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'peer', type: 'dayun', label: '庚申大运', ganZhi: '庚申' },
    { id: 'wealth', type: 'year', label: '甲子流年', ganZhi: '甲子' },
    { id: 'food', type: 'month', label: '壬申流月', ganZhi: '壬申' },
    { id: 'killer', type: 'day', label: '丙寅流日', ganZhi: '丙寅' },
    { id: 'officer', type: 'hour', label: '丁卯流时', ganZhi: '丁卯' },
    { id: 'resource', type: 'year', label: '己丑流年', ganZhi: '己丑' },
  ]);
  const facts = result.wealthPatternRuleFacts.filter((item) => item.type === '财用食生取运候选');

  assert.ok(facts.some((item) => item.trigger.includes('财食重而身轻')));
  assert.ok(facts.some((item) => item.trigger.includes('财食轻而身重')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('杀不忌')));
  assert.ok(
    facts.some(
      (item) => item.status === '带忌候选' && item.trigger.includes('印不得在此结构中机械归入助身'),
    ),
  );
});

test('财格佩印与财用食印应按官杀和强弱条件分别列候选', () => {
  const equippedResource = createWealthResult({
    year: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
  });
  const separatedFoodResource = createWealthResult({
    year: { gan: '壬', zhi: '申', ganZhi: '壬申' },
    month: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
  });
  const equippedResult = analyzeFortuneTriggers(equippedResource, [
    { id: 'officer', type: 'dayun', label: '丁卯大运', ganZhi: '丁卯' },
    { id: 'resource', type: 'year', label: '己丑流年', ganZhi: '己丑' },
  ]);
  const separatedResult = analyzeFortuneTriggers(separatedFoodResource, [
    { id: 'wealth', type: 'dayun', label: '甲子大运', ganZhi: '甲子' },
    { id: 'food', type: 'year', label: '壬申流年', ganZhi: '壬申' },
    { id: 'peer', type: 'month', label: '庚申流月', ganZhi: '庚申' },
    { id: 'resource', type: 'day', label: '己丑流日', ganZhi: '己丑' },
    { id: 'officer', type: 'hour', label: '丁卯流时', ganZhi: '丁卯' },
    { id: 'killer', type: 'year', label: '丙寅流年', ganZhi: '丙寅' },
  ]);

  assert.ok(
    equippedResult.wealthPatternRuleFacts.some(
      (item) => item.type === '财格佩印取运候选' && item.status === '支持候选',
    ),
  );
  assert.ok(
    equippedResult.wealthPatternRuleFacts.some(
      (item) => item.type === '财格佩印取运候选' && item.trigger.includes('身弱且印旺'),
    ),
  );
  const foodResourceFacts = separatedResult.wealthPatternRuleFacts.filter(
    (item) => item.type === '财用食印取运候选',
  );
  assert.ok(foodResourceFacts.some((item) => item.trigger.includes('财轻')));
  assert.ok(foodResourceFacts.some((item) => item.trigger.includes('身轻')));
  assert.ok(foodResourceFacts.some((item) => item.status === '带忌候选'));
  assert.ok(foodResourceFacts.some((item) => item.status === '支持候选'));
});

test('财带伤官应列财运支持以及杀官印带忌候选', () => {
  const natal = createWealthResult({
    year: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    month: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'wealth', type: 'dayun', label: '甲子大运', ganZhi: '甲子' },
    { id: 'killer', type: 'year', label: '丙寅流年', ganZhi: '丙寅' },
    { id: 'officer', type: 'month', label: '丁卯流月', ganZhi: '丁卯' },
    { id: 'resource', type: 'day', label: '己丑流日', ganZhi: '己丑' },
  ]);
  const facts = result.wealthPatternRuleFacts.filter((item) => item.type === '财带伤官取运候选');

  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('财运可取')));
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('杀运不利')));
});

test('财带七杀不论合杀、食制或尚未取清均应保留食伤方向候选', () => {
  const charts = [
    createWealthResult({
      year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      month: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      hour: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    }),
    createWealthResult({
      year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      month: { gan: '辛', zhi: '巳', ganZhi: '辛巳' },
      day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      hour: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    }),
    createWealthResult({
      year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
      month: { gan: '壬', zhi: '申', ganZhi: '壬申' },
      day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      hour: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    }),
  ];

  charts.forEach((chart, index) => {
    const result = analyzeFortuneTriggers(chart, [
      { id: `output-${index}`, type: 'dayun', label: '壬申大运', ganZhi: '壬申' },
    ]);
    assert.ok(
      result.wealthPatternRuleFacts.some(
        (item) => item.type === '财带七杀取运候选' && item.status === '支持候选',
      ),
    );
  });
});

test('财用杀印应把印旺留待复核、财列带忌且不把伤食任意宣称为喜运', () => {
  const natal = createWealthResult({
    year: { gan: '己', zhi: '丑', ganZhi: '己丑' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'resource', type: 'dayun', label: '己丑大运', ganZhi: '己丑' },
    { id: 'wealth', type: 'year', label: '甲子流年', ganZhi: '甲子' },
    { id: 'output', type: 'month', label: '壬申流月', ganZhi: '壬申' },
  ]);
  const facts = result.wealthPatternRuleFacts.filter((item) => item.type === '财用杀印取运候选');

  assert.ok(facts.some((item) => item.trigger.includes('单个印星运字不直接证明印旺')));
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('逢财所忌')));
  assert.ok(
    facts.some((item) => item.status === '条件待复核' && item.trigger.includes('不宣称为喜运')),
  );
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '财格取运边界' && item.promptText.includes('不可拘泥'),
    ),
  );
  assertEvidenceReferences(result);
  assert.doesNotMatch(
    result.promptText,
    /判定为最终喜运|判定为最终忌运|匹配总分：|财富概率：\d|婚姻事件必然|成功率：\d/,
  );
});

test('印用官应把印重条件留待全局复核，带伤食时另按官印食杀分列', () => {
  const officerOnly = createResourceResult({
    year: { gan: '辛', zhi: '卯', ganZhi: '辛卯' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  });
  const withOutput = createResourceResult({
    year: { gan: '辛', zhi: '巳', ganZhi: '辛巳' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
  });
  const officerOnlyResult = analyzeFortuneTriggers(officerOnly, [
    { id: 'wealth', type: 'dayun', label: '戊辰大运', ganZhi: '戊辰' },
    { id: 'output', type: 'year', label: '丙寅流年', ganZhi: '丙寅' },
  ]);
  const withOutputResult = analyzeFortuneTriggers(withOutput, [
    { id: 'officer', type: 'dayun', label: '辛酉大运', ganZhi: '辛酉' },
    { id: 'resource', type: 'year', label: '壬申流年', ganZhi: '壬申' },
    { id: 'output', type: 'month', label: '丙寅流月', ganZhi: '丙寅' },
    { id: 'killer', type: 'day', label: '庚申流日', ganZhi: '庚申' },
  ]);

  const officerFacts = officerOnlyResult.resourcePatternRuleFacts.filter(
    (item) => item.type === '印用官取运候选',
  );
  assert.ok(officerFacts.some((item) => item.trigger.includes('官露印重')));
  assert.ok(officerFacts.every((item) => item.status === '条件待复核'));
  const withOutputFacts = withOutputResult.resourcePatternRuleFacts.filter(
    (item) => item.type === '印用官带伤食取运候选',
  );
  assert.ok(withOutputFacts.some((item) => item.status === '条件待复核'));
  assert.ok(withOutputFacts.some((item) => item.status === '支持候选'));
  assert.ok(withOutputFacts.some((item) => item.status === '带忌候选'));
  assert.ok(withOutputFacts.some((item) => item.trigger.includes('逢煞不忌')));
  assertEvidenceReferences(withOutputResult);
});

test('印用伤食应保留一般喜财与印轻忌财的相反边界', () => {
  const natal = createResourceResult({
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'wealth', type: 'dayun', label: '戊辰大运', ganZhi: '戊辰' },
    { id: 'output', type: 'year', label: '丁卯流年', ganZhi: '丁卯' },
    { id: 'officer', type: 'month', label: '辛酉流月', ganZhi: '辛酉' },
    { id: 'killer', type: 'day', label: '庚申流日', ganZhi: '庚申' },
  ]);
  const facts = result.resourcePatternRuleFacts.filter((item) => item.type === '印用伤食取运候选');

  assert.ok(
    facts.some((item) => item.status === '支持候选' && item.trigger.includes('一般所喜财运')),
  );
  assert.ok(facts.some((item) => item.status === '条件待复核' && item.trigger.includes('印轻')));
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('官运')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('七杀')));
});

test('印用七杀与杀兼伤食应按原局是否带伤食分别取运', () => {
  const killerOnly = createResourceResult({
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '甲', zhi: '子', ganZhi: '甲子' },
  });
  const withOutput = createResourceResult({
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
  });
  const killerOnlyResult = analyzeFortuneTriggers(killerOnly, [
    { id: 'output', type: 'dayun', label: '丙寅大运', ganZhi: '丙寅' },
    { id: 'peer', type: 'year', label: '甲子流年', ganZhi: '甲子' },
    { id: 'wealth', type: 'month', label: '戊辰流月', ganZhi: '戊辰' },
  ]);
  const withOutputResult = analyzeFortuneTriggers(withOutput, [
    { id: 'peer', type: 'dayun', label: '乙卯大运', ganZhi: '乙卯' },
    { id: 'resource', type: 'year', label: '壬申流年', ganZhi: '壬申' },
    { id: 'output', type: 'month', label: '丁卯流月', ganZhi: '丁卯' },
    { id: 'officer', type: 'day', label: '辛酉流日', ganZhi: '辛酉' },
    { id: 'wealth', type: 'hour', label: '戊辰流时', ganZhi: '戊辰' },
  ]);

  const killerFacts = killerOnlyResult.resourcePatternRuleFacts.filter(
    (item) => item.type === '印用七杀取运候选',
  );
  assert.ok(killerFacts.some((item) => item.status === '支持候选'));
  assert.ok(killerFacts.some((item) => item.status === '条件待复核'));
  assert.ok(killerFacts.some((item) => item.status === '带忌候选'));
  const combinedFacts = withOutputResult.resourcePatternRuleFacts.filter(
    (item) => item.type === '印用杀兼伤食取运候选',
  );
  assert.ok(combinedFacts.some((item) => item.status === '支持候选'));
  assert.ok(combinedFacts.some((item) => item.status === '条件待复核'));
  assert.ok(combinedFacts.some((item) => item.status === '带忌候选'));
});

test('印绶遇财与官杀竞透应保留各自相反候选和强弱边界', () => {
  const wealthNatal = createResourceResult({
    year: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
  });
  const mixedNatal = createResourceResult({
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    hour: { gan: '庚', zhi: '午', ganZhi: '庚午' },
  });
  const wealthResult = analyzeFortuneTriggers(wealthNatal, [
    { id: 'robbery', type: 'dayun', label: '乙卯大运', ganZhi: '乙卯' },
    { id: 'officer', type: 'year', label: '辛酉流年', ganZhi: '辛酉' },
    { id: 'resource', type: 'month', label: '癸酉流月', ganZhi: '癸酉' },
    { id: 'wealth', type: 'day', label: '戊辰流日', ganZhi: '戊辰' },
  ]);
  const mixedResult = analyzeFortuneTriggers(mixedNatal, [
    { id: 'output', type: 'dayun', label: '丙寅大运', ganZhi: '丙寅' },
    { id: 'resource', type: 'year', label: '壬申流年', ganZhi: '壬申' },
    { id: 'peer', type: 'month', label: '甲子流月', ganZhi: '甲子' },
    { id: 'officer', type: 'day', label: '辛酉流日', ganZhi: '辛酉' },
    { id: 'wealth', type: 'hour', label: '戊辰流时', ganZhi: '戊辰' },
  ]);

  const wealthFacts = wealthResult.resourcePatternRuleFacts.filter(
    (item) => item.type === '印绶遇财取运候选',
  );
  assert.ok(wealthFacts.some((item) => item.trigger.includes('所喜劫地')));
  assert.ok(wealthFacts.some((item) => item.trigger.includes('官印亦亨')));
  assert.ok(wealthFacts.some((item) => item.status === '带忌候选'));
  const mixedFacts = mixedResult.resourcePatternRuleFacts.filter(
    (item) => item.type === '印格官杀竞透取运候选',
  );
  assert.ok(mixedFacts.some((item) => item.status === '支持候选'));
  assert.ok(mixedFacts.some((item) => item.trigger.includes('印旺方向')));
  assert.ok(mixedFacts.some((item) => item.trigger.includes('身旺方向')));
  assert.ok(mixedFacts.some((item) => item.status === '带忌候选'));
  assert.ok(
    mixedResult.limitationFacts.some(
      (item) => item.type === '印格取运边界' && item.promptText.includes('不得定成最终喜忌'),
    ),
  );
  assert.ok(mixedResult.calculationSteps.some((item) => item.stage === '印格取运核验'));
  assertEvidenceReferences(mixedResult);
  assert.doesNotMatch(
    mixedResult.promptText,
    /判定为最终喜运|判定为最终忌运|匹配总分：|富贵概率：\d|灾祸必然|成功率：\d/,
  );
});

test('食神生财取运应保留财食轻重分叉并列官杀带忌', () => {
  const natal = createFoodResult({
    year: { gan: '丁', zhi: '未', ganZhi: '丁未' },
    month: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
    day: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    hour: { gan: '癸', zhi: '丑', ganZhi: '癸丑' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'wealth-food', type: 'dayun', label: '丁卯大运', ganZhi: '丁卯' },
    { id: 'peer', type: 'year', label: '癸亥流年', ganZhi: '癸亥' },
    { id: 'officer', type: 'month', label: '戊辰流月', ganZhi: '戊辰' },
    { id: 'killer', type: 'day', label: '己未流日', ganZhi: '己未' },
  ]);
  const facts = result.foodPatternRuleFacts.filter((item) => item.type === '食神生财取运候选');

  assert.ok(facts.some((item) => item.trigger.includes('财食轻')));
  assert.ok(facts.some((item) => item.trigger.includes('财食重')));
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('官煞之方')));
  assert.ok(
    facts
      .filter((item) => item.trigger.includes('财食'))
      .every((item) => item.status === '条件待复核'),
  );
});

test('食用杀印应分别保留印旺、身旺条件与财忌官杀吉候选', () => {
  const natal = createFoodResult({
    year: { gan: '辛', zhi: '卯', ganZhi: '辛卯' },
    month: { gan: '辛', zhi: '卯', ganZhi: '辛卯' },
    day: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    hour: { gan: '己', zhi: '未', ganZhi: '己未' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'resource', type: 'dayun', label: '辛酉大运', ganZhi: '辛酉' },
    { id: 'output', type: 'year', label: '乙卯流年', ganZhi: '乙卯' },
    { id: 'wealth', type: 'month', label: '丁巳流月', ganZhi: '丁巳' },
    { id: 'officer', type: 'day', label: '戊辰流日', ganZhi: '戊辰' },
    { id: 'killer', type: 'hour', label: '己未流时', ganZhi: '己未' },
  ]);
  const facts = result.foodPatternRuleFacts.filter((item) => item.type === '食用杀印取运候选');

  assert.ok(facts.some((item) => item.trigger.includes('单个印星运字不直接证明印旺')));
  assert.ok(facts.some((item) => item.trigger.includes('身旺') && item.status === '条件待复核'));
  assert.ok(facts.some((item) => item.trigger.includes('切忌财乡') && item.status === '带忌候选'));
  assert.ok(
    facts.some((item) => item.trigger.includes('行官行杀亦吉') && item.status === '支持候选'),
  );
});

test('食伤带杀应让一般忌财与食重杀轻时逢财反吉并存', () => {
  const natal = createFoodResult({
    year: { gan: '戊', zhi: '戌', ganZhi: '戊戌' },
    month: { gan: '壬', zhi: '戌', ganZhi: '壬戌' },
    day: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    hour: { gan: '戊', zhi: '戌', ganZhi: '戊戌' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'resource', type: 'dayun', label: '甲寅大运', ganZhi: '甲寅' },
    { id: 'output', type: 'year', label: '戊戌流年', ganZhi: '戊戌' },
    { id: 'wealth', type: 'month', label: '庚申流月', ganZhi: '庚申' },
  ]);
  const facts = result.foodPatternRuleFacts.filter((item) => item.type === '食伤带杀取运候选');
  const wealthFacts = facts.filter((item) => item.layerKey.endsWith(':month:wealth'));

  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('喜印绶')));
  assert.ok(facts.some((item) => item.trigger.includes('身旺') && item.status === '条件待复核'));
  assert.ok(
    wealthFacts.some((item) => item.status === '带忌候选' && item.trigger.includes('财则最忌')),
  );
  assert.ok(
    wealthFacts.some((item) => item.status === '条件待复核' && item.trigger.includes('逢财反吉')),
  );
});

test('食旺带印与食印透财应区分强弱前提和可直接闭合方向', () => {
  const resourceOnly = createFoodResult({
    year: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    month: { gan: '癸', zhi: '巳', ganZhi: '癸巳' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
  });
  const resourceWealth = createFoodResult({
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
  });
  const layers = [
    { id: 'wealth', type: 'dayun' as const, label: '戊辰大运', ganZhi: '戊辰' },
    { id: 'output', type: 'year' as const, label: '丙寅流年', ganZhi: '丙寅' },
    { id: 'resource', type: 'month' as const, label: '壬申流月', ganZhi: '壬申' },
    { id: 'officer', type: 'day' as const, label: '辛酉流日', ganZhi: '辛酉' },
    { id: 'killer', type: 'hour' as const, label: '庚申流时', ganZhi: '庚申' },
  ];
  const resourceOnlyResult = analyzeFortuneTriggers(resourceOnly, layers);
  const resourceWealthResult = analyzeFortuneTriggers(resourceWealth, [
    { id: 'wealth', type: 'dayun', label: '丁卯大运', ganZhi: '丁卯' },
    { id: 'output', type: 'year', label: '乙卯流年', ganZhi: '乙卯' },
    { id: 'resource', type: 'month', label: '辛酉流月', ganZhi: '辛酉' },
    { id: 'officer', type: 'day', label: '戊辰流日', ganZhi: '戊辰' },
    { id: 'killer', type: 'hour', label: '己未流时', ganZhi: '己未' },
  ]);

  const heavyFacts = resourceOnlyResult.foodPatternRuleFacts.filter(
    (item) => item.type === '食旺带印取运候选',
  );
  assert.ok(heavyFacts.length > 0);
  assert.ok(heavyFacts.every((item) => item.status === '条件待复核'));
  assert.ok(
    heavyFacts.every(
      (item) => item.natalStructure.includes('食神太旺') && item.trigger.includes('食神太旺'),
    ),
  );
  const solvedFacts = resourceWealthResult.foodPatternRuleFacts.filter(
    (item) => item.type === '食印透财取运候选',
  );
  assert.ok(solvedFacts.some((item) => item.trigger.includes('单个财星运字不直接证明财旺')));
  assert.ok(
    solvedFacts.some((item) => item.status === '支持候选' && item.trigger.includes('食伤亦吉')),
  );
  assert.ok(
    solvedFacts.some((item) => item.status === '带忌候选' && item.trigger.includes('官杀皆忌')),
  );
  assert.ok(
    resourceWealthResult.limitationFacts.some(
      (item) => item.type === '食神格取运边界' && item.promptText.includes('逢财反吉'),
    ),
  );
  assert.ok(resourceWealthResult.calculationSteps.some((item) => item.stage === '食神格取运核验'));
  assertEvidenceReferences(resourceWealthResult);
  assert.doesNotMatch(
    resourceWealthResult.promptText,
    /判定为最终喜运|判定为最终忌运|匹配总分：|富贵概率：\d|灾祸必然|成功率：\d/,
  );
});

test('杀用食制应保留杀食根轻分叉，并让印运相反候选并存', () => {
  const natal = createKillerResult({
    year: { gan: '己', zhi: '未', ganZhi: '己未' },
    month: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    day: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
    hour: { gan: '庚', zhi: '子', ganZhi: '庚子' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'food', type: 'dayun', label: '己未大运', ganZhi: '己未' },
    { id: 'killer', type: 'year', label: '癸亥流年', ganZhi: '癸亥' },
    { id: 'peer', type: 'month', label: '丙午流月', ganZhi: '丙午' },
    { id: 'officer', type: 'day', label: '壬子流日', ganZhi: '壬子' },
    { id: 'resource', type: 'hour', label: '甲寅流时', ganZhi: '甲寅' },
  ]);
  const foodControlFacts = result.killerPatternRuleFacts.filter(
    (item) => item.type === '杀用食制取运候选',
  );
  const resourceLayerFacts = result.killerPatternRuleFacts.filter((item) =>
    item.layerKey.endsWith(':hour:resource'),
  );

  assert.ok(foodControlFacts.some((item) => item.trigger.includes('杀重食轻')));
  assert.ok(foodControlFacts.some((item) => item.trigger.includes('杀轻食重')));
  assert.ok(foodControlFacts.some((item) => item.trigger.includes('杀食均而日主根轻')));
  assert.ok(
    foodControlFacts.some(
      (item) => item.status === '带忌候选' && item.trigger.includes('正官混杂'),
    ),
  );
  assert.ok(
    resourceLayerFacts.some(
      (item) => item.status === '带忌候选' && item.trigger.includes('印绶夺食'),
    ),
  );
  assert.ok(
    resourceLayerFacts.some(
      (item) => item.status === '条件待复核' && item.type === '七杀用财助杀取运候选',
    ),
  );
});

test('杀用印绶应分别保留财忌、伤官美、印绶与身旺方向', () => {
  const natal = createKillerResult({
    year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    month: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    day: { gan: '戊', zhi: '寅', ganZhi: '戊寅' },
    hour: { gan: '戊', zhi: '午', ganZhi: '戊午' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'wealth', type: 'dayun', label: '壬子大运', ganZhi: '壬子' },
    { id: 'hurt', type: 'year', label: '辛酉流年', ganZhi: '辛酉' },
    { id: 'resource', type: 'month', label: '丙午流月', ganZhi: '丙午' },
    { id: 'peer', type: 'day', label: '戊辰流日', ganZhi: '戊辰' },
  ]);
  const facts = result.killerPatternRuleFacts.filter((item) => item.type === '杀用印绶取运候选');

  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('不利财乡')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('伤官为美')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('印绶福地')));
  assert.ok(
    facts.some((item) => item.status === '条件待复核' && item.trigger.includes('不直接证明身旺')),
  );
});

test('财去印存食应逐字保留劫财、伤食、财印与透杀方向', () => {
  const natal = createKillerResult({
    year: { gan: '戊', zhi: '戌', ganZhi: '戊戌' },
    month: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    day: { gan: '丁', zhi: '未', ganZhi: '丁未' },
    hour: { gan: '庚', zhi: '戌', ganZhi: '庚戌' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'robber', type: 'dayun', label: '丙寅大运', ganZhi: '丙寅' },
    { id: 'output', type: 'year', label: '戊戌流年', ganZhi: '戊戌' },
    { id: 'wealth', type: 'month', label: '庚申流月', ganZhi: '庚申' },
    { id: 'resource', type: 'day', label: '甲寅流日', ganZhi: '甲寅' },
    { id: 'killer', type: 'hour', label: '癸亥流时', ganZhi: '癸亥' },
  ]);
  const facts = result.killerPatternRuleFacts.filter(
    (item) => item.type === '七杀用财去印存食取运候选',
  );

  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('不利劫财')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('伤食皆吉')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('喜财')));
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('怕印')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('透杀亦顺')));
});

test('财助杀与杀带正官应保留全部强弱前提和取清组件边界', () => {
  const wealthNatal = createKillerResult({
    year: { gan: '己', zhi: '未', ganZhi: '己未' },
    month: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    day: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
    hour: { gan: '庚', zhi: '子', ganZhi: '庚子' },
  });
  const mixedNatal = createKillerResult({
    year: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
    month: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
    day: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
    hour: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
  });
  const layers = [
    { id: 'food', type: 'dayun' as const, label: '壬申大运', ganZhi: '壬申' },
    { id: 'resource', type: 'year' as const, label: '戊辰流年', ganZhi: '戊辰' },
    { id: 'peer', type: 'month' as const, label: '庚申流月', ganZhi: '庚申' },
    { id: 'wealth', type: 'day' as const, label: '甲寅流日', ganZhi: '甲寅' },
    { id: 'killer', type: 'hour' as const, label: '丙午流时', ganZhi: '丙午' },
  ];
  const wealthResult = analyzeFortuneTriggers(wealthNatal, [
    { id: 'food', type: 'dayun', label: '己未大运', ganZhi: '己未' },
    { id: 'resource', type: 'year', label: '甲寅流年', ganZhi: '甲寅' },
    { id: 'peer', type: 'month', label: '丙午流月', ganZhi: '丙午' },
    { id: 'wealth', type: 'day', label: '庚申流日', ganZhi: '庚申' },
    { id: 'killer', type: 'hour', label: '癸亥流时', ganZhi: '癸亥' },
  ]);
  const mixedResult = analyzeFortuneTriggers(mixedNatal, layers);
  const wealthFacts = wealthResult.killerPatternRuleFacts.filter(
    (item) => item.type === '七杀用财助杀取运候选',
  );
  const mixedFacts = mixedResult.killerPatternRuleFacts.filter(
    (item) => item.type === '杀带正官取运候选',
  );

  assert.ok(wealthFacts.length >= 5);
  assert.ok(wealthFacts.every((item) => item.status === '条件待复核'));
  assert.ok(wealthFacts.some((item) => item.trigger.includes('财已足')));
  assert.ok(wealthFacts.some((item) => item.trigger.includes('财未足')));
  assert.ok(mixedFacts.some((item) => item.trigger.includes('身轻')));
  assert.ok(mixedFacts.some((item) => item.trigger.includes('食轻')));
  assert.ok(mixedFacts.every((item) => item.natalStructure.includes('取清组件')));
});

test('无食用刃只接受阳干真刃，并保留印运非固定忌与杂官不利', () => {
  const yangNatal = createKillerResult({
    year: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
    month: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
  });
  const yinNatal = createKillerResult({
    year: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
    month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    day: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    hour: { gan: '乙', zhi: '亥', ganZhi: '乙亥' },
  });
  const layers = [
    { id: 'killer', type: 'dayun' as const, label: '庚申大运', ganZhi: '庚申' },
    { id: 'food', type: 'year' as const, label: '丙寅流年', ganZhi: '丙寅' },
    { id: 'resource', type: 'month' as const, label: '壬子流月', ganZhi: '壬子' },
    { id: 'officer', type: 'day' as const, label: '辛酉流日', ganZhi: '辛酉' },
  ];
  const yangResult = analyzeFortuneTriggers(yangNatal, layers);
  const yinResult = analyzeFortuneTriggers(yinNatal, layers);
  const facts = yangResult.killerPatternRuleFacts.filter(
    (item) => item.type === '七杀用刃取运候选',
  );

  assert.ok(facts.some((item) => item.trigger.includes('杀轻刃重')));
  assert.ok(facts.some((item) => item.trigger.includes('刃轻杀重')));
  assert.ok(facts.some((item) => item.trigger.includes('无食可夺，印运何伤')));
  assert.ok(
    facts.some((item) => item.status === '带忌候选' && item.trigger.includes('七杀既纯，杂官不利')),
  );
  assert.equal(
    yinResult.killerPatternRuleFacts.filter((item) => item.type === '七杀用刃取运候选').length,
    0,
  );
  assert.ok(
    yangResult.limitationFacts.some(
      (item) => item.type === '七杀格取运边界' && item.promptText.includes('藏干层级'),
    ),
  );
  assert.ok(yangResult.calculationSteps.some((item) => item.stage === '七杀格取运核验'));
  assertEvidenceReferences(yangResult);
  assert.doesNotMatch(
    yangResult.promptText,
    /判定为最终喜运|判定为最终忌运|匹配总分：|富贵概率：\d|灾祸必然|成功率：\d/,
  );
});

test('伤官用财、佩印及财印并用应保留相反强弱分叉', () => {
  const natal = createHurtResult({
    year: { gan: '壬', zhi: '午', ganZhi: '壬午' },
    month: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'resource', type: 'dayun', label: '丙午大运', ganZhi: '丙午' },
    { id: 'peer', type: 'year', label: '戊辰流年', ganZhi: '戊辰' },
    { id: 'wealth', type: 'month', label: '壬子流月', ganZhi: '壬子' },
    { id: 'hurt', type: 'day', label: '辛酉流日', ganZhi: '辛酉' },
    { id: 'officer', type: 'hour', label: '乙卯流时', ganZhi: '乙卯' },
  ]);
  const wealthFacts = result.hurtPatternRuleFacts.filter(
    (item) => item.type === '伤官用财取运候选',
  );
  const resourceFacts = result.hurtPatternRuleFacts.filter(
    (item) => item.type === '伤官佩印取运候选',
  );
  const combinedFacts = result.hurtPatternRuleFacts.filter(
    (item) => item.type === '伤官财印并用取运候选',
  );

  assert.ok(wealthFacts.some((item) => item.trigger.includes('财旺身轻')));
  assert.ok(
    wealthFacts.some((item) => item.trigger.includes('身强财浅') && item.trigger.includes('助财')),
  );
  assert.ok(
    wealthFacts.some(
      (item) => item.trigger.includes('身强财浅') && item.trigger.includes('伤官亦宜'),
    ),
  );
  assert.ok(resourceFacts.some((item) => item.trigger.includes('运行官煞为宜')));
  assert.ok(resourceFacts.some((item) => item.trigger.includes('印运亦吉')));
  assert.ok(resourceFacts.some((item) => item.trigger.includes('伤食不碍')));
  assert.ok(
    resourceFacts.some((item) => item.status === '带忌候选' && item.trigger.includes('财地则凶')),
  );
  assert.ok(combinedFacts.some((item) => item.trigger.includes('财多而带印')));
  assert.ok(combinedFacts.some((item) => item.trigger.includes('印多而带财')));
});

test('伤官用杀印与带杀应保留无财边界及财运相反候选', () => {
  const natal = createHurtResult({
    year: { gan: '戊', zhi: '戌', ganZhi: '戊戌' },
    month: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '丙', zhi: '子', ganZhi: '丙子' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'resource', type: 'dayun', label: '戊戌大运', ganZhi: '戊戌' },
    { id: 'output', type: 'year', label: '癸亥流年', ganZhi: '癸亥' },
    { id: 'officer', type: 'month', label: '丁巳流月', ganZhi: '丁巳' },
    { id: 'wealth', type: 'day', label: '甲寅流日', ganZhi: '甲寅' },
    { id: 'peer', type: 'hour', label: '庚申流时', ganZhi: '庚申' },
  ]);
  const killerResourceFacts = result.hurtPatternRuleFacts.filter(
    (item) => item.type === '伤官用杀印取运候选',
  );
  const carriedKillerFacts = result.hurtPatternRuleFacts.filter(
    (item) => item.type === '伤官带杀取运候选',
  );

  assert.ok(killerResourceFacts.every((item) => item.natalStructure.includes('无财')));
  assert.ok(killerResourceFacts.some((item) => item.trigger.includes('印运最利')));
  assert.ok(killerResourceFacts.some((item) => item.trigger.includes('伤食亦亨')));
  assert.ok(killerResourceFacts.some((item) => item.trigger.includes('杂官非吉')));
  assert.ok(killerResourceFacts.some((item) => item.trigger.includes('逢财即危')));
  assert.ok(
    carriedKillerFacts.some(
      (item) => item.status === '带忌候选' && item.trigger.includes('一般“忌财”'),
    ),
  );
  assert.ok(
    carriedKillerFacts.some(
      (item) => item.status === '条件待复核' && item.trigger.includes('伤重杀轻'),
    ),
  );
  assert.ok(carriedKillerFacts.some((item) => item.trigger.includes('七杀根重')));
});

test('金水伤官用官应保留财印支持、食伤不利及财印两旺例外', () => {
  const noHelperNatal = createHurtResult({
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    month: { gan: '戊', zhi: '子', ganZhi: '戊子' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
  });
  const helperNatal = createHurtResult({
    year: { gan: '甲', zhi: '申', ganZhi: '甲申' },
    month: { gan: '戊', zhi: '子', ganZhi: '戊子' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '丁', zhi: '丑', ganZhi: '丁丑' },
  });
  const layers = [
    { id: 'wealth', type: 'dayun' as const, label: '甲寅大运', ganZhi: '甲寅' },
    { id: 'resource', type: 'year' as const, label: '戊戌流年', ganZhi: '戊戌' },
    { id: 'food', type: 'month' as const, label: '壬申流月', ganZhi: '壬申' },
    { id: 'hurt', type: 'day' as const, label: '癸亥流日', ganZhi: '癸亥' },
    { id: 'peer', type: 'hour' as const, label: '庚申流时', ganZhi: '庚申' },
  ];
  const noHelperResult = analyzeFortuneTriggers(noHelperNatal, layers);
  const helperResult = analyzeFortuneTriggers(helperNatal, layers);
  const noHelperFacts = noHelperResult.hurtPatternRuleFacts.filter(
    (item) => item.type === '伤官用官取运候选',
  );
  const helperFacts = helperResult.hurtPatternRuleFacts.filter(
    (item) => item.type === '伤官用官取运候选',
  );

  assert.ok(noHelperFacts.some((item) => item.trigger.includes('运喜财印')));
  assert.ok(
    noHelperFacts.some((item) => item.status === '带忌候选' && item.trigger.includes('不利食伤')),
  );
  assert.ok(noHelperFacts.every((item) => item.natalStructure.includes('财印明透尚未俱备')));
  assert.ok(
    helperFacts.some(
      (item) =>
        item.status === '条件待复核' &&
        item.trigger.includes('财印两旺') &&
        item.trigger.includes('未始非吉'),
    ),
  );
  assert.ok(
    helperResult.limitationFacts.some(
      (item) => item.type === '伤官格取运边界' && item.promptText.includes('相反候选'),
    ),
  );
  assert.ok(helperResult.calculationSteps.some((item) => item.stage === '伤官格取运核验'));
  assertEvidenceReferences(helperResult);
  assert.doesNotMatch(
    helperResult.promptText,
    /判定为最终喜运|判定为最终忌运|匹配总分：|富贵概率：\d|灾祸必然|成功率：\d/,
  );
});

test('阳刃用官应区分助官、根深例外、伤食与运干合官边界', () => {
  const natal = createBladeResult({
    year: { gan: '己', zhi: '酉', ganZhi: '己酉' },
    month: { gan: '丙', zhi: '子', ganZhi: '丙子' },
    day: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    hour: { gan: '丙', zhi: '午', ganZhi: '丙午' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'officer', type: 'dayun', label: '己丑大运', ganZhi: '己丑' },
    { id: 'resource', type: 'year', label: '庚申流年', ganZhi: '庚申' },
    { id: 'peer', type: 'month', label: '壬子流月', ganZhi: '壬子' },
    { id: 'food-combine', type: 'day', label: '甲寅流日', ganZhi: '甲寅' },
  ]);
  const facts = result.bladePatternRuleFacts.filter((item) => item.type === '阳刃用官取运候选');

  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('运喜助官')));
  assert.ok(
    facts.some((item) => item.status === '条件待复核' && item.trigger.includes('官星根深')),
  );
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('不喜伤食')));
  assert.ok(
    facts.some(
      (item) =>
        item.status === '带忌候选' &&
        item.trigger.includes('运干甲食神') &&
        item.trigger.includes('五合固定关系') &&
        item.trigger.includes('不等于已经合化'),
    ),
  );
  assert.ok(facts.every((item) => item.natalStructure.includes('不按支数或藏干层级判“根深”')));
});

test('阳刃用杀应让杀不旺与杀太重的相反方向并存且均保留强弱条件', () => {
  const natal = createBladeResult({
    year: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    month: { gan: '甲', zhi: '午', ganZhi: '甲午' },
    day: { gan: '丙', zhi: '申', ganZhi: '丙申' },
    hour: { gan: '壬', zhi: '辰', ganZhi: '壬辰' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'killer', type: 'dayun', label: '壬辰大运', ganZhi: '壬辰' },
    { id: 'peer', type: 'year', label: '丙寅流年', ganZhi: '丙寅' },
    { id: 'resource', type: 'month', label: '甲寅流月', ganZhi: '甲寅' },
    { id: 'output', type: 'day', label: '戊戌流日', ganZhi: '戊戌' },
  ]);
  const facts = result.bladePatternRuleFacts.filter((item) => item.type === '阳刃用杀取运候选');

  assert.ok(
    facts.some((item) => item.trigger.includes('杀不甚旺') && item.trigger.includes('助杀')),
  );
  assert.ok(facts.some((item) => item.trigger.includes('杀太重') && item.trigger.includes('身旺')));
  assert.ok(facts.some((item) => item.trigger.includes('杀太重') && item.trigger.includes('印绶')));
  assert.ok(
    facts.some((item) => item.trigger.includes('杀太重') && item.trigger.includes('伤食亦不为忌')),
  );
  assert.ok(facts.every((item) => item.status === '条件待复核'));
  assert.match(facts[0]?.natalStructure ?? '', /未由明透数量、藏根支数判定/);
});

test('阳刃官杀并出应保留制伏、身旺及财地官乡相反方向，不提前认定去留', () => {
  const natal = createBladeResult({
    year: { gan: '丙', zhi: '戌', ganZhi: '丙戌' },
    month: { gan: '丁', zhi: '酉', ganZhi: '丁酉' },
    day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'output', type: 'dayun', label: '壬午大运', ganZhi: '壬午' },
    { id: 'peer', type: 'year', label: '庚申流年', ganZhi: '庚申' },
    { id: 'wealth', type: 'month', label: '甲寅流月', ganZhi: '甲寅' },
    { id: 'officer', type: 'day', label: '丁丑流日', ganZhi: '丁丑' },
  ]);
  const facts = result.bladePatternRuleFacts.filter((item) => item.type === '阳刃官杀并出取运候选');

  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('运喜制伏')));
  assert.ok(
    facts.some((item) => item.status === '条件待复核' && item.trigger.includes('身旺亦利')),
  );
  assert.ok(
    facts.some((item) => item.status === '带忌候选' && item.trigger.includes('财地反为不吉')),
  );
  assert.ok(
    facts.some((item) => item.status === '带忌候选' && item.trigger.includes('官乡反为不吉')),
  );
  assert.ok(facts.every((item) => item.natalStructure.includes('不认定官杀已经去留取清')));
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '阳刃格取运边界' && item.promptText.includes('取清组件'),
    ),
  );
  assert.ok(result.calculationSteps.some((item) => item.stage === '阳刃格取运核验'));
  assertEvidenceReferences(result);
  assert.doesNotMatch(
    result.promptText,
    /判定为最终喜运|判定为最终忌运|匹配总分：|富贵概率：\d|灾祸必然|成功率：\d/,
  );
});

test('禄劫用官应区分印护与财生，并严格分开运干合官和运支植根', () => {
  const protectedNatal = createLuResult({
    year: { gan: '庚', zhi: '戌', ganZhi: '庚戌' },
    month: { gan: '戊', zhi: '子', ganZhi: '戊子' },
    day: { gan: '癸', zhi: '酉', ganZhi: '癸酉' },
    hour: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
  });
  const financedNatal = createLuResult({
    year: { gan: '丁', zhi: '酉', ganZhi: '丁酉' },
    month: { gan: '丙', zhi: '午', ganZhi: '丙午' },
    day: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
    hour: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
  });
  const protectedResult = analyzeFortuneTriggers(protectedNatal, [
    { id: 'wealth', type: 'dayun', label: '丁巳大运', ganZhi: '丁巳' },
    { id: 'combine', type: 'year', label: '癸亥流年', ganZhi: '癸亥' },
    { id: 'hidden-combine', type: 'month', label: '甲子流月', ganZhi: '甲子' },
    { id: 'killer', type: 'day', label: '己未流日', ganZhi: '己未' },
    { id: 'output', type: 'hour', label: '甲寅流时', ganZhi: '甲寅' },
  ]);
  const financedResult = analyzeFortuneTriggers(financedNatal, [
    { id: 'resource', type: 'dayun', label: '甲寅大运', ganZhi: '甲寅' },
    { id: 'root', type: 'year', label: '乙亥流年', ganZhi: '乙亥' },
    { id: 'stem-officer', type: 'month', label: '壬辰流月', ganZhi: '壬辰' },
    { id: 'output', type: 'day', label: '戊戌流日', ganZhi: '戊戌' },
    { id: 'killer', type: 'hour', label: '癸亥流时', ganZhi: '癸亥' },
  ]);
  const protectedFacts = protectedResult.luPatternRuleFacts.filter(
    (item) => item.type === '禄劫用官印护取运候选',
  );
  const financedFacts = financedResult.luPatternRuleFacts.filter(
    (item) => item.type === '禄劫用官财生取运候选',
  );
  const combineFacts = protectedFacts.filter((item) => item.key.endsWith('combine-officer'));
  const rootFacts = financedFacts.filter((item) => item.key.endsWith('officer-wealth-root'));

  assert.ok(protectedFacts.some((item) => item.trigger.includes('印护者喜财')));
  assert.ok(protectedFacts.some((item) => item.trigger.includes('畏七杀相乘')));
  assert.ok(protectedFacts.some((item) => item.trigger.includes('伤食不能为害')));
  assert.ok(protectedFacts.some((item) => item.trigger.includes('劫比未即为凶')));
  assert.equal(combineFacts.length, 1);
  assert.equal(combineFacts[0]?.ganZhi, '癸亥');
  assert.match(combineFacts[0]?.trigger ?? '', /运干癸.*五合.*不等于已经合化/);
  assert.ok(financedFacts.some((item) => item.trigger.includes('财生喜印')));
  assert.ok(financedFacts.some((item) => item.trigger.includes('畏伤食相侮')));
  assert.ok(financedFacts.some((item) => item.trigger.includes('杂杀岂能无碍')));
  assert.equal(rootFacts.length, 2);
  assert.ok(rootFacts.every((item) => item.ganZhi.endsWith('亥')));
  assert.ok(
    rootFacts.every((item) => /运支亥.*藏干壬正官.*不把运干正官误作根气/.test(item.trigger)),
  );
  assert.ok(!rootFacts.some((item) => item.ganZhi === '壬辰'));
});

test('月劫用财带伤食应让财食轻重相反方向并存，并保留官杀边界', () => {
  const natal = createLuResult(
    {
      year: { gan: '己', zhi: '未', ganZhi: '己未' },
      month: { gan: '己', zhi: '巳', ganZhi: '己巳' },
      day: { gan: '丁', zhi: '未', ganZhi: '丁未' },
      hour: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
    },
    '劫财格',
  );
  const result = analyzeFortuneTriggers(natal, [
    { id: 'resource', type: 'dayun', label: '甲寅大运', ganZhi: '甲寅' },
    { id: 'peer', type: 'year', label: '丁巳流年', ganZhi: '丁巳' },
    { id: 'wealth', type: 'month', label: '辛丑流月', ganZhi: '辛丑' },
    { id: 'killer', type: 'day', label: '癸亥流日', ganZhi: '癸亥' },
    { id: 'officer', type: 'hour', label: '壬子流时', ganZhi: '壬子' },
  ]);
  const facts = result.luPatternRuleFacts.filter((item) => item.type === '禄劫用财带伤食取运候选');

  assert.ok(facts.some((item) => item.trigger.includes('财食重') && item.trigger.includes('喜印')));
  assert.ok(
    facts.some((item) => item.trigger.includes('财食轻') && item.trigger.includes('不喜印')),
  );
  assert.ok(
    facts.some((item) => item.trigger.includes('财食重') && item.trigger.includes('不忌比肩')),
  );
  assert.ok(
    facts.some((item) => item.trigger.includes('财食轻') && item.trigger.includes('不喜印比')),
  );
  assert.ok(facts.some((item) => item.trigger.includes('财食轻') && item.trigger.includes('助财')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('逢杀无伤')));
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('遇官非福')));
  assert.match(facts[0]?.natalStructure ?? '', /不得由明透、藏干或会合数量硬判/);
});

test('禄劫用杀食制应让食重杀轻与食轻杀重方向并存', () => {
  const natal = createLuResult({
    year: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
    hour: { gan: '己', zhi: '未', ganZhi: '己未' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'killer', type: 'dayun', label: '己未大运', ganZhi: '己未' },
    { id: 'output', type: 'year', label: '甲寅流年', ganZhi: '甲寅' },
  ]);
  const facts = result.luPatternRuleFacts.filter((item) => item.type === '禄劫用杀食制取运候选');

  assert.ok(
    facts.some((item) => item.trigger.includes('食重杀轻') && item.trigger.includes('助杀')),
  );
  assert.ok(
    facts.some((item) => item.trigger.includes('食轻杀重') && item.trigger.includes('助食')),
  );
  assert.ok(facts.every((item) => item.status === '条件待复核'));
  assert.ok(facts.every((item) => item.natalStructure.includes('不得由数量硬判')));
});

test('禄劫用杀带财应区分合杀存财与合财存杀，不提前认定五合去留', () => {
  const preservedWealthNatal = createLuResult({
    year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    month: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    day: { gan: '壬', zhi: '午', ganZhi: '壬午' },
    hour: { gan: '丙', zhi: '午', ganZhi: '丙午' },
  });
  const preservedKillerNatal = createLuResult({
    year: { gan: '丁', zhi: '巳', ganZhi: '丁巳' },
    month: { gan: '壬', zhi: '子', ganZhi: '壬子' },
    day: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
    hour: { gan: '己', zhi: '未', ganZhi: '己未' },
  });
  const preservedWealthResult = analyzeFortuneTriggers(preservedWealthNatal, [
    { id: 'output', type: 'dayun', label: '甲寅大运', ganZhi: '甲寅' },
    { id: 'wealth', type: 'year', label: '丙辰流年', ganZhi: '丙辰' },
    { id: 'officer', type: 'month', label: '己未流月', ganZhi: '己未' },
    { id: 'peer', type: 'day', label: '壬子流日', ganZhi: '壬子' },
  ]);
  const preservedKillerResult = analyzeFortuneTriggers(preservedKillerNatal, [
    { id: 'killer', type: 'dayun', label: '己未大运', ganZhi: '己未' },
    { id: 'output', type: 'year', label: '甲寅流年', ganZhi: '甲寅' },
  ]);
  const preservedWealthFacts = preservedWealthResult.luPatternRuleFacts.filter(
    (item) => item.type === '禄劫用杀带财取运候选',
  );
  const preservedKillerFacts = preservedKillerResult.luPatternRuleFacts.filter(
    (item) => item.type === '禄劫用杀带财取运候选',
  );

  assert.ok(preservedWealthFacts.some((item) => item.trigger.includes('伤食为宜')));
  assert.ok(preservedWealthFacts.some((item) => item.trigger.includes('财运不忌')));
  assert.ok(preservedWealthFacts.some((item) => item.trigger.includes('透官无虑')));
  assert.ok(preservedWealthFacts.some((item) => item.trigger.includes('身旺亦亨')));
  assert.ok(
    preservedWealthFacts.every((item) => item.natalStructure.includes('五合不等于七杀已去')),
  );
  assert.ok(
    preservedKillerFacts.some(
      (item) => item.trigger.includes('杀轻') && item.trigger.includes('助杀'),
    ),
  );
  assert.ok(
    preservedKillerFacts.some(
      (item) => item.trigger.includes('食轻') && item.trigger.includes('助食'),
    ),
  );
  assert.ok(
    preservedKillerFacts.every((item) => item.natalStructure.includes('五合不等于财星已去')),
  );
});

test('禄劫用伤食应保留印运一般带忌与伤食太重例外', () => {
  const natal = createLuResult({
    year: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    month: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
    day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
    hour: { gan: '丙', zhi: '寅', ganZhi: '丙寅' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'wealth', type: 'dayun', label: '戊辰大运', ganZhi: '戊辰' },
    { id: 'killer', type: 'year', label: '庚申流年', ganZhi: '庚申' },
    { id: 'resource', type: 'month', label: '壬子流月', ganZhi: '壬子' },
    { id: 'officer', type: 'day', label: '辛酉流日', ganZhi: '辛酉' },
    { id: 'hidden-officer', type: 'hour', label: '乙酉流时', ganZhi: '乙酉' },
  ]);
  const facts = result.luPatternRuleFacts.filter((item) => item.type === '禄劫用伤食取运候选');

  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('财运最宜')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('杀亦不忌')));
  assert.ok(facts.some((item) => item.status === '带忌候选' && item.trigger.includes('行印非吉')));
  assert.ok(
    facts.some(
      (item) =>
        item.status === '条件待复核' &&
        item.trigger.includes('伤食太重') &&
        item.trigger.includes('印亦不忌'),
    ),
  );
  const officerFacts = facts.filter((item) => item.trigger.includes('透官不美'));
  assert.equal(officerFacts.length, 1);
  assert.equal(officerFacts[0]?.ganZhi, '辛酉');
  assert.match(officerFacts[0]?.trigger ?? '', /运干辛正官明透/);
  assert.ok(facts.every((item) => !(item.ganZhi === '乙酉' && item.trigger.includes('透官不美'))));
});

test('禄劫官杀并出应保留伤食比肩与财印官运相反方向，不提前认定取清', () => {
  const natal = createLuResult({
    year: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
    month: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
    day: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
    hour: { gan: '乙', zhi: '亥', ganZhi: '乙亥' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'output', type: 'dayun', label: '丙寅大运', ganZhi: '丙寅' },
    { id: 'peer', type: 'year', label: '乙卯流年', ganZhi: '乙卯' },
    { id: 'resource', type: 'month', label: '壬子流月', ganZhi: '壬子' },
    { id: 'wealth', type: 'day', label: '戊辰流日', ganZhi: '戊辰' },
    { id: 'officer', type: 'hour', label: '辛酉流时', ganZhi: '辛酉' },
  ]);
  const facts = result.luPatternRuleFacts.filter((item) => item.type === '禄劫官杀并出取运候选');

  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('运喜伤食')));
  assert.ok(facts.some((item) => item.status === '支持候选' && item.trigger.includes('比肩亦宜')));
  assert.ok(
    facts.some((item) => item.status === '带忌候选' && item.trigger.includes('印绶未为良图')),
  );
  assert.ok(
    facts.some((item) => item.status === '带忌候选' && item.trigger.includes('财运亦非福')),
  );
  assert.ok(
    facts.some((item) => item.status === '带忌候选' && item.trigger.includes('官运亦非福')),
  );
  assert.ok(facts.every((item) => item.natalStructure.includes('不认定官杀已经去留取清')));
  assert.ok(
    result.limitationFacts.some(
      (item) =>
        item.type === '建禄月劫取运边界' && item.promptText.includes('官星植根只接受运支实际藏官'),
    ),
  );
  assert.ok(result.calculationSteps.some((item) => item.stage === '建禄月劫取运核验'));
  assertEvidenceReferences(result);
  assert.doesNotMatch(
    result.promptText,
    /判定为最终喜运|判定为最终忌运|匹配总分：|富贵概率：\d|灾祸必然|成功率：\d/,
  );
});

test('五行一方秀气只对《子平真诠》候选输出顺势逐字事实，其他古籍名目不进入本链', () => {
  const quZhi = createMiscResult({
    year: { gan: '癸', zhi: '亥', ganZhi: '癸亥' },
    month: { gan: '乙', zhi: '卯', ganZhi: '乙卯' },
    day: { gan: '乙', zhi: '未', ganZhi: '乙未' },
    hour: { gan: '壬', zhi: '午', ganZhi: '壬午' },
  });
  const result = analyzeFortuneTriggers(quZhi, [
    { id: 'follow', type: 'dayun', label: '丙子大运', ganZhi: '丙子' },
    { id: 'reverse', type: 'year', label: '庚申流年', ganZhi: '庚申' },
  ]);
  const facts = result.miscPatternRuleFacts;

  assert.ok(
    facts.some(
      (item) =>
        item.patternId === 'qu-zhi' &&
        item.status === '支持候选' &&
        item.trigger.includes('运干丙火') &&
        item.trigger.includes('运支子本气藏干癸水'),
    ),
  );
  assert.ok(
    facts.some(
      (item) =>
        item.patternId === 'qu-zhi' &&
        item.status === '带忌候选' &&
        item.trigger.includes('官杀运最忌'),
    ),
  );
  assert.ok(
    result.limitationFacts.some(
      (item) => item.type === '杂格取运边界' && item.promptText.includes('不得悄悄覆盖现有格局'),
    ),
  );
  assertEvidenceReferences(result);

  const externalResult = analyzeFortuneTriggers(
    createMiscResult({
      year: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
      month: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
      day: { gan: '甲', zhi: '子', ganZhi: '甲子' },
      hour: { gan: '乙', zhi: '丑', ganZhi: '乙丑' },
    }),
    [{ id: 'fire', type: 'dayun', label: '丙午大运', ganZhi: '丙午' }],
  );
  assert.deepEqual(externalResult.miscPatternRuleFacts, []);
  assert.ok(!externalResult.calculationSteps.some((item) => item.stage === '杂格取运核验'));
});

test('化气取运应并存化神印绶、官杀与日主还原复核，不把同元素冲突提前取舍', () => {
  const natal = createMiscResult({
    year: { gan: '甲', zhi: '戌', ganZhi: '甲戌' },
    month: { gan: '丁', zhi: '卯', ganZhi: '丁卯' },
    day: { gan: '壬', zhi: '寅', ganZhi: '壬寅' },
    hour: { gan: '甲', zhi: '辰', ganZhi: '甲辰' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'water', type: 'dayun', label: '壬子大运', ganZhi: '壬子' },
    { id: 'metal', type: 'year', label: '庚申流年', ganZhi: '庚申' },
  ]);
  const facts = result.miscPatternRuleFacts.filter((item) => item.patternId === 'hua-qi-mu');

  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '壬子' &&
        item.status === '支持候选' &&
        item.trigger.includes('化神旺地及化神印绶'),
    ),
  );
  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '壬子' &&
        item.status === '条件待复核' &&
        item.trigger.includes('日主还原') &&
        item.trigger.includes('两项候选并存'),
    ),
  );
  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '庚申' && item.status === '带忌候选' && item.trigger.includes('克制化神'),
    ),
  );
});

test('戊日倒冲只把庚辰辛丑闭合为带水之土例型，水运不机械列吉', () => {
  const natal = createMiscResult({
    year: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    month: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    day: { gan: '戊', zhi: '午', ganZhi: '戊午' },
    hour: { gan: '戊', zhi: '午', ganZhi: '戊午' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'exact', type: 'dayun', label: '庚辰大运', ganZhi: '庚辰' },
    { id: 'water', type: 'year', label: '壬子流年', ganZhi: '壬子' },
    { id: 'earth', type: 'month', label: '戊戌流月', ganZhi: '戊戌' },
  ]);
  const facts = result.miscPatternRuleFacts.filter((item) => item.patternId === 'dao-chong-wu');

  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '庚辰' &&
        item.status === '支持候选' &&
        item.trigger.includes('带水之土') &&
        item.trigger.includes('不扩成所有土运或水运'),
    ),
  );
  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '壬子' &&
        item.status === '带忌候选' &&
        item.trigger.includes('水不能机械列吉'),
    ),
  );
  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '戊戌' &&
        item.status === '条件待复核' &&
        item.trigger.includes('未闭合徐注点名'),
    ),
  );
});

test('六阴朝阳的带水木、带火木应按同柱主五行闭合，其余木保留待复核', () => {
  const natal = createMiscResult({
    year: { gan: '戊', zhi: '辰', ganZhi: '戊辰' },
    month: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    day: { gan: '辛', zhi: '酉', ganZhi: '辛酉' },
    hour: { gan: '戊', zhi: '子', ganZhi: '戊子' },
  });
  const result = analyzeFortuneTriggers(natal, [
    { id: 'water-wood', type: 'dayun', label: '甲子大运', ganZhi: '甲子' },
    { id: 'fire-wood', type: 'year', label: '丙寅流年', ganZhi: '丙寅' },
    { id: 'earth-wood', type: 'month', label: '乙丑流月', ganZhi: '乙丑' },
  ]);
  const facts = result.miscPatternRuleFacts.filter(
    (item) => item.patternId === 'liu-yin-chao-yang',
  );

  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '甲子' &&
        item.status === '支持候选' &&
        item.trigger.includes('带水之木尚可'),
    ),
  );
  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '丙寅' &&
        item.status === '带忌候选' &&
        item.trigger.includes('带火之木不宜'),
    ),
  );
  assert.ok(
    facts.some(
      (item) =>
        item.ganZhi === '乙丑' &&
        item.status === '条件待复核' &&
        item.trigger.includes('不把木机械定为喜忌'),
    ),
  );
});

test('癸日合禄原例应登记月令七杀配印复核，但不覆盖现有格局', () => {
  const natal = createMiscResult(
    {
      year: { gan: '己', zhi: '酉', ganZhi: '己酉' },
      month: { gan: '辛', zhi: '未', ganZhi: '辛未' },
      day: { gan: '癸', zhi: '未', ganZhi: '癸未' },
      hour: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    },
    '七杀格',
  );
  const result = analyzeFortuneTriggers(natal, [
    { id: 'fortune', type: 'dayun', label: '庚午大运', ganZhi: '庚午' },
  ]);
  const facts = result.miscPatternRuleFacts.filter((item) => item.type === '癸日合禄月令格复核');

  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.sourceRole, '《子平真诠》杂格原例复核');
  assert.match(facts[0]?.natalStructure ?? '', /月令本气己七杀.*时干庚正印/);
  assert.match(facts[0]?.trigger ?? '', /不采用另造的合禄固定喜忌.*不覆盖当前月令格局/);
  assert.ok(result.killerPatternRuleFacts.length > 0);
});

test('从财从杀只按现有格局结果换算相对十神，不照搬原例固定五行', () => {
  const pillars: Pillars = {
    year: { gan: '庚', zhi: '申', ganZhi: '庚申' },
    month: { gan: '乙', zhi: '酉', ganZhi: '乙酉' },
    day: { gan: '丙', zhi: '申', ganZhi: '丙申' },
    hour: { gan: '己', zhi: '丑', ganZhi: '己丑' },
  };
  const wealthResult = analyzeFortuneTriggers(createMiscResult(pillars, '从财格'), [
    { id: 'fortune', type: 'dayun', label: '甲午大运', ganZhi: '甲午' },
  ]);
  assert.ok(
    wealthResult.miscPatternRuleFacts.some(
      (item) =>
        item.type === '从财取运候选' &&
        item.status === '带忌候选' &&
        item.trigger.includes('比印扶身'),
    ),
  );
  assert.ok(
    wealthResult.miscPatternRuleFacts.every((item) =>
      item.natalStructure.includes('不照搬成所有命局固定五行表'),
    ),
  );

  const killerResult = analyzeFortuneTriggers(
    createMiscResult(
      {
        year: { gan: '乙', zhi: '酉', ganZhi: '乙酉' },
        month: { gan: '乙', zhi: '酉', ganZhi: '乙酉' },
        day: { gan: '乙', zhi: '酉', ganZhi: '乙酉' },
        hour: { gan: '甲', zhi: '申', ganZhi: '甲申' },
      },
      '从杀格',
    ),
    [{ id: 'fortune', type: 'dayun', label: '丙午大运', ganZhi: '丙午' }],
  );
  assert.ok(
    killerResult.miscPatternRuleFacts.some(
      (item) =>
        item.type === '从杀取运候选' &&
        item.status === '带忌候选' &&
        item.trigger.includes('食伤逆制官杀'),
    ),
  );
});

test('井栏、辛丑遥合与刑合应采用徐注改释方向并保留非固定边界', () => {
  const jingLanResult = analyzeFortuneTriggers(
    createMiscResult({
      year: { gan: '戊', zhi: '子', ganZhi: '戊子' },
      month: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      day: { gan: '庚', zhi: '申', ganZhi: '庚申' },
      hour: { gan: '庚', zhi: '辰', ganZhi: '庚辰' },
    }),
    [{ id: 'fortune', type: 'dayun', label: '丙寅大运', ganZhi: '丙寅' }],
  );
  assert.ok(
    jingLanResult.miscPatternRuleFacts.some(
      (item) => item.type === '井栏徐注改释取运候选' && item.status === '支持候选',
    ),
  );
  assert.ok(
    jingLanResult.miscPatternRuleFacts.some(
      (item) => item.type === '井栏徐注改释取运候选' && item.status === '带忌候选',
    ),
  );

  const yaoHeResult = analyzeFortuneTriggers(
    createMiscResult({
      year: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
      month: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
      day: { gan: '辛', zhi: '丑', ganZhi: '辛丑' },
      hour: { gan: '庚', zhi: '寅', ganZhi: '庚寅' },
    }),
    [{ id: 'fortune', type: 'dayun', label: '甲午大运', ganZhi: '甲午' }],
  );
  assert.ok(
    yaoHeResult.miscPatternRuleFacts.some(
      (item) => item.type === '辛丑遥合徐注改释取运候选' && item.status === '带忌候选',
    ),
  );

  const xingHeResult = analyzeFortuneTriggers(
    createMiscResult({
      year: { gan: '乙', zhi: '未', ganZhi: '乙未' },
      month: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
      day: { gan: '癸', zhi: '卯', ganZhi: '癸卯' },
      hour: { gan: '甲', zhi: '寅', ganZhi: '甲寅' },
    }),
    [
      { id: 'wood', type: 'dayun', label: '甲寅大运', ganZhi: '甲寅' },
      { id: 'water', type: 'year', label: '壬子流年', ganZhi: '壬子' },
      { id: 'metal', type: 'month', label: '庚申流月', ganZhi: '庚申' },
    ],
  );
  assert.ok(
    xingHeResult.miscPatternRuleFacts.some(
      (item) => item.type === '刑合徐注改释取运候选' && item.status === '支持候选',
    ),
  );
  assert.ok(
    xingHeResult.miscPatternRuleFacts.some(
      (item) =>
        item.type === '刑合徐注改释取运候选' &&
        item.status === '条件待复核' &&
        item.trigger.includes('不忌比劫'),
    ),
  );
  assert.ok(
    xingHeResult.miscPatternRuleFacts.some(
      (item) => item.type === '刑合徐注改释取运候选' && item.status === '带忌候选',
    ),
  );
});
