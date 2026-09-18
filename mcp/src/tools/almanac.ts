import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { analyzeAlmanacEvidence, generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import type { AlmanacData, AlmanacParticipantInput, AlmanacTopic } from 'mingyu-core/types';
import { calculationDetailShape, promptOutputSchema, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import {
  buildCommonDivinationPrompt,
  extendOptionalQuestionPromptSchema,
} from './divination-common.js';
import {
  assertMcpBirthDate,
  readMcpDateRange,
  readMcpIntegerLikeInRange,
} from './input-helpers.js';

const almanacParticipantBirthTimeRangeSchema = z.object({
  startTimestamp: z.number().int().describe('区间起点，含，UTC epoch 毫秒整秒时间戳'),
  endTimestamp: z.number().int().describe('区间终点，不含，UTC epoch 毫秒整秒时间戳'),
  endExclusive: z.literal(true),
  timezone: z.literal('Asia/Shanghai'),
  offsetHours: z.literal(8),
  pillars: z.object({
    year: z.string().min(1),
    month: z.string().min(1),
    day: z.string().min(1),
    hour: z.string().min(1),
  }),
});

const almanacParticipantSchema = z.object({
  id: z.string().optional().describe('参与人 ID，不填时按顺序自动生成'),
  name: z.string().optional().describe('参与人姓名'),
  gender: z.enum(['男', '女', '']).optional().describe('参与人性别'),
  year: z.number().describe('出生年'),
  month: z.number().describe('出生月'),
  day: z.number().describe('出生日'),
  timeIndex: z.number().describe('出生时辰索引：0=早子时,...,12=晚子时'),
  birthHour: z.number().int().min(0).max(23).optional().describe('出生区间起点小时'),
  birthMinute: z.number().int().min(0).max(59).optional().describe('出生区间起点分钟'),
  birthSecond: z.number().int().min(0).max(59).optional().describe('出生区间起点秒数'),
  dateType: z.enum(['solar', 'lunar']).describe('日期类型：solar 为阳历，lunar 为农历'),
  isLeapMonth: z.boolean().optional().describe('是否为农历闰月'),
  birthTimeRange: almanacParticipantBirthTimeRangeSchema
    .optional()
    .describe('四柱反推得到的完整北京时间出生半开区间及来源四柱'),
});

const almanacSchema = z.object({
  topic: z
    .enum([
      'marriage',
      'move',
      'opening',
      'contract',
      'travel',
      'medical',
      'study',
      'burial',
      'renovation',
      'custom',
    ])
    .optional()
    .describe('择日事项；不填时使用 custom'),
  startDate: z.string().describe('开始日期，格式为 YYYY-MM-DD'),
  endDate: z.string().describe('结束日期，格式为 YYYY-MM-DD；最多比较 31 天'),
  participants: z
    .array(almanacParticipantSchema)
    .optional()
    .describe('可选参与人出生信息，用于八字适配参考'),
  page: z.number().int().min(1).optional().describe('分页页码；传入 page 或 pageSize 时启用分页'),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(31)
    .optional()
    .describe('分页每页日期数量，最多 31 天；默认 10'),
});

const almanacPromptSchema = extendOptionalQuestionPromptSchema(
  almanacSchema,
  'almanac',
  '用户希望补充给择日任务的现实问题或约束，可不填',
);

function buildAlmanacParticipants(
  participants: z.infer<typeof almanacParticipantSchema>[] | undefined,
): AlmanacParticipantInput[] {
  return (participants ?? []).map((item, index) => {
    assertMcpBirthDate({
      year: item.year,
      month: item.month,
      day: item.day,
      dateType: item.dateType,
      isLeapMonth: item.isLeapMonth ?? false,
    });

    const timeIndex = readMcpIntegerLikeInRange(item.timeIndex, 'timeIndex', 0, 12);
    if (
      item.birthTimeRange &&
      (item.birthHour === undefined ||
        item.birthMinute === undefined ||
        item.birthSecond === undefined)
    ) {
      throw new Error(
        '黄历参与人使用 birthTimeRange 时必须提供 birthHour、birthMinute、birthSecond。',
      );
    }

    return {
      id: item.id ?? `participant-${index + 1}`,
      name: item.name ?? '',
      gender: item.gender ?? '',
      year: String(item.year),
      month: String(item.month),
      day: String(item.day),
      timeIndex: String(timeIndex),
      ...(item.birthHour === undefined ? {} : { birthHour: String(item.birthHour) }),
      ...(item.birthMinute === undefined ? {} : { birthMinute: String(item.birthMinute) }),
      ...(item.birthSecond === undefined ? {} : { birthSecond: String(item.birthSecond) }),
      dateType: item.dateType,
      isLeapMonth: item.isLeapMonth ?? false,
      ...(item.birthTimeRange
        ? {
            birthTimeRange: {
              ...item.birthTimeRange,
              pillars: { ...item.birthTimeRange.pillars },
            },
          }
        : {}),
    };
  });
}

type AlmanacToolResult = AlmanacData & {
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrevious: boolean;
    hasNext: boolean;
  };
};

function buildAlmanacResult(args: z.infer<typeof almanacSchema>): AlmanacToolResult {
  const { startDate, endDate } = readMcpDateRange(args.startDate, args.endDate);
  const result = generateAlmanacSelection({
    topic: (args.topic ?? 'custom') as AlmanacTopic,
    startDate,
    endDate,
    participants: buildAlmanacParticipants(args.participants),
  });
  const shouldPaginate = args.page !== undefined || args.pageSize !== undefined;
  if (!shouldPaginate) return result;

  const page = readMcpIntegerLikeInRange(args.page ?? 1, 'page', 1, Number.MAX_SAFE_INTEGER);
  const pageSize = readMcpIntegerLikeInRange(args.pageSize ?? 10, 'pageSize', 1, 31);
  const total = result.days.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (page > totalPages) {
    throw new Error(`page 不能超过总页数 ${totalPages}。`);
  }
  const pageStart = (page - 1) * pageSize;
  const selectedDays = result.days.slice(pageStart, pageStart + pageSize);
  const pagedResult: AlmanacData = {
    ...result,
    days: selectedDays,
  };
  return {
    ...pagedResult,
    evidenceAnalysis: analyzeAlmanacEvidence(pagedResult),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasPrevious: page > 1,
      hasNext: page < totalPages,
    },
  };
}

export function registerAlmanacTool(server: McpServer) {
  server.registerTool(
    'divine_almanac',
    {
      description:
        '黄历择日：按事项、日期范围和可选参与人八字，列出候选日期、逐日宜忌、神煞与参与人关系',
      inputSchema: { ...almanacSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildAlmanacResult(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '黄历择日失败'));
      }
    },
  );

  server.registerTool(
    'almanac_prompt',
    {
      description: '黄历择日并生成可直接交给 AI 的完整任务书，同时返回本次候选日期和择日证据',
      inputSchema: almanacPromptSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = buildAlmanacResult(args);
        const question = args.question ?? '';
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('almanac', question, result, args.promptMode, {
            schools: args.schools,
            topicId: args.topicId,
            subtopicId: args.subtopicId,
            scope: args.scope,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成黄历择日提示词失败'));
      }
    },
  );
}
