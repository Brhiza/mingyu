import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { zodiac } from 'mingyu-core';
import { isValidGanZhi, EARTHLY_BRANCHES, ZODIACS } from 'mingyu-core/ganzhi';
import { resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';

const zodiacSchema = z.object({
  zodiac: z.string().describe('生肖或地支，如「鼠」或「子」'),
  year: z.number().int().min(1900).max(2200).optional().describe('明确的公元流年'),
  yearGanZhi: z
    .string()
    .refine(isValidGanZhi, 'yearGanZhi 必须是有效的六十甲子')
    .optional()
    .describe('直接给定流年干支，如「甲辰」；与 year 至少提供一项，同时提供时必须一致'),
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
        '生肖与流年固定关系：由年支逐项核验值/冲/刑/害/破、流年干支五行与三合六合三会关系，只返回关系事实、证据和解释边界',
      inputSchema: zodiacSchema.shape,
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const branch = resolveZodiacBranch(args.zodiac);
        const yearGanZhi = zodiac.resolveZodiacYearGanZhi({
          year: args.year,
          yearGanZhi: args.yearGanZhi,
        });
        const result = zodiac.rebuildAuditedZodiacData(
          zodiac.getZodiacYearFortune(branch, yearGanZhi),
        );
        return createStructuredToolResult({ result });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生肖与流年关系计算失败'));
      }
    },
  );

  server.registerTool(
    'zodiac_prompt',
    {
      description:
        '生肖与流年逐项关系证据，并生成供 AI 结合问题继续推算的结构化提示词；不生成利弊、现实贵人或行动建议',
      inputSchema: zodiacSchema.shape,
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const branch = resolveZodiacBranch(args.zodiac);
        const yearGanZhi = zodiac.resolveZodiacYearGanZhi({
          year: args.year,
          yearGanZhi: args.yearGanZhi,
        });
        const result = zodiac.rebuildAuditedZodiacData(
          zodiac.getZodiacYearFortune(branch, yearGanZhi),
        );
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, { method: 'zodiac' }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成生肖与流年关系提示词失败'));
      }
    },
  );
}
