import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyaoChart } from '../src/systems/liuyao/chart';
import { castLiuyao } from '../src/systems/liuyao/cast';
import { getDivinationTime } from '../src/systems/calendar';

import { calculate, reprompt } from '../src/core';

test('全部 4096 种手工爻值保留六爻、动爻和世应位置', () => {
  const date = new Date('2024-02-19T04:13:12Z');
  for (let id = 0; id < 4096; id++) {
    let encoded = id;
    const yaos: number[] = [];
    for (let position = 0; position < 6; position++) { yaos.push(6 + encoded % 4); encoded = Math.floor(encoded / 4); }
    const chart = generateLiuyaoChart(date, castLiuyao(date.getTime(), { method: 'manual', yaos }), 480);
    assert.deepEqual(chart.yaoArray, yaos, String(id));
    assert.deepEqual(chart.yaosDetail.map((line) => line.rawValue), yaos, String(id));
    assert.deepEqual(chart.changingYaos.map((line) => line.position), yaos.flatMap((value, index) => value === 6 || value === 9 ? [index + 1] : []), String(id));
    assert.equal(chart.yaosDetail.filter((line) => line.isWorld).length, 1, String(id));
    assert.equal(chart.yaosDetail.filter((line) => line.isResponse).length, 1, String(id));
    assert.ok(chart.yaosDetail.every((line) => !(line.isWorld && line.isResponse)), String(id));
    assert.ok(chart.yaosDetail.every((line) => !Object.hasOwn(line, 'isYueMu')), String(id));
  }
});

test('起卦时区接受合法边界并拒绝越界及小数', () => {
  const date = new Date('2025-01-01T16:00:00Z');
  for (const offset of [-720, -300, 0, 330, 480, 840]) assert.equal(getDivinationTime(date, offset).timezoneOffsetMinutes, offset);
  for (const offset of [-721, 841, 0.5]) assert.throws(() => getDivinationTime(date, offset));
});

test('六爻统一支持真太阳时经度校正与追问核验', async () => {
  const currentTime = '2025-05-01T15:30:00Z';
  const beijing = await calculate('liuyao', { question: '出行顺遂否', currentTime, liuyao: { method: 'time', timeStandard: 'beijing' } });
  const kashgar = await calculate('liuyao', { question: '出行顺遂否', currentTime, liuyao: { method: 'time', timeStandard: 'true-solar', longitude: 76 } });
  assert.equal(beijing.data.timeContext, undefined);
  assert.equal(kashgar.data.timeContext?.standard, 'true-solar');
  assert.notEqual(kashgar.data.ganzhi.hour, beijing.data.ganzhi.hour);
  const next = await reprompt({ method: 'liuyao', result: kashgar, question: '再问细节' });
  assert.match(next.prompt.text, /真太阳时/);
  await assert.rejects(() => calculate('liuyao', { question: '缺经度', currentTime, liuyao: { method: 'time', timeStandard: 'true-solar' } }));
  await assert.rejects(() => calculate('liuyao', { question: '多经度', currentTime, liuyao: { method: 'time', timeStandard: 'beijing', longitude: 116 } }));
});
