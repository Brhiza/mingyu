import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTimeReversePrompt,
  computeTimeReverseCandidates,
  countFilledTimeReverseClues,
  createEmptyTimeReverseDraft,
  hasValidBirthDateForCandidates,
} from '../src/v2-ui/time-reverse';

test('时辰逆推：全空状态可正常创建草稿并生成有效提示词（所有项非必填）', () => {
  const draft = createEmptyTimeReverseDraft();
  assert.equal(countFilledTimeReverseClues(draft), 0);
  assert.equal(hasValidBirthDateForCandidates(draft.known), false);

  const prompt = buildTimeReversePrompt(draft, null);
  assert.match(prompt, /任务角色与目标/);
  assert.match(prompt, /暂未提供明确出生年月日与地点/);
  assert.match(prompt, /最可能的 1–3 个候选时辰排序/);
  assert.doesNotMatch(prompt, /本地排盘十二时辰候选对照/);
});

test('时辰逆推：从命例回填已知信息并输出已填填空项', () => {
  const draft = createEmptyTimeReverseDraft({
    name: '测试命主',
    gender: 'female',
    calendar: 'solar',
    year: '1996',
    month: '8',
    day: '15',
    birthPlace: '四川省 成都市 武侯区',
    longitude: 104.06,
    latitude: 30.67,
  });
  draft.known.fuzzyTimeSlot = '上午（约 07:00–11:00）';
  draft.profile.bodyBuild = '高挑偏瘦';
  draft.profile.firstImpression = '温和稳重';
  draft.milestones.studyWhen = '2014年';
  draft.milestones.studyResult = '高考发挥超常';
  draft.milestones.customMilestones.push({
    id: 'm1',
    when: '2022年',
    event: '换城市独居工作',
    impact: '独立性大幅提升',
  });

  assert.ok(countFilledTimeReverseClues(draft) >= 6);
  assert.equal(hasValidBirthDateForCandidates(draft.known), true);

  const prompt = buildTimeReversePrompt(draft, null);
  assert.match(prompt, /性别：女/);
  assert.match(prompt, /公历 1996年8月15日/);
  assert.match(prompt, /上午（约 07:00–11:00）/);
  assert.match(prompt, /高挑偏瘦/);
  assert.match(prompt, /2014年.*高考发挥超常/);
  assert.match(prompt, /2022年.*换城市独居工作/);
  assert.doesNotMatch(prompt, /明显破财/);
});

test('时辰逆推：有效出生日期可自动算出十二时辰八字与紫微候选对照', async () => {
  const draft = createEmptyTimeReverseDraft({
    gender: 'male',
    calendar: 'solar',
    year: '1995',
    month: '5',
    day: '20',
  });

  const candidates = await computeTimeReverseCandidates(draft.known);
  assert.ok(candidates);
  assert.ok(candidates.candidates.length >= 12);
  assert.ok(candidates.candidates[0]!.hourPillar.length === 2);
  assert.match(candidates.candidates[0]!.ziweiNote, /命宫/);

  const prompt = buildTimeReversePrompt(draft, candidates);
  assert.match(prompt, /本地排盘十二时辰候选对照/);
  assert.match(prompt, /早子时/);
});

test('时辰逆推：不完整或无效日期不报错且不阻塞', async () => {
  const draft = createEmptyTimeReverseDraft({
    calendar: 'solar',
    year: '1995',
    month: '2',
    day: '30',
  });
  assert.equal(hasValidBirthDateForCandidates(draft.known), false);
  const candidates = await computeTimeReverseCandidates(draft.known);
  assert.equal(candidates, null);
});
