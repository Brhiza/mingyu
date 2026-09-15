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

test('四柱日期保存、重开与跨术数引用保留候选区间和秒数', async () => {
  const { getGanZhiFromDate } = await import('mingyu-core/ganzhi');
  const { reverseBaziDates } = await import('mingyu-core/calendar');
  const { resolveBaziReverseCandidate, parseBaziReverseSource } =
    await import('../src/lib/bazi-reverse-input');
  const { applyPersonReverseSelection, getPersonInputMode } =
    await import('../src/pages/InputPage.field-helpers');
  const { buildChartFeaturePathForCase } = await import('../src/lib/case-navigation');
  const { parseInputState } = await import('../src/lib/query-state');
  const pillars = getGanZhiFromDate(new Date(2000, 0, 7, 9));
  const candidate = reverseBaziDates({ pillars, startYear: 2000, endYear: 2000 }).candidates[0];
  assert.ok(candidate);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);
  withMockStorage(() => {
    const input = applyPersonReverseSelection(createInput('合成日期'), 'self', selection);
    const partner = applyPersonReverseSelection(input, 'partner', selection);
    assert.equal(partner.birthReverseSource, input.birthReverseSource);
    assert.equal(partner.partnerBirthSecond, input.birthSecond);
    assert.equal(getPersonInputMode(partner, 'partner'), 'pillars');
    assert.equal(partner.partnerUseTrueSolarTime, false);
    upsertPersonalHistory(input, 'ziwei');
    const [record] = loadPersonalHistory();
    assert.equal(getPersonInputMode(record.input, 'self'), 'pillars');
    assert.deepEqual(parseBaziReverseSource(record.input.birthReverseSource), selection.source);
    for (const feature of [
      'bazi',
      'ziwei',
      'bazi-ziwei',
      'qimen-lifetime',
      'astrolabe',
      'qizheng',
      'bazhai',
      'compatibility',
    ] as const) {
      const path = buildChartFeaturePathForCase(record, feature);
      const restored = parseInputState(new URLSearchParams(path.split('?')[1]));
      assert.equal(restored.birthReverseSource, input.birthReverseSource, feature);
      assert.equal(restored.birthSecond, input.birthSecond, feature);
      assert.equal(restored.useTrueSolarTime, false, feature);
      assert.equal(getPersonInputMode(restored, 'self'), 'pillars', feature);
    }
  });
});
