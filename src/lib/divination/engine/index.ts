import type {
  AlmanacData,
  AlmanacParticipantInput,
  AlmanacTopic,
  AstrolabeBirthInput,
  DivinationData,
  LiuyaoTemplateType,
  LiurenData,
  LiurenTemplateType,
  SupplementaryInfo,
  TarotSpreadType,
  TaiyiResult,
  TaiyiScope,
} from '../../../types/divination';
import type { DivinationMethodId } from '@core/divination/config';
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
import { buildTaskText } from '@core/divination/engine/method-text';
import { buildLiurenTemplateText } from '@core/divination/engine/liuren-template';
import { buildLiuyaoTemplateText } from '@core/divination/engine/liuyao-template';
import { buildPromptGuidanceSections } from '../../prompt-guidance';
import { tarotSpreads } from '@core/divination/tarot';

const CONCRETE_DIVINATION_METHODS: Array<Exclude<DivinationMethodId, 'random'>> = [
  'liuyao',
  'meihua',
  'qimen',
  'liuren',
  'taiyi',
  'tarot',
  'ssgw',
];

function buildLiurenAnalysisObjectText(data: LiurenData) {
  const initial = data.threeTransmissions[0];
  return [
    '分析对象：大六壬起课盘',
    `起课范围：${data.dayNight || '昼夜未标注'}；月将${data.monthLeader}加占时${data.divinationBranch}`,
    `主线对象：${data.transmissionRule || '取传法未标注'}；${initial ? `初传${initial.branch}乘${initial.god}` : '初传未标注'}`,
  ].join('\n');
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
  gender: '' | '男' | '女';
  birthYear: string;
  divinationTimeMode?: 'current' | 'custom';
  customDivinationDate?: string;
  customDivinationTime?: string;
  liuyaoMethod?: 'time' | 'coins' | 'manual';
  liuyaoYaos?: Array<6 | 7 | 8 | 9>;
  liuyaoCoinThrows?: Array<{ coins: [2 | 3, 2 | 3, 2 | 3]; total: 6 | 7 | 8 | 9 }>;
  meihuaMethod: 'time' | 'number' | 'random' | 'timeTrigram';
  meihuaNumber: string;
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
  almanacParticipants: AlmanacParticipantInput[];
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
};

export type DivinationSession = {
  method: Exclude<DivinationMethodId, 'random'>;
  requestedMethod: DivinationMethodId;
  question: string;
  prompt: string;
  data: DivinationData;
};

export type BuildDivinationPromptOptions = {
  isCustomQuestion?: boolean;
  liuyaoTemplate?: LiuyaoTemplateType;
  liurenTemplate?: LiurenTemplateType;
  astrolabeTopic?: AstrolabePromptTopic;
  astrolabeScopeText?: string;
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
  const isAlmanac = method === 'almanac';
  const astrolabeTopic =
    method === 'astrolabe' ? (options.astrolabeTopic ?? (isCustomQuestion ? 'chat' : 'life')) : '';
  const astrolabeScopeText = method === 'astrolabe' ? options.astrolabeScopeText?.trim() || '' : '';
  const normalizedQuestion =
    method === 'astrolabe'
      ? question.trim() || getAstrolabeDefaultQuestion(astrolabeTopic, { isCustomQuestion })
      : question;
  const timeInfo = method === 'astrolabe' ? buildSolarTimeInfoText(data) : buildTimeInfoText(data);
  const almanacQuestionSupplement = isAlmanac ? normalizedQuestion.trim() : '';
  const effectiveSupplementaryInfo =
    almanacQuestionSupplement && !supplementaryInfo?.userSupplement?.trim()
      ? { ...(supplementaryInfo ?? {}), userSupplement: almanacQuestionSupplement }
      : supplementaryInfo;
  const supplementarySection = formatSupplementaryInfoSection(method, effectiveSupplementaryInfo);
  const infoText = formatDivinationInfo(
    method,
    data,
    normalizedQuestion,
    effectiveSupplementaryInfo,
    { liuyaoTemplate },
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
      ? buildAstrolabeTopicTask(astrolabeTopic)
      : buildTaskText(method);

  if (method === 'liuren') {
    return [
      buildPromptGuidanceSections(method),
      buildSection('【当前时间】', timeInfo),
      supplementarySection ? buildSection('【补充信息】', supplementarySection) : '',
      buildSection('【排盘信息】', infoText),
      buildSection('【分析对象】', buildLiurenAnalysisObjectText(data as LiurenData)),
      buildSection('【问题】', normalizedQuestion),
      isCustomQuestion ? '' : liurenTemplateSection,
      isCustomQuestion ? '' : buildSection('【任务】', taskText),
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    buildPromptGuidanceSections(method),
    buildSection('【当前时间】', timeInfo),
    supplementarySection ? buildSection('【补充信息】', supplementarySection) : '',
    astrolabeScopeText ? buildSection('【分析对象】', astrolabeScopeText) : '',
    buildSection('【占卜信息】', infoText),
    isAlmanac ? '' : buildSection('【问题】', normalizedQuestion),
    isCustomQuestion ? '' : buildSection('【任务】', taskText),
    isCustomQuestion ? '' : liuyaoTemplateSection,
    isCustomQuestion ? '' : liurenTemplateSection,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildSupplementaryInfo(draft: DivinationDraft): SupplementaryInfo | undefined {
  const birthYear = draft.birthYear.trim()
    ? readOptionalPositiveIntegerText(draft.birthYear)
    : undefined;
  const hasBirthYear = typeof birthYear === 'number' && Number.isFinite(birthYear);

  const info: SupplementaryInfo = {};

  if (draft.gender) {
    info.gender = draft.gender;
  }
  if (hasBirthYear) {
    info.birthYear = birthYear;
  }
  if (draft.method === 'meihua') {
    info.meihuaSettings = {
      method: draft.meihuaMethod,
      ...(draft.meihuaMethod === 'number' && draft.meihuaNumber.trim()
        ? { number: readPositiveIntegerText(draft.meihuaNumber, '数字起卦') }
        : {}),
    };
  }
  if (draft.method === 'almanac' && draft.question.trim()) {
    info.userSupplement = draft.question.trim();
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

  if (draft.method === 'ssgw' && (draft.ssgwMethod ?? 'random') === 'manual') {
    const number = Number(draft.ssgwNumber);
    if (!/^\d+$/.test(draft.ssgwNumber?.trim() ?? '') || number < 1 || number > 92) {
      throw new Error('签号需为1至92的整数');
    }
  }

  if (draft.method === 'taiyi') {
    if ((draft.taiyiScope ?? 'year') !== 'year') {
      throw new Error('太乙月计、日计、时计尚未完成古籍历法链校勘，当前只开放年计。');
    }
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

  if (method === 'meihua' || method === 'taiyi') {
    return true;
  }

  return false;
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

  return readCustomDivinationDate(draft);
}

function validateDateRange(startDate: string, endDate: string) {
  const start = readDateText(startDate, 'startDate');
  const end = readDateText(endDate, 'endDate');
  const diffDays = Math.round((end.date.getTime() - start.date.getTime()) / 86400000);

  if (diffDays < 0) {
    throw new Error('endDate 不能早于 startDate');
  }
  if (diffDays > 30) {
    throw new Error('黄历择日一次最多比较 31 天，请缩小日期范围');
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

function getRandomIndex(length: number) {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('随机范围必须是正整数');
  }
  const cryptoObject = globalThis.crypto;
  if (cryptoObject?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoObject.getRandomValues(values);
    return values[0] % length;
  }
  const fallbackNow = globalThis.performance?.now?.() ?? 0;
  return Math.floor((Date.now() + fallbackNow) % length);
}

function resolveMethod(method: DivinationMethodId): Exclude<DivinationMethodId, 'random'> {
  if (method !== 'random') {
    return method;
  }

  const index = getRandomIndex(CONCRETE_DIVINATION_METHODS.length);
  return CONCRETE_DIVINATION_METHODS[index];
}

export async function generateDivinationSession(
  draft: DivinationDraft,
): Promise<DivinationSession> {
  validateDraft(draft);
  const method = resolveMethod(draft.method);
  const customDate = resolveCustomDivinationDate(method, draft);
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
      data = module.generateLiuyao(customDate, {
        method: liuyaoMethod,
        ...(liuyaoMethod === 'manual' ? { yaos: draft.liuyaoYaos } : {}),
        ...(liuyaoMethod === 'coins' ? { coinThrows: draft.liuyaoCoinThrows } : {}),
      });
      break;
    }
    case 'meihua': {
      const module = await import('mingyu-core/divination/meihua');
      data = module.generateMeihua(customDate, supplementaryInfo?.meihuaSettings);
      break;
    }
    case 'qimen': {
      const module = await import('mingyu-core/divination/qimen');
      data = module.generateQimen(customDate);
      break;
    }
    case 'liuren': {
      const module = await import('mingyu-core/divination/liuren');
      data = module.generateLiuren(customDate);
      break;
    }
    case 'taiyi': {
      const module = await import('mingyu-core/taiyi');
      data = module.generateTaiyi({
        scope: 'year',
        year: readIntegerText(draft.taiyiYear, '太乙年计年份'),
      }) as TaiyiResult;
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
    case 'almanac': {
      const module = await import('mingyu-core/divination/almanac');
      data = module.generateAlmanacSelection({
        topic: draft.almanacTopic,
        startDate: draft.almanacStartDate,
        endDate: draft.almanacEndDate,
        participants: draft.almanacParticipants,
      });
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
  const prompt = buildDivinationPrompt(method, question, data, supplementaryInfo, {
    isCustomQuestion: method === 'almanac' ? false : draft.questionSource === 'custom',
    liuyaoTemplate: draft.liuyaoTemplate,
    liurenTemplate: draft.liurenTemplate,
    astrolabeTopic: draft.astrolabeTopic,
  });
  return {
    method,
    requestedMethod: draft.method,
    question,
    prompt,
    data,
  };
}
