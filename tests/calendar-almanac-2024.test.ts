import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate } from '../src/core';
import { calculateBaziPillars } from '../src/systems/bazi/pillars';

// 臺北市立天文科學教育館《2024 天文年鑑》曆象表，東經 120° 平均太陽時（UTC+8），只提供到分鐘。
// https://www-ws.gov.taipei/001/Upload/439/relfile/21703/3425086/d6082728-c8bb-4be4-a15f-e507264ee47a.pdf
// 月支为传统节令对应关系；中气不切换八字月柱。
const terms = [
  ['小寒', '01-06T04:49', '丑'], ['大寒', '01-20T22:07'],
  ['立春', '02-04T16:27', '寅'], ['雨水', '02-19T12:13'],
  ['惊蛰', '03-05T10:23', '卯'], ['春分', '03-20T11:06'],
  ['清明', '04-04T15:02', '辰'], ['谷雨', '04-19T22:00'],
  ['立夏', '05-05T08:10', '巳'], ['小满', '05-20T21:00'],
  ['芒种', '06-05T12:10', '午'], ['夏至', '06-21T04:51'],
  ['小暑', '07-06T22:20', '未'], ['大暑', '07-22T15:44'],
  ['立秋', '08-07T08:09', '申'], ['处暑', '08-22T22:55'],
  ['白露', '09-07T11:11', '酉'], ['秋分', '09-22T20:44'],
  ['寒露', '10-08T03:00', '戌'], ['霜降', '10-23T06:15'],
  ['立冬', '11-07T06:20', '亥'], ['小雪', '11-22T03:56'],
  ['大雪', '12-06T23:17', '子'], ['冬至', '12-21T17:21'],
] as const;

const instant = (time: string) => Date.parse(`2024-${time}:00+08:00`);

async function pillarsAt(timestamp: number) {
  const date = new Date(timestamp + 8 * 3_600_000);
  return (await calculateBaziPillars({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), timezone: 8,
    clock: { kind: 'exact', hour: date.getUTCHours(), minute: date.getUTCMinutes(), second: date.getUTCSeconds() } })).pillars;
}

test('2024 全年二十四节气与外部天文年鉴公布的分钟时刻相符', async () => {
  const result = await calculate('calendar', { question: '核验节气', calendar: { kind: 'solar-term', year: 2024 } });
  const actual = result.data.result;
  assert.equal(actual.kind, 'solar-term');
  if (actual.kind !== 'solar-term') throw new Error('节气结果类型错误');
  assert.equal(actual.terms.length, terms.length);
  for (const [index, [name, time, branch]] of terms.entries()) {
    const term = actual.terms[index];
    assert.equal(term.name, name);
    assert.equal(term.isJie, !!branch, name);
    assert.ok(Math.abs(term.utcTimestamp - instant(time)) < 60_000, `${name}: ${term.utcDateTime} vs ${time} UTC+8`);
  }
});

test('外部年鉴各节气前后两分钟的八字年柱与月柱符合节令', async () => {
  for (const [index, [name, time, branch]] of terms.entries()) {
    const reference = instant(time);
    const before = await pillarsAt(reference - 120_000), after = await pillarsAt(reference + 120_000);
    if (branch) {
      const previousBranch = terms[(index + terms.length - 2) % terms.length][2];
      assert.equal(before.month.zhi, previousBranch, `${name}之前`);
      assert.equal(after.month.zhi, branch, `${name}之后`);
      assert.notEqual(before.month.ganZhi, after.month.ganZhi, name);
    } else {
      assert.equal(before.month.ganZhi, after.month.ganZhi, name);
    }
    assert.equal(before.year.ganZhi, index <= 2 ? '癸卯' : '甲辰', `${name}之前`);
    assert.equal(after.year.ganZhi, index < 2 ? '癸卯' : '甲辰', `${name}之后`);
  }
});
