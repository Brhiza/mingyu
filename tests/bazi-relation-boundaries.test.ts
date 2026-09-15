import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeKongWangProfile } from '../packages/core/src/bazi/kongWangAnalysis';
import { analyzeRelationStructure } from '../packages/core/src/bazi/relationStructure';

const validBranches = [{ zhi: '申' }, { zhi: '寅' }, { zhi: '辰' }, { zhi: '辰' }];

test('地支关系分析严格要求四个合法地支并保留重复支刑', () => {
  assert.throws(() => analyzeRelationStructure(validBranches.slice(0, 3)), /四柱数量无效：3/);
  assert.throws(
    () => analyzeRelationStructure([...validBranches, { zhi: '午' }]),
    /四柱数量无效：5/,
  );
  assert.throws(
    () => analyzeRelationStructure([{ zhi: '申' }, { zhi: '风' }, { zhi: '辰' }, { zhi: '辰' }]),
    /第2柱地支无效：风/,
  );

  const profile = analyzeRelationStructure(validBranches);
  assert.ok(profile.items.some((item) => item.name === '三刑' && item.values.join('') === '辰辰'));
});

test('空亡画像保留日柱旬空投影并拒绝非法四柱输入', () => {
  const profile = analyzeKongWangProfile(
    [
      { gan: '丙', zhi: '申' },
      { gan: '乙', zhi: '卯' },
      { gan: '甲', zhi: '戌' },
      { gan: '丁', zhi: '卯' },
    ],
    '甲',
  );

  assert.deepEqual(
    profile.items.map((item) => item.emptyBranches),
    [
      ['申', '酉'],
      ['申', '酉'],
      ['申', '酉'],
      ['申', '酉'],
    ],
  );
  assert.equal(profile.items[0]?.isEmpty, true);
  assert.match(profile.summary, /^日柱旬空投影（依据甲戌）：申、酉$/);
  assert.notStrictEqual(profile.items[0]?.emptyBranches, profile.items[1]?.emptyBranches);

  assert.throws(
    () =>
      analyzeKongWangProfile(
        [
          { gan: '丙', zhi: '申' },
          { gan: '乙', zhi: '卯' },
          { gan: '甲', zhi: '戌' },
        ],
        '甲',
      ),
    /四柱数量无效：3/,
  );
  assert.throws(
    () =>
      analyzeKongWangProfile(
        [
          { gan: '丙', zhi: '申' },
          { gan: '甲', zhi: '丑' },
          { gan: '甲', zhi: '戌' },
          { gan: '丁', zhi: '卯' },
        ],
        '甲',
      ),
    /第2柱不是有效六十甲子/,
  );
  assert.throws(
    () =>
      analyzeKongWangProfile(
        [
          { gan: '丙', zhi: '申' },
          { gan: '乙', zhi: '卯' },
          { gan: '甲', zhi: '戌' },
          { gan: '丁', zhi: '卯' },
        ],
        '风',
      ),
    /日主无效：风/,
  );
});
