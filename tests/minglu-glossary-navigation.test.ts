import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '../packages/core/src/bazi/baziCalculator';
import { buildMingluArticle } from '../packages/core/src/minglu';
import { MingluFiveElementsSection } from '../src/pages/ResultPage/components/MingluWiki/MingluFiveElementsSection';
import { MingluGlossarySection } from '../src/pages/ResultPage/components/MingluWiki/MingluGlossarySection';
import { MingluPillarsSection } from '../src/pages/ResultPage/components/MingluWiki/MingluPillarsSection';
import { MingluTenGodsSection } from '../src/pages/ResultPage/components/MingluWiki/MingluTenGodsSection';

const baziResult = baziCalculator.calculateBazi({
  year: 1990,
  month: 5,
  day: 15,
  timeIndex: 5,
  gender: 'male',
});
const article = buildMingluArticle({
  person: {
    name: '导航核验',
    gender: 'male',
    birthYear: 1990,
    birthMonth: 5,
    birthDay: 15,
    birthHour: 10,
    birthMinute: 30,
  },
  baziResult,
});
const onNavigateGlossary = () => {};

test('十神与天干链接应指向词典实际锚点，地支与五行无词条时保持普通文字', () => {
  const tenGodsData = {
    ...article.tenGodsSection,
    godsList: article.tenGodsSection.godsList.map((god, index) =>
      index === 0 ? { ...god, count: 0, pillars: [], isExposed: false, isHidden: false } : god,
    ),
  };
  const tenGods = renderToStaticMarkup(
    createElement(MingluTenGodsSection, {
      data: tenGodsData,
      glossaryEntries: article.glossary,
      onNavigateGlossary,
    }),
  );
  const pillars = renderToStaticMarkup(
    createElement(MingluPillarsSection, {
      data: article.pillarsSection,
      metadata: article.metadata,
      glossaryEntries: article.glossary,
      onNavigateGlossary,
    }),
  );
  const elements = renderToStaticMarkup(
    createElement(MingluFiveElementsSection, { data: article.fiveElementsSection }),
  );

  for (const god of article.tenGodsSection.godsList) {
    const entry = article.glossary.find((item) => item.term === god.tenGod);
    assert.ok(entry);
    assert.match(tenGods, new RegExp(`href="#${entry.anchorId}"`));
    assert.doesNotMatch(tenGods, new RegExp(`href="#glossary-${god.tenGod}"`));
  }
  for (const column of article.pillarsSection.columns) {
    const entry = article.glossary.find((item) => item.term === `${column.gan}${column.ganWuxing}`);
    assert.ok(entry);
    assert.match(pillars, new RegExp(`href="#${entry.anchorId}"`));
    assert.doesNotMatch(pillars, new RegExp(`href="#glossary-${column.zhi}"`));
  }
  assert.doesNotMatch(elements, /href="#glossary-(木|火|土|金|水)"/);
  assert.doesNotMatch(tenGods, /原局暗藏力量微弱/);
  assert.match(tenGods, /未记录透藏/);
  assert.match(tenGods, /实际十神：/);
  assert.match(tenGods, /十神透藏与四柱传统取象/);
});

test('词典来源应按资料展示，不把全部概念称为权威考证', () => {
  const html = renderToStaticMarkup(
    createElement(MingluGlossarySection, { entries: article.glossary }),
  );
  assert.match(html, /传统术数概念释义与资料出处/);
  assert.match(html, /典籍资料：/);
  assert.doesNotMatch(html, /权威释义|典籍考证/);
});
