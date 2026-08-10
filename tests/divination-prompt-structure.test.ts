import test from 'node:test';
import assert from 'node:assert/strict';
import { taiyi } from 'mingyu-core';

import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { generateQimen } from '../packages/core/src/divination/algorithms/qimen/index.ts';
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
  SupplementaryInfo,
} from '../src/types';

type FixtureMethod = 'liuyao' | 'meihua' | 'qimen' | 'liuren' | 'tarot' | 'ssgw';

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
  const expectedSections = ['【传统依据】', '【当前时间】', '【占卜信息】', '【问题】', '【任务】'];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.match(prompt, /占法：/);
  assert.doesNotMatch(prompt, /你是资深|【要求】|取证顺序|回答口径|证据边界|【输出要求】/);
  assertPromptIsPortableTaskText(prompt);
}

function assertSsgwPromptStructure(prompt: string) {
  const expectedSections = ['【当前时间】', '【占卜信息】', '【问题】', '【任务】'];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });
  assert.doesNotMatch(prompt, /^【传统依据】$/m);
  assert.match(prompt, /占法：三山国王灵签/);
  assert.match(prompt, /签号：第\d+签/);
  assert.match(prompt, /签题：/);
  assert.match(prompt, /签诗：/);
  assert.match(prompt, /吉凶级别：/);
  assert.match(prompt, /典故：/);
  assert.match(prompt, /基础解签：/);
  assert.match(prompt, /补充解释：/);
  assertPromptIsPortableTaskText(prompt);
}

function assertLiurenPromptStructure(prompt: string) {
  const expectedSections = [
    '【传统依据】',
    '【当前时间】',
    '【排盘信息】',
    '【分析对象】',
    '【问题】',
    '【问题范围】',
    '【任务】',
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
      return {
        originalName: '乾为天',
        changedName: '坤为地',
        interName: '风山渐',
        ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
        timestamp: Date.now(),
        yaoArray: [9, 7, 8, 8, 7, 6],
        changingYaos: [
          { position: 1, isChanging: true, type: '老阳' },
          { position: 6, isChanging: true, type: '老阴' },
        ],
        sixGods: ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'],
        sixRelatives: ['兄弟', '子孙', '妻财', '官鬼', '父母', '兄弟'],
        najiaDizhi: ['子', '寅', '辰', '午', '申', '戌'],
        wuxing: ['水', '木', '土', '火', '金', '土'],
        worldAndResponse: ['世', '', '', '', '', '应'],
        voidBranches: ['戌', '亥'],
        palace: { name: '乾', wuxing: '金' },
        palaceStage: '首卦',
        yaosDetail: [
          {
            position: 1,
            yaoType: '阳',
            isChanging: true,
            rawValue: 9,
            changeType: '老阳',
            sixGod: '青龙',
            sixRelative: '兄弟',
            najiaDizhi: '子',
            wuxing: '水',
            isWorld: true,
            isResponse: false,
            isVoid: false,
            changedYao: null,
          },
          {
            position: 2,
            yaoType: '阳',
            isChanging: false,
            rawValue: 7,
            changeType: '',
            sixGod: '朱雀',
            sixRelative: '子孙',
            najiaDizhi: '寅',
            wuxing: '木',
            isWorld: false,
            isResponse: false,
            isVoid: false,
            changedYao: null,
          },
          {
            position: 3,
            yaoType: '阴',
            isChanging: false,
            rawValue: 8,
            changeType: '',
            sixGod: '勾陈',
            sixRelative: '妻财',
            najiaDizhi: '辰',
            wuxing: '土',
            isWorld: false,
            isResponse: false,
            isVoid: false,
            changedYao: null,
          },
          {
            position: 4,
            yaoType: '阴',
            isChanging: false,
            rawValue: 8,
            changeType: '',
            sixGod: '螣蛇',
            sixRelative: '官鬼',
            najiaDizhi: '午',
            wuxing: '火',
            isWorld: false,
            isResponse: false,
            isVoid: false,
            changedYao: null,
          },
          {
            position: 5,
            yaoType: '阳',
            isChanging: false,
            rawValue: 7,
            changeType: '',
            sixGod: '白虎',
            sixRelative: '父母',
            najiaDizhi: '申',
            wuxing: '金',
            isWorld: false,
            isResponse: false,
            isVoid: false,
            changedYao: null,
          },
          {
            position: 6,
            yaoType: '阴',
            isChanging: true,
            rawValue: 6,
            changeType: '老阴',
            sixGod: '玄武',
            sixRelative: '兄弟',
            najiaDizhi: '戌',
            wuxing: '土',
            isWorld: false,
            isResponse: true,
            isVoid: true,
            changedYao: null,
          },
        ],
        hiddenSpirits: [
          {
            sixRelative: '子孙',
            position: 2,
            najiaDizhi: '寅',
            wuxing: '木',
            isVoid: false,
            underYao: {
              position: 2,
              sixRelative: '子孙',
              najiaDizhi: '寅',
              wuxing: '木',
            },
          },
        ],
        hexagramRelations: {
          original: '六冲卦',
          changed: '六冲卦',
          transition: '六冲变六冲',
        },
        fanfuRelations: {
          fanyin: [
            {
              kind: '卦反吟',
              scope: '内外',
              label: '内外反吟',
              description: '内卦乾变巽，外卦乾变巽，按乾巽、坎离、震兑、坤艮相变',
            },
          ],
          fuyin: [],
          labels: ['内外反吟'],
        },
        specialPattern: '全动卦',
        specialAdvice: '宜统观全局，不宜逐爻碎断。',
      };
    case 'meihua':
      return {
        originalName: '雷火丰',
        changedName: '地火明夷',
        interName: '泽风大过',
        ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
        timestamp: Date.now(),
        tiGua: { name: '离', element: '火', nature: '明' },
        yongGua: { name: '震', element: '木', nature: '动' },
        changedTiGua: { name: '坤', element: '土', nature: '顺' },
        changedYongGua: { name: '离', element: '火', nature: '明' },
        interTiGua: { name: '兑', element: '金', nature: '泽' },
        interYongGua: { name: '巽', element: '木', nature: '风' },
        movingYao: { position: 3, description: '三爻发动', yaoName: '九三' },
        analysis: {
          season: '春',
          tiYongRelation: '用生体，主有助力',
          tiSeasonState: '相',
          yongSeasonState: '旺',
          inter1Relation: '原体克体互',
          inter2Relation: '用互生原体',
          changedRelation: '体生变，后续需付出',
          changedTiYongRelation: '体克用',
        },
        mainHexagram: {
          name: '雷火丰',
          symbol: '䷶',
          upper: '震',
          lower: '离',
          description: '先盛后谨',
          yaoCi: ['初爻背景', '二爻背景', '三爻发动取象', '四爻背景', '五爻背景', '上爻背景'],
          movingYaoCi: '三爻发动取象',
        },
        interHexagram: {
          name: '泽风大过',
          symbol: '䷛',
          upper: '兑',
          lower: '巽',
          description: '中间承压',
        },
        changedHexagram: {
          name: '地火明夷',
          symbol: '䷣',
          upper: '坤',
          lower: '离',
          description: '宜守光待时',
        },
        yaosDetail: [
          { position: 1, yaoType: '阳', isChanging: false, tiYong: '体' },
          { position: 2, yaoType: '阴', isChanging: false, tiYong: '体' },
          { position: 3, yaoType: '阳', isChanging: true, tiYong: '体' },
          { position: 4, yaoType: '阳', isChanging: false, tiYong: '用' },
          { position: 5, yaoType: '阴', isChanging: false, tiYong: '用' },
          { position: 6, yaoType: '阴', isChanging: false, tiYong: '用' },
        ],
        calculation: {
          method: 'number',
          methodKey: 'number',
          number: 123,
        },
      };
    case 'qimen':
      return {
        jiuGongGe: [
          {
            gong: 1,
            name: '坎一宫',
            direction: '北',
            element: '水',
            tianPan: { star: '天蓬', stem: '壬' },
            diPan: { stem: '癸' },
            renPan: { door: '休门' },
            shenPan: { god: '值符' },
          },
          {
            gong: 9,
            name: '离九宫',
            direction: '南',
            element: '火',
            tianPan: { star: '天英', stem: '丙' },
            diPan: { stem: '丁' },
            renPan: { door: '景门' },
            shenPan: { god: '九天' },
          },
        ],
        ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
        isYangDun: true,
        juShu: 3,
        zhiFu: '天蓬',
        zhiShi: '休门',
        patternTags: ['门生宫', '星旺'],
        patternDetails: [{ tag: '门生宫', summary: '休门得地，利于稳步推进' }],
        palaceInsights: [{ gong: 1, name: '坎一宫', level: '有利', summary: '适合谋划与沟通' }],
        voidBranches: ['子', '丑'],
        voidPalaces: [
          { branch: '子', palace: 1, name: '坎一宫' },
          { branch: '丑', palace: 8, name: '艮八宫' },
        ],
        horseStar: {
          sourceBranch: '卯',
          branch: '巳',
          palace: 4,
          name: '巽四宫',
        },
        timeInfo: { solarTerm: '春分', epoch: '上元' },
        timestamp: Date.now(),
      };
    case 'liuren':
      return {
        ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
        timestamp: Date.now(),
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
        spreadType: 'single',
        spreadName: '单牌指引',
        cards: [
          {
            id: 1,
            name: '恋人',
            position: '现状',
            reversed: false,
            keywords: ['选择', '连接'],
            element: '大阿卡纳（核心课题与阶段转折）',
            archetype: '大阿卡纳的人生主轴',
          },
          {
            id: 2,
            name: '战车',
            position: '建议',
            reversed: true,
            keywords: ['控制', '节奏'],
            element: '大阿卡纳（核心课题与阶段转折）',
            archetype: '大阿卡纳的人生主轴',
          },
        ],
        timestamp: Date.now(),
      };
    case 'ssgw':
      return {
        number: 18,
        title: '刘备借荆州',
        poem: '前路迢迢莫强求，且看云开月自明。',
        story: '刘备向东吴借取荆州。',
        details: {
          吉凶: '中平签',
          核心寓意: '事情仍有转圜空间，宜结合现况审慎研判。',
          事业: '先核对资源与时机。',
          行动建议: '暂缓推进。',
          风险提醒: '留意反复。',
        },
        timestamp: Date.now(),
        ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
      };
  }
}

function createAlmanacData(): DivinationData {
  return {
    topic: 'move',
    topicLabel: '搬家入宅',
    startDate: '2026-06-01',
    endDate: '2026-06-03',
    timestamp: Date.now(),
    participants: [
      {
        id: 'self',
        name: '本人',
        gender: '男',
        solarDate: '1990-01-01',
        lunarDate: '腊月初五',
        zodiac: '蛇',
        constellation: '摩羯座',
        dayMaster: '丙',
        dayMasterElement: '火',
        pillars: { year: '己巳', month: '丙子', day: '丙寅', hour: '甲午' },
        usefulGods: ['木', '火'],
        avoidGods: ['水'],
      },
    ],
    days: [
      {
        date: '2026-06-01',
        weekday: '星期一',
        lunarDate: '四月十六',
        ganzhi: { year: '丙午', month: '癸巳', day: '丙午' },
        zodiac: '马',
        dayOfficer: '除',
        twelveStar: '建',
        twentyEightStar: '张',
        nineStar: '一白',
        gods: ['天德', '月德'],
        recommends: ['入宅', '移徙', '安床'],
        avoids: ['开市'],
        pengZu: '丙不修灶',
        clash: '冲鼠，煞北',
        annualDirectionGods: [
          {
            god: '太岁',
            branch: '午',
            direction: '正南',
            fortune: '凶',
            meaning: '犯太岁防宅长大凶',
          },
          {
            god: '太阳',
            branch: '未',
            direction: '西南偏南',
            fortune: '吉',
            meaning: '修太阳能制诸煞',
          },
          {
            god: '岁破',
            branch: '子',
            direction: '正北',
            fortune: '凶',
            meaning: '犯岁破忧宅母',
          },
          {
            god: '福德',
            branch: '卯',
            direction: '正东',
            fortune: '吉',
            meaning: '修福德主添丁生子',
          },
        ],
        score: 86,
        highlights: ['黄历宜项命中搬家入宅'],
        cautions: [],
        participantNotes: ['本人：未见直接刑冲破害提醒'],
      },
      {
        date: '2026-06-02',
        weekday: '星期二',
        lunarDate: '四月十七',
        ganzhi: { year: '丙午', month: '癸巳', day: '丁未' },
        zodiac: '羊',
        dayOfficer: '满',
        twelveStar: '除',
        twentyEightStar: '翼',
        nineStar: '二黑',
        gods: ['天恩'],
        recommends: ['祭祀'],
        avoids: ['入宅', '移徙'],
        pengZu: '丁不剃头',
        clash: '冲牛，煞西',
        score: 42,
        highlights: [],
        cautions: ['黄历忌项触及搬家入宅'],
        participantNotes: ['本人：未见直接刑冲破害提醒'],
      },
    ],
  };
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
      assertPromptHasSingleRole(prompt, undefined, { requireTraditionalGuidance: false });
      assertSsgwPromptStructure(prompt);
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

test('非命盘占法不再附加独立的方法论与应期控制段落', () => {
  const cases: Array<{
    method: Exclude<DivinationType, 'tarot_single' | 'astrolabe'>;
    data: DivinationData;
  }> = [
    { method: 'liuyao', data: createData('liuyao') },
    { method: 'meihua', data: createData('meihua') },
    { method: 'qimen', data: createData('qimen') },
    { method: 'liuren', data: createData('liuren') },
    { method: 'tarot', data: createData('tarot') },
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
  assert.match(prompt, /核心结构：择日事项：搬家入宅/);
  assert.doesNotMatch(prompt, /事项范围：|日期结论：|可用候选|慎用候选/);
  assert.doesNotMatch(prompt, /事项未限定|按通用.*口径|当前首列候选/);
  assert.doesNotMatch(prompt, /岁支十二神方位|全年方位神|岁支方位避|可参考太阳|可参考福德/);
  assert.match(prompt, /第1候选：2026-06-01/);
  assert.match(prompt, /第2候选：2026-06-02/);
  assert.match(prompt, /忌入宅、移徙/);
  assert.doesNotMatch(prompt, /事项权重|优先匹配宜项|事项忌项命中|评分42|高分日期/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|反证|解释边界/);
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
    findPromptSectionHeadingIndex(prompt, '【问题】') <
      findPromptSectionHeadingIndex(prompt, '【任务】'),
  );
});

test('占卜提示词不写入输出要求或行动建议', async () => {
  const session = buildDivinationPrompt(
    'qimen',
    '这件事接下来该怎么推进？',
    createData('qimen'),
    createSupplementaryInfo(),
  );

  assert.doesNotMatch(session, /【输出要求】|使用简体中文|现实建议|行动建议|行动清单/);
  assert.match(session, /【任务】/);
});

test('非对应占法不混入梅花设置或通用出生资料', () => {
  const prompt = buildDivinationPrompt(
    'tarot',
    '这件事接下来该怎么推进？',
    createData('tarot'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /【占卜信息】/);
  assert.doesNotMatch(prompt, /【补充信息】/);
  assert.doesNotMatch(prompt, /性别：男|出生年份：1995/);
  assert.doesNotMatch(prompt, /起卦方式：数字起卦|起卦数字：123/);
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
  assert.doesNotMatch(prompt, /性别：男|出生年份：1990/);
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
  const data = {
    ...createData('qimen'),
    timestamp: Date.parse('2025-01-01T08:30:00+08:00'),
  };
  const prompt = buildDivinationPrompt('qimen', '这件事接下来该怎么推进？', data);

  assert.match(prompt, /【当前时间】\n公历：2025年1月1日 8时30分/);
  assert.doesNotMatch(prompt, /年年/);
});

test('奇门提示词会输出值符值使、旬空马星和格局资料', () => {
  const qimenData = {
    ...createData('qimen'),
    classicPatterns: [
      {
        name: '太白入荧',
        type: 'bad' as const,
        score: -18,
        summary: '庚加丙主阻力外显。',
        palaces: [9],
      },
    ],
    stemRelations: [
      {
        gong: 9,
        heavenStem: '庚',
        earthStem: '丙',
        relation: '金火相战',
        pattern: '太白入荧',
      },
    ],
  };
  const prompt = buildDivinationPrompt('qimen', '这次换工作该不该主动推进？', qimenData, {
    gender: '男',
    birthYear: 1995,
  });

  assert.match(prompt, /核心结构：阳遁3局；[^\n]+/);
  assert.match(prompt, /取用主线：/);
  assert.doesNotMatch(prompt, /。、|。；|；。|、、|；；/);
  assert.match(prompt, /值符值使与时干：值符天蓬落坎一宫；值使休门落坎一宫；时干丁见于离九宫/);
  assert.match(prompt, /旬空与马星：旬空子空落坎一宫、丑空落艮八宫；马星卯时驿马在巳，落巽四宫/);
  assert.match(prompt, /太白入荧/);
  assert.doesNotMatch(prompt, /主宫评分：|辅宫评分：|评分-?\d+|（-?\d+分|应期范围\d/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|反证|解释边界/);
  assert.doesNotMatch(prompt, /问事参考/);
  assert.doesNotMatch(prompt, /卦象|课传|牌阵|签诗|牌位/);
});

test('奇门提示词保留节令关系并省略重复的四柱互动明细', () => {
  const data = generateQimen(new Date('2026-05-19T10:30:00+08:00'));
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
  assert.ok(Math.max(...prompt.split('\n').map((line) => line.length)) < 200);
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
  const data = {
    ...createData('qimen'),
    jiuGongGe: [
      ...createData('qimen').jiuGongGe,
      {
        gong: 6,
        name: '乾六宫',
        direction: '西北',
        element: '金',
        tianPan: { star: '天心', stem: '辛' },
        diPan: { stem: '庚' },
        renPan: { door: '开门' },
        shenPan: { god: '六合' },
      },
      {
        gong: 8,
        name: '艮八宫',
        direction: '东北',
        element: '土',
        tianPan: { star: '天任', stem: '戊' },
        diPan: { stem: '己' },
        renPan: { door: '生门' },
        shenPan: { god: '九地' },
      },
    ],
  } satisfies DivinationData;

  const prompt = buildDivinationPrompt('qimen', '这次换工作该不该主动推进？', data, {
    gender: '男',
    birthYear: 1995,
  });

  assert.doesNotMatch(prompt, /问事参考/);
  assert.doesNotMatch(prompt, /事业参考|首看开门|兼看生门/);
  assert.match(prompt, /值符值使与时干：值符天蓬落坎一宫；值使休门落坎一宫/);
});

test('六爻提示词会保留世应、动变、空亡、伏神和月日资料', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这件事接下来该怎么推进？',
    createData('liuyao'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /核心结构：主卦/);
  assert.match(prompt, /世应：世爻第1爻兄弟子水；应爻第6爻兄弟戌土/);
  assert.match(prompt, /动变：第1爻兄弟子水/);
  assert.match(prompt, /旬空戌、亥；命中.+；伏神/);
  assert.doesNotMatch(prompt, /兄弟持世，主竞争、破财、朋友/);
  assert.doesNotMatch(prompt, /取用评分表|权重\d/);
  assert.match(
    prompt,
    /月日触发：月建丑：未直接同支入爻；日辰寅：同支第2爻子孙寅木，冲第5爻父母申金/,
  );
  assert.match(prompt, /用神：/);
  assert.doesNotMatch(prompt, /应期资料：|组合时机：|六亲持世：|应爻与动变：/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界|只使用上方/);
  assert.doesNotMatch(prompt, /课传|盘局|牌阵|签诗|牌位/);
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
  assert.match(prompt, /动变：/);
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

  assert.match(prompt, /体用：体卦离（火）；用卦震（木）；动爻第3爻；体用关系用生体/);
  assert.match(prompt, /互卦：泽风大过；体互兑（金）；用互巽（木）；原体克体互；用互生原体/);
  assert.match(prompt, /变卦：地火明夷；变后体卦坤（土）；变后用卦离（火）；变后体用体克用/);
  assert.match(prompt, /月令与起卦：春季，体卦相，用卦旺；起卦法数字起卦法；起卦数字123/);
  assert.match(prompt, /应期线索：动爻第3爻；春季体卦相、用卦旺/);
  assert.doesNotMatch(prompt, /卦辞分类：|动爻传统资料：/);
  assert.doesNotMatch(prompt, /未发动，不展开爻辞解释/);
  assert.doesNotMatch(prompt, /第1爻（静，属体）：阳爻|结构明细：/);
  assert.doesNotMatch(prompt, /结构化证据|证据汇总|解释边界/);
  assert.doesNotMatch(prompt, /体用评分：|类象权重：|\d+日内|\d+月左右/);
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
});

test('梅花、奇门不再输出隐藏专项分析思路', () => {
  for (const method of ['meihua', 'qimen'] as const) {
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
  assert.match(prompt, /核心结构：月将亥；占时卯；昼占；贵人亥临卯；旬空戌、亥（命中初传亥）/);
  assert.match(prompt, /课传主线：取传比用法；传态递传/);
  assert.doesNotMatch(prompt, /取传依据：/);
  assert.match(prompt, /四课：\n- 一课亥临卯乘贵人，水生木/);
  assert.match(prompt, /三传：\n- 初传亥乘贵人，生扶/);
  assert.doesNotMatch(prompt, /课传主线：.*发用|课传主线：.*末传/);
  assert.doesNotMatch(prompt, /主虚而不实/);
  assert.doesNotMatch(prompt, /断课抓手：/);
  assert.doesNotMatch(prompt, /发用主线：/);
  assert.doesNotMatch(prompt, /地盘：|天盘：|天将属性：|取传规则全文/);
});

test('大六壬提示词使用简短任务', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    createData('liuren'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /【任务】\n依据月将、四课、三传、天将与课体回答【问题】。/);
  assert.doesNotMatch(prompt, /【输出要求】/);
  assert.doesNotMatch(prompt, /反证限制|证据不足|不硬给日期|取证顺序|回答口径/);
});

test('大六壬提示词保留课体与精简神煞摘要', () => {
  const data = {
    ...createData('liuren'),
    guaTi: ['龙德卦', '连珠卦'],
    shenShaFacts: [
      {
        name: '旬奇',
        target: '初传',
        targetType: '地支',
        category: '逐月神煞',
        basis: '月建',
        input: '寅',
        rule: '旬奇起例',
        sources: ['《大六壬大全》'],
        limitations: [],
      },
      {
        name: '天马',
        target: '末传',
        targetType: '地支',
        category: '十二地支神煞',
        basis: '月建',
        input: '申',
        rule: '天马起例',
        sources: ['《大六壬大全》'],
        limitations: [],
      },
    ],
  } satisfies LiurenData;

  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    data,
    createSupplementaryInfo(),
  );

  assert.match(prompt, /课体：龙德卦、连珠卦/);
  assert.match(prompt, /神煞：旬奇在初传、天马在末传/);
  assert.doesNotMatch(prompt, /旬奇起例|天马起例/);
  assert.doesNotMatch(prompt, /辅证：/);
  assert.doesNotMatch(prompt, /课体补充：龙德卦、连珠卦/);
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

test('塔罗提示词保留牌阵、牌位、正逆位与关键词', () => {
  const prompt = buildDivinationPrompt(
    'tarot',
    '这件事接下来该怎么推进？',
    createData('tarot'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /核心结构：牌阵/);
  assert.match(prompt, /牌位明细：/);
  assert.doesNotMatch(prompt, /牌位顺序：/);
  assert.match(prompt, /- 现状：恋人（正位）；关键词：/);
  assert.match(prompt, /- 建议：战车（逆位）；关键词：/);
  assert.doesNotMatch(prompt, /元素主题：|牌阶主题：/);
  assert.doesNotMatch(prompt, /牌义：/);
  assert.doesNotMatch(prompt, /断牌口径|现实边界|结构化证据|证据汇总|解释边界/);
  assert.doesNotMatch(
    prompt,
    /牌组层级|宫廷人物|叙事权重|元素数字|表示这些能量正在直接发挥作用|信息被隐藏|受阻、过度、内化/,
  );
});

test('灵签提示词保留完整签谱资料', () => {
  const prompt = buildDivinationPrompt(
    'ssgw',
    '这件事接下来该怎么推进？',
    createData('ssgw'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /签号：第18签/);
  assert.match(prompt, /签题：《刘备借荆州》/);
  assert.match(prompt, /签诗：前路迢迢莫强求，且看云开月自明。/);
  assert.match(prompt, /吉凶级别：中平签/);
  assert.match(prompt, /典故：刘备向东吴借取荆州。/);
  assert.match(prompt, /基础解签：事情仍有转圜空间，宜结合现况审慎研判。/);
  assert.match(prompt, /补充解释：\n- 事业：先核对资源与时机。/);
  assert.doesNotMatch(prompt, /行动建议|风险提醒|掷筊|签谱状态|来源状态|证据汇总/);
});

test('灵签提示词合并重复典故并保留基础解签', () => {
  const prompt = buildDivinationPrompt(
    'ssgw',
    '这件事接下来该怎么推进？',
    {
      number: 9,
      title: '典故去重测试',
      poem: '静待云开见月明，不妨暂且敛锋芒。',
      story: '韩信受胯下之辱，先忍后成大业。',
      details: {
        典故: '韩信受胯下之辱，先忍后成大业。',
        解签: '宜暂避锋芒，等待时机。',
      },
      timestamp: Date.now(),
      ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
    },
    createSupplementaryInfo(),
  );

  assert.match(prompt, /签诗：静待云开见月明，不妨暂且敛锋芒。/);
  assert.match(prompt, /典故：韩信受胯下之辱，先忍后成大业。/);
  assert.match(prompt, /基础解签：宜暂避锋芒，等待时机。/);
  assert.equal((prompt.match(/韩信受胯下之辱/g) ?? []).length, 1);
  assert.doesNotMatch(prompt, /辅助证据|行动建议|风险提醒|掷筊/);
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
  assert.match(prompt, /主要格局：土象偏强/);
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
});
