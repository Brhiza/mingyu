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
