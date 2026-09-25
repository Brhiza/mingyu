import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren';
import {
  buildDivinationPrompt,
  formatDivinationInfo,
} from '../packages/core/src/prompt/divination';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail';
import { formatEnhancedDivinationInfo } from '../packages/core/src/prompt/divination-enhanced';
import { buildDivinationPrompt as buildAppDivinationPrompt } from '../src/lib/divination/engine';
import { formatLiurenOrdinaryTransmissionAdjudication } from '../packages/core/src/prompt/liuren-facts';
import { formatLiurenJudgmentFacts } from '../packages/core/src/prompt/liuren-judgment';

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

test('大六壬完整提示词写入课体判据、取用定位和应期依据', () => {
  const data = generateLiuren(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = formatDivinationInfo('liuren', data);
  assert.ok(data.guaTiFacts?.length);
  for (const fact of data.guaTiFacts) {
    assert.ok(prompt.includes(`${fact.name}：${fact.matchedConditions.join('；')}`));
    assert.ok(prompt.includes(fact.sourceTitle));
  }
  for (const focus of data.focusEvidence ?? []) {
    assert.ok(prompt.includes(`${focus.role}${focus.target}`));
  }
  for (const timing of data.timingEvidence ?? []) {
    if (timing.startsWith('未给出目标期限时')) {
      assert.match(prompt, /以问题期限、三传先后和现实触发条件核对应期/);
    } else {
      assert.ok(prompt.includes(timing));
    }
  }
  assert.doesNotMatch(prompt, /sourceUrl|stableKey|notApplicable/);
});

test('核心直调大六壬提示词含独立课传判据且只追加一次', () => {
  const data = generateLiuren(new Date('2026-05-19T10:30:00+08:00'));
  const prompt = buildDivinationPrompt({ method: 'liuren', data, question: '问合作进度' });
  assert.match(prompt, /【占卜资料】/);
  assert.match(prompt, /取传说明：/);
  assert.match(prompt, /取传条件：/);
  assert.match(prompt, /课体条件：/);
  assert.match(prompt, /课传反证：/);
  assert.equal((prompt.match(/取传说明：/g) ?? []).length, 1);
  assert.equal((prompt.match(/课传反证：/g) ?? []).length, 1);
  const adjudication = formatLiurenOrdinaryTransmissionAdjudication(data);
  assert.ok(adjudication.includes('候选取舍：'));
  assert.ok(formatLiurenJudgmentFacts(data).includes(adjudication));
  assert.equal(prompt.split(adjudication).length - 1, 1);
  const appPrompt = buildAppDivinationPrompt('liuren', '问合作进度', data);
  assert.equal(appPrompt.split(adjudication).length - 1, 1);
});
