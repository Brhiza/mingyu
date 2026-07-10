import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { bazhai } from 'mingyu-core';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const baZhaiSchema = z.object({
  birthYear: z.number().int().min(1900).max(2100).optional().describe('出生公历年份（用于推命卦）'),
  gender: z.enum(['male', 'female']).optional().describe('性别'),
  mingGua: z.string().optional().describe('直接给定命卦（坎坤震巽乾兑艮离）'),
  sitMountain: z.string().optional().describe('坐山（二十四山，如「子」），用于推宅卦'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerBaZhaiTool(server: McpServer) {
  server.registerTool(
    'metaphysics_bazhai',
    {
      description:
        '八宅风水排盘：以命卦（东四/西四命）与宅卦配合，排八宅大游年四吉四凶方，分析命宅配合与宜忌方位',
      inputSchema: baZhaiSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = bazhai.analyzeBaZhai({
          birthYear: args.birthYear,
          gender: args.gender,
          mingGua: args.mingGua,
          sitMountain: args.sitMountain,
        });
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '八宅排盘失败'));
      }
    },
  );

  server.registerTool(
    'bazhai_prompt',
    {
      description: '八宅风水排盘并生成结构化 AI 解读提示词',
      inputSchema: baZhaiSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = bazhai.analyzeBaZhai({
          birthYear: args.birthYear,
          gender: args.gender,
          mingGua: args.mingGua,
          sitMountain: args.sitMountain,
        });
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成八宅提示词失败'));
      }
    },
  );
}
