import { getDefaultHoroscopeContext } from 'mingyu-core/ziwei/iztro';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { baziCalculator } from '@core/bazi/baziCalculator';
import {
  buildCurrentBaziFortuneSelectionForScope,
  buildFortuneSelectionContext,
} from '@core/bazi/fortuneSelection';
import { calculateZiweiFactsForScopes } from '../../../src/lib/full-chart-engine/ziwei.js';
import {
  BAZI_MULTI_SCHOOLS,
  BAZI_SCHOOLS,
  PROMPT_MODES,
  ZIWEI_PROMPT_SCOPES,
  ZIWEI_SCHOOLS,
  THEMATIC_TOPICS,
  PROMPT_SCOPE_IDS,
  normalizeThematicTopic,
  buildBaziZiweiBatchPromptForResults,
  buildThematicConsultationPrompt,
  buildSerializableZiweiResult,
  type BaziSchool,
  type PromptMode,
  type ZiweiPromptScope,
  type ZiweiSchool,
} from '../../../src/lib/public-api/prompt-builders.js';
import { promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildBaziPerson, baziSchema, calculateMcpBaziSingleChart } from './bazi.js';
import {
  buildMcpZiweiChartInput,
  buildMcpZiweiFortuneRangeOptions,
  getMcpZiweiBatchMetadata,
  resolveMcpZiweiBatchOptions,
} from './ziwei.js';
import { readMcpPromptSelection } from './prompt-helpers.js';
import {
  calculateMcpCombinedBatchPage,
  combinedBatchSchema,
  resolveMcpCombinedBatchCursor,
} from './combined-batch.js';

const thematicConsultationPromptSchema = baziSchema.extend({
  system: z
    .enum(['bazi_ziwei', 'bazi', 'ziwei'])
    .optional()
    .default('bazi_ziwei')
    .describe(
      '术式体系：bazi_ziwei=八字紫微双盘合参（默认最全），bazi=专注八字子平，ziwei=专注紫微斗数',
    ),
  topic: z
    .enum(THEMATIC_TOPICS)
    .optional()
    .default('general')
    .describe(
      '大类咨询主题：general=综合全景（默认），relationship=婚恋感情，career=事业职场，wealth=求财财富，health=身体健康，family=家庭六亲，academic=学业考试，timing=岁运应期时机',
    ),
  methodId: z
    .enum(['bazi', 'ziwei', 'bazi-ziwei'])
    .optional()
    .describe('统一解读方法：bazi=八字，ziwei=紫微斗数，bazi-ziwei=八字紫微合参'),
  topicId: z.enum(THEMATIC_TOPICS).optional().describe('统一解读主题 ID；优先于兼容字段 topic'),
  subtopicId: z.string().optional().describe('统一解读主题细项 ID；必须属于所选主题'),
  question: z
    .string()
    .optional()
    .describe('用户的具体提问，若不提供则根据大类主题自动生成针对性专业任务问题'),
  promptScope: z
    .enum(ZIWEI_PROMPT_SCOPES)
    .optional()
    .describe(
      '运限范围：未指定时默认当前阶段；origin=本命盘，full=已验证童限与大限及各阶段流年，decadal=大限，yearly=流年，monthly=流月，daily=流日等',
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
  scopeBatch: z
    .object({
      startIndex: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(1).optional(),
    })
    .optional()
    .describe('仅在 promptScope=full 时生效；每次只计算一个 scope'),
  fortuneBatch: z
    .object({
      startIndex: z.number().int().min(0).optional(),
      limit: z.number().int().min(1).max(1).optional(),
    })
    .optional()
    .describe('仅在 promptScope=full 或 decadal 时生效；按年龄年分页'),
  combinedBatch: combinedBatchSchema,
  scope: z.enum(PROMPT_SCOPE_IDS).optional().describe('统一分析范围；优先于兼容字段 promptScope'),
  promptMode: z
    .enum(PROMPT_MODES)
    .optional()
    .describe('提示词模式：framework=内置主题任务, custom=用户问题加通用短答题框架'),
  baziSchool: z
    .enum(BAZI_SCHOOLS)
    .optional()
    .describe('八字流派：traditional=传统, ziping=子平, mangpai=盲派, xinpai=新派'),
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
  algorithm: z
    .enum(['default', 'zhongzhou'])
    .optional()
    .describe('紫微底层安星口径：default=传统通行安星法，zhongzhou=中州派安星法'),
});

function buildCombinedZiweiInput(args: z.infer<typeof thematicConsultationPromptSchema>) {
  const standardTimeIndex =
    !args.useTrueSolarTime && args.birthSecond !== undefined
      ? buildBaziPerson(args).timeIndex
      : args.timeIndex;
  return buildMcpZiweiChartInput({
    name: args.name,
    gender: args.gender,
    dateType: args.dateType,
    year: String(args.year),
    month: String(args.month),
    day: String(args.day),
    timeIndex: standardTimeIndex,
    promptScope:
      args.scope === 'natal'
        ? 'origin'
        : ((args.scope as ZiweiPromptScope | undefined) ?? args.promptScope),
    scopeDate: args.scopeDate,
    scopeHourIndex: args.scopeHourIndex,
    isLeapMonth: args.isLeapMonth,
    useTrueSolarTime: args.useTrueSolarTime,
    birthHour: args.birthHour === undefined ? undefined : String(args.birthHour),
    birthMinute: args.birthMinute === undefined ? undefined : String(args.birthMinute),
    birthSecond: args.birthSecond === undefined ? undefined : String(args.birthSecond),
    birthLongitude: args.birthLongitude === undefined ? undefined : String(args.birthLongitude),
    timezone: args.timezone,
    timeZoneId: args.timeZoneId,
    applyChinaDst: args.applyChinaDst,
    algorithm: args.algorithm,
  });
}

export function registerThematicTool(server: McpServer) {
  server.registerTool(
    'thematic_consultation_prompt',
    {
      description:
        '大类主题命理咨询：指定主题与八字、紫微或合参体系，生成完整自包含任务书；纯八字且时辰未知时默认只返回首个本命候选，可按 unknownTimeBatch 逐项续取',
      inputSchema: thematicConsultationPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const legacySystem = args.system ?? 'bazi_ziwei';
        const methodId =
          args.methodId ??
          (legacySystem === 'bazi' ? 'bazi' : legacySystem === 'ziwei' ? 'ziwei' : 'bazi-ziwei');
        const system = methodId === 'bazi' ? 'bazi' : methodId === 'ziwei' ? 'ziwei' : 'bazi_ziwei';
        if (args.unknownTimeBatch && system !== 'bazi') {
          throw new Error('unknownTimeBatch 仅支持八字单盘，不能用于紫微或八字紫微合参。');
        }
        const baziPerson =
          system === 'bazi_ziwei' || system === 'bazi' ? buildBaziPerson(args) : null;
        const unknownBazi = baziPerson?.isThreePillars === true;
        if (system === 'bazi_ziwei' && unknownBazi) {
          throw new Error('八字紫微合参需要明确的出生时辰，未知时辰可先查询八字单盘候选。');
        }
        const topic = normalizeThematicTopic(args.topic);
        const scope =
          args.scope === undefined
            ? ((args.promptScope ??
                (system === 'bazi' && unknownBazi ? 'origin' : 'decadal')) as ZiweiPromptScope)
            : args.scope === 'natal'
              ? 'origin'
              : (args.scope as ZiweiPromptScope);

        if (system === 'bazi' && unknownBazi && scope !== 'origin') {
          throw new Error('出生时辰未知，补齐出生时分后才能选择岁运。');
        }
        if (
          system === 'bazi' &&
          unknownBazi &&
          (args.scopeBatch !== undefined ||
            args.fortuneBatch !== undefined ||
            args.combinedBatch !== undefined)
        ) {
          throw new Error('出生时辰未知时不能使用岁运或合参分页，请逐页续取本命候选。');
        }

        const combinedCursor = resolveMcpCombinedBatchCursor({
          scope,
          combinedBatch: args.combinedBatch,
          scopeBatch: args.scopeBatch,
          fortuneBatch: args.fortuneBatch,
          supported: system === 'bazi_ziwei',
        });
        if (combinedCursor) {
          const selection = readMcpPromptSelection({
            methodId: 'bazi-ziwei',
            topicId: args.topicId ?? topic,
            subtopicId: args.subtopicId,
            scope: args.scope,
          });
          const currentContext = getDefaultHoroscopeContext();
          const horoscopeContext = {
            dateStr: args.scopeDate ?? currentContext.dateStr,
            hourIndex: args.scopeHourIndex ?? currentContext.hourIndex,
          };
          const page = await calculateMcpCombinedBatchPage({
            cursor: combinedCursor,
            scopeContext: horoscopeContext,
            calculateBaziBatch: (request) =>
              baziCalculator.calculateBaziBatch(buildBaziPerson(args), request),
            ziweiInput: buildCombinedZiweiInput(args),
          });
          const promptCommon = {
            question: args.question ?? `请围绕${topic}主题解读本页资料。`,
            mode: (args.promptMode ?? 'framework') as PromptMode,
            baziSchool: args.baziSchool as BaziSchool | undefined,
            baziSchools: args.baziSchools as BaziSchool[] | undefined,
            ziweiSchool: args.ziweiSchool as ZiweiSchool | undefined,
            ziweiSchools: args.ziweiSchools as ZiweiSchool[] | undefined,
            selection,
          };
          const identity = { system, methodId, topic, selection };
          if (page.section === 'bazi-natal') {
            return createStructuredToolResult({
              result: { ...identity, bazi: page.baziResult },
              batch: { combinedBatch: page.batch },
              prompt: buildBaziZiweiBatchPromptForResults({
                ...promptCommon,
                section: page.section,
                baziResult: page.baziResult,
              }),
            });
          }
          if (page.section === 'bazi-fortune') {
            return createStructuredToolResult({
              result: { ...identity, bazi: page.baziResult },
              batch: { combinedBatch: page.batch },
              prompt: buildBaziZiweiBatchPromptForResults({
                ...promptCommon,
                section: page.section,
                baziResult: page.baziResult,
                fortuneTextBatch: page.fortuneTextBatch,
              }),
            });
          }
          return createStructuredToolResult({
            result: {
              ...identity,
              ziwei: buildSerializableZiweiResult(page.ziweiResult),
            },
            batch: { combinedBatch: page.batch },
            prompt: buildBaziZiweiBatchPromptForResults({
              ...promptCommon,
              section: page.section,
              ziweiResult: page.ziweiResult,
            }),
          });
        }

        let baziResult: ReturnType<typeof baziCalculator.calculateBazi> | undefined;
        let unknownTimeBatch:
          ReturnType<typeof calculateMcpBaziSingleChart>['unknownTimeBatch'] | undefined;
        let ziweiResult: Awaited<ReturnType<typeof calculateZiweiFactsForScopes>> | undefined;
        let serializableZiweiResult: unknown | undefined;
        let ziweiBatch: ReturnType<typeof getMcpZiweiBatchMetadata> | undefined;

        if (system === 'bazi_ziwei' || system === 'bazi') {
          if (system === 'bazi' && baziPerson) {
            const calculation = calculateMcpBaziSingleChart(baziPerson, args.unknownTimeBatch);
            baziResult = calculation.result;
            unknownTimeBatch = calculation.unknownTimeBatch;
          } else {
            baziResult = baziCalculator.calculateBazi(baziPerson!);
          }
        }

        if (system === 'bazi_ziwei' || system === 'ziwei') {
          const batchOptions = resolveMcpZiweiBatchOptions(
            scope,
            args.scopeBatch,
            args.fortuneBatch,
          );
          const ziweiInput = buildCombinedZiweiInput(args);
          const currentContext = getDefaultHoroscopeContext();
          const horoscopeContext = {
            dateStr: args.scopeDate ?? currentContext.dateStr,
            hourIndex: args.scopeHourIndex ?? currentContext.hourIndex,
          };
          const fortuneRange =
            batchOptions.independentBatch === 'scope'
              ? undefined
              : buildMcpZiweiFortuneRangeOptions(
                  scope,
                  horoscopeContext.dateStr,
                  horoscopeContext.hourIndex,
                  batchOptions.fortuneBatch,
                );
          const computedZiwei = await calculateZiweiFactsForScopes(
            ziweiInput,
            batchOptions.scopes,
            undefined,
            {
              ...(fortuneRange ? { fortuneRange } : {}),
              horoscopeContext,
              ...(batchOptions.independentBatch
                ? { independentBatch: batchOptions.independentBatch }
                : {}),
            },
          );
          ziweiResult = computedZiwei;
          serializableZiweiResult = buildSerializableZiweiResult(computedZiwei);
          ziweiBatch = getMcpZiweiBatchMetadata(computedZiwei, batchOptions.scopeBatch);
        } else if (
          args.scopeBatch !== undefined ||
          args.fortuneBatch !== undefined ||
          args.combinedBatch !== undefined
        ) {
          throw new Error('紫微分页参数仅适用于包含紫微资料的咨询体系。');
        }

        const baziFortuneScope =
          scope === 'origin'
            ? 'natal'
            : scope === 'full'
              ? 'full'
              : scope === 'decadal'
                ? 'dayun'
                : scope === 'yearly'
                  ? 'year'
                  : scope === 'monthly'
                    ? 'month'
                    : scope === 'daily'
                      ? 'day'
                      : undefined;
        const baziFortuneSelection =
          baziResult &&
          baziFortuneScope &&
          baziFortuneScope !== 'natal' &&
          baziFortuneScope !== 'full'
            ? buildCurrentBaziFortuneSelectionForScope(baziResult, baziFortuneScope)
            : null;
        const baziFortuneSelectionContext =
          baziResult && baziFortuneSelection
            ? buildFortuneSelectionContext(baziResult, baziFortuneSelection)
            : null;

        const promptResult = buildThematicConsultationPrompt({
          system,
          methodId,
          topic,
          topicId: args.topicId ?? topic,
          subtopicId: args.subtopicId,
          scope: args.scope,
          question: args.question,
          mode: (args.promptMode ?? 'framework') as PromptMode,
          baziResult,
          fortuneSelectionContext: baziFortuneSelectionContext,
          fortuneScope: baziFortuneScope,
          ziweiResult,
          ziweiScope: scope,
          baziSchool: args.baziSchool as BaziSchool | undefined,
          baziSchools: args.baziSchools as BaziSchool[] | undefined,
          ziweiSchool: args.ziweiSchool as ZiweiSchool | undefined,
          ziweiSchools: args.ziweiSchools as ZiweiSchool[] | undefined,
        });

        return createStructuredToolResult({
          result: {
            system: promptResult.system,
            methodId: promptResult.methodId,
            topic: promptResult.topic,
            topicLabel: promptResult.topicLabel,
            topicTitle: promptResult.topicTitle,
            subtopicId: promptResult.subtopicId,
            subtopicLabel: promptResult.subtopicLabel,
            selection: promptResult.selection,
            focusPalaces: promptResult.focusPalaces,
            focusElements: promptResult.focusElements,
            scope: promptResult.scope,
            bazi: baziResult,
            ziwei: serializableZiweiResult,
          },
          ...(unknownTimeBatch
            ? { batch: { unknownTimeBatch } }
            : ziweiBatch
              ? { batch: ziweiBatch }
              : {}),
          prompt: promptResult.prompt,
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成大类主题咨询提示词失败'));
      }
    },
  );
}
