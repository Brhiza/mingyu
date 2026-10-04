import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { buildEnhancedPatternUsefulGodSection } from '../packages/core/src/minglu/bazi-enhancer';
import { MingluPatternUsefulGodSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPatternUsefulGodSection';

test('命录喜忌十神按实际关系展示，不标成五行', () => {
  const result = baziCalculator.calculateBazi({
    year: 1903,
    month: 4,
    day: 6,
    timeIndex: 0,
    gender: 'male',
    isLunar: false,
  });
  assert.deepEqual(result.analysis.usefulGod.favorableWuxing, ['水', '木']);
  assert.deepEqual(result.analysis.usefulGod.favorable, ['正印', '偏印', '比肩', '劫财']);
  const html = renderToStaticMarkup(
    createElement(MingluPatternUsefulGodSection, {
      data: buildEnhancedPatternUsefulGodSection(result),
    }),
  );
  assert.match(html, /喜用十神：正印、偏印、比肩、劫财/u);
  assert.ok(html.includes(`忌神：${result.analysis.usefulGod.unfavorable.join('、')}`));
  assert.doesNotMatch(html, /喜用五行：|忌讳五行：/u);
});

test('命录缺时辰的空喜忌保留待补时，不生成顺势或无忌结论', () => {
  const result = baziCalculator.calculateBazi({
    year: 2000,
    month: 1,
    day: 7,
    gender: 'male',
  });
  const section = buildEnhancedPatternUsefulGodSection(result);
  assert.deepEqual(section.usefulGods.favorable, []);
  assert.deepEqual(section.usefulGods.unfavorable, []);
  const html = renderToStaticMarkup(
    createElement(MingluPatternUsefulGodSection, { data: section }),
  );
  assert.match(html, /出生时辰待补/u);
  assert.doesNotMatch(html, /喜用十神：|忌神：|顺应大势|暂无明显大忌|防微杜渐/u);
});
