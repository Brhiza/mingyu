import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAstrolabeDynamicRange } from 'mingyu-core/divination/astrolabe-dynamic-range';
import {
  runReadingWorkflow,
  type ReadingMemory,
  type ReadingResource,
} from '../src/lib/ai/reading-workflow';
import type { ReadingSubjectSnapshot } from '../src/lib/ai/reading-subject';
import type { ReadingResourceReplay } from '../src/lib/ai/reading-resource-replay';
import { normalizeAiChatHistory } from '../src/lib/ai/chat-history';

const start = Date.parse('2024-03-20T11:00:00+08:00');
const { branches, ...summary } = generateAstrolabeDynamicRange(
  {
    name: '公开恢复验证',
    gender: '男',
    year: '2024',
    month: '3',
    day: '20',
    hour: '11',
    minute: '0',
    second: '0',
    longitude: '116.416334',
    latitude: '39.9042',
    timezone: '8',
  },
  { startTimestamp: start, endTimestamp: start + 1000 },
  { scope: 'daily', referenceDate: '2028-03-20' },
);
const subject: ReadingSubjectSnapshot = {
  id: 'public-replay',
  source: 'bazi',
  allowedMethods: ['astrolabe'],
  lockedInputs: { astrolabe: {}, astrolabePartner: {} },
  range: {},
};
const replay = (target: 'primary' | 'partner'): ReadingResourceReplay => ({
  key: target,
  action: {
    kind: 'calculate',
    method: 'astrolabe',
    target,
    input: { astrolabeScope: 'daily', astrolabeScopeDate: '2028-03-20' },
  },
});
const resource = (target: 'primary' | 'partner'): ReadingResource => ({
  key: target,
  title: target === 'primary' ? '本人资料' : '对方资料',
  text: '',
  usable: true,
  replay: replay(target).action,
  dynamicTarget: target,
  dynamicAstrolabe: {
    key: target,
    subjectId: subject.id,
    summary,
    promptOptions: { question: '学习安排' },
    readBranch: async (index) => branches[index],
  },
});
async function round(
  memory: ReadingMemory,
  extra: {
    execute?: (action: ReadingResourceReplay['action']) => Promise<ReadingResource>;
    initialPrompt?: string;
  } = {},
) {
  const prompts: string[] = [];
  const errors: string[] = [];
  let done = false;
  await runReadingWorkflow(
    [{ role: 'user', content: '继续下一批' }],
    {
      memory,
      subject,
      readingMethod: 'bazi',
      initialPrompt: extra.initialPrompt ?? '原始盘面与问题',
      onChunk() {},
      onProgress() {},
      onNotice() {},
      onDone() {
        done = true;
      },
      onError(text) {
        errors.push(text);
      },
    },
    {
      async stream(messages, callbacks) {
        prompts.push(messages.map((m) => m.content).join('\n'));
        callbacks.onChunk('当前资料的阶段判断。');
        callbacks.onDone();
      },
      async execute(action) {
        assert.notEqual(action.kind, 'schema');
        if (extra.execute) return extra.execute(action as ReadingResourceReplay['action']);
        throw new Error('不应重新补算');
      },
    },
  );
  return { prompts, errors, done };
}

test('跨术数双主体逐页解读保存可恢复进度，重建后从下一页继续', async () => {
  const memory: ReadingMemory = { resources: [resource('primary'), resource('partner')] };
  const initialPrompt = '公开原始资料'.repeat(2200);
  const first = await round(memory, { initialPrompt });
  assert.deepEqual(first.errors, []);
  assert.equal(first.done, true);
  assert.equal(memory.astrolabeDynamicReading?.version, 2);
  assert.equal(memory.astrolabeDynamicReading?.completedPages, 1);
  assert.equal(first.prompts.length, 2);
  assert.ok(first.prompts.every((prompt) => prompt.length < 40000));
  const checkpoint = JSON.parse(JSON.stringify(memory.astrolabeDynamicReading));
  const restored: ReadingMemory = {
    resources: [],
    astrolabeDynamicReading: checkpoint,
    restoreActions: [replay('primary'), replay('partner')],
  };
  const targets: unknown[] = [];
  const next = await round(restored, {
    initialPrompt,
    async execute(action) {
      assert.equal(action.kind, 'calculate');
      if (action.kind !== 'calculate') throw new Error('类型错误');
      targets.push(action.target);
      return resource(action.target ?? 'primary');
    },
  });
  assert.deepEqual(next.errors, []);
  assert.deepEqual(targets, ['primary', 'partner']);
  assert.equal(restored.astrolabeDynamicReading?.completedPages, 2);
  assert.equal(restored.restoreActions, undefined);
  assert.notEqual(first.prompts[0], next.prompts[0]);
});

test('恢复缺少资料或资料身份改变时不调用模型，不推进进度', async () => {
  const memory: ReadingMemory = { resources: [resource('primary')] };
  await round(memory);
  for (const resources of [
    [],
    [
      {
        ...resource('primary'),
        dynamicAstrolabe: { ...resource('primary').dynamicAstrolabe!, key: '不同资料' },
      },
    ],
  ]) {
    const restored: ReadingMemory = {
      resources,
      astrolabeDynamicReading: structuredClone(memory.astrolabeDynamicReading),
    };
    const result = await round(restored);
    assert.equal(result.prompts.length, 0);
    assert.equal(result.errors.length, 1);
    assert.deepEqual(restored.astrolabeDynamicReading, memory.astrolabeDynamicReading);
  }
});

test('第二份资料恢复失败时保留第一份，下次只重算失败资料', async () => {
  const memory: ReadingMemory = {
    resources: [],
    restoreActions: [replay('primary'), replay('partner')],
  };
  const first = await round(memory, {
    async execute(action) {
      if (action.kind !== 'calculate') throw new Error('类型错误');
      if (action.target === 'partner') throw new Error('合成恢复失败');
      return resource('primary');
    },
  });
  assert.deepEqual(first.errors, ['合成恢复失败']);
  assert.equal(first.prompts.length, 0);
  assert.equal(memory.resources.length, 1);
  const targets: unknown[] = [];
  const second = await round(memory, {
    async execute(action) {
      if (action.kind !== 'calculate') throw new Error('类型错误');
      targets.push(action.target);
      return resource('partner');
    },
  });
  assert.deepEqual(second.errors, []);
  assert.deepEqual(targets, ['partner']);
});

test('历史记录保留多源进度及重算描述，损坏重算描述不会丢失进度', async () => {
  const memory: ReadingMemory = { resources: [resource('primary')] };
  await round(memory);
  for (const dynamicReplays of [[replay('primary')], [{ key: '', action: {} }]]) {
    const history = normalizeAiChatHistory({
      version: 2,
      activeSessionId: 'public',
      sessions: [
        {
          id: 'public',
          title: '公开验证',
          initialQuestion: '学习安排',
          promptMode: 'context-question',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
          turns: [
            {
              role: 'assistant',
              content: '已完成一页',
              dynamicReading: memory.astrolabeDynamicReading,
              dynamicReplays,
            },
          ],
        },
      ],
    });
    const turn = history.sessions[0].turns[0];
    assert.deepEqual(turn.dynamicReading, memory.astrolabeDynamicReading);
    assert.equal(turn.incomplete, undefined);
    assert.deepEqual(turn.dynamicReplays, dynamicReplays[0].key ? dynamicReplays : undefined);
  }
});

test('普通资料规划补算动态范围后立即转入逐页解读', async () => {
  const memory: ReadingMemory = {
    resources: [
      {
        key: JSON.stringify({ kind: 'schema', method: 'astrolabe' }),
        title: '参数',
        text: '{"properties":{"astrolabeScope":{},"astrolabeScopeDate":{}}}',
        kind: 'schema',
        usable: false,
      },
    ],
  };
  let calls = 0;
  let done = false;
  await runReadingWorkflow(
    [{ role: 'user', content: '请补充双方目标时段并解读。' }],
    {
      memory,
      subject,
      readingMethod: 'astrolabe',
      onChunk() {},
      onNotice() {},
      onProgress() {},
      onError(error) {
        assert.fail(error);
      },
      onDone() {
        done = true;
      },
    },
    {
      async stream(_messages, callbacks) {
        calls++;
        callbacks.onChunk(
          calls === 1
            ? JSON.stringify({ actions: [replay('primary').action, replay('partner').action] })
            : '本页资料支持的判断与范围。',
        );
        callbacks.onDone();
      },
      async execute(action) {
        assert.equal(action.kind, 'calculate');
        if (action.kind !== 'calculate') throw new Error('类型错误');
        return resource(action.target ?? 'primary');
      },
    },
  );
  assert.equal(done, true);
  assert.equal(calls, 3);
  assert.equal(memory.astrolabeDynamicReading?.version, 2);
  assert.equal(memory.astrolabeDynamicReading?.completedPages, 1);
  assert.equal(memory.resources.filter((item) => item.dynamicAstrolabe).length, 2);
});
