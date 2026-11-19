import assert from 'node:assert/strict';
import test from 'node:test';
import { generateLiuyaoChart } from '../src/systems/liuyao/chart';
import { castLiuyao } from '../src/systems/liuyao/cast';
import { getDivinationTime } from '../src/systems/calendar';

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
