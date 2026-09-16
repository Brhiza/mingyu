import assert from 'node:assert/strict';
import test from 'node:test';
import { reverseBaziDates } from '../packages/core/src/calendar';
import { buildReadingSubject, normalizeReadingSubject } from '../src/lib/ai/reading-subject';
import { normalizeAiChatHistory } from '../src/lib/ai/chat-history';
import { resolveBaziReverseCandidate } from '../src/lib/bazi-reverse-input';
import { buildInstantQueryInput } from '../src/lib/instant-chart';
import { defaultInputState, defaultPromptState } from '../src/lib/query-state';

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function beijingTimestamp(value: string) {
  const [dateText, timeText] = value.split(' ');
  const [year, month, day] = dateText!.split('-').map(Number);
  const [hour, minute, second] = timeText!.split(':').map(Number);
  return Date.UTC(year!, month! - 1, day, hour, minute, second) - BEIJING_OFFSET_MS;
}

function createSyntheticSource(
  intervalStart: string,
  intervalEnd: string,
  pillars: { year: string; month: string; day: string; hour: string },
) {
  return {
    pillars,
    intervalStart,
    intervalEnd,
    startTimestamp: beijingTimestamp(intervalStart),
    endTimestamp: beijingTimestamp(intervalEnd),
    endExclusive: true as const,
    timezone: 'Asia/Shanghai' as const,
    offsetHours: 8 as const,
  };
}

const PRIMARY_SOURCE = createSyntheticSource('2024-02-19 11:00:00', '2024-02-19 13:00:00', {
  year: '甲辰',
  month: '丙寅',
  day: '癸丑',
  hour: '戊午',
});
const PRIMARY_SOURCE_WITH_SHORTER_END = createSyntheticSource(
  '2024-02-19 11:00:00',
  '2024-02-19 12:00:00',
  PRIMARY_SOURCE.pillars,
);
const PARTNER_SOURCE = createSyntheticSource('2024-02-19 13:00:00', '2024-02-19 15:00:00', {
  year: '甲辰',
  month: '丙寅',
  day: '癸丑',
  hour: '己未',
});

function primaryInput(source?: unknown) {
  return {
    ...defaultInputState,
    year: '2024',
    month: '2',
    day: '19',
    birthHour: '11',
    birthMinute: '00',
    birthSecond: '00',
    ...(source === undefined ? {} : { birthReverseSource: JSON.stringify(source) }),
  };
}

test('出生区间完整来源进入主体身份，终点变化会改变相同代表时刻的指纹', () => {
  const first = buildReadingSubject(primaryInput(PRIMARY_SOURCE), {
    ...defaultPromptState,
    promptSource: 'bazi',
  });
  const changedEnd = buildReadingSubject(primaryInput(PRIMARY_SOURCE_WITH_SHORTER_END), {
    ...defaultPromptState,
    promptSource: 'bazi',
  });

  assert.notEqual(first.id, changedEnd.id);
  assert.deepEqual(first.range.birthTimeRanges, { primary: PRIMARY_SOURCE });
  assert.equal(
    (first.range.birthTimeRanges as { primary: typeof PRIMARY_SOURCE }).primary.endTimestamp,
    PRIMARY_SOURCE.endTimestamp,
  );
  assert.equal(
    (changedEnd.range.birthTimeRanges as { primary: typeof PRIMARY_SOURCE_WITH_SHORTER_END })
      .primary.endTimestamp,
    PRIMARY_SOURCE_WITH_SHORTER_END.endTimestamp,
  );
});

test('公开节气四柱反推候选可进入出生区间身份', () => {
  const reversed = reverseBaziDates({
    pillars: PRIMARY_SOURCE.pillars,
    startYear: 2024,
    endYear: 2024,
  });
  const candidate = reversed.candidates.find(
    (item) => item.start.text === PRIMARY_SOURCE.intervalStart,
  );
  assert.ok(candidate);
  assert.equal(candidate.end.text, PRIMARY_SOURCE.intervalEnd);
  const selection = resolveBaziReverseCandidate(candidate);
  assert.ok(selection);

  const subject = buildReadingSubject(
    {
      ...defaultInputState,
      year: selection.year,
      month: selection.month,
      day: selection.day,
      timeIndex: selection.timeIndex,
      birthHour: String(selection.representativeHour),
      birthMinute: String(selection.representativeMinute),
      birthSecond: String(selection.representativeSecond),
      birthReverseSource: JSON.stringify(selection.source),
    },
    { ...defaultPromptState, promptSource: 'bazi' },
  );

  assert.deepEqual(subject.range.birthTimeRanges, { primary: selection.source });
});

test('兼容模式隔离双方出生区间，普通模式不写入对方来源', () => {
  const compatibility = buildReadingSubject(
    {
      ...primaryInput(PRIMARY_SOURCE),
      analysisMode: 'compatibility',
      partnerBirthReverseSource: JSON.stringify(PARTNER_SOURCE),
      partnerYear: '2024',
      partnerMonth: '2',
      partnerDay: '19',
      partnerBirthHour: '13',
      partnerBirthMinute: '00',
    },
    { ...defaultPromptState, promptSource: 'bazi-ziwei' },
  );
  const single = buildReadingSubject(
    { ...primaryInput(PRIMARY_SOURCE), partnerBirthReverseSource: JSON.stringify(PARTNER_SOURCE) },
    { ...defaultPromptState, promptSource: 'bazi' },
  );

  assert.deepEqual(compatibility.range.birthTimeRanges, {
    primary: PRIMARY_SOURCE,
    partner: PARTNER_SOURCE,
  });
  assert.deepEqual(single.range.birthTimeRanges, { primary: PRIMARY_SOURCE });
});

test('旧文本来源保留原有精度，历史主体与无来源主体保持可往返', () => {
  const legacySource = {
    pillars: PRIMARY_SOURCE.pillars,
    intervalStart: '2024-02-19 11:00:00',
    intervalEnd: '2024-02-19 13:00:00',
  };
  const subject = buildReadingSubject(primaryInput(legacySource), {
    ...defaultPromptState,
    promptSource: 'bazi',
  });
  const noSource = buildReadingSubject(primaryInput(), {
    ...defaultPromptState,
    promptSource: 'bazi',
  });
  const restored = normalizeReadingSubject(JSON.parse(JSON.stringify(subject)));
  const restoredNoSource = normalizeReadingSubject(JSON.parse(JSON.stringify(noSource)));

  assert.deepEqual(subject.range.birthTimeRanges, { primary: legacySource });
  assert.deepEqual(restored, subject);
  assert.equal('birthTimeRanges' in noSource.range, false);
  assert.deepEqual(restoredNoSource, JSON.parse(JSON.stringify(noSource)));
});

test('AI 对话历史恢复出生区间，瞬时星盘输入不凭空生成出生区间', () => {
  const subject = buildReadingSubject(primaryInput(PRIMARY_SOURCE), {
    ...defaultPromptState,
    promptSource: 'bazi',
  });
  const history = normalizeAiChatHistory({
    sessions: [
      {
        id: 'synthetic-range-session',
        title: '合成区间测试',
        initialQuestion: '测试出生区间身份',
        readingSubject: subject,
        promptMode: 'context',
        turns: [],
        createdAt: '2024-02-19T03:00:00.000Z',
        updatedAt: '2024-02-19T03:00:00.000Z',
      },
    ],
    activeSessionId: 'synthetic-range-session',
  });

  assert.deepEqual(history.sessions[0]?.readingSubject, subject);
  for (const type of ['astrolabe', 'qizheng'] as const) {
    const input = buildInstantQueryInput({
      type,
      timeStandard: 'beijing',
      now: new Date('2024-02-19T03:00:00.000Z'),
      observer: {
        locationName: '上海',
        longitude: 121.4737,
        latitude: 31.2304,
        timezone: 8,
        timeZoneId: 'Asia/Shanghai',
      },
    });
    const instantSubject = buildReadingSubject(input, {
      ...defaultPromptState,
      promptSource: type,
    });
    assert.equal('birthTimeRanges' in instantSubject.range, false, type);
  }
});
