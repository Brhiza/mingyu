import assert from 'node:assert/strict';
import test from 'node:test';
import {
  distillPromptForAgent,
  distillPromptForUser,
  splitPromptIntoSystemAndUser,
} from '../src/prompt-profile';
import { generateChartFollowUps } from '../src/router-model/local-agent';
import { resolveFocusPresetsForContext } from '../src/systems/focus-presets';
import { createDefaultPersonalCase } from '../src/v2-ui/cases-store';
import { buildPersonalChartPayload } from '../src/v2-ui/chart-payloads';
import { PERSONAL_CHART_TABS } from '../src/v2-ui/chart-tabs';
import {
  ALL_HECAN_SYSTEMS,
  getAvailableHecanSystems,
  runMultiHecan,
  toggleHecanSystem,
  type HecanComputedEntry,
} from '../src/v2-ui/multi-hecan';

const exactPerson = createDefaultPersonalCase({
  id: 'test-exact',
  name: '测试命造',
  gender: 'female',
  calendar: 'solar',
  year: '1990',
  month: '5',
  day: '15',
  timeIndex: 7,
  birthHour: '14',
  birthMinute: '30',
  birthSecond: '0',
  useTrueSolarTime: true,
  birthPlace: '北京市东城区',
  longitude: 116.4,
  latitude: 39.9,
  timezone: 8,
});

const unknownPerson = createDefaultPersonalCase({
  id: 'test-unknown',
  name: '未知时辰命造',
  gender: 'male',
  calendar: 'solar',
  year: '1992',
  month: '8',
  day: '20',
  timeIndex: 'unknown',
  birthHour: '',
  birthMinute: '',
  birthSecond: '',
  useTrueSolarTime: false,
});

const lunarPerson = createDefaultPersonalCase({
  id: 'test-lunar',
  name: '农历命造',
  gender: 'male',
  calendar: 'lunar',
  isLeapMonth: false,
  year: '1990',
  month: '1',
  day: '1',
  timeIndex: 6,
  birthHour: '12',
  birthMinute: '0',
  birthSecond: '0',
  useTrueSolarTime: true,
  birthPlace: '北京市',
  longitude: 116.4,
  latitude: 39.9,
  timezone: 8,
});

test('合参标签与命录依次位于个人排盘标签栏末尾且预设侧重点不串味', () => {
  assert.equal(PERSONAL_CHART_TABS.at(-2)?.id, 'bazi-ziwei');
  assert.equal(PERSONAL_CHART_TABS.at(-2)?.shortLabel, '合参');
  assert.equal(PERSONAL_CHART_TABS.at(-1)?.id, 'minglu');
  assert.equal(PERSONAL_CHART_TABS.at(-1)?.shortLabel, '命录');

  const presets = resolveFocusPresetsForContext('personal', 'bazi-ziwei');
  assert.ok(presets.length >= 4);
  const combined = presets.map((p) => `${p.label}:${p.prompt}`).join('\n');
  assert.doesNotMatch(combined, /调候|正偏财库/);
  assert.match(combined, /跨盘|共振/);
});

test('toggleHecanSystem 保持规范排序且至少保留 1 项术数', () => {
  const added = toggleHecanSystem(['bazi', 'ziwei'], 'astrolabe');
  assert.deepEqual(added, ['bazi', 'ziwei', 'astrolabe']);

  const reordered = toggleHecanSystem(['ziwei', 'qizheng'], 'bazi');
  assert.deepEqual(reordered, ['bazi', 'ziwei', 'qizheng']);

  const removed = toggleHecanSystem(['bazi', 'ziwei'], 'bazi');
  assert.deepEqual(removed, ['ziwei']);

  const minGuard = toggleHecanSystem(['ziwei'], 'ziwei');
  assert.deepEqual(minGuard, ['ziwei']);
});

test('默认八字+紫微合参生成五层合成结构与互证', async () => {
  const { result } = await runMultiHecan({
    person: exactPerson,
    selectedSystems: ['bazi', 'ziwei'],
    question: '请看事业发展方向',
    options: { applyGlobalRules: false },
  });

  assert.equal(result.data.kind, 'multi-hecan');
  assert.deepEqual(result.data.computedSystems, ['bazi', 'ziwei']);
  assert.ok(result.data.corroboration);
  assert.match(result.prompt.text, /【命主基准与合参范围】/);
  assert.match(result.prompt.text, /【跨体系主题矩阵】/);
  assert.match(result.prompt.text, /【跨体系共振与分歧预筛】/);
  assert.match(result.prompt.text, /【一、八字精要】/);
  assert.match(result.prompt.text, /【二、紫微斗数精要】/);
  assert.match(result.prompt.text, /【解读与交付契约】/);
  assert.equal(result.prompt.text.match(/【问题】/g)?.length ?? 0, 1);
  assert.equal(result.prompt.text.match(/【任务】/g)?.length ?? 0, 0);
});

test('非八字组合不泄露八字/十神/八字紫微术语，且主题维度自动置顶', async () => {
  const subsetA = await runMultiHecan({
    person: exactPerson,
    selectedSystems: ['ziwei', 'astrolabe'],
    question: '感情相处建议',
    options: { applyGlobalRules: false },
  });
  assert.deepEqual(subsetA.result.data.computedSystems, ['ziwei', 'astrolabe']);
  assert.match(subsetA.result.prompt.text, /【一、紫微斗数精要】/);
  assert.match(subsetA.result.prompt.text, /【二、西洋星盘精要】/);
  assert.doesNotMatch(subsetA.result.prompt.text, /八字|十神|八字紫微|星平合参/);
  // 感情主题应置顶于【跨体系主题矩阵】首行
  assert.match(subsetA.result.prompt.text, /【跨体系主题矩阵】\n- 感情人际：/);

  const subsetB = await runMultiHecan({
    person: exactPerson,
    selectedSystems: ['qizheng', 'qimen-lifetime'],
    question: '事业与阶段运势',
    options: { applyGlobalRules: false },
  });
  assert.deepEqual(subsetB.result.data.computedSystems, ['qizheng', 'qimen-lifetime']);
  assert.match(subsetB.result.prompt.text, /【一、七政四余精要】/);
  assert.match(subsetB.result.prompt.text, /【二、奇门终身局精要】/);
  assert.doesNotMatch(subsetB.result.prompt.text, /八字|十神|八字紫微/);
});

test('全选 5 大术数精炼高密、去重基准信息并保留全部五节', async () => {
  const { result } = await runMultiHecan({
    person: exactPerson,
    selectedSystems: ALL_HECAN_SYSTEMS,
    question: '综合看性格与事业',
    options: { flowYear: 2028, applyGlobalRules: false },
  });

  assert.equal(result.data.computedSystems.length, 5);
  assert.deepEqual(result.data.omitted, []);
  assert.ok(result.data.crossResonance);
  assert.ok(
    result.data.crossResonance!.resonances.length + result.data.crossResonance!.divergences.length >= 1,
  );

  const headings = [
    '【一、八字精要】',
    '【二、紫微斗数精要】',
    '【三、西洋星盘精要】',
    '【四、七政四余精要】',
    '【五、奇门终身局精要】',
  ];
  for (const heading of headings) {
    assert.ok(result.prompt.text.includes(heading), `原始提示词缺少 ${heading}`);
  }

  const userDistilled = distillPromptForUser(result.prompt.text);
  const agentDistilled = distillPromptForAgent(result.prompt.text);
  assert.ok(userDistilled.length < 9000, `全选精简提示词应控制在 9000 字内，当前 ${userDistilled.length}`);
  assert.equal(userDistilled.match(/【命主基准与合参范围】/g)?.length ?? 0, 1);

  for (const heading of headings) {
    assert.ok(userDistilled.includes(heading), `user 提纯丢失 ${heading}`);
    assert.ok(agentDistilled.includes(heading), `agent 提纯丢失 ${heading}`);
  }

  const split = splitPromptIntoSystemAndUser(userDistilled);
  assert.ok(split.system?.includes('【解读与交付契约】'));
  assert.ok(split.user.includes('【跨体系主题矩阵】'));
  assert.ok(split.user.includes('【五、奇门终身局精要】'));
});

test('未知时辰时如实省略需要精确时辰的术数并记录 omitted', async () => {
  const available = getAvailableHecanSystems(unknownPerson);
  assert.deepEqual(available, ['bazi', 'ziwei']);

  const { result } = await runMultiHecan({
    person: unknownPerson,
    selectedSystems: ALL_HECAN_SYSTEMS,
    question: '综合分析',
    options: { applyGlobalRules: false },
  });

  assert.deepEqual(result.data.computedSystems, ['bazi', 'ziwei']);
  assert.deepEqual(
    result.data.omitted.map((item) => item.id),
    ['astrolabe', 'qizheng', 'qimen-lifetime'],
  );
  assert.match(result.prompt.text, /未纳入：.*西洋星盘（未知时辰）/);
});

test('农历生日可准确换算并完成星盘与七政合参', async () => {
  const bazhaiPayload = buildPersonalChartPayload(lunarPerson, 'bazhai', '测试', {
    bazhaiSitMountain: '子',
  }) as { person: { year: number; month: number; day: number } };
  assert.equal(bazhaiPayload.person.year, 1990);
  assert.equal(bazhaiPayload.person.month, 1);
  assert.equal(bazhaiPayload.person.day, 27);

  const { result } = await runMultiHecan({
    person: lunarPerson,
    selectedSystems: ['bazi', 'astrolabe', 'qizheng'],
    question: '农历出生合参测试',
    options: { applyGlobalRules: false },
  });
  assert.deepEqual(result.data.computedSystems, ['bazi', 'astrolabe', 'qizheng']);
  assert.deepEqual(result.data.omitted, []);
});

test('per-system 缓存命中复用：增选新术数时不重复计算已缓存体系', async () => {
  const cache = new Map<string, HecanComputedEntry>();
  const first = await runMultiHecan({
    person: exactPerson,
    selectedSystems: ['bazi', 'ziwei'],
    question: '第一问',
    options: { cache, rulesSig: 'default', applyGlobalRules: false },
  });
  const cachedBazi = cache.get([...cache.keys()].find((k) => k.includes('::bazi::'))!);
  const cachedZiwei = cache.get([...cache.keys()].find((k) => k.includes('::ziwei::'))!);
  assert.ok(cachedBazi && cachedZiwei);
  assert.equal(first.computedMap.bazi, cachedBazi);

  const second = await runMultiHecan({
    person: exactPerson,
    selectedSystems: ['bazi', 'ziwei', 'astrolabe'],
    question: '第二问',
    options: { cache, rulesSig: 'default', applyGlobalRules: false },
  });
  assert.equal(second.computedMap.bazi, cachedBazi);
  assert.equal(second.computedMap.ziwei, cachedZiwei);
  assert.ok(second.computedMap.astrolabe);
});

test('generateChartFollowUps 为多术数合参生成动态追问建议', async () => {
  const { result } = await runMultiHecan({
    person: exactPerson,
    selectedSystems: ['bazi', 'ziwei', 'astrolabe'],
    question: '综合分析',
    options: { applyGlobalRules: false },
  });
  const followUps = generateChartFollowUps('bazi-ziwei', result);
  assert.ok(followUps.length >= 2 && followUps.length <= 4);
  assert.ok(followUps.some((item) => item.id === 'hecan-resonance'));
});
