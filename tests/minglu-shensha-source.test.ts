import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ShenShaCalculator } from '../packages/core/src/bazi/baziShenSha';
import type { BaziChartResult, ShenShaResult } from '../packages/core/src/bazi/baziTypes';
import { getShenShaType } from '../packages/core/src/bazi/baziUtils';
import { buildEnhancedShenShaSection } from '../packages/core/src/minglu/bazi-enhancer';
import { MingluShenShaSection } from '../src/pages/ResultPage/components/MingluWiki/MingluShenShaSection';

function buildSection(shensha: ShenShaResult) {
  return buildEnhancedShenShaSection({ shensha } as BaziChartResult);
}

test('命录天罗地网说明应符合实际排盘所用戌亥、辰巳查法', () => {
  const calculator = new ShenShaCalculator();
  const tianluo = calculator.calculateAllShenSha(
    [
      ['甲', '戌'],
      ['乙', '亥'],
      ['丙', '子'],
      ['丁', '丑'],
    ],
    'male',
  );
  const diwang = calculator.calculateAllShenSha(
    [
      ['甲', '辰'],
      ['乙', '巳'],
      ['丙', '午'],
      ['丁', '未'],
    ],
    'male',
  );
  const unmatched = calculator.calculateAllShenSha(
    [
      ['甲', '辰'],
      ['丙', '戌'],
      ['丁', '丑'],
      ['己', '未'],
    ],
    'male',
  );

  for (const shensha of [tianluo, diwang]) {
    const item = buildSection(shensha).find((entry) => entry.name === '天罗地网');
    assert.ok(item);
    assert.equal(getShenShaType('天罗地网'), '凶');
    assert.equal(item.type, '凶');
    assert.equal(item.foundRuleBasis, '戌亥相见为天罗，辰巳相见为地网');
    assert.match(item.traditionalDescription, /戌亥相见称天罗，辰巳相见称地网/);
    assert.doesNotMatch(item.traditionalDescription, /辰戌为天罗|丑未为地网|《渊海子平》/);
  }
  assert.equal(
    buildSection(unmatched).some((entry) => entry.name === '天罗地网'),
    false,
  );
});

test('命录神煞沿用排盘分类与有用取象，不伪造典籍引文或兜底出处', () => {
  const items = buildSection({
    year: ['华盖', '羊刃', '金神', '魁罡', '童子煞', '天赦日', '桃花', '未登记神煞'],
    month: [],
    day: [],
    hour: [],
  });
  const byName = new Map(items.map((item) => [item.name, item]));
  for (const name of ['华盖', '羊刃', '金神', '魁罡', '桃花']) {
    assert.equal(byName.get(name)?.type, '中性');
  }
  assert.equal(byName.get('童子煞')?.type, '凶');
  assert.equal(byName.get('天赦日')?.type, '吉');
  assert.match(byName.get('天赦日')?.traditionalDescription ?? '', /至德吉神/);
  assert.match(byName.get('桃花')?.traditionalDescription ?? '', /审美/);
  assert.equal(byName.get('未登记神煞')?.type, '中性');
  assert.match(byName.get('未登记神煞')?.traditionalDescription ?? '', /排盘规则命中/);
  assert.ok(items.every((item) => !/[《》“”]/.test(item.traditionalDescription)));

  const html = renderToStaticMarkup(createElement(MingluShenShaSection, { items }));
  assert.match(html, /八字神煞与传统取象/);
  assert.match(html, /常见取象：/);
  assert.doesNotMatch(html, /典籍考据|《三命通会》与《渊海子平》/);
});
