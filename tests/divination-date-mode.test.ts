import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAlmanacReverseSelection,
  getAlmanacParticipantInputMode,
  updateAlmanacParticipantField,
} from '../src/lib/divination/almanac-participants';
import { generateDivinationSession, type DivinationDraft } from '../src/lib/divination/engine';
import type { BaziReverseResolvedInput, BaziReverseSource } from '../src/lib/bazi-reverse-input';

const SOURCE: BaziReverseSource = {
  pillars: {
    year: '甲子',
    month: '丙寅',
    day: '丁卯',
    hour: '戊辰',
  },
  intervalStart: '2024-01-01 08:30:37',
  intervalEnd: '2024-01-01 09:30:37',
};

const SELECTION: BaziReverseResolvedInput = {
  year: '2024',
  month: '1',
  day: '1',
  timeIndex: 4,
  representativeHour: 8,
  representativeMinute: 30,
  representativeSecond: 37,
  source: SOURCE,
};

const ALMANAC_SOURCE: BaziReverseSource = {
  pillars: {
    year: '甲辰',
    month: '丙寅',
    day: '乙巳',
    hour: '甲申',
  },
  intervalStart: '2024-02-11 15:00:00',
  intervalEnd: '2024-02-11 17:00:00',
  startTimestamp: Date.parse('2024-02-11T15:00:00+08:00'),
  endTimestamp: Date.parse('2024-02-11T17:00:00+08:00'),
  endExclusive: true,
  timezone: 'Asia/Shanghai',
  offsetHours: 8,
};

const ALMANAC_SELECTION: BaziReverseResolvedInput = {
  year: '2024',
  month: '2',
  day: '11',
  timeIndex: 8,
  representativeHour: 15,
  representativeMinute: 0,
  representativeSecond: 0,
  source: ALMANAC_SOURCE,
};

function buildDraft(overrides: Partial<DivinationDraft>): DivinationDraft {
  return {
    method: 'qimen',
    question: '这件事接下来如何推进？',
    gender: '',
    birthYear: '',
    divinationTimeMode: 'current',
    customDivinationDate: '',
    customDivinationTime: '',
    divinationTimeStandard: 'beijing',
    meihuaMethod: 'time',
    meihuaNumber: '',
    meihuaSoundCount: '',
    meihuaCharacterText: '',
    meihuaCharacterTones: '',
    meihuaCharacterStrokeCounts: '',
    meihuaCharacterLeftStrokes: '',
    meihuaCharacterRightStrokes: '',
    meihuaDirection: 'north',
    meihuaObjectType: 'earth',
    xiaoliurenMethod: 'time',
    jinkoujueMethod: 'time',
    jinkoujueBranch: '子',
    jinkoujueNumber: '',
    liuyaoTemplate: 'general',
    liurenTemplate: 'general',
    tarotSpread: 'single',
    almanacTopic: 'custom',
    almanacStartDate: '2026-06-01',
    almanacEndDate: '2026-06-05',
    almanacParticipants: [],
    astrolabeName: '本人',
    astrolabeGender: '',
    astrolabeYear: '1995',
    astrolabeMonth: '5',
    astrolabeDay: '20',
    astrolabeHour: '12',
    astrolabeMinute: '30',
    astrolabeLatitude: '39.9042',
    astrolabeLongitude: '116.4074',
    astrolabeTimezone: '8',
    taiyiYear: '2026',
    zhugeText: '',
    ...overrides,
  };
}

test('四柱时间模式必须保留秒、使用北京时间并把候选区间写入占卜事实', async () => {
  const session = await generateDivinationSession(
    buildDraft({
      divinationTimeMode: 'pillars',
      customDivinationDate: '2024-01-01',
      customDivinationTime: '08:30:37',
      divinationTimeStandard: 'true-solar',
      divinationReverseSource: SOURCE,
    }),
  );

  assert.equal(session.timeContext?.standard, 'beijing');
  assert.equal(session.timeContext?.clockDateTime, '2024-01-01T08:30:37');
  assert.equal(session.timeContext?.effectiveDateTime, '2024-01-01T08:30:37');
  assert.match(session.timeContext?.promptText ?? '', /北京时间/);
  assert.match(session.prompt, /2024-01-01 08:30:37 至 2024-01-01 09:30:37/);
  assert.doesNotMatch(session.prompt, /真太阳时/);
});

test('四柱模式在来源失效后不能继续提交旧代表日期', async () => {
  await assert.rejects(
    generateDivinationSession(
      buildDraft({
        divinationTimeMode: 'pillars',
        customDivinationDate: '2024-01-01',
        customDivinationTime: '08:30:37',
        divinationReverseSource: null,
      }),
    ),
    /请先选择一个四柱候选日期/,
  );
});

test('黄历参与人按四柱回填使用公历并在时间编辑后清除来源', () => {
  const participant = {
    id: 'participant-1',
    name: '本人',
    gender: '男' as const,
    year: '',
    month: '',
    day: '',
    timeIndex: '',
    dateType: 'lunar' as const,
  };
  const selected = applyAlmanacReverseSelection(participant, ALMANAC_SELECTION);

  assert.equal(selected.inputMode, 'pillars');
  assert.equal(selected.dateType, 'solar');
  assert.equal(selected.isLeapMonth, false);
  assert.equal(selected.birthSecond, '0');
  assert.equal(getAlmanacParticipantInputMode(selected), 'pillars');

  const edited = updateAlmanacParticipantField(selected, 'birthSecond', '38');
  assert.equal(edited.reverseSource, undefined);
  assert.equal(getAlmanacParticipantInputMode(edited), 'pillars');
});

test('黄历结果提示词应保留参与人的四柱候选区间事实', async () => {
  const participant = applyAlmanacReverseSelection(
    {
      id: 'participant-1',
      name: '本人',
      gender: '男',
      year: '',
      month: '',
      day: '',
      timeIndex: '',
      dateType: 'lunar',
    },
    ALMANAC_SELECTION,
  );
  const session = await generateDivinationSession(
    buildDraft({
      method: 'almanac',
      question: '近期哪天适合办理事项？',
      almanacParticipants: [participant],
    }),
  );

  assert.match(
    session.prompt,
    /本人：出生时间范围（北京时间）：2024-02-11 15:00:00 至 2024-02-11 17:00:00/,
  );
});

test('黄历参与人未明确选择四柱候选时不能使用旧日期提交', async () => {
  await assert.rejects(
    generateDivinationSession(
      buildDraft({
        method: 'almanac',
        question: '',
        almanacParticipants: [
          {
            id: 'participant-1',
            name: '本人',
            gender: '男',
            year: '2024',
            month: '1',
            day: '1',
            timeIndex: '4',
            dateType: 'solar',
            inputMode: 'pillars',
            reverseSource: null,
          },
        ],
      }),
    ),
    /参与人1请先选择一个四柱候选日期/,
  );
});
