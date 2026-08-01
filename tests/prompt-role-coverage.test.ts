import test from 'node:test';
import assert from 'node:assert/strict';

import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt';
import { getBaziSchoolGuidance } from '../src/lib/public-api/prompt-builders';
import { PROMPT_GUIDANCE_TEXT, type MetaphysicsPromptMethod } from '../src/lib/prompt-guidance';
import {
  VERIFIED_ZIWEI_PATTERN_RULE_COUNT,
  ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES,
  ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT,
} from '@core/ziwei/iztro';
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
    bazi: [
      '月令和司令',
      '已校勘月令格局',
      '待综合判断',
      '自动用神、喜忌与调候规则当前失败关闭',
      '泛化书名',
      '神煞只作旁证',
    ],
    liuyao: ['确定用神', '月建', '动爻', '多条信息冲突', '六神和卦名辅助'],
    ziwei: ['问题对应宫位', '三方会照', '生年四化', '不同流派', '单颗星', '不.*补造.*格局'],
    qimen: [
      '具体底本版本',
      '事项角色',
      '完整取用规则',
      '已指定用神对象',
      '值符、值使',
      '旬空',
      '不.*直接升级为现实吉凶',
      '方位、应期、现实结果和行动建议均保持待定',
    ],
    liuren: [
      '具体类神底本版本',
      '事项类别与参与者角色',
      '完整类神取用规则',
      '已指定类神对象',
      '问题文字.*不能替代',
      '四课',
      '取传规则',
      '不判断现实支持或限制、确定快慢、唯一日期、事件结果或行动建议',
    ],
    meihua: ['本卦', '体用', '互卦', '变卦', '四时旺衰'],
    taiyi: ['年计', '阳遁', '七十二局', '主客定算', '年计范围'],
    bazhai: ['命卦', '宅卦', '东四西四', '测量', '边界'],
    xuankong: ['三元九运', '山向', '运盘', '下卦', '元龙阴阳'],
    residential: ['宅运', '人宅', '合参', '分述', '边界'],
    almanac: ['事项宜忌', '建除', '参与人', '可用', '慎用'],
  } as const;

  Object.entries(expectedTerms).forEach(([method, terms]) => {
    const guidance = PROMPT_GUIDANCE_TEXT[method as keyof typeof expectedTerms];
    assert.ok('tradition' in guidance, `${method} 应提供传统判断规则`);
    assert.ok('sources' in guidance, `${method} 应提供传统依据`);
    terms.forEach((term) => assert.match(guidance.tradition, new RegExp(term)));
  });
});

test('八字单盘、合盘、紫微合参和流派标签均关闭未校取用旁路', () => {
  const single = PROMPT_GUIDANCE_TEXT.bazi;
  const compatibility = PROMPT_GUIDANCE_TEXT['bazi-compatibility'];
  const combined = PROMPT_GUIDANCE_TEXT['bazi-ziwei'];

  assert.match(single.analysis, /日主整体旺衰、自动用神、喜忌与调候保持待定/);
  assert.match(single.tradition, /不能用五行数量.*自动定强弱/);
  assert.match(single.sources, /泛化书名不能替代具体底本、版本、原文位置和适用边界/);
  assert.doesNotMatch(single.analysis, /旺衰、格局与调候确定命局主线/);

  assert.match(compatibility.tradition, /不得重新生成.*喜忌互补结论/);
  assert.doesNotMatch(compatibility.analysis, /喜忌互补/);
  assert.doesNotMatch(compatibility.tradition, /各自完成月令、日主旺衰/);

  assert.match(combined.tradition, /八字侧日主整体旺衰保持“待综合判断”/);
  assert.match(combined.tradition, /不得用紫微结论.*补成八字侧待定项/);
  assert.doesNotMatch(combined.tradition, /八字按月令、旺衰、格局调候/);

  for (const school of ['traditional', 'mangpai', 'xinpai'] as const) {
    const guidance = getBaziSchoolGuidance(school);
    assert.match(guidance, /不改变已校勘事实与失败关闭边界/);
    assert.match(guidance, /不据此/);
  }
});

test('紫微提示指引中的格局目录数量应与核心登记同步', () => {
  const sources = PROMPT_GUIDANCE_TEXT.ziwei.sources;

  assert.match(sources, new RegExp(`登记 ${ZIWEI_TRADITIONAL_PATTERN_CATALOG_COUNT} 项`));
  assert.match(sources, new RegExp(`${VERIFIED_ZIWEI_PATTERN_RULE_COUNT} 条条件闭合规则`));
  assert.match(sources, new RegExp(`${ZIWEI_TRADITIONAL_PATTERN_BOUNDARIES.length} 项.*边界`));
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

test('八宅、玄空与住宅风水提示词不得由问题文字恢复现实结论', () => {
  for (const method of ['bazhai', 'xuankong', 'residential'] as const) {
    const prompt = buildMetaphysicsPrompt('【排盘信息】\n测试盘面', '请告诉我怎么布置。', {
      method,
      currentTime: new Date('2026-07-16T12:00:00+08:00'),
    });

    assert.match(prompt, /问题文字不能选择重点宫位/);
    assert.match(
      prompt,
      /具体解释底本和版本、完整解释规则、现场形峦与用途及空间条件、已指定判断对象/,
    );
    assert.match(prompt, /不生成吉方、凶方、宜避方向、住宅现实效果、优先级/);
    assert.doesNotMatch(prompt, /再继续推算|总体判断.*重点宫位.*现实建议|给出可执行建议/);
  }
});

test('生肖未提供问题时仍只要求基于固定关系继续推算', () => {
  const prompt = buildMetaphysicsPrompt('【生肖与流年关系简析】\n测试资料', undefined, {
    method: 'zodiac',
    currentTime: new Date('2026-07-16T12:00:00+08:00'),
  });

  assert.match(
    prompt,
    /【问题】\n请说明本次资料命中的固定关系、可继续推算的范围与仍需补充的信息。/,
  );
  assert.match(prompt, /先区分生肖年支、流年干支、固定地支关系与五行生克方向/);
  assert.match(prompt, /区分固定关系事实、后续推算、资料缺口与现实条件/);
  assert.doesNotMatch(prompt, /请综合解读本次排盘的重点、风险与行动建议/);
});

test('太乙未提供问题时只核对已校勘年计事实', () => {
  const prompt = buildMetaphysicsPrompt('【太乙年计】\n测试资料', undefined, {
    method: 'taiyi',
    currentTime: new Date('2026-07-16T12:00:00+08:00'),
  });

  assert.match(prompt, /【问题】\n请核对本次太乙年计的可复算事实、来源边界与继续解释所需资料。/);
  assert.match(prompt, /不得生成总体态势、胜负、时机或行动建议/);
  assert.match(prompt, /不补造算数属性、月日时计或现实主客含义/);
  assert.doesNotMatch(prompt, /请综合解读本次排盘的重点、风险与行动建议/);
});

test('七政四余提示词指引应约束真实距星宿界、完整星对几何与未采用规则', () => {
  const guidance = PROMPT_GUIDANCE_TEXT.qizheng;

  assert.match(guidance.identity, /果老星宗.*现代天文坐标证据/);
  assert.match(guidance.analysis, /精度层级/);
  assert.match(guidance.analysis, /黄道星座到十二支宫的映射.*十一星宿度、全部星对实际夹角/);
  assert.match(guidance.analysis, /身宫按太阴所在宫，不另套加时公式/);
  assert.match(guidance.analysis, /庙旺和吊照规则当前未采用，不得自行补算/);
  assert.match(guidance.tradition, /55组无序星对只提供实际最小夹角/);
  assert.match(guidance.tradition, /固定容许度吊照和简化庙旺表缺少闭合依据/);
  assert.match(
    guidance.tradition,
    /真实距星黄经划界.*戌白羊.*身宫据《五行精纪》《灵台经》取太阴所在宫.*真太阳时只校正命宫所用生时/,
  );
  assert.match(guidance.sources, /《张果星宗》.*《五行精纪》《灵台经》.*SIMBAD.*Astronomy Engine/);
  assert.match(guidance.output, /继续推算所需资料/);

  const prompt = buildMetaphysicsPrompt('【七政四余】\n测试盘面', '请分析事业并给建议。', {
    method: 'qizheng',
    currentTime: new Date('2026-07-16T12:00:00+08:00'),
  });
  assert.match(prompt, /问题文字不能指定所谓重点宫位/);
  assert.match(
    prompt,
    /具体解释底本、版本与可定位原文、完整庙旺吊照及宫星神煞解释规则、已指定判断对象、明确出生地点时区与资料精度/,
  );
  assert.match(prompt, /不得补造庙旺、吊照、强弱或神煞命中/);
  assert.doesNotMatch(prompt, /给出可执行建议|先说结论，再展开依据和建议|现实建议/);
});
