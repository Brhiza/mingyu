import test from 'node:test';
import assert from 'node:assert/strict';

import * as core from '../packages/core/src/index.ts';
import {
  BASIC_MAPPINGS,
  HIDDEN_STEMS,
  NAYIN_MAP as BAZI_NAYIN_MAP,
  SIXTY_CYCLE as BAZI_SIXTY_CYCLE,
} from '../packages/core/src/bazi/baziMappingsData.ts';
import {
  EARTHLY_BRANCHES,
  HEAVENLY_STEMS,
  NAYIN_MAP,
  SIXTY_CYCLE,
} from '../packages/core/src/ganzhi/data.ts';
import { BRANCH_HIDDEN_STEMS } from '../packages/core/src/ganzhi/relations.ts';
import { LIUCHONG_MAP as LEGACY_LIUCHONG_MAP } from '../packages/core/src/divination/algorithms/_shared/wuxing.ts';
import { LIUCHONG_MAP } from '../packages/core/src/ganzhi/relations.ts';

test('公共地基层应成为八字与占卜旧路径的单一真相源', () => {
  assert.equal(BASIC_MAPPINGS.HEAVENLY_STEMS, HEAVENLY_STEMS);
  assert.equal(BASIC_MAPPINGS.EARTHLY_BRANCHES, EARTHLY_BRANCHES);
  assert.equal(BAZI_SIXTY_CYCLE, SIXTY_CYCLE);
  assert.equal(BAZI_NAYIN_MAP, NAYIN_MAP);
  assert.equal(HIDDEN_STEMS, BRANCH_HIDDEN_STEMS);
  assert.equal(LEGACY_LIUCHONG_MAP, LIUCHONG_MAP);
});

test('六十甲子工具应返回完整序列与结构化关系', () => {
  const cycle = core.foundation.getFoundationCapabilities().constants.sixtyCycle;
  assert.equal(cycle.length, 60);
  assert.equal(cycle[0], '甲子');
  assert.equal(cycle[59], '癸亥');

  const profile = core.foundation.describeGanZhi('甲子');
  assert.equal(profile.index, 0);
  assert.equal(profile.nayin, '海中金');
  assert.equal(profile.stem.combine, '己');
  assert.equal(profile.stem.combineWuxing, '土');
  assert.equal(profile.branch.zodiac, '鼠');
  assert.deepEqual(profile.branch.hiddenStems, ['癸']);
  assert.equal(profile.branch.clash, '午');
  assert.equal(profile.branch.harm, '未');
  assert.equal(profile.branch.break, '酉');
  assert.equal(profile.branch.sanhe.group, '水局');
  assert.deepEqual(core.foundation.getBranchRelations('寅').punishments, ['巳', '申']);
  assert.equal(core.foundation.getBranchRelations('寅').hiddenCombine, '丑');
  assert.equal(core.foundation.getFoundationCapabilities().constants.changshengOrder.length, 12);
});

test('统一五行分析应严格校验输入并支持藏干权重', () => {
  const result = core.foundation.analyzeWuxing(['甲', '子', '丙', '午']);
  assert.equal(result.weightHidden, true);
  assert.ok(result.counts.木 > 0);
  assert.ok(result.counts.水 > 0);
  assert.ok(result.counts.火 > 0);
  assert.throws(() => core.foundation.analyzeWuxing([]), /至少需要一个/);
  assert.throws(() => core.foundation.analyzeWuxing(['甲子']), /输入无效/);
});
