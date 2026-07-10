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

test('黄历择日：交节当天年柱月柱按正午精确干支历显示', () => {
  const lichun = generateAlmanacSelection({
    topic: 'renovation',
    startDate: '2024-02-04',
    endDate: '2024-02-04',
  }).days[0];
  const jingzhe = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-03-05',
    endDate: '2026-03-05',
  }).days[0];

  assert.deepEqual(lichun.ganzhi, {
    year: '癸卯',
    month: '乙丑',
    day: '戊戌',
  });
  assert.equal(lichun.annualDirectionGods?.find((item) => item.god === '太岁')?.branch, '卯');
  assert.equal(lichun.annualDirectionGods?.find((item) => item.god === '太岁')?.direction, '正东');
  assert.equal(jingzhe.ganzhi.month, '庚寅');
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

test('黄历择日：空白参与人行可忽略，但半填资料必须报错', () => {
  const blank = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
    participants: [
      {
        id: 'self',
        name: '本人',
        gender: '',
        year: '',
        month: '',
        day: '',
        timeIndex: '',
        dateType: 'solar',
        isLeapMonth: false,
      },
    ],
  });

  assert.deepEqual(blank.participants, []);
  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'move',
        startDate: '2026-06-10',
        endDate: '2026-06-10',
        participants: [
          {
            id: 'self',
            name: '本人',
            gender: '男',
            year: '1990',
            month: '',
            day: '1',
            timeIndex: '6',
            dateType: 'solar',
          },
        ],
      }),
    /参与人出生月份必须是 1-12 的整数/,
  );
});

test('黄历择日：完整参与人资料应先校验性别、日历类型和闰月标志', () => {
  const baseParticipant = {
    id: 'self',
    name: '本人',
    gender: '男',
    year: '1990',
    month: '1',
    day: '1',
    timeIndex: '6',
    dateType: 'solar',
    isLeapMonth: false,
  } as const;
  const baseParams = {
    topic: 'move',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
  } as const;

  assert.throws(
    () =>
      generateAlmanacSelection({
        ...baseParams,
        participants: [{ ...baseParticipant, gender: '' }],
      }),
    /参与人性别必须是 男 或 女/,
  );
  assert.throws(
    () =>
      generateAlmanacSelection({
        ...baseParams,
        participants: [{ ...baseParticipant, dateType: 'gregorian' as never }],
      }),
    /参与人日历类型必须是 solar 或 lunar/,
  );
  assert.throws(
    () =>
      generateAlmanacSelection({
        ...baseParams,
        participants: [{ ...baseParticipant, isLeapMonth: 'false' as never }],
      }),
    /参与人isLeapMonth必须是布尔值/,
  );
});

test('黄历择日：未知事项类型应在入口明确报错，不应进入内部评分', () => {
  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'invalid-topic' as Parameters<typeof generateAlmanacSelection>[0]['topic'],
        startDate: '2026-06-01',
        endDate: '2026-06-01',
      }),
    /未知的黄历择日事项类型/,
  );
});

test('黄历择日：核心算法应限制参与人数量，避免绕过 API 放大计算量', () => {
  const participants = Array.from({ length: 31 }, (_, index) => ({
    id: `p-${index + 1}`,
    name: `参与人${index + 1}`,
    gender: '男' as const,
    year: '1990',
    month: '1',
    day: '1',
    timeIndex: '6',
    dateType: 'solar' as const,
  }));

  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'move',
        startDate: '2026-06-01',
        endDate: '2026-06-01',
        participants,
      }),
    /一次最多分析 30 位参与人/,
  );
});

test('黄历择日：每个候选日应给出完整时辰并排除诸事不宜的首选时辰', () => {
  const result = generateAlmanacSelection({
    topic: 'contract',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
  });

  for (const day of result.days) {
    assert.equal(day.hours?.length, 13, `${day.date} 应包含早晚子时在内的 13 个时段`);
    assert.ok((day.bestHours?.length ?? 0) > 0, `${day.date} 应给出首选时辰`);
    for (const hour of day.bestHours ?? []) {
      assert.doesNotMatch(
        [...hour.recommends, ...hour.avoids, ...hour.cautions].join('；'),
        /诸事不宜/,
      );
    }
  }
});
