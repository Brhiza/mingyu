import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { baziCalculator } from 'mingyu-core/bazi';
import {
  buildBaziZiweiPrompt,
  buildZiweiTaskBookPrompt,
  buildThematicConsultationPrompt,
} from 'mingyu-core/prompt';
import { buildZiweiChartInput, calculateZiweiChart } from 'mingyu-core/ziwei/runtime';
import { buildZiweiTaskBookSnapshot } from 'mingyu-core/ziwei/prompt';

test('紫微焦点在新进程只加载主题配置与宫位叶模块', () => {
  const output = execFileSync(
    process.execPath,
    [
      '-e',
      `
      require('tsx/cjs');
      const path = require('node:path');
      const coreRoot = path.resolve('packages/core/src') + path.sep;
      const { buildFocusTaskBundle } = require(coreRoot + 'ziwei/prompt/focus.ts');
      const names = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '交友', '官禄', '田宅', '福德', '父母'];
      const payload = {
        active_scope: { scope: 'origin', palace_index: 0, mutagen_map: [] },
        palaces: names.map((name, index) => ({
          index, name, is_body_palace: index === 10,
          major_stars: [], minor_stars: [], other_stars: [], scope_hits: [],
          opposite_palace_index: (index + 6) % 12,
          surrounded_palace_indexes: [index, (index + 6) % 12, (index + 4) % 12, (index + 8) % 12],
        })),
      };
      const result = buildFocusTaskBundle(payload, { scope: 'origin', selectedTopic: ' MARRIAGE ' });
      process.stdout.write(JSON.stringify({
        palaces: result.focusPalaces.map(palace => palace.name),
        modules: Object.keys(require.cache).filter(name => name.startsWith(coreRoot)).map(name => name.slice(coreRoot.length).split(path.sep).join('/')),
      }));
      `,
    ],
    { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 30_000 },
  );
  const result = JSON.parse(output) as { palaces: string[]; modules: string[] };
  assert.deepEqual(result.palaces.slice(0, 4), ['夫妻', '官禄', '福德', '迁移']);
  assert.ok(result.modules.some((name) => name.startsWith('prompt/')));
  assert.deepEqual(
    result.modules.filter(
      (name) => !/^prompt\//u.test(name) && !/^ziwei\/(?:prompt|iztro)\//u.test(name),
    ),
    [],
  );
  assert.deepEqual(
    result.modules.filter((name) => /^prompt\//u.test(name)).sort(),
    ['prompt/framework.ts', 'prompt/thematic-topics.ts'],
    '主题规范化不应回到任务书组装、公开聚合或八字规则',
  );
});

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
  assert.match(snapshotMarriage, /对宫官禄/i, '夫妻宫输出必须包含对宫官禄宫关联');
  assert.match(snapshotMarriage, /三合会照/, '夫妻宫输出必须包含三方四正互动');

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
