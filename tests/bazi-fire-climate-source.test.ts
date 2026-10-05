import assert from 'node:assert/strict';
import test from 'node:test';

import { CLIMATE_RULES } from '../packages/core/src/bazi/baziTherapeuticRules/climateRules';

// 校核底本：https://zh.wikisource.org/w/index.php?title=穷通宝鉴&oldid=2294674
test('丁卯庚乙俱透的条件分支保留其优先级与取用作用', () => {
  const conditional = CLIMATE_RULES.find(
    (rule) => rule.id === 'mao-month-ding-geng-yi-greedy-combine',
  );
  const baseline = CLIMATE_RULES.find((rule) => rule.id === 'mao-month-ding-jia-geng-first');
  assert.ok(conditional && baseline);
  assert.deepEqual(conditional.requiredVisibleStems, ['庚', '乙']);
  assert.ok((conditional.priority ?? 0) > (baseline.priority ?? 0));
  assert.match(conditional.hint, /庚乙俱透/u);
});
