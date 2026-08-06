import test from 'node:test';
import assert from 'node:assert/strict';
import { buildZiweiChartInput, calculateFullZiweiChart } from 'mingyu-core/ziwei';
import { buildCombinedZiweiCompatibilityPrompt } from 'mingyu-core/ziwei/prompt';
import { buildSerializableZiweiResult } from '../../src/lib/public-api/prompt-builders';

test('紫微 MCP 返回结果应为可 JSON 序列化的纯数据', async () => {
  const input = buildZiweiChartInput({
    name: '',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const runtime = await calculateFullZiweiChart(input);
  const result = buildSerializableZiweiResult(runtime);
  const parsed = JSON.parse(JSON.stringify(result));

  assert.equal(parsed.basicInfo.gender, '男');
  assert.deepEqual(parsed.scopeNames, [
    'origin',
    'decadal',
    'yearly',
    'monthly',
    'daily',
    'hourly',
    'age',
  ]);
  assert.equal(parsed.payloadByScope.origin.payload_version, 'analysis_payload_v1');
  assert.equal(parsed.payloadByScope.origin.language, 'zh-CN');
  assert.equal(parsed.astrolabe, undefined);
  assert.equal(parsed.horoscope, undefined);
});

test('紫微 MCP 支持中州派底层安星口径', async () => {
  const input = buildZiweiChartInput({
    name: '',
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '21',
    timeIndex: 4,
    isLeapMonth: false,
    useTrueSolarTime: false,
    algorithm: 'zhongzhou',
  });

  const runtime = await calculateFullZiweiChart(input);
  assert.equal(runtime.payloadByScope.origin.calculation_config.algorithm, 'zhongzhou');
});

test('紫微合盘主题只作为关系范围，不再注入固定问题与任务口径', async () => {
  const firstInput = buildZiweiChartInput({
    name: '甲',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const secondInput = buildZiweiChartInput({
    name: '乙',
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '21',
    timeIndex: 4,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const firstRuntime = await calculateFullZiweiChart(firstInput);
  const secondRuntime = await calculateFullZiweiChart(secondInput);

  const cooperationPrompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: firstRuntime.payloadByScope.origin,
    partnerPayload: secondRuntime.payloadByScope.origin,
    topic: 'career-wealth',
    question: '',
  });
  assert.match(cooperationPrompt, /【问题】\n请先做整体合盘解读。/);
  assert.match(cooperationPrompt, /【任务】\n请依据双方紫微盘面和跨盘关系资料完成解读。/);
  assert.doesNotMatch(cooperationPrompt, /【输出要求】|现实建议/);
  assert.match(cooperationPrompt, /分析主题：事业财运/);
  assert.doesNotMatch(
    cooperationPrompt,
    /若【问题】已限定主题|只把主题作为关系范围|不额外套用固定题目/,
  );
  assert.doesNotMatch(cooperationPrompt, /合作默契|合作分工|关系主基调/);

  const interactionPrompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: firstRuntime.payloadByScope.origin,
    partnerPayload: secondRuntime.payloadByScope.origin,
    topic: 'chat',
    question: '',
  });
  assert.match(interactionPrompt, /【问题】\n请先做整体合盘解读。/);
  assert.match(interactionPrompt, /【任务】\n请依据双方紫微盘面和跨盘关系资料完成解读。/);
  assert.doesNotMatch(interactionPrompt, /沟通盲点|整体关系匹配度/);
});

test('紫微合盘自定义问题不应额外拼接任务与输出要求', async () => {
  const firstInput = buildZiweiChartInput({
    name: '甲',
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });
  const secondInput = buildZiweiChartInput({
    name: '乙',
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '8',
    day: '21',
    timeIndex: 4,
    isLeapMonth: false,
    useTrueSolarTime: false,
  });

  const firstRuntime = await calculateFullZiweiChart(firstInput);
  const secondRuntime = await calculateFullZiweiChart(secondInput);

  const prompt = buildCombinedZiweiCompatibilityPrompt({
    primaryPayload: firstRuntime.payloadByScope.origin,
    partnerPayload: secondRuntime.payloadByScope.origin,
    topic: 'chat',
    question: '我们现在更适合继续推进关系，还是先放慢节奏？',
    isCustomQuestion: true,
  });

  assert.match(prompt, /【问题】\n我们现在更适合继续推进关系，还是先放慢节奏？/);
  assert.doesNotMatch(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /【输出要求】/);
  assert.doesNotMatch(prompt, /先判断互动主轴/);
});
