import assert from 'node:assert/strict';
import test from 'node:test';
import { disposeReadingResources } from '../src/lib/ai/reading-resource-lifecycle';
import type { ReadingResource } from '../src/lib/ai/reading-workflow';
import { runReadingWorkflow, type ReadingMemory } from '../src/lib/ai/reading-workflow';

const resource = (key: string, dispose?: () => Promise<void>): ReadingResource => ({
  key,
  title: key,
  text: '',
  usable: true,
  dispose,
});

test('结束会话只清理拥有的临时资料，借入页面资料无需回收', async () => {
  let released = 0;
  await disposeReadingResources([
    resource('页面'),
    resource('补算', async () => {
      released += 1;
    }),
  ]);
  assert.equal(released, 1);
});

test('换种子时保留仍引用的存储，不能按相同资料键误保留旧存储', async () => {
  const calls: string[] = [];
  const retained = resource('保留', async () => {
    calls.push('保留');
  });
  const old = resource('同键', async () => {
    calls.push('旧');
  });
  await disposeReadingResources(
    [retained, old],
    [
      { ...retained },
      resource('同键', async () => {
        calls.push('新');
      }),
    ],
  );
  assert.deepEqual(calls, ['旧']);
});

test('同一存储的多个资料引用只清理一次', async () => {
  let released = 0;
  const dispose = async () => {
    released += 1;
  };
  await disposeReadingResources([resource('一', dispose), resource('二', dispose)]);
  assert.equal(released, 1);
});

test('一份存储清理失败仍清理其余资料，并返回全部失败', async () => {
  const calls: string[] = [];
  await assert.rejects(
    disposeReadingResources([
      resource('失败', async () => {
        throw new Error('删除失败');
      }),
      resource('同步失败', () => {
        throw new Error('关闭失败');
      }),
      resource('成功', async () => {
        calls.push('成功');
      }),
    ]),
    (error: unknown) => error instanceof AggregateError && error.errors.length === 2,
  );
  assert.deepEqual(calls, ['成功']);
});

test('取消后才返回的补算资料立即回收，不能进入已经结束的会话', async () => {
  const controller = new AbortController();
  const memory: ReadingMemory = { resources: [] };
  let released = 0;
  let calls = 0;
  await runReadingWorkflow(
    [{ role: 'user', content: '请结合甲木条文解读。' }],
    {
      memory,
      signal: controller.signal,
      readingMethod: 'bazi',
      onChunk() {},
      onDone() {},
      onError() {},
      onNotice() {},
      onProgress() {},
    },
    {
      async stream(_messages, callbacks) {
        calls += 1;
        callbacks.onChunk(
          JSON.stringify({ actions: [{ kind: 'classic', method: 'bazi', query: '甲木' }] }),
        );
        callbacks.onDone();
      },
      async execute() {
        controller.abort();
        return resource('取消后的资料', async () => {
          released += 1;
        });
      },
    },
  );
  assert.equal(calls, 1);
  assert.equal(released, 1);
  assert.deepEqual(memory.resources, []);
});
