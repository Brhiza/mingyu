import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { analyzeQimenPatternRelations, formatQimenPatternRelations } from '../src/systems/qimen/patterns';
import { analyzeMagneticChainRelations, numberEnergy } from '../src/systems/number-energy';

const exactBirth = {
  year: 1990,
  month: 5,
  day: 15,
  clock: { kind: 'exact' as const, hour: 14, minute: 30, second: 0 },
  timezone: 8,
};

test('minglu 精简与完整模式下均透传八字【格局组合与互制关系】且不重复', async () => {
  const compact = await calculate('minglu', {
    question: '请综合分析命盘结构与制衡。',
    birth: exactBirth,
    gender: 'female',
    location: { latitude: 39.9, longitude: 116.4, locationName: '北京' },
    house: { kind: 'mountain', sitMountain: '子' },
    prompt: { topic: 'overview', detailMode: 'compact' },
  });

  const baziSection = compact.data.sections.find((s: { id: string }) => s.id === 'bazi');
  assert.ok(baziSection, '应包含八字资料分节');
  assert.match(baziSection.markdown, /【格局组合与互制关系】/);
  assert.match(baziSection.markdown, /主格定位：/);
  assert.match(baziSection.markdown, /层级优先级：/);
  assert.match(baziSection.markdown, /破格因子与救应链：/);
  assert.equal(compact.prompt.text.match(/【格局组合与互制关系】/g)?.length, 1);

  const full = await calculate('minglu', {
    question: '请综合分析命盘结构与制衡。',
    birth: exactBirth,
    gender: 'female',
    location: { latitude: 39.9, longitude: 116.4, locationName: '北京' },
    house: { kind: 'mountain', sitMountain: '子' },
    prompt: { topic: 'overview', detailMode: 'full' },
  });
  assert.equal(full.prompt.text.match(/【格局组合与互制关系】/g)?.length, 1);
  assert.match(full.prompt.text, /【格局组合与互制关系】/);
});

test('qimen-lifetime 紧随【盘面格局】原生输出【格局叠加与吉凶制衡关系】', async () => {
  const res = await calculate('qimen-lifetime', {
    question: '请看终身局格局叠加与制衡关系。',
    birth: {
      year: 1990,
      month: 5,
      day: 15,
      hour: 14,
      minute: 30,
      second: 0,
      timezone: 8,
    },
    gender: 'male',
    prompt: { scope: 'natal', detailMode: 'compact' },
  });

  const text = res.prompt.text;
  const relBlockIdx = text.indexOf('【格局叠加与吉凶制衡关系】');
  assert.ok(relBlockIdx > -1, '应输出【格局叠加与吉凶制衡关系】');
  const patternBlockIdx = text.indexOf('【盘面格局】');
  if (patternBlockIdx > -1) {
    assert.ok(patternBlockIdx < relBlockIdx, '【格局叠加与吉凶制衡关系】应紧随【盘面格局】之后');
    const between = text.slice(patternBlockIdx, relBlockIdx);
    assert.equal((between.match(/\n\n【/g) ?? []).length, 0, '【盘面格局】与【格局叠加与吉凶制衡关系】之间不应插入其他区块');
  }

  const structured = analyzeQimenPatternRelations(res.data.baseChart);
  assert.ok(Array.isArray(structured.damagedGoodPalaces));
  assert.ok(Array.isArray(structured.badRescuePalaces));
  assert.ok(Array.isArray(structured.globalConstraints));

  const expectedFormatted = formatQimenPatternRelations(res.data.baseChart);
  assert.ok(text.includes(expectedFormatted), '提示词内容应直接复用 formatQimenPatternRelations 输出');
  assert.match(text, /吉格折损\/反凶检查：/);
  assert.match(text, /凶格救应\/通关检查：/);
  assert.match(text, /全局约束：/);
});

test('number-energy 输出【磁场衔接与制化关系】并准确检出占比、制化链与连续考验风险段', () => {
  // 12(绝命) -> 27(天医), 18(五鬼) -> 82(生气) -> 27(天医), 16(六煞) -> 62(延年), 17(祸害) -> 78(延年)
  const res1 = numberEnergy({ value: '127', question: '测试绝命天医' });
  const rel1 = analyzeMagneticChainRelations(res1.data);
  assert.equal(rel1.totalPairs, 2);
  assert.equal(rel1.supportiveCount, 1);
  assert.equal(rel1.challengingCount, 1);
  assert.equal(rel1.supportiveRatio, 50);
  assert.equal(rel1.challengingRatio, 50);
  assert.ok(rel1.remedyLinks.some((item) => item.pattern === '绝命→天医'));
  assert.equal(rel1.unrescuedRiskSegments.length, 0);
  assert.match(res1.prompt.text, /【八星配对】[\s\S]*\n\n【磁场衔接与制化关系】/);
  assert.match(res1.prompt.text, /绝命→天医/);

  // 绝命→生气 (12 -> 28)
  const resJueSheng = numberEnergy({ value: '128', question: '测试绝命生气' });
  assert.ok(analyzeMagneticChainRelations(resJueSheng.data).remedyLinks.some((item) => item.pattern === '绝命→生气'));

  // 五鬼→生气→天医 (18 -> 82 -> 27)
  const resWugui3 = numberEnergy({ value: '1827', question: '测试五鬼生气天医' });
  assert.ok(analyzeMagneticChainRelations(resWugui3.data).remedyLinks.some((item) => item.pattern === '五鬼→生气→天医'));

  // 五鬼→延年 (18 -> 87) & 五鬼→天医 (18 -> 86)
  assert.ok(analyzeMagneticChainRelations(numberEnergy({ value: '187', question: '五鬼延年' }).data).remedyLinks.some((item) => item.pattern === '五鬼→延年'));
  assert.ok(analyzeMagneticChainRelations(numberEnergy({ value: '186', question: '五鬼天医' }).data).remedyLinks.some((item) => item.pattern === '五鬼→天医'));

  // 六煞→延年 (16 -> 62) & 六煞→生气 (16 -> 67)
  assert.ok(analyzeMagneticChainRelations(numberEnergy({ value: '162', question: '六煞延年' }).data).remedyLinks.some((item) => item.pattern === '六煞→延年'));
  assert.ok(analyzeMagneticChainRelations(numberEnergy({ value: '167', question: '六煞生气' }).data).remedyLinks.some((item) => item.pattern === '六煞→生气'));

  // 祸害→生气 (17 -> 76) & 祸害→延年 (17 -> 78)
  assert.ok(analyzeMagneticChainRelations(numberEnergy({ value: '176', question: '祸害生气' }).data).remedyLinks.some((item) => item.pattern === '祸害→生气'));
  assert.ok(analyzeMagneticChainRelations(numberEnergy({ value: '178', question: '祸害延年' }).data).remedyLinks.some((item) => item.pattern === '祸害→延年'));

  // 连续考验星无吉星衔接风险段：12(绝命) -> 21(绝命) -> 18(五鬼) 落末尾
  const resRiskTail = numberEnergy({ value: '1218', question: '测试连续考验星末尾' });
  const relRiskTail = analyzeMagneticChainRelations(resRiskTail.data);
  assert.equal(relRiskTail.unrescuedRiskSegments.length, 1);
  assert.equal(relRiskTail.unrescuedRiskSegments[0].length, 3);
  assert.match(resRiskTail.prompt.text, /连续考验无吉星衔接风险段：.*连续3组考验星.*落于序列末尾/);

  // 连续考验星后接伏位（守成，非助益星）：12(绝命) -> 21(绝命) -> 11(伏位)
  const resRiskFuwei = numberEnergy({ value: '1211', question: '测试连续考验接伏位' });
  const relRiskFuwei = analyzeMagneticChainRelations(resRiskFuwei.data);
  assert.equal(relRiskFuwei.unrescuedRiskSegments.length, 1);
  assert.match(relRiskFuwei.unrescuedRiskSegments[0].tailReason, /伏位/);

  // 有效卦数不足（仅 0 和 5）
  const resEmpty = numberEnergy({ value: '505', question: '仅0和5' });
  assert.match(resEmpty.prompt.text, /【磁场衔接与制化关系】\n有效卦数不足，未形成磁场衔接与制化关系。/);
});
