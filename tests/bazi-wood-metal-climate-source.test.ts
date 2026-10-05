import assert from 'node:assert/strict';
import test from 'node:test';

import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';

// 原文：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
test('庚戌仅保留甲先壬后的基础规则，庚申丁甲两透分支继续独立核对', () => {
  const gengXu = CLIMATE_RULES.filter(
    (rule) => rule.dayStems?.includes('庚') && rule.months.includes('戌'),
  );
  assert.deepEqual(
    gengXu.map((rule) => rule.id),
    ['xu-month-geng-jia-ren'],
  );
  assert.doesNotMatch(gengXu[0].hint, /甲壬两透.*科甲/u);

  const gengShenVisible = CLIMATE_RULES.find(
    (rule) => rule.id === 'shen-month-geng-ding-jia-visible',
  );
  assert.deepEqual(gengShenVisible?.requiredVisibleStems, ['丁', '甲']);
});
