import type {
  AlmanacData,
  AlmanacParticipantInput,
  AlmanacTopic,
  AstrolabeBirthInput,
  DivinationData,
  LenormandData,
  LenormandSpreadType,
  LiuyaoTemplateType,
  LiurenData,
  LiurenTemplateType,
  SupplementaryInfo,
  TarotData,
  TarotSpreadType,
  TaiyiResult,
  TaiyiScope,
  XiaoliurenDivinationMethod,
  JinkoujueDivinationMethod,
} from '../../../types/divination';
import type { DivinationMethodId } from 'mingyu-core/divination/config';
import type { HuangjiJingshiResult } from 'mingyu-core/huangji-jingshi';
import { convertTrueSolarTime, formatSolarDateTimeParts, TimeManager } from 'mingyu-core/calendar';
import { daysInSolarMonth } from '../../date-validation';
import {
  buildAstrolabeTopicTask,
  getAstrolabeDefaultQuestion,
  type AstrolabePromptTopic,
} from '../../astrolabe-prompts';
import {
  buildSection,
  buildSolarTimeInfoText,
  buildTimeInfoText,
  formatDivinationInfo,
  formatSupplementaryInfoSection,
} from './formatters';
import { buildTaskText } from 'mingyu-core/divination/engine/method-text';
import { buildLiurenTemplateText } from 'mingyu-core/divination/engine/liuren-template';
import { buildLiuyaoTemplateText } from 'mingyu-core/divination/engine/liuyao-template';
import { buildPromptGuidanceSections, buildPromptTask } from '../../prompt-guidance';
import { tarotSpreads } from 'mingyu-core/divination/tarot';
import { LENORMAND_SPREADS } from 'mingyu-core/divination/lenormand';
import { secureRandomInt } from 'mingyu-core/random';
import {
  formatPromptSchoolGuidance,
  getPromptSchoolSectionTitle,
  normalizePromptSchoolIds,
  buildTarotSpreadTask,
  type PromptSchoolMethod,
} from 'mingyu-core/prompt';

const CONCRETE_DIVINATION_METHODS: Array<Exclude<DivinationMethodId, 'random'>> = [
  'liuyao',
  'meihua',
  'xiaoliuren',
  'jinkoujue',
  'qimen',
  'liuren',
  'taiyi',
  'tarot',
  'ssgw',
  'lenormand',
];

function buildLiurenAnalysisObjectText(_data: LiurenData) {
  return '大六壬起课盘';
}

export type DivinationDraft = {
  method: DivinationMethodId;
  question: string;
  questionSource?: 'custom' | 'inspiration';
  currentSituation?: string;
  currentState?: string;
  knownFacts?: string;
  desiredOutcome?: string;
  constraints?: string;
  userSupplement?: string;
  gender: '' | '男' | '女';
  birthYear: string;
  divinationTimeMode?: 'current' | 'custom';
  customDivinationDate?: string;
  customDivinationTime?: string;
  divinationTimeStandard?: 'beijing' | 'true-solar';
  birthPlace?: string;
  birthLongitude?: string;
  birthLatitude?: string;
  liuyaoMethod?: 'time' | 'coins' | 'manual';
  liuyaoYaos?: Array<6 | 7 | 8 | 9>;
  liuyaoCoinThrows?: Array<{ coins: [2 | 3, 2 | 3, 2 | 3]; total: 6 | 7 | 8 | 9 }>;
  meihuaMethod: 'time' | 'number' | 'random' | 'timeTrigram';
  meihuaNumber: string;
  xiaoliurenMethod: XiaoliurenDivinationMethod;
  jinkoujueMethod: JinkoujueDivinationMethod;
  jinkoujueBranch: string;
  jinkoujueNumber: string;
  qimenMethod?: 'zhuanpan' | 'feipan';
  qimenScope?: 'hour' | 'day' | 'month' | 'year';
  qimenJuMethod?: 'chaibu' | 'zhirun';
  liuyaoTemplate: LiuyaoTemplateType;
  liurenTemplate: LiurenTemplateType;
  tarotSpread: TarotSpreadType;
  tarotMethod?: 'random' | 'manual' | 'interactive';
  tarotManualCards?: Array<{ id: number; reversed: boolean }>;
  tarotInteractiveSamples?: number[];
  ssgwMethod?: 'random' | 'manual';
  ssgwNumber?: string;
  almanacTopic: AlmanacTopic;
  almanacStartDate: string;
  almanacEndDate: string;
  almanacWeekendPreference?: 'any' | 'prefer' | 'avoid';
  almanacTimePreferences?: Array<'work-hours' | 'morning' | 'afternoon'>;
  almanacParticipants: AlmanacParticipantInput[];
  lenormandSpread: LenormandSpreadType;
  lenormandMethod?: 'random' | 'manual' | 'interactive';
  lenormandManualCardIds?: number[];
  lenormandInteractiveSamples?: number[];
  astrolabeName: string;
  astrolabeGender: '' | '男' | '女';
  astrolabeYear: string;
  astrolabeMonth: string;
  astrolabeDay: string;
  astrolabeHour: string;
  astrolabeMinute: string;
  astrolabeLatitude: string;
  astrolabeLongitude: string;
  astrolabeTimezone: string;
  astrolabeTopic?: AstrolabePromptTopic;
  taiyiYear: string;
  taiyiScope?: TaiyiScope;
  zhugeText: string;
  kongmingMethod?: 'random' | 'manual';
  kongmingPattern?: string;
};

export type DivinationSession = {
  method: Exclude<DivinationMethodId, 'random'>;
  requestedMethod: DivinationMethodId;
  question: string;
  prompt: string;
  data: DivinationData;
  timeContext?: DivinationTimeContext;
};

export type DivinationTimeContext = {
  standard: 'beijing' | 'true-solar';
  clockDateTime: string;
  effectiveDateTime: string;
  locationName?: string;
  longitude?: number;
  longitudeCorrectionMinutes?: number;
  equationOfTimeMinutes?: number;
  totalCorrectionMinutes?: number;
  crossesDate?: boolean;
  promptText: string;
};

export type BuildDivinationPromptOptions = {
  isCustomQuestion?: boolean;
  liuyaoTemplate?: LiuyaoTemplateType;
  liurenTemplate?: LiurenTemplateType;
  astrolabeTopic?: AstrolabePromptTopic;
  astrolabeScopeText?: string;
  schools?: readonly string[];
  timeContextText?: string;
};

export function buildDivinationPrompt(
  method: Exclude<DivinationMethodId, 'random'>,
  question: string,
  data: DivinationData,
  supplementaryInfo?: SupplementaryInfo,
  options: BuildDivinationPromptOptions = {},
) {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const liuyaoTemplate = options.liuyaoTemplate ?? 'general';
  const liurenTemplate = options.liurenTemplate ?? 'general';
  const astrolabeTopic =
    method === 'astrolabe' ? (options.astrolabeTopic ?? (isCustomQuestion ? 'chat' : 'life')) : '';
  const astrolabeScopeText = method === 'astrolabe' ? options.astrolabeScopeText?.trim() || '' : '';
  const normalizedQuestion =
    method === 'astrolabe'
      ? question.trim() || getAstrolabeDefaultQuestion(astrolabeTopic, { isCustomQuestion })
      : question;
  const timeInfo = method === 'astrolabe' ? buildSolarTimeInfoText(data) : buildTimeInfoText(data);
  const infoText = formatDivinationInfo(method, data, normalizedQuestion, supplementaryInfo, {
    liuyaoTemplate,
  });
  if (method === 'ssgw') {
    return infoText.replace(/^占法：三山国王灵签\n/u, '');
  }
  const supplementarySection = formatSupplementaryInfoSection(
    method,
    method === 'almanac' && supplementaryInfo?.userSupplement
      ? { ...supplementaryInfo, userSupplement: '' }
      : supplementaryInfo,
  );
  const liurenTemplateSection =
    method === 'liuren'
      ? buildSection('【问题范围】', buildLiurenTemplateText(liurenTemplate, data as LiurenData))
      : '';
  const liuyaoTemplateSection =
    method === 'liuyao'
      ? buildSection('【问题范围】', buildLiuyaoTemplateText(liuyaoTemplate))
      : '';
  const taskText =
    method === 'astrolabe' && !isCustomQuestion
      ? buildPromptTask(buildAstrolabeTopicTask(astrolabeTopic), 'astrolabe')
      : method === 'tarot'
        ? buildTarotSpreadTask(data as TarotData)
        : method === 'lenormand' && (data as LenormandData).cards.length === 1
          ? buildPromptTask('依据唯一牌位与基础牌义回答【问题】。', 'lenormand-single')
          : buildTaskText(method);
  const promptSchoolMethod = method === 'huangji' ? 'huangji-jingshi' : method;
  const selectedSchools = options.schools?.length
    ? normalizePromptSchoolIds(promptSchoolMethod as PromptSchoolMethod, options.schools)
    : [];
  const schoolText = selectedSchools.length
    ? formatPromptSchoolGuidance(promptSchoolMethod as PromptSchoolMethod, selectedSchools)
    : '';
  const schoolSection = schoolText
    ? buildSection(
        `【${getPromptSchoolSectionTitle(promptSchoolMethod as PromptSchoolMethod, selectedSchools)}】`,
        schoolText,
      )
    : '';
  const singleCardGuidance =
    method === 'tarot' && (data as TarotData).cards.length === 1
      ? buildSection('【传统依据】', '塔罗单牌以牌位职能、正逆位、牌组属性与单牌牌义为主要资料。')
      : method === 'lenormand' && (data as LenormandData).cards.length === 1
        ? buildSection('【传统依据】', '雷诺曼单牌以当前牌位、基础牌义和问题语境为主要资料。')
        : '';

  if (method === 'liuren') {
    return [
      buildPromptGuidanceSections(method),
      buildSection('【当前时间】', timeInfo),
      options.timeContextText ? buildSection('【起局时间口径】', options.timeContextText) : '',
      supplementarySection ? buildSection('【补充信息】', supplementarySection) : '',
      buildSection('【排盘信息】', infoText),
      buildSection('【分析对象】', buildLiurenAnalysisObjectText(data as LiurenData)),
      schoolSection,
      liurenTemplateSection,
      buildSection('【任务】', taskText),
      buildSection('【问题】', normalizedQuestion),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    singleCardGuidance || buildPromptGuidanceSections(method),
    buildSection('【当前时间】', timeInfo),
    options.timeContextText ? buildSection('【起局时间口径】', options.timeContextText) : '',
    supplementarySection ? buildSection('【补充信息】', supplementarySection) : '',
    astrolabeScopeText ? buildSection('【分析对象】', astrolabeScopeText) : '',
    buildSection('【占卜信息】', infoText),
    schoolSection,
    isCustomQuestion ? '' : liuyaoTemplateSection,
    isCustomQuestion ? '' : liurenTemplateSection,
    buildSection('【任务】', taskText),
    buildSection('【问题】', normalizedQuestion),
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildSupplementaryInfo(draft: DivinationDraft): SupplementaryInfo | undefined {
  const info: SupplementaryInfo = {};

  const usesDedicatedBirthInfo =
    draft.method === 'almanac' || draft.method === 'astrolabe' || draft.method === 'huangji';
  if (!usesDedicatedBirthInfo && draft.gender) {
    info.gender = draft.gender;
  }
  if (!usesDedicatedBirthInfo && draft.birthYear.trim()) {
    const birthYear = readOptionalPositiveIntegerText(draft.birthYear);
    if (typeof birthYear === 'number' && Number.isFinite(birthYear)) {
      info.birthYear = birthYear;
    }
  }
  if (draft.method === 'meihua') {
    info.meihuaSettings = {
      method: draft.meihuaMethod,
      ...(draft.meihuaMethod === 'number' && draft.meihuaNumber.trim()
        ? { number: readPositiveIntegerText(draft.meihuaNumber, '数字起卦') }
        : {}),
    };
  }
  const userSupplement = draft.userSupplement?.trim();
  if (draft.method === 'almanac' && draft.question.trim()) {
    info.userSupplement = [draft.question.trim(), userSupplement].filter(Boolean).join('\n');
  } else if (userSupplement) {
    info.userSupplement = userSupplement;
  }
  const contextFields = [
    ['currentSituation', draft.currentSituation],
    ['currentState', draft.currentState],
    ['knownFacts', draft.knownFacts],
    ['desiredOutcome', draft.desiredOutcome],
    ['constraints', draft.constraints],
  ] as const;
  contextFields.forEach(([key, value]) => {
    if (value?.trim()) info[key] = value.trim();
  });

  return Object.keys(info).length > 0 ? info : undefined;
}

function validateDraft(draft: DivinationDraft) {
  if (draft.method !== 'almanac' && !draft.question.trim()) {
    throw new Error('请输入你想占卜的问题');
  }

  if (draft.method === 'meihua' && draft.meihuaMethod === 'number') {
    readPositiveIntegerText(draft.meihuaNumber, '数字起卦');
  }

  if (draft.method === 'liuyao' && (draft.liuyaoMethod ?? 'time') === 'manual') {
    if (draft.liuyaoYaos?.length !== 6) {
      throw new Error('手动起卦需要从初爻到上爻填写六个爻值');
    }
    if (!draft.liuyaoYaos.every((value) => [6, 7, 8, 9].includes(value))) {
      throw new Error('手动起卦的爻值只能是 6、7、8、9');
    }
  }

  if (draft.method === 'liuyao' && (draft.liuyaoMethod ?? 'time') === 'coins') {
    if (draft.liuyaoCoinThrows?.length !== 6) {
      throw new Error('手摇起卦需要从初爻到上爻完成六次手摇');
    }
  }

  if (draft.method === 'tarot' && draft.tarotMethod === 'interactive') {
    const expectedCount = tarotSpreads[draft.tarotSpread].cardCount;
    if (draft.tarotInteractiveSamples?.length !== expectedCount * 2) {
      throw new Error(`当前牌阵需要逐张抽取${expectedCount}张牌`);
    }
  }

  if (draft.method === 'tarot' && (draft.tarotMethod ?? 'random') === 'manual') {
    const expectedCount = tarotSpreads[draft.tarotSpread].cardCount;
    if (draft.tarotManualCards?.length !== expectedCount) {
      throw new Error(`当前牌阵需要按牌位录入${expectedCount}张牌`);
    }
  }

  if (draft.method === 'lenormand' && (draft.lenormandMethod ?? 'random') === 'manual') {
    const expectedCount = LENORMAND_SPREADS[draft.lenormandSpread].positions.length;
    if (draft.lenormandManualCardIds?.length !== expectedCount) {
      throw new Error(`当前牌阵需要按牌位录入${expectedCount}张牌`);
    }
  }

  if (draft.method === 'lenormand' && draft.lenormandMethod === 'interactive') {
    const expectedCount = LENORMAND_SPREADS[draft.lenormandSpread].positions.length;
    if (draft.lenormandInteractiveSamples?.length !== expectedCount) {
      throw new Error(`当前牌阵需要逐张抽取${expectedCount}张牌`);
    }
  }

  if (draft.method === 'ssgw' && (draft.ssgwMethod ?? 'random') === 'manual') {
    const number = Number(draft.ssgwNumber);
    if (!/^\d+$/.test(draft.ssgwNumber?.trim() ?? '') || number < 1 || number > 92) {
      throw new Error('签号需为1至92的整数');
    }
  }

  if (draft.method === 'zhuge' && [...draft.zhugeText.trim()].length !== 3) {
    throw new Error('请随念写下三个汉字');
  }

  if (
    draft.method === 'kongming' &&
    (draft.kongmingMethod ?? 'random') === 'manual' &&
    !/^[●○]{5}$/.test(draft.kongmingPattern ?? '')
  ) {
    throw new Error('请完成五次阴阳取象');
  }

  if (draft.method === 'jinkoujue' && draft.jinkoujueMethod === 'number') {
    readPositiveIntegerText(draft.jinkoujueNumber, '金口诀数字起课');
  }

  if (
    draft.method === 'jinkoujue' &&
    draft.jinkoujueMethod === 'branch' &&
    !['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'].includes(
      draft.jinkoujueBranch,
    )
  ) {
    throw new Error('请选择金口诀地分');
  }

  if (
    draft.method === 'taiyi' &&
    (draft.taiyiScope ?? 'year') === 'year' &&
    draft.divinationTimeMode === 'custom'
  ) {
    const year = readIntegerText(draft.taiyiYear, '太乙年计年份');
    assertNumberRange(year, '太乙年计年份', 1900, 2200);
  }

  if (draft.method === 'almanac') {
    if (!draft.almanacStartDate || !draft.almanacEndDate) {
      throw new Error('黄历择日需要选择开始日期和结束日期');
    }
    validateDateRange(draft.almanacStartDate, draft.almanacEndDate);
  }

  if (draft.method === 'astrolabe') {
    const requiredFields = [
      draft.astrolabeYear,
      draft.astrolabeMonth,
      draft.astrolabeDay,
      draft.astrolabeHour,
      draft.astrolabeMinute,
      draft.astrolabeLatitude,
      draft.astrolabeLongitude,
      draft.astrolabeTimezone,
    ];
    if (requiredFields.some((value) => !value.trim())) {
      throw new Error('星盘需要填写出生时间、经纬度和时区');
    }
    validateAstrolabeDraft(draft);
  }
}

function readIntegerText(value: string, label: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}必须是整数`);
  }
  return Number(text);
}

function readOptionalPositiveIntegerText(value: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    return undefined;
  }
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 ? number : undefined;
}

function readPositiveIntegerText(value: string, label: string) {
  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}需要填写正整数`);
  }
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) {
    throw new Error(`${label}需要填写正整数`);
  }
  return number;
}

function readNumberText(value: string, label: string) {
  const text = value.trim();
  if (!/^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(text)) {
    throw new Error(`${label}必须是数字`);
  }
  const number = Number(text);
  if (!Number.isFinite(number)) {
    throw new Error(`${label}必须是数字`);
  }
  return number;
}

function assertNumberRange(value: number, label: string, min: number, max: number) {
  if (value < min) {
    throw new Error(`${label}不能小于 ${min}`);
  }
  if (value > max) {
    throw new Error(`${label}不能大于 ${max}`);
  }
}

function readDateText(value: string, fieldName: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throw new Error(`${fieldName} 需要使用 YYYY-MM-DD 格式`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1900 || year > 2100) {
    throw new Error(`${fieldName} 年份需在 1900-2100 之间`);
  }
  if (month < 1 || month > 12) {
    throw new Error(`${fieldName} 不是有效日期`);
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error(`${fieldName} 不是有效日期`);
  }

  return {
    date: new Date(Date.UTC(year, month - 1, day)),
  };
}

function isTimeBasedDivinationMethod(method: Exclude<DivinationMethodId, 'random'>) {
  if (method === 'liuyao' || method === 'qimen' || method === 'liuren') {
    return true;
  }

  if (
    method === 'meihua' ||
    method === 'xiaoliuren' ||
    method === 'jinkoujue' ||
    method === 'taiyi' ||
    method === 'huangji'
  ) {
    return true;
  }

  return false;
}

function formatReadableDateTime(value: string) {
  return value.replace('T', ' ').replace(/:00$/, '');
}

function formatCorrectionMinutes(value: number) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)} 分钟`;
}

function buildBeijingWallClockDateTime(date: Date) {
  const parts = TimeManager.getWallClockParts(date);
  return formatSolarDateTimeParts({ ...parts, second: 0 });
}

function supportsTrueSolarTime(
  method: Exclude<DivinationMethodId, 'random'>,
  draft: DivinationDraft,
) {
  return !(method === 'taiyi' && (draft.taiyiScope ?? 'year') === 'year');
}

function resolveDivinationTimeContext(
  method: Exclude<DivinationMethodId, 'random'>,
  draft: DivinationDraft,
  baseDate: Date,
): { date: Date; context: DivinationTimeContext } {
  const clockDateTime = buildBeijingWallClockDateTime(baseDate);
  if (draft.divinationTimeStandard !== 'true-solar' || !supportsTrueSolarTime(method, draft)) {
    return {
      date: baseDate,
      context: {
        standard: 'beijing',
        clockDateTime,
        effectiveDateTime: clockDateTime,
        promptText: `时间口径：北京时间\n采用时间：${formatReadableDateTime(clockDateTime)}`,
      },
    };
  }

  const locationName = draft.birthPlace?.trim() ?? '';
  if (!locationName) {
    throw new Error('使用真太阳时需要选择起局地点');
  }
  const longitude = readNumberText(draft.birthLongitude ?? '', '起局地点经度');
  assertNumberRange(longitude, '起局地点经度', -180, 180);
  const conversion = convertTrueSolarTime({
    localDateTime: clockDateTime,
    longitude,
    timezone: 8,
    timeZoneId: 'Asia/Shanghai',
  });
  const effectiveDateTime = conversion.correctedDateTime;
  const date = new Date(`${effectiveDateTime}+08:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('真太阳时校正结果不是有效时间');
  }
  const promptText = [
    '时间口径：真太阳时',
    `起局地点：${locationName}（经度 ${longitude}°）`,
    `当地钟表时间：${formatReadableDateTime(conversion.clockDateTime)}`,
    `采用真太阳时：${formatReadableDateTime(effectiveDateTime)}`,
    `校正明细：经度修正 ${formatCorrectionMinutes(conversion.longitudeCorrectionMinutes)}，均时差 ${formatCorrectionMinutes(conversion.equationOfTimeMinutes)}，合计 ${formatCorrectionMinutes(conversion.totalCorrectionMinutes)}${conversion.crossesDate ? '，校正后跨日' : ''}`,
  ].join('\n');

  return {
    date,
    context: {
      standard: 'true-solar',
      clockDateTime: conversion.clockDateTime,
      effectiveDateTime,
      locationName,
      longitude,
      longitudeCorrectionMinutes: conversion.longitudeCorrectionMinutes,
      equationOfTimeMinutes: conversion.equationOfTimeMinutes,
      totalCorrectionMinutes: conversion.totalCorrectionMinutes,
      crossesDate: conversion.crossesDate,
      promptText,
    },
  };
}

function insertTimeContextIntoPrompt(prompt: string, timeContextText: string) {
  const section = buildSection('【起局时间口径】', timeContextText);
  const taskMarker = '\n\n【任务】';
  const taskIndex = prompt.indexOf(taskMarker);
  if (taskIndex < 0) {
    return `${prompt}\n\n${section}`;
  }
  return `${prompt.slice(0, taskIndex)}\n\n${section}${prompt.slice(taskIndex)}`;
}

function readCustomDivinationDate(draft: DivinationDraft): Date {
  const dateText = draft.customDivinationDate?.trim() || '';
  const timeText = draft.customDivinationTime?.trim() || '';

  if (!dateText || !timeText) {
    throw new Error('自定起卦时间需要填写日期和时间');
  }

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!dateMatch) {
    throw new Error('自定起卦日期需要使用 YYYY-MM-DD 格式');
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (year < 1900 || year > 2100) {
    throw new Error('自定起卦日期年份需在 1900-2100 之间');
  }
  if (month < 1 || month > 12) {
    throw new Error('自定起卦日期不是有效日期');
  }

  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error('自定起卦日期不是有效日期');
  }

  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeText);
  if (!timeMatch) {
    throw new Error('自定起卦时间需要使用 HH:mm 格式');
  }

  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw new Error('自定起卦时间不是有效时间');
  }

  const date = new Date(`${dateText}T${timeText}:00+08:00`);
  if (Number.isNaN(date.getTime())) {
    throw new Error('自定起卦时间不是有效时间');
  }

  return date;
}

function resolveCustomDivinationDate(
  method: Exclude<DivinationMethodId, 'random'>,
  draft: DivinationDraft,
): Date | undefined {
  if (draft.divinationTimeMode !== 'custom' || !isTimeBasedDivinationMethod(method)) {
    return undefined;
  }

  if (method === 'taiyi' && (draft.taiyiScope ?? 'year') === 'year') {
    return undefined;
  }

  return readCustomDivinationDate(draft);
}

function resolveTaiyiYear(draft: DivinationDraft): number {
  if (draft.divinationTimeMode === 'custom') {
    return readIntegerText(draft.taiyiYear, '太乙年计年份');
  }

  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
    }).format(new Date()),
  );
}

function validateDateRange(startDate: string, endDate: string) {
  const start = readDateText(startDate, 'startDate');
  const end = readDateText(endDate, 'endDate');
  const diffDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);

  if (diffDays < 0) {
    throw new Error('endDate 不能早于 startDate');
  }
  if (diffDays > 179) {
    throw new Error('黄历择日一次最多比较 180 天，请缩小日期范围');
  }
}

function validateAstrolabeDraft(draft: DivinationDraft) {
  const year = readIntegerText(draft.astrolabeYear, '出生年份');
  const month = readIntegerText(draft.astrolabeMonth, '出生月份');
  const day = readIntegerText(draft.astrolabeDay, '出生日期');
  assertNumberRange(year, '出生年份', 1900, 2100);
  assertNumberRange(month, '出生月份', 1, 12);
  const maxDay = daysInSolarMonth(year, month);
  if (day < 1 || day > maxDay) {
    throw new Error(`日期需在 1-${maxDay} 之间`);
  }

  const hour = readIntegerText(draft.astrolabeHour, '出生小时');
  const minute = readIntegerText(draft.astrolabeMinute, '出生分钟');
  const latitude = readNumberText(draft.astrolabeLatitude, '出生地纬度');
  const longitude = readNumberText(draft.astrolabeLongitude, '出生地经度');
  const timezone = readNumberText(draft.astrolabeTimezone, '时区');
  assertNumberRange(hour, '出生小时', 0, 23);
  assertNumberRange(minute, '出生分钟', 0, 59);
  assertNumberRange(latitude, '出生地纬度', -90, 90);
  assertNumberRange(longitude, '出生地经度', -180, 180);
  assertNumberRange(timezone, '时区', -12, 14);
}

function buildAlmanacSessionTitle(data: AlmanacData) {
  return `黄历择日：${data.topicLabel}（${data.startDate} 至 ${data.endDate}）`;
}

function resolveMethod(method: DivinationMethodId): Exclude<DivinationMethodId, 'random'> {
  if (method !== 'random') {
    return method;
  }

  const index = secureRandomInt(CONCRETE_DIVINATION_METHODS.length);
  return CONCRETE_DIVINATION_METHODS[index];
}

export async function generateDivinationSession(
  draft: DivinationDraft,
): Promise<DivinationSession> {
  validateDraft(draft);
  const method = resolveMethod(draft.method);
  const customDate = resolveCustomDivinationDate(method, draft);
  const timing = isTimeBasedDivinationMethod(method)
    ? resolveDivinationTimeContext(method, draft, customDate ?? new Date())
    : undefined;
  const calculationDate = timing?.date;
  const supplementaryInfo = buildSupplementaryInfo({
    ...draft,
    method,
  });
  const inputQuestion = draft.question.trim();

  let data: DivinationData;
  switch (method) {
    case 'liuyao': {
      const module = await import('mingyu-core/divination/liuyao');
      const liuyaoMethod = draft.liuyaoMethod ?? 'time';
      data = module.generateLiuyao(calculationDate, {
        method: liuyaoMethod,
        ...(liuyaoMethod === 'manual' ? { yaos: draft.liuyaoYaos } : {}),
        ...(liuyaoMethod === 'coins' ? { coinThrows: draft.liuyaoCoinThrows } : {}),
      });
      break;
    }
    case 'meihua': {
      const module = await import('mingyu-core/divination/meihua');
      data = module.generateMeihua(calculationDate, supplementaryInfo?.meihuaSettings);
      break;
    }
    case 'xiaoliuren': {
      const module = await import('mingyu-core/divination/xiaoliuren');
      data = module.generateXiaoliuren({
        method: draft.xiaoliurenMethod,
        customDate: calculationDate,
      });
      break;
    }
    case 'jinkoujue': {
      const module = await import('mingyu-core/divination/jinkoujue');
      data = module.generateJinkoujue({
        method: draft.jinkoujueMethod,
        customDate: calculationDate,
        ...(draft.jinkoujueMethod === 'branch' ? { branch: draft.jinkoujueBranch } : {}),
        ...(draft.jinkoujueMethod === 'number' && draft.jinkoujueNumber.trim()
          ? { number: readPositiveIntegerText(draft.jinkoujueNumber, '金口诀数字起课') }
          : {}),
      });
      break;
    }
    case 'qimen': {
      const module = await import('mingyu-core/divination/qimen');
      data = module.generateQimen(
        calculationDate,
        draft.qimenMethod ?? 'zhuanpan',
        draft.qimenScope ?? 'hour',
        draft.qimenJuMethod ?? 'chaibu',
      );
      break;
    }
    case 'liuren': {
      const module = await import('mingyu-core/divination/liuren');
      data = module.generateLiuren(calculationDate);
      break;
    }
    case 'taiyi': {
      const module = await import('mingyu-core/taiyi');
      const scope = draft.taiyiScope ?? 'year';
      data = module.generateTaiyi(
        scope === 'year'
          ? {
              scope,
              year: resolveTaiyiYear(draft),
            }
          : {
              scope,
              date: calculationDate ?? new Date(),
            },
      ) as TaiyiResult;
      break;
    }
    case 'huangji': {
      const module = await import('mingyu-core/huangji-jingshi');
      data = module.calculateHuangjiJingshi({
        date: calculationDate ?? new Date(),
        question: inputQuestion,
      });
      break;
    }
    case 'tarot': {
      const module = await import('mingyu-core/divination/tarot');
      data = module.drawTarotSpread(
        draft.tarotSpread,
        draft.tarotMethod === 'interactive'
          ? { interactiveSamples: draft.tarotInteractiveSamples }
          : (draft.tarotMethod ?? 'random') === 'manual'
            ? { manualCards: draft.tarotManualCards }
            : undefined,
      );
      break;
    }
    case 'ssgw': {
      const module = await import('mingyu-core/divination/ssgw');
      data =
        (draft.ssgwMethod ?? 'random') === 'manual'
          ? module.resolveSignByNumber(Number(draft.ssgwNumber), customDate)
          : module.drawRandomSign(customDate);
      break;
    }
    case 'zhuge': {
      const module = await import('mingyu-core/name-number');
      data = module.calculateZhugeNumber(draft.zhugeText);
      break;
    }
    case 'kongming': {
      const module = await import('mingyu-core/name-number');
      data = module.castKongmingHexagram(
        (draft.kongmingMethod ?? 'random') === 'manual' ? draft.kongmingPattern : undefined,
      );
      break;
    }
    case 'almanac': {
      const module = await import('mingyu-core/divination/almanac');
      data = module.generateAlmanacSelection({
        topic: draft.almanacTopic,
        startDate: draft.almanacStartDate,
        endDate: draft.almanacEndDate,
        weekendPreference: draft.almanacWeekendPreference,
        timePreferences: draft.almanacTimePreferences,
        participants: draft.almanacParticipants,
      });
      break;
    }
    case 'lenormand': {
      const module = await import('mingyu-core/divination/lenormand');
      data = module.drawLenormandSpread(
        draft.lenormandSpread,
        draft.lenormandMethod === 'interactive'
          ? { interactiveSamples: draft.lenormandInteractiveSamples }
          : (draft.lenormandMethod ?? 'random') === 'manual'
            ? { manualCardIds: draft.lenormandManualCardIds }
            : undefined,
      );
      break;
    }
    case 'astrolabe': {
      const module = await import('mingyu-core/divination/astrolabe');
      const input: AstrolabeBirthInput = {
        name: draft.astrolabeName,
        gender: draft.astrolabeGender,
        year: draft.astrolabeYear,
        month: draft.astrolabeMonth,
        day: draft.astrolabeDay,
        hour: draft.astrolabeHour,
        minute: draft.astrolabeMinute,
        latitude: draft.astrolabeLatitude,
        longitude: draft.astrolabeLongitude,
        timezone: draft.astrolabeTimezone,
      };
      data = module.generateAstrolabe(input);
      break;
    }
    default:
      throw new Error('暂不支持当前占卜方式');
  }

  const question =
    method === 'almanac' && !inputQuestion
      ? buildAlmanacSessionTitle(data as AlmanacData)
      : inputQuestion;
  const prompt =
    method === 'huangji'
      ? timing
        ? insertTimeContextIntoPrompt(
            (data as HuangjiJingshiResult).prompt,
            timing.context.promptText,
          )
        : (data as HuangjiJingshiResult).prompt
      : buildDivinationPrompt(method, inputQuestion, data, supplementaryInfo, {
          isCustomQuestion: method === 'almanac' ? false : draft.questionSource === 'custom',
          liuyaoTemplate: draft.liuyaoTemplate,
          liurenTemplate: draft.liurenTemplate,
          astrolabeTopic: draft.astrolabeTopic,
          timeContextText: timing?.context.promptText,
        });
  return {
    method,
    requestedMethod: draft.method,
    question,
    prompt,
    data,
    ...(timing ? { timeContext: timing.context } : {}),
  };
}
