import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren';
import { formatDivinationInfo } from '../packages/core/src/prompt/divination';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';

test('大六壬四课和三传分别绑定实际上下位与前传，十二宫绑定天地盘及天将', () => {
  const data = generateLiuren(new Date('2026-05-19T10:30:00+08:00'));
  assert.deepEqual(
    data.fourLessons.map((item) => [item.upper, item.lower]),
    [
      ['巳', '癸'],
      ['酉', '巳'],
      ['酉', '巳'],
      ['丑', '酉'],
    ],
  );
  assert.deepEqual(
    data.threeTransmissions.map((item) => item.branch),
    ['酉', '丑', '巳'],
  );
  for (const format of [
    formatDivinationInfo,
    formatDetailedDivinationInfo,
    formatEnhancedDivinationInfo,
  ]) {
    const text = format('liuren', data);
    assert.match(text, /下位癸水克上神巳火/);
    assert.match(text, /下位巳火克上神酉金/);
    assert.match(text, /上神丑土生下位酉金/);
    assert.match(text, /初传酉金生一课下位癸水/);
    assert.match(text, /中传丑土生初传酉金/);
    assert.match(text, /末传巳火生中传丑土/);
    assert.match(text, /普通宗门裁决：/);
    assert.doesNotMatch(text, /directKe|remoteKe|suppressedByPrior|deferredToSpecial/);
    assert.doesNotMatch(text, /上神酉金克下位巳火|初传酉金生中传丑土/);
  }
  const enhanced = formatEnhancedDivinationInfo('liuren', data);
  assert.match(enhanced, /地盘卯上临天盘未乘朱雀/);
  assert.match(enhanced, /地盘未上临天盘亥乘天空/);
});

test('大六壬遥克提示词应说明直接克未命中且不得夹带贼克身份', () => {
  const data = generateLiuren(new Date('2026-01-01T06:00:00+08:00'));
  assert.equal(data.transmissionRule, '遥克法');
  assert.deepEqual(
    data.classicalRules?.map((item) => item.rule),
    ['遥克'],
  );

  for (const format of [formatDivinationInfo, formatEnhancedDivinationInfo]) {
    const text = format('liuren', data);
    assert.match(text, /四课没有直接上下克，进入遥克/);
    assert.match(text, /最终按遥克法取.+发用/);
    assert.doesNotMatch(text, /贼克法：|四课先察上下相克/);
  }
});
