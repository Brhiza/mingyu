import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateAlmanacSelection,
  getAlmanacAnnualDirectionGods,
  getAlmanacNineStarDetail,
  getAlmanacPengZuDetails,
  getAlmanacTwentyEightStarDetail,
} from '../packages/core/src/divination/algorithms/almanac.ts';

const ALMANAC_CROSS_CENTURY_TRUTH = [
  ['1900-01-01', '己亥', '丙子', '甲戌'],
  ['1900-01-31', '己亥', '丁丑', '甲辰'],
  ['1900-02-04', '己亥', '丁丑', '戊申'],
  ['1950-02-04', '己丑', '丁丑', '庚午'],
  ['2000-02-04', '己卯', '丁丑', '壬辰'],
  ['2024-02-04', '癸卯', '乙丑', '戊戌'],
  ['2024-02-05', '甲辰', '丙寅', '己亥'],
  ['2024-02-29', '甲辰', '丙寅', '癸亥'],
  ['2026-03-05', '丙午', '庚寅', '戊寅'],
  ['2050-02-03', '己巳', '丁丑', '甲寅'],
  ['2050-02-04', '庚午', '戊寅', '乙卯'],
  ['2099-12-31', '己未', '丙子', '壬寅'],
  ['2100-12-31', '庚申', '戊子', '丁未'],
] as const;

const HOUR_BRANCHES = [
  '子',
  '丑',
  '寅',
  '卯',
  '辰',
  '巳',
  '午',
  '未',
  '申',
  '酉',
  '戌',
  '亥',
  '子',
];

test('黄历基础资料缺失或输入非法时应明确报错', () => {
  assert.throws(() => getAlmanacTwentyEightStarDetail('未知宿'), /二十八宿资料缺失/);
  assert.throws(() => getAlmanacNineStarDetail('十白'), /九星资料缺失/);
  assert.throws(() => getAlmanacPengZuDetails('甲', '无'), /彭祖地支百忌资料缺失/);
  assert.throws(() => getAlmanacPengZuDetails('无', '子'), /彭祖天干百忌资料缺失/);
  assert.throws(() => getAlmanacAnnualDirectionGods('无'), /年支无效/);
});

test('黄历择日：二十八宿与九星详情应使用经过校勘的原始属性', () => {
  const result = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-05',
  });

  assert.ok(result.days.length > 0);
  for (const day of result.days) {
    assert.ok(day.moonPhaseEvidence);
    assert.ok(day.moonPhaseEvidence.phaseAngleDegrees >= 0);
    assert.ok(day.moonPhaseEvidence.phaseAngleDegrees < 360);
    assert.ok(day.nineStar, `${day.date} 应有九星名称`);
    assert.ok(day.nineStarDetail, `${day.date} 的九星 ${day.nineStar} 应有详情`);
    assert.match(day.nineStarDetail.fullName, new RegExp(`^${day.nineStar}`));
    assert.equal(day.nineStarDetail.source, 'tyme4ts NineStar 原生属性');
    assert.ok(day.twentyEightStarDetail);
    assert.match(day.twentyEightStarDetail.fullName, new RegExp(`^${day.twentyEightStar}`));
    assert.match(day.twentyEightStarDetail.source, /tyme4ts TwentyEightStar 原生属性/);
  }
});

test('黄历基础资料：彭祖百忌与二十八宿动物应使用校勘后的传统文本', () => {
  assert.equal(getAlmanacPengZuDetails('壬', '酉').gan, '壬不泱水更难提防');
  assert.equal(getAlmanacPengZuDetails('壬', '酉').zhi, '酉不会客醉坐颠狂');
  assert.equal(getAlmanacPengZuDetails('壬', '戌').zhi, '戌不吃犬作怪上床');
  assert.equal(getAlmanacTwentyEightStarDetail('壁').animal, '貐');
  assert.equal(getAlmanacTwentyEightStarDetail('胃').animal, '雉');

  const day = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
  }).days[0];
  assert.equal(day.pengZu, `${day.pengZuGan} ${day.pengZuZhi}`);
  assert.doesNotMatch(day.pengZu, /汲水|宴客|吃狗/);
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

test('黄历择日：建除值日只保留原生值日事实，不再叠加本地事项硬表', () => {
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
    assert.ok(day.topicMatchFacts?.every((fact) => !fact.key.includes(':topic:rule-')));
    assert.doesNotMatch(day.highlights.join('；'), /事项规则支持执日|执日.*宜出行赴任/);
    assert.doesNotMatch(day.cautions.join('；'), /事项规则限制执日/);
  }
});

test('黄历择日：破日求医只采用 tyme4ts 原始宜忌，不泛化为所有医疗首选', () => {
  const result = generateAlmanacSelection({
    topic: 'medical',
    startDate: '2026-06-07',
    endDate: '2026-06-07',
  });
  const day = result.days[0];

  assert.equal(day.dayOfficer, '破');
  assert.ok(!day.recommends.some((item) => item.includes('求医') || item.includes('治病')));
  assert.doesNotMatch(day.highlights.join('；'), /黄历宜项命中就医手术/);
  assert.doesNotMatch(day.highlights.join('；'), /执日破宜就医手术|事项规则/);
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
  assert.ok(day.annualDirectionGods?.every((item) => Object.keys(item).length === 3));
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
  const withoutParticipant = generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-10',
    endDate: '2026-06-10',
  });
  const noParticipant = withoutParticipant.days[0];
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
  assert.equal(day.score, undefined);
  assert.equal(noParticipant.score, undefined);
  assert.ok(
    result.evidenceAnalysis?.candidates[0].participantConflicts.length >
      (withoutParticipant.evidenceAnalysis?.candidates[0].participantConflicts.length ?? 0),
  );
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

test('黄历择日：每个候选日应给出完整时辰，不生成首选时辰', () => {
  const result = generateAlmanacSelection({
    topic: 'contract',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
  });

  for (const day of result.days) {
    assert.equal(day.hours?.length, 13, `${day.date} 应包含早晚子时在内的 13 个时段`);
    assert.deepEqual(
      day.hours?.map((hour) => [hour.name, hour.branch, hour.range]),
      [
        ['早子时', '子', '00:00-01:00'],
        ['丑时', '丑', '01:00-03:00'],
        ['寅时', '寅', '03:00-05:00'],
        ['卯时', '卯', '05:00-07:00'],
        ['辰时', '辰', '07:00-09:00'],
        ['巳时', '巳', '09:00-11:00'],
        ['午时', '午', '11:00-13:00'],
        ['未时', '未', '13:00-15:00'],
        ['申时', '申', '15:00-17:00'],
        ['酉时', '酉', '17:00-19:00'],
        ['戌时', '戌', '19:00-21:00'],
        ['亥时', '亥', '21:00-23:00'],
        ['晚子时', '子', '23:00-24:00'],
      ],
    );
    assert.equal(new Set(day.hours?.map((hour) => hour.range)).size, 13);
    assert.ok(!('bestHours' in day), `${day.date} 不应生成首选时辰`);
    for (const hour of day.hours ?? []) {
      assert.ok(!('recommends' in hour) && !('avoids' in hour));
    }
  }
});

test('黄历择日：跨世纪与交节日期应符合独立历法真值', () => {
  for (const [date, year, month, day] of ALMANAC_CROSS_CENTURY_TRUTH) {
    const candidate = generateAlmanacSelection({
      topic: 'custom',
      startDate: date,
      endDate: date,
    }).days[0];

    assert.deepEqual(candidate.ganzhi, { year, month, day }, `${date} 正午干支错误`);
    assert.equal(
      candidate.annualDirectionGods?.find((item) => item.god === '太岁')?.branch,
      year[1],
    );
    assert.deepEqual(
      candidate.hours?.map((hour) => hour.branch),
      HOUR_BRANCHES,
    );
    assert.ok(candidate.hours?.every((hour) => hour.ganzhi.endsWith(hour.branch)));
    assert.match(candidate.pengZuGan || '', new RegExp(`^${day[0]}`));
    assert.match(candidate.pengZuZhi || '', new RegExp(`^${day[1]}`));
  }
});

test('黄历择日：1900 至 2100 每年四个关键日期的日课资料链不得断裂', () => {
  for (let year = 1900; year <= 2100; year += 1) {
    for (const monthDay of ['01-01', '02-04', '07-01', '12-31']) {
      const date = `${year}-${monthDay}`;
      const result = generateAlmanacSelection({
        topic: 'custom',
        startDate: date,
        endDate: date,
      });
      const candidate = result.days[0];
      const calendarFact = result.evidenceAnalysis?.candidates[0]?.calendarFact;

      assert.equal(candidate.date, date);
      assert.match(candidate.ganzhi.year, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      assert.match(candidate.ganzhi.month, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      assert.match(candidate.ganzhi.day, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
      assert.ok(candidate.lunarDate);
      assert.equal(candidate.hours?.length, 13);
      assert.deepEqual(
        candidate.hours?.map((hour) => hour.branch),
        HOUR_BRANCHES,
      );
      assert.equal(candidate.annualDirectionGods?.length, 12);
      assert.equal(
        candidate.annualDirectionGods?.find((item) => item.god === '太岁')?.branch,
        candidate.ganzhi.year[1],
      );
      assert.match(calendarFact?.promptText || '', new RegExp(`年柱${candidate.ganzhi.year}`));
      assert.match(calendarFact?.promptText || '', new RegExp(`月柱${candidate.ganzhi.month}`));
      assert.match(calendarFact?.promptText || '', new RegExp(`日柱${candidate.ganzhi.day}`));
    }
  }
});
