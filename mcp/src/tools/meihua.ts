import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateMeihua } from 'mingyu-core/divination/meihua';
import type { MeihuaSettings } from 'mingyu-core/types';
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

const meihuaSchema = z.object({
  ...randomOptionShape,
  method: z
    .enum(['time', 'number', 'random', 'timeTrigram'])
    .optional()
    .describe(
      '起卦方式：time=时间起卦, number=数字起卦, random=随机起卦, timeTrigram=兼容旧参数并按时间起卦',
    ),
  number: z.number().optional().describe('数字起卦时使用的正整数'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起卦时间（ISO 8601 格式），不提供则使用当前时间'),
});

const meihuaPromptSchema = extendPromptSchema(meihuaSchema, 'meihua', '用户希望围绕卦盘解读的问题');

function buildMeihuaSettings(args: z.infer<typeof meihuaSchema>): MeihuaSettings {
  const method = args.method || 'time';
  if (method !== 'random') {
    assertMcpNoRandomOptions(args, '梅花易数仅随机起卦接受 seed 或 replay。');
  }
  return {
    method,
    ...(method === 'number' ? { number: readMcpPositiveInteger(args.number, 'number') } : {}),
    ...(method === 'random' ? readMcpRandomOptions(args) : {}),
  };
}

export function registerMeihuaTool(server: McpServer) {
  server.registerTool(
    'divine_meihua',
    {
      description:
        '梅花易数起卦：支持时间起卦、数字起卦、随机起卦，timeTrigram 作为兼容旧参数按时间起卦计算，生成主卦、互卦、变卦/体用生克分析及应期判断',
      inputSchema: { ...meihuaSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpCustomDate(args.customDate), settings);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '起卦失败'));
      }
    },
  );

  server.registerTool(
    'meihua_prompt',
    {
      description:
        '梅花易数起卦并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要主互变卦等卦盘数据时调用 divine_meihua',
      inputSchema: meihuaPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const settings = buildMeihuaSettings(args);
        const result = generateMeihua(readMcpCustomDate(args.customDate), settings);
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('meihua', args.question, result, args.promptMode, {
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成梅花提示词失败'));
      }
    },
  );
}
