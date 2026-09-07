import assert from 'node:assert/strict';
import test from 'node:test';
import { loadPersonalHistory, upsertPersonalHistory } from '../src/lib/history-records';
import { defaultInputState, type QueryInputState } from '../src/lib/query-state';

function createInput(name: string): QueryInputState {
  return {
    ...defaultInputState,
    name,
    year: '2000',
    month: '1',
    day: '1',
    timeIndex: 0,
  };
}

function withMockStorage(
  run: (storage: Map<string, string>, setFail: (value: boolean) => void) => void,
) {
  const storage = new Map<string, string>();
  let failWrites = false;
  const originalWindow = globalThis.window;
  const localStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
      if (failWrites) throw new Error('quota exceeded');
      storage.set(key, value);
    },
    removeItem(key: string) {
      storage.delete(key);
    },
  } as Storage;

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage, dispatchEvent: () => true },
  });

  try {
    run(storage, (value) => {
      failWrites = value;
    });
  } finally {
    if (originalWindow === undefined) {
      // @ts-expect-error Node 测试环境下允许删除临时挂载的 window
      delete globalThis.window;
    } else {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  }
}

test('案例存储写入失败时保留旧记录并向调用方报告失败', () => {
  withMockStorage((storage, setFail) => {
    const original = upsertPersonalHistory(createInput('旧案例'), 'bazi')[0];
    const before = storage.get('prompt_studio_personal_history_v1');
    assert.ok(original);
    assert.ok(before);

    setFail(true);
    assert.throws(() => upsertPersonalHistory(createInput('新案例'), 'bazi'), /原有案例未被改动/);
    assert.equal(storage.get('prompt_studio_personal_history_v1'), before);
    assert.deepEqual(
      loadPersonalHistory().map((item) => item.name),
      ['旧案例'],
    );
  });
});

test('历史记录中的损坏条目被隔离而不影响有效案例读取', () => {
  withMockStorage((storage) => {
    const valid = upsertPersonalHistory(createInput('有效案例'), 'bazi')[0];
    storage.set(
      'prompt_studio_personal_history_v1',
      JSON.stringify([{ type: 'single', name: '损坏案例' }, valid]),
    );

    const records = loadPersonalHistory();
    assert.deepEqual(
      records.map((item) => item.name),
      ['有效案例'],
    );
    assert.equal(records[0]?.input.name, '有效案例');
  });
});
