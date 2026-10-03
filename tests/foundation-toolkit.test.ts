import test from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../packages/core/src/index.ts';
import {
  BASIC_MAPPINGS,
  HIDDEN_STEMS,
  NAYIN_MAP as BAZI_NAYIN_MAP,
  SIXTY_CYCLE as BAZI_SIXTY_CYCLE,
} from '../packages/core/src/bazi/baziMappingsData.ts';
import {
  CHANGSHENG_ORDER,
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  NAYIN_MAP,
  SIX_XUN_HEADS,
  SIXTY_CYCLE,
  ZODIACS,
} from '../packages/core/src/ganzhi/data.ts';
import {
  BRANCH_HIDDEN_STEMS,
  BRANCH_ORDER,
  STEM_ORDER,
  WUXING,
} from '../packages/core/src/ganzhi/relations.ts';
import { getBaziHourPillarOptions, WUXING_VALUES } from '../packages/core/src/ganzhi/validation.ts';
import { LIUCHONG_MAP as LEGACY_LIUCHONG_MAP } from '../packages/core/src/divination/algorithms/_shared/wuxing.ts';
import { LIUCHONG_MAP } from '../packages/core/src/ganzhi/relations.ts';

test('公共地基层应成为八字与占卜旧路径的单一真相源', () => {
  assert.equal(BASIC_MAPPINGS.HEAVENLY_STEMS, HEAVENLY_STEMS);
  assert.equal(BASIC_MAPPINGS.EARTHLY_BRANCHES, EARTHLY_BRANCHES);
  assert.equal(BAZI_SIXTY_CYCLE, SIXTY_CYCLE);
  assert.equal(BAZI_NAYIN_MAP, NAYIN_MAP);
  assert.equal(HIDDEN_STEMS, BRANCH_HIDDEN_STEMS);
  assert.equal(LEGACY_LIUCHONG_MAP, LIUCHONG_MAP);
});

test('六十甲子工具应返回完整序列与结构化关系', () => {
  const capabilities = core.foundation.getFoundationCapabilities();
  const cycle = capabilities.constants.sixtyCycle;
  assert.equal(cycle.length, 60);
  assert.equal(cycle[0], '甲子');
  assert.equal(cycle[59], '癸亥');
  assert.deepEqual(capabilities.constants.sixXunHeads, [
    '甲子',
    '甲戌',
    '甲申',
    '甲午',
    '甲辰',
    '甲寅',
  ]);
  assert.equal(core.ganzhi.getXunHead('乙丑'), '甲子');
  assert.equal(core.ganzhi.getXunHead('癸亥'), '甲寅');
  assert.equal(SIX_XUN_HEADS.length, 6);

  const profile = core.foundation.describeGanZhi('甲子');
  assert.equal(profile.index, 0);
  assert.equal(profile.nayin, '海中金');
  assert.equal(profile.stem.combine, '己');
  assert.equal(profile.stem.combineWuxing, '土');
  assert.equal(profile.branch.zodiac, '鼠');
  assert.deepEqual(profile.branch.hiddenStems, ['癸']);
  assert.equal(profile.branch.clash, '午');
  assert.equal(profile.branch.harm, '未');
  assert.equal(profile.branch.break, '酉');
  assert.equal(profile.branch.sanhe.group, '水局');
  assert.equal(profile.key, 'foundation:ganzhi:甲子');
  assert.equal(profile.status, '已查询');
  assert.deepEqual(
    profile.calculationChain,
    profile.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(profile.summaryFact.calculationStepCount, profile.calculationSteps.length);
  assert.equal(profile.summaryFact.sourceFactCount, profile.sourceFacts.length);
  assert.equal(profile.summaryFact.limitationFactCount, profile.limitationFacts.length);
  assert.ok(profile.sourceFacts.every((fact) => fact.ownerStepKeys.length > 0));
  assert.match(
    profile.promptText,
    /【任务】[\s\S]*【干支资料】[\s\S]*【传统依据】[\s\S]*【输出要求】/,
  );
  assert.match(profile.promptText, /五合甲己，合化土/);
  assert.match(profile.promptText, /子丑（化土）/);
  assert.match(profile.promptText, /相刑对应卯/);
  assert.match(profile.promptText, /三合水局（子、申、辰）/);
  assert.match(profile.promptText, /北方水（亥、子、丑）/);
  const profileWithoutStemClash = core.foundation.describeGanZhi('戊子');
  assert.match(profileWithoutStemClash.promptText, /天干：戊，阳土；五合戊癸，合化火。/);
  assert.doesNotMatch(
    profileWithoutStemClash.promptText,
    /天干相冲|戊己冲|固定相冲对象|暗合无固定对象/,
  );
  assert.doesNotMatch(profile.promptText, /吉凶评分|成功率[：=]?\d|事件概率[：=]?\d/);
  assert.doesNotMatch(
    profile.promptText,
    /零基序号|证据汇总|来源：|限制：|公共干支单一真相源|tyme4ts/,
  );
  assert.doesNotMatch(profile.promptText, /mingyu-core|命语|本项目|工程|接口|API|MCP/);
  assert.deepEqual(core.foundation.getBranchRelations('寅').punishments, ['巳', '申']);
  assert.equal(core.foundation.getBranchRelations('寅').hiddenCombine, '丑');
  assert.equal(capabilities.constants.changshengOrder.length, 12);
  assert.equal(capabilities.constants.shichenPeriods.length, 13);
  assert.ok(capabilities.evidenceOutputs.ganzhi.includes('可复制证据文本'));
  assert.ok(capabilities.evidenceOutputs.wuxing.includes('逐项五行与藏干贡献'));
  assert.deepEqual(capabilities.constants.chinaDstYears, [1986, 1987, 1988, 1989, 1990, 1991]);
  assert.ok(capabilities.singleSourceModules.includes('calendar'));
  assert.equal(capabilities.key, 'foundation:capabilities');
  assert.equal(capabilities.status, '已登记');
  assert.equal(capabilities.capabilityFacts.length, capabilities.singleSourceModules.length);
  assert.equal(capabilities.summaryFact.status, '目录完整');
  assert.equal(capabilities.summaryFact.moduleFactCount, capabilities.capabilityFacts.length);
  assert.equal(capabilities.summaryFact.evidenceReadyModuleCount, 5);
  assert.equal(capabilities.summaryFact.catalogOnlyModuleCount, 0);
  assert.equal(
    capabilities.summaryFact.constantGroupCount,
    Object.keys(capabilities.constants).length,
  );
  assert.equal(capabilities.summaryFact.commonShenshaCount, capabilities.commonShensha.length);
  assert.deepEqual(
    capabilities.summaryFact.factKeys,
    capabilities.capabilityFacts.map((fact) => fact.key),
  );
  assert.equal(capabilities.limitationFacts.length, 4);
  assert.equal(capabilities.limitations.length, capabilities.limitationFacts.length);
  assert.ok(
    capabilities.capabilityFacts.every(
      (fact) =>
        fact.key.startsWith('foundation:capability:') &&
        fact.provides.length > 0 &&
        fact.sources.length > 0 &&
        fact.promptText &&
        fact.limitation.includes('不证明传统解释'),
    ),
  );
  assert.equal(
    capabilities.capabilityFacts.find((fact) => fact.module === 'shensha')?.status,
    '结构化证据可用',
  );
  assert.ok(capabilities.evidenceOutputs.calendar.includes('月相与节气证据'));
  assert.ok(capabilities.evidenceOutputs.shensha.includes('逐柱命中事实'));
  assert.ok(capabilities.commonShensha.every((item) => item.evidenceStatus === '来源已声明'));
  assert.match(capabilities.promptText, /【公共历法干支五行方位神煞能力结构化证据】/);
  assert.match(capabilities.promptText, /各体系特有神煞仍须结合对应排盘资料/);
  assert.doesNotMatch(
    capabilities.promptText,
    /命语|mingyu-core|本项目|当前项目|工程|接口|API|MCP/,
  );
  assert.doesNotMatch(
    capabilities.promptText,
    /"score"\s*:|成功率[：=]?\s*\d|吉凶总分[：=]?\s*\d|事件概率[：=]?\s*\d/,
  );
});

test('统一五行分析应严格校验输入并支持藏干权重', () => {
  const result = core.foundation.analyzeWuxing(['甲', '子', '丙', '午']);
  assert.equal(result.weightHidden, true);
  assert.ok(result.counts.木 > 0);
  assert.ok(result.counts.水 > 0);
  assert.ok(result.counts.火 > 0);
  assert.equal(result.key, 'foundation:wuxing:with-hidden:甲-子-丙-午');
  assert.equal(result.status, '已统计');
  assert.deepEqual(
    result.calculationChain,
    result.calculationSteps.map((item) => item.promptText),
  );
  assert.equal(result.itemFacts.length, 4);
  assert.equal(result.itemFacts[1]?.item, '子');
  assert.deepEqual(result.itemFacts[1]?.hiddenContributions, [
    { stem: '癸', wuxing: '水', weight: 1, rank: '本气' },
  ]);
  assert.deepEqual(result.dominantElements, ['火']);
  assert.deepEqual(result.weakestElements, ['金']);
  assert.equal(result.summaryFact.itemFactCount, result.itemFacts.length);
  assert.equal(result.summaryFact.limitationFactCount, result.limitationFacts.length);
  assert.match(result.promptText, /本气1、中气0.5、余气0.3/);
  assert.doesNotMatch(result.promptText, /命局旺衰已确定|用神为|吉凶评分[：=]?\d/);
  assert.doesNotMatch(result.promptText, /mingyu-core|命语|本项目|工程|接口|API|MCP/);

  const tied = core.foundation.analyzeWuxing(['甲'], { weightHidden: false });
  assert.deepEqual(tied.dominantElements, ['木']);
  assert.deepEqual(tied.weakestElements, ['火', '土', '金', '水']);
  assert.equal(tied.weakest, '火');
  assert.throws(() => core.foundation.analyzeWuxing([]), /至少需要一个/);
  assert.throws(() => core.foundation.analyzeWuxing(['甲子']), /输入无效/);
});

test('干支与五行只读基础序列拒绝原地修改且公共副本仍可变', () => {
  const capture = () => ({
    profile: core.foundation.describeGanZhi('甲子'),
    hourPillars: getBaziHourPillarOptions('甲子'),
    wuxing: core.foundation.analyzeWuxing(['己', '甲']),
    capabilities: core.foundation.getFoundationCapabilities(),
    sixtyCycleCopy: core.ganzhi.getSixtyCycle(),
    xunHead: core.ganzhi.getXunHead('乙丑'),
    wuxingValues: [...WUXING_VALUES],
  });
  const baseline = capture();
  const readonlyArrays: Array<{ name: string; values: readonly string[] }> = [
    { name: 'HEAVENLY_STEMS', values: HEAVENLY_STEMS },
    { name: 'EARTHLY_BRANCHES', values: EARTHLY_BRANCHES },
    { name: 'ZODIACS', values: ZODIACS },
    { name: 'SIXTY_CYCLE', values: SIXTY_CYCLE },
    { name: 'SIX_XUN_HEADS', values: SIX_XUN_HEADS },
    { name: 'CHANGSHENG_ORDER', values: CHANGSHENG_ORDER },
    { name: 'WUXING', values: WUXING },
    { name: 'WUXING_VALUES', values: WUXING_VALUES },
  ];

  assert.equal(STEM_ORDER, HEAVENLY_STEMS);
  assert.equal(BRANCH_ORDER, EARTHLY_BRANCHES);
  assert.equal(baseline.profile.index, 0);
  assert.equal(baseline.profile.branch.zodiac, '鼠');
  assert.deepEqual(baseline.hourPillars.slice(0, 2), ['甲子', '乙丑']);
  assert.deepEqual(baseline.wuxing.counts, { 木: 1, 火: 0, 土: 1, 金: 0, 水: 0 });
  assert.deepEqual(baseline.wuxing.dominantElements, ['木', '土']);
  assert.deepEqual(baseline.wuxing.weakestElements, ['火', '金', '水']);
  assert.equal(baseline.xunHead, '甲子');
  assert.deepEqual(baseline.wuxingValues, ['木', '火', '土', '金', '水']);
  assert.deepEqual(baseline.capabilities.constants.changshengOrder, [
    '长生',
    '沐浴',
    '冠带',
    '临官',
    '帝旺',
    '衰',
    '病',
    '死',
    '墓',
    '绝',
    '胎',
    '养',
  ]);

  for (const { name, values } of readonlyArrays) {
    assert.equal(Object.isFrozen(values), true, name);
    assert.equal(Reflect.set(values, 0, '污染'), false, name);
    assert.throws(() => (values as unknown as string[]).sort(), TypeError, name);
    assert.deepEqual(capture(), baseline, `${name} 修改尝试后完整资料与任务书保持不变`);
  }

  const capabilityCycle = baseline.capabilities.constants.sixtyCycle;
  const publicCycle = baseline.sixtyCycleCopy;
  const canonicalCapabilityCycle = [...capabilityCycle];
  const canonicalPublicCycle = [...publicCycle];
  assert.equal(Object.isFrozen(capabilityCycle), false);
  assert.equal(Object.isFrozen(publicCycle), false);
  capabilityCycle[0] = '目录副本变造';
  publicCycle[0] = '序列副本变造';
  assert.equal(capabilityCycle[0], '目录副本变造');
  assert.equal(publicCycle[0], '序列副本变造');
  assert.deepEqual(capture(), {
    ...baseline,
    capabilities: {
      ...baseline.capabilities,
      constants: {
        ...baseline.capabilities.constants,
        sixtyCycle: canonicalCapabilityCycle,
      },
    },
    sixtyCycleCopy: canonicalPublicCycle,
  });
});
