import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateBaziChartFromInput, getTenGodForBranch } from 'mingyu-core/bazi';
import {
  buildFrontendInstantObserver,
  buildInstantResultPath,
  instantChartNeedsObserver,
} from '@/lib/instant-chart';
import { buildInstantBaziPrompt } from '@/lib/instant-prompt';

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

test('网页即时盘按类型和时间口径决定是否需要地点', () => {
  assert.equal(instantChartNeedsObserver('bazi', 'beijing'), false);
  assert.equal(instantChartNeedsObserver('bazi', 'true-solar'), true);
  assert.equal(instantChartNeedsObserver('ziwei', 'true-solar'), true);
  assert.equal(instantChartNeedsObserver('astrolabe', 'beijing'), true);
  assert.equal(instantChartNeedsObserver('qizheng', 'beijing'), true);
  assert.equal(observer.timezone, 8);
  assert.equal(observer.timeZoneId, 'Asia/Shanghai');
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

  assert.match(prompt, /当前时刻的事件盘/);
  assert.match(prompt, /现在适合推进这件事吗/);
  assert.match(
    prompt,
    new RegExp(getTenGodForBranch(result.pillars.day.zhi, result.dayMaster.gan)),
  );
  assert.doesNotMatch(prompt, /乾造|坤造|性别|元男|元女|大运|命卦|出生/);
});
