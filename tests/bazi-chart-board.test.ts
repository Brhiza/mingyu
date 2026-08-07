import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '@core/bazi/baziCalculator';
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
  assert.match(html, /天干十神/);
  assert.match(html, /地支十神/);
  assert.match(html, /元男/);
  assert.ok(html.indexOf('天干十神') < html.indexOf('元男'));
  assert.ok(html.indexOf('元男') < html.indexOf('>天干<'));
  assert.match(html, /data-wuxing="[木火土金水]"/);
  assert.match(html, /藏干十神/);
  assert.match(html, /自坐/);
  assert.match(html, /空亡/);

  const allShenSha = [
    ...result.shensha.year,
    ...result.shensha.month,
    ...result.shensha.day,
    ...result.shensha.hour,
  ];
  ['天乙贵人', '太极贵人', '文昌贵人', '华盖', '金舆'].forEach((item) =>
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
  assert.ok(html.indexOf('天干十神') < html.indexOf('元女'));
  assert.ok(html.indexOf('元女') < html.indexOf('>天干<'));
});
