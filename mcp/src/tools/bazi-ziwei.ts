import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ScopeType } from '../../../src/types/analysis.js';
import { baziCalculator } from '@core/bazi/baziCalculator';
import { calculateZiweiChartForScopes } from '../../../src/lib/full-chart-engine/ziwei.js';
import {
  BAZI_PROMPT_TOPICS,
  BAZI_MULTI_SCHOOLS,
  BAZI_SCHOOLS,
  PROMPT_MODES,
  ZIWEI_PROMPT_SCOPES,
  ZIWEI_PROMPT_TOPICS,
  ZIWEI_SCHOOLS,
  buildBaziZiweiPromptForResults,
  buildSerializableZiweiResult,
  getZiweiPromptCalculationScopes,
  type BaziPromptTopic,
  type BaziSchool,
  type PromptMode,
  type ZiweiPromptScope,
  type ZiweiPromptTopic,
  type ZiweiSchool,
} from '../../../src/lib/public-api/prompt-builders.js';
import { promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildBaziPerson } from './bazi.js';
import { buildMcpZiweiChartInput } from './ziwei.js';

const baziZiweiPromptSchema = z.object({
  name: z.string().optional().describe('姓名（可选）'),
  gender: z.enum(['male', 'female']).describe('性别：male 为男，female 为女'),
  year: z.number().describe('出生年'),
  month: z.number().describe('出生月'),
  day: z.number().describe('出生日'),
  timeIndex: z
    .number()
    .optional()
    .describe('时辰索引：0=早子时,1=丑时,...,12=晚子时；未启用真太阳时时必填'),
  dateType: z.enum(['solar', 'lunar']).describe('日期类型：solar 为阳历，lunar 为农历'),
  isLeapMonth: z.boolean().optional().describe('是否为闰月（仅农历有效）'),
  useTrueSolarTime: z.boolean().optional().describe('是否启用真太阳时校正'),
  birthHour: z.number().optional().describe('精准出生小时，启用真太阳时时必填'),
  birthMinute: z.number().optional().describe('精准出生分钟，启用真太阳时时必填'),
  birthPlace: z.string().optional().describe('出生地名称，启用真太阳时时可选'),
  birthLongitude: z.number().optional().describe('出生地经度，启用真太阳时时必填'),
  timezone: z.number().min(-12).max(14).optional().describe('固定 UTC 偏移，默认 UTC+8'),
  timeZoneId: z.string().min(1).optional().describe('IANA 历史时区，如 America/New_York'),
  applyChinaDst: z.boolean().optional().describe('是否应用中国 1986-1991 历史夏令时校正'),
  shenShaScope: z
    .enum(['common', 'all'])
    .optional()
    .describe('神煞输出范围：common=默认55个常用神煞，all=全部已计算神煞'),
  shenShaVariants: z
    .object({
      referenceProfile: z
        .enum(['wenzhen', 'classical'])
        .optional()
        .describe('整组参考口径：wenzhen=问真学堂整理口径，classical=原有传统兼容口径'),
      kongWangBasis: z.enum(['day', 'day-and-year']).optional(),
      yangRenMode: z.enum(['yang-stems-only', 'include-yin-ren']).optional(),
      tongZiScope: z.enum(['day-hour', 'all-pillars']).optional(),
    })
    .optional()
    .describe('神煞争议口径；不传时使用问真学堂整理口径'),
  algorithm: z
    .enum(['default', 'zhongzhou'])
    .optional()
    .describe('紫微底层安星口径：default=传统通行安星法，zhongzhou=中州派安星法'),
  question: z.string().describe('用户希望围绕八字和紫微合参解读的问题'),
  baziPromptTopic: z
    .enum(BAZI_PROMPT_TOPICS)
    .optional()
    .describe('八字侧提示词主题；不传使用 general'),
  ziweiPromptTopic: z
    .enum(ZIWEI_PROMPT_TOPICS)
    .optional()
    .describe('紫微侧提示词主题；不传使用 life'),
  promptScope: z
    .enum(ZIWEI_PROMPT_SCOPES)
    .optional()
    .describe(
      '紫微运限范围：origin=本命, full=完整输出版, decadal=大限, yearly=流年, monthly=流月等',
    ),
  promptMode: z
    .enum(PROMPT_MODES)
    .optional()
    .describe('提示词模式：framework=内置完整框架, custom=只围绕用户问题自由作答'),
  baziSchool: z
    .enum(BAZI_SCHOOLS)
    .optional()
    .describe(
      '八字流派：traditional=传统兼容名, ziping=子平派, mangpai=盲派（宫位十神、主宾体用、组合取象）, xinpai=新派（旺衰判定、十神流通、喜忌落位）',
    ),
  baziSchools: z
    .array(z.enum(BAZI_MULTI_SCHOOLS))
    .min(1)
    .max(3)
    .refine((values) => new Set(values).size === values.length, '不能选择重复流派')
    .optional()
    .describe('八字侧多派合参'),
  ziweiSchool: z
    .enum(ZIWEI_SCHOOLS)
    .optional()
    .describe('紫微流派：sanhe=三合派, feixing=飞星派, sihua=四化派'),
  ziweiSchools: z
    .array(z.enum(ZIWEI_SCHOOLS))
    .min(1)
    .max(3)
    .refine((values) => new Set(values).size === values.length, '不能选择重复流派')
    .optional()
    .describe('紫微侧多派合参'),
});

function buildCombinedZiweiInput(args: z.infer<typeof baziZiweiPromptSchema>) {
  return buildMcpZiweiChartInput({
    name: args.name,
    gender: args.gender,
    dateType: args.dateType,
    year: String(args.year),
    month: String(args.month),
    day: String(args.day),
    timeIndex: args.timeIndex,
    promptScope: args.promptScope,
    isLeapMonth: args.isLeapMonth,
    useTrueSolarTime: args.useTrueSolarTime,
    birthHour: args.birthHour === undefined ? undefined : String(args.birthHour),
    birthMinute: args.birthMinute === undefined ? undefined : String(args.birthMinute),
    birthLongitude: args.birthLongitude === undefined ? undefined : String(args.birthLongitude),
    timezone: args.timezone,
    timeZoneId: args.timeZoneId,
    applyChinaDst: args.applyChinaDst,
    algorithm: args.algorithm,
  });
}

export function registerBaziZiweiTool(server: McpServer) {
  server.registerTool(
    'bazi_ziwei_prompt',
    {
      description:
        '八字紫微合参提示词：同一份出生信息同时计算八字和紫微斗数，仅返回可直接用于 AI 深度解读的完整提示词',
      inputSchema: baziZiweiPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const baziResult = baziCalculator.calculateBazi(buildBaziPerson(args));
        const scope = (args.promptScope ?? 'origin') as ZiweiPromptScope;
        const scopes: ScopeType[] = Array.from(
          new Set(['origin' as ScopeType, ...getZiweiPromptCalculationScopes(scope)]),
        );
        const ziweiResult = await calculateZiweiChartForScopes(
          buildCombinedZiweiInput(args),
          scopes,
        );
        const serializableZiweiResult = buildSerializableZiweiResult(ziweiResult);

        return createStructuredToolResult({
          result: {
            bazi: baziResult,
            ziwei: serializableZiweiResult,
          },
          prompt: buildBaziZiweiPromptForResults({
            baziResult,
            ziweiResult,
            question: args.question,
            baziTopic: (args.baziPromptTopic ?? 'general') as BaziPromptTopic,
            ziweiTopic: args.ziweiPromptTopic as ZiweiPromptTopic | undefined,
            ziweiScope: scope,
            mode: (args.promptMode ?? 'framework') as PromptMode,
            baziSchool: args.baziSchool as BaziSchool | undefined,
            baziSchools: args.baziSchools as BaziSchool[] | undefined,
            ziweiSchool: args.ziweiSchool as ZiweiSchool | undefined,
            ziweiSchools: args.ziweiSchools as ZiweiSchool[] | undefined,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成八字紫微合参提示词失败'));
      }
    },
  );
}
