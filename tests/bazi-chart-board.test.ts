import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { BaziFortuneSelector } from '../src/components/BaziFortuneTools/BaziFortuneSelector';
import { BaziChartBoard } from '../src/pages/ResultPage/components/BaziChartBoard';

test('八字结果盘应展示排盘预警和稳定基础参考', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    gender: 'male',
    useTrueSolarTime: true,
    birthHour: 12,
    birthMinute: 0,
    birthLongitude: 116.4,
    birthPlace: '北京',
    applyChinaDst: true,
    shenShaScope: 'all',
  });

  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '测试命盘',
      result,
    }),
  );

  assert.match(html, /排盘预警/);
  assert.match(html, /夏令时/);
  assert.match(html, /基础参考/);
  assert.match(html, /命卦/);
  assert.match(html, /命宫/);
  assert.match(html, /身宫/);
  assert.match(html, /旺衰/);
  assert.match(html, /命式/);
  assert.match(html, /元男/);
  assert.match(html, /bazi-pillar-value/);
  assert.ok(html.indexOf('命式') < html.indexOf('元男'));
  assert.match(html, /data-wuxing="[木火土金水]"/);
  assert.doesNotMatch(html, /bazi-wuxing-label/);
  assert.match(html, /bazi-hidden-stem-list/);
  assert.ok(html.includes(`>${result.hiddenTenGods.year[0]}<`));
  assert.match(html, /自坐/);
  assert.match(html, /空亡/);
  assert.ok(html.includes(`>${result.timeInfo.name}<`));
  assert.ok(!html.includes(`${result.timeInfo.name}时`), '时辰名称不应重复追加“时”字');

  const allShenSha = [
    ...result.shensha.year,
    ...result.shensha.month,
    ...result.shensha.day,
    ...result.shensha.hour,
  ];
  ['天乙贵人', '太极贵人', '华盖', '金舆'].forEach((item) =>
    assert.ok(html.includes(`>${item}<`), `盘面应展示常用神煞：${item}`),
  );
  assert.ok(allShenSha.includes('马财库'), '底层结果仍应保留扩展神煞');
  assert.ok(!html.includes('>马财库<'), '盘面应隐藏不常用神煞');
  assert.ok(!html.includes('>真鬼刑疾<'), '盘面应隐藏不常用神煞');
  assert.match(html, /bazi-shensha-tag is-(lucky|unlucky|neutral)/);
});

test('八字女命日柱应标注元女', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 6,
    gender: 'female',
  });

  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '测试女命',
      result,
    }),
  );

  assert.match(html, /元女/);
  assert.doesNotMatch(html, /元男/);
  assert.ok(html.indexOf('命式') < html.indexOf('元女'));
});

test('排盘五行卡展示五行值，日干典籍仅展示静态体象', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 6,
    gender: 'female',
  });
  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '取用单位核对',
      result: {
        ...result,
        analysis: {
          ...result.analysis,
          mingGe: { ...result.analysis.mingGe, transformation: undefined },
          usefulGod: {
            ...result.analysis.usefulGod,
            incrementStatus: '已判定',
            primaryFavorableWuxing: '木',
            primaryUnfavorableWuxing: '金',
            favorableWuxing: ['木'],
            unfavorableWuxing: ['金'],
            primaryUseful: '正官',
            primaryAvoid: '七杀',
          },
        },
      },
    }),
  );

  assert.match(html, /增补五行取用<\/span><strong>木<\/strong>/);
  assert.match(html, /增补五行所忌<\/span><strong>金<\/strong>/);
  assert.doesNotMatch(html, /增补五行取用<\/span><strong>正官<\/strong>/);
  assert.match(html, /日干体象/);
  assert.match(html, /【条件释义】/);
  assert.doesNotMatch(html, /十干一般释义（未结合本盘/);
});

test('增补五行待判时不把旧十神值显示为五行结论', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 6,
    gender: 'female',
  });
  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '待判取用核对',
      result: {
        ...result,
        analysis: {
          ...result.analysis,
          mingGe: { ...result.analysis.mingGe, transformation: undefined },
          usefulGod: {
            ...result.analysis.usefulGod,
            incrementStatus: '待判',
            primaryFavorableWuxing: '木',
            primaryUnfavorableWuxing: '金',
            primaryUseful: '正官',
            primaryAvoid: '七杀',
          },
        },
      },
    }),
  );
  assert.match(html, /增补五行取用<\/span><strong>待判<\/strong>/);
  assert.match(html, /增补五行所忌<\/span><strong>待判<\/strong>/);
});

test('八字结果盘默认展示常用神煞并过滤扩展项', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    gender: 'male',
  });
  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '常用神煞测试',
      result: {
        ...result,
        shensha: {
          year: ['福星贵人', '拱禄', '六厄', '马财库', '真鬼刑疾'],
          month: [],
          day: [],
          hour: [],
          global: ['三奇贵人', '天火煞'],
        },
      },
    }),
  );

  ['福星贵人', '拱禄', '三奇贵人'].forEach((item) =>
    assert.ok(html.includes(`>${item}<`), `盘面应展示常用神煞：${item}`),
  );
  ['六厄', '马财库', '真鬼刑疾', '天火煞'].forEach((item) =>
    assert.ok(!html.includes(`>${item}<`), `盘面应隐藏非默认神煞：${item}`),
  );
});

test('八字结果盘应将神煞简称还原为完整名称并去重', () => {
  const result = baziCalculator.calculateBazi({
    year: 1995,
    month: 5,
    day: 20,
    timeIndex: 6,
    gender: 'female',
  });

  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '神煞名称测试',
      result: {
        ...result,
        shensha: {
          year: ['天罗', '地网', '天乙', '勾绞'],
          month: [],
          day: [],
          hour: [],
        },
      },
    }),
  );

  assert.ok(html.includes('>天罗地网<'));
  assert.ok(html.includes('>天乙贵人<'));
  assert.ok(html.includes('>勾绞煞<'));
  assert.ok(!html.includes('>天罗<'));
  assert.ok(!html.includes('>地网<'));
  assert.ok(!html.includes('>天乙<'));
  assert.ok(!html.includes('>勾绞<'));
  assert.equal(html.match(/>天罗地网</g)?.length, 1);
});

test('八字岁运区应提供流时并把回到今天放在顶部', () => {
  const result = baziCalculator.calculateBazi({
    year: 1992,
    month: 7,
    day: 15,
    timeIndex: 3,
    gender: 'female',
  });

  const html = renderToStaticMarkup(createElement(BaziFortuneSelector, { result }));

  assert.match(html, /fortune-selector-head/);
  assert.match(html, /aria-label="回到今天"/);
  assert.ok(html.indexOf('>岁运<') < html.indexOf('>今<'));
  assert.ok(html.indexOf('>今<') < html.indexOf('>大运<'));
  assert.match(html, />流时</);
  assert.equal(html.match(/class="fortune-row"/g)?.length, 5);
  assert.doesNotMatch(html, /class="row-title"><button/);
});
