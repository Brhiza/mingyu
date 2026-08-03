import test from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../packages/core/src/index.ts';
import { calculateMingGua } from '../packages/core/src/bazi/mingGua.ts';

test('底层干支应拒绝不存在的六十甲子组合', () => {
  assert.throws(() => core.ganzhi.getSixtyCycleIndex('甲丑'), /干支组合无效/);
  assert.throws(() => core.ganzhi.getSixtyCycleIndex('甲子额外字符'), /干支组合无效/);
  assert.throws(() => core.ganzhi.diffGanZhi('甲子', '乙子'), /干支组合无效/);
  assert.throws(() => core.ganzhi.getGanZhiYinYang('甲丑'), /干支组合无效/);
});

test('纳音五行应读取纳音名称末字', () => {
  assert.equal(core.ganzhi.getNayinWuxing('甲子'), '金');
  assert.equal(core.ganzhi.getNayinWuxing('丙寅'), '火');
  assert.equal(core.ganzhi.getNayinWuxing('戊辰'), '木');
  assert.equal(core.ganzhi.getNayinWuxing('庚午'), '土');
  assert.equal(core.ganzhi.getNayinWuxing('丙子'), '水');
});

test('命卦与八宅分组不应把非法值静默降级', () => {
  assert.throws(() => calculateMingGua(2024, 'unknown'), /性别必须是 male 或 female/);
  assert.throws(() => calculateMingGua(Number.NaN, 'male'), /出生年份必须是有效整数/);
  assert.throws(() => calculateMingGua(2024.5, 'female'), /出生年份必须是有效整数/);
  assert.throws(() => core.direction.getEastWestGroup('未知卦'), /八卦无效/);
});
