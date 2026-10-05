import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBaziChartFromInput, getTenGodForBranch } from 'mingyu-core/bazi';
import {
  buildFrontendInstantObserver,
  buildInstantQueryInput,
  buildInstantResultPath,
  instantChartNeedsObserver,
} from '@/lib/instant-chart';
import { buildInstantBaziPrompt } from '@/lib/instant-prompt';
import { buildPersonFromInput, calculateFullBaziChart } from '@/lib/full-chart-engine/bazi';
import { parseInputState } from '@/lib/query-state';

const now = new Date('2026-08-24T12:30:00+08:00');
const observer = buildFrontendInstantObserver({
  birthPlace: '北京市东城区',
  birthLongitude: '116.416',
  birthLatitude: '39.929',
})!;

test('网页即时盘不携带性别和案例编号', () => {
  const path = buildInstantResultPath({
    type: 'bazi',
    timeStandard: 'beijing',
    now,
  });
  const url = new URL(path, 'https://aov.cc');

  assert.equal(url.pathname, '/result');
  assert.equal(url.searchParams.get('instant'), 'bazi');
  assert.equal(url.searchParams.get('its'), 'beijing');
  assert.equal(url.searchParams.has('g'), false);
  assert.equal(url.searchParams.has('rid'), false);
});

test('网页即时盘跨节气时保留同一时刻的时分秒', () => {
  const before = new Date('2025-05-05T05:57:12.000Z');
  const after = new Date('2025-05-05T05:57:14.000Z');
  const chartAt = (instant: Date) => {
    const input = buildInstantQueryInput({ type: 'bazi', timeStandard: 'beijing', now: instant });
    assert.equal(input.birthHour, '13');
    assert.equal(input.birthMinute, '57');
    assert.equal(input.birthSecond, String(instant.getUTCSeconds()));
    const path = buildInstantResultPath({ type: 'bazi', timeStandard: 'beijing', now: instant });
    const restored = parseInputState(new URL(path, 'https://aov.cc').searchParams);
    assert.equal(restored.birthSecond, input.birthSecond);
    return calculateFullBaziChart(buildPersonFromInput(restored)).pillars.month.ganZhi;
  };

  const beforeMonth = chartAt(before);
  const afterMonth = chartAt(after);
  assert.notEqual(beforeMonth, afterMonth);
});

test('网页即时盘按类型和时间口径决定是否需要地点', () => {
  assert.equal(instantChartNeedsObserver('bazi', 'beijing'), false);
  assert.equal(instantChartNeedsObserver('bazi', 'true-solar'), true);
  assert.equal(instantChartNeedsObserver('ziwei', 'true-solar'), true);
  assert.equal(instantChartNeedsObserver('astrolabe', 'beijing'), true);
  assert.equal(instantChartNeedsObserver('qizheng', 'beijing'), true);
  assert.equal(observer.timezone, 8);
  assert.equal(observer.timeZoneId, 'Asia/Shanghai');
});

test('网页即时盘不能把空坐标当作零度观测点', () => {
  assert.equal(
    buildFrontendInstantObserver({
      birthPlace: '北京市东城区',
      birthLongitude: '',
      birthLatitude: '39.929',
    }),
    undefined,
  );
  assert.equal(
    buildFrontendInstantObserver({
      birthPlace: '北京市东城区',
      birthLongitude: '116.416',
      birthLatitude: ' ',
    }),
    undefined,
  );
  assert.equal(
    buildFrontendInstantObserver({
      birthPlace: '坐标范围外',
      birthLongitude: '181',
      birthLatitude: '39.929',
    }),
    undefined,
  );
  assert.equal(
    buildFrontendInstantObserver({
      birthPlace: '坐标范围外',
      birthLongitude: '116.416',
      birthLatitude: '-91',
    }),
    undefined,
  );
  const zero = buildFrontendInstantObserver({
    birthPlace: '零度地点',
    birthLongitude: '0',
    birthLatitude: '0',
  });
  assert.equal(zero?.longitude, 0);
  assert.equal(zero?.latitude, 0);
});

test('网页八字即时盘提示词只描述当前时刻事件盘', () => {
  const result = calculateBaziChartFromInput({
    gender: 'male',
    dateType: 'solar',
    year: 2026,
    month: 8,
    day: 24,
    timeIndex: 6,
  });
  const prompt = buildInstantBaziPrompt(result, '现在适合推进这件事吗？', '北京时间');

  assert.match(prompt, /^【传统依据】\n/m);
  assert.ok(prompt.indexOf('【传统依据】') < prompt.indexOf('【时间口径】'));
  assert.match(prompt, /盘面年月日时均为本次事件的起盘时间/);
  assert.match(prompt, /现在适合推进这件事吗/);
  assert.match(
    prompt,
    new RegExp(getTenGodForBranch(result.pillars.day.zhi, result.dayMaster.gan)),
  );
  assert.doesNotMatch(prompt, /乾造|坤造|性别|元男|元女|大运|命卦|出生/);
});
