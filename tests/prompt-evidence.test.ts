import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatPromptEvidenceBundle,
  normalizePromptEvidenceItems,
} from '@core/prompt-evidence/format';

test('证据资料包会过滤空标题、去重并按证据等级输出', () => {
  const lines = formatPromptEvidenceBundle({
    items: [
      { level: '辅证', title: '  流月触发  ', detail: '短期推进' },
      { level: '主证', title: '流年干支', detail: '年度主触发', source: '年限选择器' },
      { level: '主证', title: '流年干支', detail: '年度主触发', source: '年限选择器' },
      { level: '限制', title: '   ', detail: '不会输出' },
      { level: '反证', title: '未见明显刑冲', tags: ['保守', '  合冲刑害  '] },
    ],
  });

  assert.deepEqual(lines, [
    '【主证】流年干支｜年度主触发｜来源：年限选择器',
    '【辅证】流月触发｜短期推进',
    '【反证】未见明显刑冲｜标签：保守、合冲刑害',
  ]);
});

test('证据资料包按证据等级稳定排序', () => {
  const items = normalizePromptEvidenceItems([
    { level: '应期', title: '节气窗口' },
    { level: '主证', title: '所选运限' },
    { level: '限制', title: '未选择下层时间' },
    { level: '辅证', title: '旁证星曜' },
  ]);

  assert.deepEqual(
    items.map((item) => item.level),
    ['主证', '辅证', '限制', '应期'],
  );
});

test('证据资料包为空时可返回保守占位', () => {
  assert.deepEqual(formatPromptEvidenceBundle({ items: [], emptyText: '- 暂无' }), ['- 暂无']);
});

test('证据资料包应拒绝无效等级', () => {
  assert.throws(
    () => normalizePromptEvidenceItems([{ level: '强证' as never, title: '错误等级' }]),
    /证据等级无效/,
  );
});

test('证据资料包应拒绝非文本标签和非数组条目', () => {
  assert.throws(() => normalizePromptEvidenceItems([null as never]), /证据条目必须是对象/);
  assert.throws(
    () =>
      normalizePromptEvidenceItems([
        { level: '主证', title: '标签类型错误', tags: '合冲刑害' as never },
      ]),
    /证据标签必须是文本数组/,
  );
  assert.throws(
    () => normalizePromptEvidenceItems({ level: '主证', title: '不是数组' } as never),
    /证据条目必须是数组/,
  );
});
