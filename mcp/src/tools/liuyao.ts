import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateLiuyao } from 'mingyu-core/divination/liuyao';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate } from './input-helpers.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const liuyaoSchema = z.object({
  ...randomOptionShape,
  method: z
    .enum(['time', 'manual', 'coins'])
    .optional()
    .describe('起卦方式：time=时间，manual=手工爻值，coins=模拟三钱投掷'),
  yaos: z
    .array(z.number().int().min(6).max(9))
    .length(6)
    .optional()
    .describe('手工六爻值，按初爻至上爻传入 6、7、8、9'),
  customDate: z
    .string()
    .optional()
    .describe('自定义起卦时间（ISO 8601 格式），不提供则使用当前时间'),
  liuyaoTemplate: z
    .enum(['general', 'ganqing', 'shiye', 'caifu', 'guaishen'])
    .optional()
    .describe(
      '专项断卦模板：general=通用, ganqing=感情, shiye=事业, caifu=财运, guaishen=鬼神怪异',
    ),
});

const liuyaoPromptSchema = extendPromptSchema(liuyaoSchema, 'liuyao', '用户希望围绕卦盘解读的问题');

function buildLiuyaoResult(args: z.infer<typeof liuyaoSchema>) {
  return generateLiuyao(readMcpCustomDate(args.customDate), {
    method: args.method,
    yaos: args.yaos,
    ...readMcpRandomOptions(args),
  });
}

export function registerLiuyaoTool(server: McpServer) {
  server.registerTool(
    'divine_liuyao',
    {
      description:
        '六爻起卦：基于当前时间或自定义时间生成六爻卦象，包含纳甲、六亲、六神、世应、动变、空亡等完整信息',
      inputSchema: { ...liuyaoSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildLiuyaoResult(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '起卦失败'));
      }
    },
  );

  server.registerTool(
    'liuyao_prompt',
    {
      description:
        '六爻起卦并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要卦盘数据时调用 divine_liuyao',
      inputSchema: liuyaoPromptSchema.shape,
      outputSchema: {
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
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成六爻提示词失败'));
      }
    },
  );
}
