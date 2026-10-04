import test from 'node:test';
import assert from 'node:assert/strict';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator.ts';
import { formatBaziForPrompt } from '../packages/core/src/bazi/baziAnalysisFormatter.ts';
import { analyzeBaziNatalEvidence } from '../packages/core/src/bazi/natalEvidence.ts';
import { buildBaziWarningEvidence } from '../packages/core/src/bazi/paipanWarnings.ts';

const MAY_CHART_INPUT = {
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 1,
  gender: 'male' as const,
};
const SEPTEMBER_CHART_INPUT = {
  year: 1990,
  month: 9,
  day: 5,
  timeIndex: 6,
  gender: 'male' as const,
  isLunar: false,
};

let mayChartBase: ReturnType<typeof baziCalculator.calculateBazi> | undefined;
let septemberChartBase: ReturnType<typeof baziCalculator.calculateBazi> | undefined;

function createMayChartFixture() {
  mayChartBase ??= baziCalculator.calculateBazi(MAY_CHART_INPUT);
  return structuredClone(mayChartBase);
}

function createSeptemberChartFixture() {
  septemberChartBase ??= baziCalculator.calculateBazi(SEPTEMBER_CHART_INPUT);
  return structuredClone(septemberChartBase);
}

test('八字本命证据应保留四柱事实及可追溯关联', () => {
  const result = createMayChartFixture();
  const analysis = result.evidenceAnalysis;

  assert.ok(analysis);
  assert.equal(analysis.pillarFacts.length, 4);
  const calculationKeys = new Set(analysis.calculationSteps.map((item) => item.key));
  assert.ok(
    analysis.calculationSteps.every((item) =>
      item.dependsOnStepKeys.every((key) => calculationKeys.has(key)),
    ),
  );
  assert.ok(
    [...analysis.pillarFacts, ...analysis.analysisFacts, ...analysis.relationFacts].every((item) =>
      item.calculationStepKeys.every((key) => calculationKeys.has(key)),
    ),
  );
  const factKeys = new Set([analysis.summaryFact.key, ...analysis.summaryFact.factKeys]);
  assert.ok(
    [...analysis.counterEvidenceFacts, ...analysis.limitationFacts].every(
      (item) =>
        item.ownerFactKeys.length > 0 && item.ownerFactKeys.every((key) => factKeys.has(key)),
    ),
  );
  assert.ok(analysis.counterSummaryFact.factKeys.every((key) => factKeys.has(key)));
  assert.ok(
    analysis.limitationFacts.some(
      (item) =>
        item.type === '出生时间边界' &&
        item.promptText.includes('明确时辰或真太阳时校正后的唯一时刻'),
    ),
  );
  assert.ok(analysis.pillarFacts.every((item) => item.promptText.includes(item.ganZhi)));
  assert.doesNotMatch(
    analysis.promptText,
    /命语|本项目|当前项目|项目统一|工程|接口|API|MCP|内部权重|bazi:natal:/,
  );

  const inputBefore = structuredClone(result);
  const promptBefore = formatBaziForPrompt(result);
  for (const fact of analysis.pillarFacts) {
    fact.hiddenStems[0] = '变造藏干';
    fact.hiddenTenGods[0] = '变造十神';
    fact.kongWang[0] = '变造旬空';
  }
  assert.deepEqual(result.hiddenStems, inputBefore.hiddenStems);
  assert.deepEqual(result.hiddenTenGods, inputBefore.hiddenTenGods);
  assert.deepEqual(result.kongWang, inputBefore.kongWang);
  assert.equal(formatBaziForPrompt(result), promptBefore);
  assert.deepEqual(analyzeBaziNatalEvidence(result), inputBefore.evidenceAnalysis);
});

test('节气边界资料不完整时本命证据不能标为完整', () => {
  const result = createMayChartFixture();
  const warningEvidence = buildBaziWarningEvidence([
    '节气边界检查未完成：相邻三年节气资料全部查询失败，本次无法判断是否贴近交节边界，不能视为无预警。',
  ]);
  const analysis = analyzeBaziNatalEvidence({ ...result, ...warningEvidence });

  assert.equal(
    analysis.counterEvidenceFacts.find((item) => item.type === '排盘边界覆盖')?.status,
    '资料不足',
  );
  assert.equal(analysis.summaryFact.status, '证据链有缺口');
  assert.equal(analysis.summaryFact.missingFactCount, 1);
  assert.equal(analysis.calculationSteps.at(-1)?.status, '存在资料缺口');
  assert.equal(analysis.calculationSteps.at(-1)?.result.missingFactCount, 1);
});

test('真实命盘增补五行喜忌待判时本命证据应保留资料缺口', () => {
  const result = createSeptemberChartFixture();
  assert.equal(result.analysis.usefulGod.incrementStatus, '待判');

  const analysis = analyzeBaziNatalEvidence(result);
  const usefulFact = analysis.analysisFacts.find((item) => item.type === '用神取忌');
  assert.equal(usefulFact?.status, '资料缺口');
  assert.match(usefulFact?.result ?? '', /增补五行喜忌待判/);
  assert.equal(
    analysis.calculationSteps.find((item) => item.stage === '核心判断形成')?.status,
    '存在资料缺口',
  );
  assert.equal(analysis.summaryFact.status, '证据链有缺口');
  assert.equal(analysis.summaryFact.missingFactCount, 1);
  assert.equal(analysis.calculationSteps.at(-1)?.result.missingFactCount, 1);
});

test('增补五行喜忌仅部分判定时本命证据与提示词应保留资料缺口', () => {
  const chart = createSeptemberChartFixture();
  chart.analysis.usefulGod.incrementStatus = '部分判定';
  chart.analysis.usefulGod.favorableWuxing = ['木'];
  chart.analysis.usefulGod.primaryFavorableWuxing = '木';
  chart.analysis.usefulGod.unfavorableWuxing = [];
  chart.analysis.usefulGod.primaryUnfavorableWuxing = '';

  const analysis = analyzeBaziNatalEvidence(chart);
  const usefulFact = analysis.analysisFacts.find((item) => item.type === '用神取忌');
  assert.equal(usefulFact?.status, '资料缺口');
  assert.match(usefulFact?.result ?? '', /增补五行喜忌部分判定；主用木/);
  assert.match(usefulFact?.promptText ?? '', /取用结果：增补五行喜忌部分判定；主用木/);
  assert.ok(
    analysis.evidence.items.some(
      (item) =>
        item.title === '用神取忌事实' &&
        item.level === '反证' &&
        item.detail.includes('增补五行喜忌部分判定；主用木'),
    ),
  );
  assert.equal(analysis.summaryFact.status, '证据链有缺口');
  assert.equal(analysis.summaryFact.missingFactCount, 1);
  assert.equal(
    analysis.calculationSteps.find((item) => item.stage === '核心判断形成')?.status,
    '存在资料缺口',
  );
});

test('八字本命提示词应保留用户选择的传统时辰且不混入工程证据话术', () => {
  const result = baziCalculator.calculateBazi({
    year: 1992,
    month: 8,
    day: 21,
    timeIndex: 4,
    gender: 'female',
  });
  const prompt = formatBaziForPrompt(result);

  assert.match(prompt, /基本信息: 坤造 \| 1992年8月21日 辰时/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|计算链|解释限制/);
  assert.doesNotMatch(prompt, /出生时间敏感性|候选时柱|缺少时柱/);
});

test('八字本命证据应拒绝与地支不对应的藏干资料', () => {
  const result = createMayChartFixture();
  result.hiddenStems.year = ['癸'];
  result.hiddenTenGods.year = ['偏印'];

  const fact = analyzeBaziNatalEvidence(result).pillarFacts.find((item) => item.pillar === '年柱');

  assert.equal(fact?.status, '资料缺口');
  assert.deepEqual(fact?.hiddenStems, []);
  assert.deepEqual(fact?.hiddenTenGods, []);
  assert.match(
    fact?.promptText || '',
    new RegExp(`藏干资料与地支${result.pillars.year.zhi}不一致`),
  );
  assert.doesNotMatch(fact?.promptText || '', /藏干癸|藏干十神偏印/);
});

test('藏干十神与日主依据不一致时结构化事实不回传可疑值', () => {
  const result = createMayChartFixture();
  result.hiddenTenGods.year[0] = '伪十神';

  const fact = analyzeBaziNatalEvidence(result).pillarFacts.find((item) => item.pillar === '年柱');

  assert.equal(fact?.status, '资料缺口');
  assert.deepEqual(fact?.hiddenStems, result.hiddenStems.year);
  assert.deepEqual(fact?.hiddenTenGods, []);
  assert.doesNotMatch(fact?.promptText ?? '', /伪十神/);
});

test('日主天干与日柱不一致时不把藏干十神视为已核实', () => {
  const result = createMayChartFixture();
  result.dayMaster.gan = result.dayMaster.gan === '甲' ? '乙' : '甲';

  const fact = analyzeBaziNatalEvidence(result).pillarFacts.find((item) => item.pillar === '年柱');

  assert.equal(fact?.status, '资料缺口');
  assert.deepEqual(fact?.hiddenTenGods, []);
  assert.match(fact?.promptText ?? '', /藏干十神资料与藏干或日主不一致，暂不采用/);
});

test('八字本命证据应标出缺失或错位的派生资料，且不把可疑值写入提示词', () => {
  const result = createMayChartFixture();
  result.tenGods.year = '伪十神';
  result.nayin.year = '';
  result.pillarLifeStages.year = '伪十二运';
  result.lifeStages.year = '';
  result.ziZuo.year = '伪自坐';
  result.kongWang.year = ['伪支', '伪支'];

  const evidence = analyzeBaziNatalEvidence(result);
  const yearFact = evidence.pillarFacts.find((item) => item.pillar === '年柱');

  assert.ok(yearFact);
  assert.equal(yearFact.status, '资料缺口');
  assert.equal(yearFact.tenGod, '');
  assert.equal(yearFact.nayin, '');
  assert.equal(yearFact.pillarLifeStage, '');
  assert.equal(yearFact.dayMasterLifeStage, '');
  assert.equal(yearFact.ziZuo, '');
  assert.deepEqual(yearFact.kongWang, []);
  assert.match(yearFact.promptText, /待核资料：天干十神、纳音、柱干十二运、日主十二运、自坐、旬空/);
  assert.doesNotMatch(yearFact.promptText, /伪十神|伪十二运|伪自坐|伪支/);
  assert.equal(evidence.calculationSteps[1].status, '已计算');
  assert.equal(evidence.calculationSteps[2].status, '存在资料缺口');
  assert.equal(evidence.calculationSteps[4].result.missingFactCount, 1);
  assert.equal(evidence.summaryFact.missingFactCount, 1);
  assert.equal(evidence.summaryFact.status, '证据链有缺口');
});

test('固定四柱的日主五行或阴阳与日干不一致时不写为已计算事实', () => {
  for (const staleField of ['element', 'yinYang'] as const) {
    const chart = baziCalculator.calculateBazi({
      year: 1990,
      month: 9,
      day: 5,
      timeIndex: 6,
      gender: 'male',
    });
    assert.deepEqual(
      Object.values(chart.pillars).map((pillar) => pillar.ganZhi),
      ['庚午', '甲申', '癸酉', '戊午'],
    );
    if (staleField === 'element') chart.dayMaster.element = '木';
    else chart.dayMaster.yinYang = '阳';

    const evidence = analyzeBaziNatalEvidence(chart);
    const pillarStep = evidence.calculationSteps.find((item) => item.stage === '四柱生成');
    const staleDayMaster = `${chart.dayMaster.gan}${chart.dayMaster.element}${chart.dayMaster.yinYang}`;

    assert.equal(pillarStep?.status, '存在资料缺口');
    assert.equal(pillarStep?.result.dayMaster, '待核');
    assert.match(pillarStep?.promptText ?? '', /日主资料与日柱不一致，待核/);
    assert.ok(evidence.pillarFacts.every((item) => item.status === '资料缺口'));
    assert.equal(evidence.summaryFact.status, '证据链有缺口');
    assert.doesNotMatch(evidence.promptText, new RegExp(staleDayMaster));
  }
});

test('1994年6月15日午时壬日男命应贯通壬午月取用证据与公共提示词', () => {
  const result = baziCalculator.calculateBazi({
    year: 1994,
    month: 6,
    day: 15,
    timeIndex: 6,
    gender: 'male',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  assert.equal(result.pillars.day.gan, '壬');
  assert.equal(result.pillars.month.zhi, '午');
  assert.equal(result.analysis.usefulGod.primaryFavorableWuxing, '金');
  assert.deepEqual(result.analysis.usefulGod.favorableWuxing?.slice(0, 2), ['金', '水']);
  assert.ok(
    result.analysis.usefulGod.matchedRules?.some((rule) => rule.id === 'wu-month-ren-gui-geng'),
  );
  assert.ok(result.evidenceAnalysis);

  const usefulFact = result.evidenceAnalysis.analysisFacts.find((item) => item.type === '用神取忌');
  assert.match(usefulFact?.promptText || '', /主用金/);
  assert.doesNotMatch(usefulFact?.promptText || '', /主用火/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /取用: 主用金，辅水/);
  assert.match(prompt, /水火分布参考: 生于夏月，原局见少量水气分布，可作为核对润燥的线索/);
  assert.doesNotMatch(prompt, /取用: 主用火/);
});

test('八字真太阳时本命证据采用唯一校正时刻并保留秒精度', () => {
  const result = baziCalculator.calculateBazi({
    year: 1990,
    month: 4,
    day: 15,
    timeIndex: 0,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 1,
    birthMinute: 20,
    birthLongitude: 73.5,
    birthPlace: '新疆喀什',
  });
  const analysis = result.evidenceAnalysis;

  assert.ok(analysis);
  assert.ok(result.timing?.evidence);
  assert.equal(result.timing.evidence.summaryFact.status, '证据链完整');
  assert.equal(
    result.timing.evidence.calculationChain.length,
    result.timing.evidence.calculationSteps.length,
  );
  assert.match(analysis.calculationSteps[0].promptText, /经真太阳时校正后采用/);
  assert.equal(analysis.calculationSteps[0].inputs.trueSolarTimeEnabled, true);
  assert.match(analysis.promptText, /当前命盘只采用明确时辰或真太阳时校正后的唯一时刻/);
  assert.doesNotMatch(analysis.promptText, /候选盘\d|候选时辰为/);
  const prompt = formatBaziForPrompt(result);
  assert.equal(result.timing.correctedTime.second, 44);
  assert.match(prompt, /真太阳时: 1990年4月14日 22:13:44 \| 出生地:新疆喀什 \| 经度:73\.5/);
  assert.match(prompt, /基本信息: 乾造 \| 1990年4月14日 亥时/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|候选盘|出生时间敏感性/);
});

test('丁火生巳月案例的劫财格应贯穿取用、证据与最终提示词，不得回退为正财格', () => {
  const result = baziCalculator.calculateBazi({
    year: 2002,
    month: 5,
    day: 19,
    timeIndex: 0,
    gender: 'female',
    isLunar: false,
    isLeapMonth: false,
    useTrueSolarTime: true,
    birthHour: 6,
    birthMinute: 23,
    birthPlace: '上海',
    birthLongitude: 121.4737,
  });

  assert.deepEqual(
    Object.values(result.pillars).map((pillar) => pillar.ganZhi),
    ['壬午', '乙巳', '丁亥', '癸卯'],
  );
  assert.equal(result.monthCommander, '庚');
  assert.equal(result.analysis.mingGe.pattern, '劫财格');
  assert.match(result.analysis.mingGe.basis || '', /月令本气为丙/);
  assert.ok(
    result.analysis.usefulGod.strategyTrace?.some((item) => item.includes('普通格局:劫财格')),
  );
  assert.ok(result.evidenceAnalysis);

  const patternFact = result.evidenceAnalysis.analysisFacts.find((item) => item.type === '格局');
  assert.equal(patternFact?.result, '劫财格');
  assert.match(patternFact?.promptText || '', /格局：劫财格/);

  const prompt = formatBaziForPrompt(result);
  assert.match(prompt, /格局: 劫财格/);
  assert.doesNotMatch(prompt, /取用脉络:/);
  assert.doesNotMatch(JSON.stringify(result), /正财格/);
  assert.doesNotMatch(prompt, /正财格/);
});
