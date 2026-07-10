import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zodiac } from 'mingyu-core';
import { getGanZhiFromDate, isValidGanZhi, EARTHLY_BRANCHES, ZODIACS } from 'mingyu-core/ganzhi';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const zodiacSchema = z.object({
  zodiac: z.string().describe('生肖或地支，如「鼠」或「子」'),
  year: z.number().int().min(1900).max(2200).optional().describe('公元年（默认今年）'),
  yearGanZhi: z
    .string()
    .refine(isValidGanZhi, 'yearGanZhi 必须是有效的六十甲子')
    .optional()
    .describe('直接给定流年干支，如「甲辰」'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

function resolveZodiacBranch(z: string): string {
  if ((EARTHLY_BRANCHES as readonly string[]).includes(z)) return z;
  const idx = ZODIACS.findIndex((name) => name === z);
  if (idx >= 0) return EARTHLY_BRANCHES[idx];
  throw new Error(`无法识别的生肖/地支：${z}`);
}

export function registerZodiacTool(server: McpServer) {
  server.registerTool(
    'metaphysics_zodiac',
    {
      description:
        '生肖犯太岁与流年运程：由年支推算值/冲/刑/害/破太岁，并结合流年干支五行、三合六合贵人给出运程等级',
      inputSchema: zodiacSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const branch = resolveZodiacBranch(args.zodiac);
        const yearGanZhi =
          args.yearGanZhi ||
          getGanZhiFromDate(new Date(args.year ?? new Date().getFullYear(), 1, 10)).year;
        const result = zodiac.getZodiacYearFortune(branch, yearGanZhi);
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生肖运程推算失败'));
      }
    },
  );

  server.registerTool(
    'zodiac_prompt',
    {
      description: '生肖犯太岁与流年运程，并生成结构化 AI 解读提示词',
      inputSchema: zodiacSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const branch = resolveZodiacBranch(args.zodiac);
        const yearGanZhi =
          args.yearGanZhi ||
          getGanZhiFromDate(new Date(args.year ?? new Date().getFullYear(), 1, 10)).year;
        const result = zodiac.getZodiacYearFortune(branch, yearGanZhi);
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成生肖运程提示词失败'));
      }
    },
  );
}
