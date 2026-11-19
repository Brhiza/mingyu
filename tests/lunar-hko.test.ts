import assert from 'node:assert/strict';
import test from 'node:test';
import { calculate, reprompt } from '../src/core';
import { resolveBirthClock } from '../src/systems/birth-time';
import { LunarDay } from 'tyme4ts';
import worker from '../src/worker';

// 香港天文台公历与农历日期对照表：每行是农历初一的公历日期，最后一行是下一年正月初一。
// https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2023c.txt
// https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2024c.txt
// https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2033c.txt
// https://www.hko.gov.hk/tc/gts/time/calendar/text/files/T2034c.txt
const years = [
  { year: 2023, months: [
    [1, '2023-01-22'], [2, '2023-02-20'], [-2, '2023-03-22'], [3, '2023-04-20'],
    [4, '2023-05-19'], [5, '2023-06-18'], [6, '2023-07-18'], [7, '2023-08-16'],
    [8, '2023-09-15'], [9, '2023-10-15'], [10, '2023-11-13'], [11, '2023-12-13'],
    [12, '2024-01-11'], [1, '2024-02-10'],
  ] },
  { year: 2033, months: [
    [1, '2033-01-31'], [2, '2033-03-01'], [3, '2033-03-31'], [4, '2033-04-29'],
    [5, '2033-05-28'], [6, '2033-06-27'], [7, '2033-07-26'], [8, '2033-08-25'],
    [9, '2033-09-23'], [10, '2033-10-23'], [11, '2033-11-22'], [-11, '2033-12-22'],
    [12, '2034-01-20'], [1, '2034-02-19'],
  ] },
] as const;
const oneDay = 86_400_000;
const dayNames = ['', '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

test('2023 和 2033 农历每一天均与香港天文台日期表对应', () => {
  let count = 0;
  for (const { year, months } of years) {
    for (let index = 0; index < months.length - 1; index++) {
      const [month, start] = months[index], end = months[index + 1][1];
      const first = Date.parse(`${start}T00:00:00Z`), length = (Date.parse(`${end}T00:00:00Z`) - first) / oneDay;
      assert.ok(length === 29 || length === 30, `${year}/${month}`);
      for (let day = 1; day <= length; day++) {
        const expected = new Date(first + (day - 1) * oneDay).toISOString().slice(0, 10);
        const clock = resolveBirthClock({ year, month: Math.abs(month), day, hour: 12, minute: 0, second: 0, timezone: 8, calendar: 'lunar', leapMonth: month < 0 });
        assert.equal(clock.localDateTime, `${expected}T12:00:00`, `${year}/${month}/${day}`);
        count++;
      }
      assert.throws(() => resolveBirthClock({ year, month: Math.abs(month), day: length + 1, hour: 12, minute: 0, second: 0, timezone: 8, calendar: 'lunar', leapMonth: month < 0 }), undefined, `${year}/${month} 不应有第 ${length + 1} 日`);
    }
  }
  assert.equal(count, 768);
});

test('紫微排盘库的 2023 与 2033 逐日农历日期同样符合天文台表', async () => {
  const monthNames = ['', '正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
  const digits = [...'〇一二三四五六七八九'];
  let count = 0;
  for (const { year, months } of years) {
    const lunarYear = String(year).split('').map((digit) => digits[Number(digit)]).join('');
    for (let index = 0; index < months.length - 1; index++) {
      const [month, start] = months[index], first = Date.parse(`${start}T00:00:00Z`);
      const length = (Date.parse(`${months[index + 1][1]}T00:00:00Z`) - first) / oneDay;
      for (let day = 1; day <= length; day++) {
        const date = new Date(first + (day - 1) * oneDay);
        const result = await calculate('ziwei', { question: '核验日期', gender: 'female', birth: { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1,
          day: date.getUTCDate(), clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, timezone: 8 } });
        assert.equal(result.data.natal.lunarDate, `${lunarYear}年${month < 0 ? '闰' : ''}${monthNames[Math.abs(month)]}月${dayNames[day]}`, `${year}/${month}/${day}`);
        count++;
      }
    }
  }
  assert.equal(count, 768);
});

test('闰月边界的八字、紫微与公历输入及追问一致', async () => {
  for (const { year, months } of years) {
    const leapIndex = months.findIndex(([month]) => month < 0);
    for (const index of [leapIndex - 1, leapIndex, leapIndex + 1]) {
      const [month, start] = months[index], end = months[index + 1][1];
      const first = Date.parse(`${start}T00:00:00Z`), length = (Date.parse(`${end}T00:00:00Z`) - first) / oneDay;
      for (const day of [1, length]) {
        const solar = new Date(first + (day - 1) * oneDay);
        const clock = { kind: 'exact' as const, hour: 12, minute: 0, second: 0 };
        const lunarBirth = { year, month: Math.abs(month), day, calendar: 'lunar' as const, leapMonth: month < 0, clock, timezone: 8 };
        const solarBirth = { year: solar.getUTCFullYear(), month: solar.getUTCMonth() + 1, day: solar.getUTCDate(), clock, timezone: 8 };
        for (const method of ['bazi', 'ziwei'] as const) {
          const input = { question: '比较出生盘', gender: 'female', currentTime: '2025-01-01T00:00:00Z' };
          const lunar = await calculate(method, { ...input, birth: lunarBirth });
          const civil = await calculate(method, { ...input, birth: solarBirth });
          if (method === 'bazi') assert.deepEqual(lunar.data.chart!.pillars, civil.data.chart!.pillars, `${year}/${month}/${day}`);
          else assert.deepEqual(lunar.data.natal, civil.data.natal, `${year}/${month}/${day}`);
          const saved = JSON.parse(JSON.stringify(lunar));
          assert.match((await reprompt({ method, result: saved, question: '继续' })).prompt.text, /继续/);
        }
      }
    }
  }
});

test('农历日期转换保留午夜和晚子时的实际钟表时间', () => {
  for (const [year, month, leapMonth, date] of [[2023, 2, true, '2023-03-22'], [2033, 11, true, '2033-12-22']] as const) {
    for (const [hour, minute, second] of [[0, 0, 0], [23, 59, 59]]) {
      const clock = resolveBirthClock({ year, month, day: 1, hour, minute, second, timezone: 8, calendar: 'lunar', leapMonth });
      assert.equal(clock.localDateTime, `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`);
    }
  }
});

test('2057 年新月接近午夜导致历表分歧，农历歧义输入提示核对公历', async () => {
  // 天文台 https://www.hko.gov.hk/en/gts/time/conversion.htm 提示此日朔时接近午夜。
  // 其 2057 日期表以 9 月 28 日为九月初一，当前依赖为 9 月 29 日；不能断言某一预测是确定事实。
  const library = LunarDay.fromYmd(2057, 9, 1).getSolarDay();
  assert.equal(`${library.getYear()}-${library.getMonth()}-${library.getDay()}`, '2057-9-29');
  const base = { year: 2057, hour: 12, minute: 0, second: 0, timezone: 8, calendar: 'lunar' as const };
  assert.equal(resolveBirthClock({ ...base, month: 8, day: 29 }).localDateTime, '2057-09-27T12:00:00');
  assert.equal(resolveBirthClock({ ...base, month: 10, day: 1 }).localDateTime, '2057-10-28T12:00:00');
  for (const [month, day] of [[8, 30], [9, 1], [9, 15], [9, 29], [9, 30]]) {
    assert.throws(() => resolveBirthClock({ ...base, month, day }), /不同历表.*公历/);
    for (const clock of [{ kind: 'exact', hour: 12, minute: 0, second: 0 }, { kind: 'unknown' }, { kind: 'shichen', index: 6 }]) {
      for (const method of ['bazi', 'ziwei', 'bazi-ziwei'] as const) {
        await assert.rejects(() => calculate(method, { question: '问题', gender: 'female', birth: { year: 2057, month, day, clock, calendar: 'lunar', timezone: 8 } }), /不同历表.*公历/, `${method}/${month}/${day}/${clock.kind}`);
      }
    }
  }
  const solar = await calculate('bazi', { question: '问题', birth: { year: 2057, month: 9, day: 28, clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, timezone: 8 } });
  assert.equal(solar.data.chart!.basis.localDateTime, '2057-09-28T12:00:00');
  const env = { ASSETS: { fetch: async () => new Response('asset') }, ENABLED_METHODS: 'bazi' };
  const send = (path: string, body: unknown) => worker.fetch(new Request(`https://local${path}`, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify(body) }), env);
  const input = { question: '问题', birth: { year: 2057, month: 9, day: 1, clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, calendar: 'lunar', timezone: 8 } };
  const http = await send('/api/calculate', { method: 'bazi', input });
  assert.equal(http.status, 400); assert.match((await http.json() as any).error, /不同历表.*公历/);
  const mcp = await send('/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'bazi', arguments: input } });
  const body: any = await mcp.json();
  assert.equal(body.result.isError, true); assert.match(JSON.stringify(body.result.content), /不同历表.*公历/);
});

test('已知历表分歧进入受影响的紫微、合参、梅花和小六壬提示词及追问', async () => {
  const clock = { kind: 'exact', hour: 12, minute: 0, second: 0 } as const;
  const birth = { year: 2057, month: 9, day: 28, clock, timezone: 8 };
  const cases = [
    ['ziwei', { question: '问题', gender: 'female', birth }],
    ['ziwei', { question: '问题', gender: 'female', birth: { ...birth, clock: { kind: 'unknown' } } }],
    ['bazi-ziwei', { question: '问题', gender: 'female', birth }],
    ['ziwei-synastry', { question: '问题', person1: { birth, gender: 'female' }, person2: { birth: { ...birth, year: 2000 }, gender: 'male' } }],
    ['instant', { question: '问题', type: 'ziwei', at: '2057-09-28T04:00:00Z' }],
    ['xiaoliuren', { question: '问题', divinationTime: '2057-09-28T04:00:00Z' }],
    ['meihua', { question: '问题', divinationTime: '2057-09-28T04:00:00Z', meihua: { method: 'time' } }],
  ] as const;
  for (const [method, input] of cases) {
    const result = await calculate(method, { ...input, currentTime: '2057-09-28T04:00:00Z' });
    assert.match(result.prompt.text, /香港天文台预测中相差一天/, method);
    const next = await reprompt({ method, result: JSON.parse(JSON.stringify(result)), question: '继续' });
    assert.match(next.prompt.text, /香港天文台预测中相差一天/, method);
  }
  for (const method of ['xiaoliuren', 'meihua'] as const) {
    for (const date of ['2057-09-27T04:00:00Z', '2057-10-28T04:00:00Z']) {
      const result = await calculate(method, { question: '问题', divinationTime: date, currentTime: date });
      assert.doesNotMatch(result.prompt.text, /香港天文台预测中相差一天/, `${method}/${date}`);
    }
  }
  const flow = await calculate('ziwei', { question: '问题', gender: 'female', birth: { ...birth, year: 2000, day: 15 }, referenceTime: '2057-09-28T04:00:00Z' });
  assert.match(flow.prompt.text, /香港天文台预测中相差一天/);
});

test('2057 年历表分歧覆盖整段日期，边界外不误报', async () => {
  const start = Date.parse('2057-09-28T00:00:00Z');
  for (let index = -1; index <= 30; index++) {
    const date = new Date(start + index * oneDay);
    const result = await calculate('ziwei', { question: '问题', gender: 'female', birth: {
      year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(),
      clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, timezone: 8,
    } });
    if (index >= 0 && index < 30) {
      const hkoPrediction = `二〇五七年九月${dayNames[index + 1]}`;
      assert.notEqual(result.data.natal.lunarDate, hkoPrediction, date.toISOString());
      assert.match(result.prompt.text, /香港天文台预测中相差一天/, date.toISOString());
      assert.ok(result.data.limitations.some((item) => item.includes('香港天文台预测中相差一天')));
    } else {
      assert.doesNotMatch(result.prompt.text, /香港天文台预测中相差一天/, date.toISOString());
    }
  }
});

test('天文台列出的另外两个近午夜新月与两套当前历表的日期相同', async () => {
  // https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2089e.txt
  // https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2097e.txt
  // 天文台仍提示远期朔时不确定，当前结果一致不等于最终观测日期已确定。
  for (const [year, lunarMonth, expected, displayed] of [
    [2089, 8, '2089-09-04', '二〇八九年八月初一'], [2097, 7, '2097-08-07', '二〇九七年七月初一'],
  ] as const) {
    const resolved = resolveBirthClock({ year, month: lunarMonth, day: 1, hour: 12, minute: 0, second: 0, timezone: 8, calendar: 'lunar' });
    assert.equal(resolved.localDateTime, `${expected}T12:00:00`);
    const [solarYear, month, day] = expected.split('-').map(Number);
    const ziwei = await calculate('ziwei', { question: '核验日期', gender: 'female', birth: { year: solarYear, month, day,
      clock: { kind: 'exact', hour: 12, minute: 0, second: 0 }, timezone: 8 } });
    assert.equal(ziwei.data.natal.lunarDate, displayed);
  }
});

test('紫微晚子换日按实际安星日期判断历表差异', async () => {
  const birth = { year: 2057, month: 9, day: 27, clock: { kind: 'exact', hour: 23, minute: 30, second: 0 }, timezone: 8 };
  const nextDay = await calculate('ziwei', { question: '问题', gender: 'female', birth, rules: { dayDivide: 'forward' } });
  assert.equal(nextDay.data.basis.effectiveDate, '2057-09-28');
  assert.match(nextDay.prompt.text, /香港天文台预测中相差一天/);
  const sameDay = await calculate('ziwei', { question: '问题', gender: 'female', birth, rules: { dayDivide: 'current' } });
  assert.equal(sameDay.data.basis.effectiveDate, '2057-09-27');
  assert.doesNotMatch(sameDay.prompt.text, /香港天文台预测中相差一天/);
});
