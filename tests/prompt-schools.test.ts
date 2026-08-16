import assert from 'node:assert/strict';
import test from 'node:test';

import { baziCalculator } from 'mingyu-core/bazi';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import { huangjiJingshi, wuyunLiuqi } from 'mingyu-core';
import {
  PROMPT_SCHOOL_PROFILES,
  buildBaziCompatibilityPrompt,
  buildBaziPrompt,
  buildDivinationPrompt,
  formatPromptSchoolGuidance,
  getPromptSchoolIds,
  getPromptSchoolSectionTitle,
} from 'mingyu-core/prompt';

function createChart(gender: 'male' | 'female', day: number) {
  return baziCalculator.calculateBazi({
    year: 1990,
    month: 5,
    day,
    timeIndex: 5,
    gender,
  });
}

test('解读口径注册表只覆盖规划内适用术数且每种至少提供两种口径', () => {
  for (const method of Object.keys(PROMPT_SCHOOL_PROFILES)) {
    assert.ok(
      getPromptSchoolIds(method as keyof typeof PROMPT_SCHOOL_PROFILES).length >= 2,
      method,
    );
  }
  assert.equal('ssgw' in PROMPT_SCHOOL_PROFILES, false);
});

test('多口径合参应按流派或断法命名并归纳共识分歧', () => {
  const guidance = formatPromptSchoolGuidance('liuyao', [
    'huozhulin',
    'bushizhengzong',
    'zengshanbuyi',
  ]);

  assert.match(guidance, /火珠林法/);
  assert.match(guidance, /《卜筮正宗》法/);
  assert.match(guidance, /《增删卜易》法/);
  assert.match(guidance, /每种解读口径分别形成判断/);
  assert.match(guidance, /共同结论、分歧/);
  assert.match(guidance, /综合判断/);
  assert.match(guidance, /断法1：火珠林法/);
  assert.equal(getPromptSchoolSectionTitle('liuyao', ['huozhulin', 'bushizhengzong']), '多法合参');
  assert.equal(getPromptSchoolSectionTitle('bazi', ['ziping', 'mangpai']), '多派合参');
  assert.equal(getPromptSchoolSectionTitle('tarot', ['rws', 'yuansu']), '多口径合参');
  const single = formatPromptSchoolGuidance('liuyao', ['huozhulin']);
  assert.match(single, /断法：火珠林法/);
  assert.doesNotMatch(single, /合参任务/);
  assert.equal(getPromptSchoolSectionTitle('liuyao', ['huozhulin']), '解读断法');
  assert.throws(() => formatPromptSchoolGuidance('liuyao', ['unknown']), /不支持解读口径/);
});

test('八字单盘与合盘应支持子平、盲派和新派合参', () => {
  const result1 = createChart('female', 15);
  const result2 = createChart('male', 20);
  const singlePrompt = buildBaziPrompt({
    result: result1,
    schools: ['ziping', 'mangpai', 'xinpai'],
    question: '事业主线如何？',
  });
  const compatibilityPrompt = buildBaziCompatibilityPrompt({
    result1,
    result2,
    schools: ['ziping', 'mangpai', 'xinpai'],
    question: '双方适合长期合作吗？',
  });

  for (const prompt of [singlePrompt, compatibilityPrompt]) {
    assert.match(prompt, /【多派合参】/);
    assert.match(prompt, /子平派/);
    assert.match(prompt, /盲派/);
    assert.match(prompt, /新派/);
    assert.match(prompt, /共同结论、分歧/);
  }
});

test('奇门提示词应同时标明起局方法与多种解读断法', () => {
  const result = generateQimen(new Date('2026-08-08T15:14:00+08:00'), 'feipan');
  const prompt = buildDivinationPrompt({
    method: 'qimen',
    data: result,
    question: '项目应如何推进？',
    schools: ['gongwei', 'geju', 'zhuke'],
  });

  assert.match(prompt, /起局方法：飞盘法；拆补法定局；时家/);
  assert.match(prompt, /宫位用神法/);
  assert.match(prompt, /格局取象法/);
  assert.match(prompt, /主客方略法/);
});

test('五运六气与皇极经世核心构建器应原生支持多法合参', () => {
  const wuyunResult = wuyunLiuqi.calculateWuyunLiuqi({ year: 2026 });
  const wuyunPrompt = wuyunLiuqi.buildWuyunLiuqiPrompt(wuyunResult, '全年节律如何？', [
    'yunqi',
    'kezhu',
  ]);
  const huangjiResult = huangjiJingshi.calculateHuangjiJingshi({ year: 2026 });
  const huangjiPrompt = huangjiJingshi.buildHuangjiJingshiPrompt(huangjiResult, '年度主题如何？', [
    'yuanhui',
    'guaqi',
  ]);

  assert.match(wuyunPrompt, /【多法合参】/);
  assert.match(wuyunPrompt, /五运六气法/);
  assert.match(wuyunPrompt, /客主加临法/);
  assert.match(huangjiPrompt, /【多法合参】/);
  assert.match(huangjiPrompt, /元会运世法/);
  assert.match(huangjiPrompt, /值年卦气法/);
});

test('三山国王灵签应保持签谱提示词，不附加派系段落', () => {
  const prompt = buildDivinationPrompt({
    method: 'ssgw',
    data: drawRandomSign({ seed: '派系例外测试' }),
    question: '这件事应如何推进？',
    schools: ['任意值'],
  });

  assert.match(prompt, /占法：三山国王灵签/);
  assert.doesNotMatch(prompt, /解读派系|多派合参|任意值/);
});
