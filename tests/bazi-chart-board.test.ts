import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { baziCalculator } from '@core/bazi/baziCalculator';
import { BaziChartBoard } from '../src/pages/ResultPage/components/BaziChartBoard';

const COMMON_SHENSHA = [
  '天乙贵人',
  '天德贵人',
  '月德贵人',
  '天德合',
  '月德合',
  '天赦日',
  '禄神',
  '驿马',
  '太极贵人',
  '将星',
  '学堂',
  '词馆',
  '国印贵人',
  '三奇贵人',
  '文昌贵人',
  '华盖',
  '天医',
  '金舆',
  '空亡',
  '灾煞',
  '劫煞',
  '亡神',
  '羊刃',
  '飞刃',
  '血刃',
  '流霞',
  '四废日',
  '天罗地网',
  '桃花',
  '孤辰',
  '寡宿',
  '阴差阳错',
  '魁罡',
  '孤鸾煞',
  '红鸾',
  '天喜',
  '勾绞煞',
  '红艳煞',
  '十恶大败',
  '元辰',
  '金神',
  '天转',
  '地转',
  '丧门',
  '吊客',
  '披麻',
  '十灵日',
  '六秀日',
  '八专',
  '九丑',
  '童子煞',
  '天厨贵人',
  '福星贵人',
  '德秀贵人',
  '拱禄',
];

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
  assert.ok(html.indexOf('天干十神') < html.indexOf('元女'));
  assert.ok(html.indexOf('元女') < html.indexOf('>天干<'));
});

test('八字结果盘默认只展示 55 个常用神煞，并保留全局神煞', () => {
  const result = baziCalculator.calculateBazi({
    year: 1988,
    month: 7,
    day: 15,
    timeIndex: 6,
    gender: 'male',
  });
  const pillarShensha = COMMON_SHENSHA.filter((item) => item !== '三奇贵人');

  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '常用神煞测试',
      result: {
        ...result,
        shensha: {
          year: [...pillarShensha, '六厄', '马财库', '真鬼刑疾'],
          month: [],
          day: [],
          hour: [],
          global: ['三奇贵人', '天火煞'],
        },
      },
    }),
  );

  assert.equal(COMMON_SHENSHA.length, 55);
  COMMON_SHENSHA.forEach((item) =>
    assert.ok(html.includes(`>${item}<`), `盘面应展示常用神煞：${item}`),
  );
  assert.equal(html.match(/class="bazi-shensha-tag /g)?.length, 55);
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
