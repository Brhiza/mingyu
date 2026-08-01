import test from 'node:test';
import assert from 'node:assert/strict';
import { taiyi } from 'mingyu-core';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { analyzeMeihuaEvidence, generateMeihua } from 'mingyu-core/divination/meihua';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import { resolveSignByNumber } from 'mingyu-core/divination/ssgw';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';

import { buildDivinationPrompt } from '../src/lib/divination/engine';
import {
  assertNoPromptPlaceholders,
  assertPromptHasSingleRole,
  assertPromptIsPortableTaskText,
  assertPromptSectionsInOrder,
  findPromptSectionHeadingIndex,
} from './prompt-assertions';
import {
  PROMPT_GUIDANCE_TEXT as PROMPT_ROLE_TEXT,
  type DivinationPromptGuidanceMethod,
} from '../src/lib/prompt-guidance';
import type {
  AstrolabeData,
  DivinationData,
  DivinationType,
  LiuyaoTemplateType,
  LiurenData,
  LiurenTemplateType,
  LenormandData,
  MeihuaData,
  SupplementaryInfo,
  TarotData,
} from '../src/types';

const PROJECT_DECISION_QUESTION = '我现在应该继续推进这个项目，还是先调整策略再行动？';
const PROJECT_DECISION_SUPPLEMENT = '正在做一个需要投入时间和资金的新项目，想判断行动节奏。';
type FixtureMethod = 'liuyao' | 'meihua' | 'xiaoliuren' | 'qimen' | 'liuren' | 'tarot' | 'ssgw';

function createSupplementaryInfo(): SupplementaryInfo {
  return {
    gender: '男',
    birthYear: 1995,
    meihuaSettings: {
      method: 'number',
      number: 123,
    },
  };
}

function createProjectSupplementaryInfo(): SupplementaryInfo {
  return {
    gender: '男',
    birthYear: 1990,
    userSupplement: PROJECT_DECISION_SUPPLEMENT,
  };
}

function assertStandardPromptStructure(prompt: string) {
  const expectedSections = [
    '【解读主线】',
    '【输出结构】',
    '【当前时间】',
    '【补充信息】',
    '【占卜信息】',
    '【问题】',
    '【任务】',
    '【输出要求】',
  ];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.match(prompt, /占法：/);
  assert.doesNotMatch(prompt, /你是资深|【要求】|取证顺序|回答口径|证据边界/);
  assertPromptIsPortableTaskText(prompt);
}

function assertLiurenPromptStructure(prompt: string) {
  const expectedSections = [
    '【解读主线】',
    '【输出结构】',
    '【当前时间】',
    '【补充信息】',
    '【排盘信息】',
    '【分析对象】',
    '【问题】',
    '【问题范围】',
    '【任务】',
    '【输出要求】',
  ];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.doesNotMatch(prompt, /^【占卜信息】$/m);
  assert.doesNotMatch(prompt, /^【分析思路】$/m);
  assert.doesNotMatch(prompt, /取证顺序|回答口径|证据边界/);
  assertPromptIsPortableTaskText(prompt);
}

function assertAlmanacPromptStructure(prompt: string) {
  const expectedSections = [
    '【解读主线】',
    '【输出结构】',
    '【当前时间】',
    '【补充信息】',
    '【占卜信息】',
    '【任务】',
    '【输出要求】',
  ];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.match(prompt, /占法：黄历择日/);
  assert.match(prompt, /核心结构：/);
  assert.doesNotMatch(prompt, /^【问题】$/m);
  assert.doesNotMatch(prompt, /你是资深|【要求】|取证顺序|回答口径|证据边界/);
  assertPromptIsPortableTaskText(prompt);
}

function createAstrolabeData(
  overrides: Partial<Omit<AstrolabeData, 'birth' | 'summary'>> & {
    birth?: Partial<AstrolabeData['birth']>;
    summary?: Partial<AstrolabeData['summary']>;
  } = {},
): AstrolabeData {
  const base = generateAstrolabe({
    name: '本人',
    gender: '女',
    year: '1995',
    month: '5',
    day: '20',
    hour: '12',
    minute: '30',
    latitude: '39.9042',
    longitude: '116.4074',
    timezone: '8',
    locationName: '北京',
  });

  return {
    ...base,
    ...overrides,
    birth: { ...base.birth, ...overrides.birth },
    summary: { ...base.summary, ...overrides.summary },
  };
}

function createData(method: FixtureMethod): DivinationData {
  switch (method) {
    case 'liuyao':
      return generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
        method: 'manual',
        yaos: [9, 7, 8, 8, 7, 6],
      });
    case 'meihua':
      return generateMeihua(new Date('2025-01-01T08:00:00+08:00'), {
        method: 'number',
        number: 123,
      });
    case 'xiaoliuren':
      return generateXiaoliuren({
        method: 'time',
        customDate: new Date('2025-06-29T08:00:00+08:00'),
      });
    case 'qimen':
      return generateQimen(new Date('2025-06-18T10:30:00+08:00'));
    case 'liuren':
      return generateLiuren(new Date('2025-06-18T10:30:00+08:00'));
    case 'tarot':
      return drawTarotSpread('three', {
        manualCards: [
          { id: 7, reversed: false },
          { id: 8, reversed: true },
          { id: 19, reversed: false },
        ],
      });
    case 'ssgw':
      return resolveSignByNumber(18, new Date('2025-06-29T08:00:00+08:00'));
  }
}

function createLenormandData(): DivinationData {
  return drawLenormandSpread('relationship', { manualCardIds: [1, 21, 31, 24, 25] });
}

function createAlmanacData(): DivinationData {
  return generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    participants: [
      {
        id: 'self',
        name: '本人',
        gender: '男',
        year: '1990',
        month: '1',
        day: '1',
        timeIndex: '6',
        dateType: 'solar',
        isLeapMonth: false,
      },
    ],
  });
}

test('各类占卜提示词都使用统一的角色加信息加问题结构', async () => {
  const cases: Array<{
    method: Exclude<DivinationType, 'tarot_single'>;
    question: string;
    data: DivinationData;
    structure: 'standard' | 'liuren' | 'almanac';
  }> = [
    {
      method: 'liuyao',
      question: '这件事接下来该怎么推进？',
      data: createData('liuyao'),
      structure: 'standard',
    },
    {
      method: 'meihua',
      question: '这件事接下来该怎么推进？',
      data: createData('meihua'),
      structure: 'standard',
    },
    {
      method: 'xiaoliuren',
      question: '这件事接下来该怎么推进？',
      data: createData('xiaoliuren'),
      structure: 'standard',
    },
    {
      method: 'qimen',
      question: '这件事接下来该怎么推进？',
      data: createData('qimen'),
      structure: 'standard',
    },
    {
      method: 'liuren',
      question: '这件事接下来该怎么推进？',
      data: createData('liuren'),
      structure: 'liuren',
    },
    {
      method: 'tarot',
      question: '这件事接下来该怎么推进？',
      data: createData('tarot'),
      structure: 'standard',
    },
    {
      method: 'ssgw',
      question: '这件事接下来该怎么推进？',
      data: createData('ssgw'),
      structure: 'standard',
    },
    {
      method: 'lenormand',
      question: '这件事接下来该怎么推进？',
      data: createLenormandData(),
      structure: 'standard',
    },
    { method: 'almanac', question: '', data: createAlmanacData(), structure: 'almanac' },
    {
      method: 'astrolabe',
      question: '这件事接下来该怎么推进？',
      data: createAstrolabeData(),
      structure: 'standard',
    },
    {
      method: 'taiyi',
      question: '请分析本年局势。',
      data: taiyi.generateTaiyi({ scope: 'year', year: 2026 }),
      structure: 'standard',
    },
  ];

  for (const item of cases) {
    const prompt = buildDivinationPrompt(
      item.method,
      item.question,
      item.data,
      createSupplementaryInfo(),
    );
    const role = item.method as DivinationPromptGuidanceMethod;
    assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT[role]);
    if (item.structure === 'liuren') {
      assertLiurenPromptStructure(prompt);
    } else if (item.structure === 'almanac') {
      assertAlmanacPromptStructure(prompt);
    } else {
      assertStandardPromptStructure(prompt);
    }
  }
});

test('占卜输出提示词应是可复制给在线 AI 的独立任务书，不暴露工程提示词', () => {
  const cases: Array<{
    method: Exclude<DivinationType, 'tarot_single'>;
    data: DivinationData;
    question: string;
  }> = [
    { method: 'liuyao', data: createData('liuyao'), question: '这件事接下来该怎么推进？' },
    { method: 'liuren', data: createData('liuren'), question: '这件事接下来该怎么推进？' },
    { method: 'ssgw', data: createData('ssgw'), question: '这件事接下来该怎么推进？' },
    { method: 'almanac', data: createAlmanacData(), question: '这几天哪天适合搬家？' },
  ];

  cases.forEach((item) => {
    const prompt = buildDivinationPrompt(
      item.method,
      item.question,
      item.data,
      createSupplementaryInfo(),
    );
    assertPromptIsPortableTaskText(prompt);
  });
});

test('太乙提示词只凭原始年份重建，不吸收旧盘与旧证据污染', () => {
  const data = taiyi.generateTaiyi({ scope: 'year', year: 2004 });
  const supplementary = createSupplementaryInfo();
  const clean = buildDivinationPrompt('taiyi', '请分析本年局势。', data, supplementary);
  const polluted = structuredClone(data);
  polluted.scope = 'month';
  polluted.ganZhi = '伪造干支';
  polluted.dateTime = '伪造时间';
  polluted.bureau = 72;
  polluted.yinYang = '阴遁';
  polluted.taiyiPosition = '伪造太乙位';
  polluted.wenChangPosition = '伪造文昌位';
  polluted.shiJiPosition = '伪造始击位';
  polluted.jiShenPosition = '伪造计神位';
  polluted.lordCount = -1;
  polluted.guestCount = -1;
  polluted.setCount = -1;
  polluted.judgments = ['伪造现实断语'];
  polluted.model.name = '伪造模型';
  polluted.evidenceAnalysis.promptText = '伪造旧证据';
  polluted.prompt = '伪造旧提示词';

  const rebuilt = buildDivinationPrompt('taiyi', '请分析本年局势。', polluted, supplementary);
  assert.equal(rebuilt, clean);
  assert.doesNotMatch(rebuilt, /伪造|现实断语/);
});

test('非命盘占法不再附加独立的方法论与应期控制段落', () => {
  const cases: Array<{
    method: Exclude<DivinationType, 'tarot_single' | 'astrolabe'>;
    data: DivinationData;
  }> = [
    { method: 'liuyao', data: createData('liuyao') },
    { method: 'meihua', data: createData('meihua') },
    { method: 'xiaoliuren', data: createData('xiaoliuren') },
    { method: 'qimen', data: createData('qimen') },
    { method: 'liuren', data: createData('liuren') },
    { method: 'tarot', data: createData('tarot') },
    { method: 'lenormand', data: createLenormandData() },
    { method: 'ssgw', data: createData('ssgw') },
    { method: 'almanac', data: createAlmanacData() },
  ];

  for (const item of cases) {
    const prompt = buildDivinationPrompt(
      item.method,
      item.method === 'almanac' ? '' : '这件事接下来该怎么推进？',
      item.data,
      createSupplementaryInfo(),
    );

    assert.doesNotMatch(prompt, /【应期判断方法】|【解读方法】|取证顺序|回答口径|证据边界/);
  }
});

test('自定义占卜问题不强塞应期判断方法', () => {
  const prompt = buildDivinationPrompt(
    'meihua',
    '我自己只想问这个具体情况。',
    createData('meihua'),
    createSupplementaryInfo(),
    { isCustomQuestion: true },
  );

  assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT.meihua);
  assert.match(prompt, /【占卜信息】/);
  assert.match(prompt, /【问题】/);
  assert.doesNotMatch(prompt, /【应期判断方法】/);
});

test('择日提示词保留候选日期、事项和参与人资料', () => {
  const prompt = buildDivinationPrompt(
    'almanac',
    '',
    createAlmanacData(),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /占法：黄历择日/);
  assert.match(prompt, /候选日期：2026-06-01 至 2026-06-03/);
  assert.match(prompt, /事项范围：搬家入宅/);
  assert.doesNotMatch(prompt, /事项未限定|按通用.*口径|当前首列候选/);
  assert.match(prompt, /岁支十二神方位太岁午正南、太阳未西南偏南/);
  assert.match(prompt, /岁破子正北/);
  assert.match(prompt, /福德卯正东/);
  assert.match(prompt, /病符巳东南偏南（只列方位，不据此判吉凶）/);
  assert.doesNotMatch(prompt, /岁支方位避|可参考太阳|可参考福德/);
  assert.match(prompt, /候选日期：2026-06-01/);
  assert.match(prompt, /候选日期：2026-06-02/);
  assert.doesNotMatch(prompt, /第\d+候选|首选日期：/);
  assert.match(prompt, /黄历忌项触及搬家入宅/);
  assert.match(prompt, /自动喜忌规则保持关闭，本次不读取喜忌五行/);
  assert.doesNotMatch(prompt, /喜用资料木、火|忌神资料水/);
  assert.doesNotMatch(prompt, /事项权重|优先匹配宜项|事项忌项命中|评分42|高分日期/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|反证|解释边界/);
});

test('择日提示词按原生分类列值日神煞且不要求无依据名次', () => {
  const data = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
  });
  const day = data.days[0];
  const auspiciousGods =
    day.godFacts?.filter((fact) => fact.classification === '吉神').map((fact) => fact.name) ?? [];
  const inauspiciousGods =
    day.godFacts?.filter((fact) => fact.classification === '凶神').map((fact) => fact.name) ?? [];
  const prompt = buildDivinationPrompt('almanac', '', data);

  assert.ok(auspiciousGods.length > 0);
  assert.ok(inauspiciousGods.length > 0);
  assert.ok(
    prompt.includes(
      `值日神煞：吉神${auspiciousGods.join('、')}；凶神${inauspiciousGods.join('、')}`,
    ),
  );
  assert.doesNotMatch(prompt, /建除神煞硬规则|给出首选日期|先给优先日/);
  assert.match(prompt, /按可用候选、条件候选和慎用候选分组/);
  assert.match(prompt, /不生成首选、备选或唯一最佳结论/);
});

test('择日提示词从原始输入重建神煞分类，不吸收旧事项规则污染', () => {
  const data = generateAlmanacSelection({
    topic: 'custom',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
  });
  const clean = buildDivinationPrompt('almanac', '', data);
  const polluted = structuredClone(data);
  polluted.days[0].godFacts = undefined;
  polluted.days[0].highlights = ['事项规则命中喜神四相'];
  polluted.days[0].cautions = ['事项规则触及忌神游祸'];

  const prompt = buildDivinationPrompt('almanac', '', polluted);

  assert.equal(prompt, clean);
  assert.doesNotMatch(prompt, /事项规则命中喜神|事项规则触及忌神/);
});

test('择日提示词只凭原始事项、日期与参与人资料重建，不吸收完整旧结果污染', () => {
  const data = createAlmanacData();
  const clean = buildDivinationPrompt('almanac', '', data, createSupplementaryInfo());
  const polluted = structuredClone(data);
  polluted.topic = 'custom';
  polluted.topicLabel = '伪造事项';
  polluted.startDate = '2000-01-01';
  polluted.endDate = '2000-01-01';
  polluted.timestamp = 0;
  polluted.participants[0].name = '伪造参与人';
  polluted.participants[0].pillars.day = '伪造日柱';
  polluted.days[0].date = '2000-01-01';
  polluted.days[0].ganzhi.day = '伪造干支';
  polluted.days[0].recommends = ['伪造宜项'];
  polluted.days[0].avoids = ['伪造忌项'];
  polluted.days[0].highlights = ['伪造支持结论'];
  polluted.days[0].cautions = ['伪造风险结论'];
  polluted.evidenceAnalysis!.promptText = '伪造旧证据';

  const rebuilt = buildDivinationPrompt('almanac', '', polluted, createSupplementaryInfo());
  assert.equal(rebuilt, clean);
  assert.doesNotMatch(rebuilt, /伪造|2000-01-01/);
});

test('择日提示词应保留用户补充诉求但不强制输出问题 section', () => {
  const prompt = buildDivinationPrompt(
    'almanac',
    '计划六月上旬签合作合同，希望兼顾资金安全和双方合作稳定。',
    createAlmanacData(),
  );

  assert.match(
    prompt,
    /【补充信息】\n择日补充：计划六月上旬签合作合同，希望兼顾资金安全和双方合作稳定。/,
  );
  assert.doesNotMatch(prompt, /^【问题】$/m);
  assert.ok(
    findPromptSectionHeadingIndex(prompt, '【补充信息】') <
      findPromptSectionHeadingIndex(prompt, '【占卜信息】'),
  );
});

test('占卜提示词的输出要求保持简短明确', async () => {
  const session = buildDivinationPrompt(
    'qimen',
    '这件事接下来该怎么推进？',
    createData('qimen'),
    createSupplementaryInfo(),
  );

  assert.match(
    session,
    /【输出要求】\n使用简体中文，先回答【问题】，再说明主要依据、时机条件和行动建议。/,
  );
  assert.doesNotMatch(session, /请直接回答：/);
  assert.doesNotMatch(session, /语气和表达要求|结论总览|反证限制|行动清单/);
});

test('非梅花占法的补充信息不应混入梅花专属的起卦方式和数字', () => {
  const prompt = buildDivinationPrompt(
    'tarot',
    '这件事接下来该怎么推进？',
    createData('tarot'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /【补充信息】/);
  assert.match(prompt, /性别：男/);
  assert.match(prompt, /出生年份：1995/);
  assert.doesNotMatch(prompt, /起卦方式：数字起卦/);
  assert.doesNotMatch(prompt, /起卦数字：123/);
});

test('雷诺曼提示词应保留用户补充背景', () => {
  const prompt = buildDivinationPrompt(
    'lenormand',
    PROJECT_DECISION_QUESTION,
    createLenormandData(),
    createProjectSupplementaryInfo(),
  );

  assert.match(prompt, /【补充信息】/);
  assert.match(prompt, /性别：男/);
  assert.match(prompt, /出生年份：1990/);
  assert.match(prompt, new RegExp(`现实背景：${PROJECT_DECISION_SUPPLEMENT}`));
  assert.ok(
    findPromptSectionHeadingIndex(prompt, '【补充信息】') <
      findPromptSectionHeadingIndex(prompt, '【占卜信息】'),
  );
});

test('占卜提示词的当前时间应来自起盘结果而不是运行环境当前时间', () => {
  const data = {
    ...createData('qimen'),
    timestamp: Date.parse('2025-01-01T08:30:00+08:00'),
  };
  const prompt = buildDivinationPrompt('qimen', '这件事接下来该怎么推进？', data);

  assert.match(prompt, /【当前时间】\n公历：2025年1月1日 8时30分/);
  assert.doesNotMatch(prompt, /年年/);
});

test('奇门提示词会输出值符值使、旬空、马星边界和格局资料', () => {
  const qimenData = createData('qimen');
  const prompt = buildDivinationPrompt('qimen', '这次换工作该不该主动推进？', qimenData, {
    gender: '男',
    birthYear: 1995,
  });

  assert.match(prompt, /核心结构：[阴阳]遁[1-9]局；值符\S+；值使\S+/);
  assert.match(prompt, /位置索引：/);
  assert.match(
    prompt,
    /值符值使与时干：值符\S+落\S+宫；值使\S+落\S+宫；时干[甲乙丙丁戊己庚辛壬癸](?:见于\S+宫|未见落宫)/,
  );
  assert.match(
    prompt,
    /旬空与马星边界：旬空[子丑寅卯辰巳午未申酉戌亥]空落\S+宫、[子丑寅卯辰巳午未申酉戌亥]空落\S+宫；马星起例层级未闭合，未自动推算/,
  );
  assert.match(prompt, /位置与五行事实：|经典格局：|已校勘组合规则：/);
  assert.match(prompt, /先根据具体问题选择日干、年命或事项类神作为用神并说明取用口径/);
  assert.match(prompt, /取用依据未闭合时保留待定，不强行给出方向、时机或现实结果/);
  assert.doesNotMatch(prompt, /主宫评分：|辅宫评分：|评分-?\d+|（-?\d+分|应期范围\d/);
  assert.doesNotMatch(prompt, /判断人事状态、方向和时机|吉门吉星需|凶象也要看|方向和时机均从/);
  assert.doesNotMatch(prompt, /建除(?:建|除|满|平|定|执|破|危|成|收|开|闭)(?:吉|凶|平)(?:；|\n)/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|反证|解释边界/);
  assert.doesNotMatch(prompt, /问事参考/);
  assert.doesNotMatch(prompt, /卦象|课传|牌阵|签诗|牌位/);
});

test('奇门提示词不再根据问题词表输出问事参考', () => {
  const data = createData('qimen');

  const prompt = buildDivinationPrompt('qimen', '这次换工作该不该主动推进？', data, {
    gender: '男',
    birthYear: 1995,
  });

  assert.doesNotMatch(prompt, /问事参考/);
  assert.doesNotMatch(prompt, /事业参考|首看开门|兼看生门/);
  assert.match(prompt, /值符值使与时干：值符\S+落\S+宫；值使\S+落\S+宫/);
});

test('六爻提示词会保留世应、动变、空亡、伏神和月日资料', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这件事接下来该怎么推进？',
    createData('liuyao'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /核心结构：主卦/);
  assert.match(prompt, /六亲持世：第1爻妻财持世/);
  assert.match(prompt, /世应动变：世爻第1爻妻财丁巳火；应爻第4爻父母戊申金；动变/);
  assert.match(prompt, /空亡与伏神：/);
  assert.doesNotMatch(prompt, /兄弟持世，主竞争、破财、朋友/);
  assert.doesNotMatch(prompt, /取用评分表|权重\d/);
  assert.match(
    prompt,
    /月日触发：月建子：同支第6爻兄弟戊子水；日辰午：未直接同支入爻，冲第6爻兄弟戊子水/,
  );
  assert.match(
    prompt,
    /应期资料：动爻作用：第1爻妻财丁巳发动化子孙戊寅，用神爻位尚未闭合，仅作变化点/,
  );
  assert.match(prompt, /当前问题关系不足，尚未确定用神六亲/);
  assert.doesNotMatch(prompt, /逢出空、冲实或用神透出时才可作为应期/);
  assert.match(prompt, /用神主线：/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界|只使用上方/);
  assert.doesNotMatch(prompt, /课传|盘局|牌阵|签诗|牌位/);
});

test('六爻提示词只使用原始摇卦资料重建，不吸收完整旧盘与旧证据污染', () => {
  const data = generateLiuyao(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'manual',
    yaos: [9, 7, 8, 8, 7, 6],
  });
  const supplementary = createSupplementaryInfo();
  const clean = buildDivinationPrompt('liuyao', PROJECT_DECISION_QUESTION, data, supplementary);
  const polluted = structuredClone(data);
  polluted.originalName = '伪造主卦';
  polluted.changedName = '伪造变卦';
  polluted.interName = '伪造互卦';
  polluted.ganzhi = { year: '伪造', month: '伪造', day: '伪造', hour: '伪造' };
  polluted.changingYaos = [{ position: 6, isChanging: true, type: '伪造动爻' }];
  polluted.palace = { name: '伪造宫', wuxing: '伪造五行' };
  polluted.yaosDetail[0] = {
    ...polluted.yaosDetail[0],
    sixGod: '伪造六神',
    sixRelative: '伪造六亲',
    najiaDizhi: '伪造纳甲',
    isWorld: false,
    isResponse: true,
  };
  polluted.hiddenSpirits = [];
  polluted.specialAdvice = '伪造现实必胜结论';
  polluted.evidenceAnalysis!.promptText = '伪造完整旧证据';

  const rebuilt = buildDivinationPrompt(
    'liuyao',
    PROJECT_DECISION_QUESTION,
    polluted,
    supplementary,
  );
  assert.equal(rebuilt, clean);
  assert.doesNotMatch(rebuilt, /伪造|现实必胜/);
});

test('六爻提示词不再按问题词表补充取用参考', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这次换工作有没有机会升职？',
    createData('liuyao'),
    createSupplementaryInfo(),
  );

  assert.doesNotMatch(prompt, /取用参考：/);
  assert.doesNotMatch(prompt, /事业职位|事业工作：以官鬼为取用参考/);
  assert.match(prompt, /世应动变：/);
});

test('六爻用户选择事业模板只写入简短问题范围', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这次换工作有没有机会升职？',
    createData('liuyao'),
    createSupplementaryInfo(),
    { liuyaoTemplate: 'shiye' },
  );

  assert.match(prompt, /【问题范围】\n事业工作/);
  assert.doesNotMatch(prompt, /取用参考：/);
  assert.doesNotMatch(prompt, /断卦类型|取证顺序|回答口径|证据边界/);
});

test('六爻鬼神怪异模板只写入问题范围，不附加控制话术', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '最近家里总觉得不安，这是不是鬼神怪异或冲犯？',
    createData('liuyao'),
    createSupplementaryInfo(),
    { liuyaoTemplate: 'guaishen' },
  );

  assert.match(prompt, /【问题范围】\n鬼神怪异/);
  assert.doesNotMatch(prompt, /取用参考：/);
  assert.doesNotMatch(
    prompt,
    /断卦要点|断卦类型|专项抓手|证据不足|不得仅凭|取证顺序|回答口径|证据边界/,
  );
});

test('六爻未知专项模板应回落到通用断卦，避免输出 undefined', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这次合作要不要签？',
    createData('liuyao'),
    createSupplementaryInfo(),
    { liuyaoTemplate: 'decision' as LiuyaoTemplateType },
  );

  assert.match(prompt, /【问题范围】\n通用/);
  assert.doesNotMatch(prompt, /断卦类型|取证顺序|回答口径|证据边界/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

test('梅花提示词会保留体用、互卦、变卦与起卦细节', () => {
  const prompt = buildDivinationPrompt(
    'meihua',
    '这件事接下来该怎么推进？',
    createData('meihua'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /体用：体卦离（火）；用卦坤（土）；动爻第2爻；体用关系体生用/);
  assert.match(prompt, /互卦：水山蹇；体互坎（水）；用互艮（土）；体互克原体；原体生用互/);
  assert.match(prompt, /变卦：火水未济；变后体卦离（火）；变后用卦坎（水）；变后体用用克体/);
  assert.match(prompt, /坐端应兆：当前输入未记录以求测者所在处为中心/);
  assert.match(prompt, /万物外应：当前输入未记录耳闻目见的现场原始事实/);
  assert.match(prompt, /饮食专项：当前输入未明确饮食专项所需情境/);
  assert.match(prompt, /观物专项：当前输入未明确观物专项所需情境/);
  assert.match(prompt, /万物戏验.*第951至952行已留档/);
  assert.match(prompt, /不得自动猜手中物/);
  assert.match(prompt, /诸事响应专项：当前输入只有起卦方式/);
  assert.match(prompt, /占卜十应：《占卜十应诀》第954至978行/);
  assert.match(prompt, /正应、互应、变应三项只回指/);
  assert.match(prompt, /日支虽已记录，但不能自动生成日应吉凶/);
  assert.match(prompt, /疾病末段不得生成诊断、痊愈或生死结论/);
  assert.match(prompt, /论事十大应：《论事十大应（论日辰秘文）》第979至989行/);
  assert.match(prompt, /行、立、坐、卧、担、券、裹头、跣足、喜、怒十项目录/);
  assert.match(prompt, /现有日干支、月令旺衰、主互变卦/);
  assert.match(prompt, /不得生成官司与财务结果、贵人访客、文书发动、疾病诊断或预后/);
  assert.match(prompt, /卦应八卦目录：《卦应》第990至1018行/);
  assert.match(prompt, /乾、坤、震、巽、坎、离、艮、兑八卦目录/);
  assert.match(prompt, /坤至兑没有乾卦同类分项/);
  assert.match(prompt, /不自动匹配或补齐类象/);
  assert.match(prompt, /不得把“附药：丸子”扩写为药物、剂型、处方、服药或替代就医建议/);
  assert.match(prompt, /反对性情资料：主卦.*综卦为.*错卦为/);
  assert.match(prompt, /月令与起卦：子月（水令），体卦死，用卦囚；起卦法数字起卦法；起卦数字123/);
  assert.match(prompt, /应期资料：应期状态：待补充事项情境/);
  assert.match(prompt, /第2爻为变化层位/);
  assert.match(prompt, /资料未齐时不能计算传统克应/);
  assert.match(prompt, /主卦卦辞分类：.*(?:传统.*标签|未见明确吉凶或进退标签)/);
  assert.match(prompt, /动爻传统辅助：.*当前爻位已发动/);
  assert.match(prompt, /未发动，不展开爻辞解释/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界/);
  assert.doesNotMatch(
    prompt,
    /体用评分：|类象权重：|事情刚开始|内部配合|核心决策|应期快于常规|应期迟缓|\d+日内|\d+月左右/,
  );
  const meihua = createData('meihua') as MeihuaData;
  assert.doesNotMatch(
    prompt,
    new RegExp(
      [
        meihua.mainHexagram.description,
        meihua.interHexagram?.description,
        meihua.changedHexagram?.description,
        ...(meihua.mainHexagram.yaoCi ?? []),
      ]
        .filter(Boolean)
        .join('|'),
    ),
  );
  assert.match(prompt, /第2爻.*动.*属用/);
});

test('梅花旧缓存缺少全卦克应、观物、十应与卦应字段时应自动重建', () => {
  const data = createData('meihua') as MeihuaData;
  const evidence = analyzeMeihuaEvidence(data);
  data.evidenceAnalysis = {
    ...evidence,
    sensoryOmenFact: undefined,
    foodContextFact: undefined,
    objectContextFact: {
      ...evidence.objectContextFact,
      selectionOrderFields: undefined,
      relationRuleFields: undefined,
      quantityRuleFields: undefined,
      bodySelectionRuleFields: undefined,
      lineStructureRuleFields: undefined,
      changeObservationRuleFields: undefined,
      responseOmenRuleFields: undefined,
      seasonalObservationRuleFields: undefined,
      usageExampleFields: undefined,
      handGuessRuleFields: undefined,
      sourceLineFields: undefined,
    },
    topicResponseContextFact: undefined,
    tenResponseContextFact: undefined,
    matterTenResponseContextFact: undefined,
    trigramResponseCatalogFact: undefined,
    hexagramDispositionFacts: undefined,
    hexagramDispositionVersionFact: undefined,
    timingFacts: evidence.timingFacts
      .filter((item) => item.type !== '全卦克应关系')
      .map((item) =>
        item.type === '克应资料覆盖'
          ? {
              ...item,
              requiredContextFields: undefined,
              availableContextFields: undefined,
              missingContextFields: undefined,
            }
          : item,
      ),
  };

  const prompt = buildDivinationPrompt(
    'meihua',
    '这件事接下来该怎么推进？',
    data,
    createSupplementaryInfo(),
  );

  assert.match(prompt, /全卦克应候选：/);
  assert.match(prompt, /自然期限/);
  assert.match(prompt, /不得靠关键词猜测/);
  assert.match(prompt, /万物外应：当前输入未记录耳闻目见的现场原始事实/);
  assert.match(prompt, /饮食专项：当前输入未明确饮食专项所需情境/);
  assert.match(prompt, /观物专项：当前输入未明确观物专项所需情境/);
  assert.match(prompt, /万物戏验.*第951至952行已留档/);
  assert.match(prompt, /不得自动猜手中物/);
  assert.match(prompt, /诸事响应专项：当前输入只有起卦方式/);
  assert.match(prompt, /占卜十应：《占卜十应诀》第954至978行/);
  assert.match(prompt, /日支虽已记录，但不能自动生成日应吉凶/);
  assert.match(prompt, /论事十大应：《论事十大应（论日辰秘文）》第979至989行/);
  assert.match(prompt, /现场行为、姿态、装束或情绪原始记录/);
  assert.match(prompt, /卦应八卦目录：《卦应》第990至1018行/);
  assert.match(prompt, /坤至兑没有乾卦同类分项/);
  assert.match(prompt, /震“＄足”、巽“三位”、离“干卦”/);
  assert.match(prompt, /反对性情资料：主卦.*综卦为.*错卦为/);
});

test('梅花提示词只使用原始起卦资料重建，不吸收完整旧盘与旧证据污染', () => {
  const clean = generateMeihua(new Date('2025-01-01T08:00:00+08:00'), {
    method: 'number',
    number: 123,
  });
  const polluted = structuredClone(clean);
  polluted.originalName = '伪造主卦';
  polluted.interName = '伪造互卦';
  polluted.changedName = '伪造变卦';
  polluted.ganzhi = { year: '伪造', month: '伪造', day: '伪造', hour: '伪造' };
  polluted.mainHexagram.name = '伪造主卦';
  polluted.interHexagram!.name = '伪造互卦';
  polluted.changedHexagram!.name = '伪造变卦';
  polluted.tiGua.name = '伪造体卦';
  polluted.yongGua.name = '伪造用卦';
  polluted.movingYao = { position: 6, description: '伪造动爻', yaoName: '伪造上爻' };
  polluted.analysis.tiYongRelation = '伪造必胜关系';
  polluted.analysis.inter1Relation = '伪造过程关系';
  polluted.analysis.changedRelation = '伪造结果关系';
  polluted.analysis.yingQi = ['伪造三日必应'];
  polluted.evidenceAnalysis!.promptText = '伪造完整旧证据';
  polluted.evidenceAnalysis!.traditionalFacts[0]!.promptText = '伪造传统事实';

  const cleanPrompt = buildDivinationPrompt(
    'meihua',
    PROJECT_DECISION_QUESTION,
    clean,
    createProjectSupplementaryInfo(),
  );
  const pollutedPrompt = buildDivinationPrompt(
    'meihua',
    PROJECT_DECISION_QUESTION,
    polluted,
    createProjectSupplementaryInfo(),
  );

  assert.equal(pollutedPrompt, cleanPrompt);
  assert.doesNotMatch(
    pollutedPrompt,
    /伪造主卦|伪造互卦|伪造变卦|伪造体卦|伪造用卦|伪造必胜|伪造三日必应|伪造完整旧证据|伪造传统事实/,
  );
});

test('小六壬提示词只保留原始时间事实和待校边界', () => {
  const prompt = buildDivinationPrompt(
    'xiaoliuren',
    '这件事接下来该怎么推进？',
    createData('xiaoliuren'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /占法：小六壬/);
  assert.match(prompt, /时辰序号：5（子1至亥12）/);
  assert.match(prompt, /历法口径：东八区民用日零点换日；闰月沿用同名月序/);
  assert.match(prompt, /固定底本、具体版本和页码/);
  assert.match(prompt, /必须先说明采用的具体底本、版本与完整起数规则/);
  assert.doesNotMatch(
    prompt,
    /顺数轨迹：|占得宫：|歌诀原文：|留连事难成|核心结构：起因|五行推进：|月令旺衰：|日干六亲：|课盘神煞：|应期参考：/,
  );
});

test('小六壬提示词从时间戳重建，不吸收旧三宫、歌诀与证据污染', () => {
  const clean = generateXiaoliuren({
    customDate: new Date('2025-06-29T08:00:00+08:00'),
  });
  const polluted = structuredClone(clean);
  polluted.methodLabel = '伪造起课法';
  polluted.ganzhi.day = '甲子';
  Object.assign(polluted, {
    sequence: { month: '伪造月宫', day: '伪造日宫', hour: '伪造时宫' },
    primary: { name: '伪造占得宫', verse: '伪造主证歌诀' },
  });
  polluted.evidenceAnalysis!.promptText = '伪造旧证据';

  const cleanPrompt = buildDivinationPrompt(
    'xiaoliuren',
    PROJECT_DECISION_QUESTION,
    clean,
    createProjectSupplementaryInfo(),
  );
  const pollutedPrompt = buildDivinationPrompt(
    'xiaoliuren',
    PROJECT_DECISION_QUESTION,
    polluted,
    createProjectSupplementaryInfo(),
  );

  assert.equal(pollutedPrompt, cleanPrompt);
  assert.doesNotMatch(pollutedPrompt, /伪造起课法|伪造时宫歌诀|伪造主证歌诀|伪造旧主证|伪造旧证据/);
});

test('梅花、小六壬、奇门不再输出隐藏专项分析思路', () => {
  for (const method of ['meihua', 'xiaoliuren', 'qimen'] as const) {
    const prompt = buildDivinationPrompt(
      method,
      '这件事接下来该怎么推进？',
      createData(method),
      createSupplementaryInfo(),
    );

    assert.doesNotMatch(prompt, /【分析思路】/);
    assert.match(prompt, /【任务】/);
  }
});

test('大六壬模板只写入简短问题范围', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '我现在要不要换工作？',
    createData('liuren'),
    createSupplementaryInfo(),
    { liurenTemplate: 'shiye' },
  );

  assertLiurenPromptStructure(prompt);
  assert.match(prompt, /【问题范围】\n事业工作/);
  assert.doesNotMatch(prompt, /关注重点：|岗位路径、协作阻力、窗口时机/);
  assert.doesNotMatch(prompt, /【断课要点】|【分析思路】|断课类型|取证顺序|回答口径|证据边界/);
});

test('大六壬提示词会给出精简课传资料，避免重复堆叠', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    createData('liuren'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /核心结构：盘面摘要：月将申；占时巳；昼占；贵人丑临戌；旬空子、丑/);
  assert.match(prompt, /课传主线：取传重审法；传态递传；发用酉乘勾陈；末传卯/);
  assert.match(prompt, /古籍依据：《六壬粹言》《大六壬大全》《六壬指南》九宗门取传法：重审/);
  assert.match(prompt, /四课：一课申临戊乘青龙，土生金/);
  assert.match(prompt, /三传：初传酉乘勾陈，六亲子孙，日干戊土生初传酉金/);
  assert.match(prompt, /空亡有宜有忌/);
  assert.match(prompt, /旬空：子、丑，命中中传子/);
  assert.doesNotMatch(prompt, /主虚而不实/);
  assert.doesNotMatch(prompt, /断课抓手：/);
  assert.doesNotMatch(prompt, /发用主线：/);
});

test('大六壬提示词使用简短任务与输出要求', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    createData('liuren'),
    createSupplementaryInfo(),
  );

  assert.match(
    prompt,
    /【任务】\n请严格围绕已给出的月将、四课、三传、天将、课体与神煞主线作答，直接说明演变、卡点与下一步。/,
  );
  assert.match(
    prompt,
    /【输出要求】\n使用简体中文，先回答【问题】，再说明主要依据、时机条件和行动建议。/,
  );
  assert.doesNotMatch(prompt, /反证限制|证据不足|不硬给日期|取证顺序|回答口径/);
});

test('大六壬提示词只使用重建课体与神煞，不吸收旧结果注入内容', () => {
  const cleanData = createData('liuren') as LiurenData;
  const data = {
    ...cleanData,
    guaTi: ['伪造龙德卦', '伪造连珠卦'],
    shenShaSummary: ['伪造旬奇临初传', '伪造天马并发', '伪造末传逢月德'],
  } satisfies LiurenData;

  const cleanPrompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    cleanData,
    createSupplementaryInfo(),
  );

  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    data,
    createSupplementaryInfo(),
  );

  assert.equal(prompt, cleanPrompt);
  assert.match(prompt, /课体：三交卦/);
  assert.match(prompt, /神煞：/);
  assert.doesNotMatch(prompt, /伪造龙德卦|伪造连珠卦|伪造旬奇|伪造天马|伪造末传/);
  assert.doesNotMatch(prompt, /辅证：/);
});

test('大六壬未知专项模板应回落到通用断课，避免输出 undefined', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事后面会怎么发展？',
    createData('liuren'),
    createSupplementaryInfo(),
    { liurenTemplate: 'progress' as LiurenTemplateType },
  );

  assert.match(prompt, /【问题范围】\n通用/);
  assert.doesNotMatch(prompt, /关注重点：核心目标、现实阻力、下一步动作/);
  assert.doesNotMatch(prompt, /断课类型|取证顺序|回答口径|证据边界/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

test('塔罗提示词在牌义版本闭合前只保留抽牌事实', () => {
  const prompt = buildDivinationPrompt(
    'tarot',
    '这件事接下来该怎么推进？',
    createData('tarot'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /核心结构：牌阵/);
  assert.match(prompt, /牌位顺序：/);
  assert.match(prompt, /- 过去：项目内部牌号7，恋人（正位）/);
  assert.match(prompt, /- 现在：项目内部牌号8，战车（逆位）/);
  assert.match(prompt, /牌义状态：.*尚未完成校勘/);
  assert.match(prompt, /不得自行补造或使用关键词、牌义、元素、牌阶/);
  assert.match(prompt, /不得补造牌义或给出趋势与行动结论/);
  assert.doesNotMatch(prompt, /断牌口径|现实边界|结构化证据|证据汇总|解释边界/);
  assert.doesNotMatch(
    prompt,
    /关键词：|牌义：|元素主题：|牌阶主题：|牌组层级|宫廷人物|叙事权重|元素数字|表示这些能量正在直接发挥作用|信息被隐藏/,
  );
});

test('灵签提示词在签谱来源闭合前只保留签号与轨迹', () => {
  const sign = resolveSignByNumber(18, new Date('2025-06-29T08:00:00+08:00'));
  const prompt = buildDivinationPrompt(
    'ssgw',
    '这件事接下来该怎么推进？',
    sign,
    createSupplementaryInfo(),
  );

  assert.match(prompt, /签号：第18签/);
  assert.match(prompt, /签谱状态：来源尚未完成校勘/);
  assert.doesNotMatch(prompt, /签题：|签诗：|典故：|签意：|核心寓意：/);
  assert.doesNotMatch(prompt, /吉凶层级|宜忌条件|事项映射|现实映射|典故映射|证据汇总|非事实结论/);
  assert.match(prompt, /不得自行查表、补造或解释/);
  assert.doesNotMatch(prompt, /签诗主旨|典故启示|签意结论|宜进还是宜守/);
});

test('灵签提示词应忽略外部签文与典故注入并保持失败关闭', () => {
  const canonical = resolveSignByNumber(9, new Date('2025-06-29T08:00:00+08:00'));
  const prompt = buildDivinationPrompt(
    'ssgw',
    '这件事接下来该怎么推进？',
    {
      ...canonical,
      title: '典故去重测试',
      poem: '静待云开见月明，不妨暂且敛锋芒。',
      story: '韩信受胯下之辱，先忍后成大业。',
      details: {
        典故: '韩信受胯下之辱，先忍后成大业。',
        解签: '宜暂避锋芒，等待时机。',
      },
      evidenceAnalysis: undefined,
    },
    createSupplementaryInfo(),
  );

  assert.match(prompt, /签号：第9签/);
  assert.match(prompt, /签谱状态：来源尚未完成校勘/);
  assert.doesNotMatch(prompt, /典故去重测试|静待云开见月明|韩信受胯下之辱|宜暂避锋芒/);
  assert.doesNotMatch(prompt, /签诗主旨|典故启示|签意结论|宜进还是宜守/);
});

test('雷诺曼提示词在牌义版本闭合前只保留抽牌原始记录', () => {
  const prompt = buildDivinationPrompt(
    'lenormand',
    '这件事接下来该怎么推进？',
    createLenormandData(),
  );

  assert.match(prompt, /核心结构：牌阵/);
  assert.match(prompt, /牌位顺序：/);
  assert.match(prompt, /你的状态：第1号 骑士/);
  assert.match(prompt, /对方状态：第21号 山/);
  assert.match(prompt, /牌义状态：关键词、单牌牌义、固定组合、相邻合读和布局解释均待具体版本校勘/);
  assert.match(prompt, /不得补造关键词、牌义、组合或布局趋势/);
  assert.doesNotMatch(prompt, /关键词：|牌义：|组合明细：|后续发展、行动建议/);
});

test('塔罗与雷诺曼提示词应由原始牌号重建，不吸收派生字段和旧证据污染', () => {
  const tarot = createData('tarot') as TarotData;
  const tarotPolluted = structuredClone(tarot);
  tarotPolluted.spreadName = '伪造塔罗牌阵';
  tarotPolluted.cards[0] = {
    ...tarotPolluted.cards[0],
    name: '伪造塔罗牌',
    position: '伪造牌位',
    keywords: ['保证成功'],
    uprightMeaning: '伪造现实结论',
  };
  tarotPolluted.evidenceAnalysis!.promptText = '伪造旧塔罗证据';
  assert.equal(
    buildDivinationPrompt('tarot', '这件事接下来该怎么推进？', tarotPolluted),
    buildDivinationPrompt('tarot', '这件事接下来该怎么推进？', tarot),
  );

  const lenormand = createLenormandData() as LenormandData;
  const lenormandPolluted = structuredClone(lenormand);
  lenormandPolluted.spreadName = '伪造雷诺曼牌阵';
  lenormandPolluted.cards[0] = {
    ...lenormandPolluted.cards[0],
    name: '伪造雷诺曼牌',
    position: '伪造牌位',
    keywords: ['必然获利'],
    meaning: '伪造现实结论',
  };
  lenormandPolluted.combinations = [{ card1: '伪造甲', card2: '伪造乙', meaning: '伪造组合' }];
  lenormandPolluted.layoutEvidence = ['伪造布局'];
  lenormandPolluted.evidenceAnalysis!.promptText = '伪造旧雷诺曼证据';
  assert.equal(
    buildDivinationPrompt('lenormand', '这件事接下来该怎么推进？', lenormandPolluted),
    buildDivinationPrompt('lenormand', '这件事接下来该怎么推进？', lenormand),
  );
});

test('星盘提示词应直接给出太阳月亮上升和主要相位资料', () => {
  const data = createAstrolabeData();
  const prompt = buildDivinationPrompt('astrolabe', '这件事接下来该怎么推进？', data);
  const sun = data.planets.find((item) => item.name === 'Sun')!;
  const moon = data.planets.find((item) => item.name === 'Moon')!;
  const ascendant = data.angles.find((item) => item.name === 'Ascendant')!;

  assert.match(
    prompt,
    new RegExp(`核心结构：太阳${sun.formatted}；月亮${moon.formatted}；上升${ascendant.formatted}`),
  );
  assert.match(
    prompt,
    new RegExp(`核心位置：太阳${sun.formatted}；月亮${moon.formatted}；上升${ascendant.formatted}`),
  );
  assert.match(prompt, /关键提示：逆行星体/);
  assert.match(prompt, /本命相位穷举：选定点位.+共核验276组无序点对，完整保留\d+组命中项/);
  assert.match(prompt, /相位明细：.+实际夹角.+精确角.+偏差.+采用容许度/);
  assert.doesNotMatch(prompt, /强度\d+%/);
  assert.doesNotMatch(prompt, /紧密等级|中等等级|宽松等级|归一化容许度/);
  assert.doesNotMatch(
    prompt,
    /星盘要点|只使用上方|本次按本命盘|星盘回答只按|结构化证据|证据汇总|解释边界/,
  );
  assert.doesNotMatch(prompt, /卦象|课传|盘局|牌阵|签诗|牌位/);
});

test('星盘提示词写入年限选择后应包含分析对象与行运边界', () => {
  const baseAstrolabeData = createAstrolabeData();
  const astrolabeData = createAstrolabeData({
    planets: baseAstrolabeData.planets.filter((planet) => planet.label !== '水星'),
    angles: baseAstrolabeData.angles.filter((angle) => angle.label === '上升'),
    aspects: [],
    summary: {
      patterns: [],
      elements: { 火: ['上升'], 土: ['太阳', '月亮'], 风: [], 水: [] },
      modalities: { 开创: ['上升'], 固定: ['太阳'], 变动: ['月亮'] },
    },
  });
  const prompt = buildDivinationPrompt(
    'astrolabe',
    '我现在适合换工作吗？',
    astrolabeData,
    undefined,
    {
      astrolabeTopic: 'job-change',
      astrolabeScopeText:
        '分析对象：流年2028。\n主要行运相位：土星□太阳（刑相，偏差0.50°，入相）。',
    },
  );

  assert.match(prompt, /【分析对象】\n分析对象：流年2028。/);
  assert.match(prompt, /主要行运相位：土星□太阳/);
  assert.doesNotMatch(prompt, /【行运时间尺度】|时间边界|星盘回答必须|本命盘只定/);
  assert.doesNotMatch(prompt, /强度\d+%/);
  assert.doesNotMatch(prompt, /【应期判断方法】/);
  assert.ok(prompt.indexOf('【分析对象】') < prompt.indexOf('【占卜信息】'));
});

test('金口诀提示词在具体版本闭合前只保留原始起课记录', async () => {
  const { generateJinkoujue } =
    await import('../packages/core/src/divination/algorithms/jinkoujue.ts');
  const { buildDivinationPrompt } = await import('../src/lib/divination/engine/index.ts');
  const data = generateJinkoujue({
    method: 'number',
    number: 5,
    customDate: new Date('2025-01-01T08:00:00+08:00'),
  });
  const prompt = buildDivinationPrompt(
    'jinkoujue',
    PROJECT_DECISION_QUESTION,
    data,
    createProjectSupplementaryInfo(),
    {
      isCustomQuestion: true,
    },
  );
  assert.match(prompt, /占法：金口诀/);
  assert.match(prompt, /用户原始数字：5/);
  assert.match(prompt, /金口诀原始起课事实与待校边界/);
  assert.match(prompt, /证据链有缺口/);
  assert.match(prompt, /具体底本、版本/);
  assert.doesNotMatch(prompt, /阴阳发用：|发用位|四位关系：|动爻：|月将贵人：/);
  assertPromptIsPortableTaskText(prompt);
});

test('金口诀提示词只使用原始起课输入重建，不吸收旧课盘与证据污染', async () => {
  const { generateJinkoujue } =
    await import('../packages/core/src/divination/algorithms/jinkoujue.ts');
  const { buildDivinationPrompt } = await import('../src/lib/divination/engine/index.ts');
  const clean = generateJinkoujue({
    method: 'number',
    number: 5,
    customDate: new Date('2025-01-01T08:00:00+08:00'),
  });
  const polluted = {
    ...structuredClone(clean),
    methodLabel: '伪造起课法',
    ganzhi: { year: '甲子', month: '甲子', day: '甲子', hour: '甲子' },
    positions: { guiShen: { god: '伪造贵神' } },
    relations: { guiToJiang: '保证成功' },
    yinYangUse: { rule: '伪造发用规则' },
    movements: [],
    mainLine: '伪造课盘主线',
    summary: '伪造现实结论',
    evidenceAnalysis: { promptText: '伪造旧证据' },
  } as unknown as typeof clean;

  const cleanPrompt = buildDivinationPrompt(
    'jinkoujue',
    PROJECT_DECISION_QUESTION,
    clean,
    createProjectSupplementaryInfo(),
    { isCustomQuestion: true },
  );
  const pollutedPrompt = buildDivinationPrompt(
    'jinkoujue',
    PROJECT_DECISION_QUESTION,
    polluted,
    createProjectSupplementaryInfo(),
    { isCustomQuestion: true },
  );

  assert.equal(pollutedPrompt, cleanPrompt);
  assert.doesNotMatch(
    pollutedPrompt,
    /伪造起课法|伪造贵神|保证成功|伪造发用规则|伪造课盘主线|伪造现实结论|伪造旧证据/,
  );
});
