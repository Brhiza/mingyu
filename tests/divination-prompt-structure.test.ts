import test from 'node:test';
import assert from 'node:assert/strict';
import { taiyi } from 'mingyu-core';

import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { buildDivinationPrompt as buildCoreDivinationPrompt } from '../packages/core/src/prompt/divination.ts';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
import { generateLiuyao } from '../packages/core/src/divination/algorithms/liuyao.ts';
import { generateMeihua } from '../packages/core/src/divination/algorithms/meihua/index.ts';
import { drawTarotSpread, tarotSpreads } from '../packages/core/src/divination/tarot.ts';
import { drawLenormandSpread } from '../packages/core/src/divination/algorithms/lenormand.ts';
import { resolveSignByNumber } from '../packages/core/src/divination/algorithms/ssgw.ts';
import { generateXiaoliuren } from '../packages/core/src/divination/algorithms/xiaoliuren.ts';
import { generateAlmanacSelection } from '../packages/core/src/divination/algorithms/almanac.ts';
import { formatDetailedDivinationInfo } from '../packages/core/src/prompt/divination-detail.ts';
import { generateLiuren } from '../packages/core/src/divination/algorithms/liuren/index.ts';
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
  AlmanacData,
  AstrolabeData,
  DivinationData,
  DivinationType,
  LiuyaoTemplateType,
  LiurenData,
  LiurenTemplateType,
  SupplementaryInfo,
} from '../src/types';

type FixtureMethod = 'liuyao' | 'meihua' | 'qimen' | 'liuren' | 'tarot' | 'ssgw';

let qimenPromptSample: ReturnType<typeof generateQimen> | undefined;

function createQimenPromptSample() {
  qimenPromptSample ??= generateQimen(new Date('2026-05-19T10:30:00+08:00'));
  return structuredClone(qimenPromptSample);
}

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

function assertStandardPromptStructure(prompt: string) {
  const expectedSections = ['【传统依据】', '【当前时间】', '【占卜信息】', '【任务】', '【问题】'];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.match(prompt, /占法：/);
  assert.doesNotMatch(prompt, /你是资深|【要求】|取证顺序|回答口径|证据边界|【输出要求】/);
  assertPromptIsPortableTaskText(prompt);
}

function assertSsgwPromptStructure(prompt: string) {
  assert.doesNotMatch(prompt, /【当前时间】|【占卜信息】|【问题】|【任务】|【传统依据】|占法：/);
  assert.match(prompt, /签号：第\d+签/);
  assert.match(prompt, /签题：/);
  assert.match(prompt, /签诗：/);
  assert.match(prompt, /吉凶级别：/);
  assert.match(prompt, /典故：/);
  assert.match(prompt, /基础解签：/);
  assert.match(prompt, /补充解释：/);
  assert.doesNotMatch(prompt, /项目|仓库|API|MCP|工程|实现状态|来源状态|内部字段|项目规则/);
}

function assertLiurenPromptStructure(prompt: string) {
  const expectedSections = [
    '【传统依据】',
    '【当前时间】',
    '【排盘信息】',
    '【分析对象】',
    '【问题范围】',
    '【任务】',
    '【问题】',
  ];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.doesNotMatch(prompt, /^【占卜信息】$/m);
  assert.doesNotMatch(prompt, /^【分析思路】$/m);
  assert.doesNotMatch(prompt, /取证顺序|回答口径|证据边界|【输出要求】/);
  assertPromptIsPortableTaskText(prompt);
}

function assertAlmanacPromptStructure(prompt: string) {
  const expectedSections = ['【传统依据】', '【当前时间】', '【占卜信息】', '【任务】'];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.match(prompt, /占法：黄历择日/);
  assert.match(prompt, /核心结构：/);
  assert.doesNotMatch(prompt, /^【问题】$/m);
  assert.doesNotMatch(prompt, /你是资深|【要求】|取证顺序|回答口径|证据边界|【输出要求】/);
  assertPromptIsPortableTaskText(prompt);
}

function createAstrolabeData(
  overrides: Partial<Omit<AstrolabeData, 'birth' | 'summary'>> & {
    birth?: Partial<AstrolabeData['birth']>;
    summary?: Partial<AstrolabeData['summary']>;
  } = {},
): AstrolabeData {
  const base: AstrolabeData = {
    birth: {
      name: '本人',
      gender: '女',
      dateTime: '1995-05-20 12:30',
      location: '北京',
      timezone: 8,
    },
    planets: [
      {
        name: 'Sun',
        label: '太阳',
        longitude: 59,
        sign: '金牛座',
        degree: 29,
        minute: 0,
        formatted: '金牛座 29°',
        house: 10,
        retrograde: false,
      },
      {
        name: 'Moon',
        label: '月亮',
        longitude: 158,
        sign: '处女座',
        degree: 8,
        minute: 0,
        formatted: '处女座 08°',
        house: 2,
        retrograde: false,
      },
      {
        name: 'Mercury',
        label: '水星',
        longitude: 70,
        sign: '双子座',
        degree: 10,
        minute: 0,
        formatted: '双子座 10°',
        house: 11,
        retrograde: false,
      },
    ],
    houses: Array.from({ length: 12 }, (_, index) => ({
      name: `House ${index + 1}`,
      label: `第${index + 1}宫`,
      longitude: index * 30,
      sign: '白羊座',
      degree: 0,
      minute: 0,
      house: index + 1,
      formatted: '白羊座 0°',
    })),
    angles: [
      {
        name: 'Ascendant',
        label: '上升',
        longitude: 132,
        sign: '狮子座',
        degree: 12,
        minute: 0,
        formatted: '狮子座 12°',
        house: 0,
      },
      {
        name: 'Midheaven',
        label: '天顶',
        longitude: 35,
        sign: '金牛座',
        degree: 5,
        minute: 0,
        formatted: '金牛座 05°',
        house: 0,
      },
    ],
    aspects: [
      {
        body1: '太阳',
        symbol: '△',
        body2: '月亮',
        type: '三分',
        orb: 3.2,
        closeness: '紧密',
        normalizedOrbRatio: 0.14,
        applying: true,
      },
      {
        body1: '太阳',
        symbol: '合',
        body2: '水星',
        type: '合相',
        orb: 4.1,
        closeness: '紧密',
        normalizedOrbRatio: 0.26,
        applying: false,
      },
    ],
    summary: {
      retrograde: [],
      patterns: ['土象偏强'],
      elements: { 火: ['上升'], 土: ['太阳', '月亮'], 风: ['水星'], 水: [] },
      modalities: { 开创: ['上升'], 固定: ['太阳'], 变动: ['月亮', '水星'] },
    },
    timestamp: Date.now(),
  };

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
      return generateLiuyao(new Date('2025-06-18T10:30:00+08:00'), {
        method: 'manual',
        yaos: [9, 8, 8, 8, 7, 8],
      });
    case 'meihua':
      return generateMeihua(new Date('2025-01-01T08:00:00+08:00'), {
        method: 'number',
        number: 123,
      });
    case 'qimen':
      return createQimenPromptSample();
    case 'liuren':
      return {
        ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
        timestamp: new Date('2025-03-01T10:30:00+08:00').getTime(),
        dayNight: '昼占',
        monthLeader: '亥',
        divinationBranch: '卯',
        dayOfficer: '贵人',
        noblemanBranch: '亥',
        noblemanGroundBranch: '卯',
        xunKong: ['戌', '亥'],
        earthlyPlate: ['子', '丑', '寅'],
        dayStemResidence: '巳',
        transmissionRule: '比用法',
        transmissionPattern: '递传',
        transmissionDetail: '取传采用比用法，以一课上神亥为初传发用。',
        fourLessons: [
          {
            name: '一课',
            upper: '亥',
            lower: '卯',
            god: '贵人',
            relation: '水生木',
            note: '外援先动',
          },
          {
            name: '二课',
            upper: '子',
            lower: '辰',
            god: '螣蛇',
            relation: '土克水',
            note: '过程有牵制',
          },
          {
            name: '三课',
            upper: '丑',
            lower: '巳',
            god: '朱雀',
            relation: '火生土',
            note: '沟通带动变化',
          },
          {
            name: '四课',
            upper: '寅',
            lower: '午',
            god: '六合',
            relation: '木生火',
            note: '后续利于协同',
          },
        ],
        threeTransmissions: [
          { stage: '初传', branch: '亥', god: '贵人', relation: '生扶', note: '起因来自外部推动' },
          {
            stage: '中传',
            branch: '丑',
            god: '朱雀',
            relation: '承压',
            note: '中段要处理沟通与执行偏差',
          },
          {
            stage: '末传',
            branch: '寅',
            god: '六合',
            relation: '转合',
            note: '结果更利于合作收束',
          },
        ],
        heavenlyPlate: [
          { branch: '子', under: '丑', god: '青龙' },
          { branch: '丑', under: '寅', god: '天空' },
          { branch: '寅', under: '卯', god: '白虎' },
        ],
        patternTags: ['贵人发用', '顺传', '比用'],
        classicalRules: [
          {
            source: '《大六壬大全》九宗门取传法',
            rule: '知一/比用',
            category: '知一法',
            summary: '多处贼克时，先取与日干阴阳同类者；若形成知一变格，则按变格取用。',
          },
        ],
        lessonSummary: '四课由生入克，先得助后承压，再转协同。',
        transmissionSummary: '三传顺传，事情会逐步推进，但中段要过一道沟通关。',
      } satisfies LiurenData;
    case 'tarot':
      return {
        spreadType: 'three',
        spreadName: '时间流牌阵',
        cards: [
          {
            id: 7,
            name: '恋人',
            position: '过去',
            reversed: false,
            keywords: ['选择', '连接'],
            element: '大阿卡纳（核心课题与阶段转折）',
            archetype: '大阿卡纳的人生主轴',
          },
          {
            id: 8,
            name: '战车',
            position: '现在',
            reversed: true,
            keywords: ['控制', '节奏'],
            element: '大阿卡纳（核心课题与阶段转折）',
            archetype: '大阿卡纳的人生主轴',
          },
          {
            id: 9,
            name: '力量',
            position: '未来',
            reversed: false,
            keywords: ['力量', '勇气'],
            element: '大阿卡纳（核心课题与阶段转折）',
            archetype: '大阿卡纳的人生主轴',
          },
        ],
        timestamp: Date.now(),
      };
    case 'ssgw':
      return resolveSignByNumber(18, new Date('2025-06-18T10:30:00+08:00'));
  }
}

function createAlmanacData(): DivinationData {
  return generateAlmanacSelection({
    topic: 'move',
    startDate: '2026-06-01',
    endDate: '2026-06-02',
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
      method: 'qimen',
      question: '这件事接下来该怎么推进？',
      data: createData('qimen'),
      structure: 'standard',
    },
    {
      method: 'liuren',
      question: '这件事接下来该怎么推进？',
      data: generateLiuren(new Date('2025-06-18T10:30:00+08:00')),
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
    if (item.method === 'ssgw') {
      assertSsgwPromptStructure(prompt);
      assertPromptIsPortableTaskText(prompt);
    } else if (item.structure === 'liuren') {
      assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT[role]);
      assertLiurenPromptStructure(prompt);
    } else if (item.structure === 'almanac') {
      assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT[role]);
      assertAlmanacPromptStructure(prompt);
    } else {
      assertPromptHasSingleRole(prompt, PROMPT_ROLE_TEXT[role]);
      assertStandardPromptStructure(prompt);
    }

    if (item.method !== 'astrolabe' && item.method !== 'taiyi') {
      assert.doesNotMatch(prompt, /【应期判断方法】|【解读方法】|取证顺序|回答口径|证据边界/);
    }

    if (item.method === 'qimen') {
      assert.doesNotMatch(prompt, /【输出要求】|使用简体中文|现实建议|行动建议|行动清单/);
      assert.doesNotMatch(prompt, /【分析思路】/);
    } else if (item.method === 'liuyao') {
      assert.match(prompt, /核心结构：主卦/);
      assert.match(prompt, /世应：世爻第2爻子孙寅木；应爻第5爻官鬼戌土/);
      assert.match(prompt, /六爻全表：[\s\S]*第1爻兄弟子水[^\n]*动[^\n]*化官鬼未土（回头克）/);
      assert.doesNotMatch(prompt, /^动变：/m);
      assert.match(
        prompt,
        /旬空子、丑；命中第1爻兄弟子水（本爻空亡；本爻子逢值，午冲子）、第6爻兄弟子水/,
      );
      assert.match(
        prompt,
        /明伏分布：本卦明爻6爻，六亲为兄弟、子孙、官鬼、父母；伏神1爻：妻财伏第3爻午火，伏于官鬼辰土下/,
      );
      assert.doesNotMatch(prompt, /兄弟持世，主竞争、破财、朋友/);
      assert.doesNotMatch(prompt, /取用评分表|权重\d/);
      assert.match(prompt, /第1爻兄弟子水[^\n]*冲月建、日辰午，动，旬空，月破，日辰冲动/);
      assert.match(prompt, /第6爻兄弟子水[^\n]*冲月建、日辰午，旬空，月破，日冲成破/u);
      assert.match(
        prompt,
        /月日五行：[^\n]*第1爻兄弟子水克月建、日辰午火[^\n]*第6爻兄弟子水克月建、日辰午火/u,
      );
      assert.doesNotMatch(prompt, /月日触发：|未直接同支入爻/u);
      assert.match(prompt, /用神主线：事项用神待按具体问题取用/);
      assert.doesNotMatch(prompt, /应期资料：|组合时机：|六亲持世：|应爻与动变：/);
      assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界|只使用上方/);
      assert.doesNotMatch(prompt, /课传|盘局|牌阵|签诗|牌位/);
    } else if (item.method === 'meihua') {
      assert.doesNotMatch(prompt, /【分析思路】/);
      assert.match(prompt, /核心结构：主卦火风鼎；互卦泽天夬；变卦火山旅/);
      assert.match(prompt, /体用：体卦离（火）；用卦巽（木）；动爻第2爻；体用关系用生体/);
      assert.match(prompt, /互卦：泽天夬；原体克体互；原体克用互/);
      assert.match(prompt, /互卦泽天夬：体卦兑金，用卦乾金，关系比和/u);
      assert.match(prompt, /变卦火山旅：体卦离火，用卦艮土，关系体生用/);
      assert.match(prompt, /月令作用：子月令水克变后体卦离火，变后体卦为死/);
      assert.match(prompt, /月令作用：变后用卦艮土克子月令水，卦气耗用，变后用卦为囚/);
      assert.match(prompt, /主卦体用月令条件：体卦月令死、用卦月令相/);
      assert.match(prompt, /起卦法：数字起卦法/);
      assert.match(
        prompt,
        /起卦取数：数字123除8取余得上卦数3；时支辰序数5除8取余得下卦数5；数字123与时支序数相加除6取余得动爻2/,
      );
      assert.match(prompt, /动爻变化：主卦第2爻阳变阴；动爻位于下卦，用卦随之变化，体卦保持/);
      assert.doesNotMatch(prompt, /应期线索：/);
      assert.match(prompt, /主卦卦辞：火风鼎，元吉，亨/);
      assert.match(prompt, /动爻爻辞：第2爻，鼎有实，我仇有疾/);
      assert.doesNotMatch(prompt, /卦辞分类：|动爻传统资料：/);
      assert.doesNotMatch(prompt, /未发动，不展开爻辞解释/);
      assert.doesNotMatch(prompt, /第1爻（静，属体）：阳爻|结构明细：/);
      assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界/);
      assert.doesNotMatch(prompt, /体用评分：|类象权重：|\d+日内|\d+月左右/);
    } else if (item.method === 'tarot') {
      assert.match(prompt, /核心结构：牌阵/);
      assert.match(prompt, /牌位明细：/);
      assert.doesNotMatch(prompt, /牌位顺序：/);
      assert.match(prompt, /过去：恋人（正位）；关键词：/);
      assert.match(prompt, /现在：战车（逆位）；关键词：/);
      assert.match(prompt, /未来：力量（正位）；关键词：/);
      assert.match(prompt, /牌组属性：/);
      assert.match(prompt, /正逆位口径：逆位表示该牌主题可能受阻、过度、内化或方向偏离/);
      assert.doesNotMatch(prompt, /元素主题：|牌阶主题：/);
      assert.match(prompt, /基础牌义：/);
      assert.doesNotMatch(prompt, /断牌口径|现实边界|结构化证据|证据汇总|解释边界/);
      assert.doesNotMatch(
        prompt,
        /牌组层级|宫廷人物|叙事权重|元素数字|表示这些能量正在直接发挥作用|信息被隐藏/,
      );
      assert.match(prompt, /【补充信息】\n求测人：男；出生年份：1995/);
      assert.doesNotMatch(prompt, /起卦方式：数字起卦|起卦数字：123/);
    } else if (item.method === 'almanac') {
      const data = item.data as AlmanacData;
      assert.match(prompt, /候选日期：2026-06-01 至 2026-06-02/);
      assert.match(prompt, /核心结构：择日事项：搬家入宅/);
      assert.doesNotMatch(prompt, /事项范围：|日期结论：/);
      assert.doesNotMatch(prompt, /事项未限定|按通用.*口径|当前首列候选/);
      assert.doesNotMatch(prompt, /岁支十二神方位|全年方位神|岁支方位避|可参考太阳|可参考福德/);
      assert.match(prompt, /第1日：2026-06-01/);
      assert.match(prompt, /第2日：2026-06-02/);
      assert.ok(data.days.some((day) => prompt.includes(day.avoids.join('、'))));
      assert.ok(prompt.includes(data.days[0].recommends.join('、')));
      assert.ok(prompt.includes(data.days[0].avoids.join('、')));
      assert.doesNotMatch(prompt, /事项权重|优先匹配宜项|事项忌项命中|评分42|高分日期/);
      assert.doesNotMatch(prompt, /结构化证据|证据汇总|反证|解释边界/);
    } else if (item.method === 'ssgw') {
      assert.match(prompt, /签号：第18签/);
      assert.match(prompt, /签题：《第十八签 · 东施效颦，画虎类犬（凶）》/);
      assert.match(prompt, /签诗：东施效颦反增丑，画虎不成反类犬。/);
      assert.match(prompt, /吉凶级别：下签（凶）/);
      assert.match(prompt, /典故："东施效颦"出自《庄子·天运》/);
      assert.equal((prompt.match(/"东施效颦"出自《庄子·天运》/gu) ?? []).length, 1);
      assert.match(prompt, /基础解签：与其费力学别人走路，不如把自己脚下的路走稳/);
      assert.match(prompt, /补充解释：诗句取象：西施皱眉很美/);
      assert.doesNotMatch(
        prompt,
        /【当前时间】|【问题】|【任务】|占法：|行动建议|风险提醒|掷筊|签谱状态|来源状态|证据汇总/,
      );
    }
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
  assert.match(prompt, /【任务】\n依据体用、互卦、变卦与四时旺衰回答【问题】。/);
  assert.doesNotMatch(prompt, /【应期判断方法】/);
});

test('旧黄历正午历法事实失配时不进入在线提示词', () => {
  const data = createAlmanacData() as AlmanacData;
  data.days[0].ganzhi.day = '甲子';
  assert.throws(() => buildDivinationPrompt('almanac', '', data), /day.*请重新排盘/);
  assert.throws(() => formatDetailedDivinationInfo('almanac', data), /day.*请重新排盘/);
});

test('旧黄历宿曜附文不能覆盖在线提示词的重新计算依据', () => {
  const data = createAlmanacData() as AlmanacData;
  data.days[0].twentyEightStarDetail = {
    ...data.days[0].twentyEightStarDetail!,
    fullName: '伪造星宿',
    fortune: '必定大吉',
  };
  const prompt = buildDivinationPrompt('almanac', '', data);
  assert.doesNotMatch(prompt, /伪造星宿|必定大吉/);
});

test('旧黄历伪造宜项或事项结论时不进入在线提示词', () => {
  const data = createAlmanacData() as AlmanacData;
  data.days[0].recommends.push('伪宜项');
  assert.throws(() => buildDivinationPrompt('almanac', '', data), /原始宜忌.*请重新排盘/);

  data.days[0].recommends.pop();
  const topicFact = data.days[0].topicMatchFacts?.[0];
  assert.ok(topicFact);
  topicFact.promptText = '伪事项结论';
  assert.throws(() => buildDivinationPrompt('almanac', '', data), /事项匹配.*请重新排盘/);
});

test('择日提示词在有补充诉求时输出问题，空时不强制输出问题 section', () => {
  const prompt = buildDivinationPrompt(
    'almanac',
    '计划六月上旬签合作合同，希望兼顾资金安全和双方合作稳定。',
    createAlmanacData(),
  );

  assert.match(prompt, /【问题】\n计划六月上旬签合作合同，希望兼顾资金安全和双方合作稳定。/);
  assert.doesNotMatch(prompt, /【补充信息】/);
  assert.ok(
    findPromptSectionHeadingIndex(prompt, '【问题】') >
      findPromptSectionHeadingIndex(prompt, '【任务】'),
  );
});

test('大六壬提示词保留用户补充的现实信息', () => {
  const prompt = buildDivinationPrompt('liuren', '这件事接下来该怎么推进？', createData('liuren'), {
    gender: '男',
    birthYear: 1990,
    userSupplement: '正在考虑换工作，已经拿到一个新机会。',
    currentSituation: '正在考虑换工作，已经拿到一个新机会。',
    currentState: '时间紧、压力较大，但仍有一定选择空间。',
    knownFacts: '对方已明确报价，合同尚未签署。',
    desiredOutcome: '希望兼顾收入提升与长期稳定。',
    constraints: '三个月内不能搬家，预算上限为两万元。',
  });

  assert.match(prompt, /【补充信息】/);
  assert.match(prompt, /求测人：男；出生年份：1990/);
  assert.match(prompt, /现实背景：正在考虑换工作，已经拿到一个新机会。/);
  assert.match(prompt, /当前情况：正在考虑换工作，已经拿到一个新机会。/);
  assert.match(prompt, /当前状态：时间紧、压力较大，但仍有一定选择空间。/);
  assert.match(prompt, /已知事实：对方已明确报价，合同尚未签署。/);
  assert.match(prompt, /期望结果：希望兼顾收入提升与长期稳定。/);
  assert.match(prompt, /现实限制：三个月内不能搬家，预算上限为两万元。/);
  assert.ok(
    findPromptSectionHeadingIndex(prompt, '【补充信息】') <
      findPromptSectionHeadingIndex(prompt, '【排盘信息】'),
  );
});

test('占卜提示词的当前时间应来自起盘结果而不是运行环境当前时间', () => {
  const data = generateQimen(new Date('2025-01-01T08:30:00+08:00'));
  const prompt = buildDivinationPrompt('qimen', '这件事接下来该怎么推进？', data);

  assert.match(prompt, /【当前时间】\n公历：2025年1月1日 8时30分/);
  assert.doesNotMatch(prompt, /年年/);
});

test('奇门提示词会输出值符值使、旬空马星和格局资料', () => {
  const qimenData = createQimenPromptSample();
  const prompt = buildDivinationPrompt('qimen', '这次换工作该不该主动推进？', qimenData, {
    gender: '男',
    birthYear: 1995,
  });

  assert.match(prompt, /核心结构：阳遁7局；立夏 下元/);
  assert.match(prompt, /取用主线：/);
  assert.doesNotMatch(prompt, /。、|。；|；。|、、|；；/);
  assert.match(prompt, /值符值使与时干：值符天冲落巽四宫；值使伤门落乾六宫；时干丁/);
  assert.match(prompt, /离九宫（正南，火）：[^\n]*天盘丁，地盘庚/);
  assert.doesNotMatch(prompt, /同干定位：/);
  assert.match(prompt, /旬空与马星：旬空子空落坎一宫、丑空落艮八宫；马星巳时驿马在亥，落乾六宫/);
  assert.match(prompt, /^天遁（吉格，兑七宫）$/mu);
  assert.match(prompt, /兑七宫[^\n]*门生门[^\n]*神六合[^\n]*天盘壬、丙（丙为寄干），地盘戊/u);
  assert.doesNotMatch(prompt, /生门、丙奇、地盘戊同宫/u);
  assert.doesNotMatch(prompt, /主宫评分：|辅宫评分：|评分-?\d+|（-?\d+分|应期范围\d/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|反证|解释边界/);
  assert.doesNotMatch(prompt, /问事参考/);
  assert.doesNotMatch(prompt, /卦象|课传|牌阵|签诗|牌位/);
});

test('奇门提示词保留节令关系并省略重复的四柱互动明细', () => {
  const data = createQimenPromptSample();
  const prompt = buildDivinationPrompt('qimen', '整体解读', data);

  assert.match(prompt, /日干癸持平/);
  assert.doesNotMatch(prompt, /四柱互动：/);
  assert.doesNotMatch(prompt, /neutral|天干相冲癸、丁/);
});

test('Issue #204：奇门提示词应统一正式定局三元并补齐年命落宫', () => {
  const data = generateQimen(new Date('2026-08-08T15:14:00+08:00'), 'zhuanpan', 'hour', 'chaibu');
  const prompt = buildDivinationPrompt('qimen', '整体解读', data, { birthYear: 1989 });

  assert.equal(data.ganzhi.day, '甲寅');
  assert.equal(data.timeInfo.solarTerm, '立秋');
  assert.equal(data.timeInfo.epoch, '中元');
  assert.equal(data.isYangDun, false);
  assert.equal(data.juShu, 5);
  assert.match(prompt, /核心结构：阴遁5局；立秋 中元/);
  assert.doesNotMatch(prompt, /立秋上元/);
  assert.doesNotMatch(prompt, /。、|。；|；。|、、|；；/);
  assert.match(prompt, /年命资料：公历1989年按年中口径取年命干支己巳，命干己/);
  assert.match(prompt, /立春前出生则取年命干支戊辰，命干戊/);
  assert.doesNotMatch(prompt, /【补充信息】/);
  assert.match(
    prompt,
    /年命落宫（年中口径）：命干己落.+宫（.+；八门.+、九星.+、八神.+、天盘.+、地盘.+）/,
  );
});

test('奇门年命资料应处理六甲遁干，未填写出生年份时不输出', () => {
  const data = generateQimen(new Date('2026-08-08T15:14:00+08:00'));
  const withBirthYear = buildDivinationPrompt('qimen', '整体解读', data, { birthYear: 1984 });
  const withoutBirthYear = buildDivinationPrompt('qimen', '整体解读', data);

  assert.match(withBirthYear, /公历1984年按年中口径取年命干支甲子，命干甲/);
  assert.match(withBirthYear, /年命落宫（年中口径）：命干甲遁戊落.+宫/);
  assert.doesNotMatch(withoutBirthYear, /年命资料|年命落宫/);
});

test('奇门提示词不再根据问题词表输出问事参考', () => {
  const data = createQimenPromptSample();

  const prompt = buildDivinationPrompt('qimen', '这次换工作该不该主动推进？', data, {
    gender: '男',
    birthYear: 1995,
  });

  assert.doesNotMatch(prompt, /问事参考/);
  assert.doesNotMatch(prompt, /事业参考|首看开门|兼看生门/);
  assert.match(prompt, /值符值使与时干：值符天冲落巽四宫；值使伤门落乾六宫/);
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
  assert.match(prompt, /世应：/);
  assert.match(prompt, /六爻全表：[\s\S]*第1爻/);
  assert.doesNotMatch(prompt, /^动变：/m);
  assert.doesNotMatch(prompt, /应爻与动变：|应期资料：/);
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

test('每种塔罗牌阵都应输出专属解读主线、牌位联动与结论重点', () => {
  const expectedFocus: Record<keyof typeof tarotSpreads, RegExp> = {
    single: /唯一牌位/,
    three: /背景、当前表现与后续主题/,
    love: /双方视角/,
    career: /事业现状/,
    decision: /选择A、选择B/,
    celtic: /当前与阻碍/,
    chakra: /海底轮到顶轮/,
    year: /全年主题/,
    mindBodySpirit: /思想、身体行动与精神状态/,
    horseshoe: /过去、现在、未来展开/,
    holyTriangle: /问题根源、当前状况与发展结果/,
    universal: /阻力、资源、行动与发展趋势/,
    fourElements: /火、水、风、土/,
    hexagram: /隐藏因素/,
    relationship: /双方视角、需求/,
    wealth: /收入机会、支出风险/,
    problemSolving: /问题表象、成因线索/,
    twelveHouses: /依十二宫逐一分析/,
  };

  for (const spreadType of Object.keys(tarotSpreads) as Array<keyof typeof tarotSpreads>) {
    const prompt = buildDivinationPrompt(
      'tarot',
      '请解读当前问题。',
      drawTarotSpread(spreadType, { seed: `牌阵框架-${spreadType}` }),
    );
    assert.match(prompt, expectedFocus[spreadType], `${spreadType} 应包含专属主线`);
    if (spreadType === 'celtic') {
      assert.match(prompt, /目标与潜能/);
      assert.match(prompt, /现实基础/);
      assert.match(prompt, /过去影响和近期未来牌位/);
      assert.match(prompt, /希望与恐惧/);
    }
    if (spreadType === 'single') {
      assert.doesNotMatch(prompt, /牌序组合|牌序互动|相邻牌|牌位联动/);
    } else {
      assert.match(prompt, /解读主线：/);
      assert.match(prompt, /牌位联动：/);
      assert.match(prompt, /结论重点：/);
    }
  }
});

test('塔罗最终任务以事实和现实条件核对因果、关系、健康与财务主题', () => {
  const cases = [
    ['three', /背景、当前表现与后续主题/],
    ['love', /关系视角的象征线索/],
    ['year', /健康牌位/],
    ['holyTriangle', /根源线索与当前牌位的主题呼应/],
    ['problemSolving', /成因线索与表象、阻力牌位的主题关联/],
    ['relationship', /双方视角、需求、关系核心与走向牌位/],
    ['wealth', /已提供的收支信息/],
  ] as const;

  for (const [spreadType, expectedTask] of cases) {
    const prompt = buildDivinationPrompt(
      'tarot',
      '请结合当前情况解读。',
      drawTarotSpread(spreadType, { seed: `塔罗任务边界-${spreadType}` }),
    );
    const task = prompt.match(/【任务】\n([\s\S]*?)\n\n【问题】/)?.[1];

    assert.ok(task, `${spreadType} 应进入最终提示词任务段`);
    assert.match(task, expectedTask, `${spreadType} 应保留牌阵用途`);
    assert.match(task, /可观察的?信息/);
    assert.match(task, /现实条件/);
    assert.equal(task.match(/现实核对/g)?.length, 1);
    if (spreadType === 'love' || spreadType === 'relationship') {
      assert.match(task, /关系视角的象征线索/);
    }
    if (spreadType === 'year') {
      assert.match(task, /身心照料的象征主题/);
    }
    assert.doesNotMatch(
      task,
      /过去如何形成现在|现在又如何推动或改变未来|判断双方内心|分别判断双方内心|根因如何造成表象|医疗诊断|预测疾病/,
    );
  }
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
  const data = generateLiuren(new Date('2025-06-18T10:30:00+08:00'));
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    data,
    createSupplementaryInfo(),
  );

  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /核心结构：月将.+；占时.+；(?:昼占|夜占)；贵人.+；旬空/);
  assert.match(prompt, /课传主线：传态/);
  assert.doesNotMatch(prompt, /取传依据：/);
  assert.match(prompt, /四课：\n  一课/);
  assert.match(prompt, /三传：\n  初传/);
  assert.doesNotMatch(prompt, /课传主线：.*发用|课传主线：.*末传/);
  assert.doesNotMatch(prompt, /主虚而不实/);
  assert.doesNotMatch(prompt, /断课抓手：/);
  assert.doesNotMatch(prompt, /发用主线：/);
  assert.doesNotMatch(prompt, /天将属性：|取传规则全文/);
});

test('大六壬旧盘缺天地盘时任务只引用可核对的起课资料', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    createData('liuren'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /【传统依据】\n大六壬以月将加临占时定天地盘。/);
  assert.match(prompt, /【任务】\n依据本次起课四柱、月将、占时及可核对的时间资料回答【问题】。/);
  assert.doesNotMatch(prompt, /四课：|三传：|课体：|神煞：/);
  assert.doesNotMatch(prompt, /【输出要求】/);
  assert.doesNotMatch(prompt, /反证限制|证据不足|不硬给日期|取证顺序|回答口径/);
});

test('大六壬提示词保留课体与精简神煞摘要', () => {
  const data = generateLiuren(new Date('2025-06-18T10:30:00+08:00'));
  assert.ok(data.guaTi?.length);
  assert.ok(data.shenShaSummary?.length);
  data.guaTiFacts = undefined;
  data.evidenceAnalysis = undefined;

  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    data,
    createSupplementaryInfo(),
  );

  assert.ok(prompt.includes(`课体：${data.guaTi.join('、')}`));
  assert.ok(prompt.includes(`神煞：${data.shenShaSummary.slice(0, 6).join('、')}`));
  assert.ok(prompt.includes(`神煞附录：${data.shenShaSummary.slice(6).join('、')}`));
  for (const fact of data.shenShaFacts ?? []) assert.doesNotMatch(prompt, new RegExp(fact.rule));
  assert.doesNotMatch(prompt, /辅证：/);
  assert.doesNotMatch(prompt, /课体补充：/);
  assert.doesNotMatch(prompt, /神煞补充：/);
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

test('小六壬提示词保留可复核顺数，并明确只有时宫承担主证', () => {
  const data = generateXiaoliuren({ customDate: new Date('2026-05-19T10:30:00+08:00') });
  const prompt = buildDivinationPrompt(
    'xiaoliuren',
    '这件事接下来如何发展？',
    data,
    createSupplementaryInfo(),
  );

  assert.match(prompt, /起课：农历.+，巳时/);
  assert.match(prompt, /起课过程：/);
  assert.match(prompt, /定月宫：.+月从大安顺数，落/);
  assert.match(prompt, /定日宫：从月宫.+起初一（.+），顺数至.+日，落/);
  assert.match(prompt, /定时宫：从日宫空亡起子时，顺数至巳时/u);
  assert.doesNotMatch(prompt, /定位用途：/u);
  assert.match(prompt, /占得宫：小吉/);
  assert.doesNotMatch(prompt, /定时宫：[^\n]*落小吉/u);
  assert.match(prompt, /历法口径：东八区民用日零点换日；闰月沿用同名月序/);
  assert.doesNotMatch(prompt, /mod\s*6|时序\d+/);
  assert.doesNotMatch(prompt, /五行生克与落宫方位/);
});

test('雷诺曼提示词保留逐牌基础牌义与真实布局，不扩写普通牌序为固定组合', () => {
  const singlePrompt = buildDivinationPrompt(
    'lenormand',
    '这件事接下来如何发展？',
    drawLenormandSpread('single', { seed: '提示词完整性-单牌' }),
  );
  assert.match(singlePrompt, /唯一牌位与基础牌义/);
  assert.doesNotMatch(singlePrompt, /相邻牌|组合意象|牌序互动|牌序组合/);

  const fivePrompt = buildDivinationPrompt(
    'lenormand',
    '这件事接下来如何发展？',
    drawLenormandSpread('five', { seed: '提示词完整性-五牌' }),
  );
  assert.match(fivePrompt, /基础牌义：/);
  assert.doesNotMatch(fivePrompt, /主题牌/);
  assert.doesNotMatch(fivePrompt, /固定组合：[\s\S]*牌序相邻|相邻牌义合读/);

  const reverseData = drawLenormandSpread('three', { manualCardIds: [31, 32, 8] });
  const reversePrompt = buildDivinationPrompt('lenormand', '这件事接下来如何发展？', reverseData);
  assert.equal(reverseData.combinations?.[0].source, '相邻牌义合读');
  assert.match(reversePrompt, /起因：太阳；关键词：成功、清晰、能量/);
  assert.match(reversePrompt, /现状：月亮；关键词：情绪、名声、直觉/);
  assert.doesNotMatch(reversePrompt, /相邻合读：|从迷茫走向清晰|登记判词/);

  const fixedPrompt = buildDivinationPrompt(
    'lenormand',
    '这件事接下来如何发展？',
    drawLenormandSpread('three', { manualCardIds: [24, 25, 1] }),
  );
  assert.match(fixedPrompt, /固定组合：\n  心\+戒指：/);

  const ninePrompt = buildDivinationPrompt(
    'lenormand',
    '这件事的核心和路径是什么？',
    drawLenormandSpread('nine', { manualCardIds: [1, 2, 3, 4, 5, 6, 7, 8, 9] }),
  );
  assert.match(ninePrompt, /布局关系：/);
  assert.match(ninePrompt, /九宫第2排第2列的中心位置为/);
  assert.match(ninePrompt, /左上至右下对角线依次为/);

  const grandTableauPrompt = buildDivinationPrompt(
    'lenormand',
    '这件事的整体布局是什么？',
    drawLenormandSpread('grandTableau', {
      manualCardIds: Array.from({ length: 36 }, (_, index) => index + 1),
    }),
  );
  const firstGrandTableauCard = grandTableauPrompt
    .split('\n')
    .find((line) => line.includes('第1宫（骑士宫）：骑士；'));
  assert.ok(firstGrandTableauCard);
  assert.match(firstGrandTableauCard, /第1排第1列/);
  assert.doesNotMatch(firstGrandTableauCard, /落骑士宫/);
});

test('星盘提示词应直接给出太阳月亮上升和主要相位资料', () => {
  const prompt = buildDivinationPrompt(
    'astrolabe',
    '这件事接下来该怎么推进？',
    createAstrolabeData(),
  );

  assert.match(prompt, /上升：狮子座 12°/);
  assert.match(prompt, /太阳金牛座 29°，第10宫/);
  assert.match(prompt, /月亮处女座 08°，第2宫/);
  assert.doesNotMatch(prompt, /核心位置：/);
  assert.doesNotMatch(prompt, /格局：土象偏强|十大星体格局：/);
  assert.doesNotMatch(prompt, /逆行星体无/);
  assert.match(prompt, /相位明细：/);
  assert.doesNotMatch(prompt, /强度\d+%/);
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

  for (const scopeText of [
    '太阳返照有效期：2028-01-01 至 2029-01-01。',
    '次限相位：太阳与月亮成拱，偏差0.50°。',
    '太阳弧相位：金星与太阳成合，偏差0.40°。',
  ]) {
    const appPrompt = buildDivinationPrompt(
      'astrolabe',
      '我现在适合换工作吗？',
      astrolabeData,
      undefined,
      { astrolabeTopic: 'job-change', astrolabeScopeText: scopeText },
    );
    const corePrompt = buildCoreDivinationPrompt({
      method: 'astrolabe',
      data: astrolabeData,
      question: '我现在适合换工作吗？',
      astrolabeTopic: 'job-change',
      astrolabeScopeText: scopeText,
    });
    for (const scopedPrompt of [appPrompt, corePrompt]) {
      assert.ok(scopedPrompt.includes(scopeText));
      const task = scopedPrompt.split('【任务】\n')[1]?.split('\n\n【问题】')[0];
      assert.ok(task);
      assert.match(task, /本次已列星象和时限资料/u);
      assert.doesNotMatch(task, /四类证据|普通行运|太阳返照|次限|太阳弧/u);
      assertPromptIsPortableTaskText(scopedPrompt);
    }
  }
});
