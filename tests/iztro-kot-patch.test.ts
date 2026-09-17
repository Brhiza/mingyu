import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const i18nModule = require('iztro/lib/i18n/index.js') as {
  default: {
    addResource: (
      language: string,
      namespace: string,
      key: string,
      value: string,
      options?: { silent?: boolean },
    ) => void;
    addResources: (
      language: string,
      namespace: string,
      resources: Record<string, string>,
      options?: { silent?: boolean },
    ) => void;
    addResourceBundle: (
      language: string,
      namespace: string,
      resources: Record<string, string>,
      deep?: boolean,
      overwrite?: boolean,
      options?: { silent?: boolean },
    ) => void;
  };
  kot: (value: string, keyPart?: string) => string;
};

const localeNames = ['en-US', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW', 'vi-VN'] as const;
const translations = localeNames.map(
  (locale) => require(`iztro/lib/i18n/locales/${locale}`).default as Record<string, string>,
);

function legacyKot(value: string, keyPart?: string): string {
  for (const translation of translations) {
    for (const [key, translated] of Object.entries(translation)) {
      if (((keyPart && key.includes(keyPart)) || !keyPart) && translated === value) {
        return key;
      }
    }
  }
  return value;
}

test('iztro kot 名称反查遍历与六语原顺序保持一致', () => {
  let entryCount = 0;
  const keysByValue = new Map<string, string[]>();

  for (const translation of translations) {
    assert.ok(Object.keys(translation).length > 0);
    for (const [key, value] of Object.entries(translation)) {
      entryCount += 1;
      const keys = keysByValue.get(value) ?? [];
      keys.push(key);
      keysByValue.set(value, keys);

      assert.equal(i18nModule.kot(value), legacyKot(value));
      const keyPart = key.slice(Math.max(0, Math.floor(key.length / 3)), key.length || 1);
      assert.equal(i18nModule.kot(value, keyPart), legacyKot(value, keyPart));
    }
  }

  assert.equal(entryCount, 1559);
  const duplicateValues = [...keysByValue.entries()].filter(([, keys]) => keys.length > 1);
  assert.ok(duplicateValues.length > 0);
  for (const [value] of duplicateValues) {
    assert.equal(i18nModule.kot(value), legacyKot(value));
  }

  const unknownValue = '__mingyu_kot_unknown_regression__';
  assert.ok(!keysByValue.has(unknownValue));
  assert.equal(i18nModule.kot(unknownValue), unknownValue);
  assert.equal(i18nModule.kot(unknownValue, 'missingKeyPart'), unknownValue);
});

test('iztro kot 名称反查在静默修改词典后保持筛选顺序', () => {
  const i18next = i18nModule.default;
  const value = '__mingyu_kot_dynamic_value__';
  const updatedValue = '__mingyu_kot_dynamic_value_updated__';
  const lateKey = '__mingyu_kot_late_key__';
  const earlyKey = '__mingyu_kot_early_key__';

  assert.equal(i18nModule.kot(value), value);
  i18next.addResource('zh-CN', 'translation', lateKey, value, { silent: true });
  assert.equal(i18nModule.kot(value), lateKey);

  i18next.addResource('en-US', 'translation', earlyKey, value, { silent: true });
  assert.equal(i18nModule.kot(value), earlyKey);
  assert.equal(i18nModule.kot(value, 'late'), lateKey);

  i18next.addResource('en-US', 'translation', earlyKey, updatedValue, { silent: true });
  assert.equal(i18nModule.kot(value), lateKey);
  assert.equal(i18nModule.kot(updatedValue), earlyKey);

  i18next.addResources(
    'zh-TW',
    'translation',
    { __mingyu_kot_resources_key__: '__mingyu_kot_resources_value__' },
    { silent: true },
  );
  assert.equal(i18nModule.kot('__mingyu_kot_resources_value__'), '__mingyu_kot_resources_key__');

  i18next.addResourceBundle(
    'vi-VN',
    'translation',
    { __mingyu_kot_bundle_key__: '__mingyu_kot_bundle_value__' },
    true,
    true,
    { silent: true },
  );
  assert.equal(i18nModule.kot('__mingyu_kot_bundle_value__'), '__mingyu_kot_bundle_key__');
});
