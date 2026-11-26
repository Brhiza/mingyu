import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CUSTOM_SHORTCUT_CATALOG,
  DEFAULT_HOME_CARD_IDS,
  DEFAULT_HOME_CHART_ENTRY_IDS,
  DEFAULT_HOME_INSTANT_CAST_IDS,
  DEFAULT_HOME_INSTANT_CHIP_IDS,
  HOME_CHART_ENTRY_CATALOG,
  HOME_INSTANT_CAST_CATALOG,
  HOME_INSTANT_CHIP_CATALOG,
  isHomeCustomizationModified,
  readHomeCustomization,
  resetHomeCustomization,
  saveHomeCustomization,
} from '../src/app/workspace-catalog';

function createStorageMock() {
  const map = new Map<string, string>();
  return {
    getItem(key: string) {
      return map.has(key) ? (map.get(key) ?? null) : null;
    },
    setItem(key: string, value: string) {
      map.set(key, String(value));
    },
    removeItem(key: string) {
      map.delete(key);
    },
    clear() {
      map.clear();
    },
  };
}

test('首页自定义配置读取默认值、保存、空数组保留与恢复默认', () => {
  const prevWindow = (globalThis as Record<string, unknown>).window;
  const localStorage = createStorageMock();
  (globalThis as Record<string, unknown>).window = { localStorage };

  try {
    const initial = readHomeCustomization();
    assert.deepEqual(initial.instantCastIds, [...DEFAULT_HOME_INSTANT_CAST_IDS]);
    assert.deepEqual(initial.chartEntryIds, [...DEFAULT_HOME_CHART_ENTRY_IDS]);
    assert.deepEqual(initial.instantChipIds, [...DEFAULT_HOME_INSTANT_CHIP_IDS]);
    assert.deepEqual(initial.cardIds, [...DEFAULT_HOME_CARD_IDS]);
    assert.equal(isHomeCustomizationModified(initial), false);

    // 验证所有默认 ID 均存在于对应目录中
    const instantSet = new Set(HOME_INSTANT_CAST_CATALOG.map((x) => x.id));
    const chartSet = new Set(HOME_CHART_ENTRY_CATALOG.map((x) => x.id));
    const chipSet = new Set(HOME_INSTANT_CHIP_CATALOG.map((x) => x.id));
    const cardSet = new Set(CUSTOM_SHORTCUT_CATALOG.map((x) => x.id));
    for (const id of initial.instantCastIds) assert.ok(instantSet.has(id));
    for (const id of initial.chartEntryIds) assert.ok(chartSet.has(id));
    for (const id of initial.instantChipIds) assert.ok(chipSet.has(id));
    for (const id of initial.cardIds) assert.ok(cardSet.has(id));

    // 模拟删除某几项、清空某一组并新增其他项目
    const modified = {
      instantCastIds: ['liuren', 'huangji-jingshi'],
      chartEntryIds: [],
      instantChipIds: ['instant-ziwei', 'qimen'],
      cardIds: ['almanac', 'bazi'],
    };
    saveHomeCustomization(modified);
    assert.equal(isHomeCustomizationModified(modified), true);

    const reloaded = readHomeCustomization();
    assert.deepEqual(reloaded, modified);

    // 恢复默认
    const reset = resetHomeCustomization();
    assert.equal(isHomeCustomizationModified(reset), false);
    assert.deepEqual(readHomeCustomization(), reset);
  } finally {
    if (prevWindow === undefined) {
      delete (globalThis as Record<string, unknown>).window;
    } else {
      (globalThis as Record<string, unknown>).window = prevWindow;
    }
  }
});
