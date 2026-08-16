import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { xuankong } from 'mingyu-core';
import { TWENTY_FOUR_MOUNTAINS } from 'mingyu-core/direction';
import { calculationDetailShape, resultOutputSchema, promptOutputSchema } from '../schemas.js';
import {
  createErrorToolResult,
  createStructuredToolResult,
  getErrorMessage,
} from '../tool-results.js';
import { buildMetaphysicsPrompt } from '../metaphysics-prompt.js';
import { createPromptSchoolsShape } from './school-options.js';

const mountainSchema = z
  .string()
  .refine((value) => TWENTY_FOUR_MOUNTAINS.includes(value), '必须是有效二十四山')
  .optional();

const xuanKongSchema = z.object({
  year: z.number().int().min(1).max(9999).describe('建造年或起运年'),
  sitMountain: mountainSchema.describe('坐山二十四山'),
  facingMountain: mountainSchema.describe('朝向二十四山'),
  facingDegree: z.number().min(0).max(360).optional().describe('朝向度数，正北 0°'),
  sitDegree: z.number().min(0).max(360).optional().describe('坐山度数，正北 0°'),
  measurementUncertaintyDegrees: z
    .number()
    .min(0)
    .max(45)
    .optional()
    .describe('测量误差，用于边界敏感判断'),
  question: z.string().optional().describe('希望 AI 重点解读的问题'),
});

function calculateXuanKong(args: z.infer<typeof xuanKongSchema>) {
  return xuankong.generateXuanKong({
    year: args.year,
    ...(args.sitMountain ? { sitMountain: args.sitMountain } : {}),
    ...(args.facingMountain ? { facingMountain: args.facingMountain } : {}),
    ...(args.facingDegree !== undefined ? { facingDegree: args.facingDegree } : {}),
    ...(args.sitDegree !== undefined ? { sitDegree: args.sitDegree } : {}),
    ...(args.measurementUncertaintyDegrees !== undefined
      ? { measurementUncertaintyDegrees: args.measurementUncertaintyDegrees }
      : {}),
  });
}

export function registerXuanKongTool(server: McpServer) {
  server.registerTool(
    'metaphysics_xuankong',
    {
      description:
        '玄空飞星 v1：按建造/起运年与山向生成运盘、山盘、向盘、到山到向及结构化证据；不做形峦或吉凶总分',
      inputSchema: {
        ...xuanKongSchema.omit({ question: true }).shape,
        ...calculationDetailShape,
      },
      outputSchema: resultOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateXuanKong(args);
        return createStructuredToolResult({ result }, args.detailMode);
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '玄空飞星排盘失败'));
      }
    },
  );

  server.registerTool(
    'xuankong_prompt',
    {
      description: '玄空飞星排盘并生成可直接复制给 AI 的结构化提示词',
      inputSchema: { ...xuanKongSchema.shape, ...createPromptSchoolsShape('xuankong') },
      outputSchema: promptOutputSchema,
    },
    async (args) => {
      try {
        const result = calculateXuanKong(args);
        return createStructuredToolResult({
          result,
          prompt: buildMetaphysicsPrompt(result.prompt, args.question, {
            method: 'xuankong',
            schools: args.schools,
          }),
        });
      } catch (error) {
        return createErrorToolResult(getErrorMessage(error, '生成玄空飞星提示词失败'));
      }
    },
  );
}
