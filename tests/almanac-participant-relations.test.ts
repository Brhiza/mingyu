import test from 'node:test';
import assert from 'node:assert/strict';

import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';
import { isLiuhai, isSanxing } from '../packages/core/src/ganzhi/index.ts';
import {
  birthProfileToAlmanacParticipant,
  calculateBaziFromBirthProfile,
} from '../packages/core/src/profile/index.ts';

test('寅日与巳年参与人同时命中刑害，逐日事实与公开证据均保留', () => {
  assert.equal(isSanxing('寅', '巳'), true);
  assert.equal(isLiuhai('寅', '巳'), true);

  const result = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-09',
    endDate: '2026-06-09',
    participants: [
      {
        id: 'owner',
        name: '屋主',
        gender: '男',
        year: '1989',
        month: '7',
        day: '1',
        timeIndex: '6',
        dateType: 'solar',
      },
    ],
  });
  const day = result.days[0]!;
  const candidate = result.evidenceAnalysis!.candidates[0]!;
  assert.equal(day.ganzhi.day, '甲寅');
  assert.equal(result.participants[0]!.pillars.year, '己巳');

  const yearRelations = day
    .participantRelationFacts!.filter(
      (fact) => fact.participantId === 'owner' && fact.basis === '年支',
    )
    .map((fact) => fact.relation);
  assert.deepEqual(yearRelations, ['刑', '害']);
  assert.ok(day.participantNotes.some((note) => /刑生肖\/年支巳.*害生肖\/年支巳/u.test(note)));
  assert.deepEqual(
    candidate.participantRelationFacts
      .filter((fact) => fact.participantId === 'owner' && fact.basis === '年支')
      .map((fact) => fact.relation),
    yearRelations,
  );
  assert.equal(candidate.status, '慎用候选');
  assert.match(result.evidenceAnalysis!.promptText, /与其年支巳刑/u);
  assert.match(result.evidenceAnalysis!.promptText, /与其年支巳害/u);
});

test('重复参与人身份标识不会生成指向不同出生资料的同一证据键', () => {
  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'custom',
        startDate: '2026-06-09',
        endDate: '2026-06-09',
        participants: [
          {
            id: 'same',
            name: '参与人甲',
            gender: '男',
            year: '1989',
            month: '7',
            day: '1',
            timeIndex: '6',
            dateType: 'solar',
          },
          {
            id: ' same ',
            name: '参与人乙',
            gender: '女',
            year: '2001',
            month: '7',
            day: '1',
            timeIndex: '6',
            dateType: 'solar',
          },
        ],
      }),
    /参与人id必须唯一/u,
  );
});

test('参与人仅提供时分时按零秒跨立春排盘，传统时辰输入保持原口径', () => {
  const participants = [
    { id: 'before', birthHour: '16', birthMinute: '26' },
    { id: 'after', birthHour: '16', birthMinute: '28' },
    { id: 'shichen', timeIndex: '8' },
  ].map((entry) => ({
    ...entry,
    name: entry.id,
    gender: '男' as const,
    year: '2024',
    month: '2',
    day: '4',
    dateType: 'solar' as const,
  }));
  const result = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-09',
    endDate: '2026-06-09',
    participants,
  });
  const byId = new Map(result.participants.map((item) => [item.id, item]));

  assert.equal(byId.get('before')?.pillars.year, '癸卯');
  assert.equal(byId.get('before')?.pillars.month, '乙丑');
  assert.equal(byId.get('after')?.pillars.year, '甲辰');
  assert.equal(byId.get('after')?.pillars.month, '丙寅');
  assert.deepEqual(byId.get('shichen')?.pillars, byId.get('before')?.pillars);
});

test('非北京时间出生档案进入择日后仍按出生地时区判定立春节令', () => {
  const profile = {
    id: 'new-york',
    name: '参与人',
    gender: 'male' as const,
    calendarType: 'solar' as const,
    year: 2024,
    month: 2,
    day: 4,
    hour: 4,
    minute: 0,
    location: {
      longitude: -74.006,
      latitude: 40.7128,
      timeZoneId: 'America/New_York',
    },
  };
  const participant = birthProfileToAlmanacParticipant(profile);
  const direct = calculateBaziFromBirthProfile(profile);
  const result = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-09',
    endDate: '2026-06-09',
    participants: [participant],
  });

  assert.equal(participant.timeZoneId, 'America/New_York');
  assert.equal(result.participants[0]!.pillars.year, direct.pillars.year.ganZhi);
  assert.equal(result.participants[0]!.pillars.month, direct.pillars.month.ganZhi);
  assert.equal(direct.pillars.month.ganZhi, '丙寅');

  const fixedOffsetProfile = {
    ...profile,
    location: { longitude: -74.006, latitude: 40.7128, timezone: -5 },
  };
  const fixedOffsetParticipant = birthProfileToAlmanacParticipant(fixedOffsetProfile);
  const fixedOffsetResult = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-09',
    endDate: '2026-06-09',
    participants: [fixedOffsetParticipant],
  });
  assert.equal(fixedOffsetParticipant.timezone, -5);
  assert.deepEqual(fixedOffsetResult.participants[0]!.pillars, result.participants[0]!.pillars);

  const trueSolarProfile = { ...profile, useTrueSolarTime: true };
  const trueSolarParticipant = birthProfileToAlmanacParticipant(trueSolarProfile);
  const trueSolarResult = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-09',
    endDate: '2026-06-09',
    participants: [trueSolarParticipant],
  });
  assert.equal(
    trueSolarResult.participants[0]!.pillars.month,
    calculateBaziFromBirthProfile(trueSolarProfile).pillars.month.ganZhi,
  );
  assert.throws(
    () =>
      generateAlmanacSelection({
        topic: 'custom',
        startDate: '2026-06-09',
        endDate: '2026-06-09',
        participants: [{ ...trueSolarParticipant, birthMinute: '0' }],
      }),
    /校正时间与真太阳时原始出生记录不一致/,
  );
});

test('出生区间内稳定的寅巳刑害分别覆盖完整半开区间', () => {
  const startTimestamp = Date.parse('2024-02-11T15:00:00+08:00');
  const endTimestamp = Date.parse('2024-02-11T17:00:00+08:00');
  const result = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-06-09',
    endDate: '2026-06-09',
    participants: [
      {
        id: 'ranged',
        name: '区间参与人',
        gender: '',
        year: '2024',
        month: '2',
        day: '11',
        birthHour: '15',
        birthMinute: '0',
        birthSecond: '0',
        dateType: 'solar',
        birthTimeRange: {
          startTimestamp,
          endTimestamp,
          endExclusive: true,
          timezone: 'Asia/Shanghai',
          offsetHours: 8,
          pillars: { year: '甲辰', month: '丙寅', day: '乙巳', hour: '甲申' },
        },
      },
    ],
  });

  const dayBranchFacts = result.days[0]!.participantRelationFacts!.filter(
    (fact) => fact.participantId === 'ranged' && fact.basis === '日支',
  );
  assert.deepEqual(
    dayBranchFacts.map((fact) => fact.relation),
    ['刑', '害'],
  );
  for (const fact of dayBranchFacts) {
    assert.equal(fact.birthTimeRange?.status, 'stable');
    assert.deepEqual(fact.birthTimeRange?.intervals, [
      { startTimestamp, endTimestamp, endExclusive: true },
    ]);
  }
});
