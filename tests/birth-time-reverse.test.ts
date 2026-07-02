import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import {
  DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  REVERSE_BIRTH_TIME_SELECT_FIELDS,
  REVERSE_BIRTH_TIME_TEXT_FIELDS,
  UNKNOWN_TIME_INDEX,
  buildReverseBirthTimePrompt,
  buildThreePillarsProfile,
  buildUnknownTimeBaziPrompt,
} from '../src/lib/birth-time-reverse';
import { BirthTimeReversePage } from '../src/pages/BirthTimeReversePage';
import {
  buildResultSearch,
  defaultInputState,
  defaultPromptState,
  parseInputState,
} from '../src/lib/query-state';

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

  assert.match(search, /ti=-1/);
  assert.match(search, /pti=-1/);
  assert.doesNotMatch(search, /timeIndex=-1/);
  assert.doesNotMatch(search, /partnerTimeIndex=-1/);
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
  assert.match(prompt, /【候选时辰】/);
  assert.match(prompt, /【线索权重】/);
  assert.match(prompt, /【排除理由】/);
  assert.match(prompt, /【问题】/);
  assert.match(prompt, /【任务】/);
  assert.match(prompt, /【下一轮追问】/);
  assert.match(prompt, /【输出要求】/);
  assert.match(prompt, /年柱：/);
  assert.match(prompt, /月柱：/);
  assert.match(prompt, /日柱：/);
  assert.match(prompt, /时辰：未知/);
  assert.match(prompt, /【已知线索】/);
  assert.doesNotMatch(prompt, /【补充线索】/);
  assert.match(prompt, /- 早子时（0:00-1:00）/);
  assert.match(prompt, /- 晚子时（23:00-24:00）/);
  assert.match(prompt, /候选时辰初盘/);
  assert.match(prompt, /已知线索初判/);
  assert.match(prompt, /线索权重/);
  assert.match(prompt, /排除理由/);
  assert.match(prompt, /下一轮追问/);
  assert.match(prompt, /不要直接假定时柱/);
  assert.match(prompt, /不得直接定时柱/);
  assert.match(prompt, /不得编造资料里没有给出的新盘面事实/);
  assert.match(prompt, /允许基于三柱、已知线索和传统八字规则做保守推理/);
  assert.match(prompt, /主证、辅证、反证或限制/);
  assert.match(prompt, /让我只回复选项/);
  assert.match(prompt, /更可能影响哪些候选时辰/);
  assert.match(prompt, /控制在 3 到 5 个问题/);
  assert.match(prompt, /高、中、低、待确认/);
  assert.match(prompt, /暂不排除/);
  assert.match(prompt, /不得把权重伪装成精确概率/);
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
  assert.doesNotMatch(prompt, /星座：/);
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
  assert.match(prompt, /【已知线索】/);
  assert.match(prompt, /【线索权重】/);
  assert.match(prompt, /【排除理由】/);
  assert.match(prompt, /【下一轮追问】/);
  assert.doesNotMatch(prompt, /未选择/);
  assert.doesNotMatch(prompt, /暂时说不清/);
  assert.doesNotMatch(prompt, /说不清或较复杂/);
  assert.doesNotMatch(prompt, /暂未补充/);
  assert.doesNotMatch(prompt, /体型气质：/);
});

test('反推时辰在没有补充线索时不应假定存在已补充资料', () => {
  const profile = buildThreePillarsProfile({
    gender: 'male',
    dateType: 'solar',
    year: '1990',
    month: '1',
    day: '1',
    isLeapMonth: false,
  });

  const prompt = buildReverseBirthTimePrompt({
    profile,
    formData: DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  });

  assert.doesNotMatch(prompt, /我已经补充的信息/);
  assert.doesNotMatch(prompt, /我已补充的资料/);
  assert.match(prompt, /当前还没有补充额外线索/);
  assert.match(prompt, /暂无可用线索/);
  assert.match(prompt, /不得假装已有事件证据/);
  assert.match(prompt, /请先阅读三柱信息/);
  assert.match(prompt, /控制在 3 到 5 个问题/);
  assert.doesNotMatch(prompt, /控制在 4 到 6 个问题/);
});

test('反推时辰三柱生成应先拒绝无效出生日期', () => {
  const invalidCases: Array<[Parameters<typeof buildThreePillarsProfile>[0], RegExp]> = [
    [
      {
        gender: 'male',
        dateType: 'solar',
        year: '0000',
        month: '1',
        day: '1',
        isLeapMonth: false,
      },
      /出生年份需在 1900-2100 之间/,
    ],
    [
      {
        gender: 'male',
        dateType: 'solar',
        year: '2026',
        month: '2',
        day: '31',
        isLeapMonth: false,
      },
      /日期需在 1-28 之间/,
    ],
    [
      {
        gender: 'female',
        dateType: 'lunar',
        year: '1998',
        month: '13',
        day: '1',
        isLeapMonth: false,
      },
      /出生月份需在 1-12 之间/,
    ],
  ];

  for (const [input, messagePattern] of invalidCases) {
    assert.throws(() => buildThreePillarsProfile(input), messagePattern);
  }
});

test('未知时辰自定义基础提示词会明确只按三柱作保守判断，且不强塞问题框架', () => {
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
    undefined,
    { isCustomQuestion: true },
  );

  assert.match(prompt, /只基于提供的三柱信息与问题作答/);
  assert.match(prompt, /不得擅自假定时柱/);
  assert.match(prompt, /不得编造三柱资料没有给出的新盘面事实/);
  assert.match(prompt, /允许基于三柱、已知线索和传统八字规则做保守推理/);
  assert.doesNotMatch(prompt, /问题研判框架/);
  assert.doesNotMatch(prompt, /【任务】/);
  assert.doesNotMatch(prompt, /【输出要求】/);
});

test('未知时辰内置快捷提示词会使用对应的传统专项框架', () => {
  const profile = buildThreePillarsProfile({
    gender: 'male',
    dateType: 'solar',
    year: '1991',
    month: '3',
    day: '12',
    isLeapMonth: false,
  });

  const prompt = buildUnknownTimeBaziPrompt(profile, '我适合换工作吗？', 'career');

  assert.match(prompt, /事业问题先看官杀代表规则职位与压力/);
  assert.doesNotMatch(prompt, /婚恋问题优先看配偶星/);
});

function renderBirthTimeReversePage(initialEntry: string) {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      createElement(BirthTimeReversePage),
    ),
  );
}

test('反推时辰页面会按真实路由参数显示可用与不可用状态', () => {
  const unavailableHtml = renderBirthTimeReversePage(
    '/birth-time-reverse?a=compatibility&y=1994&m=10&d=23',
  );
  const availableHtml = renderBirthTimeReversePage('/birth-time-reverse?y=1994&m=10&d=23');

  assert.match(unavailableHtml, /反推时辰提示词仅支持个人模式使用/);
  assert.match(availableHtml, /所有选项都可以留空，只填你确定的部分即可/);
  assert.match(availableHtml, /点击复制后，发送到你常用的在线 AI 软件继续提问/);
  assert.match(availableHtml, /<select/);
  assert.match(availableHtml, /<input/);
  assert.match(availableHtml, /<textarea/);
  assert.match(availableHtml, /【候选时辰】/);
});

test('反推时辰字段选项会进入真实提示词且不保留旧字段名', () => {
  const profile = buildThreePillarsProfile({
    gender: 'male',
    dateType: 'solar',
    year: '1994',
    month: '10',
    day: '23',
    isLeapMonth: false,
  });
  const formData = {
    ...DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
    bodyBuild: '圆润松弛',
    personalityStyle: '理性克制',
    familyAtmosphere: '和母亲更亲',
    caregiverPattern: '更多由母亲照顾',
    educationLevel: '重点本科或名校路径',
    careerPattern: '适合单打独斗',
    socialStyle: '边界感强',
    marriageParentingStatus: '婚育节奏偏晚',
    healthPattern: '睡眠波动大',
    parentsMarriageNotes: '父母早年聚少离多',
    siblingNotes: '有一个妹妹',
    familyOrderNotes: '从小承担家中长子责任',
    careerTypeNotes: '技术转管理',
    workSystemNotes: '先体制后市场化团队',
    relationshipPatternNotes: '关系里更重边界',
    relationshipTiming: '恋爱偏晚',
    earlyRomanceStatus: '大学阶段感情经历更明显',
    schedulePattern: '晚上更有精神',
    mobilityPattern: '工作后换过城市',
    leaveHometownStatus: '上学后离乡',
    livingPatternNotes: '常独居',
    keyYearsNotes: '2012 搬家，2020 换城市。',
    extraClueNotes: '小时候和母亲更亲。',
  };

  const prompt = buildReverseBirthTimePrompt({ profile, formData });

  for (const field of REVERSE_BIRTH_TIME_SELECT_FIELDS) {
    assert.notEqual(formData[field.id], '未选择');
    assert.ok(prompt.includes(formData[field.id]));
  }
  for (const field of REVERSE_BIRTH_TIME_TEXT_FIELDS) {
    assert.ok(prompt.includes(formData[field.id]));
  }
  assert.doesNotMatch(prompt, /appearanceNotes/);
  assert.doesNotMatch(prompt, /mobilityNotes/);
});
