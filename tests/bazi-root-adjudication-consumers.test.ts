import assert from 'node:assert/strict';
import test from 'node:test';

import { HIDDEN_STEMS } from '../packages/core/src/bazi/baziDefinitions';
import { evaluatePatternFulfillment } from '../packages/core/src/bazi/baziPatternFulfillment';
import { collectAdjudicatedRootFacts } from '../packages/core/src/bazi/baziRootAdjudication';
import { determineUsefulGod } from '../packages/core/src/bazi/baziUsefulGodStrategy';
import { evaluateTransformedPattern } from '../packages/core/src/bazi/transformedPatternStrategy';
import type { HiddenStems, Pillars } from '../packages/core/src/bazi/baziTypes';
import { getTenGod, getWuxing, isGanZhiPair } from '../packages/core/src/bazi/baziUtils';
import type {
  HiddenStemSource,
  VisibleStemSource,
} from '../packages/core/src/bazi/baziRuleMatcher';

function pillars(values: [string, string, string, string]): Pillars {
  for (const value of values) {
    assert.equal(isGanZhiPair(value[0], value[1]), true, value + '必须是六十甲子合法柱');
  }
  return Object.fromEntries(
    ['year', 'month', 'day', 'hour'].map((key, index) => [
      key,
      { gan: values[index][0], zhi: values[index][1], ganZhi: values[index] },
    ]),
  ) as Pillars;
}

function hiddenStems(chart: Pillars): HiddenStems {
  return Object.fromEntries(
    (['year', 'month', 'day', 'hour'] as const).map((key) => [key, HIDDEN_STEMS[chart[key].zhi]]),
  ) as unknown as HiddenStems;
}

test('格局作用接受得令本气受失令异类冲，反向失令受旺冲仍不可用', () => {
  const supported = evaluatePatternFulfillment(
    // 午月火旺，午中丁本气虽受年支子冲，子水在午月为囚；丙食神仍可参与紧贴制杀。
    // 时支戌另有未冲丁余气，不能借此把实际采用的受冲午火本气描述成“稳定根气”。
    pillars(['丙子', '庚午', '甲申', '戊戌']),
    '甲',
    '七杀格',
    getTenGod,
    { strengthStatus: '身强' },
  );
  const supportedPath = supported.pathEvaluations?.find((path) => path.key === '食神制杀');
  assert.equal(supportedPath?.status, '满足');
  assert.match(supportedPath?.detail ?? '', /可用根气.*经冲根裁决/);
  assert.ok(
    supported.rootEvidence?.some(
      (item) => item.stem === '丙' && item.clashedRootPositions.includes('月柱午藏丁（本气）'),
    ),
  );

  const unsupported = evaluatePatternFulfillment(
    // 申月火囚，寅中丙中气又受申金旺气冲，不满足共享裁决的最小可用条件。
    pillars(['丙寅', '庚申', '甲子', '戊辰']),
    '甲',
    '七杀格',
    getTenGod,
    { strengthStatus: '身强' },
  );
  const unsupportedPath = unsupported.pathEvaluations?.find((path) => path.key === '食神制杀');
  assert.equal(unsupportedPath?.status, '不满足');
  assert.match(unsupportedPath?.detail ?? '', /受冲待核.*当前不可作用/);
});

test('库支余气不冒充库土本气，库土本气同类冲动可用但不改稳定事实', () => {
  const chart = pillars(['壬辰', '戊辰', '甲戌', '丁卯']);
  const hidden = hiddenStems(chart);
  const waterRoots = collectAdjudicatedRootFacts(chart, hidden, '水', getWuxing).filter(
    (root) => root.branch === '辰',
  );
  assert.ok(waterRoots.length > 0);
  assert.ok(waterRoots.every((root) => root.hiddenRole === '余气'));
  assert.ok(waterRoots.every((root) => root.clashStatus === '受冲待核' && !root.actionable));

  const earthRoots = collectAdjudicatedRootFacts(chart, hidden, '土', getWuxing).filter(
    (root) => root.branch === '辰' && root.hiddenRole === '本气',
  );
  assert.ok(earthRoots.length > 0);
  assert.ok(earthRoots.every((root) => root.clashStatus === '库土本气同类冲动'));
  assert.ok(earthRoots.every((root) => root.actionable && !root.stable));
});

const usefulVisible: VisibleStemSource[] = [
  { pillar: 'year', stem: '甲' },
  { pillar: 'month', stem: '庚' },
  { pillar: 'day', stem: '癸' },
  { pillar: 'hour', stem: '癸' },
];

function usefulDecision(hiddenStemSources: HiddenStemSource[]) {
  return determineUsefulGod(
    '身弱',
    { pattern: '七杀格', isSpecial: false },
    '水',
    '午',
    '己',
    '癸',
    { hiddenStemSources, visibleStemSources: usefulVisible },
  );
}

test('护印取用复用共享冲根裁决并保留本气中气层次限制', () => {
  const middleRoots: HiddenStemSource[] = [
    { pillar: 'year', branch: '午', stems: ['丁', '己'] },
    { pillar: 'month', branch: '午', stems: ['丁', '己'] },
    { pillar: 'day', branch: '丑', stems: ['己', '癸', '辛'] },
    { pillar: 'hour', branch: '丑', stems: ['己', '癸', '辛'] },
  ];
  const middle = usefulDecision(middleRoots);
  assert.deepEqual(middle.favorableWuxing, ['水', '金']);
  assert.match(middle.decisionEvidence?.balanceAdjustment?.reason ?? '', /可用本中气根/);

  const residualOnly = middleRoots.map((source) =>
    source.pillar === 'day' || source.pillar === 'hour'
      ? { ...source, branch: '辰', stems: ['戊', '乙', '癸'] }
      : source,
  );
  assert.equal(usefulDecision(residualOnly).decisionEvidence?.balanceAdjustment, undefined);

  const reverseClashed = middleRoots.map((source) =>
    source.pillar === 'year' ? { ...source, branch: '未', stems: ['己', '丁', '乙'] } : source,
  );
  assert.equal(usefulDecision(reverseClashed).decisionEvidence?.balanceAdjustment, undefined);
});

test('化气返性反证接受得令本气受弱冲的日主原根', () => {
  const result = evaluateTransformedPattern(
    // 亥月水旺：亥中壬本气受巳火死气冲，子中癸本气受午火死气冲，均仍属可用原根。
    pillars(['乙巳', '丁亥', '壬子', '戊午']),
  );

  assert.equal(result?.status, '存在反证');
  assert.match(result?.conditions.join('；') ?? '', /原日干强根阻化：存在/);
  assert.match(result?.evidence.join('；') ?? '', /日干原根.*得令本气受失令异类冲/);
  assert.doesNotMatch(result?.evidence.join('；') ?? '', /日干根气受冲，保留待核/);
});
