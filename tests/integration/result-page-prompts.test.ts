import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBaziZiweiEnhancedPrompt,
  formatZiweiFullScopeText,
  formatZiweiSupportingScopeText,
} from '../../src/pages/ResultPage/ResultPage.helpers';
import { buildPersonFromInput, calculateFullBaziChart } from '../../src/lib/full-chart-engine/bazi';
import {
  buildZiweiChartInput,
  calculateFullZiweiChart,
} from '../../src/lib/full-chart-engine/ziwei';
import { PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT } from '../../src/lib/prompt-guidance';
import { assertPromptHasSingleRole } from '../prompt-assertions';

const ziweiInput = buildZiweiChartInput({
  name: '本人',
  gender: 'male',
  dateType: 'solar',
  year: '1990',
  month: '5',
  day: '15',
  timeIndex: 1,
  isLeapMonth: false,
  useTrueSolarTime: false,
});

let ziweiRuntimePromise: ReturnType<typeof calculateFullZiweiChart> | undefined;

function getZiweiRuntime() {
  ziweiRuntimePromise ??= calculateFullZiweiChart(ziweiInput);
  return ziweiRuntimePromise;
}

test('单人增强提示词会保留完整任务结构并交叉校验两套盘面', async () => {
  const baziPerson = buildPersonFromInput({
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '5',
    day: '15',
    timeIndex: 1,
    isLeapMonth: false,
    useTrueSolarTime: false,
    birthHour: '',
    birthMinute: '',
    birthPlace: '',
    birthLongitude: '',
  });
  const baziResult = calculateFullBaziChart(baziPerson);
  const ziweiRuntime = await getZiweiRuntime();

  const prompt = buildBaziZiweiEnhancedPrompt({
    baziResult,
    ziweiText: `【分析背景】\n${ziweiRuntime.payloadByScope.origin.report_type || '紫微摘要'}`,
    question: '请重点分析我的事业方向和当前突破口。',
    questionScopeLabel: '事业',
    baziFortuneSummary: '八字分析对象：当前大运',
    ziweiScopeSummary: '紫微分析范围：流年 · 2028-01-01',
  });

  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT['bazi-ziwei']);
  assert.match(prompt, /【当前时间】/);
  assert.match(prompt, /【分析对象】\n八字分析对象：当前大运\n紫微分析范围：流年 · 2028-01-01/);
  assert.match(prompt, /【八字排盘信息】/);
  assert.match(prompt, /【紫微盘面信息】/);
  assert.match(prompt, /【问题范围】\n事业/);
  assert.match(prompt, /【问题】\n请重点分析我的事业方向和当前突破口。/);
  assert.match(prompt, /时间层未对齐时分开陈述/);
  assert.doesNotMatch(prompt, /在共同岁运与运限层级推演/);
  assert.doesNotMatch(prompt, /【断盘要点】|【八字分析思路】|【输出要求】|现实建议/);
});

test('紫微完整输出版会整理本命与各层运限资料', async () => {
  const ziweiRuntime = await getZiweiRuntime();
  const text = formatZiweiFullScopeText(ziweiRuntime.payloadByScope);

  assert.match(text, /完整紫微运限资料：/);
  assert.match(text, /本命：分析对象：/);
  assert.match(text, /大限：分析对象：/);
  assert.match(text, /流年：分析对象：/);
  assert.match(text, /流月：分析对象：/);
  assert.match(text, /流日：分析对象：/);
  assert.match(text, /当前四化：/);
  assert.match(text, /运限命中：/);
});

test('紫微流月解读保留大限和流年十二宫关系，不混入下层日期', async () => {
  const runtime = await getZiweiRuntime();
  const text = formatZiweiSupportingScopeText(runtime.payloadByScope, 'monthly');
  for (const scope of ['decadal', 'yearly'] as const) {
    const payload = runtime.payloadByScope[scope];
    assert.ok(text.includes(payload.active_scope.label));
    for (const palace of payload.palaces)
      assert.ok(text.includes(`落本命${palace.name.replace(/宫$/, '')}宫`));
    for (const item of payload.active_scope.mutagen_map)
      assert.ok(text.includes(`${item.star}化${item.mutagen}`));
  }
  assert.doesNotMatch(text, /流月：|流日：|流时：|宫宫/);
  assert.equal(formatZiweiSupportingScopeText(runtime.payloadByScope, 'origin'), '');
});
