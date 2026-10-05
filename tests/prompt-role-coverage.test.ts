import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PROMPT_ANSWER_FRAMEWORK,
  PROMPT_METHOD_ANSWER_FRAMEWORKS,
  PROMPT_GUIDANCE_TEXT,
  buildCustomQuestionTask,
  buildPromptTask,
} from '../src/lib/prompt-guidance';

test('全部提示词指引不包含系统控制话术', () => {
  Object.entries(PROMPT_GUIDANCE_TEXT).forEach(([method, guidance]) => {
    const text = [guidance.tradition, guidance.sources].filter(Boolean).join('\n');

    assert.doesNotMatch(
      text,
      /系统提示词|只依据|只基于|不得|禁止|取证顺序|证据边界|免责|回答中|输出时|结构化证据|计算链/,
      `${method} 不应混入控制话术`,
    );
  });
});

test('通用与分体系答题骨架保持中性且可重复调用', () => {
  assert.doesNotMatch(
    PROMPT_ANSWER_FRAMEWORK,
    /【输出要求】|现实建议|风险提醒|行动清单|不得|禁止|只依据|只基于/,
  );
  Object.entries(PROMPT_METHOD_ANSWER_FRAMEWORKS).forEach(([method, framework]) => {
    assert.doesNotMatch(
      framework,
      /【输出要求】|现实建议|风险提醒|行动清单|不得|禁止|只依据|只基于/,
      `${method} 骨架不应包含限制性控制话术`,
    );
  });
  const task = buildPromptTask('请依据盘面回答【问题】。');
  assert.equal(buildPromptTask(task), task);

  const customTask = buildCustomQuestionTask('盘面资料');
  assert.match(customTask, /^请依据盘面资料回答【问题】。/);
  assert.match(customTask, new RegExp(PROMPT_ANSWER_FRAMEWORK));
});

test('合参答题骨架不要求未列出的岁运或运限', () => {
  assert.doesNotMatch(PROMPT_METHOD_ANSWER_FRAMEWORKS['bazi-compatibility'], /共同岁运/);
  assert.doesNotMatch(PROMPT_METHOD_ANSWER_FRAMEWORKS['ziwei-compatibility'], /运限/);
  assert.doesNotMatch(PROMPT_METHOD_ANSWER_FRAMEWORKS['bazi-ziwei'], /共同岁运|运限层级/);
  assert.match(PROMPT_METHOD_ANSWER_FRAMEWORKS['bazi-ziwei-mismatch'], /分开陈述/);
});

test('七政与太乙答题骨架只要求本次盘面的时间层资料', () => {
  assert.doesNotMatch(PROMPT_METHOD_ANSWER_FRAMEWORKS.qizheng, /行限|流曜|阶段引动/);
  assert.match(PROMPT_METHOD_ANSWER_FRAMEWORKS.qizheng, /命身宫度|十一曜落宿|吊照/);
  assert.doesNotMatch(PROMPT_METHOD_ANSWER_FRAMEWORKS.taiyi, /年、月、日或时计/);
  assert.match(PROMPT_METHOD_ANSWER_FRAMEWORKS.taiyi, /本次计式及目标时点/);
});

test('全部体系都提供传统判断规则与传统依据', () => {
  Object.entries(PROMPT_GUIDANCE_TEXT).forEach(([method, guidance]) => {
    assert.equal(typeof guidance.tradition, 'string', `${method} 应提供传统判断规则`);
    assert.ok(guidance.tradition.trim().length > 0, `${method} 传统判断规则不应为空`);
    assert.equal(typeof guidance.sources, 'string', `${method} 应提供传统依据`);
    assert.ok(guidance.sources.trim().length > 0, `${method} 传统依据不应为空`);
    assert.match(
      guidance.sources.trim(),
      /《[^》]+》|Rider-Waite|Petit Lenormand|现代西方占星|潮汕三山国王|诸葛神数|孔明神卦|京房八宫纳甲|玄空飞星通行|通行(?:资料|读法|俗传|本|口径|排法)|天文星历/,
      `${method} 应引用可识别的传统典籍或资料来源`,
    );
  });
});

test('核心传统术数指引覆盖排盘与取用主线', () => {
  const expectedTerms = {
    bazi: ['月令', '格局', '调候', '岁运'],
    liuyao: ['用神', '月建', '动爻', '伏神'],
    ziwei: ['命身', '三方四正', '四化'],
    qimen: ['用神', '值符值使', '空亡', '格局'],
    liuren: ['四课', '取传规则', '三传', '天将'],
    meihua: ['本卦', '体用', '互卦', '变卦'],
    taiyi: ['积年', '阳遁', '七十二局', '主客定算'],
    bazhai: ['命卦', '宅卦', '八方吉凶'],
    xuankong: ['三元九运', '山向', '运盘', '下卦'],
    residential: ['宅运', '人宅', '适配', '山向飞布'],
    almanac: ['原始宜忌', '建除', '参与人', '十二神'],
  } as const;

  Object.entries(expectedTerms).forEach(([method, terms]) => {
    const guidance = PROMPT_GUIDANCE_TEXT[method as keyof typeof expectedTerms];
    terms.forEach((term) => assert.match(guidance.tradition, new RegExp(term)));
  });
});

test('七政四余提示词指引保留解读所需主线', () => {
  const guidance = PROMPT_GUIDANCE_TEXT.qizheng;

  assert.match(guidance.tradition, /二十八宿/);
  assert.match(guidance.tradition, /命身宫/);
  assert.match(guidance.tradition, /主要吊照/);
  assert.doesNotMatch(guidance.tradition, /真实距星黄经划界|真太阳时|计算/);
});
