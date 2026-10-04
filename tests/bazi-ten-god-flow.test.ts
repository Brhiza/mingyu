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

test('日干只作十神参照，非日柱比肩及日支藏干照常计入', () => {
  const rows = ['甲子', '丙午', '甲寅', '庚申'].map((value) => ({
    gan: value[0],
    zhi: value[1],
    hiddenStems: HIDDEN_STEMS[value[1]],
  }));
  const structure = analyzeTenGodStructure(rows, '甲', getTenGod);
  const biJian = structure.distributions.find((item) => item.tenGod === '比肩');

  assert.deepEqual(biJian, {
    tenGod: '比肩',
    visibleCount: 1,
    hiddenCount: 1,
    totalCount: 2,
    status: '透藏并见',
  });
  assert.equal(
    structure.familyDistributions.reduce((count, item) => count + item.visibleCount, 0),
    3,
  );
  assert.equal(
    structure.familyDistributions.reduce((count, item) => count + item.hiddenCount, 0),
    rows.reduce((count, row) => count + row.hiddenStems.length, 0),
  );
});

test('日干自身不使空缺的比劫家族出现，也不凭同见十神断出现实结果', () => {
  const rows = ['丙午', '戊戌', '甲午', '庚申'].map((value) => ({
    gan: value[0],
    zhi: value[1],
    hiddenStems: HIDDEN_STEMS[value[1]],
  }));
  const structure = analyzeTenGodStructure(rows, '甲', getTenGod);
  assert.deepEqual(
    structure.distributions.find((item) => item.tenGod === '比肩'),
    {
      tenGod: '比肩',
      visibleCount: 0,
      hiddenCount: 0,
      totalCount: 0,
      status: '缺位',
    },
  );
  const flow = analyzeTenGodFlow(structure);
  assert.ok(!flow.items.some((item) => item.name === '比劫泄秀' || item.name === '印比相生'));
  assert.ok(flow.items.every((item) => item.description.includes('结构线索')));
  assert.doesNotMatch(JSON.stringify(flow), /财富可带来|依赖性强|才华、技能可转化/);
});
