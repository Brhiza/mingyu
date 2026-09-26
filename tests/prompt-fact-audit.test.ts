import assert from 'node:assert/strict';
import test from 'node:test';
import { extractDivinationPromptFacts } from '../scripts/prompt-audit/divination-facts';
import {
  auditPromptFacts,
  assertPromptFactCoverage,
  type PromptFactExpectation,
} from '../scripts/prompt-audit/facts';

const facts: PromptFactExpectation[] = [
  {
    id: '本人年柱',
    owner: '年柱',
    values: ['甲子'],
    scope: { start: '【本人】', end: '【对方】' },
  },
  {
    id: '本人月柱',
    owner: '月柱',
    values: ['乙丑'],
    scope: { start: '【本人】', end: '【对方】' },
  },
  { id: '对方年柱', owner: '年柱', values: ['乙丑'], scope: { start: '【对方】' } },
];
const prompt = '【本人】\n年柱：甲子\n月柱：乙丑\n【对方】\n年柱：乙丑';

test('梅花事实审查在结果阶段核对变后体用与生克归属', () => {
  const changedFacts = extractDivinationPromptFacts('meihua', {
    changedName: '天火同人',
    changedTiGua: { name: '乾', element: '金' },
    changedYongGua: { name: '离', element: '火' },
    analysis: { changedTiYongRelation: '用克体' },
    evidenceAnalysis: { stages: [{ stage: 'result', status: '已计算' }] },
  }).filter((item) => item.id === 'meihua.changed');
  assert.equal(changedFacts.length, 1);
  const resultLine = '结果天火同人：体卦乾金（月令死），用卦离火（月令旺），关系用克体';
  assert.equal(auditPromptFacts(resultLine, changedFacts).present, 1);
  assert.equal(auditPromptFacts(resultLine.replace('用克体', '用生体'), changedFacts).present, 0);
  assert.equal(auditPromptFacts(resultLine.replace('结果', '过程'), changedFacts).present, 0);
});

test('事实覆盖核验归属及值，交换柱位仍有相同关键词时应检出错绑', () => {
  assert.equal(auditPromptFacts(prompt, facts).present, 3);
  const swapped = '【本人】\n年柱：乙丑\n月柱：甲子\n【对方】\n年柱：乙丑';
  assert.deepEqual(auditPromptFacts(swapped, facts).missing, ['本人年柱', '本人月柱']);
});

test('相同干支出现在另一主体或另一时段不能填补缺失事实', () => {
  const missing = prompt.replace('年柱：甲子', '年柱：未列');
  assert.deepEqual(auditPromptFacts(`${missing}\n对方备注：年柱甲子`, facts).missing, ['本人年柱']);
  const temporal: PromptFactExpectation[] = [
    {
      id: '交运前条件',
      owner: '甲子运',
      values: ['2026-02-03', '未合化'],
      scope: { start: '【交运前】', end: '【交运后】' },
    },
  ];
  assert.equal(
    auditPromptFacts(
      '【交运前】\n甲子运2026-02-03未合化\n【交运后】\n甲子运2026-02-04合化',
      temporal,
    ).present,
    1,
  );
  assert.equal(
    auditPromptFacts(
      '【交运前】\n甲子运2026-02-03合化\n【交运后】\n甲子运2026-02-03未合化',
      temporal,
    ).present,
    0,
  );
});

test('报告区分缺失与重复，整段删除或空事实清单不能通过', () => {
  assert.equal(
    auditPromptFacts(prompt.replace('月柱：乙丑', '月柱：乙丑\n月柱：乙丑'), facts).repeated[0]
      .occurrences,
    2,
  );
  assert.throws(
    () => assertPromptFactCoverage([{ name: '空样例', prompt, facts: [] }]),
    /尚未定义事实清单/,
  );
  assert.throws(
    () => assertPromptFactCoverage([{ name: '丢失主体', prompt: '【对方】\n年柱：乙丑', facts }]),
    /本人年柱/,
  );
  assert.throws(
    () => auditPromptFacts(prompt, [{ id: '空值', owner: '年柱', values: [] }]),
    /具体值/,
  );
});
