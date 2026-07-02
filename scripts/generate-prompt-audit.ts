import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { calculateFullZiweiChart, buildZiweiChartInput } from '../src/lib/full-chart-engine/ziwei';
import {
  buildBaziPromptForResult,
  buildZiweiPromptForRuntime,
} from '../src/lib/public-api/prompt-builders';
import { buildDivinationPrompt } from '../src/lib/divination/engine';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { generateLiuren } from 'mingyu-core/divination/liuren';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import { generateAstrolabe } from 'mingyu-core/divination/astrolabe';
import { buildAstrolabeScopeContext } from '../src/lib/astrolabe-scope';
import { drawRandomSign } from 'mingyu-core/divination/ssgw';
import { drawSpreadCards, getCardKeywords } from 'mingyu-core/divination/tarot';
import { baziCalculator } from '../src/utils/bazi/baziCalculator';
import { buildFortuneSelectionContext } from '../src/utils/bazi/fortuneSelection';
import {
  DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
  buildReverseBirthTimePrompt,
  buildThreePillarsProfile,
} from '../src/lib/birth-time-reverse';

type PromptSample = {
  name: string;
  inputSummary: string;
  source: string;
  prompt: string;
  notes: string[];
};

type RequiredSampleFields = {
  sampleName: string;
  requiredFields: string[];
};

const AUDIT_DATE = new Date('2026-05-19T10:30:00+08:00');
const AUDIT_DATE_TEXT = '2026年5月19日 10时30分（北京时间）';
const CUSTOM_DATE = '2026-05-19T10:30:00+08:00';
const CONTEST_SOURCE = 'docs/2025第十六届全球算命师比赛/00_原题目.md；本脚本未读取“正确答案.md”。';
const REQUIRED_SAMPLE_FIELDS: RequiredSampleFields[] = [
  {
    sampleName: '八字排盘',
    requiredFields: ['【分析对象】', '【岁运重点】', '【解读方法】'],
  },
  {
    sampleName: '反推时辰',
    requiredFields: [
      '【候选时辰】',
      '【已知线索】',
      '【线索权重】',
      '【排除理由】',
      '【下一轮追问】',
    ],
  },
  {
    sampleName: '紫微斗数',
    requiredFields: ['【分析对象】', '【本命资料】', '【解读方法】'],
  },
  {
    sampleName: '星盘',
    requiredFields: [
      '【分析对象】',
      '行运证据',
      '资料范围',
      '不包含太阳返照、次限推进、太阳弧',
      '时间边界',
    ],
  },
  {
    sampleName: '六爻',
    requiredFields: ['用神评分表', '原神忌神仇神', '应期优先级'],
  },
  {
    sampleName: '梅花易数',
    requiredFields: ['体用评分', '互变阶段', '外应置信度', '应期优先级'],
  },
  {
    sampleName: '奇门遁甲',
    requiredFields: ['主宫评分', '辅宫评分', '反证宫', '方位策略', '时间窗口'],
  },
  {
    sampleName: '大六壬',
    requiredFields: [
      '【排盘信息】',
      '取证顺序',
      '发用',
      '三传推进',
      '四课背景',
      '应期只能写课传支持的触发条件',
    ],
  },
  {
    sampleName: '小六壬',
    requiredFields: ['问题映射', '行动建议等级', '复盘窗口'],
  },
  {
    sampleName: '塔罗牌',
    requiredFields: ['牌组层级', '元素数字', '宫廷人物', '牌间叙事', '现实边界'],
  },
  {
    sampleName: '雷诺曼',
    requiredFields: [
      '用户补充：正在做一个需要投入时间和资金的新项目，想判断行动节奏。',
      '核心牌',
      '相邻组合',
      '人物牌',
      '事件牌',
      '时间牌',
      '镜像提示',
    ],
  },
  {
    sampleName: '三山国王灵签',
    requiredFields: ['逐句签意', '事项分类', '吉凶层级', '宜忌条件', '典故映射', '复盘条件'],
  },
  {
    sampleName: '择日',
    requiredFields: [
      '择日补充：计划在六月上旬签署项目合作合同，希望兼顾推进效率、资金安全和双方合作稳定。',
      '事项权重',
      '参与人适配',
      '禁忌降级',
      '现实约束',
      '可用时段边界',
    ],
  },
];

function withSeed<T>(seed: number, callback: () => T): T {
  const originalRandom = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };

  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

async function withFixedNow<T>(date: Date, callback: () => Promise<T>): Promise<T> {
  const RealDate = Date;
  const fixedTime = date.getTime();

  class FixedDate extends RealDate {
    constructor(...args: ConstructorParameters<DateConstructor>) {
      if (args.length === 0) {
        super(fixedTime);
      } else {
        super(...args);
      }
    }

    static now() {
      return fixedTime;
    }
  }

  globalThis.Date = FixedDate as DateConstructor;
  try {
    return await callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

function sectionNames(prompt: string) {
  return Array.from(prompt.matchAll(/^【([^】]+)】$/gm)).map((match) => match[1]);
}

function uniqueSectionNames(prompt: string) {
  return Array.from(new Set(sectionNames(prompt)));
}

function duplicateSectionNames(prompt: string) {
  const counts = new Map<string, number>();
  sectionNames(prompt).forEach((name) => {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([name, count]) => `${name}x${count}`);
}

function buildPromptMarkdown(samples: PromptSample[]) {
  const lines = [
    '# 项目全部提示词真实生成样本',
    '',
    `生成时间：${AUDIT_DATE_TEXT}`,
    '',
    '说明：本文件由项目本地函数真实生成，覆盖八字排盘、反推时辰、紫微斗数、星盘、六爻、梅花易数、奇门遁甲、大六壬、小六壬、塔罗牌、雷诺曼、三山国王灵签、择日。八字、紫微斗数、星盘测试资料取自比赛原题公开出生信息，未读取正确答案文件。',
    '',
  ];

  samples.forEach((sample, index) => {
    lines.push(`## ${index + 1}. ${sample.name}`);
    lines.push('');
    lines.push(`资料来源：${sample.source}`);
    lines.push('');
    lines.push(`输入摘要：${sample.inputSummary}`);
    lines.push('');
    lines.push(`提示词长度：${sample.prompt.length} 字符`);
    lines.push('');
    lines.push(`识别到的 section：${uniqueSectionNames(sample.prompt).join('、') || '无'}`);
    lines.push('');
    if (sample.notes.length > 0) {
      lines.push('生成备注：');
      sample.notes.forEach((note) => lines.push(`- ${note}`));
      lines.push('');
    }
    lines.push('完整提示词：');
    lines.push('');
    lines.push('```text');
    lines.push(sample.prompt);
    lines.push('```');
    lines.push('');
  });

  return lines.join('\n');
}

function assertRequiredSampleFields(samples: PromptSample[]) {
  const missingMessages: string[] = [];

  REQUIRED_SAMPLE_FIELDS.forEach(({ sampleName, requiredFields }) => {
    const sample = samples.find((item) => item.name === sampleName);
    if (!sample) {
      missingMessages.push(`缺少样本：${sampleName}`);
      return;
    }

    requiredFields.forEach((field) => {
      if (!sample.prompt.includes(field)) {
        missingMessages.push(`${sampleName} 缺少字段：${field}`);
      }
    });
  });

  if (missingMessages.length > 0) {
    throw new Error(`提示词真实样本字段检查失败：\n${missingMessages.join('\n')}`);
  }
}

function assertSamplePromptsAreClean(samples: PromptSample[]) {
  const leakedMessages: string[] = [];
  const forbiddenPatterns = [
    { label: 'undefined', pattern: /\bundefined\b/i },
    { label: 'null', pattern: /\bnull\b/i },
    { label: 'NaN', pattern: /\bNaN\b/ },
    { label: '[object Object]', pattern: /\[object Object\]/ },
    { label: 'PromptContext', pattern: /\bPromptContext\b/ },
    { label: 'report_key', pattern: /\breport_key\b/ },
    { label: 'selected_topic', pattern: /\bselected_topic\b/ },
    { label: 'scope_type', pattern: /\bscope_type\b/ },
  ];

  samples.forEach((sample) => {
    const duplicatedSections = duplicateSectionNames(sample.prompt);
    if (duplicatedSections.length > 0) {
      leakedMessages.push(`${sample.name} 出现重复 section：${duplicatedSections.join('、')}`);
    }

    forbiddenPatterns.forEach(({ label, pattern }) => {
      if (pattern.test(sample.prompt)) {
        leakedMessages.push(`${sample.name} 出现异常占位或工程字段：${label}`);
      }
    });
  });

  if (leakedMessages.length > 0) {
    throw new Error(`提示词真实样本质量检查失败：\n${leakedMessages.join('\n')}`);
  }
}

async function buildSamples(): Promise<PromptSample[]> {
  const fixedNow = AUDIT_DATE;

  return withFixedNow(fixedNow, async () => {
    const baziResult = baziCalculator.calculateBazi({
      gender: 'female',
      year: 1951,
      month: 11,
      day: 14,
      timeIndex: 5,
      isLunar: false,
      isLeapMonth: false,
      useTrueSolarTime: false,
      birthPlace: '广东（原题未给具体城市）',
    });
    const baziFortuneContext =
      buildFortuneSelectionContext(baziResult, {
        scope: 'year',
        year: 1993,
      }) ??
      buildFortuneSelectionContext(baziResult, {
        scope: 'year',
        year: 1980,
      });
    const baziPrompt = buildBaziPromptForResult({
      result: baziResult,
      topic: 'general',
      mode: 'framework',
      fortuneSelectionContext: baziFortuneContext,
      question:
        '请根据命例一作答：Q1 出生家境如何？Q2 婚姻如何？Q3 年轻时何种工作？Q4 1980年发生何事？Q5 1993年发生何事？每题从 A/B/C/D 中给出最可能选项，并说明依据。',
    });

    const reverseBirthTimeProfile = buildThreePillarsProfile({
      gender: 'male',
      dateType: 'solar',
      year: '1994',
      month: '10',
      day: '23',
      isLeapMonth: false,
    });
    const reverseBirthTimePrompt = buildReverseBirthTimePrompt({
      profile: reverseBirthTimeProfile,
      formData: {
        ...DEFAULT_REVERSE_BIRTH_TIME_FORM_DATA,
        bodyBuild: '匀称平稳',
        personalityStyle: '慢热谨慎',
        caregiverPattern: '更多由母亲照顾',
        educationLevel: '重点本科或名校路径',
        relationshipTiming: '恋爱偏晚',
        parentsMarriageNotes: '父母关系稳定',
        siblingNotes: '独生',
        workSystemNotes: '大公司工作几年后创业',
        careerTypeNotes: '技术岗后期带团队',
        keyYearsNotes: '2012 搬家，2020 换城市。',
        extraClueNotes: '小时候和母亲更亲，毕业后前两份工作都做不久，后来才慢慢稳定。',
      },
    });

    const ziweiRuntime = await calculateFullZiweiChart(
      buildZiweiChartInput({
        name: '命例四',
        gender: 'male',
        dateType: 'solar',
        year: '1993',
        month: '4',
        day: '8',
        timeIndex: '',
        isLeapMonth: false,
        useTrueSolarTime: true,
        birthHour: '23',
        birthMinute: '34',
        birthLongitude: '103.8198',
      }),
    );
    const ziweiPrompt = buildZiweiPromptForRuntime({
      result: ziweiRuntime,
      topic: 'life',
      scope: 'origin',
      mode: 'framework',
      question:
        '请根据命例四作答：Q16 儿时家庭情况？Q17 2001年发生何事？Q18 2022年后的职业行业情况？Q19 感情状况为何？Q20 抑郁症状最严重的年份？每题从 A/B/C/D 中给出最可能选项，并说明依据。',
    });

    const contestAstrolabe = generateAstrolabe({
      name: '命例四',
      gender: '男',
      year: '1993',
      month: '4',
      day: '8',
      hour: '23',
      minute: '34',
      latitude: '1.3521',
      longitude: '103.8198',
      timezone: '8',
      locationName: '新加坡',
      useTrueSolarTime: false,
    });
    const astrolabeScope = buildAstrolabeScopeContext(contestAstrolabe, 'yearly', '2022');
    const astrolabePrompt = buildDivinationPrompt(
      'astrolabe',
      '请围绕命例四在 2022 年后的职业方向、行业变化和情绪压力做判断，以已选择的流年分析对象为准，说明本命底色与流年触发分别是什么。',
      contestAstrolabe,
      undefined,
      { astrolabeTopic: 'career', astrolabeScopeText: astrolabeScope.promptText },
    );

    const auditDate = new Date(CUSTOM_DATE);
    const commonQuestion = '我现在应该继续推进这个项目，还是先调整策略再行动？';
    const commonInfo = {
      gender: '男' as const,
      birthYear: 1990,
      userSupplement: '正在做一个需要投入时间和资金的新项目，想判断行动节奏。',
    };

    const liuyaoData = generateLiuyao(auditDate);
    const liuyaoPrompt = buildDivinationPrompt('liuyao', commonQuestion, liuyaoData, commonInfo, {
      liuyaoTemplate: 'shiye',
    });

    const meihuaData = generateMeihua(auditDate, { method: 'number', number: 42 });
    const meihuaPrompt = buildDivinationPrompt(
      'meihua',
      commonQuestion,
      meihuaData,
      {
        ...commonInfo,
        meihuaSettings: { method: 'number', number: 42 },
      },
      { meihuaFocus: 'decision' },
    );

    const qimenData = generateQimen(auditDate);
    const qimenPrompt = buildDivinationPrompt('qimen', commonQuestion, qimenData, commonInfo, {
      qimenFocus: 'strategy',
    });

    const liurenData = generateLiuren(auditDate);
    const liurenPrompt = buildDivinationPrompt('liuren', commonQuestion, liurenData, commonInfo, {
      liurenTemplate: 'shiye',
    });

    const xiaoliurenData = generateXiaoliuren({
      method: 'number',
      number: 18,
      customDate: auditDate,
    });
    const xiaoliurenPrompt = buildDivinationPrompt(
      'xiaoliuren',
      commonQuestion,
      xiaoliurenData,
      commonInfo,
      { xiaoliurenFocus: 'career' },
    );

    const tarotDraw = withSeed(20260519, () => drawSpreadCards('decision'));
    const tarotData = {
      spreadType: tarotDraw.spreadType,
      spreadName: tarotDraw.spreadName,
      cards: tarotDraw.cards.map((item) => ({
        id: item.card.number,
        name: item.card.name,
        position: item.position,
        reversed: item.isReversed,
        keywords: getCardKeywords(item.card.name).split(','),
      })),
      timestamp: fixedNow.getTime(),
    };
    const tarotPrompt = buildDivinationPrompt('tarot', commonQuestion, tarotData, commonInfo);

    const lenormandData = withSeed(20260520, () => drawLenormandSpread('decision'));
    lenormandData.timestamp = fixedNow.getTime();
    const lenormandPrompt = buildDivinationPrompt(
      'lenormand',
      commonQuestion,
      lenormandData,
      commonInfo,
    );

    const ssgwData = withSeed(20260521, () => drawRandomSign());
    ssgwData.timestamp = fixedNow.getTime();
    const ssgwPrompt = buildDivinationPrompt('ssgw', commonQuestion, ssgwData, commonInfo);

    const almanacData = generateAlmanacSelection({
      topic: 'contract',
      startDate: '2026-06-01',
      endDate: '2026-06-15',
      participants: [
        {
          id: 'owner',
          name: '项目负责人',
          gender: '男',
          year: '1990',
          month: '5',
          day: '15',
          timeIndex: '6',
          dateType: 'solar',
          isLeapMonth: false,
        },
      ],
    });
    const almanacPrompt = buildDivinationPrompt(
      'almanac',
      '计划在六月上旬签署项目合作合同，希望兼顾推进效率、资金安全和双方合作稳定。',
      almanacData,
    );

    return [
      {
        name: '八字排盘',
        source: CONTEST_SOURCE,
        inputSummary: `命例一：坤造，广东出生，西历 1951年11月14日巳时；问题为 Q1-Q5 多项选择；已选择 ${baziFortuneContext?.displayText ?? '本命范围'}。`,
        prompt: baziPrompt,
        notes: [
          '原题未给广东具体城市，因此本次八字样本未启用真太阳时。',
          baziFortuneContext
            ? '八字样本通过项目年限选择逻辑写入流年分析对象，用于展示岁运解读方法。'
            : '未能找到对应流年上下文时退回本命范围。',
        ],
      },
      {
        name: '反推时辰',
        source: '项目反推时辰提示词真实生成；固定当前时间 2026-05-19T10:30:00+08:00。',
        inputSummary:
          '男命，公历 1994年10月23日，时辰未知；已补充体型、性格、家庭、学历、感情、工作和关键年份线索。',
        prompt: reverseBirthTimePrompt,
        notes: [
          '本样本只使用三柱和用户补充线索，不假定时柱。',
          '反推时辰提示词要求先输出候选、线索权重、排除理由和下一轮追问。',
        ],
      },
      {
        name: '紫微斗数',
        source: CONTEST_SOURCE,
        inputSummary:
          '命例四：男命，西元 1993年4月8日 23:34，新加坡出生；按经度 103.8198 启用紫微真太阳时；问题为 Q16-Q20 多项选择。',
        prompt: ziweiPrompt,
        notes: ['使用本命范围生成，未读取正确答案，也未额外按 2001、2022、2024 生成流年盘。'],
      },
      {
        name: '星盘',
        source: CONTEST_SOURCE,
        inputSummary: `命例四：男命，西元 1993年4月8日 23:34，新加坡出生；纬度 1.3521，经度 103.8198，UTC+8；已选择 ${astrolabeScope.displayText}。`,
        prompt: astrolabePrompt,
        notes: [
          '星盘样本通过项目年限选择逻辑写入流年分析对象和行运相位证据。',
          '当前已生成行运到本命相位，暂未生成太阳返照、次限或太阳弧。',
        ],
      },
      {
        name: '六爻',
        source: '项目算法真实起卦；固定时间 2026-05-19T10:30:00+08:00。',
        inputSummary: `问题：${commonQuestion}；模板：事业断卦；补充：男，1990年生。`,
        prompt: liuyaoPrompt,
        notes: [],
      },
      {
        name: '梅花易数',
        source: '项目算法真实起卦；固定时间 2026-05-19T10:30:00+08:00；数字起卦 42。',
        inputSummary: `问题：${commonQuestion}；焦点：决策。`,
        prompt: meihuaPrompt,
        notes: [],
      },
      {
        name: '奇门遁甲',
        source: '项目算法真实排盘；固定时间 2026-05-19T10:30:00+08:00。',
        inputSummary: `问题：${commonQuestion}；焦点：策略。`,
        prompt: qimenPrompt,
        notes: ['本次直接调用核心提示词生成函数，使用了页面侧支持的 qimenFocus。'],
      },
      {
        name: '大六壬',
        source: '项目算法真实排盘；固定时间 2026-05-19T10:30:00+08:00。',
        inputSummary: `问题：${commonQuestion}；模板：事业断课。`,
        prompt: liurenPrompt,
        notes: [],
      },
      {
        name: '小六壬',
        source: '项目算法真实起课；固定时间 2026-05-19T10:30:00+08:00；数字起课 18。',
        inputSummary: `问题：${commonQuestion}；焦点：事业。`,
        prompt: xiaoliurenPrompt,
        notes: [],
      },
      {
        name: '塔罗牌',
        source: '项目牌组真实抽牌；固定随机种子 20260519；决策牌阵。',
        inputSummary: `问题：${commonQuestion}。`,
        prompt: tarotPrompt,
        notes: [],
      },
      {
        name: '雷诺曼',
        source: '项目牌组真实抽牌；固定随机种子 20260520；选择牌阵。',
        inputSummary: `问题：${commonQuestion}；补充：男，1990年生。`,
        prompt: lenormandPrompt,
        notes: [],
      },
      {
        name: '三山国王灵签',
        source: '项目签文库真实抽签；固定随机种子 20260521。',
        inputSummary: `问题：${commonQuestion}。`,
        prompt: ssgwPrompt,
        notes: [],
      },
      {
        name: '择日',
        source: '项目黄历择日算法真实生成；日期范围 2026-06-01 至 2026-06-15。',
        inputSummary: '事项：签署项目合作合同；参与人：项目负责人，男，1990年5月15日午时，公历。',
        prompt: almanacPrompt,
        notes: [],
      },
    ];
  });
}

async function main() {
  const samples = await buildSamples();
  assertRequiredSampleFields(samples);
  assertSamplePromptsAreClean(samples);
  const outputDir = resolve('docs', 'prompt-audit');
  mkdirSync(outputDir, { recursive: true });

  const samplePath = resolve(outputDir, '2026-05-19-全部提示词真实生成样本.md');

  writeFileSync(samplePath, buildPromptMarkdown(samples), 'utf8');

  console.log(`已生成：${samplePath}`);
}

await main();
