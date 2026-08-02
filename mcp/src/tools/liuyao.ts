import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpRequiredCustomDate } from './input-helpers.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const liuyaoSchema = z.object({
  ...randomOptionShape,
  method: z
    .enum(['time', 'manual', 'coins'])
    .describe(
      '起卦方式：time=时间戳固定种子的三钱模拟（兼容名），manual=手工爻值，coins=三钱记录或随机模拟',
    ),
  yaos: z
    .array(z.number().int().min(6).max(9))
    .length(6)
    .optional()
    .describe('手工六爻值，按初爻至上爻传入 6、7、8、9'),
  coinThrows: z
    .array(
      z.object({
        coins: z.tuple([
          z.union([z.literal(2), z.literal(3)]),
          z.union([z.literal(2), z.literal(3)]),
          z.union([z.literal(2), z.literal(3)]),
        ]),
        total: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]),
      }),
    )
    .length(6)
    .optional()
    .describe('逐爻三钱记录，按初爻至上爻传入；每爻三枚钱按字面 2、背面 3 计值'),
  customDate: z
    .string()
    .describe('明确的起卦时间（ISO 8601 格式）；time 方法会把时间戳作为固定三钱模拟的种子'),
  liuyaoTemplate: z
    .enum(['general', 'ganqing', 'shiye', 'caifu', 'guaishen'])
    .optional()
    .describe(
      '专项断卦模板：general=通用, ganqing=感情, shiye=事业, caifu=财运, guaishen=鬼神怪异',
    ),
});

const liuyaoPromptSchema = extendPromptSchema(liuyaoSchema, '用户希望围绕卦盘解读的问题');

function buildLiuyaoResult(args: z.infer<typeof liuyaoSchema>) {
  return generateLiuyao(readMcpRequiredCustomDate(args.customDate), {
    method: args.method,
    yaos: args.yaos,
    coinThrows: args.coinThrows,
    ...readMcpRandomOptions(args),
  });
}

export function registerLiuyaoTool(server: McpServer) {
  server.registerTool(
    'divine_liuyao',
    {
      description:
        '六爻起卦：支持时间种子模拟三钱、手工爻值和逐爻三钱记录，包含纳甲、六亲、六神、世应、动变、空亡等完整信息',
      inputSchema: liuyaoSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildLiuyaoResult(args);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '起卦失败'));
      }
    },
  );

  server.registerTool(
    'liuyao_prompt',
    {
      description:
        '六爻起卦并生成结构化 AI 解读提示词：一次调用返回卦盘数据和可直接复制给 AI 的提示词',
      inputSchema: liuyaoPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('六爻卦盘数据'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildLiuyaoResult(args);
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('liuyao', args.question, result, args.promptMode, {
            liuyaoTemplate: args.liuyaoTemplate,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成六爻提示词失败'));
      }
    },
  );
}
