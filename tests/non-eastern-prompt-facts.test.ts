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
  assert.ok(chart.summary.patterns.every((pattern) => !pattern.includes('北交点')));
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
  assert.match(result.prompt, /出生地点：纬度39\.9042°，经度116\.4074°；时区UTC\+08:00/);
  assert.equal(result.prompt.split(`命宫在${result.twelvePalaces[0].signBranch}宫`).length - 1, 1);
  assert.doesNotMatch(result.prompt, /命宫在命宫|命宫落/);
  assert.match(result.prompt, /十二宫：.+；身宫落.+宫。/);
  assert.match(result.prompt, /本命盘以出生时点的星曜位置、落宿、落宫和吊照分析先天结构/);
  assert.doesNotMatch(result.prompt, /只解读/);
  for (const palace of result.twelvePalaces) {
    assert.ok(result.prompt.includes(`${palace.palace}在${palace.signBranch}宫`));
  }
});

test('七政四余省略坐标时把北京标为计算参考地点', () => {
  const reference = generateQizheng({ year: 2024, month: 6, day: 15, hour: 6, minute: 0 });
  const urumqi = generateQizheng({
    year: 2024,
    month: 6,
    day: 15,
    hour: 6,
    minute: 0,
    latitude: 43.8256,
    longitude: 87.6168,
    timezone: 8,
  });
  assert.equal(reference.calculationContext.locationSource, '默认北京坐标');
  assert.notEqual(
    reference.calculationContext.solarIllumination.solarAltitudeDegrees,
    urumqi.calculationContext.solarIllumination.solarAltitudeDegrees,
  );
  assert.match(reference.prompt, /计算参考地点：北京（纬度39\.9°，经度116\.4°）/);
  assert.doesNotMatch(reference.prompt, /出生地点：纬度39\.9°，经度116\.4°/);
  const partial = generateQizheng({
    year: 2024,
    month: 6,
    day: 15,
    hour: 6,
    minute: 0,
    longitude: 87.6168,
  });
  assert.equal(partial.calculationContext.locationSource, '部分坐标使用默认值');
  assert.match(partial.prompt, /计算参考坐标（部分采用北京参考值）：纬度39\.9°，经度87\.6168°/);
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
});

test('黄历提示词合并原始忌项的重复限制并保留独立四绝规则', () => {
  const ordinary = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2026-10-01',
    endDate: '2026-10-01',
  });
  const ordinaryPrompt = formatDivinationInfo('almanac', ordinary);
  assert.equal(ordinaryPrompt.match(/嫁娶/g)?.length, 1);
  assert.equal(ordinaryPrompt.match(/纳采/g)?.length, 1);
  assert.doesNotMatch(ordinaryPrompt, /原始忌项触及订婚结婚|黄历忌项触及订婚结婚/);

  const fourTermination = generateAlmanacSelection({
    topic: 'marriage',
    startDate: '2025-11-06',
    endDate: '2025-11-06',
  });
  const fourTerminationPrompt = formatDivinationInfo('almanac', fourTermination);
  assert.ok(fourTermination.days[0].recommends.includes('嫁娶'));
  assert.match(fourTerminationPrompt, /四绝日（立冬前一日）/);
  assert.match(fourTerminationPrompt, /宜[^；]*嫁娶/);
});

test('黄历事项宜忌与参与人限制在候选日明细中各展开一次', () => {
  const data = generateAlmanacSelection({
    topic: 'contract',
    startDate: '2026-06-01',
    endDate: '2026-06-15',
    participants: [
      {
        id: 'project-owner',
        name: '项目负责人',
        gender: '男',
        year: '1990',
        month: '5',
        day: '15',
        timeIndex: '6',
        dateType: 'solar',
      },
    ],
  });
  const prompt = formatDivinationInfo('almanac', data);
  const promptLines = prompt.split('\n');
  const dayLine = (date: string) => {
    const index = promptLines.findIndex((line) => line.includes(date) && line.startsWith('  第'));
    return index < 0 ? '' : (promptLines[index + 1] ?? '');
  };
  const signingDay = dayLine('2026-06-09');
  const signingCandidate = data.evidenceAnalysis!.candidates.find(
    (candidate) => candidate.date === '2026-06-09',
  );

  assert.ok(signingDay);
  assert.equal(signingDay.match(/交易/g)?.length, 1);
  assert.equal(signingDay.match(/立券/g)?.length, 1);
  assert.ok(signingCandidate?.topicMatchFacts.some((fact) => fact.matchedItems.includes('交易')));

  const conflictDay = dayLine('2026-06-01');
  const participantNote = data.days.find((item) => item.date === '2026-06-01')?.participantNotes[0];
  const participantConstraint = data
    .evidenceAnalysis!.candidates.find((candidate) => candidate.date === '2026-06-01')
    ?.decisionFact.strongConstraintTexts.find((item) => item.startsWith('项目负责人：'));

  assert.ok(conflictDay);
  assert.ok(participantNote);
  assert.ok(participantConstraint);
  assert.ok(conflictDay.includes(participantConstraint));
  assert.ok(!conflictDay.includes(participantNote));
});
