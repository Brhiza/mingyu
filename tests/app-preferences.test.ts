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

test('应用偏好默认进入首页，并可改为空白输入页和指定占卜算法', () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  installMemoryStorage();

  try {
    assert.deepEqual(readAppPreferences(), defaultAppPreferences);

    saveAppPreferences({
      home: 'unspecified',
      defaultDivinationMethod: 'meihua',
      caseEntry: 'new',
    });

    assert.deepEqual(readAppPreferences(), {
      home: 'unspecified',
      defaultDivinationMethod: 'meihua',
      caseEntry: 'new',
    });
  } finally {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  }
});
