import assert from 'node:assert/strict';
import test from 'node:test';

import { determinePattern } from '../packages/core/src/bazi/baziPatternStrategy';
import { evaluateTransformedPattern } from '../packages/core/src/bazi/transformedPatternStrategy';
import { getTenGod, isGanZhiPair } from '../packages/core/src/bazi/baziUtils';
import type { Pillars } from '../packages/core/src/bazi/baziTypes';

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

test('五合化气主格按日干紧贴、月令本气与独立化神证据分层', () => {
  const cases: Array<{
    label: string;
    values: [string, string, string, string];
    element: string;
  }> = [
    {
      label: '甲己化土',
      values: ['戊辰', '己未', '甲午', '丁酉'],
      element: '土',
    },
    {
      label: '乙庚化金',
      values: ['己酉', '癸酉', '乙丑', '庚戌'],
      element: '金',
    },
    {
      label: '丙辛化水',
      values: ['癸酉', '甲子', '丙申', '辛酉'],
      element: '水',
    },
    {
      label: '丁壬化木原例',
      values: ['甲戌', '丁卯', '壬寅', '甲辰'],
      element: '木',
    },
    {
      label: '戊癸化火（癸日方向）',
      values: ['甲午', '庚午', '癸未', '戊午'],
      element: '火',
    },
  ];

  for (const item of cases) {
    const result = evaluateTransformedPattern(pillars(item.values));
    assert.equal(result?.status, '成化', item.label);
    assert.equal(result?.element, item.element, item.label);
    assert.match(result?.basis ?? '', /子平真诠|滴天髓/);
  }

  const summerEarth = evaluateTransformedPattern(pillars(['乙酉', '丙午', '戊申', '癸卯']));
  assert.equal(summerEarth?.element, '火');
  assert.equal(summerEarth?.status, '存在反证');
  assert.match(summerEarth?.evidence.join('；') ?? '', /原根|强根/);

  const dingDay = evaluateTransformedPattern(pillars(['戊辰', '乙卯', '丁丑', '壬寅']));
  assert.equal(dingDay?.status, '存在反证');
  assert.match(dingDay?.evidence.join('；') ?? '', /日干同气强根.*寅藏丙/);
  assert.match(dingDay?.evidence.join('；') ?? '', /印根木与化神木同气/);
  assert.doesNotMatch(dingDay?.conditions.join('；') ?? '', /印根返性阻化：存在/);
});

test('子平真诠丁壬化木原例不被辰中癸水正库轻根一票否决', () => {
  const chart = pillars(['甲戌', '丁卯', '壬寅', '甲辰']);
  const result = determinePattern(chart, '偏弱', getTenGod, '乙');

  assert.equal(result.pattern, '丁壬化木格');
  assert.equal(result.isSpecial, true);
  assert.equal(result.transformation?.status, '成化');
  assert.equal(result.transformation?.element, '木');
  assert.match(result.transformation?.evidence.join('；') ?? '', /月令卯本气乙属木/);
  assert.match(result.transformation?.evidence.join('；') ?? '', /辰藏癸.*正库轻根/);
  assert.doesNotMatch(result.transformation?.conditions.join('；') ?? '', /辰藏癸.*不满足/);
});

test('化神正库轻根可满足独立根门槛，妒合仍单独阻化', () => {
  const supported = evaluateTransformedPattern(pillars(['己未', '丁卯', '壬寅', '戊戌']));
  assert.equal(supported?.status, '成化');
  assert.match(supported?.evidence.join('；') ?? '', /化神独立有效根.*未藏乙.*正库轻根/);

  const jealous = evaluateTransformedPattern(pillars(['己未', '丁卯', '壬寅', '丙戌']));
  assert.equal(jealous?.status, '存在反证');
  assert.match(jealous?.evidence.join('；') ?? '', /化神独立有效根.*未藏乙.*正库轻根/);
  assert.match(jealous?.evidence.join('；') ?? '', /见丙妒合/);
});

test('异干同气本气仍须达到十二长生强根门槛', () => {
  const sameElementStorage = evaluateTransformedPattern(pillars(['丁丑', '戊午', '戊申', '癸巳']));
  assert.match(
    sameElementStorage?.evidence.join('；') ?? '',
    /日干同气根仅为弱层旁证：年柱丑藏己（本气、墓）/,
  );
  assert.doesNotMatch(sameElementStorage?.evidence.join('；') ?? '', /日干同气强根：年柱丑藏己/);
});

test('精确本干余气可阻化但不冒充强根', () => {
  const result = evaluateTransformedPattern(pillars(['戊辰', '己酉', '乙未', '庚辰']));

  assert.equal(result?.status, '存在反证');
  assert.match(result?.conditions.join('；') ?? '', /原日干根气阻化：存在/);
  assert.match(result?.evidence.join('；') ?? '', /日干原根：.*辰藏乙（余气轻根、冠带）/);
  assert.doesNotMatch(result?.conditions.join('；') ?? '', /原日干强根阻化/);
});

test('原日干强根、印根返性、妒合与冲破均保留为反证', () => {
  const rooted = evaluateTransformedPattern(pillars(['戊辰', '己未', '甲子', '丙寅']));
  assert.equal(rooted?.status, '存在反证');
  assert.match(rooted?.evidence.join('；') ?? '', /日干原根/);

  const resourceRoot = evaluateTransformedPattern(pillars(['癸亥', '甲子', '丙申', '辛酉']));
  assert.equal(resourceRoot?.status, '存在反证');
  assert.match(resourceRoot?.evidence.join('；') ?? '', /印根返性/);

  const jealous = evaluateTransformedPattern(pillars(['乙巳', '己丑', '甲子', '丙寅']));
  assert.equal(jealous?.status, '存在反证');
  assert.match(jealous?.evidence.join('；') ?? '', /乙妒合/);

  const clash = evaluateTransformedPattern(pillars(['庚申', '己丑', '甲子', '丁卯']));
  assert.equal(clash?.status, '存在反证');
  assert.match(clash?.evidence.join('；') ?? '', /冲破/);
});

test('化神只有月令支持而没有独立透根时保留待核验，不升格', () => {
  const chart = pillars(['丁酉', '己丑', '甲午', '丁酉']);
  const candidate = evaluateTransformedPattern(chart);

  assert.equal(candidate?.status, '待核验');
  assert.match(candidate?.conditions.join('；') ?? '', /化神.*有效根.*待核验/);

  const result = determinePattern(chart, '身弱', getTenGod, '己');
  assert.notEqual(result.pattern, '甲己化土格');
  assert.equal(result.transformation?.status, '待核验');
});

test('日干与配干隔位只保留反证候选，不提升普通格局', () => {
  const chart = pillars(['己酉', '丙午', '甲子', '丁巳']);
  const candidate = evaluateTransformedPattern(chart);

  assert.equal(candidate?.status, '存在反证');
  assert.match(candidate?.conditions.join('；') ?? '', /紧贴.*不满足/);

  const result = determinePattern(chart, '身弱', getTenGod);
  assert.notEqual(result.pattern, '甲己化土格');
  assert.equal(result.transformation?.status, '存在反证');
});
