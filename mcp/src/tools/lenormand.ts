import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import type { LenormandSpreadType } from 'mingyu-core/types';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { randomOptionShape, readMcpRandomOptions } from './random-options.js';

const lenormandSchema = z.object({
  ...randomOptionShape,
  spreadType: z
    .enum([
      'single',
      'three',
      'five',
      'relationship',
      'decision',
      'nine',
      'element',
      'grandTableau',
    ])
    .optional()
    .describe(
      '牌阵类型：single=单牌, three=三牌, five=五牌十字, relationship=关系, decision=选择, nine=九宫, element=元素, grandTableau=大桌',
    ),
});

const lenormandPromptSchema = extendPromptSchema(
  lenormandSchema,
  'lenormand',
  '用户希望围绕雷诺曼牌阵解读的问题',
);

function buildLenormandResult(args: z.infer<typeof lenormandSchema>) {
  return drawLenormandSpread(
    (args.spreadType ?? 'single') as LenormandSpreadType,
    readMcpRandomOptions(args),
  );
}

export function registerLenormandTool(server: McpServer) {
  server.registerTool(
    'divine_lenormand',
    {
      description:
        '雷诺曼抽牌：偏现实事件判断，支持单牌、三牌、五牌十字、关系、选择、九宫、元素牌阵和大桌牌阵',
      inputSchema: { ...lenormandSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildLenormandResult(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '雷诺曼抽牌失败'));
      }
    },
  );

  server.registerTool(
    'lenormand_prompt',
    {
      description:
        '雷诺曼抽牌并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要牌阵结果时调用 divine_lenormand',
      inputSchema: lenormandPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildLenormandResult(args);
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('lenormand', args.question, result, args.promptMode, {
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成雷诺曼提示词失败'));
      }
    },
  );
}
