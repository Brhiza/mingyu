import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  UNKNOWN_TIME_INDEX,
  buildReverseBirthTimePrompt,
  buildThreePillarsProfile,
  buildUnknownTimeBaziPrompt,
} from '../src/lib/birth-time-reverse';
import { buildResultSearch, defaultInputState, defaultPromptState, parseInputState } from '../src/lib/query-state';

test('未知时辰索引会被查询参数正确保留', () => {
  const inputState = parseInputState(new URLSearchParams('timeIndex=-1&partnerTimeIndex=-1'));

  assert.equal(inputState.timeIndex, UNKNOWN_TIME_INDEX);
  assert.equal(inputState.partnerTimeIndex, UNKNOWN_TIME_INDEX);

  const search = buildResultSearch(
    {
      ...defaultInputState,
      timeIndex: UNKNOWN_TIME_INDEX,
      partnerTimeIndex: UNKNOWN_TIME_INDEX,
    },
    defaultPromptState,
  );

  assert.match(search, /timeIndex=-1/);
  assert.match(search, /partnerTimeIndex=-1/);
});

test('反推时辰提示词保持 section 结构，并要求先互动再判断', () => {
  const profile = buildThreePillarsProfile({
    gender: 'male',
    dateType: 'solar',
    year: '1994',
    month: '10',
    day: '23',
    isLeapMonth: false,
  });

  const prompt = buildReverseBirthTimePrompt({
    profile,
    formData: {
      ...DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
      bodyBuild: '匀称平稳',
      personalityStyle: '慢热谨慎',
      caregiverPattern: '更多由母亲照顾',
      educationLevel: '重点本科或名校路径',
      relationshipTiming: '恋爱偏晚',
      earlyRomanceStatus: '大学阶段感情经历更明显',
      parentsMarriageNotes: '父母关系稳定',
      siblingNotes: '独生',
      familyOrderNotes: '家里老大，承担责任较多',
      workSystemNotes: '在大公司工作几年后创业',
      careerTypeNotes: '技术岗后期带团队',
      keyYearsNotes: '2012 搬家，2020 换城市。',
      livingPatternNotes: '工作后常独居',
      relationshipPatternNotes: '恋爱少但很认真，更重稳定',
      extraClueNotes: '小时候和母亲更亲，毕业后前两份工作都做不久，后来才慢慢稳定。',
    },
  });

  assert.match(prompt, /【当前时间】/);
  assert.match(prompt, /【已知出生信息】/);
  assert.match(prompt, /【问题】/);
  assert.match(prompt, /【任务】/);
  assert.match(prompt, /【输出要求】/);
  assert.match(prompt, /年柱：/);
  assert.match(prompt, /月柱：/);
  assert.match(prompt, /日柱：/);
  assert.match(prompt, /时辰：未知/);
  assert.match(prompt, /【用户已选择的信息】/);
  assert.match(prompt, /【用户已补充的线索】/);
  assert.match(prompt, /已知线索初判/);
  assert.match(prompt, /第一轮/);
  assert.match(prompt, /不要直接假定时柱/);
  assert.match(prompt, /让用户只回复选项/);
  assert.match(prompt, /A\/B\/C\/D|1\/2\/3\/4/);
  assert.match(prompt, /小时候和母亲更亲/);
  assert.match(prompt, /慢热谨慎/);
  assert.match(prompt, /独生/);
  assert.match(prompt, /家里老大/);
  assert.match(prompt, /2012 搬家/);
  assert.match(prompt, /父母关系稳定/);
  assert.match(prompt, /更多由母亲照顾/);
  assert.match(prompt, /重点本科或名校路径/);
  assert.match(prompt, /在大公司工作几年后创业/);
  assert.match(prompt, /技术岗后期带团队/);
  assert.match(prompt, /工作后常独居/);
  assert.match(prompt, /恋爱少但很认真/);
  assert.match(prompt, /恋爱偏晚/);
  assert.match(prompt, /大学阶段感情经历更明显/);
  assert.doesNotMatch(prompt, /暂时说不清/);
  assert.doesNotMatch(prompt, /说不清或较复杂/);
  assert.doesNotMatch(prompt, /暂未补充/);
  assert.doesNotMatch(prompt, /为什么问这个/);
});

test('反推时辰提示词不会输出未填写或说不清的占位信息', () => {
  const profile = buildThreePillarsProfile({
    gender: 'female',
    dateType: 'solar',
    year: '1992',
    month: '6',
    day: '8',
    isLeapMonth: false,
  });

  const prompt = buildReverseBirthTimePrompt({
    profile,
    formData: {
      ...DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
      extraClueNotes: '少年时期和父亲更亲近。',
    },
  });

  assert.match(prompt, /少年时期和父亲更亲近/);
  assert.doesNotMatch(prompt, /未选择/);
  assert.doesNotMatch(prompt, /暂时说不清/);
  assert.doesNotMatch(prompt, /说不清或较复杂/);
  assert.doesNotMatch(prompt, /暂未补充/);
  assert.doesNotMatch(prompt, /体型气质：/);
});

test('未知时辰基础提示词会明确只按三柱作保守判断', () => {
  const profile = buildThreePillarsProfile({
    gender: 'female',
    dateType: 'lunar',
    year: '1998',
    month: '8',
    day: '15',
    isLeapMonth: false,
  });

  const prompt = buildUnknownTimeBaziPrompt(
    profile,
    '请先看我的整体命局特点，并说明哪些地方因为时辰未知还不能下死结论。',
  );

  assert.match(prompt, /只基于提供的三柱信息与问题作答/);
  assert.match(prompt, /不得擅自假定时柱/);
  assert.match(prompt, /确定部分/);
  assert.match(prompt, /待确认部分/);
  assert.match(prompt, /建议补充线索/);
});

test('输入页与路由会暴露未知时辰和反推时辰入口', () => {
  const inputPageSource = readFileSync(resolve('src/pages/InputPage.tsx'), 'utf8');
  const appSource = readFileSync(resolve('src/App.tsx'), 'utf8');
  const reversePageSource = readFileSync(resolve('src/pages/BirthTimeReversePage.tsx'), 'utf8');
  const reverseLibSource = readFileSync(resolve('src/lib/birth-time-reverse.ts'), 'utf8');

  assert.match(inputPageSource, /未知时辰/);
  assert.match(inputPageSource, /反推时辰/);
  assert.match(inputPageSource, /form\.analysisMode === 'single' && role === 'self'/);
  assert.match(appSource, /birth-time-reverse/);
  assert.match(reversePageSource, /反推时辰提示词仅支持个人模式使用/);
  assert.match(reversePageSource, /所有选项都可以留空，只填你确定的部分即可/);
  assert.match(reversePageSource, /shouldShowPromptShareButton/);
  assert.match(reversePageSource, /className="field-helper-top"/);
  assert.match(reversePageSource, /<select/);
  assert.match(reversePageSource, /<input/);
  assert.match(reversePageSource, /点击复制后，发送到你常用的在线 AI 软件继续提问/);
  assert.match(reverseLibSource, /'未选择'/);
  assert.match(reverseLibSource, /圆润松弛/);
  assert.match(reverseLibSource, /理性克制/);
  assert.match(reverseLibSource, /和母亲更亲/);
  assert.match(reverseLibSource, /parentsMarriageNotes/);
  assert.match(reverseLibSource, /caregiverPattern/);
  assert.match(reverseLibSource, /适合单打独斗/);
  assert.match(reverseLibSource, /educationLevel/);
  assert.match(reverseLibSource, /重点本科或名校路径/);
  assert.match(reverseLibSource, /siblingNotes/);
  assert.match(reverseLibSource, /familyOrderNotes/);
  assert.match(reverseLibSource, /careerTypeNotes/);
  assert.match(reverseLibSource, /workSystemNotes/);
  assert.match(reverseLibSource, /socialStyle/);
  assert.match(reverseLibSource, /relationshipPatternNotes/);
  assert.match(reverseLibSource, /relationshipTiming/);
  assert.match(reverseLibSource, /earlyRomanceStatus/);
  assert.match(reverseLibSource, /schedulePattern/);
  assert.match(reverseLibSource, /mobilityPattern/);
  assert.match(reverseLibSource, /leaveHometownStatus/);
  assert.match(reverseLibSource, /livingPatternNotes/);
  assert.match(reverseLibSource, /keyYearsNotes/);
  assert.match(reverseLibSource, /extraClueNotes/);
  assert.doesNotMatch(reverseLibSource, /appearanceNotes/);
  assert.doesNotMatch(reverseLibSource, /mobilityNotes/);
});
