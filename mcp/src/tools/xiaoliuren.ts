import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateXiaoliuren } from 'mingyu-core/divination/xiaoliuren';
import { resultOutputSchema } from '../schemas.js';
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

const xiaoliurenSchema = z.object({
  ...randomOptionShape,
  xiaoliurenMethod: z
    .enum(['time', 'number', 'random'])
    .optional()
    .describe('起课方式：time=时间起课, number=数字起课, random=随机起课'),
  xiaoliurenNumber: z.number().optional().describe('数字起课时使用的正整数'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起课时间（ISO 8601 格式），不提供则使用当前时间'),
});

const xiaoliurenPromptSchema = extendPromptSchema(
  xiaoliurenSchema,
  '用户希望围绕小六壬结果解读的问题',
);

function buildXiaoliurenInput(args: z.infer<typeof xiaoliurenSchema>) {
  const method = args.xiaoliurenMethod || 'time';
  if (method !== 'random') {
    assertMcpNoRandomOptions(args, '小六壬仅随机起课接受 seed 或 replay。');
  }
  return {
    method,
    ...(method === 'number'
      ? { number: readMcpPositiveInteger(args.xiaoliurenNumber, 'xiaoliurenNumber') }
      : {}),
    customDate: readMcpCustomDate(args.customDate),
    ...(method === 'random' ? readMcpRandomOptions(args) : {}),
  };
}

export function registerXiaoliurenTool(server: McpServer) {
  server.registerTool(
    'divine_xiaoliuren',
    {
      description:
        '小六壬起课：支持时间起课、数字起课、随机起课，生成起因、过程、结果三段宫位与行动倾向',
      inputSchema: xiaoliurenSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = generateXiaoliuren(buildXiaoliurenInput(args));
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '小六壬起课失败'));
      }
    },
  );

  server.registerTool(
    'xiaoliuren_prompt',
    {
      description:
        '小六壬起课并生成结构化 AI 解读提示词：一次调用返回课盘结果和可直接复制给 AI 的提示词',
      inputSchema: xiaoliurenPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('小六壬课盘数据'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = generateXiaoliuren(buildXiaoliurenInput(args));
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('xiaoliuren', args.question, result, args.promptMode),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成小六壬提示词失败'));
      }
    },
  );
}
