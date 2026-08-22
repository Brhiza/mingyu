import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadPersonalHistory,
  markPersonalHistoryUsed,
  removePersonalHistory,
  upsertPersonalHistory,
} from '../src/lib/history-records.ts';
import { defaultInputState } from '../src/lib/query-state.ts';

function installMemoryStorage() {
  const values = new Map<string, string>();
  const localStorage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage,
      dispatchEvent: () => true,
    },
  });
}

test('编辑已有案例时保留稳定标识且不会新增重复案例', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  installMemoryStorage();

  try {
    const created = upsertPersonalHistory({
      ...defaultInputState,
      name: '',
      year: '1992',
      month: '6',
      day: '18',
      timeIndex: '6',
    })[0];

    assert.ok(created);
    assert.equal(created.name, '案例');

    upsertPersonalHistory(
      {
        ...created.input,
        day: '19',
      },
      created.id,
    );

    const records = loadPersonalHistory();
    assert.equal(records.length, 1);
    assert.equal(records[0]?.id, created.id);
    assert.equal(records[0]?.name, '案例');
    assert.equal(records[0]?.input.day, '19');

    const second = upsertPersonalHistory({
      ...defaultInputState,
      name: '第二份案例',
      year: '1995',
      month: '8',
      day: '6',
      timeIndex: '3',
    })[0];
    assert.equal(loadPersonalHistory()[0]?.id, second.id);

    markPersonalHistoryUsed(created.id);
    assert.equal(loadPersonalHistory()[0]?.id, created.id);

    removePersonalHistory(created.id);
    removePersonalHistory(second.id);
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
