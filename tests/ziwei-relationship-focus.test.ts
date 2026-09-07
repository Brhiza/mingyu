import assert from 'node:assert/strict';
import { test } from 'node:test';

import { baziCalculator } from 'mingyu-core/bazi';
import {
  buildBaziZiweiPrompt,
  buildZiweiTaskBookPrompt,
  buildThematicConsultationPrompt,
} from 'mingyu-core/prompt';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei/runtime';
import { buildZiweiTaskBookSnapshot } from 'mingyu-core/ziwei/prompt';

test('紫微斗数在婚恋与感情主题下必须完整输出夫妻宫及三方四正对宫细节', async () => {
  const draft = {
    name: '感情测试',
    gender: 'female',
    dateType: 'solar',
    year: 1992,
    month: 8,
    day: 18,
    timeIndex: 6,
  } as const;

  const runtime = await calculateZiweiChart(buildZiweiChartInput(draft), {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2026-08-06', hourIndex: 6 },
  });
  const payload = runtime.payloadByScope.origin;
  assert.ok(payload, '必须成功计算紫微本命 payload');

  // 1. 测试 buildZiweiTaskBookSnapshot 在 marriage / relationship 主题下
  const reportContextMarriage = {
    report_key: 'test:marriage',
    report_title: '紫微提示词',
    report_type: 'single' as const,
    selectedTopic: 'marriage',
    scope: 'origin' as const,
    focus_notes: [],
  };
  const snapshotMarriage = buildZiweiTaskBookSnapshot({
    payload,
    reportContext: reportContextMarriage,
  });

  assert.match(snapshotMarriage, /【重点宫位资料】/, '任务书快照必须包含【重点宫位资料】');
  assert.match(snapshotMarriage, /宫位[：:]\s*夫妻/i, '婚恋主题下重点宫位资料必须明确包含夫妻宫');
  assert.match(snapshotMarriage, /对宫[：:]\s*官禄/i, '夫妻宫输出必须包含对宫官禄宫关联');
  assert.match(snapshotMarriage, /三方四正[：:]/i, '夫妻宫输出必须包含三方四正互动');

  // 2. 测试 relationship 别名主题
  const reportContextRelationship = {
    report_key: 'test:relationship',
    report_title: '紫微提示词',
    report_type: 'single' as const,
    selectedTopic: 'relationship',
    scope: 'origin' as const,
    focus_notes: [],
  };
  const snapshotRelationship = buildZiweiTaskBookSnapshot({
    payload,
    reportContext: reportContextRelationship,
  });
  assert.match(
    snapshotRelationship,
    /宫位[：:]\s*夫妻/i,
    'relationship 别名下重点宫位资料必须明确包含夫妻宫',
  );

  // 3. 测试 buildThematicConsultationPrompt 单紫微体系
  const thematicPrompt = buildThematicConsultationPrompt({
    system: 'ziwei',
    topic: 'relationship',
    ziweiResult: runtime,
  });
  assert.match(thematicPrompt.prompt, /夫妻宫/i, '大类主题咨询提示词必须包含夫妻宫');
  assert.match(thematicPrompt.prompt, /主星[：:].*贪狼/i, '夫妻宫必须输出其主星与庙旺细节');
  assert.match(thematicPrompt.prompt, /宫干飞化[：:]/i, '夫妻宫必须输出飞星走向细节');

  // 4. 测试八字紫微合参中的婚恋主题
  const bazi = baziCalculator.calculateBazi({
    year: 1992,
    month: 8,
    day: 18,
    hour: 12,
    minute: 0,
    gender: 'female',
  });
  const baziZiweiDoc = buildBaziZiweiPrompt({
    bazi,
    ziwei: runtime,
    topic: '婚恋情感',
    question: '感情发展如何？',
  });
  assert.match(baziZiweiDoc, /夫妻宫/i, '八字紫微合参在婚恋主题下紫微盘面必须包含夫妻宫');
});
