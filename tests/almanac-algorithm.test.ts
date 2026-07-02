import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';

test('黄历择日：tyme4ts 返回九星短名时也应补出九星详情', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  });

  assert.ok(result.days.length > 0);
  for (const day of result.days) {
    assert.ok(day.nineStar, `${day.date} 应有九星名称`);
    assert.ok(day.nineStarDetail, `${day.date} 的九星 ${day.nineStar} 应有详情`);
    assert.match(day.nineStarDetail.meaning, new RegExp(`^${day.nineStar}`));
  }
});

test('黄历择日：同一吉神不应因配置重复而重复加分和重复输出', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
  });
  const day = result.days[0];

  assert.ok(day.gods.includes('天德合'));
  assert.doesNotMatch(day.highlights.join('；'), /天德合、天德合/);
});

test('黄历择日：建除十二神不应把除成开日误判为忌出行', () => {
  const result = generateAlmanacSelection({
    topic: 'travel',
    startDate: '2026-06-01',
    endDate: '2026-06-30',
  });

  const cases = [
    { date: '2026-06-14', officer: '除' },
    { date: '2026-06-21', officer: '成' },
    { date: '2026-06-23', officer: '开' },
  ];

  for (const item of cases) {
    const day = result.days.find((candidate) => candidate.date === item.date);
    assert.ok(day, `${item.date} 应在候选日期中`);
    assert.equal(day.dayOfficer, item.officer);
    assert.match(day.highlights.join('；'), new RegExp(`执日${item.officer}宜出行赴任`));
    assert.doesNotMatch(day.cautions.join('；'), new RegExp(`执日${item.officer}.*出行`));
  }
});

test('黄历择日：破日求医不应被建除表无条件扣分', () => {
  const result = generateAlmanacSelection({
    topic: 'medical',
    startDate: '2026-06-07',
    endDate: '2026-06-07',
  });
  const day = result.days[0];

  assert.equal(day.dayOfficer, '破');
  assert.match(day.highlights.join('；'), /执日破宜就医手术/);
  assert.doesNotMatch(day.cautions.join('；'), /执日破/);
});

test('黄历择日：岁支十二神方位应从年支起太岁顺排', () => {
  const result = generateAlmanacSelection({
    topic: 'renovation',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
  });
  const day = result.days[0];

  assert.equal(day.ganzhi.year, '丙午');
  assert.deepEqual(
    day.annualDirectionGods?.map((item) => `${item.god}${item.branch}`),
    [
      '太岁午',
      '太阳未',
      '丧门申',
      '太阴酉',
      '官符戌',
      '死符亥',
      '岁破子',
      '龙德丑',
      '白虎寅',
      '福德卯',
      '吊客辰',
      '病符巳',
    ],
  );
  assert.equal(day.annualDirectionGods?.find((item) => item.god === '太岁')?.direction, '正南');
  assert.equal(day.annualDirectionGods?.find((item) => item.god === '岁破')?.direction, '正北');
  assert.equal(day.annualDirectionGods?.find((item) => item.god === '福德')?.fortune, '吉');
  assert.equal(day.annualDirectionGods?.find((item) => item.god === '病符')?.fortune, '凶');
});

test('黄历择日：参与人适配应覆盖本命日支刑冲破害', () => {
  const noParticipant = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
  }).days[0];
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
    participants: [
      {
        id: 'owner',
        name: '屋主',
        gender: '男',
        year: '1990',
        month: '2',
        day: '4',
        timeIndex: '6',
        dateType: 'solar',
      },
    ],
  });
  const day = result.days[0];
  const participantText = day.participantNotes.join('；');

  assert.equal(day.ganzhi.day, '乙卯');
  assert.match(participantText, /候选日地支卯/);
  assert.match(participantText, /破生肖\/年支午/);
  assert.match(participantText, /刑日支子（无礼之刑）/);
  assert.ok(day.score < noParticipant.score);
  assert.doesNotMatch(participantText, /未见直接/);
});
