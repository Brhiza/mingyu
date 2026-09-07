import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wuyunLiuqi } from 'mingyu-core';
import { isValidGanZhi } from 'mingyu-core/ganzhi';
import { resolvePromptSelection } from 'mingyu-core/prompt';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { createPromptSchoolsShape } from './school-options.js';

const wuyunLiuqiSchema = z.object({
  year: z.number().int().min(1).max(9999).optional().describe('公历年，按该年年中所属年柱换算'),
  yearGanZhi: z
    .string()
    .refine(isValidGanZhi, 'yearGanZhi 必须是有效的六十甲子')
    .optional()
    .describe('明确年干支，如「丙午」；与 year 同时提供会校验一致性'),
  question: z.string().min(1).optional().describe('希望 AI 重点解释的问题'),
  topicId: z.string().optional().describe('统一解读主题 ID'),
  subtopicId: z.string().optional().describe('统一解读主题细项 ID'),
  scope: z.string().optional().describe('统一分析范围 ID'),
});

function calculateWuyunLiuqi(args: z.infer<typeof wuyunLiuqiSchema>) {
  if (args.year === undefined && args.yearGanZhi === undefined) {
    throw new Error('五运六气必须提供 year 或 yearGanZhi。');
  }
  return wuyunLiuqi.calculateWuyunLiuqi(args);
}

export function registerWuyunLiuqiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_wuyun_liuqi',
    {
      description:
        '五运六气年度计算：返回岁运、五步主客运与五音太少、司天在泉、气运相临、天符岁会及六步节令主客气',
      inputSchema: {
        ...wuyunLiuqiSchema.omit({ question: true }).shape,
        ...calculationDetailShape,
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateWuyunLiuqi(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '五运六气计算失败'));
      }
    },
  );

  server.registerTool(
    'wuyun_liuqi_prompt',
    {
      description: '五运六气年度深化计算并生成可直接交给 AI 的完整任务书',
      inputSchema: {
        ...wuyunLiuqiSchema.shape,
        ...createPromptSchoolsShape('wuyun-liuqi'),
      },
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateWuyunLiuqi(args);
        const selectionResolution =
          args.topicId !== undefined || args.subtopicId !== undefined || args.scope !== undefined
            ? resolvePromptSelection({
                methodId: 'wuyun-liuqi',
                topicId: args.topicId,
                subtopicId: args.subtopicId,
                scope: args.scope,
              })
            : undefined;
        if (selectionResolution && !selectionResolution.ok) {
          throw new Error(selectionResolution.message);
        }
        return createStructuredToolResult({
          result,
          prompt: wuyunLiuqi.buildWuyunLiuqiPrompt(
            result,
            args.question,
            args.schools,
            selectionResolution?.ok ? selectionResolution.selection : undefined,
          ),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成五运六气提示词失败'));
      }
    },
  );
}
