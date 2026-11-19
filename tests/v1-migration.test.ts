import assert from 'node:assert/strict';
import test from 'node:test';
import {
  migrateV1StorageData,
  V1_STORAGE_KEYS,
  V2_MIGRATION_FLAG_KEY,
} from '../src/v2-ui/v1-migration';

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

test('migrateV1StorageData imports cases, compatibility, divination, and AI settings idempotently', () => {
  const storage = createMemoryStorage({
    [V1_STORAGE_KEYS.personalHistory]: JSON.stringify([
      { id: 'c1', name: '张三', gender: 'male', dateType: 'solar', year: '1992', month: '5', day: '18', timeIndex: '6' },
    ]),
    [V1_STORAGE_KEYS.activeCaseId]: 'c1',
    [V1_STORAGE_KEYS.compatibilityHistory]: JSON.stringify([
      {
        id: 'cmp1',
        name: '张三 & 李四',
        primaryName: '张三',
        partnerName: '李四',
        input: {
          chartType: 'ziwei',
          name: '张三',
          gender: 'male',
          year: '1992',
          month: '5',
          day: '18',
          partnerName: '李四',
          partnerGender: 'female',
          partnerYear: '1994',
          partnerMonth: '8',
          partnerDay: '9',
        },
      },
    ]),
    [V1_STORAGE_KEYS.divinationHistory]: JSON.stringify([
      { id: 'd1', type: 'divination', method: 'kongming', question: '旧版诸葛问题', draft: { question: '旧版诸葛问题' } },
      { id: 'd2', type: 'instant', instantType: 'bazi', question: '即时盘' },
    ]),
    [V1_STORAGE_KEYS.aiSettings]: JSON.stringify({
      enabled: true,
      mode: 'custom',
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'sk-v1-secret',
      model: 'deepseek-chat',
    }),
  });

  const first = migrateV1StorageData(storage);
  assert.equal(first.personalCasesImported, 1);
  assert.equal(first.compatibilityImported, 1);
  assert.equal(first.divinationImported, 2);
  assert.equal(first.aiSettingsImported, true);
  assert.equal(storage.getItem(V2_MIGRATION_FLAG_KEY), '1');
  assert.equal(storage.getItem('mingyu.v2.activeCaseId'), 'c1');
  assert.equal(storage.getItem('mingyu.v2.ai.baseUrl'), 'https://api.example.com/v1');
  assert.equal(storage.getItem('mingyu.v2.ai.model'), 'deepseek-chat');
  assert.equal(storage.getItem('mingyu.v2.ai.webEnabled'), 'true');

  const migratedCompat = JSON.parse(storage.getItem('mingyu.v2.compatibility.records') ?? '[]');
  assert.equal(migratedCompat[0]?.method, 'ziwei-synastry');

  const migratedDivs = JSON.parse(storage.getItem('mingyu.v2.history.records') ?? '[]');
  assert.equal(migratedDivs[0]?.method, 'zhuge');
  assert.equal(migratedDivs[1]?.type, 'instant');

  // 原 V1 存储键必须保持完好
  assert.ok(storage.getItem(V1_STORAGE_KEYS.personalHistory));
  assert.ok(storage.getItem(V1_STORAGE_KEYS.aiSettings));

  // 二次调用应完全幂等
  const second = migrateV1StorageData(storage);
  assert.equal(second.personalCasesImported, 0);
  assert.equal(second.compatibilityImported, 0);
  assert.equal(second.divinationImported, 0);
  assert.equal(second.aiSettingsImported, false);
});

test('migrateV1StorageData does not overwrite existing V2 AI config or migrate builtin mode', () => {
  const storage = createMemoryStorage({
    'mingyu.v2.ai.baseUrl': 'https://v2.example.com/v1',
    'mingyu.v2.ai.model': 'v2-model',
    [V1_STORAGE_KEYS.aiSettings]: JSON.stringify({
      enabled: true,
      mode: 'custom',
      baseUrl: 'https://v1.example.com/v1',
      model: 'v1-model',
    }),
  });

  const res = migrateV1StorageData(storage);
  assert.equal(res.aiSettingsImported, false);
  assert.equal(storage.getItem('mingyu.v2.ai.baseUrl'), 'https://v2.example.com/v1');
  assert.equal(storage.getItem('mingyu.v2.ai.model'), 'v2-model');

  const builtinStorage = createMemoryStorage({
    [V1_STORAGE_KEYS.aiSettings]: JSON.stringify({
      enabled: true,
      mode: 'builtin',
      baseUrl: 'https://builtin.example.com/v1',
      model: 'builtin',
    }),
  });
  assert.equal(migrateV1StorageData(builtinStorage).aiSettingsImported, false);
});
