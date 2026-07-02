import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  buildReverseBirthTimePrompt,
  buildThreePillarsProfile,
} from '../src/lib/birth-time-reverse';
import { formatPromptCurrentTime } from '../src/lib/prompt-time';

function assertCurrentTimeSectionHasGanzhiCalendar(prompt: string) {
  const currentTimeSection = prompt.match(/^【当前时间】\n([\s\S]*?)(?=\n【)/m)?.[1] ?? '';

  assert.match(currentTimeSection, /^公历：\d{4}年\d{1,2}月\d{1,2}日 \d{1,2}时\d{1,2}分/m);
  assert.match(currentTimeSection, /^农历：.+[子丑寅卯辰巳午未申酉戌亥]时$/m);
  assert.match(currentTimeSection, /^干支历：.+年 .+月 .+日 .+时$/m);
  assert.match(currentTimeSection, /^当前节气：.+/m);
}

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

  assertCurrentTimeSectionHasGanzhiCalendar(reversePrompt);
});
