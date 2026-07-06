import test from 'node:test';
import assert from 'node:assert/strict';
import { SolarTime } from 'tyme4ts';
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

test('提示词当前时间在晚子时应按 EightChar 输出换日后的日柱', () => {
  const date = new Date(1998, 7, 13, 23, 30, 0);
  const eightChar = SolarTime.fromYmdHms(1998, 8, 13, 23, 30, 0).getLunarHour().getEightChar();
  const expectedGanzhiLine = `干支历：${eightChar.getYear().getName()}年 ${eightChar
    .getMonth()
    .getName()}月 ${eightChar.getDay().getName()}日 ${eightChar.getHour().getName()}时`;

  assert.match(formatPromptCurrentTime(date), new RegExp(expectedGanzhiLine));
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
