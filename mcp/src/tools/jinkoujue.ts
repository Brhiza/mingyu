import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateJinkoujue } from 'mingyu-core/divination/jinkoujue';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate, readMcpPositiveInteger } from './input-helpers.js';
import {
  assertMcpNoRandomOptions,
  randomOptionShape,
  readMcpRandomOptions,
} from './random-options.js';

const jinkoujueSchema = z.object({
  ...randomOptionShape,
  jinkoujueMethod: z
    .enum(['time', 'number', 'random'])
    .optional()
    .describe('起课方式：time=时间起课, number=数字起课, random=随机起课'),
  jinkoujueNumber: z.number().optional().describe('数字起课时使用的正整数'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起课时间（ISO 8601 格式），不提供则使用当前时间'),
});

const jinkoujuePromptSchema = extendPromptSchema(
  jinkoujueSchema,
  'jinkoujue',
  '用户希望围绕金口诀结果解读的问题',
);

function buildJinkoujueInput(args: z.infer<typeof jinkoujueSchema>) {
  const method = args.jinkoujueMethod || 'time';
  if (method !== 'random') {
    assertMcpNoRandomOptions(args, '金口诀仅随机起课接受 seed 或 replay。');
  }
  return {
    method,
    ...(method === 'number'
      ? { number: readMcpPositiveInteger(args.jinkoujueNumber, 'jinkoujueNumber') }
      : {}),
    customDate: readMcpCustomDate(args.customDate),
    ...(method === 'random' ? readMcpRandomOptions(args) : {}),
  };
}

export function registerJinkoujueTool(server: McpServer) {
  server.registerTool(
    'divine_jinkoujue',
    {
      description: '金口诀起课：按地分、将神、贵神、人元四位一体生成完整课盘与结构化证据',
      inputSchema: { ...jinkoujueSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = generateJinkoujue(buildJinkoujueInput(args));
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '金口诀起课失败'));
      }
    },
  );

  server.registerTool(
    'jinkoujue_prompt',
    {
      description:
        '金口诀起课并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要四位课盘时调用 divine_jinkoujue',
      inputSchema: jinkoujuePromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = generateJinkoujue(buildJinkoujueInput(args));
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('jinkoujue', args.question, result, args.promptMode, {
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成金口诀提示词失败'));
      }
    },
  );
}
