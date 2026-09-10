import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildZiweiChartInput,
  buildSerializableZiweiResult,
  calculateZiweiChart,
  formatZiweiFortuneTimeline,
} from 'mingyu-core/ziwei';
import { buildPublicZiweiPromptForRuntime } from 'mingyu-core/prompt/public-api';
import { formatZiweiTargetLowerScopeFacts } from '../packages/core/src/prompt/ziwei';

const input = buildZiweiChartInput({
  name: '范围回归样本',
  gender: 'female',
  dateType: 'solar',
  year: '1992',
  month: '8',
  day: '21',
  timeIndex: 4,
  isLeapMonth: false,
  algorithm: 'default',
});

const fixedContext = {
  dateStr: '2026-08-06',
  hourIndex: 4,
} as const;

async function calculateRange(scope: 'current' | 'all' | 'year' | 'month' | 'day' | 'hour') {
  return calculateZiweiChart(input, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: fixedContext,
    fortuneRange: { scope, ...fixedContext },
  });
}

function formatMutagens(mutagen: string[]) {
  const labels = ['禄', '权', '科', '忌'];
  return mutagen
    .map((star, index) => (star ? `${star}化${labels[index] ?? ''}` : ''))
    .filter(Boolean)
    .join('、');
}

function formatLayout(layer: { palaceNames: string[]; palaceTargets: string[] }) {
  return layer.palaceNames
    .map((palace, index) => `${palace}→${layer.palaceTargets[index] ?? ''}`)
    .join('；');
}

function readTable(lines: string[], header: string, nextHeader: string) {
  const start = lines.indexOf(header);
  const end = lines.indexOf(nextHeader);
  assert.ok(start >= 0, `找不到表头：${header}`);
  assert.ok(end > start, `找不到表尾：${nextHeader}`);
  return new Map(
    lines
      .slice(start + 1, end)
      .filter((line) => line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1)] as const;
      }),
  );
}

function parseCompactStars(value: string, starNames: Map<string, string>) {
  return value.split(',').map((group) => {
    if (group === '·') return [];
    return group.split('、').map((code) => {
      const star = starNames.get(code);
      assert.ok(star, `星曜编号未定义：${code}`);
      return star;
    });
  });
}

function parseCompactYearlyDecStars(value: string, starNames: Map<string, string>) {
  const [jiangqian, suiqian] = value.split('；').map((part) => part.slice(2).split('、'));
  const resolve = (code: string) => {
    const star = starNames.get(code);
    assert.ok(star, `年系星曜编号未定义：${code}`);
    return star;
  };
  return {
    jiangqian12: jiangqian.map(resolve),
    suiqian12: suiqian.map(resolve),
  };
}

test('紫微指定年资料保留父级大限、真实流月边界和目标日期动态事实', async () => {
  const runtime = await calculateRange('year');
  const timeline = runtime.fortuneTimeline;
  assert.ok(timeline);
  assert.equal(timeline.targetDateStr, fixedContext.dateStr);
  assert.equal(timeline.periods.length, 1);
  assert.equal(timeline.periods[0]?.years.length, 1);

  const year = timeline.periods[0]?.years[0];
  assert.ok(year);
  assert.equal(year.age, timeline.targetAge);
  assert.equal(year.months?.length, 12);
  assert.equal(year.targetMonth?.dateStr, fixedContext.dateStr);
  assert.notEqual(year.dateStr, fixedContext.dateStr);
  assert.ok(year.months?.every((month) => /^\d{4}-\d{2}-\d{2}$/.test(month.dateStr)));

  const serialized = buildSerializableZiweiResult(runtime);
  assert.equal(serialized.fortuneTimeline?.targetDateStr, fixedContext.dateStr);
  const text = formatZiweiFortuneTimeline(timeline);
  assert.match(text, /实际覆盖：2026-02-17 至 2027-02-05/);
  assert.match(text, /指定流月：\d+月 2026-08-06/);
});

test('紫微全部资料覆盖已验证的童限和大限流年，不伪造下层月份', async () => {
  const runtime = await calculateRange('all');
  const timeline = runtime.fortuneTimeline;
  assert.ok(timeline);
  assert.equal(timeline.periods.length, 17);
  const years = timeline.periods.flatMap((period) => period.years);
  assert.equal(years.length, 125);
  assert.equal(years[0]?.age, 1);
  assert.equal(years.at(-1)?.age, 125);
  assert.ok(years.every((year) => year.months === undefined));
  const text = formatZiweiFortuneTimeline(timeline);
  assert.match(text, /实际覆盖：1992-08-21 至 2117-02-01/);
  assert.match(text, /目标时辰：辰时/);
  assert.ok(text.length < 14_000, `全部运限段过长：${text.length}`);
  assert.equal((text.match(/流年[甲乙丙丁戊己庚辛壬癸]/g) ?? []).length, 125);
});

test('紫微全部运限的编号表可逐年还原四化、宫位、流曜和年系事实', async () => {
  const runtime = await calculateRange('all');
  const timeline = runtime.fortuneTimeline;
  assert.ok(timeline);
  const text = formatZiweiFortuneTimeline(timeline);
  const lines = text.split('\n');
  const mutagenTable = readTable(lines, '四化表：', '宫位布局表（序号依次对应十二宫）：');
  const layoutTable = readTable(lines, '宫位布局表（序号依次对应十二宫）：', '星曜名表：');
  const starNameTable = readTable(
    lines,
    '星曜名表：',
    '星曜组合表（按所引用布局顺序列出十二宫，·表示该宫暂无流曜）：',
  );
  const starTable = readTable(
    lines,
    '星曜组合表（按所引用布局顺序列出十二宫，·表示该宫暂无流曜）：',
    '年系名表：',
  );
  const yearlyDecStarNameTable = readTable(lines, '年系名表：', '年系组合表：');
  const yearlyDecStarTable = readTable(
    lines,
    '年系组合表：',
    '阶段行末引用顺序：四化/布局/星曜；流年行末引用顺序：四化/布局/星曜/年系。',
  );
  const yearLines = lines.filter((line) => /^\s+\d+岁｜\d{4}年｜/.test(line));
  const sourceYears = timeline.periods.flatMap((period) => period.years);
  assert.equal(yearLines.length, sourceYears.length);
  assert.equal(mutagenTable.size, 10);
  assert.equal(layoutTable.size, 12);
  assert.equal(yearlyDecStarTable.size, 12);

  for (const [index, line] of yearLines.entries()) {
    const source = sourceYears[index];
    assert.ok(source);
    const match =
      /^\s+(\d+)岁｜(\d{4})年｜(\d{4}-\d{2}-\d{2})至([^｜]+)｜流年([^｜]+)｜(\d{2})\/(\d{2})\/(\d{2})\/(\d{2})$/.exec(
        line,
      );
    assert.ok(match, `流年行无法解析：${line}`);
    assert.equal(Number(match[1]), source.age);
    assert.equal(Number(match[2]), source.year);
    assert.equal(match[3], source.dateStr);
    assert.equal(match[4], source.endDateStr);
    assert.equal(match[5], `${source.layer.heavenlyStem}${source.layer.earthlyBranch}`);
    const mutagenCode = match[6];
    const layoutCode = match[7];
    const starCode = match[8];
    const yearlyDecStarCode = match[9];
    assert.equal(mutagenTable.get(mutagenCode), formatMutagens(source.layer.mutagen));
    assert.equal(
      layoutTable.get(layoutCode),
      formatLayout({
        palaceNames: source.layer.palaceNames,
        palaceTargets: source.layer.palaceTargets,
      }),
    );
    const starEntry = starTable.get(starCode);
    assert.ok(starEntry);
    assert.deepEqual(parseCompactStars(starEntry, starNameTable), source.layer.stars);
    const yearlyDecEntry = yearlyDecStarTable.get(yearlyDecStarCode);
    assert.ok(yearlyDecEntry);
    assert.deepEqual(
      parseCompactYearlyDecStars(yearlyDecEntry, yearlyDecStarNameTable),
      source.layer.yearlyDecStars,
    );
  }
});

test('紫微完整任务书压缩后保留目标流月、流日和流时资料', async () => {
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin', 'yearly', 'monthly', 'daily', 'hourly'],
    skipAnalysis: true,
    horoscopeContext: fixedContext,
    fortuneRange: { scope: 'all', ...fixedContext },
  });
  const prompt = buildPublicZiweiPromptForRuntime({ result: runtime, scope: 'full' });
  assert.ok(prompt.length < 18_000, `完整任务书超过补充资料阈值：${prompt.length}`);
  assert.match(prompt, /本命盘、童限与大限流年；目标日期下附流月、流日与流时/);
  assert.match(prompt, /目标日期下层资料：/);
  assert.match(prompt, /流月：2026-08-06/);
  assert.match(prompt, /流日：2026-08-06/);
  assert.match(prompt, /流时：2026-08-06/);
  for (const scope of ['monthly', 'daily', 'hourly'] as const) {
    const payload = runtime.payloadByScope[scope];
    assert.ok(payload);
    const title = { monthly: '流月', daily: '流日', hourly: '流时' }[scope];
    const segment = prompt
      .slice(prompt.indexOf(`${title}：2026-08-06`))
      .split('\n')
      .slice(0, 2)
      .join('\n');
    for (const palace of payload.palaces) {
      assert.ok(segment.includes(`${palace.name}→${palace.dynamic_scope_name ?? palace.name}`));
      for (const star of palace.scope_stars)
        assert.ok(segment.includes(star.name), `${scope} ${palace.name} ${star.name}`);
      for (const hit of palace.scope_hits)
        assert.ok(segment.includes(hit), `${scope} ${palace.name} ${hit}`);
    }
  }
});

test('紫微目标下层资料补充静态星动态四化并按星名化名去重', async () => {
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin', 'monthly'],
    skipAnalysis: true,
    horoscopeContext: fixedContext,
  });
  const payload = runtime.payloadByScope.monthly;
  const palace = payload.palaces.find((candidate) => {
    const scopeNames = new Set(candidate.scope_stars.map((star) => star.name));
    const staticStars = [
      ...candidate.major_stars,
      ...candidate.minor_stars,
      ...candidate.other_stars,
    ];
    return (
      candidate.scope_stars.length > 0 && staticStars.some((star) => !scopeNames.has(star.name))
    );
  });
  assert.ok(palace);
  const scopeStar = palace.scope_stars[0];
  assert.ok(scopeStar);
  const staticStar = [...palace.major_stars, ...palace.minor_stars, ...palace.other_stars].find(
    (star) => !new Set(palace.scope_stars.map((item) => item.name)).has(star.name),
  );
  assert.ok(staticStar);

  palace.scope_stars[0] = {
    ...scopeStar,
    birth_mutagen: undefined,
    horoscope_mutagen: '科',
    active_scope_mutagen: '忌',
  };
  palace.major_stars = [
    ...palace.major_stars,
    {
      ...staticStar,
      brightness: undefined,
      birth_mutagen: undefined,
      horoscope_mutagen: '权',
      active_scope_mutagen: '禄',
    },
    {
      ...staticStar,
      brightness: undefined,
      birth_mutagen: undefined,
      horoscope_mutagen: '忌',
      active_scope_mutagen: '权',
    },
    {
      ...staticStar,
      name: scopeStar.name,
      brightness: undefined,
      birth_mutagen: undefined,
      horoscope_mutagen: '科',
      active_scope_mutagen: '忌',
    },
  ];

  const text = formatZiweiTargetLowerScopeFacts(runtime);
  const lines = text.split('\n');
  const headerIndex = lines.findIndex((candidate) => candidate.startsWith('流月：'));
  assert.ok(headerIndex >= 0);
  const palaceLine = lines[headerIndex + 1];
  assert.ok(palaceLine);
  const line = palaceLine.split('；').find((candidate) => candidate.includes(palace.name));
  assert.ok(line);
  const scopeText = [
    scopeStar.name,
    scopeStar.brightness ? `庙旺${scopeStar.brightness}` : '',
    '运限化科',
    '当前化忌',
  ]
    .filter(Boolean)
    .join('，');
  assert.equal(line.split(scopeText).length - 1, 1);
  assert.ok(line.includes(`${staticStar.name}，运限化权，当前化禄`));
  assert.ok(line.includes(`${staticStar.name}，运限化忌，当前化权`));
  assert.equal(line.split('星曜四化').length - 1, 1);
});

test('紫微节气分界按实际节令日组织十二个流月', async () => {
  const exactInput = { ...input, horoscopeDivide: 'exact' as const };
  const runtime = await calculateZiweiChart(exactInput, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: fixedContext,
    fortuneRange: { scope: 'month', ...fixedContext },
  });
  const year = runtime.fortuneTimeline?.periods[0]?.years[0];
  assert.ok(year);
  assert.equal(year.months?.length, 12);
  assert.ok(year.months?.some((month) => month.dateStr === '2026-02-04'));
  assert.equal(year.targetMonth?.dateStr, fixedContext.dateStr);
});

test('紫微闰月目标日沿用引擎流月归属且不压缩十二个常规月', async () => {
  const runtime = await calculateZiweiChart(input, {
    scopes: ['origin'],
    skipAnalysis: true,
    horoscopeContext: { dateStr: '2025-08-20', hourIndex: 4 },
    fortuneRange: { scope: 'month', dateStr: '2025-08-20', hourIndex: 4 },
  });
  const year = runtime.fortuneTimeline?.periods[0]?.years[0];
  assert.ok(year);
  assert.equal(year.months?.length, 12);
  assert.equal(new Set(year.months?.map((month) => month.dateStr)).size, 12);
  assert.equal(year.targetMonth?.dateStr, '2025-08-20');
  assert.equal(year.targetMonth?.month, 7);
});

test('紫微立春后农历年前目标日按实际流年分段且不混入虚岁起点干支', async () => {
  const exactInput = {
    ...input,
    horoscopeDivide: 'exact' as const,
    yearDivide: 'exact' as const,
  };
  const targetContext = { dateStr: '2026-02-10', hourIndex: 4 } as const;
  const runtime = await calculateZiweiChart(exactInput, {
    scopes: ['origin', 'yearly'],
    skipAnalysis: true,
    horoscopeContext: targetContext,
    fortuneRange: { scope: 'all', ...targetContext },
  });
  const activeYear = runtime.payloadByScope.yearly?.active_scope;
  assert.ok(activeYear);
  assert.equal(`${activeYear.heavenly_stem}${activeYear.earthly_branch}`, '丙午');

  const years = runtime.fortuneTimeline?.periods.flatMap((period) => period.years) ?? [];
  const targetSegments = years.filter(
    (year) =>
      year.age === 34 &&
      year.dateStr <= targetContext.dateStr &&
      (year.endDateStr ?? year.dateStr) >= targetContext.dateStr,
  );
  assert.equal(targetSegments.length, 1);
  assert.deepEqual(
    targetSegments[0] && {
      age: targetSegments[0].age,
      dateStr: targetSegments[0].dateStr,
      endDateStr: targetSegments[0].endDateStr,
      ganZhi: targetSegments[0].ganZhi,
    },
    { age: 34, dateStr: '2026-02-04', endDateStr: '2026-02-16', ganZhi: '丙午' },
  );
  const precedingSegments = years.filter((year) => year.endDateStr === '2026-02-03');
  assert.equal(precedingSegments.length, 1);
  assert.equal(precedingSegments[0]?.ganZhi, '乙巳');

  const horoscopeOnlyRuntime = await calculateZiweiChart(
    { ...input, horoscopeDivide: 'exact' as const },
    {
      scopes: ['origin', 'yearly'],
      skipAnalysis: true,
      horoscopeContext: targetContext,
      fortuneRange: { scope: 'year', ...targetContext },
    },
  );
  const horoscopeOnlyActiveYear = horoscopeOnlyRuntime.payloadByScope.yearly?.active_scope;
  const horoscopeOnlyYear = horoscopeOnlyRuntime.fortuneTimeline?.periods[0]?.years[0];
  assert.ok(horoscopeOnlyActiveYear);
  assert.ok(horoscopeOnlyYear);
  assert.equal(
    horoscopeOnlyYear.ganZhi,
    `${horoscopeOnlyActiveYear.heavenly_stem}${horoscopeOnlyActiveYear.earthly_branch}`,
  );
  assert.ok(horoscopeOnlyYear.dateStr <= targetContext.dateStr);
  assert.ok((horoscopeOnlyYear.endDateStr ?? horoscopeOnlyYear.dateStr) >= targetContext.dateStr);
});
