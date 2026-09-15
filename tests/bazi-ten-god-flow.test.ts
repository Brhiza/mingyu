import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTenGodFlow, analyzeTenGodStructure } from '@core/bazi/tenGodAnalysis';
import { HIDDEN_STEMS } from '@core/bazi/baziMappingsData';
import { getTenGod } from '@core/bazi/baziUtils';

function flow(values: string[]) {
  const rows = values.map((value) => ({
    gan: value[0],
    zhi: value[1],
    hiddenStems: HIDDEN_STEMS[value[1]],
  }));
  return analyzeTenGodFlow(analyzeTenGodStructure(rows, values[2][0], getTenGod));
}

test('财官印比食伤同见时保留五段相生候选，官杀生印仍需根气制化核验', () => {
  const result = flow(['壬子', '丙午', '甲辰', '庚申']);
  assert.deepEqual(
    result.items.map((item) => item.name).sort(),
    ['比劫泄秀', '食伤生财', '财生官杀', '官杀生印', '印比相生'].sort(),
  );
  const candidate = result.items.find((item) => item.name === '官杀生印');
  assert.match(candidate!.description, /结构线索/);
  assert.match(candidate!.caution, /财星克印/);
  assert.match(candidate!.caution, /印能承接生身才论通关/);
});

test('仅见印比而无官杀时不生成官杀生印候选', () => {
  const result = flow(['壬子', '甲寅', '甲子', '甲子']);
  assert.ok(result.items.some((item) => item.name === '印比相生'));
  assert.ok(!result.items.some((item) => item.name === '官杀生印'));
});
