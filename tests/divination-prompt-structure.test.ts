import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDivinationPrompt } from '../src/lib/divination/engine';
import type {
  AstrolabeData,
  DivinationData,
  DivinationType,
  LiuyaoTemplateType,
  LiurenData,
  LiurenTemplateType,
  SupplementaryInfo,
} from '../src/types';

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
  const expectedSections = [
    '【要求】',
    '【当前时间】',
    '【补充信息】',
    '【占卜信息】',
    '【问题】',
    '【任务】',
    '【输出要求】',
  ];

  let lastIndex = -1;
  for (const section of expectedSections) {
    const headingMatches =
      prompt.match(new RegExp(`^${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'gm')) ?? [];
    assert.equal(headingMatches.length, 1, `${section} 不应重复出现`);
    const headingIndex = prompt.search(
      new RegExp(`^${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'),
    );
    assert.notEqual(headingIndex, -1, `缺少 section：${section}`);
    assert.ok(headingIndex > lastIndex, `${section} 顺序不正确`);
    assert.match(
      prompt,
      new RegExp(`${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\n(?!\\n)`),
      `${section} 后应直接接正文`,
    );
    lastIndex = headingIndex;
  }

  assert.match(prompt, /^你是资深.+/);
  assert.match(prompt, /占法：/);
  assert.match(prompt, /核心结构：/);
  assert.doesNotMatch(prompt, /\*\*/);
  assertNoPromptPlaceholders(prompt);
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
    '【分析思路】',
    '【任务】',
    '【输出要求】',
  ];

  let lastIndex = -1;
  for (const section of expectedSections) {
    const headingIndex = findSectionHeadingIndex(prompt, section);
    assert.notEqual(headingIndex, -1, `缺少 section：${section}`);
    assert.ok(headingIndex > lastIndex, `${section} 顺序不正确`);
    lastIndex = headingIndex;
  }

  assert.doesNotMatch(prompt, /^【占卜信息】$/m);
  assert.doesNotMatch(prompt, /^【断课要点】$/m);
  assertNoPromptPlaceholders(prompt);
}

function assertNoEngineeringPromptText(prompt: string) {
  assert.doesNotMatch(prompt, /当前项目|本地算法|技术限制|未计算|资料包|提示词规则/);
  assert.doesNotMatch(prompt, /当前已写入|当前未写入|未写入/);
}

function assertNoPromptPlaceholders(prompt: string) {
  assert.doesNotMatch(prompt, /\b(?:undefined|null|NaN)\b/);
}

function findSectionHeadingIndex(prompt: string, section: string) {
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return prompt.search(new RegExp(`^${escaped}$`, 'm'));
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

function createData(method: Exclude<DivinationType, 'tarot_single'>): DivinationData {
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
          externalSummary: '暂无外应，以数字起卦为主。',
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
            meaning: '事情容易拖延反复，推进时会被旧问题牵扯。',
            keywords: ['拖延', '牵扯', '反复'],
            tendency: '易反复',
            advice: '不要急着定论，先清理卡点与未处理事项。',
          },
          process: {
            name: '赤口',
            index: 3,
            meaning: '容易出现争执、误会、口舌或情绪冲撞。',
            keywords: ['争执', '误会', '情绪'],
            tendency: '易争执',
            advice: '少硬碰硬，先控情绪和表达，再谈结果。',
          },
          result: {
            name: '小吉',
            index: 4,
            meaning: '事情整体可成，常有助力，但更适合渐进推进。',
            keywords: ['助力', '可成', '渐进'],
            tendency: '有助力',
            advice: '可以推进，但要一步一步拿结果，不宜贪快。',
          },
        },
        primary: {
          name: '小吉',
          index: 4,
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
        score: 86,
        highlights: ['黄历宜项命中搬家入宅'],
        cautions: [],
        participantNotes: ['本人：未见直接冲克提醒'],
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
        participantNotes: ['本人：候选日地支未冲日支'],
      },
    ],
  };
}

test('各类占卜提示词都使用统一的角色加信息加问题结构', async () => {
  const methods: Exclude<DivinationType, 'tarot_single'>[] = [
    'liuyao',
    'meihua',
    'xiaoliuren',
    'qimen',
    'liuren',
    'tarot',
    'ssgw',
  ];

  for (const method of methods) {
    const prompt = buildDivinationPrompt(
      method,
      '这件事接下来该怎么推进？',
      createData(method),
      createSupplementaryInfo(),
    );
    if (method === 'liuren') {
      assertLiurenPromptStructure(prompt);
    } else {
      assertStandardPromptStructure(prompt);
    }
    assertNoEngineeringPromptText(prompt);
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
    assertNoEngineeringPromptText(prompt);
    assertNoPromptPlaceholders(prompt);
  });
});

test('非命盘占法提示词会写入各自的应期判断方法', () => {
  const cases: Array<{
    method: Exclude<DivinationType, 'tarot_single' | 'astrolabe'>;
    data: DivinationData;
    expected: RegExp;
  }> = [
    { method: 'liuyao', data: createData('liuyao'), expected: /空亡出空、伏神透出/ },
    { method: 'meihua', data: createData('meihua'), expected: /外应只能作辅证/ },
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
    const infoIndex = findSectionHeadingIndex(
      prompt,
      item.method === 'liuren' ? '【排盘信息】' : '【占卜信息】',
    );
    const timingIndex = findSectionHeadingIndex(prompt, '【应期判断方法】');
    assert.ok(infoIndex < timingIndex);
    if (item.method === 'almanac') {
      assert.equal(findSectionHeadingIndex(prompt, '【问题】'), -1);
      assert.ok(timingIndex < findSectionHeadingIndex(prompt, '【任务】'));
    } else {
      assert.ok(timingIndex < findSectionHeadingIndex(prompt, '【问题】'));
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

  assert.match(prompt, /禁忌筛查：2026-06-02：事项忌项命中入宅、移徙/);
  assert.match(prompt, /事项权重：事项搬家入宅优先匹配宜项入宅、移徙、搬家、安床/);
  assert.match(prompt, /参与人适配：本人：日主丙火，喜用木、火，忌神水/);
  assert.match(prompt, /风险黄历忌项触及搬家入宅/);
  assert.match(prompt, /评分42偏低/);
  assert.doesNotMatch(prompt, /禁忌筛查：2026-06-01：参与人本人：未见直接冲克提醒/);
  assert.match(prompt, /先排禁忌，再看评分，高分日期若命中事项忌项或参与人冲克必须降级/);
  assert.match(prompt, /禁忌降级：2026-06-02：事项忌项命中入宅、移徙/);
  assert.match(prompt, /取舍证据：首选2026-06-01/);
  assert.match(
    prompt,
    /现实约束：现实刚性约束包括场地、证件、人员到场、交通、预算、天气和办理窗口/,
  );
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
    findSectionHeadingIndex(prompt, '【补充信息】') <
      findSectionHeadingIndex(prompt, '【占卜信息】'),
  );
});

test('占卜提示词的输出要求保持统一且精简', async () => {
  const session = buildDivinationPrompt(
    'qimen',
    '这件事接下来该怎么推进？',
    createData('qimen'),
    createSupplementaryInfo(),
  );

  assert.match(session, /先直接回答【问题】，再展开最关键的 2 到 4 个重点/);
  assert.match(session, /最后补一条最值得执行的提醒/);
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
    '我现在应该继续推进这个项目，还是先调整策略再行动？',
    createLenormandData(),
    {
      gender: '男',
      birthYear: 1990,
      userSupplement: '正在做一个需要投入时间和资金的新项目，想判断行动节奏。',
    },
  );

  assert.match(prompt, /【补充信息】/);
  assert.match(prompt, /性别：男/);
  assert.match(prompt, /出生年份：1990/);
  assert.match(prompt, /用户补充：正在做一个需要投入时间和资金的新项目，想判断行动节奏。/);
  assert.ok(
    findSectionHeadingIndex(prompt, '【补充信息】') <
      findSectionHeadingIndex(prompt, '【占卜信息】'),
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

test('奇门提示词会结合问题补充取用参考与优先宫位', () => {
  const prompt = buildDivinationPrompt('qimen', '这次换工作该不该主动推进？', createData('qimen'), {
    gender: '男',
    birthYear: 1995,
  });

  assert.match(prompt, /核心结构：阳遁3局；值符天蓬；值使休门/);
  assert.match(prompt, /起局抓手：/);
  assert.match(prompt, /主轴证据：值符天蓬落坎一宫；值使休门落坎一宫；时干丁见于离九宫/);
  assert.match(prompt, /用神宫候选：/);
  assert.match(prompt, /用神宫证据：/);
  assert.match(prompt, /门休门、星天蓬、神值符、天盘壬、地盘癸/);
  assert.match(prompt, /逢空，落地偏虚或需待填实/);
  assert.match(prompt, /主宫评分：坎一宫/);
  assert.match(prompt, /辅宫评分：离九宫/);
  assert.match(prompt, /反证宫：坎一宫：命中空亡、马星或格局标签时，相关结论必须降权复核/);
  assert.match(prompt, /宫间关系：主宫坎一宫：/);
  assert.match(prompt, /反证宫坎一宫：逢空、马星或格局标签命中时先降权复核/);
  assert.match(prompt, /宫间关系只用于排序主宫、辅宫和反证宫/);
  assert.match(prompt, /方位策略：主方位北（坎一宫）/);
  assert.match(prompt, /时间窗口：逢空坎一宫、艮八宫先待填实/);
  assert.match(prompt, /辅助证据：旬空子空落坎一宫、丑空落艮八宫；马星卯时驿马在巳，落巽四宫/);
  assert.match(prompt, /不得编造已提供资料没有给出的值符值使、九宫、门星神干、用神宫、格局/);
  assert.match(prompt, /涉及应期、日期或时间窗口时，必须说明来自值使门、用神宫、门星神干/);
  assert.doesNotMatch(prompt, /卦象|课传|牌阵|签诗|牌位/);
  assert.doesNotMatch(prompt, /优先看宫：/);
  assert.doesNotMatch(prompt, /值符值使主轴优先看落宫与门星神干组合/);
  assert.doesNotMatch(prompt, /问事参考：当前问题可先从坎一宫切入/);
  assert.doesNotMatch(prompt, /补充提示：坎一宫有利，适合谋划与沟通/);
  assert.match(prompt, /坎一宫（北，五行水）：天盘壬天蓬，地盘癸，人盘休门，神盘值符/);
});

test('奇门提示词只在命中具体问事线索时输出问事参考', () => {
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

  assert.match(prompt, /问事参考：事业参考：首看开门，当前落乾六宫；兼看生门，当前落艮八宫/);
});

test('六爻提示词会给出断卦抓手，先看用神世应动变', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这件事接下来该怎么推进？',
    createData('liuyao'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /断卦抓手：/);
  assert.match(prompt, /世爻/);
  assert.match(prompt, /应爻/);
  assert.match(prompt, /动爻/);
  assert.match(prompt, /空亡/);
  assert.match(prompt, /用神候选：/);
  assert.match(prompt, /未识别专项用神：先以世爻第1爻兄弟子水为我方主轴/);
  assert.match(prompt, /主轴证据：世爻第1爻兄弟子水；应爻第6爻兄弟戌土；动变/);
  assert.match(prompt, /用神评分表：未识别专项用神：第1爻兄弟子水为主候选/);
  assert.match(prompt, /主证临世，和求测者自身强相关、发动，可作事件变化主证/);
  assert.match(
    prompt,
    /评分口径：用神先按问题取六亲，再看是否临世应、是否发动或暗动、月令旺相休囚死、是否得月日触发、回头生克/,
  );
  assert.match(prompt, /原神忌神仇神：以未识别专项用神第1爻兄弟子水为用神基准/);
  assert.match(prompt, /原神金：第5爻父母申金/);
  assert.match(prompt, /忌神土：第3爻妻财辰土、第6爻兄弟戌土动空/);
  assert.match(prompt, /辅助证据：空亡爻位第6爻兄弟戌土/);
  assert.match(prompt, /伏神子孙伏第2爻寅木，伏于子孙寅木下/);
  assert.match(prompt, /月日触发：月建丑：未直接同支入爻/);
  assert.match(prompt, /日辰寅：同支第2爻子孙寅木/);
  assert.match(prompt, /冲第5爻父母申金/);
  assert.match(prompt, /应期候选：动变触发：第1爻兄弟子水动/);
  assert.match(prompt, /空亡戌、亥：逢出空、冲实或用神透出时才可作为应期/);
  assert.match(prompt, /应期优先级：一级动变：先看第1爻兄弟子水、第6爻兄弟戌土及其化出六亲/);
  assert.match(prompt, /不得编造已提供资料没有给出的卦名、六亲、六神、世应、用神、动变/);
  assert.match(prompt, /涉及应期、日期或时间窗口时，必须说明来自日月建、动变、空亡/);
  assert.doesNotMatch(prompt, /课传|盘局|牌阵|签诗|牌位/);
});

test('六爻提示词会按问题补充传统用神候选', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '这次换工作有没有机会升职？',
    createData('liuyao'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /用神候选：事业职位：以官鬼为用神候选/);
  assert.match(prompt, /盘中第4爻官鬼午火/);
  assert.match(prompt, /用神评分表：事业职位：第4爻官鬼午火为主候选/);
  assert.match(prompt, /原神忌神仇神：以事业职位第4爻官鬼午火为用神基准/);
  assert.match(prompt, /非动爻，需参动爻第1爻兄弟子水、第6爻兄弟戌土/);
});

test('六爻提示词会带专项断卦要点，并把鬼神怪异问题收紧到传统判断口径', () => {
  const prompt = buildDivinationPrompt(
    'liuyao',
    '最近家里总觉得不安，这是不是鬼神怪异或冲犯？',
    createData('liuyao'),
    createSupplementaryInfo(),
    { liuyaoTemplate: 'guaishen' },
  );

  assert.match(prompt, /【断卦要点】/);
  assert.match(prompt, /断卦类型：鬼神怪异/);
  assert.match(prompt, /官鬼与子孙制鬼、世应受冲、玄武螣蛇白虎勾陈、空破入墓与家宅怪异线索/);
  assert.match(prompt, /专项抓手：鬼神怪异：重点看官鬼是否旺动贴世，子孙能否制鬼/);
  assert.match(prompt, /若卦中证据不足，只能说“未见明显鬼神主证”或“更偏情绪\/环境因素”/);
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
  assert.match(prompt, /断卦重点：用神主轴、世应关系、动变趋势、空亡伏神与现实行动建议/);
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
  assert.match(prompt, /体用评分：体用用生体，主有助力为基础分/);
  assert.match(prompt, /过程证据：互卦泽风大过；互卦体用比和；互上辅助生/);
  assert.match(
    prompt,
    /结果证据：变卦地火明夷；变后体卦坤（土）；变后用卦离（火）；变后体用体克用/,
  );
  assert.match(prompt, /互变阶段：起因看主卦雷火丰与体用用生体，主有助力/);
  assert.match(prompt, /辅助证据：四时春季，体卦相，用卦旺；起卦法数字起卦法；起卦数字123/);
  assert.match(prompt, /外应置信度：低：当前非外应起卦，外应只作补充提示，不进入主证/);
  assert.match(prompt, /应期候选：动爻第3爻：可作阶段、层位或触发点，不可单独换算绝对日期/);
  assert.match(prompt, /应期优先级：一级体用：先看体用生克与四时旺衰定快慢和承受力/);
  assert.match(prompt, /春季体卦相、用卦旺：先判断快慢与承受力/);
  assert.match(prompt, /互卦泽风大过主过程，变卦地火明夷主结果/);
  assert.match(prompt, /类象权重：体卦离火为主观承载，用卦震木为外部事务/);
  assert.match(prompt, /互卦泽风大过看过程压力或转折，变卦地火明夷看结果落点/);
  assert.match(prompt, /起卦法数字起卦法决定取象来源，不单独压过体用主轴/);
  assert.match(prompt, /补充提示：暂无外应，以数字起卦为主/);
  assert.doesNotMatch(prompt, /关键提示：体卦离（火）；用卦震（木）；动爻第3爻/);
  assert.doesNotMatch(prompt, /外应：暂无外应，以数字起卦为主/);
  assert.doesNotMatch(prompt, /起卦法number/);
  assert.doesNotMatch(prompt, /起卦方式：number/);
  assert.doesNotMatch(prompt, /起卦类别：number/);
  assert.doesNotMatch(prompt, /- 起卦方式：数字起卦法/);
  assert.doesNotMatch(prompt, /- 起卦数字：123/);
  assert.match(prompt, /第3爻.*动.*属体/);
});

test('梅花外应起卦会带外应映射与原始外应信息', () => {
  const data = {
    ...createData('meihua'),
    calculation: {
      method: '外应起卦法',
      methodKey: 'external',
      externalSummary: '见南方来人携红色文书而来，可参离火文明之象。',
      externalOmens: {
        direction: '南',
        person: '长女',
        object: '火电文书',
        sound: '清脆笑语',
        color: '赤紫',
        count: 5,
      },
      externalMappedOmens: [
        { source: 'direction', label: '方向南', trigram: '离', trigramIndex: 3 },
        { source: 'person', label: '长女', trigram: '巽', trigramIndex: 4 },
        { source: 'object', label: '火电文书', trigram: '离', trigramIndex: 3 },
      ],
    },
  } satisfies DivinationData;

  const prompt = buildDivinationPrompt(
    'meihua',
    '这件事接下来该怎么推进？',
    data,
    createSupplementaryInfo(),
  );

  assert.match(prompt, /辅助证据：四时春季，体卦相，用卦旺；起卦法外应起卦法/);
  assert.match(prompt, /外应：见南方来人携红色文书而来，可参离火文明之象/);
  assert.match(prompt, /外应映射：方向南->离卦（3）；长女->巽卦（4）；火电文书->离卦（3）/);
  assert.match(prompt, /外应明细：方向南；人物长女；物象火电文书；声音清脆笑语；颜色赤紫；数量5/);
  assert.match(prompt, /类象权重：体卦离火为主观承载，用卦震木为外部事务/);
  assert.match(prompt, /外应已映射方向南取离、长女取巽、火电文书取离/);
  assert.doesNotMatch(prompt, /补充提示：见南方来人携红色文书而来，可参离火文明之象。/);
  assert.doesNotMatch(prompt, /起卦类别：external/);
  assert.doesNotMatch(prompt, /- 起卦方式：外应起卦法/);
  assert.doesNotMatch(prompt, /- 起卦数字：/);
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
  assert.match(
    prompt,
    /主轴证据：起因留连（拖延、牵扯、反复）；过程赤口（争执、误会、情绪）；结果小吉（助力、可成、渐进）/,
  );
  assert.match(
    prompt,
    /辅助证据：起因提示事情容易拖延反复，推进时会被旧问题牵扯。；过程提示容易出现争执、误会、口舌或情绪冲撞。；结果提示事情整体可成，常有助力，但更适合渐进推进。/,
  );
  assert.match(prompt, /问题映射：当前整体偏可成，适合稳步推进，慢慢拿结果。/);
  assert.match(prompt, /应期候选：起因留连：偏拖延反复，常需先清旧账或等阻滞松动/);
  assert.match(prompt, /过程赤口：偏口舌冲突，先避争执再看进展/);
  assert.match(prompt, /结果小吉：偏渐进有助力，适合小步推进并复盘/);
  assert.match(prompt, /主判断小吉：有助力，只适合短期复盘，不作长期命运定论/);
  assert.match(prompt, /复盘信号：先核实起因留连对应的拖延、牵扯、反复是否已出现/);
  assert.match(prompt, /行动建议等级：稳步推进：有助力但不宜贪快，先拿小结果/);
  assert.match(prompt, /复盘窗口：先观察起因留连是否已出现/);
  assert.match(prompt, /过程若出现赤口对应的争执、误会、情绪，说明卡点已显化/);
  assert.match(prompt, /结果以小吉对应的助力、可成、渐进作为短期复盘指标/);
  assert.match(prompt, /- 起课方式：数字起课/);
  assert.match(
    prompt,
    /- 起因：留连，关键词：拖延、牵扯、反复；建议：不要急着定论，先清理卡点与未处理事项。/,
  );
  assert.match(
    prompt,
    /- 结果：小吉，关键词：助力、可成、渐进；建议：可以推进，但要一步一步拿结果，不宜贪快。/,
  );
});

test('小六壬专项灵感框架会把感情题收紧到关系走向与行动建议', () => {
  const prompt = buildDivinationPrompt(
    'xiaoliuren',
    '这段关系接下来整体会往哪边走？',
    createData('xiaoliuren'),
    createSupplementaryInfo(),
    { xiaoliurenFocus: 'emotion' },
  );

  assert.match(prompt, /【分析思路】/);
  assert.match(prompt, /先以结果宫位定关系走向，再回看起因、过程解释情绪和沟通卡点/);
  assert.match(
    prompt,
    /请围绕起因、过程、结果三段宫位变化，判断关系走向、沟通卡点与该主动、缓和还是止损/,
  );
  assert.match(prompt, /要明确写出关系走向、沟通风险，以及现在更适合主动、缓和、等待还是止损。/);
});

test('梅花专项灵感框架会把决策题收紧到顺势方向与风险点', () => {
  const prompt = buildDivinationPrompt(
    'meihua',
    '我现在做这个决定，方向对不对？',
    createData('meihua'),
    createSupplementaryInfo(),
    { meihuaFocus: 'decision' },
  );

  assert.match(prompt, /【分析思路】/);
  assert.match(prompt, /重点比较当前选择是否顺势、最容易忽略的风险在哪里/);
  assert.match(
    prompt,
    /请围绕体用关系、互卦过程、变卦结果和四时旺衰，判断当前选择是否顺势、风险点在哪、下一步更适合怎么走/,
  );
  assert.match(prompt, /要明确写出哪个方向更顺、最大风险点在哪里，以及下一步先做什么。/);
});

test('奇门专项灵感框架会把时机题收紧到宜动宜守与时间窗口', () => {
  const prompt = buildDivinationPrompt(
    'qimen',
    '这件事现在是不是合适的行动时机？',
    createData('qimen'),
    createSupplementaryInfo(),
    { qimenFocus: 'timing' },
  );

  assert.match(prompt, /【分析思路】/);
  assert.match(
    prompt,
    /先看值符值使与用门落宫判断当前时机，再结合空亡、马星和门星神干判断宜动宜守与更合适的时间窗口。/,
  );
  assert.match(
    prompt,
    /请围绕值符值使、用门落宫、门星神干组合、空亡与马星变化，判断当前时机、宜动宜守与更合适的时间窗口/,
  );
  assert.match(prompt, /要明确写出现在是否宜动、宜守或宜等，以及对应的时机依据。/);
});

test('大六壬提示词会按八字式结构带入分析思路', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '我现在要不要换工作？',
    createData('liuren'),
    createSupplementaryInfo(),
    { liurenTemplate: 'shiye' },
  );

  assertLiurenPromptStructure(prompt);
  assert.match(prompt, /【排盘信息】/);
  assert.match(prompt, /【分析对象】\n分析对象：大六壬起课盘/);
  assert.match(prompt, /【解读范围】\n解读范围：只判断本课对应问题的当前走势/);
  assert.match(prompt, /【分析思路】/);
  assert.match(prompt, /分析类型：事业断课/);
  assert.match(prompt, /关注重点：岗位路径、协作阻力、窗口时机/);
  assert.match(prompt, /取证顺序：先按知一\/比用看发用亥乘贵人，再看三传推进/);
  assert.match(prompt, /回答格式：先给结论，再列 2 到 4 条关键依据和建议；不要复述完整课盘。/);
  assert.doesNotMatch(prompt, /【断课要点】/);
  assert.doesNotMatch(prompt, /建议展开顺序：/);
  assert.doesNotMatch(prompt, /起因判断：/);
  assert.doesNotMatch(prompt, /过程判断：/);
  assert.doesNotMatch(prompt, /结果判断：/);
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
  assert.match(prompt, /地盘：子、丑、寅/);
  assert.match(prompt, /天盘：丑上子乘青龙；寅上丑乘天空；卯上寅乘白虎/);
  assert.match(prompt, /日干寄宫：丙寄巳/);
  assert.match(prompt, /课传主线：取传比用法；传态递传；发用亥乘贵人；末传寅/);
  assert.match(prompt, /古籍依据：《大六壬大全》九宗门取传法：知一\/比用/);
  assert.match(prompt, /四课：一课亥临卯乘贵人，水生木/);
  assert.match(prompt, /三传：初传亥乘贵人，生扶，起因来自外部推动/);
  assert.match(prompt, /旬空：戌、亥，命中初传亥主虚而不实，待填实再看/);
  assert.match(prompt, /简要提示：四课由生入克，先得助后承压，再转协同。/);
  assert.match(prompt, /取证顺序：/);
  assert.doesNotMatch(prompt, /断课抓手：/);
  assert.doesNotMatch(prompt, /发用主线：/);
  assert.doesNotMatch(prompt, /主线证据：/);
  assert.doesNotMatch(prompt, /类神取用：/);
  assert.doesNotMatch(prompt, /三传阶段：/);
  assert.doesNotMatch(prompt, /天盘摘要：/);
});

test('大六壬提示词的任务与输出要求应和断课要点口径一致，不重复强制逐段作答', () => {
  const prompt = buildDivinationPrompt(
    'liuren',
    '这件事接下来该怎么推进？',
    createData('liuren'),
    createSupplementaryInfo(),
  );

  assert.doesNotMatch(prompt, /务必按【断课要点】逐段作答/);
  assert.match(
    prompt,
    /【任务】\n请先围绕【问题】给出判断，再按古籍取传法、发用、三传推进、四课背景和辅证说明理由。\n需要明确事情会如何演变、卡点在哪、下一步先做什么；应期只能写课传支持的触发条件。/,
  );
  assert.match(
    prompt,
    /【输出要求】\n先直接回答【问题】，再列最关键的 2 到 4 个判断点。\n每个判断点只写必要课传依据、触发条件与现实建议。\n应期必须来自发用、三传、空亡或明确神煞；证据不足就写条件，不硬给日期。/,
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

  assert.match(prompt, /课体：龙德卦、连珠卦/);
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

  assert.match(prompt, /分析类型：通用断课/);
  assert.match(prompt, /关注重点：核心目标、现实阻力、下一步动作/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

test('塔罗提示词会给出牌阵主轴、位置关系与行动建议抓手', () => {
  const prompt = buildDivinationPrompt(
    'tarot',
    '这件事接下来该怎么推进？',
    createData('tarot'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /断牌抓手：先统合牌阵主轴，再看关键位置、正逆位变化与牌面呼应/);
  assert.match(prompt, /主轴证据：现状恋人（正位）；建议战车（逆位）/);
  assert.match(prompt, /辅助证据：牌阵单牌指引；现状关键词选择、连接；建议关键词控制、节奏/);
  assert.match(prompt, /牌组层级：大阿卡纳恋人、战车定人生主题或关键转折/);
  assert.match(prompt, /元素数字：现状恋人为大阿卡纳6号；建议战车为大阿卡纳7号/);
  assert.match(prompt, /宫廷人物：未见宫廷人物牌，不把牌面强行解释成特定人物/);
  assert.match(prompt, /牌面冲突：牌阵链路：现状恋人正位；建议战车逆位/);
  assert.match(prompt, /逆位阻滞：建议战车提示控制、节奏/);
  assert.match(prompt, /行动牌：建议战车逆位，先处理阻滞/);
  assert.match(prompt, /叙事权重：主牌现状恋人正位、建议战车逆位先定叙事主轴/);
  assert.match(prompt, /逆位建议战车优先视为阻滞、内化或延迟/);
  assert.match(prompt, /权重口径：先牌位，后正逆位，再用关键词互证/);
  assert.match(prompt, /牌间叙事：现状先提示选择与连接，建议位再看如何调整控制与节奏/);
  assert.match(prompt, /现实边界：塔罗只能给当下倾向、心理动力、互动节奏和行动建议/);
  assert.doesNotMatch(prompt, /关键提示：重点关注各位置含义、正逆位变化与牌面之间的呼应关系/);
  assert.match(prompt, /- 现状：恋人（正位），关键词：选择、连接/);
  assert.match(prompt, /- 建议：战车（逆位），关键词：控制、节奏/);
});

test('灵签提示词会给出签诗主旨、典故映射与宜进宜守抓手', () => {
  const prompt = buildDivinationPrompt(
    'ssgw',
    '这件事接下来该怎么推进？',
    createData('ssgw'),
    createSupplementaryInfo(),
  );

  assert.match(prompt, /断签抓手：先定签诗主旨，再看典故映射、现实处境与宜进宜守/);
  assert.match(prompt, /主轴证据：签诗“前路迢迢莫强求，且看云开月自明。”/);
  assert.match(
    prompt,
    /辅助证据：签题《刘备借荆州》；典故刘备借荆州后多方周旋，需审时度势。；解签宜守正待时，不可躁进。/,
  );
  assert.match(prompt, /逐句签意：第1句前路迢迢莫强求；第2句且看云开月自明/);
  assert.match(prompt, /事项分类：按用户问题映射到求事、关系、事业、财务或行程/);
  assert.match(prompt, /吉凶层级：中平偏守，等待转明/);
  assert.match(prompt, /宜忌条件：宜守正待时；不可躁进/);
  assert.match(prompt, /迟速判断：偏慢待时；守待信号[^；]*云开[^；]*；阻滞信号不可、躁进/);
  assert.match(prompt, /应期须等现实阻力松动或用户指定期限内出现转明信号/);
  assert.match(prompt, /典故映射：已按所给典故作现实处境类比/);
  assert.match(prompt, /签意取舍：逐句线索：前路迢迢莫强求；且看云开月自明/);
  assert.match(prompt, /取舍方向：宜守待时，先稳局势再推进/);
  assert.match(prompt, /宜：守正待时/);
  assert.match(prompt, /忌：躁进/);
  assert.match(prompt, /复盘条件：以签诗和典故对应的现实条件是否出现为准，不硬换算绝对日期/);
  assert.match(prompt, /事项映射：吉凶层级：偏守待，缓中有转机/);
  assert.match(prompt, /事项重点：前路迢迢莫强求；且看云开月自明/);
  assert.match(prompt, /守进条件：见阻力松动、信息转明或现实周旋空间出现后再推进/);
  assert.match(prompt, /现实映射：当前更宜先守正待时，再等局势转明，不宜躁进强求/);
  assert.doesNotMatch(prompt, /关键提示：签诗“前路迢迢莫强求，且看云开月自明。”/);
  assert.match(prompt, /- 签号：第18签/);
  assert.match(prompt, /- 签题：刘备借荆州/);
  assert.match(prompt, /- 典故：刘备借荆州后多方周旋，需审时度势。/);
  assert.match(prompt, /- 解签：宜守正待时，不可躁进。/);
});

test('塔罗小阿卡纳和宫廷牌会输出数字阶段、元素领域与人物姿态', () => {
  const prompt = buildDivinationPrompt(
    'tarot',
    '这个合作应该怎么推进？',
    {
      spreadType: 'three',
      spreadName: '三牌指引',
      cards: [
        {
          id: 11,
          name: '权杖三',
          position: '现状',
          reversed: false,
          keywords: ['规划', '扩展'],
        },
        {
          id: 12,
          name: '圣杯骑士',
          position: '对方',
          reversed: false,
          keywords: ['邀约', '表达'],
        },
        {
          id: 13,
          name: '星币十',
          position: '结果',
          reversed: true,
          keywords: ['长期', '资源'],
        },
      ],
      timestamp: Date.now(),
    },
    createSupplementaryInfo(),
  );

  assert.match(
    prompt,
    /牌组层级：小阿卡纳权杖三、星币十定现实执行层；宫廷牌圣杯骑士定人物角色或互动方式/,
  );
  assert.match(
    prompt,
    /现状权杖三属权杖火元素（行动、意志、成长和主动推进），数字三（协作、成形、初步扩展）/,
  );
  assert.match(
    prompt,
    /对方圣杯骑士为骑士宫廷牌（行动、推进、追逐和外部变化），属圣杯水元素（情感、关系、感受和承接）/,
  );
  assert.match(
    prompt,
    /结果星币十属星币土元素（资源、金钱、身体和现实落地），数字十（完成、收束、压力满载或结果落地）/,
  );
  assert.match(
    prompt,
    /宫廷人物：对方圣杯骑士提示骑士式人物、身份或互动姿态（行动、推进、追逐和外部变化；圣杯偏情感、关系、感受和承接）/,
  );
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

  assert.equal((prompt.match(/韩信受胯下之辱，先忍后成大业。/g) ?? []).length, 2);
  assert.match(
    prompt,
    /辅助证据：签题《典故去重测试》；典故韩信受胯下之辱，先忍后成大业。；解签宜暂避锋芒，等待时机。/,
  );
  assert.match(prompt, /- 典故：韩信受胯下之辱，先忍后成大业。/);
  assert.doesNotMatch(prompt, /补充提示：韩信受胯下之辱，先忍后成大业。/);
});

test('雷诺曼提示词应以前三张核心牌作为主轴，不额外插入泛化说明', () => {
  const prompt = buildDivinationPrompt('lenormand', '这件事接下来该怎么推进？', {
    spreadType: 'relationship',
    spreadName: '关系牌阵',
    cards: [
      { position: '现状', name: '骑士', keywords: ['消息', '推进'], meaning: '事情开始动起来。' },
      { position: '阻碍', name: '山', keywords: ['阻碍', '拖延'], meaning: '进程会被卡住。' },
      { position: '结果', name: '太阳', keywords: ['明朗', '成功'], meaning: '后续有机会转明。' },
    ],
    timestamp: Date.now(),
  });

  assert.match(prompt, /断牌抓手：先看核心牌，再看左右邻牌如何补充事件、人、消息、阻碍或结果。/);
  assert.match(prompt, /主轴证据：现状骑士；阻碍山；结果太阳/);
  assert.match(
    prompt,
    /核心牌：1号核心现状骑士：消息、推进；2号核心阻碍山：阻碍、拖延；3号核心结果太阳：明朗、成功/,
  );
  assert.match(
    prompt,
    /事件链证据：现状骑士定主轴：消息、推进；阻碍山补阻力或修饰：阻碍、拖延；结果太阳看结果或落点：明朗、成功/,
  );
  assert.match(
    prompt,
    /相邻组合：骑士\+山：消息受阻、推进延迟，先等卡点松动；山\+太阳：阻力后转明，先难后有结果/,
  );
  assert.match(prompt, /人物牌：现状骑士；人物牌只能指向现实角色、互动姿态或消息来源/);
  assert.match(
    prompt,
    /事件牌：现状骑士提示消息、推进；阻碍山提示阻碍、拖延；结果太阳提示明朗、成功/,
  );
  assert.match(prompt, /时间牌：现状骑士、结果太阳可作节奏旁证；仍需用户期限或事件链支持/);
  assert.match(prompt, /镜像提示：现状骑士镜像结果太阳/);
  assert.match(prompt, /邻近关系：骑士 \/ 山右邻；骑士左邻 \/ 山 \/ 太阳右邻；山左邻 \/ 太阳/);
  assert.match(
    prompt,
    /组合权重：骑士\+山：消息受阻、推进延迟，先等卡点松动；山\+太阳：阻力后转明，先难后有结果/,
  );
  assert.match(prompt, /先看相邻组合是否构成现实事件，再看单牌关键词/);
  assert.doesNotMatch(prompt, /关键提示：雷诺曼偏现实事件判断/);
});

test('星盘提示词应直接给出太阳月亮上升和主要相位证据', () => {
  const prompt = buildDivinationPrompt(
    'astrolabe',
    '这件事接下来该怎么推进？',
    createAstrolabeData(),
  );

  assert.match(prompt, /【分析思路】/);
  assert.match(prompt, /先用太阳、月亮、上升定人格主轴，再补充最关键的落宫与主相位。/);
  assert.match(prompt, /主轴证据：太阳金牛座 29°；月亮处女座 08°；上升狮子座 12°/);
  assert.match(
    prompt,
    /辅助证据：主要相位太阳△月亮（三分，强度86%）；太阳合水星（合相，强度74%）；逆行无；格局土象偏强/,
  );
  assert.match(prompt, /不得编造已提供资料没有给出的星体、宫位、角点、相位、格局或行运范围/);
  assert.match(prompt, /来自本命结构、行运相位、落宫触发或分析对象范围/);
  assert.match(prompt, /每个重点都要写明星盘依据、触发条件与现实建议/);
  assert.doesNotMatch(prompt, /卦象|课传|盘局|牌阵|签诗|牌位/);
  assert.doesNotMatch(prompt, /解读抓手：先看太阳、月亮、上升建立人格主轴/);
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
  assert.match(
    prompt,
    /【分析对象】已经给出本命、流年、流月或流日范围时，必须以该范围作为本次回答主范围/,
  );
  assert.match(prompt, /本命盘只定长期结构；若【分析对象】提供流年、流月或流日/);
  assert.match(prompt, /流年：看年度主题、阶段转向和全年最容易被触发的议题/);
  assert.match(prompt, /流月：看一个月内的推进窗口、情绪波动、沟通节奏和短期机会/);
  assert.match(prompt, /流日：看当天或极短期的执行、会面、沟通、签约、出行和避险/);
  assert.match(prompt, /星盘回答必须区分本命底色与行运触发/);
  assert.doesNotMatch(prompt, /【应期判断方法】/);
  assert.ok(prompt.indexOf('【分析对象】') < prompt.indexOf('【占卜信息】'));
  assert.ok(prompt.indexOf('【分析对象】') < prompt.indexOf('【行运时间尺度】'));
  assert.ok(prompt.indexOf('【行运时间尺度】') < prompt.indexOf('【占卜信息】'));
});
