import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  buildReverseBirthTimePrompt,
  buildThreePillarsProfile,
} from '../src/lib/birth-time-reverse';
import { formatPromptCurrentTime } from '../src/lib/prompt-time';
import { assertPromptCurrentTimeHasGanzhiCalendar } from './prompt-assertions';

test('提示词当前时间应同时给出公历、农历、干支历与节气', () => {
  const date = new Date(2025, 0, 2, 3, 4);
  assert.equal(
    formatPromptCurrentTime(date),
    [
      '公历：2025年1月2日 3时4分',
      '农历：甲辰年十二月初三 寅时',
      '干支历：甲辰年 丙子月 辛未日 庚寅时',
      '当前节气：冬至',
    ].join('\n'),
  );
});

test('反推时辰提示词会输出统一的当前时间证据', () => {
  const reverseProfile = buildThreePillarsProfile({
    gender: 'male',
    dateType: 'solar',
    year: '1994',
    month: '10',
    day: '23',
    isLeapMonth: false,
  });
  const reversePrompt = buildReverseBirthTimePrompt({
    profile: reverseProfile,
    formData: DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  });

  assertPromptCurrentTimeHasGanzhiCalendar(reversePrompt);
});
