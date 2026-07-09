import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ScopeType } from '../../../src/types/analysis.js';
import {
  buildZiweiChartInput,
  calculateZiweiChartForScopes,
} from '../../../src/lib/full-chart-engine/ziwei.js';
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
import { ziweiOutputSchema } from '../schemas.js';
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
      '紫微流派：sanhe=三合派（三方四正、星曜庙旺）, feixing=飞星派（四化飞星链路）, sihua=四化派（生年四化主线）。不传则不附加流派指引',
    ),
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
  });
}

export function registerZiweiTool(server: McpServer) {
  server.registerTool(
    'ziwei_calculate',
    {
      description:
        '紫微斗数排盘：根据出生信息计算紫微命盘。默认只返回 origin（本命）范围；通过 promptScope 可指定额外的运限范围（full/decadal/yearly/monthly/daily/hourly/age）',
      inputSchema: ziweiSchema.shape,
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
        return createStructuredToolResult(buildSerializableZiweiResult(result));
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '排盘失败'));
      }
    },
  );

  server.registerTool(
    'ziwei_prompt',
    {
      description:
        '紫微斗数排盘并生成结构化 AI 解读提示词：一次调用返回命盘数据和可直接复制给 AI 的提示词。默认只返回 origin（本命）范围；通过 promptScope 可指定额外的运限范围（full/decadal/yearly/monthly/daily/hourly/age）',
      inputSchema: ziweiPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('紫微命盘数据'),
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
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成紫微提示词失败'));
      }
    },
  );
}
