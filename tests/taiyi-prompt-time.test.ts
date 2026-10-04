import assert from 'node:assert/strict';
import test from 'node:test';
import { generateTaiyi } from '../packages/core/src/taiyi';
import { buildMetaphysicsPrompt } from '../packages/core/src/prompt/metaphysics';
import { formatTaiyiInfo } from '../packages/core/src/prompt/divination-enhanced';
import { buildDivinationPrompt } from '../packages/core/src/prompt/divination';

test('太乙四计在线任务书的传统依据与本计积数一致', () => {
  for (const [scope, label] of [
    ['year', '积年'],
    ['month', '积月'],
    ['day', '积日'],
    ['hour', '积时'],
  ] as const) {
    const data =
      scope === 'year'
        ? generateTaiyi({ scope, year: 2026 })
        : generateTaiyi({ scope, date: new Date('2026-07-11T06:35:00Z') });
    const prompt = buildDivinationPrompt({ method: 'taiyi', data, question: '请解读此盘。' });
    assert.equal(data.accumulatedLabel, label);
    assert.match(prompt, new RegExp(`【传统依据】\\n${label}与`));
  }
});

test('太乙阴遁实际局式的主客算和宫目进入完整在线任务书', () => {
  for (const [instant, bureau, guestCount, wenChang, shiJi, guestGeneral, guestAssistant] of [
    ['2026-06-25T08:30:00Z', 9, 33, '坤', '酉', 3, 9],
    ['2026-06-25T10:30:00Z', 10, 34, '申', '乾', 4, 2],
    ['2026-06-27T08:30:00Z', 33, 18, '子', '艮', 8, 4],
    ['2026-06-30T14:30:00Z', 72, 15, '艮', '午', 5, 5],
  ] as const) {
    const data = generateTaiyi({ scope: 'hour', date: new Date(instant) });
    const facts = formatTaiyiInfo(data);
    const prompt = buildDivinationPrompt({ method: 'taiyi', data, question: '请解读此盘。' });
    assert.equal(data.bureau, bureau);
    assert.equal(data.guestCount, guestCount);
    assert.equal(data.guestGeneral, guestGeneral);
    assert.equal(data.guestAssistant, guestAssistant);
    for (const text of [
      `文昌（主目）：${wenChang}；始击（客目）：${shiJi}`,
      `主算${data.lordCount}`,
      `客算${guestCount}`,
      `主大${data.lordGeneral}、主参${data.lordAssistant}；客大${data.guestGeneral}、客参${data.guestAssistant}`,
    ]) {
      assert.ok(facts.includes(text), `${instant}:资料缺少${text}`);
      assert.ok(prompt.includes(text), `${instant}:任务书缺少${text}`);
    }
  }
});

test('太乙阳四十四局的逐宫主算进入完整在线任务书', () => {
  const data = generateTaiyi({ scope: 'hour', date: new Date('2025-12-24T05:00:00Z') });
  const facts = formatTaiyiInfo(data);
  const prompt = buildDivinationPrompt({ method: 'taiyi', data, question: '请解读此盘。' });
  assert.equal(data.yinYang, '阳遁');
  assert.equal(data.bureau, 44);
  assert.equal(data.lordCount, 33);
  assert.ok(facts.includes('主算33'));
  assert.ok(prompt.includes('主算33'));
  assert.ok(prompt.includes('主大3、主参9'));
});

test('太乙定目逐宫更正的阴阳局定算与将参进入完整在线任务书', () => {
  const cases = [
    {
      input: { scope: 'year', year: 1977 },
      yinYang: '阳遁',
      bureau: 6,
      count: 32,
      nature: '次和',
      general: 2,
      assistant: 6,
    },
    {
      input: { scope: 'year', year: 1998 },
      yinYang: '阳遁',
      bureau: 27,
      count: 24,
      nature: '杂重阴',
      general: 4,
      assistant: 2,
    },
    {
      input: { scope: 'year', year: 1956 },
      yinYang: '阳遁',
      bureau: 57,
      count: 1,
      nature: '杂阴',
      general: 1,
      assistant: 3,
    },
    {
      input: { scope: 'year', year: 1957 },
      yinYang: '阳遁',
      bureau: 58,
      count: 37,
      nature: '杂重阳',
      general: 7,
      assistant: 1,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-25T02:30:00Z') },
      yinYang: '阴遁',
      bureau: 6,
      count: 30,
      nature: undefined,
      general: 3,
      assistant: 9,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-25T16:30:00Z') },
      yinYang: '阴遁',
      bureau: 13,
      count: 13,
      nature: '杂重阳',
      general: 3,
      assistant: 9,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-26T20:30:00Z') },
      yinYang: '阴遁',
      bureau: 27,
      count: 16,
      nature: '下和',
      general: 6,
      assistant: 8,
    },
    {
      input: { scope: 'hour', date: new Date('2026-06-29T14:30:00Z') },
      yinYang: '阴遁',
      bureau: 60,
      count: 23,
      nature: '次和',
      general: 3,
      assistant: 9,
    },
  ] as const;

  for (const { input, yinYang, bureau, count, nature, general, assistant } of cases) {
    const data = generateTaiyi(input);
    const facts = formatTaiyiInfo(data);
    const prompt = buildDivinationPrompt({ method: 'taiyi', data, question: '请解读此盘。' });
    const label = `${yinYang}${bureau}局`;
    assert.equal(data.yinYang, yinYang, label);
    assert.equal(data.bureau, bureau, label);
    for (const text of [
      `定算${count}${nature ? `（${nature}）` : ''}`,
      `定大${general}、定参${assistant}`,
    ]) {
      assert.ok(facts.includes(text), `${label}资料缺少${text}`);
      assert.ok(prompt.includes(text), `${label}任务书缺少${text}`);
    }
    assert.doesNotMatch(prompt, /setCount|setGeneral|setAssistant/u);
  }
});

test('太乙月日时计正文保留实际东八区起局时刻，与外层当前时间分别呈现', () => {
  for (const [scope, label] of [
    ['month', '月计'],
    ['day', '日计'],
    ['hour', '时计'],
  ] as const) {
    const result = generateTaiyi({ scope, date: new Date('2026-07-11T06:35:00Z') });
    assert.equal(result.dateTime, '2026-07-11 14:35:00');
    const target = `分析目标：2026-07-11 14:35:00（东八区）起局的${label}盘。`;
    assert.ok(result.prompt.includes(target));
    const prompt = buildMetaphysicsPrompt(result.prompt, '请分析此盘。', {
      method: 'taiyi',
      currentTime: new Date('2026-05-19T10:30:00+08:00'),
    });
    assert.ok(prompt.includes(target));
    assert.match(prompt, /2026年5月19日/);
    assert.ok(prompt.includes(`本计干支：${result.ganZhi}`));
    assert.ok(result.evidenceAnalysis.calculationChain[0]?.includes('2026-07-11 14:35:00'));
  }
});

test('太乙年计以目标年份表达，避免把内部年中取样时刻当作指定时刻', () => {
  const result = generateTaiyi({ year: 2026 });
  assert.match(result.prompt, /分析目标：2026年年计。/);
  assert.doesNotMatch(result.prompt, /分析目标：.*起局/);
  assert.equal(
    result.evidenceAnalysis.calculationChain[0],
    '年计以2026年及本计干支丙午作为时间输入',
  );
  assert.doesNotMatch(result.evidenceAnalysis.calculationChain.join('；'), /2026-07-01/);
});

test('太乙公开任务书按日期字段截取四位以下公历年', () => {
  for (const year of [99, 999]) {
    const yearResult = generateTaiyi({ year });
    assert.match(formatTaiyiInfo(yearResult), new RegExp(`起局时间：${year}年；`));

    const date = new Date(`${String(year).padStart(4, '0')}-07-01T12:00:00+08:00`);
    const monthResult = generateTaiyi({ scope: 'month', date });
    const dayResult = generateTaiyi({ scope: 'day', date });
    const hourResult = generateTaiyi({ scope: 'hour', date });
    assert.match(formatTaiyiInfo(monthResult), new RegExp(`起局时间：${year}-07月；`));
    assert.match(formatTaiyiInfo(dayResult), new RegExp(`起局时间：${year}-07-01；`));
    assert.match(formatTaiyiInfo(hourResult), new RegExp(`起局时间：${year}-07-01 12:00:00；`));
  }
});

test('太乙提示词以将参宫位呈现中宫事实，不重复生成同义判断', () => {
  const result = generateTaiyi({ scope: 'hour', date: new Date('2026-07-11T06:35:00Z') });
  assert.match(result.prompt, /将参：主大将5中宫、主参将5中宫/);
  assert.doesNotMatch(result.prompt, /判断：[^\n]*主大将或主参将居中宫/);
});

test('太乙在线提示词列出逐角色门位并说明门具依据', () => {
  const result = generateTaiyi({ year: 2020 });
  assert.deepEqual(
    result.conditions.threeGates.roles.map((role) => [role.role, role.gate]),
    [
      ['太乙', '伤门'],
      ['文昌（主目）', '惊门'],
      ['始击（客目）', '惊门'],
    ],
  );
  assert.match(
    result.prompt,
    /三门具.*主门位：太乙伤门、文昌（主目）惊门；始击（客目）门位单列：惊门/u,
  );
  const prompt = buildMetaphysicsPrompt(result.prompt, undefined, {
    method: 'taiyi',
    currentTime: new Date('2026-05-19T10:30:00+08:00'),
  });
  assert.match(prompt, /门具依据太乙与文昌（主目）是否临开、休、生门判定/u);
  assert.ok(
    result.model.sources.some((source) => source.title === '《太乙统宗宝鉴》卷五·明三门具不具'),
  );
});
