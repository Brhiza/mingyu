import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { huangjiJingshi } from 'mingyu-core';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { createPromptSchoolsShape } from './school-options.js';
import { readMcpCustomDate } from './input-helpers.js';

const safeInteger = z.number().int().refine(Number.isSafeInteger, '必须是安全范围内的整数');

const huangjiJingshiSchema = z
  .object({
    customDate: z
      .string()
      .optional()
      .describe(
        '年月日时起盘时间（ISO 8601 格式）；必须带时区，北京时间建议明确提供 +08:00；与其他起法字段互斥',
      ),
    sixDayDateTime: z
      .string()
      .min(1)
      .optional()
      .describe(
        '六日逐爻目标当地公历时间（ISO 8601 格式）；必须同时提供 calendarModel 与 sixDayEpochDateTime，并与其他起法字段互斥；可与历元一起带同一固定 UTC 偏移，或均不带偏移并配合 timezone 或 timeZoneId',
      ),
    sixDayEpochDateTime: z
      .string()
      .min(1)
      .optional()
      .describe(
        '六日逐爻经校定的当地子半历元（ISO 8601 格式）；必须与 sixDayDateTime、calendarModel 同时提供；该时刻对应已过日数0',
      ),
    calendarModel: z
      .literal('six-day-explicit-epoch')
      .optional()
      .describe(
        '六日逐爻公历换算模型；仅可与 sixDayDateTime、sixDayEpochDateTime 同时提供，并须取 six-day-explicit-epoch',
      ),
    timezone: z
      .number()
      .min(-12)
      .max(14)
      .optional()
      .describe('sixDayDateTime 与 sixDayEpochDateTime 未带偏移时的固定 UTC 时区'),
    timeZoneId: z
      .string()
      .optional()
      .describe(
        'sixDayDateTime 与 sixDayEpochDateTime 对应的 IANA 历史时区，例如 America/New_York',
      ),
    epochYear: safeInteger
      .optional()
      .describe(
        '自定义纪元年坐标；与 year 或 elapsedYears 恰好提供一个，不能与 customDate 或六日逐爻字段同用',
      ),
    year: safeInteger
      .optional()
      .describe(
        '目标公元年或自定义纪元下的目标整数年坐标；通行公元模式必须提供，使用 epochYear 时与 elapsedYears 二选一',
      ),
    elapsedYears: safeInteger
      .min(0)
      .optional()
      .describe('自定义纪元下距第一年已经过的完整年数；仅与 epochYear 同时使用，并与 year 二选一'),
    question: z.string().min(1).optional().describe('希望 AI 重点解释的问题'),
    topicId: z.string().optional().describe('统一解读主题 ID'),
    subtopicId: z.string().optional().describe('统一解读主题细项 ID'),
    scope: z.string().optional().describe('统一分析范围 ID'),
  })
  .describe(
    '皇极经世起盘输入模式互斥：customDate、六日逐爻显式历元、通行公元 year、自定义 epochYear 配 year 或 elapsedYears 四类只能选一类',
  );

const huangjiReferenceSchema = z.object({
  table: z
    .enum(['sound-rhythm', 'animal-plant', 'historical-era'])
    .describe('资料表：声音律吕、动植物数或经辰历史纪年'),
  shiIndex: z
    .number()
    .int()
    .min(2149)
    .max(2208)
    .refine(Number.isSafeInteger, '必须是安全范围内的整数')
    .optional()
    .describe('历史纪年原表的经辰序号；仅查询 historical-era 时必须提供，其他资料表不得提供'),
});

const huangjiModeContract = {
  oneOf: [
    {
      required: ['customDate'],
      not: {
        anyOf: [
          { required: ['sixDayDateTime'] },
          { required: ['sixDayEpochDateTime'] },
          { required: ['calendarModel'] },
          { required: ['epochYear'] },
          { required: ['year'] },
          { required: ['elapsedYears'] },
        ],
      },
    },
    {
      required: ['sixDayDateTime', 'sixDayEpochDateTime', 'calendarModel'],
      not: {
        anyOf: [
          { required: ['customDate'] },
          { required: ['epochYear'] },
          { required: ['year'] },
          { required: ['elapsedYears'] },
        ],
      },
    },
    {
      required: ['year'],
      not: {
        anyOf: [
          { required: ['customDate'] },
          { required: ['sixDayDateTime'] },
          { required: ['sixDayEpochDateTime'] },
          { required: ['calendarModel'] },
          { required: ['epochYear'] },
          { required: ['elapsedYears'] },
        ],
      },
    },
    {
      required: ['epochYear', 'year'],
      not: {
        anyOf: [
          { required: ['customDate'] },
          { required: ['sixDayDateTime'] },
          { required: ['sixDayEpochDateTime'] },
          { required: ['calendarModel'] },
          { required: ['elapsedYears'] },
        ],
      },
    },
    {
      required: ['epochYear', 'elapsedYears'],
      not: {
        anyOf: [
          { required: ['customDate'] },
          { required: ['sixDayDateTime'] },
          { required: ['sixDayEpochDateTime'] },
          { required: ['calendarModel'] },
          { required: ['year'] },
        ],
      },
    },
  ],
};

const huangjiCalculationSchema = huangjiJingshiSchema
  .omit({ question: true })
  .extend(calculationDetailShape)
  .describe(
    '皇极经世输入模式互斥：customDate、六日逐爻显式历元、通行公元 year、自定义 epochYear 配 year 或 elapsedYears 四类只能选一类',
  )
  .meta(huangjiModeContract);

const huangjiPromptSchema = huangjiJingshiSchema
  .extend(createPromptSchoolsShape('huangji-jingshi'))
  .describe(
    '皇极经世输入模式互斥：customDate、六日逐爻显式历元、通行公元 year、自定义 epochYear 配 year 或 elapsedYears 四类只能选一类',
  )
  .meta(huangjiModeContract);

const huangjiReferenceContract = {
  oneOf: [
    {
      required: ['table'],
      not: {
        anyOf: [{ required: ['shiIndex'] }, { properties: { table: { const: 'historical-era' } } }],
      },
    },
    {
      required: ['table', 'shiIndex'],
      properties: { table: { const: 'historical-era' } },
    },
  ],
};

const huangjiReferenceToolSchema = huangjiReferenceSchema
  .extend(calculationDetailShape)
  .describe('皇极经世资料表输入：historical-era 必须提供 shiIndex，其他资料表不得提供')
  .meta(huangjiReferenceContract);

function calculateHuangjiJingshi(args: z.infer<typeof huangjiJingshiSchema>) {
  const calendarModel = args.calendarModel;
  const sixDayEpochDateTime = args.sixDayEpochDateTime;
  let sixDayDate: ReturnType<typeof huangjiJingshi.parseHuangjiSixDayDateTime> | undefined;
  if (args.sixDayDateTime !== undefined) {
    if (calendarModel !== 'six-day-explicit-epoch') {
      throw new Error('六日逐爻公历时间必须明确提供 calendarModel=six-day-explicit-epoch。');
    }
    if (sixDayEpochDateTime === undefined) {
      throw new Error('六日逐爻公历时间必须同时提供经校定的 sixDayEpochDateTime。');
    }
    if (
      args.customDate !== undefined ||
      args.epochYear !== undefined ||
      args.year !== undefined ||
      args.elapsedYears !== undefined
    ) {
      throw new Error('六日逐爻公历时间不得同时提供 customDate、epochYear、year 或 elapsedYears。');
    }
    sixDayDate = huangjiJingshi.parseHuangjiSixDayDateTime(
      args.sixDayDateTime,
      args.timezone,
      args.timeZoneId,
      calendarModel,
      sixDayEpochDateTime,
    );
  } else if (calendarModel !== undefined || sixDayEpochDateTime !== undefined) {
    throw new Error('calendarModel 与 sixDayEpochDateTime 只能与 sixDayDateTime 一起提供。');
  } else if (args.customDate !== undefined) {
    if (
      args.epochYear !== undefined ||
      args.year !== undefined ||
      args.elapsedYears !== undefined
    ) {
      throw new Error('皇极经世年月日时起盘不得同时提供 epochYear、year 或 elapsedYears。');
    }
  } else if (args.epochYear === undefined) {
    if (args.year === undefined || args.elapsedYears !== undefined) {
      throw new Error('皇极经世通行公元模式必须只提供 year。');
    }
  } else if ((args.year === undefined) === (args.elapsedYears === undefined)) {
    throw new Error('皇极经世自定义纪元模式的 year 与 elapsedYears 必须且只能提供一个。');
  }
  return huangjiJingshi.calculateHuangjiJingshi({
    ...(args.customDate ? { date: readMcpCustomDate(args.customDate) } : {}),
    ...(sixDayDate ? { sixDayDate } : {}),
    ...(args.epochYear !== undefined ? { epochYear: args.epochYear } : {}),
    ...(args.year !== undefined ? { year: args.year } : {}),
    ...(args.elapsedYears !== undefined ? { elapsedYears: args.elapsedYears } : {}),
    ...(args.question ? { question: args.question } : {}),
  });
}

function calculateHuangjiReference(args: z.infer<typeof huangjiReferenceSchema>) {
  if (args.table === 'historical-era') {
    if (args.shiIndex === undefined) {
      throw new Error('查询 historical-era 时必须提供 shiIndex。');
    }
    return huangjiJingshi.queryHuangjiReference({ table: args.table, shiIndex: args.shiIndex });
  }
  if (args.shiIndex !== undefined) {
    throw new Error('shiIndex 只可与 historical-era 一起提供。');
  }
  return huangjiJingshi.queryHuangjiReference({ table: args.table });
}

export function registerHuangjiJingshiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_huangji_jingshi',
    {
      description:
        '皇极经世排盘：customDate 返回既有年月日时盘；sixDayDateTime 配合 sixDayEpochDateTime 与 calendarModel=six-day-explicit-epoch 返回显式历元六日逐爻盘；year 兼容值年盘，也支持自定义纪元换算',
      inputSchema: huangjiCalculationSchema,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateHuangjiJingshi(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '皇极经世周期换算失败'));
      }
    },
  );

  server.registerTool(
    'huangji_jingshi_prompt',
    {
      description: '皇极经世完整排盘并生成可直接交给 AI 解读的自包含任务书',
      inputSchema: huangjiPromptSchema,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateHuangjiJingshi(args);
        return createStructuredToolResult({
          result,
          prompt: huangjiJingshi.buildHuangjiJingshiPrompt(result, args.question, args.schools, {
            topicId: args.topicId,
            subtopicId: args.subtopicId,
            scope: args.scope,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成皇极经世提示词失败'));
      }
    },
  );

  server.registerTool(
    'huangji_reference_tables',
    {
      description:
        '查询固定版本皇极经世扩展资料：声音律吕分类与数目、动植物数，以及按经辰序号查询的历史纪年原表',
      inputSchema: huangjiReferenceToolSchema,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateHuangjiReference(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '皇极经世扩展资料查询失败'));
      }
    },
  );
}
