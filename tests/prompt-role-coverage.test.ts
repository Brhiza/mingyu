import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt';
import { PROMPT_GUIDANCE_TEXT, type MetaphysicsPromptMethod } from '../src/lib/prompt-guidance';
import { assertPromptHasSingleRole } from './prompt-assertions';

test('全部提示词指引不包含系统控制话术', () => {
  Object.entries(PROMPT_GUIDANCE_TEXT).forEach(([method, guidance]) => {
    const text = [guidance.tradition, guidance.sources].filter(Boolean).join('\n');

    assert.match(text, /[\s\S]/, `${method} 应提供传统依据`);
    assert.doesNotMatch(
      text,
      /系统提示词|只依据|只基于|不得|禁止|取证顺序|证据边界|免责|回答中|输出时|结构化证据|计算链/,
      `${method} 不应混入控制话术`,
    );
  });
});

test('全部体系都提供传统判断规则与传统依据', () => {
  Object.entries(PROMPT_GUIDANCE_TEXT).forEach(([method, guidance]) => {
    assert.ok('tradition' in guidance, `${method} 应提供传统判断规则`);
    assert.ok('sources' in guidance, `${method} 应提供传统依据`);
    assert.match(String(guidance.tradition), /[\s\S]/);
    assert.match(
      String(guidance.sources),
      /《.+》|Rider-Waite|现代西方占星|潮汕|公开资料|通行|星历资料|工程/,
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

test('八宅、住宅风水、太乙与玄空提示词使用任务书结构', () => {
  const methods: MetaphysicsPromptMethod[] = ['bazhai', 'residential', 'taiyi', 'xuankong'];

  methods.forEach((method) => {
    const prompt = buildMetaphysicsPrompt('【排盘信息】\n测试盘面', '请解读重点。', {
      method,
      currentTime: new Date('2026-07-16T12:00:00+08:00'),
    });

    assertPromptHasSingleRole(prompt, PROMPT_GUIDANCE_TEXT[method]);
    assert.match(prompt, /【问题】\n请解读重点。/);
    assert.match(prompt, /【传统依据】/);
  });
});

test('七政四余提示词指引保留解读所需主线', () => {
  const guidance = PROMPT_GUIDANCE_TEXT.qizheng;

  assert.match(guidance.tradition, /二十八宿/);
  assert.match(guidance.tradition, /命身宫/);
  assert.match(guidance.tradition, /主要吊照/);
  assert.doesNotMatch(guidance.tradition, /真实距星黄经划界|真太阳时|计算/);
  assert.match(guidance.sources, /《.+》/);
});
