import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildCurrentBaziFortuneSelection } from 'mingyu-core/bazi';

import { baziCalculator } from '@core/bazi/baziCalculator';
import {
  BaziFortuneSelector,
  resolveFortuneSelectorState,
} from '../src/components/BaziFortuneTools/BaziFortuneSelector';
import { buildPersonFromInput, calculateFullBaziChart } from '../src/lib/full-chart-engine/bazi';
import { BaziChartBoard } from '../src/pages/ResultPage/components/BaziChartBoard';

const sharedFemaleResult = baziCalculator.calculateBazi({
  year: 1995,
  month: 5,
  day: 20,
  timeIndex: 6,
  gender: 'female',
});

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
  assert.ok(html.indexOf('命式') < html.indexOf('元男'));
  assert.match(html, /data-wuxing="[木火土金水]"/);
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
});

test('未知时辰盘面保留稳定柱并将依赖出生时刻的资料标为待补', () => {
  const person = buildPersonFromInput({
    gender: 'male',
    year: 1999,
    month: 1,
    day: 1,
    timeIndex: -1,
  });
  const result = calculateFullBaziChart(person);
  const candidateCount = result.unknownTimeAnalysis?.scenarios.length ?? 0;

  assert.equal(result.isThreePillars, true);
  assert.equal(result.pillars.hour.ganZhi, '');
  assert.ok(candidateCount > 0, '全天候选资料应保留');

  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '未知时辰测试',
      result,
    }),
  );

  assert.match(html, /三柱盘（时辰未知）/);
  assert.match(html, /时辰未知/);
  assert.match(html, />待补时</);
  const knownPillars = (['year', 'month', 'day'] as const)
    .map((key) => ({ key, ...result.pillars[key] }))
    .filter((pillar) => pillar.gan && pillar.zhi);
  assert.ok(knownPillars.length > 0, '已确定的本命柱应继续展示');
  for (const pillar of knownPillars) {
    assert.ok(html.includes(`>${pillar.gan}</strong>`), `${pillar.key}柱天干事实应继续展示`);
    assert.ok(html.includes(`>${pillar.zhi}</strong>`), `${pillar.key}柱地支事实应继续展示`);
  }
  for (const key of result.unknownTimeAnalysis!.uncertainPillars) {
    assert.equal(result.pillars[key].ganZhi, '', `${key}柱随出生时刻变化，继续待补时`);
  }
  assert.equal(result.pillars.hour.ganZhi, '', '页面不应生成虚构时柱');
});

test('未知时辰跨交节时年、月、日待补柱可以完整渲染', () => {
  const result = calculateFullBaziChart(
    buildPersonFromInput({ gender: 'male', year: 2024, month: 2, day: 4, timeIndex: -1 }),
  );
  assert.deepEqual(
    new Set(result.unknownTimeAnalysis?.uncertainPillars),
    new Set(['year', 'month', 'day']),
  );
  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, { title: '八字排盘', name: '交节测试', result }),
  );
  assert.match(html, /三柱盘（时辰未知）/);
  assert.match(html, />待补时</);
  assert.doesNotMatch(html, /undefined|五行属undefined/);
  assert.ok(result.unknownTimeAnalysis!.scenarios.length > 0);
  for (const key of ['year', 'month', 'day', 'hour'] as const) {
    assert.equal(result.pillars[key].ganZhi, '');
  }
});

test('八字女命日柱应标注元女', () => {
  const result = sharedFemaleResult;

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
  const result = sharedFemaleResult;
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
  const result = sharedFemaleResult;
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

test('八字盘神煞显示保留常用项、过滤扩展项并规范合并简称', () => {
  const html = renderToStaticMarkup(
    createElement(BaziChartBoard, {
      title: '八字排盘',
      name: '神煞展示测试',
      result: {
        ...sharedFemaleResult,
        shensha: {
          year: ['福星贵人', '拱禄', '六厄', '马财库', '真鬼刑疾', '天罗', '地网', '天乙', '勾绞'],
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
  ['六厄', '马财库', '真鬼刑疾', '天火煞', '天罗', '地网', '天乙', '勾绞'].forEach((item) =>
    assert.ok(!html.includes(`>${item}<`), `盘面应隐藏扩展项或简称：${item}`),
  );
  assert.ok(html.includes('>天罗地网<'));
  assert.ok(html.includes('>天乙贵人<'));
  assert.ok(html.includes('>勾绞煞<'));
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

  assert.match(html, /aria-label="回到今天"/);
  assert.ok(html.indexOf('>岁运<') < html.indexOf('>今<'));
  assert.ok(html.indexOf('>今<') < html.indexOf('>大运<'));
  assert.match(html, />流时</);
});

test('八字岁运选择器在立春前默认定位上一节气年和末月', (context) => {
  context.mock.timers.enable({ apis: ['Date'], now: new Date('2008-01-15T04:00:00Z') });
  const result = baziCalculator.calculateBazi({
    year: 1992,
    month: 7,
    day: 15,
    timeIndex: 3,
    gender: 'female',
  });
  const html = renderToStaticMarkup(createElement(BaziFortuneSelector, { result }));
  const yearRow = html
    .split('class="row-title">流年</div>')[1]
    ?.split('class="row-title">流月</div>')[0];
  const monthRow = html
    .split('class="row-title">流月</div>')[1]
    ?.split('class="row-title">流日</div>')[0];
  const activeYear = yearRow?.match(/class="fortune-item active"[^>]*>([\s\S]*?)<\/button>/)?.[1];
  const activeMonth = monthRow?.match(/class="fortune-item active"[^>]*>([\s\S]*?)<\/button>/)?.[1];

  assert.match(activeYear ?? '', /class="fortune-year">2007<\/div>/);
  assert.match(activeMonth ?? '', /class="fortune-year">丑月<\/div>/);
});

test('八字岁运选择器换命盘后定位新盘当前岁运且同盘重渲染保留手动选择', (context) => {
  const now = new Date('2026-09-27T04:00:00.000Z');
  context.mock.timers.enable({ apis: ['Date'], now });

  const firstResult = baziCalculator.calculateBazi({
    year: 1992,
    month: 7,
    day: 15,
    timeIndex: 3,
    gender: 'female',
  });
  const nextResult = baziCalculator.calculateBazi({
    year: 1988,
    month: 11,
    day: 3,
    timeIndex: 8,
    gender: 'male',
  });
  const firstSelection = resolveFortuneSelectorState(null, firstResult, now);
  const manuallySelected = {
    ...firstSelection,
    year: firstSelection.year - 1,
    month: 3,
    day: 4,
    hourIndex: 7,
  };

  assert.strictEqual(
    resolveFortuneSelectorState(manuallySelected, firstResult, now),
    manuallySelected,
  );

  const nextSelection = resolveFortuneSelectorState(manuallySelected, nextResult, now);
  const expected = buildCurrentBaziFortuneSelection(nextResult, now);
  assert.ok(expected);
  assert.equal(nextSelection.result, nextResult);
  assert.deepEqual(
    {
      cycleIndex: nextSelection.cycleIndex,
      year: nextSelection.year,
      month: nextSelection.month,
      day: nextSelection.day,
      hourIndex: nextSelection.hourIndex,
    },
    {
      cycleIndex: expected.cycleIndex,
      year: expected.year,
      month: expected.month,
      day: expected.day,
      hourIndex: 6,
    },
  );

  const selectionAfterSwitchBack = resolveFortuneSelectorState(nextSelection, firstResult, now);
  assert.deepEqual(
    {
      cycleIndex: selectionAfterSwitchBack.cycleIndex,
      year: selectionAfterSwitchBack.year,
      month: selectionAfterSwitchBack.month,
      day: selectionAfterSwitchBack.day,
      hourIndex: selectionAfterSwitchBack.hourIndex,
    },
    {
      cycleIndex: firstSelection.cycleIndex,
      year: firstSelection.year,
      month: firstSelection.month,
      day: firstSelection.day,
      hourIndex: firstSelection.hourIndex,
    },
  );
});
