import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { drawLenormandSpread } from 'mingyu-core/divination/lenormand';
import type { LenormandSpreadType } from 'mingyu-core/types';
import { resultOutputSchema } from '../schemas.js';
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
        '雷诺曼抽牌记录：从项目内部1至36牌号目录中抽牌，返回牌号、牌名、牌位、抽取顺序和随机轨迹。逐牌牌义版本校勘完成前不返回关键词、牌义、组合或布局解释',
      inputSchema: lenormandSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = buildLenormandResult(args);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '雷诺曼抽牌失败'));
      }
    },
  );

  server.registerTool(
    'lenormand_prompt',
    {
      description:
        '雷诺曼抽牌并生成结构化 AI 核对提示词：返回可复算的牌号、牌名、牌位与抽取轨迹，并要求 AI 先明确牌组版本、牌义文献、牌阵定义和组合规则后再继续解读',
      inputSchema: lenormandPromptSchema.shape,
      outputSchema: {
        result: z.unknown().describe('雷诺曼牌阵结果'),
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const result = buildLenormandResult(args);
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('lenormand', args.question, result, args.promptMode),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成雷诺曼提示词失败'));
      }
    },
  );
}
