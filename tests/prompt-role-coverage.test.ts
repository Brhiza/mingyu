import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt';
import { PROMPT_GUIDANCE_TEXT, type MetaphysicsPromptMethod } from '../src/lib/prompt-guidance';
import { assertPromptHasSingleRole } from './prompt-assertions';

test('全部角色开场、解读主线和输出结构不包含伪系统控制话术', () => {
  Object.entries(PROMPT_GUIDANCE_TEXT).forEach(([method, guidance]) => {
    if (method === 'qizheng') return;

    assert.match(guidance.identity, /^请以.+视角完成解读。$/, `${method} 应使用自然的角色开场`);
    assert.doesNotMatch(
      [guidance.identity, guidance.analysis, guidance.output].join('\n'),
      /系统提示词|只依据|只基于|不得|禁止|取证顺序|证据边界|免责|回答中|输出时/,
      `${method} 不应混入控制话术`,
    );
  });
});

test('全部体系都提供传统判断规则与传统依据', () => {
  Object.entries(PROMPT_GUIDANCE_TEXT).forEach(([method, guidance]) => {
    assert.ok('tradition' in guidance, `${method} 应提供传统判断规则`);
    assert.ok('sources' in guidance, `${method} 应提供传统依据`);
    assert.match(String(guidance.tradition), /./);
    assert.match(
      String(guidance.sources),
      /《.+》|Rider-Waite|Lenormand|Petit|现代西方占星|潮汕|公开资料|通行|iztro/,
    );
  });
});

test('核心传统术数包含判断优先级、冲突处理和流派边界', () => {
  const expectedTerms = {
    bazi: ['月令', '格局', '调候', '用神结论与旺衰、格局、调候相互印证', '神煞作旁证'],
    liuyao: ['确定用神', '月建', '动爻', '信息冲突时先比较', '六神和卦名辅助'],
    ziwei: ['问题对应宫位', '三方会照', '生年四化', '本宫主星与庙旺状态', '传统格局条目'],
    qimen: ['选取日干', '值符值使', '空亡', '吉门吉星', '方向和时机'],
    liuren: ['四课', '取传规则', '初传看发端', '课传主线', '神煞作补充'],
    meihua: ['本卦', '体用', '互卦', '变卦', '四时旺衰'],
    taiyi: ['年计', '阳遁', '七十二局', '主客定算', '主客与定算主线优先'],
    bazhai: ['命卦', '宅卦', '东四西四', '测量', '边界'],
    xuankong: ['三元九运', '山向', '运盘', '下卦', '元龙阴阳'],
    residential: ['宅运', '人宅', '人宅适配', '分层', '边界'],
    almanac: ['事项宜忌', '建除', '参与人', '可用', '慎用'],
  } as const;

  Object.entries(expectedTerms).forEach(([method, terms]) => {
    const guidance = PROMPT_GUIDANCE_TEXT[method as keyof typeof expectedTerms];
    assert.ok('tradition' in guidance, `${method} 应提供传统判断规则`);
    assert.ok('sources' in guidance, `${method} 应提供传统依据`);
    terms.forEach((term) => assert.match(guidance.tradition, new RegExp(term)));
  });
});

test('紫微提示指引应保留可复算格局的传统出处与命中条件', () => {
  const sources = PROMPT_GUIDANCE_TEXT.ziwei.sources;

  assert.match(sources, /《紫微斗数全书》/);
  assert.match(sources, /固定版本可复算格局的卷次、原文与命中条件/);
  assert.doesNotMatch(sources, /登记 \d+ 项|条条件闭合规则|项.*边界/);
});

test('八宅、住宅风水、生肖、太乙与玄空提示词使用各自角色', () => {
  const methods: MetaphysicsPromptMethod[] = [
    'bazhai',
    'residential',
    'zodiac',
    'taiyi',
    'xuankong',
  ];

  methods.forEach((method) => {
    const prompt = buildMetaphysicsPrompt('【排盘信息】\n测试盘面', '请解读重点。', {
      method,
      currentTime: new Date('2026-07-16T12:00:00+08:00'),
    });

    assertPromptHasSingleRole(prompt, PROMPT_GUIDANCE_TEXT[method]);
    assert.match(prompt, /【问题】\n请解读重点。/);
    assert.match(prompt, /【传统判断规则】/);
    assert.match(prompt, /【传统依据】/);
  });
});

test('七政四余提示词指引应约束真实距星宿界与混合精度', () => {
  const guidance = PROMPT_GUIDANCE_TEXT.qizheng;

  assert.match(guidance.identity, /果老星宗传统结构与现代天文位置/);
  assert.match(guidance.analysis, /现代位置与紫炁传统均速结果分层解释/);
  assert.match(guidance.analysis, /十一星宿度与庙旺/);
  assert.match(
    guidance.tradition,
    /二十八宿以目标日期真实距星黄经划界。真太阳时用于传统命身十二宫校正/,
  );
  assert.match(guidance.sources, /SIMBAD J2000\/ICRS 坐标与自行资料/);
  assert.match(
    guidance.output,
    /按“盘面口径、命身与十二宫、星曜宿度、庙旺与吊照、月相光照、阶段趋势”的顺序回答。/,
  );
});
