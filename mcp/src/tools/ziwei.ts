import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ScopeType } from '../../../src/types/analysis.js';
import { buildZiweiChartInput, calculateZiweiChartForScopes } from 'mingyu-core/ziwei';
import { buildCombinedZiweiCompatibilityPrompt } from 'mingyu-core/ziwei/prompt';
import { analyzeZiweiCompatibility } from 'mingyu-core/ziwei/iztro';
import {
  PROMPT_MODES,
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
import { calculationDetailShape, ziweiOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import {
  assertMcpBirthDate,
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
      '运限范围：origin=本命（默认）, full=完整输出版, decadal=大限, yearly=流年, monthly=流月, daily=流日, hourly=流时, age=年龄。默认只返回 origin 范围；full 会返回本命、大限、流年、流月、流日、流时。',
    ),
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
    .describe('提示词模式：framework=内置完整框架, custom=只围绕用户问题自由作答'),
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
    .describe('framework=内置关系框架，custom=只围绕用户问题作答'),
  schools: z
    .array(z.enum(ZIWEI_SCHOOLS))
    .min(1)
    .max(3)
    .refine((values) => new Set(values).size === values.length, '不能选择重复流派')
    .optional()
    .describe('紫微合盘解读流派；选择两个或三个时生成多派合参'),
});

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
        '紫微斗数排盘：根据出生信息计算紫微命盘；启用真太阳时时返回统一校正计算链、事实、汇总与限制，关闭时保留传统时辰直接排盘。默认只返回 origin（本命）范围；通过 promptScope 可指定额外运限范围',
      inputSchema: { ...ziweiSchema.shape, ...calculationDetailShape },
      outputSchema: ziweiOutputSchema,
    },
    async (args) => {
      try {
        const input = buildMcpZiweiChartInput(args);
        const scope = (args.promptScope ?? 'origin') as ZiweiPromptScope;
        const scopes: ScopeType[] = Array.from(
          new Set(['origin' as ScopeType, ...getZiweiPromptCalculationScopes(scope)]),
        );
        const result = await calculateZiweiChartForScopes(input, scopes);
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
        '紫微斗数排盘并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要命盘数据时调用 ziwei_calculate',
      inputSchema: ziweiPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const input = buildMcpZiweiChartInput(args);
        const scope = (args.promptScope ?? 'origin') as ZiweiPromptScope;
        const scopes: ScopeType[] = Array.from(
          new Set(['origin' as ScopeType, ...getZiweiPromptCalculationScopes(scope)]),
        );
        const result = await calculateZiweiChartForScopes(input, scopes);
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
      outputSchema: {
        charts: z.unknown().describe('双方紫微本命盘'),
        compatibility: z.unknown().describe('宫位叠盘、四化交叉落宫与结构化证据'),
      },
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
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的完整证据提示词'),
      },
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
        return createStructuredToolResult({
          result,
          prompt: buildCombinedZiweiCompatibilityPrompt({
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
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成紫微双盘提示词失败'));
      }
    },
  );
}
