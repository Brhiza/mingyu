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
import { drawTarotSpread } from 'mingyu-core/divination/tarot';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { analyzeBaZhai } from '@core/ba_zhai';
import { generateResidentialFengshui } from '@core/residential_fengshui';
import { generateXuanKong } from '@core/xuan_kong';
import { getZodiacYearFortune, rebuildAuditedZodiacData } from '@core/zodiac';
import { generateTaiyi } from '@core/taiyi';
import { buildMetaphysicsPrompt } from '../src/lib/metaphysics-prompt';

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
const COMMON_PROJECT_QUESTION = '我现在应该继续推进这个项目，还是先调整策略再行动？';
const COMMON_PROJECT_SUPPLEMENT = '正在做一个需要投入时间和资金的新项目，想判断行动节奏。';
const COMMON_PROJECT_SUPPLEMENT_FIELD = `现实背景：${COMMON_PROJECT_SUPPLEMENT}`;

function buildCommonProjectInputSummary(extra: string) {
  return `问题：${COMMON_PROJECT_QUESTION}；${extra}；补充：男，1990年生；现实背景：${COMMON_PROJECT_SUPPLEMENT}`;
}

function withCommonProjectSupplementRequired(fields: string[]) {
  return [COMMON_PROJECT_SUPPLEMENT_FIELD, ...fields];
}

const REQUIRED_SAMPLE_FIELDS: RequiredSampleFields[] = [
  {
    sampleName: '八字排盘',
    requiredFields: ['【传统判断规则】', '【传统依据】', '【分析对象】', '【岁运重点】'],
  },
  {
    sampleName: '紫微斗数',
    requiredFields: ['【传统判断规则】', '【传统依据】', '【分析对象】', '【本命资料】'],
  },
  {
    sampleName: '星盘',
    requiredFields: ['【传统判断规则】', '【传统依据】', '【分析对象】', '行运'],
  },
  {
    sampleName: '六爻',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '应期',
    ]),
  },
  {
    sampleName: '梅花易数',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '体用关系',
    ]),
  },
  {
    sampleName: '奇门遁甲',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '值符',
      '值使',
      '旬空',
      '马星',
    ]),
  },
  {
    sampleName: '大六壬',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '【排盘信息】',
      '发用',
      '三传',
      '四课',
    ]),
  },
  {
    sampleName: '小六壬',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '顺数轨迹',
      '占得宫',
      '歌诀原文',
      '计算链',
      '来源状态',
      '解释限制',
    ]),
  },
  {
    sampleName: '塔罗牌',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '关键词',
    ]),
  },
  {
    sampleName: '雷诺曼',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '关键词',
    ]),
  },
  {
    sampleName: '三山国王灵签',
    requiredFields: withCommonProjectSupplementRequired([
      '【传统判断规则】',
      '【传统依据】',
      '签诗',
      '核心寓意',
      '事业',
      '财运',
      '感情',
      '学业',
      '健康',
      '行动建议',
    ]),
  },
  {
    sampleName: '择日',
    requiredFields: [
      '择日补充：计划在六月上旬签署项目合作合同，希望兼顾推进效率、资金安全和双方合作稳定。',
      '【传统判断规则】',
      '【传统依据】',
      '参与人',
      '可用时段',
    ],
  },
  {
    sampleName: '八宅风水',
    requiredFields: [
      '【当前时间】',
      '【传统判断规则】',
      '【传统依据】',
      '命卦八宫传统标签',
      '宅卦八宫传统标签',
    ],
  },
  {
    sampleName: '住宅风水',
    requiredFields: [
      '【当前时间】',
      '【传统判断规则】',
      '【传统依据】',
      '资料与复核提示',
      '结构化证据',
    ],
  },
  {
    sampleName: '玄空飞星',
    requiredFields: [
      '【当前时间】',
      '【传统判断规则】',
      '【传统依据】',
      '运盘',
      '山盘',
      '向盘',
      '结构化证据',
    ],
  },
  {
    sampleName: '生肖流年',
    requiredFields: ['【当前时间】', '【传统判断规则】', '【传统依据】', '太岁'],
  },
  {
    sampleName: '太乙神数',
    requiredFields: [
      '【当前时间】',
      '【传统判断规则】',
      '【传统依据】',
      '核心宫位',
      '主客定算',
      '将参',
      '十六神',
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
    '说明：本文件由项目本地函数真实生成，覆盖八字排盘、紫微斗数、星盘、六爻、梅花易数、奇门遁甲、大六壬、小六壬、塔罗牌、雷诺曼、三山国王灵签、择日、八宅风水、住宅风水、玄空飞星、生肖流年、太乙神数。七政四余完整盘在传统坐标链校勘完成前暂停输出，因此不生成可交给模型解读的样本。八字、紫微斗数、星盘测试资料取自比赛原题公开出生信息，未读取正确答案文件。',
    '',
    '## 审计原则',
    '',
    '使用场景：以下提示词会由用户直接复制到外部在线 AI 中解读，外部 AI 不知道本仓库、页面、接口、内部实现或生成过程。',
    '',
    '硬性要求：每份提示词必须像用户手动写成的完整任务书，独立包含当前时间、盘面资料、问题、任务、证据要求、输出要求和必要边界；提示词正文不得出现本项目、算法返回、本模块、接口、代码、调试、系统提示词等工程语境。',
    '',
    '理由：工程语境会让外部 AI 误以为需要理解或评价软件实现，也可能使它依赖并不存在的上下文，导致偏离盘面和用户问题。改用“本盘”“上方资料”“推算口径”“资料边界”等自然表达，能让解读只围绕已提供事实展开。',
    '',
    '完整性标准：不以字数作为通过条件；已有信息充分的体系不机械加长，较短体系应优先补入真实可用的结构化资料、主证、辅证、反证或限制、精度边界和现实边界，不得编造排盘未提供的内容。',
    '',
    '缺项处理：现有排盘能力可以直接得出的信息，应先写入任务书再交给外部 AI；确实无法生成的内容不在提示词正文罗列缺项清单，改用“只解读本命结构”“应期只到流年层级”等正向范围表达。提示词只负责提供完整任务与依据，不替外部 AI 规定可使用的能力。',
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
    {
      label: '工程语境',
      pattern:
        /本项目|当前项目|项目(?:统一|明确)|本地(?:算法|系统|实现|程序|代码)|算法(?:结果|返回|生成|实际)|本模块|当前数据|实际返回|未计算|资料包|提示词规则|系统提示词|在线\s*AI|工程|接口|\bAPI\b|\bMCP\b|调试|用户补充：/,
    },
    {
      label: '外部补充或缺项清单',
      pattern:
        /本次没有提供|当前资料没有|不包含|尚不支持|暂不支持|资料不足|需要补充|请补充|补充资料/,
    },
  ];

  samples.forEach((sample) => {
    const duplicatedSections = duplicateSectionNames(sample.prompt);
    if (duplicatedSections.length > 0) {
      leakedMessages.push(`${sample.name} 出现重复 section：${duplicatedSections.join('、')}`);
    }

    forbiddenPatterns.forEach(({ label, pattern }) => {
      const matched = sample.prompt.match(pattern);
      if (matched) {
        const matchedLine = sample.prompt
          .split('\n')
          .find((line) => line.includes(matched[0]))
          ?.trim();
        leakedMessages.push(
          `${sample.name} 出现异常占位或工程字段：${label}（命中“${matched[0]}”${matchedLine ? `；所在行“${matchedLine}”` : ''}）`,
        );
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
    const baziPrompt = buildBaziPromptForResult({
      result: baziResult,
      topic: 'general',
      mode: 'framework',
      fortuneSelection: { scope: 'year', year: 1993 },
      question:
        '请根据命例一作答：Q1 出生家境如何？Q2 婚姻如何？Q3 年轻时何种工作？Q4 1980年发生何事？Q5 1993年发生何事？每题从 A/B/C/D 中给出最可能选项，并说明依据。',
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
    const commonQuestion = COMMON_PROJECT_QUESTION;
    const commonInfo = {
      gender: '男' as const,
      birthYear: 1990,
      userSupplement: COMMON_PROJECT_SUPPLEMENT,
    };

    const liuyaoData = withSeed(20260518, () => generateLiuyao(auditDate));
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
      method: 'time',
      customDate: auditDate,
    });
    const xiaoliurenPrompt = buildDivinationPrompt(
      'xiaoliuren',
      commonQuestion,
      xiaoliurenData,
      commonInfo,
      { xiaoliurenFocus: 'career' },
    );

    const tarotData = withSeed(20260519, () => drawTarotSpread('decision'));
    tarotData.timestamp = fixedNow.getTime();
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

    const bazhaiData = analyzeBaZhai({
      birthYear: 1990,
      birthMonth: 6,
      birthDay: 15,
      gender: 'male',
      sitMountain: '子',
    });
    const bazhaiPrompt = buildMetaphysicsPrompt(
      bazhaiData.prompt,
      '住宅的大门、卧室和书房应该怎样安排方位？',
      { method: 'bazhai', currentTime: fixedNow },
    );

    const zodiacData = rebuildAuditedZodiacData(getZodiacYearFortune('午', '甲辰'));
    const zodiacPrompt = buildMetaphysicsPrompt(
      zodiacData.prompt,
      '属马的人在甲辰年应该重点留意哪些方面？',
      { method: 'zodiac', currentTime: fixedNow },
    );

    const taiyiData = generateTaiyi({ year: 2026, scope: 'year' });
    const taiyiPrompt = buildMetaphysicsPrompt(
      taiyiData.prompt,
      '请分析 2026 年更适合主动推进还是稳守，以及应观察什么信号。',
      { method: 'taiyi', currentTime: fixedNow },
    );

    const residentialData = generateResidentialFengshui({
      birthYear: 1990,
      birthMonth: 6,
      birthDay: 15,
      gender: 'male',
      year: 2024,
      doorToInteriorDegree: 0,
    });
    const residentialPrompt = buildMetaphysicsPrompt(
      residentialData.prompt,
      '这套房的宅运和人宅关系怎么看？',
      { method: 'residential', currentTime: fixedNow },
    );

    const xuankongData = generateXuanKong({
      year: 2024,
      facingDegree: 0,
    });
    const xuankongPrompt = buildMetaphysicsPrompt(
      xuankongData.prompt,
      '这套宅的飞星结构与重点宫位怎么看？',
      { method: 'xuankong', currentTime: fixedNow },
    );

    return [
      {
        name: '八字排盘',
        source: CONTEST_SOURCE,
        inputSummary:
          '命例一：坤造，广东出生，西历 1951年11月14日巳时；问题为 Q1-Q5 多项选择；已选择 1993 年流年。',
        prompt: baziPrompt,
        notes: [
          '原题未给广东具体城市，因此本次八字样本未启用真太阳时。',
          '八字样本只传入 1993 年这一原始选择，由项目年限逻辑重建流年分析对象和岁运证据。',
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
          '当前已生成行运到本命相位、太阳返照近似时刻、次限推进与太阳弧证据。',
        ],
      },
      {
        name: '六爻',
        source: '项目算法真实起卦；固定时间 2026-05-19T10:30:00+08:00；固定随机种子 20260518。',
        inputSummary: buildCommonProjectInputSummary('模板：事业断卦'),
        prompt: liuyaoPrompt,
        notes: [],
      },
      {
        name: '梅花易数',
        source: '项目算法真实起卦；固定时间 2026-05-19T10:30:00+08:00；数字起卦 42。',
        inputSummary: buildCommonProjectInputSummary('焦点：决策；数字起卦 42'),
        prompt: meihuaPrompt,
        notes: [],
      },
      {
        name: '奇门遁甲',
        source: '项目算法真实排盘；固定时间 2026-05-19T10:30:00+08:00。',
        inputSummary: buildCommonProjectInputSummary('焦点：策略'),
        prompt: qimenPrompt,
        notes: ['本次直接调用核心提示词生成函数，使用了页面侧支持的 qimenFocus。'],
      },
      {
        name: '大六壬',
        source: '项目算法真实排盘；固定时间 2026-05-19T10:30:00+08:00。',
        inputSummary: buildCommonProjectInputSummary('模板：事业断课'),
        prompt: liurenPrompt,
        notes: [],
      },
      {
        name: '小六壬',
        source: '项目算法真实起课；固定时间 2026-05-19T10:30:00+08:00；时间起课。',
        inputSummary: buildCommonProjectInputSummary('焦点：事业；时间起课'),
        prompt: xiaoliurenPrompt,
        notes: [],
      },
      {
        name: '塔罗牌',
        source: '项目牌组真实抽牌；固定随机种子 20260519；决策牌阵。',
        inputSummary: buildCommonProjectInputSummary('牌阵：决策'),
        prompt: tarotPrompt,
        notes: [],
      },
      {
        name: '雷诺曼',
        source: '项目牌组真实抽牌；固定随机种子 20260520；选择牌阵。',
        inputSummary: buildCommonProjectInputSummary('牌阵：选择'),
        prompt: lenormandPrompt,
        notes: [],
      },
      {
        name: '三山国王灵签',
        source: '项目签文库真实抽签；固定随机种子 20260521。',
        inputSummary: buildCommonProjectInputSummary('随机抽签'),
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
      {
        name: '八宅风水',
        source: '项目八宅大游年算法真实生成；命卦和宅卦均输出完整八宫。',
        inputSummary: '男，1990年6月15日生；坐山为子山；问题为住宅大门、卧室和书房方位安排。',
        prompt: bazhaiPrompt,
        notes: ['本样本只有坐山和命卦资料，未假定具体户型、门窗、灶厕或外部形峦。'],
      },
      {
        name: '住宅风水',
        source: '项目住宅风水统一入口真实生成；八宅与玄空分层并列，不合成总分。',
        inputSummary: '男，1990年6月15日生；建造/起运年 2024；门向 0°；问题为宅运与人宅关系。',
        prompt: residentialPrompt,
        notes: ['统一入口样本展示八宅与玄空分层合参，不代表装修吉凶保证。'],
      },
      {
        name: '玄空飞星',
        source: '项目玄空飞星 v1 算法真实生成；输出运盘、山盘、向盘与到山到向。',
        inputSummary: '建造/起运年 2024；朝向 0°；问题为飞星结构与重点宫位。',
        prompt: xuankongPrompt,
        notes: ['当前样本只审计飞星盘面结构，不扩展形峦或全流派替卦。'],
      },
      {
        name: '生肖流年',
        source: '项目生肖流年算法真实生成；复用干支五行及值、冲、刑、害、破关系。',
        inputSummary: '生肖午马；流年甲辰；问题为年度重点注意事项。',
        prompt: zodiacPrompt,
        notes: ['生肖样本只代表出生年支层级，不包含完整四柱和大运。'],
      },
      {
        name: '太乙神数',
        source: '项目太乙年计七十二局立成真实生成；展示 2026 年年计。',
        inputSummary: '2026年太乙年计；问题为本年度的攻守与行动时宜。',
        prompt: taiyiPrompt,
        notes: [
          '当前只开放完成积年与七十二局立成校勘的年计。',
          '月、日、时计等待完整古籍历法链校勘，不生成近似盘审查样本。',
        ],
      },
    ];
  });
}

async function main() {
  const samples = await buildSamples();
  assertRequiredSampleFields(samples);
  assertSamplePromptsAreClean(samples);
  const outputDir = resolve('.local', 'reports', 'prompt-audit');
  mkdirSync(outputDir, { recursive: true });

  const samplePath = resolve(outputDir, '2026-05-19-全部提示词真实生成样本.md');

  writeFileSync(samplePath, buildPromptMarkdown(samples), 'utf8');

  console.log(`已生成：${samplePath}`);
}

await main();
