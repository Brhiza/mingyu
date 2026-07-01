import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  formatPromptEvidenceBundle,
  normalizePromptEvidenceItems,
} from '../src/lib/prompt-evidence/format';

test('证据资料包会过滤空标题、去重并按权重降序输出', () => {
  const lines = formatPromptEvidenceBundle({
    items: [
      { level: '辅证', title: '  流月触发  ', detail: '短期推进', weight: 20 },
      { level: '主证', title: '流年干支', detail: '年度主触发', source: '年限选择器', weight: 90 },
      { level: '主证', title: '流年干支', detail: '年度主触发', source: '年限选择器', weight: 90 },
      { level: '限制', title: '   ', detail: '不会输出', weight: 999 },
      { level: '反证', title: '未见明显刑冲', weight: 50, tags: ['保守', '  合冲刑害  '] },
    ],
  });

  assert.deepEqual(lines, [
    '【主证】流年干支｜年度主触发｜来源：年限选择器',
    '【反证】未见明显刑冲｜标签：保守、合冲刑害',
    '【辅证】流月触发｜短期推进',
  ]);
});

test('证据资料包同权重时按证据等级稳定排序', () => {
  const items = normalizePromptEvidenceItems([
    { level: '应期', title: '节气窗口', weight: 10 },
    { level: '主证', title: '所选运限', weight: 10 },
    { level: '限制', title: '未选择下层时间', weight: 10 },
    { level: '辅证', title: '旁证星曜', weight: 10 },
  ]);

  assert.deepEqual(
    items.map((item) => item.level),
    ['主证', '辅证', '限制', '应期'],
  );
});

test('证据资料包为空时可返回保守占位', () => {
  assert.deepEqual(formatPromptEvidenceBundle({ items: [], emptyText: '- 暂无' }), ['- 暂无']);
});

test('六爻用神评分已接入统一证据类型再格式化为现有文案', () => {
  const source = readFileSync(resolve('src/lib/divination/engine/formatters.ts'), 'utf8');

  assert.match(source, /PromptEvidenceItem/);
  assert.match(source, /createLiuyaoUsefulGodScoreEvidenceItems/);
  assert.match(source, /formatLiuyaoUsefulGodScoreEvidence/);
  assert.match(source, /source: '六爻用神评分'/);
});

test('八字年限触发摘要已通过统一证据类型生成', () => {
  const source = readFileSync(resolve('packages/core/src/bazi/fortuneSelection/index.ts'), 'utf8');

  assert.match(source, /formatPromptEvidenceBundle/);
  assert.match(source, /PromptEvidenceItem\[\]/);
  assert.match(source, /function buildFortuneEvidenceLines/);
  assert.match(source, /title: '用户已选择年限运限'/);
  assert.match(source, /title: '断事层级限制'/);
});

test('紫微运限命中摘要已通过统一证据类型生成', () => {
  const source = readFileSync(resolve('src/lib/ziwei-prompts/builders.ts'), 'utf8');

  assert.match(source, /formatPromptEvidenceBundle/);
  assert.match(source, /PromptEvidenceItem\[\]/);
  assert.match(source, /export function buildScopeHitSummary/);
  assert.match(source, /title: '所选运限落宫'/);
  assert.match(source, /title: '当前运限四化飞入'/);
  assert.match(source, /title: '本命与运限边界'/);
});

test('择日禁忌筛查和取舍证据已接入统一证据类型', () => {
  const source = readFileSync(resolve('src/lib/divination/engine/formatters.ts'), 'utf8');

  assert.match(source, /normalizePromptEvidenceItems/);
  assert.match(source, /function createAlmanacTabooEvidenceItems/);
  assert.match(source, /function createAlmanacSelectionEvidenceItems/);
  assert.match(source, /source: '择日禁忌筛查'/);
  assert.match(source, /source: '择日取舍证据'/);
  assert.match(source, /selectionEvidenceItems/);
  assert.match(source, /tabooEvidenceItems/);
});
