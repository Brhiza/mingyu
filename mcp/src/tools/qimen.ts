import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { generateQimen } from 'mingyu-core/divination/qimen';
import { calculationDetailShape, resultOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildCommonDivinationPrompt, extendPromptSchema } from './divination-common.js';
import { readMcpCustomDate } from './input-helpers.js';

const qimenSchema = z.object({
  customDate: z
    .string()
    .optional()
    .describe('自定义排盘时间（ISO 8601 格式），不提供则使用当前时间'),
  qimenMethod: z
    .enum(['zhuanpan', 'feipan'])
    .optional()
    .describe('排盘方法：zhuanpan 为转盘法（默认），feipan 为飞盘法'),
  qimenJuMethod: z
    .enum(['chaibu', 'zhirun'])
    .optional()
    .describe('定局方法：chaibu 为拆补法（默认），zhirun 为置闰法；仅时家/日家生效'),
});

const qimenPromptSchema = extendPromptSchema(qimenSchema, 'qimen', '用户希望围绕奇门盘解读的问题');

export function registerQimenTool(server: McpServer) {
  server.registerTool(
    'divine_qimen',
    {
      description:
        '奇门遁甲排盘：基于当前时间或自定义时间生成时家奇门盘，包含天地人神四盘、值符值使、格局标签、节令背景、复合格局与宫位洞察',
      inputSchema: { ...qimenSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const method = args.qimenMethod ?? 'zhuanpan';
        const juMethod = args.qimenJuMethod ?? 'chaibu';
        const result = generateQimen(
          readMcpCustomDate(args.customDate),
          method as 'zhuanpan' | 'feipan',
          'hour',
          juMethod as 'chaibu' | 'zhirun',
        );
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '排盘失败'));
      }
    },
  );

  server.registerTool(
    'qimen_prompt',
    {
      description:
        '奇门遁甲排盘并生成可直接复制给 AI 的完整提示词，仅返回提示词；需要完整奇门盘时调用 divine_qimen',
      inputSchema: qimenPromptSchema.shape,
      outputSchema: {
        prompt: z.string().describe('可直接用于 AI 解读的结构化提示词'),
      },
    },
    async (args) => {
      try {
        const method = args.qimenMethod ?? 'zhuanpan';
        const juMethod = args.qimenJuMethod ?? 'chaibu';
        const result = generateQimen(
          readMcpCustomDate(args.customDate),
          method as 'zhuanpan' | 'feipan',
          'hour',
          juMethod as 'chaibu' | 'zhirun',
        );
        return createStructuredToolResult({
          result,
          prompt: buildCommonDivinationPrompt('qimen', args.question, result, args.promptMode, {
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成奇门提示词失败'));
      }
    },
  );
}
