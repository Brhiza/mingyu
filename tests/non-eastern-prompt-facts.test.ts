import assert from 'node:assert/strict';
import test from 'node:test';
import { generateAstrolabe } from '../packages/core/src/divination/algorithms/astrolabe';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac';
import { drawTarotSpread } from '../packages/core/src/divination/tarot';
import { generateQizheng } from '../packages/core/src/qi_zheng';
import { formatAstrolabeForPrompt } from '../packages/core/src/prompt/astrolabe';
import { formatDivinationInfo } from '../packages/core/src/prompt/divination';

test('星盘提示词保留出生坐标和历史时区标识', () => {
  const chart = generateAstrolabe({
    name: '样本',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '39.9042',
    longitude: '116.4074',
    timeZoneId: 'Asia/Shanghai',
  });
  const prompt = formatAstrolabeForPrompt(chart);
  assert.match(prompt, /出生坐标：纬度39\.9042°，经度116\.4074°；时区Asia\/Shanghai/);
});

test('星盘格局与宫位制以中文名称配必要英文术语', () => {
  const chart = generateAstrolabe({
    name: '样本',
    gender: '女',
    year: '1993',
    month: '4',
    day: '8',
    hour: '23',
    minute: '34',
    latitude: '1.3521',
    longitude: '103.8198',
    timezone: '8',
  });
  const prompt = formatAstrolabeForPrompt(chart);
  assert.match(prompt, /宫位制：普拉西德斯宫制（Placidus）/);
  assert.ok(
    chart.summary.patterns.some((pattern) => pattern.includes('北交点（True North Node）')),
  );
  assert.doesNotMatch(
    chart.summary.patterns.join('、'),
    /(?<!（)True North Node|kite|grand_trine|stellium_sign/,
  );
  assert.doesNotMatch(
    prompt,
    /(?<!（)(?:Placidus|True North Node)|Caelus|kite|grand_trine|stellium_sign/,
  );
  assert.match(
    chart.evidenceAnalysis?.calculationFact.promptText ?? '',
    /普拉西德斯宫制（Placidus）/,
  );
  assert.doesNotMatch(chart.evidenceAnalysis?.calculationFact.promptText ?? '', /Caelus/);
});

test('七政四余提示词保留十二宫映射及出生时空口径', () => {
  const result = generateQizheng({
    year: 1990,
    month: 6,
    day: 15,
    hour: 10,
    minute: 30,
    latitude: 39.9042,
    longitude: 116.4074,
    timezone: 8,
  });
  assert.match(result.prompt, /出生地点：纬度39\.9042°，经度116\.4074°；时区UTC\+8/);
  for (const palace of result.twelvePalaces) {
    assert.ok(result.prompt.includes(`${palace.palace}在${palace.signBranch}宫`));
  }
});

test('塔罗最终提示词保留已计算的相邻元素关系', () => {
  const data = drawTarotSpread('three', { seed: '牌序互参提示词' });
  const prompt = formatDivinationInfo('tarot', data);
  assert.match(prompt, /相邻牌元素关系：/);
  for (const fact of data.evidenceAnalysis!.elementInteractionFacts) {
    if (fact.status !== '已计算') continue;
    assert.ok(prompt.includes(`${fact.fromPosition}${fact.fromCard}`));
    assert.ok(prompt.includes(`${fact.toPosition}${fact.toCard}`));
    assert.ok(prompt.includes(fact.relation));
  }
});

test('黄历择日最终提示词保留逐日历法和备选时辰依据', () => {
  const data = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
    timePreferences: ['morning'],
  });
  const prompt = formatDivinationInfo('almanac', data);
  for (const day of data.days) {
    assert.ok(prompt.includes(day.lunarDate));
    assert.ok(prompt.includes(`干支${day.ganzhi.year}/${day.ganzhi.month}/${day.ganzhi.day}`));
  }
  const hour = data.evidenceAnalysis!.candidates.flatMap((candidate) => candidate.usableHours)[0];
  assert.ok(hour);
  assert.ok(prompt.includes(`${hour.name}${hour.range}${hour.ganzhi}/${hour.twelveStar}`));
  for (const candidate of data.evidenceAnalysis!.candidates) {
    for (const constraint of candidate.decisionFact.strongConstraintTexts) {
      assert.ok(prompt.includes(constraint), constraint);
    }
  }
});
