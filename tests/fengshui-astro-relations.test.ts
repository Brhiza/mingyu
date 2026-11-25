import assert from 'node:assert/strict';
import test from 'node:test';
import { bazhai } from '../src/systems/bazhai';
import { xuankong } from '../src/systems/xuankong';
import { promptForSavedResidential, residential } from '../src/systems/residential';
import { astrolabeIndependent, promptForSavedAstrolabeIndependent } from '../src/systems/astrolabe';
import { astrolabeSynastryIndependent } from '../src/systems/astrolabe-synastry';
import { promptForSavedQizheng, qizheng } from '../src/systems/qizheng';

test('八宅：同组与异组输出客观【方位格局与理气制衡关系】与星宫制衡', () => {
  // 1990年男命为坎卦（东四命），配子山坎宅（东四宅）→ 同组
  const sameGroup = bazhai({
    question: '查看八宅方位格局',
    person: { kind: 'birth', year: 1990, month: 6, day: 15, gender: 'male' },
    house: { kind: 'mountain', sitMountain: '子' },
  });
  assert.match(sameGroup.prompt.text, /【方位格局与理气制衡关系】/);
  assert.match(sameGroup.prompt.text, /星宫制衡：吉星得势/);
  assert.match(sameGroup.prompt.text, /人宅同吉方/);
  assert.match(sameGroup.prompt.text, /人宅同凶压制方/);

  // 坎卦（东四命）配乾山乾宅（西四宅）→ 异组
  const diffGroup = bazhai({
    question: '查看异组冲突方位',
    person: { kind: 'gua', mingGua: '坎' },
    house: { kind: 'mountain', sitMountain: '乾' },
  });
  assert.match(diffGroup.prompt.text, /人吉宅凶冲突方/);
  assert.match(diffGroup.prompt.text, /宅吉人凶冲突方/);
});

test('玄空飞星：修复八运一白进气/九紫流年标签/组合去重，并输出【方位格局与理气制衡关系】', () => {
  // 八运（2010年）子山午向，叠 2024 流年
  const result = xuankong({
    question: '分析八运子山午向飞星与制衡',
    construction: { year: 2010, month: 6, day: 1 },
    orientation: { kind: 'mountain', sitMountain: '子' },
    flow: { kind: 'year', year: 2024 },
  });
  const text = result.prompt.text;
  // 八运 1 白应正确标为“进气”，9 紫为“生”，流年 9 紫不再硬编码为“九紫当旺”
  assert.match(text, /[山向]1（进气）/);
  assert.match(text, /[山向]9（生）/);
  assert.match(text, /年9\(九紫喜庆\)/);
  assert.doesNotMatch(text, /九紫当旺/);
  // 新增方位格局与理气制衡关系
  assert.match(text, /【方位格局与理气制衡关系】/);
  assert.match(text, /格局定位：/);
  assert.match(text, /旺生吉位：/);
  assert.match(text, /五黄二黑与凶煞位：/);
  assert.match(text, /五行通关化解路径：/);

  // 九运子山午向（含山星入囚/向星入囚或合十等格局时，组合行不重复出现同格局两遍）
  const p9 = xuankong({
    question: '核对九运格局去重',
    construction: { year: 2025, month: 6, day: 1 },
    orientation: { kind: 'mountain', sitMountain: '子' },
  });
  const comboLine = p9.prompt.text.split('\n').find((line) => line.startsWith('组合：')) ?? '';
  assert.doesNotMatch(comboLine, /「令星入囚」/);
  assert.match(p9.prompt.text, /【方位格局与理气制衡关系】/);
});

test('综合阳宅：输出八宅×玄空叠合【方位格局与理气制衡关系】并支持追问重算', () => {
  const input = {
    question: '综合评估八宅与玄空吉凶叠合及五黄二黑化解',
    person: { kind: 'birth' as const, year: 1990, month: 6, day: 15, gender: 'male' as const },
    orientation: { kind: 'mountain' as const, sitMountain: '子' },
    construction: { year: 2025, month: 5, day: 1 },
    flow: { kind: 'year' as const, year: 2025 },
  };
  const res = residential(input);
  assert.match(res.prompt.text, /【方位格局与理气制衡关系】/);
  assert.match(res.prompt.text, /- 同向叠加吉位：/);
  assert.match(res.prompt.text, /- 冲突争议位：/);
  assert.match(res.prompt.text, /- 五黄二黑压制位：/);
  assert.match(res.prompt.text, /- 化解路径：/);

  // 保存追问校验与原盘完全一致
  const saved = promptForSavedResidential(
    res.data,
    {
      person: input.person,
      orientation: input.orientation,
      construction: input.construction,
      flow: input.flow,
    },
    '追问化解细节',
  );
  assert.match(saved.text, /【方位格局与理气制衡关系】/);
});

test('西洋星盘本命：修复失势/落陷标签倒置并输出【相位格局与能量制衡关系】', async () => {
  // 太阳在水瓶座（2月初）→ Detriment（入庙对宫）应标“失势”而非“落陷”
  const aquariusSun = await astrolabeIndependent({
    question: '核对太阳水瓶尊贵与相位制衡',
    birth: {
      year: 1992, month: 2, day: 5, hour: 10, minute: 30,
      latitude: 31.23, longitude: 121.47, timezone: 8,
      coordinateAccuracy: 'user-provided',
    },
  });
  assert.match(aquariusSun.prompt.text, /太阳水瓶[^；\n]*（[^）]*失势/);
  assert.doesNotMatch(aquariusSun.prompt.text, /太阳水瓶[^；\n]*（[^）]*落陷/);
  assert.match(aquariusSun.prompt.text, /【相位格局与能量制衡关系】/);
  assert.match(aquariusSun.prompt.text, /相位格局制衡：/);
  assert.match(aquariusSun.prompt.text, /核心困难相位与出口：/);
  assert.match(aquariusSun.prompt.text, /元素与模式制衡：/);

  // 太阳在天秤座（10月初）→ Fall（曜升对宫）应标“落陷”而非“失势”
  const libraSun = await astrolabeIndependent({
    question: '核对太阳天秤尊贵',
    birth: {
      year: 1992, month: 10, day: 5, hour: 10, minute: 30,
      latitude: 31.23, longitude: 121.47, timezone: 8,
      coordinateAccuracy: 'user-provided',
    },
  });
  assert.match(libraSun.prompt.text, /太阳天秤[^；\n]*（[^）]*落陷/);
  assert.doesNotMatch(libraSun.prompt.text, /太阳天秤[^；\n]*（[^）]*失势/);

  const reprompt = await promptForSavedAstrolabeIndependent(
    aquariusSun.data,
    { birth: aquariusSun.data.input.birth },
    '追问相位出口',
  );
  assert.match(reprompt.text, /【相位格局与能量制衡关系】/);
});

test('西洋双人合盘：输出【相位格局与能量制衡关系】（吸引力、磨合点与元素互补）', async () => {
  const syn = await astrolabeSynastryIndependent({
    question: '看双方感情吸引力与长期磨合点',
    person1: {
      name: '甲',
      year: 1991, month: 4, day: 12, hour: 9, minute: 0,
      latitude: 39.9, longitude: 116.4, timezone: 8,
      coordinateAccuracy: 'user-provided',
    },
    person2: {
      name: '乙',
      year: 1993, month: 11, day: 20, hour: 15, minute: 30,
      latitude: 31.23, longitude: 121.47, timezone: 8,
      coordinateAccuracy: 'user-provided',
    },
  });
  assert.match(syn.prompt.text, /【相位格局与能量制衡关系】/);
  assert.match(syn.prompt.text, /跨盘相位总览：/);
  assert.match(syn.prompt.text, /和谐相位吸引力与共振轴：/);
  assert.match(syn.prompt.text, /困难相位磨合点与缓冲：/);
  assert.match(syn.prompt.text, /双方元素制衡：/);
});

test('七政四余：输出【恩用仇难与星曜制衡关系】并保持流曜追问一致', async () => {
  const input = {
    question: '分析命主度主协同与恩用仇难解救关系',
    gender: 'male' as const,
    birth: {
      year: 1990, month: 8, day: 18, hour: 14, minute: 20,
      latitude: 31.23, longitude: 121.47, timezone: 8,
    },
    flow: { kind: 'year' as const, year: 2026 },
  };
  const qz = await qizheng(input);
  assert.match(qz.prompt.text, /【恩用仇难与星曜制衡关系】/);
  assert.match(qz.prompt.text, /命主与度主协同：/);
  assert.match(qz.prompt.text, /恩星助益：/);
  assert.match(qz.prompt.text, /用星生发：/);
  assert.match(qz.prompt.text, /难仇克制与解救链：/);

  const reprompt = await promptForSavedQizheng(
    qz.data,
    { birth: input.birth, gender: input.gender, flow: input.flow },
    '追问难星解救',
  );
  assert.match(reprompt.text, /【恩用仇难与星曜制衡关系】/);
});
