import { resolveZiweiTrueSolarBirth } from '../ziwei/true-solar-input';
import type { ChartInput } from '../../types/chart';
import type { AnalysisPayloadV1, PalaceFact, ScopeType } from '../../types/analysis';
import type { IztroAstrolabe, IztroHoroscope } from '../../types/iztro';
import { getBirthDateValidationMessage } from '../date-validation';
import {
  buildAstrolabeFromInput,
  buildHoroscope,
  buildActiveScope,
  buildAnalysisPayloadV1,
  buildBasicInfo,
  getCurrentScopeItem,
  getDefaultHoroscopeContext,
  mapStarFact,
} from '@core/ziwei/iztro';
import {
  getZiweiCompatibilityDefaultQuestion,
  getZiweiDefaultQuestion,
} from '../prompt-default-questions';
import { buildPortablePromptPack, type PromptContext } from '../ziwei-prompts';
import { formatPromptCurrentTime } from '../prompt-time';
import {
  ZIWEI_ANALYSIS_REQUIREMENT,
  ZIWEI_ANALYST_ROLE,
  ZIWEI_COMPATIBILITY_ROLE,
} from '../ziwei-prompt-copy';

export type ZiweiRuntime = {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  payloadByScope: Record<ScopeType, AnalysisPayloadV1>;
};

function readInteger(value: string | number, label: string) {
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) {
      throw new Error(`${label}必须是整数。`);
    }
    return value;
  }

  const text = value.trim();
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label}必须是整数。`);
  }
  return Number(text);
}

function readTimeIndex(value: number | '') {
  const timeIndex = readInteger(value, '出生时辰');
  if (timeIndex < 0 || timeIndex > 12) {
    throw new Error('出生时辰需在 0-12 之间。');
  }
  return timeIndex;
}

function readZiweiBirthDate(input: {
  year: string;
  month: string;
  day: string;
  dateType: 'solar' | 'lunar';
  isLeapMonth: boolean;
}) {
  const year = readInteger(input.year, '出生年份');
  const month = readInteger(input.month, '出生月份');
  const day = readInteger(input.day, '出生日期');
  const validationMessage = getBirthDateValidationMessage({
    year,
    month,
    day,
    dateType: input.dateType,
    isLeapMonth: input.isLeapMonth,
  });

  if (validationMessage) {
    throw new Error(validationMessage);
  }

  return { year, month, day };
}

function formatZiweiBirthDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function buildZiweiPayloadByScope(params: {
  astrolabe: IztroAstrolabe;
  horoscope: IztroHoroscope;
  scopes?: ScopeType[];
  skipAnalysis?: boolean;
}) {
  const requestedScopes = params.scopes?.length
    ? params.scopes
    : (['origin', 'decadal', 'yearly', 'monthly', 'daily', 'hourly', 'age'] as ScopeType[]);
  const scopes = Array.from(new Set(requestedScopes));

  return Object.fromEntries(
    scopes.map((scope) => [
      scope,
      buildAnalysisPayloadV1({
        astrolabe: params.astrolabe,
        horoscope: params.horoscope,
        currentScope: scope,
        skipAnalysis: params.skipAnalysis,
      }),
    ]),
  ) as Record<ScopeType, AnalysisPayloadV1>;
}

export async function calculateFullZiweiChart(
  input: ChartInput,
  skipAnalysis?: boolean,
): Promise<ZiweiRuntime> {
  return calculateZiweiChartForScopes(input, undefined, skipAnalysis);
}

export async function calculateZiweiChartForScopes(
  input: ChartInput,
  scopes?: ScopeType[],
  skipAnalysis?: boolean,
): Promise<ZiweiRuntime> {
  const astrolabe = await buildAstrolabeFromInput(input);
  const { dateStr, hourIndex } = getDefaultHoroscopeContext();
  const horoscope = buildHoroscope(astrolabe, dateStr, hourIndex);
  const payloadByScope = buildZiweiPayloadByScope({
    astrolabe,
    horoscope,
    scopes,
    skipAnalysis,
  });

  return {
    astrolabe,
    horoscope,
    payloadByScope,
  };
}

function buildLightweightPublicPalaces(astrolabe: IztroAstrolabe): PalaceFact[] {
  return astrolabe.palaces.map((palace) => {
    const surrounded = astrolabe.surroundedPalaces(palace.name);

    return {
      index: palace.index,
      name: palace.name,
      is_body_palace: palace.isBodyPalace,
      is_original_palace: palace.isOriginalPalace,
      heavenly_stem: palace.heavenlyStem,
      earthly_branch: palace.earthlyBranch,
      major_stars: palace.majorStars.map((star) => mapStarFact(star, [])),
      minor_stars: palace.minorStars.map((star) => mapStarFact(star, [])),
      other_stars: palace.adjectiveStars.map((star) => mapStarFact(star, [])),
      scope_stars: [],
      changsheng12: palace.changsheng12,
      boshi12: palace.boshi12,
      base_jiangqian12: palace.jiangqian12,
      base_suiqian12: palace.suiqian12,
      decadal_range: palace.decadal.range,
      ages: palace.ages,
      scope_hits: [],
      empty_state: palace.isEmpty(),
      opposite_palace_index: surrounded.opposite.index,
      surrounded_palace_indexes: [
        surrounded.target.index,
        surrounded.opposite.index,
        surrounded.wealth.index,
        surrounded.career.index,
      ],
      summary_tags: [
        palace.name === '命宫' ? '命宫' : '',
        palace.isBodyPalace ? '身宫' : '',
        palace.isOriginalPalace ? '来因宫' : '',
        palace.isEmpty() ? '空宫' : '',
      ].filter(Boolean),
    };
  });
}

function buildLightweightPublicPayload(params: {
  horoscope: IztroHoroscope;
  basicInfo: AnalysisPayloadV1['basic_info'];
  palaces: PalaceFact[];
  scope: ScopeType;
  astrolabe: IztroAstrolabe;
}): AnalysisPayloadV1 {
  const currentScopeItem = getCurrentScopeItem(params.horoscope, params.scope);

  return {
    payload_version: 'analysis_payload_v1',
    language: 'zh-CN',
    basic_info: params.basicInfo,
    active_scope: buildActiveScope({
      horoscope: params.horoscope,
      currentScope: params.scope,
      currentScopeItem,
      palaces: params.astrolabe.palaces,
    }),
    palaces: params.palaces,
    evidence_pool: [],
    patterns: [],
  };
}

export async function calculatePublicZiweiChartForScopes(
  input: ChartInput,
  scopes?: ScopeType[],
): Promise<ZiweiRuntime> {
  const astrolabe = await buildAstrolabeFromInput(input);
  const { dateStr, hourIndex } = getDefaultHoroscopeContext();
  const horoscope = buildHoroscope(astrolabe, dateStr, hourIndex);
  const requestedScopes = Array.from(new Set(['origin' as const, ...(scopes ?? [])]));
  const basicInfo = buildBasicInfo(astrolabe);
  const palaces = buildLightweightPublicPalaces(astrolabe);
  const payloadByScope: Partial<Record<ScopeType, AnalysisPayloadV1>> = {};

  requestedScopes.forEach((scope) => {
    payloadByScope[scope] = buildLightweightPublicPayload({
      astrolabe,
      horoscope,
      basicInfo,
      palaces,
      scope,
    });
  });

  return {
    astrolabe,
    horoscope,
    payloadByScope: payloadByScope as Record<ScopeType, AnalysisPayloadV1>,
  };
}

export async function calculateZiweiPayloadByScope(input: ChartInput) {
  const astrolabe = await buildAstrolabeFromInput(input);
  const { dateStr, hourIndex } = getDefaultHoroscopeContext();
  const horoscope = buildHoroscope(astrolabe, dateStr, hourIndex);

  return buildZiweiPayloadByScope({
    astrolabe,
    horoscope,
  });
}

export async function calculateZiweiDisplayPayload(params: {
  input: ChartInput;
  dateStr: string;
  hourIndex: number;
  scope: ScopeType;
}) {
  const astrolabe = await buildAstrolabeFromInput(params.input);
  const horoscope = buildHoroscope(astrolabe, params.dateStr, params.hourIndex);

  return buildAnalysisPayloadV1({
    astrolabe,
    horoscope,
    currentScope: params.scope,
  });
}

export function buildZiweiChartInput(input: {
  name: string;
  gender: 'male' | 'female';
  dateType: 'solar' | 'lunar';
  year: string;
  month: string;
  day: string;
  timeIndex: number | '';
  isLeapMonth: boolean;
  useTrueSolarTime?: boolean;
  birthHour?: string;
  birthMinute?: string;
  birthLongitude?: string;
}): ChartInput {
  if (!input.useTrueSolarTime && input.timeIndex === '') {
    throw new Error('请选择出生时辰。');
  }

  const birthDateParts = readZiweiBirthDate(input);
  const birthTimeIndex = input.useTrueSolarTime ? 0 : readTimeIndex(input.timeIndex);
  const gender = input.gender === 'male' ? '男' : '女';
  const trueSolarBirth = input.useTrueSolarTime
    ? resolveZiweiTrueSolarBirth({
        dateType: input.dateType,
        year: input.year,
        month: input.month,
        day: input.day,
        isLeapMonth: input.isLeapMonth,
        birthHour: input.birthHour ?? '',
        birthMinute: input.birthMinute ?? '',
        birthLongitude: input.birthLongitude ?? '',
      })
    : null;
  const birthDate =
    trueSolarBirth?.birthDate ??
    formatZiweiBirthDate(birthDateParts.year, birthDateParts.month, birthDateParts.day);

  return {
    name: input.name,
    gender,
    dateType: input.useTrueSolarTime ? 'solar' : input.dateType,
    birthDate,
    birthTimeIndex: trueSolarBirth?.birthTimeIndex ?? birthTimeIndex,
    isLeapMonth: input.useTrueSolarTime ? false : input.isLeapMonth,
    fixLeap: true,
    algorithm: 'default',
    yearDivide: 'normal',
    horoscopeDivide: 'normal',
    ageDivide: 'normal',
    dayDivide: 'forward',
  };
}

function createZiweiReportContext(payload: AnalysisPayloadV1, topic: string): PromptContext {
  const topicMap: Record<
    string,
    { report_type: string; report_title: string; selected_topic: string }
  > = {
    destiny: {
      report_type: payload.active_scope.scope === 'origin' ? 'destiny-overview' : 'scope',
      report_title:
        payload.active_scope.scope === 'origin' ? '命局综述' : `${payload.active_scope.label}报告`,
      selected_topic: 'destiny',
    },
    relationship: {
      report_type: 'relationship',
      report_title: '婚姻感情报告',
      selected_topic: 'relationship',
    },
    'relationship-push': {
      report_type: 'relationship-push',
      report_title: '关系推进报告',
      selected_topic: 'relationship-push',
    },
    'relationship-decision': {
      report_type: 'relationship-decision',
      report_title: '关系去留报告',
      selected_topic: 'relationship-decision',
    },
    children: {
      report_type: 'children',
      report_title: '子女亲缘报告',
      selected_topic: 'children',
    },
    'career-wealth': {
      report_type: 'career-wealth',
      report_title: '事业财运报告',
      selected_topic: 'career-wealth',
    },
    'job-change': {
      report_type: 'job-change',
      report_title: '工作变动报告',
      selected_topic: 'job-change',
    },
    'startup-partnership': {
      report_type: 'startup-partnership',
      report_title: '创业合作报告',
      selected_topic: 'startup-partnership',
    },
    'investment-partnership': {
      report_type: 'investment-partnership',
      report_title: '投资合作报告',
      selected_topic: 'investment-partnership',
    },
    recent: {
      report_type: 'recent',
      report_title: '近期趋势报告',
      selected_topic: 'recent',
    },
    family: {
      report_type: 'family',
      report_title: '六亲家庭报告',
      selected_topic: 'family',
    },
    'home-move': {
      report_type: 'home-move',
      report_title: '搬家置业报告',
      selected_topic: 'home-move',
    },
    'settle-relocate': {
      report_type: 'settle-relocate',
      report_title: '定居换城报告',
      selected_topic: 'settle-relocate',
    },
    social: {
      report_type: 'social',
      report_title: '人际合作报告',
      selected_topic: 'social',
    },
    emotion: {
      report_type: 'emotion',
      report_title: '情绪调节报告',
      selected_topic: 'emotion',
    },
    health: {
      report_type: 'health',
      report_title: '健康养护报告',
      selected_topic: 'health',
    },
    study: {
      report_type: 'study',
      report_title: '学业成长报告',
      selected_topic: 'study',
    },
    'study-advance': {
      report_type: 'study-advance',
      report_title: '考证进修报告',
      selected_topic: 'study-advance',
    },
    'exam-landing': {
      report_type: 'exam-landing',
      report_title: '考试上岸报告',
      selected_topic: 'exam-landing',
    },
    'reconciliation-decision': {
      report_type: 'reconciliation-decision',
      report_title: '复合判断报告',
      selected_topic: 'reconciliation-decision',
    },
    growth: {
      report_type: 'growth',
      report_title: '成长课题报告',
      selected_topic: 'growth',
    },
    talent: {
      report_type: 'talent',
      report_title: '天赋优势报告',
      selected_topic: 'talent',
    },
    life: {
      report_type: 'life',
      report_title: '人生解析报告',
      selected_topic: 'life',
    },
    chat: {
      report_type: 'chat',
      report_title: '自由问答',
      selected_topic: 'chat',
    },
  };

  const matched = topicMap[topic] ?? topicMap.chat;

  return {
    report_key: `${matched.selected_topic}:${payload.active_scope.scope}:${payload.active_scope.solar_date}`,
    report_title: matched.report_title,
    report_type: matched.report_type,
    selected_topic: matched.selected_topic,
    scope_type: payload.active_scope.scope,
    scope_label: payload.active_scope.label,
    focus_notes: [],
  };
}

function demoteEmbeddedPromptSections(content: string) {
  return content.replace(/^【([^】]+)】$/gm, '$1：');
}

function buildZiweiTopicGuidanceSection(_topic: string) {
  return [
    '先围绕【问题】判断对应宫位范围，再组织证据，不要只做星曜罗列。',
    '若【问题】未限定具体主题，按通用紫微口径处理；若【问题】已限定主题，只把主题作为回答范围，不额外套用固定题目。',
    '先看命宫、身宫、三方四正、对宫与四化，再结合当前运限、自化、飞化和重点宫位触发。',
    '优先使用【重点宫位资料】和【关键判断线索】组织推理，不要平均复述全盘。',
    '不得编造已提供资料没有给出的新盘面事实；允许基于已提供资料做紫微斗数推理，但必须标明来自宫位、星曜、四化、运限、三方四正、格局或现实补充信息。',
    '每个关键结论都要区分主证、辅证、反证或限制，并对应到宫位、星曜、四化、运限或现实建议；证据不足时要说明倾向和待确认处。',
  ]
    .map((line) => `- ${line}`)
    .join('\n');
}

function buildZiweiScopePriorityText(payload: AnalysisPayloadV1) {
  const scope = payload.active_scope.scope;
  const scopeLabel = payload.active_scope.label || '当前分析对象';
  const dateText = payload.active_scope.solar_date || '未标注参考日期';
  const isOrigin = scope === 'origin';

  return [
    `分析对象：${isOrigin ? '本命盘' : scopeLabel}（${dateText}）。`,
    isOrigin
      ? '本次只提供本命盘，只能判断长期结构、宫位主轴、星曜组合、四化底色和人生底色；不得把问题中的年份、月份或日期当作已排出的运限证据。'
      : '当前资料已提供明确分析对象，必须优先围绕该范围作答，并说明本命底色如何被当前运限触发。',
    isOrigin
      ? '如果【问题】询问具体年份、月份、日期或年龄，开头先说明当前资料只能看本命倾向，本次不判断具体时间窗口。'
      : '如果【问题】中的时间与【分析对象】不一致，开头先提醒不一致，再以【分析对象】为准。',
    '写应期时必须说明依据来自本命宫位底色、大限阶段、流年触发、流月窗口还是流日/流时短期触发；不得只给年份结论。',
  ].join('\n');
}

function buildZiweiScopeInterpretationRules(payload: AnalysisPayloadV1) {
  const scope = payload.active_scope.scope;
  const scopeLabel = payload.active_scope.label || '当前分析对象';
  const scopeRuleMap: Record<ScopeType, string> = {
    origin:
      '当前为本命范围：只判断宫位结构、星曜组合、格局层次、四化底色和长期人生主题；不得把问题中的年份、月份或日期当作已排出的运限证据。',
    decadal:
      '当前指定大限：以十年阶段环境、身份变化、资源压力、长期机会和大限命宫落点为主；不得把大限本身直接断成某个确定年份已经发生。',
    yearly:
      '当前指定流年：以该年年度触发、四化飞入、流年命宫落点和年度事件类别为主；必须承接大限背景，不能脱离大限单断吉凶。',
    monthly:
      '当前指定流月：以月内推进窗口、短期反复、流月落宫和月度四化触发为主；必须服从大限与流年，不得覆盖整年趋势。',
    daily:
      '当前指定流日：以当天执行、沟通、签约、出行、冲突和避险为主；只能作为短期触发，不能改写本命、大限或流年主线。',
    hourly:
      '当前指定流时：以数小时内的临场状态、沟通节奏和即时取舍为主；只能辅助流日判断，不得扩展为长期结论。',
    age: '当前为年龄范围：只围绕已提供的虚岁、小限或对应年龄段判断；不能自动外推到未提供的其他年份、月份或日期。',
  };

  return [
    `当前对象读法：${scopeLabel}。${scopeRuleMap[scope]}`,
    '本命层：看命宫、身宫、十二宫结构、星曜庙旺陷、格局、三方四正、生年四化和自化，负责长期底色，不负责指定应期。',
    '大限层：看十年阶段的主环境、角色变化、资源压力和机会方向；大限能定阶段强弱，不能替代流年给精确年份。',
    '流年层：看年度命宫、流年四化、流年将前/岁前十二神与被引动宫位；流年必须承接大限，不能孤立下结论。',
    '流月层：看月内窗口、推进节奏和短期反复；流月只能细化年度主题，不能覆盖全年判断。',
    '流日/流时层：看当日或当时执行、沟通、出行、签约、冲突与避险；只作短期触发，不改写长期命局。',
    '写应期时，先讲本命底色，再讲上层运限，最后讲当前层级的触发证据；只在【分析对象】明确的时间层级内给条件窗口。',
  ].join('\n');
}

function buildZiweiOutputRequirementText() {
  return [
    '先直接回答【问题】，再按“结论总览、宫位主线、四化触发、格局与三方四正、反证限制、应期与建议”展开。',
    '结论总览要说明倾向、强弱和成立条件，不要只写泛泛性格或吉凶标签。',
    '宫位主线要交代命宫、身宫、相关主题宫位和对宫/三方四正如何共同指向结论。',
    '四化触发要说明化禄、化权、化科、化忌落点与飞入路径；有【分析对象】触发时必须说明触发路径，本命范围下不得硬断具体年份。',
    '格局、自化、空宫、煞曜、辅曜都要区分主证、辅证、反证或限制，不能越过宫位与四化主线强断。',
    '应期要区分本命长期底色、大限阶段、流年触发、流月流日短期窗口；资料未给到的层级只能写条件，不能硬给唯一日期。',
    '证据不足或结论存在条件时要单独说明，不要为了给结论而编造盘面事实。',
    '最后给出分层建议：当下最该做的事、需要避免的事、后续观察信号。',
  ].join('\n');
}

export function buildCombinedZiweiPrompt(
  payload: AnalysisPayloadV1,
  topic: string,
  question: string,
  options: { isCustomQuestion?: boolean } = {},
) {
  const isCustomQuestion = Boolean(options.isCustomQuestion);
  const normalizedQuestion =
    question.trim() || getZiweiDefaultQuestion(topic, { isCustomQuestion });
  const reportContext = createZiweiReportContext(payload, topic);
  const pack = buildPortablePromptPack({
    payload,
    reportContext,
    mode: 'task-book',
  });

  return [
    ZIWEI_ANALYST_ROLE,
    '【要求】',
    `- ${ZIWEI_ANALYSIS_REQUIREMENT}`,
    ...(isCustomQuestion
      ? []
      : [
          '- 先直接回答【问题】，再按问题范围组织完整判断。',
          '- 按“结论总览、宫位主线、四化触发、反证限制、应期与建议”分层回答。',
          '- 每一层都要写明主证、辅证、反证或限制、触发机制与建议。',
          '- 优先说明宫位主线、四化命中、格局线索、自化迹象和三方四正呼应。',
        ]),
    '- 不得编造已提供资料没有给出的新盘面事实；允许基于已提供资料做紫微斗数推理，但必须标明证据来源。',
    '- 不要整段复述原始盘面信息。',
    '',
    `【当前时间】\n${formatPromptCurrentTime()}`,
    '',
    pack,
    ...(isCustomQuestion ? [] : ['', `【解读范围】\n${buildZiweiScopePriorityText(payload)}`]),
    ...(isCustomQuestion
      ? []
      : ['', `【解读方法】\n${buildZiweiScopeInterpretationRules(payload)}`]),
    '',
    `【问题】\n${normalizedQuestion}`,
    ...(isCustomQuestion
      ? []
      : [
          '',
          `【断盘要点】\n${buildZiweiTopicGuidanceSection(topic)}`,
          '',
          '【任务】\n结合【解读目标】、盘面结构与【分析对象】，优先从宫位主线、四化触发、格局线索、自化与三方四正呼应中提炼核心判断、关键依据和建议。',
          '',
          `【输出要求】\n${buildZiweiOutputRequirementText()}`,
        ]),
  ].join('\n');
}

export function buildCombinedZiweiCompatibilityPrompt(params: {
  primaryPayload: AnalysisPayloadV1;
  partnerPayload: AnalysisPayloadV1;
  topic: string;
  question: string;
  isCustomQuestion?: boolean;
}) {
  const isCustomQuestion = Boolean(params.isCustomQuestion);
  const primaryContext = createZiweiReportContext(params.primaryPayload, params.topic);
  const partnerContext = createZiweiReportContext(params.partnerPayload, params.topic);
  const primaryPack = buildPortablePromptPack({
    payload: params.primaryPayload,
    reportContext: primaryContext,
    mode: 'task-book',
  });
  const partnerPack = buildPortablePromptPack({
    payload: params.partnerPayload,
    reportContext: partnerContext,
    mode: 'task-book',
  });
  const primaryEmbeddedPack = demoteEmbeddedPromptSections(primaryPack);
  const partnerEmbeddedPack = demoteEmbeddedPromptSections(partnerPack);
  const compatibilityTopic = params.topic || 'chat';
  const compatibilityRules = [
    '- 先围绕【问题】判断双方互动主轴，再按“互动主轴、互补点、冲突点、触发机制、建议边界”分层展开。',
    '- 若【问题】已限定主题，只把主题作为关系范围，不额外套用固定题目；未限定具体问题时按通用合盘口径处理。',
  ];
  const compatibilityTask =
    '请综合双方盘面和关系范围，直接判断互动主轴、互补点、冲突点、触发机制与建议。';
  const compatibilityQuestion = getZiweiCompatibilityDefaultQuestion(compatibilityTopic);

  return [
    ZIWEI_COMPATIBILITY_ROLE,
    '【要求】',
    '- 只基于提供的双方盘面和问题作答。',
    '- 不得编造已提供资料没有给出的新盘面事实；允许基于双方已提供资料做紫微斗数推理，但必须标明来自宫位、星曜、四化、运限、三方四正或现实补充信息。',
    ...(isCustomQuestion ? [] : compatibilityRules),
    '- 不要整段复述双方原始盘面信息。',
    '',
    `【当前时间】\n${formatPromptCurrentTime()}`,
    '【第一人盘面】',
    primaryEmbeddedPack,
    '',
    '【第二人盘面】',
    partnerEmbeddedPack,
    '',
    `【问题】\n${params.question.trim() || compatibilityQuestion}`,
    ...(isCustomQuestion
      ? []
      : [
          `【任务】\n${compatibilityTask}`,
          '【输出要求】\n先直接回答【问题】，再按“互动主轴、互补点、冲突点、触发机制、建议边界”展开；每部分都要写明双方盘面主证、辅证、反证或限制、触发机制与建议；证据不足或结论存在条件时要单独说明；最后给出适合推进、观察还是暂缓的现实建议。',
        ]),
  ].join('\n');
}
