import assert from 'node:assert/strict';
import test from 'node:test';
import { parseQizhengFlowTarget } from '../src/lib/qizheng-flow-target';
import { preserveResultContextParams } from '../src/lib/case-navigation';
import { buildReadingSubject } from '../src/lib/ai/reading-subject';
import { parseInputState, createDefaultPromptState } from '../src/lib/query-state';

test('七政目标允许本命及完整有效的年月日时分，拒绝残缺日期和越界', () => {
  assert.deepEqual(parseQizhengFlowTarget(null), {});
  for (const target of [
    { flowYear: 2024 },
    { flowYear: 2024, flowMonth: 2 },
    { flowYear: 2024, flowMonth: 2, flowDay: 29, flowHour: 0, flowMinute: 0 },
  ])
    assert.deepEqual(parseQizhengFlowTarget(JSON.stringify(target)), target);
  for (const target of [
    { flowYear: 2023, flowMonth: 2, flowDay: 29 },
    { flowYear: 2024, flowDay: 2 },
    { flowYear: 2024, flowHour: 12 },
    { flowYear: 2024, flowMonth: 2, flowDay: 1, flowHour: 24 },
    { flowYear: 2024, flowMonth: 2, flowDay: 1, flowMinute: 60 },
    { flowYear: '2024' },
    { flowYear: 2201 },
    { flowYear: 2024, year: 2000 },
    [],
    null,
  ])
    assert.throws(() => parseQizhengFlowTarget(JSON.stringify(target)));
  assert.throws(() => parseQizhengFlowTarget('{'));
});

test('切换结果标签保留七政流曜目标，目标变化切换阅读身份但保持出生主体', () => {
  const target = { flowYear: 2024, flowMonth: 3, flowDay: 15 };
  const params = new URLSearchParams({ qf: JSON.stringify(target) });
  const next = preserveResultContextParams('t=prompt', params);
  assert.deepEqual(parseQizhengFlowTarget(next.get('qf')), target);
  const input = parseInputState(
    new URLSearchParams('c=astrolabe&y=2000&m=1&d=1&bh=12&bm=0&lo=116.4&la=39.9'),
  );
  const prompt = { ...createDefaultPromptState(), promptSource: 'qizheng' as const };
  const natal = buildReadingSubject(input, prompt);
  const flow = buildReadingSubject(input, prompt, target);
  const other = buildReadingSubject(input, prompt, { ...target, flowDay: 16 });
  assert.notEqual(natal.id, flow.id);
  assert.notEqual(flow.id, other.id);
  assert.deepEqual(natal.lockedInputs, flow.lockedInputs);
  assert.deepEqual(flow.range.qizhengFlowTarget, target);
});
