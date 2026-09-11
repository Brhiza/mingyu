import { getDefaultHoroscopeContext } from 'mingyu-core/ziwei/iztro';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ScopeType } from '../../../src/types/analysis.js';
import {
  buildZiweiChartInput,
  calculateZiweiChartForScopes,
  type ZiweiFortuneRangeOptions,
} from 'mingyu-core/ziwei';
import { buildCombinedZiweiCompatibilityPrompt } from 'mingyu-core/ziwei/prompt';
import { analyzeZiweiCompatibility } from 'mingyu-core/ziwei/iztro';
import {
  PROMPT_MODES,
  PROMPT_SCOPE_IDS,
  ZIWEI_PROMPT_SCOPES,
  ZIWEI_PROMPT_TOPICS,
  ZIWEI_SCHOOLS,
  buildSerializableZiweiResult,
  buildZiweiPromptForRuntime,
  getZiweiPromptCalculationScopes,
  type PromptMode,
  type ZiweiPromptScope,
  type ZiweiPromptTopic,
  type ZiweiSchool,
} from '../../../src/lib/public-api/prompt-builders.js';
import {
  calculationDetailShape,
  promptOutputSchema,
  withErrorOutputSchema,
  ziweiOutputSchema,
} from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { applyMcpPromptSelection, readMcpPromptSelection } from './prompt-helpers.js';
import {
  assertMcpBirthDate,
  readMcpDateOnly,
  readMcpIntegerLikeInRange,
  readMcpNumberLikeInRange,
} from './input-helpers.js';

export const ziweiSchema = z.object({
  name: z.string().optional().describe('姓名（可选）'),
  gender: z.enum(['male', 'female']).describe('性别：male 为男，female 为女'),
  dateType: z.enum(['solar', 'lunar']).describe('日期类型：solar 为阳历，lunar 为农历'),
  year: z.string().describe('出生年，如 1990'),
  month: z.string().describe('出生月，如 5'),
  day: z.string().describe('出生日，如 15'),
  timeIndex: z
    .number()
    .int()
    .min(0)
    .max(12)
    .optional()
    .describe('时辰索引：0=早子时,1=丑时,...,12=晚子时；未启用真太阳时时必填'),
  promptScope: z
    .enum(ZIWEI_PROMPT_SCOPES)
    .optional()
    .describe(
      '运限范围：未指定时默认当前大限；origin=本命, full=已验证童限与大限的全部流年, decadal=大限, yearly=流年, monthly=流月, daily=流日, hourly=流时, age=年龄。',
    ),
  scopeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .describe('紫微运限目标日期；固定当前阶段、指定流年或下层资料的取盘时点'),
  scopeHourIndex: z
    .number()
    .int()
    .min(0)
    .max(12)
    .optional()
    .describe('目标运限时辰：0=早子、1=丑、…、12=晚子；省略时使用当前时辰'),
  isLeapMonth: z.boolean().optional().describe('是否为闰月（仅农历有效）'),
  useTrueSolarTime: z.boolean().optional().describe('是否启用真太阳时校正'),
  birthHour: z.string().optional().describe('精准出生小时，启用真太阳时时必填，如 1'),
  birthMinute: z.string().optional().describe('精准出生分钟，启用真太阳时时必填，如 20'),
  birthLongitude: z.string().optional().describe('出生地经度，启用真太阳时时必填，如 116.4074'),
  timezone: z.number().min(-12).max(14).optional().describe('固定 UTC 偏移，默认 UTC+8'),
  timeZoneId: z.string().min(1).optional().describe('IANA 历史时区，如 America/New_York'),
  applyChinaDst: z.boolean().optional().describe('是否应用中国 1986-1991 历史夏令时校正'),
  algorithm: z
    .enum(['default', 'zhongzhou'])
    .optional()
    .describe('底层安星口径：default=传统通行安星法，zhongzhou=中州派安星法；不等同于解读流派'),
});

const ziweiPromptSchema = ziweiSchema.extend({
  question: z.string().describe('用户希望围绕命盘解读的问题'),
  promptTopic: z
    .enum(ZIWEI_PROMPT_TOPICS)
    .optional()
    .describe(
      '提示词主题：destiny=命局, relationship=感情, career-wealth=事业财运, family=六亲家庭, health=健康养护, study=学业成长, life=人生, chat=自由问答',
    ),
  promptMode: z
    .enum(PROMPT_MODES)
    .optional()
    .describe('提示词模式：framework=内置主题任务, custom=用户问题加通用短答题框架'),
  school: z
    .enum(ZIWEI_SCHOOLS)
    .optional()
    .describe(
      '紫微解读侧重点：sanhe=三合派（三方四正、星曜庙旺）, feixing=飞星派（只读取盘面已有四化飞星链路）, sihua=四化派（生年四化主线）。只影响提示词，不改变 iztro 基础安星口径',
    ),
  schools: z
    .array(z.enum(ZIWEI_SCHOOLS))
    .min(1)
    .max(3)
    .refine((values) => new Set(values).size === values.length, '不能选择重复流派')
    .optional()
    .describe('紫微多派合参；分别解读后归纳共同结论、分歧和综合判断'),
  topicId: z.string().optional().describe('统一解读主题 ID；优先于旧版 promptTopic'),
  subtopicId: z.string().optional().describe('统一解读主题细项 ID；必须属于所选主题'),
  scope: z.enum(PROMPT_SCOPE_IDS).optional().describe('统一解读资料范围；会同步紫微运限层'),
});

const ziweiCompatibilitySchema = z.object({
  person1: ziweiSchema.omit({ promptScope: true }),
  person2: ziweiSchema.omit({ promptScope: true }),
});

const ziweiCompatibilityPromptSchema = ziweiCompatibilitySchema.extend({
  question: z.string().optional().describe('希望围绕双方关系解读的问题'),
  promptTopic: z.enum(ZIWEI_PROMPT_TOPICS).optional().describe('关系分析主题'),
  promptMode: z
    .enum(PROMPT_MODES)
    .optional()
    .describe('framework=内置关系任务，custom=用户问题加通用短答题框架'),
  schools: z
    .array(z.enum(ZIWEI_SCHOOLS))
    .min(1)
    .max(3)
    .refine((values) => new Set(values).size === values.length, '不能选择重复流派')
    .optional()
    .describe('紫微合盘解读流派；选择两个或三个时生成多派合参'),
  topicId: z.string().optional().describe('统一解读主题 ID'),
  subtopicId: z.string().optional().describe('统一解读主题细项 ID；必须属于所选主题'),
  scope: z.enum(PROMPT_SCOPE_IDS).optional().describe('统一解读资料范围'),
});

function mapPromptScopeToZiweiScope(scope: string | undefined): ZiweiPromptScope | undefined {
  const mapped: Record<string, ZiweiPromptScope | undefined> = {
    natal: 'origin',
    full: 'full',
    decadal: 'decadal',
    yearly: 'yearly',
    monthly: 'monthly',
    daily: 'daily',
    hourly: 'hourly',
  };
  return scope === undefined ? undefined : mapped[scope];
}

export function buildMcpZiweiFortuneRangeOptions(
  scope: ZiweiPromptScope,
  scopeDate: string | undefined,
  hourIndex: number,
): ZiweiFortuneRangeOptions | undefined {
  const mapped: Partial<Record<ZiweiPromptScope, ZiweiFortuneRangeOptions['scope']>> = {
    full: 'all',
    decadal: 'current',
    yearly: 'year',
    monthly: 'month',
    daily: 'day',
    hourly: 'hour',
  };
  const fortuneScope = mapped[scope];
  if (!fortuneScope) return undefined;
  const dateStr =
    scopeDate === undefined ? undefined : readMcpDateOnly(scopeDate, 'scopeDate').value;
  return {
    scope: fortuneScope,
    ...(dateStr ? { dateStr, hourIndex } : {}),
  };
}

export function buildMcpZiweiChartInput(args: z.infer<typeof ziweiSchema>) {
  const useTrueSolarTime = args.useTrueSolarTime ?? false;
  assertMcpBirthDate({
    year: args.year,
    month: args.month,
    day: args.day,
    dateType: args.dateType,
    isLeapMonth: args.isLeapMonth ?? false,
  });
  if (!useTrueSolarTime && typeof args.timeIndex !== 'number') {
    throw new Error('请选择出生时辰。');
  }
  const trueSolarTimeInput = useTrueSolarTime
    ? {
        timeIndex: '' as const,
        birthHour: String(readMcpIntegerLikeInRange(args.birthHour, 'birthHour', 0, 23)),
        birthMinute: String(readMcpIntegerLikeInRange(args.birthMinute, 'birthMinute', 0, 59)),
        birthLongitude: String(
          readMcpNumberLikeInRange(args.birthLongitude, 'birthLongitude', -180, 180),
        ),
      }
    : null;
  const timeIndex: number | '' = trueSolarTimeInput ? '' : args.timeIndex!;

  return buildZiweiChartInput({
    name: args.name || '',
    gender: args.gender,
    dateType: args.dateType,
    year: args.year,
    month: args.month,
    day: args.day,
    timeIndex,
    isLeapMonth: args.isLeapMonth ?? false,
    useTrueSolarTime,
    birthHour: trueSolarTimeInput?.birthHour ?? args.birthHour ?? '',
    birthMinute: trueSolarTimeInput?.birthMinute ?? args.birthMinute ?? '',
    birthLongitude: trueSolarTimeInput?.birthLongitude ?? args.birthLongitude ?? '',
    timezone: args.timezone,
    timeZoneId: args.timeZoneId,
    applyChinaDst: args.applyChinaDst,
    algorithm: args.algorithm ?? 'default',
  });
}

export function registerZiweiTool(server: McpServer) {
  server.registerTool(
    'ziwei_calculate',
    {
      description:
        '紫微斗数排盘：根据出生信息计算紫微命盘与当前大限；启用真太阳时时返回统一校正计算链、事实、汇总与限制，关闭时保留传统时辰直接排盘。通过 promptScope 可指定本命、当前阶段、具体流年或全部运限范围',
      inputSchema: { ...ziweiSchema.shape, ...calculationDetailShape },
      outputSchema: ziweiOutputSchema,
    },
    async (args) => {
      try {
        const input = buildMcpZiweiChartInput(args);
        const scope = (args.promptScope ?? 'decadal') as ZiweiPromptScope;
        const scopes: ScopeType[] = Array.from(
          new Set(['origin' as ScopeType, ...getZiweiPromptCalculationScopes(scope)]),
        );
        const currentContext = getDefaultHoroscopeContext();
        const horoscopeContext = {
          dateStr: args.scopeDate ?? currentContext.dateStr,
          hourIndex: args.scopeHourIndex ?? currentContext.hourIndex,
        };
        const fortuneRange = buildMcpZiweiFortuneRangeOptions(
          scope,
          horoscopeContext.dateStr,
          horoscopeContext.hourIndex,
        );
        const result = await calculateZiweiChartForScopes(input, scopes, undefined, {
          ...(fortuneRange ? { fortuneRange } : {}),
          horoscopeContext,
        });
        return createStructuredToolResult(
          { ...buildSerializableZiweiResult(result) },
          args.detailMode,
        );
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '排盘失败'));
      }
    },
  );

  server.registerTool(
    'ziwei_prompt',
    {
      description:
        '紫微斗数排盘并生成可直接交给 AI 的完整任务书，同时返回本命十二宫、四化和所选运限资料',
      inputSchema: ziweiPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const input = buildMcpZiweiChartInput(args);
        const selection = readMcpPromptSelection({
          methodId: 'ziwei',
          topicId: args.topicId,
          subtopicId: args.subtopicId,
          scope: args.scope,
        });
        const scope = (
          args.scope !== undefined
            ? mapPromptScopeToZiweiScope(selection?.scope)
            : (args.promptScope ?? mapPromptScopeToZiweiScope(selection?.scope) ?? 'decadal')
        ) as ZiweiPromptScope;
        const scopes: ScopeType[] = Array.from(
          new Set(['origin' as ScopeType, ...getZiweiPromptCalculationScopes(scope)]),
        );
        const currentContext = getDefaultHoroscopeContext();
        const horoscopeContext = {
          dateStr: args.scopeDate ?? currentContext.dateStr,
          hourIndex: args.scopeHourIndex ?? currentContext.hourIndex,
        };
        const fortuneRange = buildMcpZiweiFortuneRangeOptions(
          scope,
          horoscopeContext.dateStr,
          horoscopeContext.hourIndex,
        );
        const result = await calculateZiweiChartForScopes(input, scopes, undefined, {
          ...(fortuneRange ? { fortuneRange } : {}),
          horoscopeContext,
        });
        return createStructuredToolResult({
          result: buildSerializableZiweiResult(result),
          prompt: buildZiweiPromptForRuntime({
            result,
            question: args.question,
            topic: args.promptTopic ? (args.promptTopic as ZiweiPromptTopic) : undefined,
            scope,
            mode: (args.promptMode ?? 'framework') as PromptMode,
            school: args.school as ZiweiSchool | undefined,
            schools: args.schools as ZiweiSchool[] | undefined,
            selection,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成紫微提示词失败'));
      }
    },
  );

  server.registerTool(
    'ziwei_compatibility',
    {
      description:
        '紫微双盘结构化证据计算：返回双方本命盘、关键宫位叠盘、跨盘生年四化落宫和解释边界，不输出匹配总分',
      inputSchema: { ...ziweiCompatibilitySchema.shape, ...calculationDetailShape },
      outputSchema: withErrorOutputSchema({
        charts: z.unknown().describe('双方紫微本命盘'),
        compatibility: z.unknown().describe('宫位叠盘、四化交叉落宫与结构化证据'),
      }),
    },
    async (args) => {
      try {
        const [person1, person2] = await Promise.all([
          calculateZiweiChartForScopes(buildMcpZiweiChartInput(args.person1), ['origin']),
          calculateZiweiChartForScopes(buildMcpZiweiChartInput(args.person2), ['origin']),
        ]);
        const compatibility = analyzeZiweiCompatibility(
          person1.payloadByScope.origin,
          person2.payloadByScope.origin,
          {
            person1Name: args.person1.name,
            person2Name: args.person2.name,
            astrolabe1: person1.astrolabe,
            astrolabe2: person2.astrolabe,
          },
        );
        return createStructuredToolResult(
          {
            charts: {
              person1: buildSerializableZiweiResult(person1),
              person2: buildSerializableZiweiResult(person2),
            },
            compatibility,
          },
          args.detailMode,
        );
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '紫微双盘计算失败'));
      }
    },
  );

  server.registerTool(
    'ziwei_compatibility_prompt',
    {
      description:
        '紫微双盘计算并生成结构化 AI 提示词：保留宫位叠盘、跨盘四化证据、方法说明和解释限制',
      inputSchema: ziweiCompatibilityPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const [person1, person2] = await Promise.all([
          calculateZiweiChartForScopes(buildMcpZiweiChartInput(args.person1), ['origin']),
          calculateZiweiChartForScopes(buildMcpZiweiChartInput(args.person2), ['origin']),
        ]);
        const compatibility = analyzeZiweiCompatibility(
          person1.payloadByScope.origin,
          person2.payloadByScope.origin,
          {
            person1Name: args.person1.name,
            person2Name: args.person2.name,
            astrolabe1: person1.astrolabe,
            astrolabe2: person2.astrolabe,
          },
        );
        const result = {
          charts: {
            person1: buildSerializableZiweiResult(person1),
            person2: buildSerializableZiweiResult(person2),
          },
          compatibility,
        };
        const selection = readMcpPromptSelection({
          methodId: 'ziwei',
          topicId: args.topicId,
          subtopicId: args.subtopicId,
          scope: args.scope,
        });
        return createStructuredToolResult({
          result,
          prompt: applyMcpPromptSelection(
            buildCombinedZiweiCompatibilityPrompt({
              primaryPayload: person1.payloadByScope.origin,
              partnerPayload: person2.payloadByScope.origin,
              primaryAstrolabe: person1.astrolabe,
              partnerAstrolabe: person2.astrolabe,
              primaryTrueSolarEvidence: person1.trueSolarEvidence,
              partnerTrueSolarEvidence: person2.trueSolarEvidence,
              primaryName: args.person1.name,
              partnerName: args.person2.name,
              topic: args.promptTopic ?? 'relationship',
              question: args.question ?? '',
              isCustomQuestion: args.promptMode === 'custom',
              schools: args.schools,
            }),
            selection,
            '请依据双方紫微盘面、宫位叠盘和四化证据完成关系解读。',
          ),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成紫微双盘提示词失败'));
      }
    },
  );
}
