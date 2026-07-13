import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDivinationPrompt } from '../src/lib/divination/engine';
import {
  assertNoPromptPlaceholders,
  assertPromptIsPortableTaskText,
  assertPromptSectionsInOrder,
  findPromptSectionHeadingIndex,
} from './prompt-assertions';
import type {
  AstrolabeData,
  DivinationData,
  DivinationType,
  LiuyaoTemplateType,
  LiurenData,
  LiurenTemplateType,
  SupplementaryInfo,
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
    '【要求】',
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

  assert.match(prompt, /^你是资深.+/);
  assert.match(prompt, /占法：/);
  assert.match(prompt, /核心结构：/);
  assertPromptIsPortableTaskText(prompt);
}

function assertLiurenPromptStructure(prompt: string) {
  const expectedSections = [
    '【要求】',
    '【当前时间】',
    '【补充信息】',
    '【排盘信息】',
    '【分析对象】',
    '【解读范围】',
    '【应期判断方法】',
    '【问题】',
    '【断课要点】',
    '【任务】',
    '【输出要求】',
  ];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.doesNotMatch(prompt, /^【占卜信息】$/m);
  assert.doesNotMatch(prompt, /^【分析思路】$/m);
  assertPromptIsPortableTaskText(prompt);
}

function assertAlmanacPromptStructure(prompt: string) {
  const expectedSections = [
    '【要求】',
    '【当前时间】',
    '【补充信息】',
    '【占卜信息】',
    '【应期判断方法】',
    '【任务】',
    '【输出要求】',
  ];

  assertPromptSectionsInOrder(prompt, expectedSections, {
    requireUnique: true,
    requireBodyAfterHeading: true,
  });

  assert.match(prompt, /^你是资深.+/);
  assert.match(prompt, /占法：黄历择日/);
  assert.match(prompt, /核心结构：/);
  assert.doesNotMatch(prompt, /^【问题】$/m);
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
        strength: 86,
        applying: true,
      },
      {
        body1: '太阳',
        symbol: '合',
        body2: '水星',
        type: '合相',
        orb: 4.1,
        strength: 74,
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
        movingYao: { position: 3, description: '三爻发动', yaoName: '九三' },
        analysis: {
          season: '春',
          tiYongRelation: '用生体，主有助力',
          tiSeasonState: '相',
          yongSeasonState: '旺',
          inter1Relation: '比和',
          inter2Relation: '生',
          changedRelation: '体生变，后续需付出',
          changedTiYongRelation: '体克用',
        },
        mainHexagram: {
          name: '雷火丰',
          symbol: '䷶',
          upper: '震',
          lower: '离',
          description: '先盛后谨',
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
    case 'xiaoliuren':
      return {
        method: 'number',
        methodLabel: '数字起课',
        timestamp: Date.now(),
        lunarMonth: 4,
        lunarDay: 18,
        hourIndex: 6,
        hourLabel: '午时',
        sequence: {
          start: {
            name: '留连',
            index: 1,
            element: '土',
            meaning: '事情容易拖延反复，推进时会被旧问题牵扯。',
            keywords: ['拖延', '牵扯', '反复'],
            tendency: '易反复',
            advice: '不要急着定论，先清理卡点与未处理事项。',
            direction: '四角',
            shenSha: '螣蛇',
            yinYang: '阴',
            fortune: '平（偏凶）',
            timing: '代表2-8日内反复拖延',
          },
          process: {
            name: '赤口',
            index: 3,
            element: '金',
            meaning: '容易出现争执、误会、口舌或情绪冲撞。',
            keywords: ['争执', '误会', '情绪'],
            tendency: '易争执',
            advice: '少硬碰硬，先控情绪和表达，再谈结果。',
            direction: '西',
            shenSha: '白虎',
            yinYang: '阳',
            fortune: '凶',
            timing: '代表4-7日或1-2周内出现争执',
          },
          result: {
            name: '小吉',
            index: 4,
            element: '水',
            meaning: '事情整体可成，常有助力，但更适合渐进推进。',
            keywords: ['助力', '可成', '渐进'],
            tendency: '有助力',
            advice: '可以推进，但要一步一步拿结果，不宜贪快。',
            direction: '北',
            shenSha: '玄武',
            yinYang: '阴',
            fortune: '吉',
            timing: '代表1-4周内有贵人助力',
          },
        },
        wuxingRelations: {
          startToProcess: '所生',
          processToResult: '所生',
          description: '起因生过程，事态自然推进；过程生结果，越做越顺',
        },
        primary: {
          name: '小吉',
          index: 4,
          element: '水',
          meaning: '事情整体可成，常有助力，但更适合渐进推进。',
          keywords: ['助力', '可成', '渐进'],
          tendency: '有助力',
          advice: '可以推进，但要一步一步拿结果，不宜贪快。',
        },
        tendency: '有助力',
        questionHint: '当前整体偏可成，适合稳步推进，慢慢拿结果。',
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
          { id: 1, name: '恋人', position: '现状', reversed: false, keywords: ['选择', '连接'] },
          { id: 2, name: '战车', position: '建议', reversed: true, keywords: ['控制', '节奏'] },
        ],
        timestamp: Date.now(),
      };
    case 'ssgw':
      return {
        number: 18,
        title: '刘备借荆州',
        poem: '前路迢迢莫强求，且看云开月自明。',
        details: {
          典故: '刘备借荆州后多方周旋，需审时度势。',
          解签: '宜守正待时，不可躁进。',
        },
        timestamp: Date.now(),
        ganzhi: { year: '甲子', month: '乙丑', day: '丙寅', hour: '丁卯' },
      };
  }
}

function createLenormandData(): DivinationData {
  return {
    spreadType: 'relationship',
    spreadName: '关系牌阵',
    cards: [
      { position: '现状', name: '骑士', keywords: ['消息', '推进'], meaning: '事情开始动起来。' },
      { position: '阻碍', name: '山', keywords: ['阻碍', '拖延'], meaning: '进程会被卡住。' },
      { position: '结果', name: '太阳', keywords: ['明朗', '成功'], meaning: '后续有机会转明。' },
    ],
    timestamp: Date.now(),
  };
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
  ];

  for (const item of cases) {
    const prompt = buildDivinationPrompt(
      item.method,
      item.question,
      item.data,
      createSupplementaryInfo(),
    );
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

test('非命盘占法提示词会写入各自的应期判断方法', () => {
  const cases: Array<{
    method: Exclude<DivinationType, 'tarot_single' | 'astrolabe'>;
    data: DivinationData;
    expected: RegExp;
  }> = [
    { method: 'liuyao', data: createData('liuyao'), expected: /空亡出空、伏神透出/ },
    { method: 'meihua', data: createData('meihua'), expected: /体用生克、动爻数、卦数/ },
    {
      method: 'xiaoliuren',
      data: createData('xiaoliuren'),
      expected: /不得把六宫名称直接等同具体日期/,
    },
    { method: 'qimen', data: createData('qimen'), expected: /空亡、马星、伏吟反吟/ },
    { method: 'liuren', data: createData('liuren'), expected: /发用、三传递进/ },
    { method: 'tarot', data: createData('tarot'), expected: /单张牌不能独立推出绝对日期/ },
    { method: 'lenormand', data: createLenormandData(), expected: /不得孤立牌义硬断日期/ },
    { method: 'ssgw', data: createData('ssgw'), expected: /签诗迟速、典故处境/ },
    { method: 'almanac', data: createAlmanacData(), expected: /只能在候选日期范围内/ },
  ];

  for (const item of cases) {
    const prompt = buildDivinationPrompt(
      item.method,
      item.method === 'almanac' ? '' : '这件事接下来该怎么推进？',
      item.data,
      createSupplementaryInfo(),
    );

    assert.match(prompt, /【应期判断方法】/);
    assert.match(prompt, item.expected);
    const infoIndex = findPromptSectionHeadingIndex(
      prompt,
      item.method === 'liuren' ? '【排盘信息】' : '【占卜信息】',
    );
    const timingIndex = findPromptSectionHeadingIndex(prompt, '【应期判断方法】');
    assert.ok(infoIndex < timingIndex);
    if (item.method === 'almanac') {
      assert.equal(findPromptSectionHeadingIndex(prompt, '【问题】'), -1);
      assert.ok(timingIndex < findPromptSectionHeadingIndex(prompt, '【任务】'));
    } else {
      assert.ok(timingIndex < findPromptSectionHeadingIndex(prompt, '【问题】'));
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

  assert.match(prompt, /【占卜信息】/);
  assert.match(prompt, /【问题】/);
  assert.doesNotMatch(prompt, /【应期判断方法】/);
});

test('择日资料包会先给禁忌筛查再给取舍证据', () => {
  const prompt = buildDivinationPrompt(
    'almanac',
    '',
    createAlmanacData(),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /禁忌筛查：2026-06-02：风险黄历忌项触及搬家入宅；评分42偏低/);
  assert.match(prompt, /事项口径：事项范围：搬家入宅；按该事项和候选日期证据处理/);
  assert.match(prompt, /岁支方位避太岁午正南、岁破子正北；可参考太阳未西南偏南、福德卯正东/);
  assert.doesNotMatch(prompt, /禁忌筛查：2026-06-01：参与人本人：未见直接刑冲破害提醒/);
  assert.doesNotMatch(prompt, /事项权重|优先匹配宜项|事项忌项命中/);
  assert.match(prompt, /先排禁忌，再看评分，高分日期若命中明显禁忌或参与人刑冲破害必须降级/);
  assert.match(prompt, /禁忌降级：2026-06-02：风险黄历忌项触及搬家入宅；评分42偏低/);
  assert.match(prompt, /取舍证据：首选2026-06-01/);
  assert.match(prompt, /可用时段边界：只允许在2026-06-01至2026-06-03范围内排序/);
  assert.ok(prompt.indexOf('禁忌筛查：') < prompt.indexOf('取舍证据：'));
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

test('占卜提示词的输出要求保持统一且完整', async () => {
  const session = buildDivinationPrompt(
    'qimen',
    '这件事接下来该怎么推进？',
    createData('qimen'),
    createSupplementaryInfo(),
  );

  assert.match(
    session,
    /先直接回答【问题】，再按“结论总览、核心结构、关键证据、反证限制、应期窗口、行动建议”展开/,
  );
  assert.match(session, /最后补充行动清单：当下先做什么、避免什么、用什么信号复盘/);
  assert.doesNotMatch(session, /请直接回答：/);
  assert.doesNotMatch(session, /语气和表达要求/);
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

test('奇门提示词会输出盘面优先宫位', () => {
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

  assert.match(prompt, /核心结构：阳遁3局；值符天蓬；值使休门/);
  assert.match(prompt, /主轴证据：值符天蓬落坎一宫；值使休门落坎一宫；时干丁见于离九宫/);
  assert.match(prompt, /用神宫候选：离九宫（36分，凶格:太白入荧、干关系:太白入荧）/);
  assert.match(
    prompt,
    /用神宫证据：离九宫：门景门、星天英、神九天、天盘丙、地盘丁；格局太白入荧；干关系太白入荧/,
  );
  assert.match(prompt, /反证宫离九宫、坎一宫：逢空、马星或格局标签命中时先降权复核/);
  assert.match(prompt, /时间窗口：逢空坎一宫、艮八宫先待填实/);
  assert.match(prompt, /辅助证据：旬空子空落坎一宫、丑空落艮八宫；马星卯时驿马在巳，落巽四宫/);
  assert.doesNotMatch(prompt, /问事参考/);
  assert.doesNotMatch(prompt, /卦象|课传|牌阵|签诗|牌位/);
  assert.match(prompt, /坎一宫（北，五行水）：天盘壬天蓬，地盘癸，人盘休门，神盘值符/);
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
  assert.match(prompt, /用神宫候选：坎一宫（24分，有利:适合谋划与沟通）/);
});

test('六爻提示词会给出断卦抓手，先看取用世应动变', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这件事接下来该怎么推进？',
    createData('liuyao'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /断卦抓手：/);
  assert.match(prompt, /主轴证据：世爻第1爻兄弟子水；应爻第6爻兄弟戌土；动变/);
  assert.match(prompt, /【六爻用神作用链结构化证据】/);
  assert.match(prompt, /【主证】通用主轴/);
  assert.match(prompt, /作用链：用神水/);
  assert.doesNotMatch(prompt, /取用评分表|权重\d/);
  assert.match(
    prompt,
    /月日触发：月建丑：未直接同支入爻；日辰寅：同支第2爻子孙寅木，冲第5爻父母申金/,
  );
  assert.match(prompt, /应期候选：动变触发：第1爻兄弟子水动/);
  assert.match(prompt, /只使用上方明确列出的卦名、六亲、六神、世应、用神、动变/);
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
  assert.match(prompt, /【主证】通用主轴/);
});

test('六爻用户选择事业模板会结构化官鬼与父母候选', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这次换工作有没有机会升职？',
    createData('liuyao'),
    createSupplementaryInfo(),
    { liuyaoTemplate: 'shiye' },
  );

  assert.match(prompt, /断卦类型：事业工作/);
  assert.match(prompt, /断卦类型只作为问题范围/);
  assert.doesNotMatch(prompt, /取用参考：/);
  assert.match(prompt, /【主证】事业用神/);
  assert.match(prompt, /官鬼为主要事项候选/);
  assert.match(prompt, /【辅证】文书辅证/);
});

test('六爻提示词按用户选择的鬼神怪异模板收紧口径', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '最近家里总觉得不安，这是不是鬼神怪异或冲犯？',
    createData('liuyao'),
    createSupplementaryInfo(),
    { liuyaoTemplate: 'guaishen' },
  );

  assert.match(prompt, /【断卦要点】/);
  assert.match(prompt, /断卦类型：鬼神怪异/);
  assert.match(prompt, /断卦类型只作为问题范围/);
  assert.doesNotMatch(prompt, /取用参考：/);
  assert.match(prompt, /【主证】怪异事项候选/);
  assert.match(prompt, /不能据此证明超自然原因/);
  assert.match(prompt, /不得仅凭官鬼、白虎、螣蛇/);
  assert.doesNotMatch(prompt, /专项抓手/);
  assert.match(prompt, /证据不足时只能说“未见明显鬼神主证”或“更偏情绪\/环境因素”/);
});

test('六爻未知专项模板应回落到通用断卦，避免输出 undefined', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这次合作要不要签？',
    createData('liuyao'),
    createSupplementaryInfo(),
    { liuyaoTemplate: 'decision' as LiuyaoTemplateType },
  );

  assert.match(prompt, /断卦类型：通用断卦/);
  assert.match(prompt, /断卦类型只作为问题范围/);
  assert.match(
    prompt,
    /取证顺序：先按世应、用神候选、动爻、变卦、空亡、伏神、月日建等卦内证据判断/,
  );
  assert.doesNotMatch(prompt, /undefined|null/);
});

test('梅花提示词会给出体用主轴、过程结果与起卦细节', () => {
  const prompt = buildDivinationPrompt(
    'meihua',
    '这件事接下来该怎么推进？',
    createData('meihua'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /断卦抓手：先定体用，再看互卦过程、变卦结果与四时旺衰/);
  assert.match(prompt, /主轴证据：体卦离（火）；用卦震（木）；动爻第3爻；体用关系用生体，主有助力/);
  assert.match(prompt, /过程证据：互卦泽风大过；互卦体用比和；互上辅助生/);
  assert.match(
    prompt,
    /结果证据：变卦地火明夷；变后体卦坤（土）；变后用卦离（火）；变后体用体克用/,
  );
  assert.match(prompt, /辅助证据：四时春季，体卦相，用卦旺；起卦法数字起卦法；起卦数字123/);
  assert.match(prompt, /应期候选：动爻第3爻：可作阶段、层位或触发点，不可单独换算绝对日期/);
  assert.match(prompt, /【梅花体用阶段推进结构化证据】/);
  assert.match(prompt, /梅花推进链解释边界/);
  assert.doesNotMatch(prompt, /体用评分：|类象权重：|\d+日内|\d+月左右/);
  assert.match(prompt, /第3爻.*动.*属体/);
});

test('小六壬提示词会给出三段过程、主判断和现实建议抓手', () => {
  const prompt = buildDivinationPrompt(
    'xiaoliuren',
    '这件事接下来该怎么推进？',
    createData('xiaoliuren'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /占法：小六壬/);
  assert.match(
    prompt,
    /断课抓手：先看结果宫位定主判断，再看起因与过程宫位解释事情为何如此、会如何推进。/,
  );
  assert.match(prompt, /主轴证据：起因留连；过程赤口；结果小吉/);
  assert.match(prompt, /五行推进证据：起因到过程/);
  assert.match(prompt, /关键词/);
  assert.match(prompt, /取象提示：当前整体偏可成，适合稳步推进，慢慢拿结果。/);
  assert.match(prompt, /应期候选：起因留连：偏拖延反复，常需先清旧账或等阻滞松动/);
  assert.match(prompt, /主判断小吉：有助力，只适合短期复盘，不作长期命运定论/);
  assert.match(prompt, /行动建议等级：稳步推进：有助力但不宜贪快，先拿小结果/);
  assert.match(prompt, /- 起课方式：数字起课/);
  assert.match(prompt, /- 结果：小吉（五行.*）；关键词.*；倾向有助力/);
  assert.match(prompt, /宫位含义事情整体可成，常有助力，但更适合渐进推进。/);
  assert.match(prompt, /建议可以推进，但要一步一步拿结果，不宜贪快。/);
  assert.match(prompt, /方位、神煞和应期属性不得单独决定吉凶/);
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

test('大六壬提示词只保留断课要点，不再使用分析思路标题', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '我现在要不要换工作？',
    createData('liuren'),
    createSupplementaryInfo(),
    { liurenTemplate: 'shiye' },
  );

  assertLiurenPromptStructure(prompt);
  assert.match(prompt, /【断课要点】/);
  assert.match(prompt, /断课类型：事业断课/);
  assert.match(prompt, /断课类型只作为问题范围/);
  assert.match(prompt, /取证顺序：先按知一\/比用看发用亥乘贵人，再看三传推进/);
  assert.match(
    prompt,
    /回答口径：先给结论，再按“课传主线、发用推进、四课背景、反证限制、应期条件、现实建议”说明；不要复述完整课盘。/,
  );
  assert.doesNotMatch(prompt, /关注重点：|岗位路径、协作阻力、窗口时机/);
  assert.doesNotMatch(prompt, /【分析思路】/);
});

test('大六壬提示词会给出精简课传资料，避免重复堆叠', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    createData('liuren'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /核心结构：盘面摘要：月将亥；占时卯；昼占；贵人亥临卯；旬空戌、亥/);
  assert.match(prompt, /课传主线：取传比用法；传态递传；发用亥乘贵人；末传寅/);
  assert.match(prompt, /古籍依据：《大六壬大全》九宗门取传法：知一\/比用/);
  assert.match(prompt, /四课：一课亥临卯乘贵人，水生木/);
  assert.match(prompt, /三传：初传亥乘贵人，生扶，起因来自外部推动/);
  assert.match(prompt, /旬空：戌、亥，命中初传亥主虚而不实，待填实再看/);
  assert.doesNotMatch(prompt, /断课抓手：/);
  assert.doesNotMatch(prompt, /发用主线：/);
});

test('大六壬提示词的任务与输出要求应和断课要点口径一致，不重复强制逐段作答', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    createData('liuren'),
    createSupplementaryInfo(),
  );

  assert.match(
    prompt,
    /【任务】\n请先围绕【问题】给出判断，再按古籍取传法、发用、三传推进、四课背景和辅证说明理由。\n需要明确事情会如何演变、卡点在哪、下一步先做什么；应期只能写课传支持的触发条件。/,
  );
  assert.match(
    prompt,
    /【输出要求】\n先直接回答【问题】，再按“课传主线、发用与三传推进、四课背景、反证限制、应期条件、现实建议”展开。\n每个部分都要写必要课传依据、触发条件与现实建议，不要只给一句吉凶。\n应期必须来自发用、三传、空亡或明确神煞；证据不足就写条件，不硬给日期。/,
  );
  assert.doesNotMatch(
    prompt,
    /先直接回答【问题】，再展开最关键的 2 到 4 个重点；每个重点都要写明占卜依据、触发条件与现实建议。/,
  );
});

test('大六壬提示词会吸收课体与神煞补充信息', () => {
  const data = {
    ...createData('liuren'),
    guaTi: ['龙德卦', '连珠卦'],
    shenShaSummary: ['旬奇临初传', '天马并发', '末传逢月德'],
  } satisfies LiurenData;

  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    data,
    createSupplementaryInfo(),
  );

  assert.match(prompt, /课体标签：龙德卦、连珠卦/);
  assert.match(prompt, /神煞：/);
  assert.doesNotMatch(prompt, /辅证：/);
  assert.doesNotMatch(prompt, /课体补充：龙德卦、连珠卦/);
  assert.doesNotMatch(prompt, /神煞补充：旬奇临初传；天马并发；末传逢月德/);
});

test('大六壬未知专项模板应回落到通用断课，避免输出 undefined', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事后面会怎么发展？',
    createData('liuren'),
    createSupplementaryInfo(),
    { liurenTemplate: 'progress' as LiurenTemplateType },
  );

  assert.match(prompt, /断课类型：通用断课/);
  assert.match(prompt, /断课类型只作为问题范围/);
  assert.doesNotMatch(prompt, /关注重点：核心目标、现实阻力、下一步动作/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

test('塔罗提示词保留牌阵、牌位、关键词与证据边界', () => {
  const prompt = buildDivinationPrompt(
    'tarot',
    '这件事接下来该怎么推进？',
    createData('tarot'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /断牌口径：按当前牌阵、牌位、牌名和正逆位解读/);
  assert.match(prompt, /现实边界：塔罗只能给当下倾向、心理动力、互动节奏和行动建议/);
  assert.match(prompt, /判断主轴：/);
  assert.match(prompt, /- 现状：恋人（正位）；关键词：/);
  assert.match(prompt, /- 建议：战车（逆位）；关键词：/);
  assert.match(prompt, /正逆位必须结合牌位和整组牌势判断，不套用孤立的固定断语/);
  assert.doesNotMatch(prompt, /牌组层级|宫廷人物|叙事权重|元素数字/);
});

test('灵签提示词保留签诗、典故和现有签文条目', () => {
  const prompt = buildDivinationPrompt(
    'ssgw',
    '这件事接下来该怎么推进？',
    createData('ssgw'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /断签口径：按【问题】、签诗原文、典故和八类签意解读/);
  assert.match(prompt, /签诗：前路迢迢莫强求，且看云开月自明。/);
  assert.match(prompt, /典故：刘备借荆州后多方周旋，需审时度势。/);
  assert.match(prompt, /签文条目：/);
  assert.match(prompt, /- 解签：宜守正待时，不可躁进。/);
  assert.doesNotMatch(prompt, /吉凶层级|宜忌条件|事项映射|现实映射|典故映射/);
});

test('灵签提示词会去重重复典故，避免 story 与 details.典故 双写', () => {
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

  assert.equal((prompt.match(/韩信受胯下之辱，先忍后成大业。/g) ?? []).length, 1);
  assert.match(prompt, /典故：韩信受胯下之辱，先忍后成大业。/);
  assert.doesNotMatch(prompt, /辅助证据|^- 典故：/m);
});

test('雷诺曼提示词保留牌序、关键词、牌义与组合边界', () => {
  const prompt = buildDivinationPrompt(
    'lenormand',
    '这件事接下来该怎么推进？',
    createLenormandData(),
  );

  assert.match(prompt, /断牌口径：按当前牌阵、牌位、牌名和牌义解读/);
  assert.match(prompt, /牌序主轴：/);
  assert.match(prompt, /- 现状：骑士；关键词：.*；牌义：事情开始动起来。/);
  assert.match(prompt, /- 阻碍：山；关键词：.*；牌义：进程会被卡住。/);
  assert.doesNotMatch(prompt, /组合证据：/);
  assert.match(prompt, /不得把单牌或单一组合写成必然结果/);
  assert.doesNotMatch(prompt, /核心牌|人物牌|事件链证据|组合权重/);
});

test('星盘提示词应直接给出太阳月亮上升和主要相位证据', () => {
  const prompt = buildDivinationPrompt(
    'astrolabe',
    '这件事接下来该怎么推进？',
    createAstrolabeData(),
  );

  assert.match(prompt, /【星盘要点】/);
  assert.match(prompt, /若【问题】未限定具体主题，按通用星盘口径处理/);
  assert.match(prompt, /主轴证据：太阳金牛座 29°；月亮处女座 08°；上升狮子座 12°/);
  assert.match(
    prompt,
    /辅助证据：主要相位太阳△月亮（三分，强度86%）；太阳合水星（合相，强度74%）；逆行无；格局土象偏强/,
  );
  assert.match(prompt, /只使用上方明确列出的星体、宫位、角点、相位、格局和行运范围/);
  assert.match(prompt, /本次按本命盘长期结构作答，只分析长期倾向/);
  assert.match(prompt, /星盘回答只按本命结构说明长期倾向/);
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
        '分析对象：流年2028。\n行运证据：土星□太阳（刑相，偏差0.50°，强度92%，入相）。\n时间边界：本命盘只定长期结构；所选流年只作为当前阶段触发与应期参考。',
    },
  );

  assert.match(prompt, /【分析对象】\n分析对象：流年2028。/);
  assert.match(prompt, /行运证据：土星□太阳/);
  assert.match(prompt, /【行运时间尺度】/);
  assert.match(prompt, /本命盘只定长期结构；若【分析对象】提供流年、流月或流日/);
  assert.match(prompt, /流年：看年度主题、阶段转向和全年最容易被触发的议题/);
  assert.match(prompt, /星盘回答必须区分本命底色与行运触发/);
  assert.doesNotMatch(prompt, /【应期判断方法】/);
  assert.ok(prompt.indexOf('【分析对象】') < prompt.indexOf('【占卜信息】'));
  assert.ok(prompt.indexOf('【行运时间尺度】') < prompt.indexOf('【占卜信息】'));
});
