import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAstrolabeScopeContext } from '../src/lib/astrolabe-scope';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import type { AstrolabeData } from 'mingyu-core/types';

const astrolabeData = generateAstrolabe({
  name: '本人',
  gender: '女',
  year: '1995',
  month: '5',
  day: '20',
  hour: '12',
  minute: '30',
  latitude: '39.9042',
  longitude: '116.4074',
  timezone: '8',
  locationName: '北京',
});

test('星盘本命分析对象只写入长期结构边界', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'natal', '2028-06-01');

  assert.equal(context.displayText, '仅使用本命信息');
  assert.equal(context.dateStr, '');
  assert.match(context.promptText, /分析对象：本命盘。/);
  assert.match(context.promptText, /本命宫主星链条：第1宫/);
  assert.match(context.promptText, /宫主星链条只用于定位议题落点/);
  assert.match(context.promptText, /不得自行指定流年、流月、流日或具体应期/);
  assert.match(context.promptText, /资料范围：本任务书提供本命盘结构、本命宫主星链条/);
  assert.match(context.promptText, /不包含太阳返照、次限推进、太阳弧/);
  assert.doesNotMatch(context.promptText, /行运落宫提示：/);
});

test('星盘流年分析对象会生成行运证据和展示文本', () => {
  const context = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2028');

  assert.equal(context.displayText, '流年 · 2028');
  assert.equal(context.dateStr, '2028');
  assert.match(context.promptText, /分析对象：流年2028。/);
  assert.match(context.promptText, /取样时间：2028-07-01 12:00/);
  assert.match(context.promptText, /本命宫主星链条：第1宫/);
  assert.match(context.promptText, /行运证据：/);
  assert.match(context.promptText, /行运落宫提示：/);
  assert.match(context.promptText, /落本命第\d+宫/);
  assert.match(context.promptText, /不包含太阳返照、次限推进、太阳弧/);
  assert.doesNotMatch(context.promptText, /未计算|技术限制|当前项目/);
  assert.match(context.promptText, /时间边界：本命盘只定长期结构/);
});

test('星盘流月与流日沿用同一选择器语义并写明应期层级', () => {
  const monthContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-06');
  const dayContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-06-12');

  assert.equal(monthContext.displayText, '流月 · 2028-06');
  assert.equal(dayContext.displayText, '流日 · 2028-06-12');
  assert.match(monthContext.promptText, /分析对象：流月2028-06。/);
  assert.match(dayContext.promptText, /分析对象：流日2028-06-12。/);
  assert.match(monthContext.promptText, /行运落宫提示：/);
  assert.match(dayContext.promptText, /行运落宫提示：/);
  assert.match(monthContext.promptText, /所选流年、流月或流日只作为当前阶段触发与应期参考/);
  assert.match(dayContext.promptText, /不能把没有行运证据支持的年份、月份或日期硬说成确定应期/);
});

test('星盘范围日期不存在时不应夹到另一天', () => {
  const invalidDayContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2028-02-31');
  const invalidMonthContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2028-13');

  assert.notEqual(invalidDayContext.dateStr, '2028-02-29');
  assert.notEqual(invalidMonthContext.dateStr, '2028-12');
});

test('星盘行运范围应支持 2100 年以后的有效年份', () => {
  const yearlyContext = buildAstrolabeScopeContext(astrolabeData, 'yearly', '2101');
  const monthlyContext = buildAstrolabeScopeContext(astrolabeData, 'monthly', '2101-02');
  const dailyContext = buildAstrolabeScopeContext(astrolabeData, 'daily', '2101-02-28');

  assert.equal(yearlyContext.dateStr, '2101');
  assert.equal(monthlyContext.dateStr, '2101-02');
  assert.equal(dailyContext.dateStr, '2101-02-28');
});

test('星盘资料缺少经度时应退回保守提示而不是报错', () => {
  const incompleteData = {
    ...astrolabeData,
    planets: astrolabeData.planets.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
    angles: astrolabeData.angles.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
  } satisfies AstrolabeData;
  const context = buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12');

  assert.equal(context.displayText, '流日 · 2028-06-12');
  assert.match(context.promptText, /本命点经度资料不足/);
  assert.match(context.promptText, /行运落宫提示：/);
  assert.match(context.promptText, /落本命第\d+宫/);
  assert.doesNotThrow(() => buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12'));
});

test('星盘资料缺少宫头经度时应禁止行运落宫证据', () => {
  const incompleteData = {
    ...astrolabeData,
    houses: astrolabeData.houses.map((item) => ({
      ...item,
      longitude: Number.NaN,
    })),
  } satisfies AstrolabeData;
  const context = buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12');

  assert.match(context.promptText, /行运落宫提示：本命宫头资料不足/);
  assert.doesNotThrow(() => buildAstrolabeScopeContext(incompleteData, 'daily', '2028-06-12'));
});
