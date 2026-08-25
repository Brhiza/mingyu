import assert from 'node:assert/strict';
import test from 'node:test';
import { upsertPersonalHistory } from '../src/lib/history-records';
import { defaultInputState, type QueryInputState } from '../src/lib/query-state';

function createInput(name: string, year: string, month: string, day: string): QueryInputState {
  return {
    ...defaultInputState,
    name,
    year,
    month,
    day,
    timeIndex: 0,
  };
}

function withMockStorage(run: () => void) {
  const storage = new Map<string, string>();
  const originalWindow = globalThis.window;
  const localStorage = {
    getItem(key: string) {
      return storage.has(key) ? storage.get(key)! : null;
    },
    setItem(key: string, value: string) {
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
    run();
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

test('临时档案遇到残留案例编号时必须新增，不能覆盖旧案例', () => {
  withMockStorage(() => {
    const originalInput = createInput('1', '2000', '1', '1');
    const originalRecord = upsertPersonalHistory(originalInput, 'bazi')[0];
    const nextInput = createInput('2', '2000', '2', '2');

    const records = upsertPersonalHistory(nextInput, 'bazi', originalRecord.id);

    assert.equal(records.length, 2);
    assert.equal(records.find((record) => record.id === originalRecord.id)?.name, '1');
    assert.equal(records.find((record) => record.id === originalRecord.id)?.birthText, '2000-1-1');
    assert.equal(records.find((record) => record.name === '2')?.birthText, '2000-2-2');
  });
});

test('案例管理明确编辑资料时仍应更新原案例', () => {
  withMockStorage(() => {
    const originalRecord = upsertPersonalHistory(createInput('1', '2000', '1', '1'), 'bazi')[0];
    const records = upsertPersonalHistory(
      createInput('修改后', '2001', '3', '4'),
      'bazi',
      originalRecord.id,
      { allowIdentityChange: true },
    );

    assert.equal(records.length, 1);
    assert.equal(records[0]?.id, originalRecord.id);
    assert.equal(records[0]?.name, '修改后');
    assert.equal(records[0]?.birthText, '2001-3-4');
  });
});

test('精准排盘补充时分和出生地时应完善原案例而不是新建分支', () => {
  withMockStorage(() => {
    const originalRecord = upsertPersonalHistory(
      createInput('已有案例', '2000', '2', '2'),
      'bazi',
    )[0];
    const records = upsertPersonalHistory(
      {
        ...originalRecord.input,
        chartType: 'astrolabe',
        birthHour: '01',
        birthMinute: '35',
        birthPlace: '北京市 北京市 东城区',
        birthLongitude: '116.416357',
        birthLatitude: '39.928353',
      },
      'astrolabe',
      originalRecord.id,
    );

    assert.equal(records.length, 1);
    assert.equal(records[0]?.id, originalRecord.id);
    assert.equal(records[0]?.workspaceSource, 'astrolabe');
    assert.equal(records[0]?.input.birthHour, '01');
    assert.equal(records[0]?.input.birthPlace, '北京市 北京市 东城区');
    assert.equal(records[0]?.input.birthLongitude, '116.416357');
  });
});

test('历史覆盖造成编号占用时重新建立旧资料也必须保留现有案例', () => {
  withMockStorage(() => {
    const originalRecord = upsertPersonalHistory(createInput('1', '2000', '1', '1'), 'bazi')[0];
    upsertPersonalHistory(createInput('2', '2000', '2', '2'), 'bazi', originalRecord.id, {
      allowIdentityChange: true,
    });

    const records = upsertPersonalHistory(createInput('1', '2000', '1', '1'), 'bazi');

    assert.equal(records.length, 2);
    assert.equal(
      records.some((record) => record.name === '1'),
      true,
    );
    assert.equal(
      records.some((record) => record.name === '2'),
      true,
    );
    assert.equal(new Set(records.map((record) => record.id)).size, 2);
  });
});
