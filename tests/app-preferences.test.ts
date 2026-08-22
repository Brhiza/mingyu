import assert from 'node:assert/strict';
import test from 'node:test';
import {
  defaultAppPreferences,
  readAppPreferences,
  saveAppPreferences,
} from '../src/lib/app-preferences.ts';

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

test('应用偏好默认进入八字，并可保存空白入口、占卜算法和侧栏顺序', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  installMemoryStorage();

  try {
    assert.deepEqual(readAppPreferences(), defaultAppPreferences);

    saveAppPreferences({
      home: 'unspecified',
      defaultDivinationMethod: 'meihua',
      caseEntry: 'new',
      navigationOrder: [
        'ziwei',
        ...defaultAppPreferences.navigationOrder.filter((item) => item !== 'ziwei'),
      ],
    });

    assert.deepEqual(readAppPreferences(), {
      home: 'unspecified',
      defaultDivinationMethod: 'meihua',
      caseEntry: 'new',
      navigationOrder: [
        'ziwei',
        ...defaultAppPreferences.navigationOrder.filter((item) => item !== 'ziwei'),
      ],
    });
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
