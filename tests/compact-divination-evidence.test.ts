import test from 'node:test';
import assert from 'node:assert/strict';
import { getCompactDivinationSummary } from '../src/components/DivinationPanel/compact-evidence';

test('前端依据只保留关键摘要并去掉完整证据长文', () => {
  const compact = getCompactDivinationSummary({
    title: '奇门起局结果',
    tags: ['局数', '值符', '值使', '重复', '不再展示'],
    lines: [
      '干支：丙午、丙申、甲寅、丙寅',
      '节气：立秋',
      '主轴：值符落坎宫；值使落离宫',
      '格局：门迫、击刑',
      '复合格局：支持与限制并存',
      '空亡：子、丑',
      '证据：这里是一整段只需要保留在提示词里的完整证据',
    ],
  });

  assert.deepEqual(compact.tags, ['局数', '值符', '值使', '重复']);
  assert.deepEqual(compact.lines, [
    '主轴：值符落坎宫；值使落离宫',
    '格局：门迫、击刑',
    '复合格局：支持与限制并存',
    '空亡：子、丑',
  ]);
});

test('辅助起卦信息仅在关键摘要不足时补位', () => {
  const compact = getCompactDivinationSummary({
    title: '小六壬起课结果',
    tags: [],
    lines: ['主轴：占得大安', '历法口径：子初换日', '历法口径：子初换日'],
  });

  assert.deepEqual(compact.lines, ['主轴：占得大安', '历法口径：子初换日']);
});
