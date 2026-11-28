import test from 'node:test';
import assert from 'node:assert/strict';
import { SolarTime } from 'tyme4ts';
import {
  getCurrentSolarTermMonthIndex,
  getFlowDayHours,
  getFlowMonthDays,
  getFlowMonthStartMeta,
  getShichenIndexForBeijingHour,
} from '../src/systems/bazi/flow-calendar';

test('getFlowMonthDays 按节气准确列出 2026 亥月全部流日及干支', () => {
  const days = getFlowMonthDays(2026, 9);
  assert.equal(days[0]?.key, '2026-11-07');
  assert.equal(days.at(-1)?.key, '2026-12-06');
  assert.equal(days.length, 30);
  assert.ok(days.every((d) => typeof d.lunarLabel === 'string' && d.lunarLabel.length > 0));

  const nov28 = days.find((d) => d.key === '2026-11-28');
  assert.equal(nov28?.shortDate, '11/28');
  assert.equal(nov28?.ganZhi, '丙午');
});

test('getFlowMonthStartMeta 返回准确的节气名与交节公历日期', () => {
  const yinMeta = getFlowMonthStartMeta(2026, 0);
  assert.equal(yinMeta.termName, '立春');
  assert.equal(yinMeta.shortDate, '2/4');

  const haiMeta = getFlowMonthStartMeta(2026, 9);
  assert.equal(haiMeta.termName, '立冬');
  assert.equal(haiMeta.shortDate, '11/7');
});

test('getFlowMonthDays 跨公历新年处理 2026 丑月（小寒至次年立春前）', () => {
  const days = getFlowMonthDays(2026, 11);
  assert.equal(days[0]?.key, '2027-01-05');
  assert.equal(days.at(-1)?.key, '2027-02-03');
  assert.equal(days.length, 30);
});

test('getFlowDayHours 按五鼠遁精确推导十二流时干支且与 tyme4ts 一致', () => {
  const hours = getFlowDayHours('丙午');
  assert.equal(hours.length, 12);
  assert.equal(hours[0]?.label, '子时');
  assert.equal(hours[0]?.ganZhi, '戊子');
  assert.equal(hours[6]?.label, '午时');
  assert.equal(hours[6]?.ganZhi, '甲午');
  assert.equal(hours[11]?.label, '亥时');
  assert.equal(hours[11]?.ganZhi, '己亥');

  const middayEc = SolarTime.fromYmdHms(2026, 11, 28, 12, 0, 0).getLunarHour().getEightChar();
  assert.equal(hours[6]?.ganZhi, middayEc.getHour().getName());
});

test('getShichenIndexForBeijingHour 与 getCurrentSolarTermMonthIndex 边界准确', () => {
  assert.equal(getShichenIndexForBeijingHour(23), 0);
  assert.equal(getShichenIndexForBeijingHour(0), 0);
  assert.equal(getShichenIndexForBeijingHour(1), 1);
  assert.equal(getShichenIndexForBeijingHour(12), 6);
  assert.equal(getShichenIndexForBeijingHour(22), 11);

  const bjDate = new Date(Date.UTC(2026, 10, 28, 12, 0, 0));
  const cur = getCurrentSolarTermMonthIndex(bjDate);
  assert.deepEqual(cur, { flowYear: 2026, monthIndex: 9 });
});
