import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zodiac } from 'mingyu-core';
import { isValidGanZhi } from 'mingyu-core/ganzhi';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';
import { createPromptSchoolsShape } from './school-options.js';

const zodiacSchema = z.object({
  zodiac: z.string().describe('生肖或地支，如「鼠」或「子」'),
  year: z
    .number()
    .int()
    .min(1900)
    .max(2200)
    .optional()
    .describe('公元年；与 yearGanZhi 至少提供一项'),
  yearGanZhi: z
    .string()
    .refine(isValidGanZhi, 'yearGanZhi 必须是有效的六十甲子')
    .optional()
    .describe('直接给定流年干支，如「甲辰」；与 year 至少提供一项'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

export function registerZodiacTool(server: McpServer) {
  server.registerTool(
    'metaphysics_zodiac',
    {
      description:
        '生肖流年关系：必须明确提供 year 或 yearGanZhi，由年支逐项推算值/冲/刑/害/破、流年干支五行与三合六合三会关系，并返回证据和解释边界',
      inputSchema: { ...zodiacSchema.shape, ...calculationDetailShape },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = zodiac.calculateZodiacYearFortune(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生肖运程推算失败'));
      }
    },
  );

  server.registerTool(
    'zodiac_prompt',
    {
      description: '生肖流年逐项关系证据，并生成结构化 AI 解读提示词',
      inputSchema: { ...zodiacSchema.shape, ...createPromptSchoolsShape('zodiac') },
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = zodiac.calculateZodiacYearFortune(args);
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, {
            method: 'zodiac',
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成生肖运程提示词失败'));
      }
    },
  );
}
