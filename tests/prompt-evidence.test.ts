import test from 'node:test';
import assert from 'node:assert/strict';

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
