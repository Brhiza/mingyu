import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

function runInTimeZone<T>(timeZone: string, script: string): T {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', script],
    {
      cwd: process.cwd(),
      env: { ...process.env, TZ: timeZone },
      encoding: 'utf8',
      timeout: 30_000,
    },
  );
  assert.equal(result.status, 0, `${timeZone} 子进程失败：${result.stderr || result.error}`);
  return JSON.parse(result.stdout.trim()) as T;
}

test('紫微出生四柱和提示词不受宿主夏令时跳时影响', () => {
  const script = `
    import { calculateZiweiChart } from './packages/core/src/ziwei/runtime.ts';
    import { buildZiweiPrompt } from './packages/core/src/prompt/ziwei.ts';
    const result = await calculateZiweiChart({
      name: '跨时区核对', dateType: 'solar', birthDate: '1990-04-01',
      birthTimeIndex: 1, birthTime: { hour: 2, minute: 30, second: 0 }, gender: '男',
    }, { scopes: ['origin'] });
    const pillars = result.payloadByScope.origin.basic_info.four_pillars;
    const prompt = buildZiweiPrompt({ runtime: result, scope: 'origin', question: '解读命盘' });
    console.log(JSON.stringify({ pillars, expectedInPrompt: prompt.includes('时己丑'), wrongInPrompt: prompt.includes('时庚寅') }));
  `;
  type Result = {
    pillars: { hour_pillar: string };
    expectedInPrompt: boolean;
    wrongInPrompt: boolean;
  };
  const utc = runInTimeZone<Result>('UTC', script);
  const newYork = runInTimeZone<Result>('America/New_York', script);
  assert.equal(utc.pillars.hour_pillar, '己丑');
  assert.deepEqual(newYork, utc);
  assert.equal(newYork.expectedInPrompt, true);
  assert.equal(newYork.wrongInPrompt, false);
});

test('太乙年计代表时刻与在线提示词不受宿主时区影响', () => {
  const script = `
    import { generateTaiyi } from './packages/core/src/taiyi/index.ts';
    import { formatTaiyiInfo } from './packages/core/src/prompt/divination-enhanced.ts';
    const result = generateTaiyi({ scope: 'year', year: 2026 });
    console.log(JSON.stringify({ dateTime: result.dateTime, bureau: result.bureau, prompt: formatTaiyiInfo(result) }));
  `;
  type Result = { dateTime: string; bureau: number; prompt: string };
  const utc = runInTimeZone<Result>('UTC', script);
  const honolulu = runInTimeZone<Result>('Pacific/Honolulu', script);
  assert.equal(utc.dateTime, '2026-07-01 12:00:00');
  assert.equal(utc.bureau, 55);
  assert.deepEqual(honolulu, utc);
  assert.match(honolulu.prompt, /起局时间：2026-07-01 12:00:00/);
});

test('黄历择日范围在宿主跳过整日时仍包含每个公历日期', () => {
  const script = `
    import { generateAlmanacSelection } from './packages/core/src/divination/algorithms/almanac.ts';
    const range = generateAlmanacSelection({ topic: 'marriage', startDate: '2011-12-29', endDate: '2011-12-31' });
    let single;
    try {
      single = generateAlmanacSelection({ topic: 'marriage', startDate: '2011-12-30', endDate: '2011-12-30' }).days[0].date;
    } catch (error) {
      single = String(error);
    }
    console.log(JSON.stringify({
      days: range.days.map((item) => ({ date: item.date, weekday: item.weekday, ganzhi: item.ganzhi.day })).sort((a, b) => a.date.localeCompare(b.date)),
      single,
    }));
  `;
  type Result = { days: Array<{ date: string; weekday: string; ganzhi: string }>; single: string };
  const utc = runInTimeZone<Result>('UTC', script);
  const apia = runInTimeZone<Result>('Pacific/Apia', script);
  assert.deepEqual(
    utc.days.map((item) => item.date),
    ['2011-12-29', '2011-12-30', '2011-12-31'],
  );
  assert.equal(utc.single, '2011-12-30');
  assert.deepEqual(apia, utc);
});

test('七政神煞按输入民用日期计算，不受宿主跳日影响', () => {
  const script = `
    import { generateQizheng } from './packages/core/src/qi_zheng/index.ts';
    const result = generateQizheng({ year: 2011, month: 12, day: 30, hour: 12, timezone: 8 });
    console.log(JSON.stringify({
      utcDateTime: result.calculationContext.utcDateTime,
      tianYi: result.shensha.find((item) => item.name === '天乙贵人')?.value,
      prompt: result.prompt,
    }));
  `;
  type Result = { utcDateTime: string; tianYi: string; prompt: string };
  const utc = runInTimeZone<Result>('UTC', script);
  const apia = runInTimeZone<Result>('Pacific/Apia', script);
  assert.equal(utc.utcDateTime, '2011-12-30T04:00:00.000Z');
  assert.equal(utc.tianYi, '子申');
  assert.deepEqual(apia, utc);
  assert.match(apia.prompt, /天乙贵人子申/);
});
