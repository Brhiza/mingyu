import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateAlmanacSelection } from 'mingyu-core/divination/almanac';
import type { AlmanacParticipantInput, AlmanacTopic } from 'mingyu-core/types';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
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

const almanacParticipantSchema = z.object({
  id: z.string().optional().describe('参与人 ID，不填时按顺序自动生成'),
  name: z.string().optional().describe('参与人姓名'),
  gender: z.enum(['男', '女', '']).optional().describe('参与人性别'),
  year: z.number().describe('出生年'),
  month: z.number().describe('出生月'),
  day: z.number().describe('出生日'),
  timeIndex: z.number().describe('出生时辰索引：0=早子时,...,12=晚子时'),
  dateType: z.enum(['solar', 'lunar']).describe('日期类型：solar 为阳历，lunar 为农历'),
  isLeapMonth: z.boolean().optional().describe('是否为农历闰月'),
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

    return {
      id: item.id ?? `participant-${index + 1}`,
      name: item.name ?? '',
      gender: item.gender ?? '',
      year: String(item.year),
      month: String(item.month),
      day: String(item.day),
      timeIndex: String(timeIndex),
      dateType: item.dateType,
      isLeapMonth: item.isLeapMonth ?? false,
    };
  });
}

function buildAlmanacResult(args: z.infer<typeof almanacSchema>) {
  const { startDate, endDate } = readMcpDateRange(args.startDate, args.endDate);
  return generateAlmanacSelection({
    topic: (args.topic ?? 'custom') as AlmanacTopic,
    startDate,
    endDate,
    participants: buildAlmanacParticipants(args.participants),
  });
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
      description:
        '黄历择日并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要完整择日结果时调用 divine_almanac',
      inputSchema: almanacPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildAlmanacResult(args);
        const question = args.question ?? '';
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('almanac', question, result, args.promptMode, {
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成黄历择日提示词失败'));
      }
    },
  );
}
